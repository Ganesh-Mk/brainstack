"""Phase 9 stats — what the Dashboard, Analytics, Evaluation and
Observability pages read.

Dashboard is tenant-scoped and for every role. The other three are
admin-only: Analytics/Observability aggregate the tenant's query_traces;
Evaluation lists platform-level golden-dataset runs (eval_runs — produced
by eval/run_eval.py, not tied to a tenant).

Percentiles are computed in Python over the recent window — portable across
SQLite (tests) and Postgres, and the window is small by construction.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import CurrentUser, get_current_user, require_admin
from app.db import get_db
from app.models import (
    ApiKey,
    Conversation,
    Document,
    EvalRun,
    Memory,
    QueryTrace,
)
from app.services import apiusage

router = APIRouter(prefix="/stats", tags=["stats"])

TRACE_WINDOW = 1000  # recent rows used for latency/cost aggregates

# Filters (Phase 11f). Windows are a fixed set rather than a free integer:
# the aggregate reads the most recent TRACE_WINDOW rows, so an arbitrary
# `days=3650` would silently return a partial answer that looks complete.
WINDOWS = (7, 14, 30)
CHANNELS = ("all", "app", "api")


def _apply_filters(
    rows: list[QueryTrace], channel: str, include_test: bool
) -> list[QueryTrace]:
    """Channel + environment filtering, shared by every stats read.

    include_test defaults to False everywhere, which is what makes the
    promise on the create-key modal true: a test key's traffic is excluded
    from the workspace's quality and cost numbers unless you ask for it.
    """
    if channel in ("app", "api"):
        rows = [r for r in rows if r.channel == channel]
    if not include_test:
        rows = [r for r in rows if r.environment != "test"]
    return rows


def _filter_params(days: int, channel: str, include_test: bool) -> dict:
    if days not in WINDOWS:
        raise HTTPException(
            status_code=422,
            detail=f"days must be one of {', '.join(str(w) for w in WINDOWS)}",
        )
    if channel not in CHANNELS:
        raise HTTPException(
            status_code=422,
            detail=f"channel must be one of {', '.join(CHANNELS)}",
        )
    return {"days": days, "channel": channel, "include_test": include_test}


def _pct(values: list[int], p: float) -> int | None:
    if not values:
        return None
    values = sorted(values)
    idx = min(len(values) - 1, round(p * (len(values) - 1)))
    return values[idx]


def _recent_traces(db: Session, tenant_id, days: int | None = None) -> list[QueryTrace]:
    q = (
        select(QueryTrace)
        .where(QueryTrace.tenant_id == tenant_id)
        .order_by(QueryTrace.created_at.desc())
        .limit(TRACE_WINDOW)
    )
    rows = list(db.scalars(q))
    if days is not None:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        rows = [
            r
            for r in rows
            if r.created_at and r.created_at.replace(tzinfo=timezone.utc) >= cutoff
        ]
    return rows


@router.get("/dashboard")
def dashboard(
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    t = current.tenant_id
    docs = db.scalar(
        select(func.count()).select_from(Document).where(Document.tenant_id == t)
    )
    ready = db.scalar(
        select(func.count())
        .select_from(Document)
        .where(Document.tenant_id == t, Document.status == "ready")
    )
    chunks = db.scalar(
        select(func.coalesce(func.sum(Document.chunk_count), 0)).where(
            Document.tenant_id == t, Document.status == "ready"
        )
    )
    convos = db.scalar(
        select(func.count()).select_from(Conversation).where(Conversation.tenant_id == t)
    )
    memories = db.scalar(
        select(func.count()).select_from(Memory).where(Memory.tenant_id == t)
    )
    traces = _recent_traces(db, t)
    ok = [r for r in traces if r.status == "ok"]
    lat = [r.latency_ms for r in ok if r.latency_ms]
    return {
        "documents": docs,
        "documents_ready": ready,
        "chunks": int(chunks or 0),
        "conversations": convos,
        "memories": memories,
        "questions_asked": len(ok),
        "avg_latency_ms": round(sum(lat) / len(lat)) if lat else None,
        "cost_usd_30d": round(
            sum(r.cost_usd or 0.0 for r in _recent_traces(db, t, days=30)), 4
        ),
        "tool_usage": _tool_usage(ok),
        # Latest activity, newest first — tenant-scoped so safe for all roles.
        "recent_questions": [
            {
                "question": r.question[:160],
                "status": r.status,
                "latency_ms": r.latency_ms,
                "tool_kinds": [k for k in (r.tool_kinds or "").split(",") if k],
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in traces[:6]
        ],
    }


def _tool_usage(rows: list[QueryTrace]) -> dict:
    usage = {"knowledge": 0, "web": 0, "action": 0, "reflection": 0}
    for r in rows:
        for kind in (r.tool_kinds or "").split(","):
            if kind in usage:
                usage[kind] += 1
    return usage


@router.get("/analytics")
def analytics(
    days: int = Query(14),
    channel: str = Query("all"),
    include_test: bool = Query(False),
    current: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    filters = _filter_params(days, channel, include_test)
    rows = _apply_filters(
        _recent_traces(db, current.tenant_id, days=days), channel, include_test
    )
    ok = [r for r in rows if r.status == "ok"]
    lat = [r.latency_ms for r in ok if r.latency_ms]
    ftl = [r.first_token_ms for r in ok if r.first_token_ms]

    per_day: dict[str, dict] = {}
    for r in rows:
        day = r.created_at.date().isoformat() if r.created_at else "unknown"
        d = per_day.setdefault(
            day, {"date": day, "questions": 0, "errors": 0, "cost_usd": 0.0, "latencies": []}
        )
        if r.status == "ok":
            d["questions"] += 1
            d["cost_usd"] += r.cost_usd or 0.0
            if r.latency_ms:
                d["latencies"].append(r.latency_ms)
        else:
            d["errors"] += 1
    series = []  # NOT `days` — that is the window parameter now
    for day in sorted(per_day):
        d = per_day[day]
        series.append(
            {
                "date": d["date"],
                "questions": d["questions"],
                "errors": d["errors"],
                "cost_usd": round(d["cost_usd"], 4),
                "avg_latency_ms": (
                    round(sum(d["latencies"]) / len(d["latencies"]))
                    if d["latencies"]
                    else None
                ),
            }
        )

    counts: dict[str, int] = {}
    for r in ok:
        q = r.question.strip()[:120]
        counts[q] = counts.get(q, 0) + 1
    top = sorted(counts.items(), key=lambda p: -p[1])[:8]

    return {
        "window_days": days,
        "filters": filters,
        "totals": {
            "questions": len(ok),
            "errors": len(rows) - len(ok),
            "cost_usd": round(sum(r.cost_usd or 0.0 for r in ok), 4),
            "input_tokens": sum(r.input_tokens or 0 for r in ok),
            "output_tokens": sum(r.output_tokens or 0 for r in ok),
        },
        "latency_ms": {"p50": _pct(lat, 0.50), "p95": _pct(lat, 0.95)},
        "first_token_ms": {"p50": _pct(ftl, 0.50), "p95": _pct(ftl, 0.95)},
        "per_day": series,
        "tool_usage": _tool_usage(ok),
        "top_questions": [{"question": q, "count": c} for q, c in top],
    }


@router.get("/api")
def api_stats(
    days: int = Query(14),
    include_test: bool = Query(False),
    current: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    """The Analytics page's "Programmatic access" section (Phase 11f).

    Request counts come from api_requests, spend from query_traces — the two
    ledgers, joined rather than summed twice (PHASE_11 §1.6)."""
    _filter_params(days, "all", include_test)
    return apiusage.tenant_api_stats(
        db, current.tenant_id, days=days, include_test=include_test
    )


@router.get("/traces")
def traces(
    current: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    rows = list(
        db.scalars(
            select(QueryTrace)
            .where(QueryTrace.tenant_id == current.tenant_id)
            .order_by(QueryTrace.created_at.desc())
            .limit(50)
        )
    )
    key_names = {
        k.id: k.name
        for k in db.scalars(
            select(ApiKey).where(ApiKey.tenant_id == current.tenant_id)
        )
    }
    return {
        "traces": [
            {
                "id": str(r.id),
                "question": r.question[:200],
                "status": r.status,
                "latency_ms": r.latency_ms,
                "first_token_ms": r.first_token_ms,
                "tool_kinds": [k for k in (r.tool_kinds or "").split(",") if k],
                "source_count": r.source_count,
                "input_tokens": r.input_tokens,
                "output_tokens": r.output_tokens,
                "cost_usd": r.cost_usd,
                "model": r.model,
                # Phase 11: who asked — the app, or a key over /v1.
                "channel": r.channel,
                "environment": r.environment,
                "api_key_id": str(r.api_key_id) if r.api_key_id else None,
                "api_key_name": key_names.get(r.api_key_id),
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]
    }


@router.get("/config")
def model_config(
    current: CurrentUser = Depends(require_admin),
) -> dict:
    """Read-only model/cost configuration for the Settings → Models page.
    These are env-managed (12-factor); the page shows what's live, it
    doesn't edit it."""
    from app.config import get_settings
    from app.services import mcp_client

    s = get_settings()
    return {
        "answer_model": s.LLM_MODEL_AGENT,
        "utility_model": s.LLM_MODEL_DEV,  # judges, memory, summaries
        # Our own fine-tuned model (training/). Listed even where it can't
        # run, because "answer_model: claude" alone would now be a half-truth
        # — the Ask page lets a question pick either one.
        "local_model": s.LLM_MODEL_LOCAL,
        "default_provider": s.LLM_PROVIDER,
        "embedding_model": s.EMBEDDING_MODEL,
        "rerank_enabled": s.RERANK_ENABLED,
        "rerank_model": s.RERANK_MODEL if s.RERANK_ENABLED else None,
        "hybrid_search": s.HYBRID_ENABLED,
        "chunk_size": s.CHUNK_SIZE,
        "chunk_overlap": s.CHUNK_OVERLAP,
        "answer_max_tokens": s.CHAT_MAX_TOKENS,
        "agent_max_steps": s.AGENT_MAX_STEPS,
        "rate_limit_per_hour": s.RATE_LIMIT_ASKS_PER_HOUR,
        "prompt_cache": s.PROMPT_CACHE_ENABLED,
        "price_input_per_mtok": s.PRICE_INPUT_PER_MTOK,
        "price_output_per_mtok": s.PRICE_OUTPUT_PER_MTOK,
        "mcp_connected": mcp_client.is_configured(),
    }


@router.get("/evals")
def evals(
    current: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    rows = list(
        db.scalars(select(EvalRun).order_by(EvalRun.created_at.desc()).limit(20))
    )
    return {
        "runs": [
            {
                "id": str(r.id),
                "dataset_size": r.dataset_size,
                "faithfulness": r.faithfulness,
                "relevance": r.relevance,
                "retrieval_hit": r.retrieval_hit,
                "citation_validity": r.citation_validity,
                "model": r.model,
                "notes": r.notes,
                "per_question": json.loads(r.per_question) if r.per_question else None,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]
    }
