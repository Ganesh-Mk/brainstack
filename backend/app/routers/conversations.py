"""Conversations + the grounded-answer SSE stream.

Scope rules: a conversation belongs to a tenant AND a user; both come from
get_current_user() only. Cross-tenant or cross-user access is a 404.

Persistence rule (matches the UI contract): the user message and the
assistant message are committed together, only after the stream completes.
A failure mid-stream persists nothing — history never contains half-answers.
"""

from __future__ import annotations

import json
import logging
import threading
import uuid
from typing import Generator

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy import delete as sa_delete
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import db as app_db
from app.config import get_settings
from app.core.deps import CurrentUser, get_current_user
from app.db import get_db
from app.models import Conversation, Document, Message
from app.schemas.chat import (
    AskRequest,
    ConversationDetail,
    ConversationOut,
    MessageOut,
    SourceOut,
)
from app.services import chat

log = logging.getLogger("chat")

router = APIRouter(prefix="/conversations", tags=["conversations"])

# One live stream per conversation (single-worker deployment; a worker-count
# bump moves this guard into Redis — noted in the phase doc).
_streaming: set[uuid.UUID] = set()
_streaming_lock = threading.Lock()

NO_SOURCES_REPLY = (
    "This workspace has no indexed documents yet, so there's nothing for me "
    "to answer from. Add sources in the Knowledge section first."
)


def _get_owned(
    conversation_id: uuid.UUID, current: CurrentUser, db: Session
) -> Conversation:
    convo = db.get(Conversation, conversation_id)
    if (
        convo is None
        or convo.tenant_id != current.tenant_id
        or convo.user_id != current.user.id
    ):
        raise HTTPException(status_code=404, detail="Conversation not found")
    return convo


def _question_count(db: Session, conversation_id: uuid.UUID) -> int:
    return db.scalar(
        select(func.count())
        .select_from(Message)
        .where(Message.conversation_id == conversation_id, Message.role == "user")
    )


def _to_message_out(m: Message) -> MessageOut:
    return MessageOut(
        id=m.id,
        role=m.role,  # type: ignore[arg-type]
        content=m.content,
        sources=(
            [SourceOut(**s) for s in json.loads(m.sources)] if m.sources else None
        ),
        created_at=m.created_at,
    )


# ── CRUD ─────────────────────────────────────────────────────────────────────


@router.get("", response_model=list[ConversationOut])
def list_conversations(
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ConversationOut]:
    rows = db.scalars(
        select(Conversation)
        .where(
            Conversation.tenant_id == current.tenant_id,
            Conversation.user_id == current.user.id,
        )
        .order_by(Conversation.updated_at.desc(), Conversation.id.desc())
    )
    return [
        ConversationOut(
            id=c.id,
            title=c.title,
            question_count=_question_count(db, c.id),
            created_at=c.created_at,
            updated_at=c.updated_at,
        )
        for c in rows
    ]


@router.post("", response_model=ConversationOut, status_code=201)
def create_conversation(
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ConversationOut:
    convo = Conversation(tenant_id=current.tenant_id, user_id=current.user.id)
    db.add(convo)
    db.commit()
    db.refresh(convo)
    return ConversationOut(
        id=convo.id,
        title=convo.title,
        question_count=0,
        created_at=convo.created_at,
        updated_at=convo.updated_at,
    )


@router.get("/{conversation_id}", response_model=ConversationDetail)
def get_conversation(
    conversation_id: uuid.UUID,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ConversationDetail:
    convo = _get_owned(conversation_id, current, db)
    messages = db.scalars(
        select(Message)
        .where(Message.conversation_id == convo.id)
        .order_by(Message.seq.asc())
    )
    return ConversationDetail(
        id=convo.id,
        title=convo.title,
        question_count=_question_count(db, convo.id),
        created_at=convo.created_at,
        updated_at=convo.updated_at,
        messages=[_to_message_out(m) for m in messages],
    )


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(
    conversation_id: uuid.UUID,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    convo = _get_owned(conversation_id, current, db)
    with _streaming_lock:
        if convo.id in _streaming:
            raise HTTPException(
                status_code=409, detail="An answer is still streaming."
            )
    db.execute(sa_delete(Message).where(Message.conversation_id == convo.id))
    db.delete(convo)
    db.commit()


# ── The ask stream ───────────────────────────────────────────────────────────


def _sse(event: str, data: object) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@router.post("/{conversation_id}/messages")
def ask(
    conversation_id: uuid.UUID,
    body: AskRequest,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    convo = _get_owned(conversation_id, current, db)
    question = body.content.strip()
    if not question:
        raise HTTPException(status_code=422, detail="Ask something first.")
    if len(question) > get_settings().CHAT_MAX_QUESTION_CHARS:
        raise HTTPException(status_code=422, detail="That question is too long.")

    with _streaming_lock:
        if convo.id in _streaming:
            raise HTTPException(
                status_code=409,
                detail="An answer is already streaming in this conversation.",
            )
        _streaming.add(convo.id)

    has_ready_docs = (
        db.scalar(
            select(func.count())
            .select_from(Document)
            .where(
                Document.tenant_id == current.tenant_id,
                Document.status == "ready",
            )
        )
        > 0
    )
    tenant_id, user_id = current.tenant_id, current.user.id
    convo_id, first_question = convo.id, _question_count(db, convo.id) == 0

    def generate() -> Generator[str, None, None]:
        # Own session: the request session's lifecycle ends under us while
        # the response is still streaming.
        session = app_db.SessionLocal()
        try:
            # Empty library: friendly short-circuit, no model call, no cost —
            # but it IS a real exchange, so it persists.
            if not has_ready_docs:
                yield _sse("sources", [])
                yield _sse("delta", {"text": NO_SOURCES_REPLY})
                ids = _persist(session, question, NO_SOURCES_REPLY, [])
                yield _sse("done", ids)
                return

            sources = chat.retrieve(session, tenant_id, question)
            yield _sse("sources", [s.to_dict() for s in sources])

            history = chat.history_messages(
                session, convo_id, get_settings().CHAT_HISTORY_TURNS
            )
            answer_parts: list[str] = []
            for fragment in chat.stream_answer(question, sources, history):
                answer_parts.append(fragment)
                yield _sse("delta", {"text": fragment})

            ids = _persist(session, question, "".join(answer_parts), sources)
            yield _sse("done", ids)

        except chat.ChatNotConfigured as e:
            yield _sse("error", {"detail": str(e)})
        except Exception:
            log.exception("ask stream failed for conversation %s", convo_id)
            session.rollback()
            yield _sse(
                "error",
                {"detail": "The answer failed partway. Nothing was saved — try again."},
            )
        finally:
            session.close()
            with _streaming_lock:
                _streaming.discard(convo_id)

    def _persist(
        session: Session, q: str, answer: str, sources: list[chat.Source]
    ) -> dict:
        # Safe without locking: the per-conversation streaming guard means at
        # most one writer per conversation at a time.
        next_seq = (
            session.scalar(
                select(func.max(Message.seq)).where(
                    Message.conversation_id == convo_id
                )
            )
            or 0
        ) + 1
        user_msg = Message(
            conversation_id=convo_id,
            tenant_id=tenant_id,
            role="user",
            seq=next_seq,
            content=q,
        )
        assistant_msg = Message(
            conversation_id=convo_id,
            tenant_id=tenant_id,
            role="assistant",
            seq=next_seq + 1,
            content=answer,
            sources=json.dumps([s.to_dict() for s in sources]) if sources else None,
        )
        session.add_all([user_msg, assistant_msg])
        fresh = session.get(Conversation, convo_id)
        if fresh is not None:
            if first_question:
                fresh.title = (q[:117] + "…") if len(q) > 118 else q
            fresh.updated_at = func.now()
        session.commit()
        return {
            "user_message_id": str(user_msg.id),
            "assistant_message_id": str(assistant_msg.id),
        }

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # defeat proxy buffering
            "Connection": "keep-alive",
        },
    )
