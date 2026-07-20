"""Phase 8 memory — both kinds, one module.

SHORT-TERM: the sliding window (CHAT_HISTORY_TURNS) stays; once a thread
outgrows it, everything older is compressed into conversations.summary by
one haiku call AFTER the answer is delivered (the user never waits on it).

LONG-TERM: after each answer, a haiku extractor pulls durable facts the USER
explicitly stated ("I'm Alex", "I run the Bangalore office") — most
exchanges yield none. Facts live in the memories table; their embeddings in
Pinecone namespace f"{tenant_id}-mem" keyed by row id, tagged with user_id
for per-user recall. At ask time the top-3 relevant, score-gated memories are
injected into the system prompt.

Every function here is called from the answer path — so every function
swallows its own failures. Memory is an upgrade, never a dependency.
"""

from __future__ import annotations

import json
import logging
import re
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Conversation, Memory, Message
from app.services import embeddings, vectorstore

log = logging.getLogger("memory")

MAX_MEMORIES_PER_USER = 200  # a prop-scale cap; oldest are not evicted, new
# extractions are skipped instead (simpler + predictable)


def haiku(system: str, user: str, max_tokens: int = 400) -> str:
    """One cheap completion — shared by the extractor, summarizer, and the
    Phase 8 reflection critic in agent.py."""
    import anthropic

    settings = get_settings()
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    res = client.messages.create(
        model=settings.LLM_MODEL_DEV,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    return "".join(b.text for b in res.content if getattr(b, "type", "") == "text")


def mem_namespace(tenant_id: uuid.UUID | str) -> str:
    return f"{tenant_id}-mem"


# ── long-term: extraction ───────────────────────────────────────────────────

EXTRACT_SYSTEM = """You extract long-term memory for an assistant.

From the exchange, list durable facts the USER explicitly stated about
themselves or their organization — identity, role, location, preferences,
recurring context. Things worth remembering WEEKS later.

Do NOT include: questions, the assistant's answers, facts from documents,
one-off task details, or anything speculative.

Output ONLY a JSON array of short factual sentences (each starting with the
subject, e.g. "The user's name is Alex."). Most exchanges contain nothing
durable — then output []."""


def _parse_facts(raw: str) -> list[str]:
    m = re.search(r"\[.*\]", raw, re.DOTALL)
    if not m:
        return []
    try:
        data = json.loads(m.group(0))
    except json.JSONDecodeError:
        return []
    return [f.strip() for f in data if isinstance(f, str) and 3 < len(f.strip()) < 500][:5]


def extract_and_store(
    db: Session,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    conversation_id: uuid.UUID,
    question: str,
    answer: str,
) -> int:
    """Returns how many new memories were stored (0 is the normal case)."""
    settings = get_settings()
    if not settings.MEMORY_ENABLED or not settings.ANTHROPIC_API_KEY:
        return 0
    try:
        raw = haiku(
            EXTRACT_SYSTEM, f"User: {question[:1500]}\nAssistant: {answer[:1500]}"
        )
        facts = _parse_facts(raw)
        if not facts:
            return 0

        existing = {
            c.lower()
            for c in db.scalars(
                select(Memory.content).where(
                    Memory.tenant_id == tenant_id, Memory.user_id == user_id
                )
            )
        }
        if len(existing) >= MAX_MEMORIES_PER_USER:
            return 0
        fresh = [f for f in facts if f.lower() not in existing]
        if not fresh:
            return 0

        rows = [
            Memory(
                tenant_id=tenant_id,
                user_id=user_id,
                content=f,
                conversation_id=conversation_id,
            )
            for f in fresh
        ]
        db.add_all(rows)
        db.flush()
        vectors = embeddings.embed_raw(fresh)
        vectorstore.upsert(
            mem_namespace(tenant_id),
            [
                {
                    "id": str(r.id),
                    "values": v,
                    "metadata": {"user_id": str(user_id), "content": r.content},
                }
                for r, v in zip(rows, vectors)
            ],
        )
        db.commit()
        return len(fresh)
    except Exception:
        db.rollback()
        log.warning("memory extraction failed", exc_info=True)
        return 0


# ── long-term: recall ───────────────────────────────────────────────────────


def recall(tenant_id: uuid.UUID, user_id: uuid.UUID, question: str) -> list[str]:
    """Top relevant memories for this user, score-gated. [] on any failure."""
    settings = get_settings()
    if not settings.MEMORY_ENABLED:
        return []
    try:
        qvec = embeddings.embed_raw([question])[0]
        res = vectorstore.get_index().query(
            vector=qvec,
            top_k=settings.MEMORY_TOP_K,
            namespace=mem_namespace(tenant_id),
            include_metadata=True,
            filter={"user_id": str(user_id)},
        )
        return [
            (m.get("metadata") or {}).get("content", "")
            for m in res.get("matches", [])
            if float(m.get("score", 0.0)) >= settings.MEMORY_MIN_SCORE
            and (m.get("metadata") or {}).get("content")
        ]
    except Exception:
        log.warning("memory recall failed", exc_info=True)
        return []


def delete_memory(db: Session, memory: Memory) -> None:
    """Row + vector together — the page's delete button."""
    vectorstore.delete_ids(mem_namespace(memory.tenant_id), [str(memory.id)])
    db.delete(memory)
    db.commit()


# ── short-term: summarization ───────────────────────────────────────────────

SUMMARY_SYSTEM = """Summarize this conversation in at most 150 words for the
assistant's own context. Preserve named entities, numbers, decisions and
open threads. Write plain prose, no preamble, no markdown."""


def maybe_update_summary(db: Session, conversation_id: uuid.UUID) -> bool:
    """Refresh conversations.summary once the thread outgrows the history
    window. Covers ALL turns older than the window (plus the prior summary,
    which it supersedes). Returns True if updated."""
    settings = get_settings()
    if not settings.ANTHROPIC_API_KEY:
        return False
    try:
        rows = list(
            db.scalars(
                select(Message)
                .where(Message.conversation_id == conversation_id)
                .order_by(Message.seq.asc())
            )
        )
        older = rows[: -settings.CHAT_HISTORY_TURNS]
        if not older:
            return False
        convo = db.get(Conversation, conversation_id)
        if convo is None:
            return False
        transcript = "\n".join(f"{m.role}: {m.content[:600]}" for m in older)
        if convo.summary:
            transcript = f"(earlier summary) {convo.summary}\n{transcript}"
        convo.summary = haiku(SUMMARY_SYSTEM, transcript[:12000], max_tokens=300).strip()
        db.commit()
        return True
    except Exception:
        db.rollback()
        log.warning("summary update failed", exc_info=True)
        return False
