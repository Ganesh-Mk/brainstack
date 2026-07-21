"""The public API — `/v1` (PHASE_11 §1.1, §3).

A namespace of its own, deliberately. The app's internal routes are a private
contract between our frontend and this backend, and eight phases have changed
them freely. `/v1` is a promise to someone else's code, so it gets its own
surface, its own auth dependency, and its own error shape.

The handlers stay thin — the work lives in app/services (ask, library, chat),
shared with the app routes. Only the contract is separate, never the logic.

Two things the app route does that `/v1` deliberately does not:
  * long-term memory extraction — memory is about a *person*, and a service
    account is not one; API asks would poison a human's recalled facts.
  * the per-conversation streaming lock — API callers are expected to run
    concurrently, and each ask that omits conversation_id gets its own.
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from typing import Generator

from fastapi import APIRouter, BackgroundTasks, Depends, Request, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import db as app_db
from app.config import get_settings
from app.core.principal import ApiError, Principal, get_api_principal, require_scope
from app.db import get_db
from app.models import ApiKey, Conversation, Message, Tenant
from app.schemas.v1 import (
    V1AskRequest,
    V1AskResponse,
    V1Document,
    V1DocumentList,
    V1DocumentUrlRequest,
    V1Me,
    V1SearchRequest,
    V1SearchResponse,
    V1Source,
    V1Tenant,
    V1TraceStep,
    V1Usage,
)
from app.services import agent, apiusage, chat, library, traces, usage
from app.services import ask as ask_service

log = logging.getLogger("v1")

router = APIRouter(prefix="/v1", tags=["v1"])


def _masked(key: ApiKey) -> str:
    return f"{key.prefix}_{'•' * 8}{key.last4}"


def _source_out(s: dict) -> V1Source:
    return V1Source(
        n=s["n"],
        title=s["title"],
        page=s["page"],
        text=s["text"],
        score=s["score"],
        source_type=s.get("source_type", "pdf"),
        document_id=s.get("document_id") or None,
        source_url=s.get("source_url"),
    )


def _document_out(doc) -> V1Document:
    return V1Document(
        id=doc.id,
        title=doc.title,
        source_type=doc.source_type,
        status=doc.status,
        chunk_count=doc.chunk_count,
        chunks_done=doc.chunks_done,
        error=doc.error,
        created_at=doc.created_at,
    )


def _api_error(err: library.LibraryError) -> ApiError:
    return ApiError(err.status_code, err.code, err.message)


# ── /v1/me ───────────────────────────────────────────────────────────────────


@router.get("/me", response_model=V1Me)
def me(
    principal: Principal = Depends(get_api_principal),
    db: Session = Depends(get_db),
) -> V1Me:
    """Introspect the calling key. Requires no scope: a key must always be
    able to discover what it is and what it may do."""
    key = db.get(ApiKey, principal.api_key_id)
    tenant = db.get(Tenant, principal.tenant_id)
    if key is None or tenant is None:  # pragma: no cover — resolved a moment ago
        raise ApiError(401, "invalid_api_key", "This API key is no longer valid.")
    return V1Me(
        key_id=key.id,
        name=key.name,
        environment=key.environment,
        masked=_masked(key),
        scopes=sorted(principal.scopes),
        role=principal.role,
        tenant=V1Tenant(id=tenant.id, name=tenant.name, slug=tenant.slug),
        created_at=key.created_at,
        expires_at=key.expires_at,
        rate_limit_per_hour=key.rate_limit_per_hour,
        monthly_cost_cap_usd=key.monthly_cost_cap_usd,
    )


@router.get("/usage")
def key_usage(
    principal: Principal = Depends(require_scope("analytics:read")),
    db: Session = Depends(get_db),
) -> dict:
    """This key's own metering — so a customer can bill their own users."""
    key = db.get(ApiKey, principal.api_key_id)
    if key is None:  # pragma: no cover
        raise ApiError(401, "invalid_api_key", "This API key is no longer valid.")
    detail = apiusage.key_detail(db, key)
    detail["spend_this_month_usd"] = round(usage.month_to_date(db, key.id), 6)
    detail["monthly_cost_cap_usd"] = key.monthly_cost_cap_usd
    detail["rate_limit_per_hour"] = key.rate_limit_per_hour
    return detail


# ── /v1/search — retrieval only, no model ────────────────────────────────────


@router.post("/search", response_model=V1SearchResponse)
def search(
    body: V1SearchRequest,
    principal: Principal = Depends(require_scope("search:read")),
    db: Session = Depends(get_db),
) -> V1SearchResponse:
    """The hybrid retrieval stack (dense + BM25 + RRF + optional rerank) with
    no LLM call: cheap, fast, deterministic. The "bring your own model"
    endpoint."""
    t0 = time.perf_counter()
    settings = get_settings()
    top_k = body.top_k or settings.CHAT_TOP_K
    found = chat.retrieve(db, principal.tenant_id, body.query)[:top_k]
    # Renumber after truncation so [n] stays contiguous for the caller.
    results = []
    for i, s in enumerate(found, start=1):
        s.n = i
        results.append(_source_out(s.to_dict()))
    return V1SearchResponse(
        query=body.query,
        results=results,
        latency_ms=round((time.perf_counter() - t0) * 1000),
    )


# ── /v1/ask ──────────────────────────────────────────────────────────────────


def _resolve_conversation(
    db: Session, principal: Principal, conversation_id: uuid.UUID | None
) -> Conversation:
    """Conversations are scoped to (tenant, user). A key's user is whoever
    minted it, so a key can continue only conversations it started."""
    if conversation_id is None:
        convo = Conversation(tenant_id=principal.tenant_id, user_id=principal.user_id)
        db.add(convo)
        db.commit()
        db.refresh(convo)
        return convo
    convo = db.get(Conversation, conversation_id)
    if (
        convo is None
        or convo.tenant_id != principal.tenant_id
        or convo.user_id != principal.user_id
    ):
        raise ApiError(404, "conversation_not_found", "No such conversation.")
    return convo


def _persist_turn(
    session: Session,
    convo_id: uuid.UUID,
    tenant_id: uuid.UUID,
    question: str,
    outcome: ask_service.AskOutcome,
) -> None:
    """Same contract as the app route: both messages commit together, only
    after the answer is complete."""
    next_seq = (
        session.scalar(
            select(func.max(Message.seq)).where(Message.conversation_id == convo_id)
        )
        or 0
    ) + 1
    session.add_all(
        [
            Message(
                conversation_id=convo_id,
                tenant_id=tenant_id,
                role="user",
                seq=next_seq,
                content=question,
            ),
            Message(
                conversation_id=convo_id,
                tenant_id=tenant_id,
                role="assistant",
                seq=next_seq + 1,
                content=outcome.answer,
                sources=json.dumps(outcome.sources) if outcome.sources else None,
                trace=json.dumps(outcome.trace) if outcome.trace else None,
            ),
        ]
    )
    fresh = session.get(Conversation, convo_id)
    if fresh is not None:
        if not fresh.title or fresh.title == "New conversation":
            fresh.title = (question[:117] + "…") if len(question) > 118 else question
        fresh.updated_at = func.now()
    session.commit()


def _record(principal: Principal, convo_id, question, outcome, status_: str) -> uuid.UUID:
    """One query_traces row, attributed to the API channel and the key —
    the same table the app writes to, so cost is authored exactly once."""
    trace_id = uuid.uuid4()
    traces.write(
        id=trace_id,
        tenant_id=principal.tenant_id,
        user_id=principal.user_id,
        conversation_id=convo_id,
        question=question,
        status=status_,
        latency_ms=outcome.latency_ms if outcome else 0,
        first_token_ms=outcome.first_token_ms if outcome else None,
        tool_kinds=(
            ",".join(dict.fromkeys(t["kind"] for t in outcome.trace)) if outcome else ""
        ),
        source_count=len(outcome.sources) if outcome else 0,
        input_tokens=(outcome.input_tokens or None) if outcome else None,
        output_tokens=(outcome.output_tokens or None) if outcome else None,
        cost_usd=outcome.cost_usd if outcome else None,
        model=outcome.model if outcome else get_settings().LLM_MODEL_AGENT,
        channel="api",
        environment=principal.environment,
        api_key_id=principal.api_key_id,
    )
    return trace_id


def _build_state(db: Session, principal: Principal, convo: Conversation, question: str):
    settings = get_settings()
    if not settings.ANTHROPIC_API_KEY:
        raise ApiError(
            503, "model_not_configured", "The answer model is not configured."
        )
    history = chat.history_messages(db, convo.id, settings.CHAT_HISTORY_TURNS)
    return agent.initial_state(
        principal.tenant_id,
        question,
        history,
        role=principal.role,
        summary=convo.summary,
        memories=[],  # long-term memory is a human's, not a service account's
    )


@router.post("/ask", response_model=V1AskResponse)
def ask(
    body: V1AskRequest,
    request: Request,
    principal: Principal = Depends(require_scope("ask:write")),
    db: Session = Depends(get_db),
):
    question = body.question.strip()
    if not question:
        raise ApiError(422, "empty_question", "Ask something first.")

    # The spend ceiling, checked BEFORE any model call. Unlike the rate
    # limiter this still holds without Redis (it falls back to the traces
    # table) — a cost cap is worth a query, a request counter is not.
    key = db.get(ApiKey, principal.api_key_id)
    if key is not None:
        over, spent = usage.over_cap(db, key.id, key.monthly_cost_cap_usd)
        if over:
            raise ApiError(
                429,
                "cost_cap_exceeded",
                (
                    f"This key has spent ${spent:.4f} of its "
                    f"${key.monthly_cost_cap_usd:.2f} monthly cap. It resets "
                    "at the start of next month."
                ),
                cap_usd=key.monthly_cost_cap_usd,
                spent_usd=round(spent, 6),
            )

    convo = _resolve_conversation(db, principal, body.conversation_id)
    state = _build_state(db, principal, convo, question)
    convo_id, tenant_id = convo.id, principal.tenant_id

    wants_stream = body.stream or "text/event-stream" in (
        request.headers.get("accept") or ""
    )
    if wants_stream:
        return _ask_streaming(request, principal, convo_id, tenant_id, question, state)
    return _ask_json(request, principal, convo_id, tenant_id, question, state)


def _ask_json(request, principal, convo_id, tenant_id, question, state) -> V1AskResponse:
    session = app_db.SessionLocal()
    try:
        events = ask_service.run(state)
        try:
            while True:
                next(events)  # drain — the caller wants the result, not the steps
        except StopIteration as stop:
            outcome: ask_service.AskOutcome = stop.value

        _persist_turn(session, convo_id, tenant_id, question, outcome)
        trace_id = _record(principal, convo_id, question, outcome, "ok")
        request.state.query_trace_id = trace_id  # links the two ledgers
        usage.add_spend(principal.api_key_id, outcome.cost_usd)
        return V1AskResponse(
            answer=outcome.answer,
            sources=[_source_out(s) for s in outcome.sources],
            trace=[V1TraceStep(**t) for t in outcome.trace],
            usage=V1Usage(
                input_tokens=outcome.input_tokens,
                output_tokens=outcome.output_tokens,
                cost_usd=outcome.cost_usd,
                latency_ms=outcome.latency_ms,
                first_token_ms=outcome.first_token_ms,
                model=outcome.model,
            ),
            conversation_id=convo_id,
            trace_id=trace_id,
        )
    except ApiError:
        raise
    except Exception:
        log.exception("/v1/ask failed for conversation %s", convo_id)
        session.rollback()
        _record(principal, convo_id, question, None, "error")
        raise ApiError(
            502, "answer_failed", "The answer failed partway. Nothing was saved."
        )
    finally:
        session.close()


def _sse(event: str, data: object) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _ask_streaming(
    request, principal, convo_id, tenant_id, question, state
) -> StreamingResponse:
    def generate() -> Generator[str, None, None]:
        session = app_db.SessionLocal()
        try:
            events = ask_service.run(state)
            try:
                while True:
                    event, payload = next(events)
                    yield _sse(event, payload)
            except StopIteration as stop:
                outcome: ask_service.AskOutcome = stop.value

            _persist_turn(session, convo_id, tenant_id, question, outcome)
            trace_id = _record(principal, convo_id, question, outcome, "ok")
            # Set before the last chunk leaves: the metering middleware reads
            # it when the body iterator is exhausted.
            request.state.query_trace_id = trace_id
            usage.add_spend(principal.api_key_id, outcome.cost_usd)
            yield _sse(
                "done",
                {
                    "conversation_id": str(convo_id),
                    "trace_id": str(trace_id),
                    "usage": {
                        "input_tokens": outcome.input_tokens,
                        "output_tokens": outcome.output_tokens,
                        "cost_usd": outcome.cost_usd,
                        "latency_ms": outcome.latency_ms,
                        "first_token_ms": outcome.first_token_ms,
                        "model": outcome.model,
                    },
                },
            )
        except Exception:
            log.exception("/v1/ask stream failed for conversation %s", convo_id)
            session.rollback()
            _record(principal, convo_id, question, None, "error")
            yield _sse(
                "error",
                {
                    "code": "answer_failed",
                    "message": "The answer failed partway. Nothing was saved.",
                },
            )
        finally:
            session.close()

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ── /v1/documents ────────────────────────────────────────────────────────────


def _owned_document(db: Session, principal: Principal, document_id: uuid.UUID):
    from app.models import Document

    doc = db.get(Document, document_id)
    if doc is None or doc.tenant_id != principal.tenant_id:
        raise ApiError(404, "document_not_found", "No such document.")
    return doc


@router.get("/documents", response_model=V1DocumentList)
def list_documents(
    principal: Principal = Depends(require_scope("documents:read")),
    db: Session = Depends(get_db),
) -> V1DocumentList:
    from app.models import Document

    rows = db.scalars(
        select(Document)
        .where(Document.tenant_id == principal.tenant_id)
        .order_by(Document.created_at.desc(), Document.id.desc())
    )
    return V1DocumentList(documents=[_document_out(d) for d in rows])


@router.get("/documents/{document_id}", response_model=V1Document)
def get_document(
    document_id: uuid.UUID,
    principal: Principal = Depends(require_scope("documents:read")),
    db: Session = Depends(get_db),
) -> V1Document:
    """Poll this until `status` is `ready` — ingestion is asynchronous."""
    return _document_out(_owned_document(db, principal, document_id))


@router.post("/documents", response_model=V1Document, status_code=202)
async def upload_document(
    file: UploadFile,
    background_tasks: BackgroundTasks,
    principal: Principal = Depends(require_scope("documents:write")),
    db: Session = Depends(get_db),
) -> V1Document:
    data = await file.read()
    try:
        doc = library.create_pdf_document(
            db, principal.tenant_id, file.filename, file.content_type, data
        )
    except library.LibraryError as e:
        raise _api_error(e)
    library.dispatch_ingestion(background_tasks, doc.id)
    return _document_out(doc)


@router.post("/documents/url", response_model=V1Document, status_code=202)
def ingest_url(
    body: V1DocumentUrlRequest,
    background_tasks: BackgroundTasks,
    principal: Principal = Depends(require_scope("documents:write")),
    db: Session = Depends(get_db),
) -> V1Document:
    try:
        doc = library.create_url_document(db, principal.tenant_id, body.url)
    except library.LibraryError as e:
        raise _api_error(e)
    library.dispatch_ingestion(background_tasks, doc.id)
    return _document_out(doc)


@router.delete("/documents/{document_id}", status_code=204)
def delete_document(
    document_id: uuid.UUID,
    principal: Principal = Depends(require_scope("documents:write")),
    db: Session = Depends(get_db),
) -> None:
    doc = _owned_document(db, principal, document_id)
    try:
        library.delete_document(db, doc)
    except library.LibraryError as e:
        raise _api_error(e)
