"""Grounded Q&A: retrieve → numbered context → grounded prompt → stream.

This is the lab's rag_lab.py grown up: same embedding model, same grounding
rule (whose exact behaviour the lab measured — short, consistent refusals),
but retrieval runs against the tenant's Pinecone namespace and the answer
streams token by token.
"""

from __future__ import annotations

import uuid
from dataclasses import asdict, dataclass
from typing import Generator, Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Chunk, Document, Message
from app.services import embeddings, vectorstore


@dataclass
class Source:
    """One retrieved passage, numbered for citation."""

    n: int
    document_id: str
    title: str
    page: int
    text: str
    score: float

    def to_dict(self) -> dict:
        return asdict(self)


class ChatNotConfigured(RuntimeError):
    """ANTHROPIC_API_KEY missing — surfaced as a clear 503, not a crash."""


# The lab's grounding rule (PHASE_3 §6.5), verbatim in spirit: the point is a
# SHORT, CONSISTENT refusal the UI can rely on — plus citation mechanics.
SYSTEM_PROMPT = """You are BrainStack, a company knowledge assistant.

Answer using ONLY the numbered context passages provided in the user's
message. Follow these rules exactly:

1. If the answer is not in the context, reply with a single short sentence:
   "I don't know — that isn't covered in this workspace's documents." Do not
   guess, do not add general advice.
2. Cite passages with bracketed numbers like [1] or [2][4], placed directly
   after the specific claim they support — not clumped at the end.
3. Only cite passage numbers that exist in the context.
4. Be concise. Use plain markdown: short paragraphs, bold for key figures,
   dash lists where they help. No headings, no preamble.
"""


def retrieve(db: Session, tenant_id: uuid.UUID, question: str) -> list[Source]:
    """Embed the question, query the tenant's namespace, hydrate full chunk
    text from Postgres (falling back to vector metadata if a row is gone)."""
    settings = get_settings()
    qvec = embeddings.embed_raw([question])[0]
    res = vectorstore.get_index().query(
        vector=qvec,
        top_k=settings.CHAT_TOP_K,
        namespace=str(tenant_id),
        include_metadata=True,
    )
    matches = res.get("matches", [])
    if not matches:
        return []

    ids: list[uuid.UUID] = []
    for m in matches:
        try:
            ids.append(uuid.UUID(m["id"]))
        except ValueError:
            continue
    rows = {
        str(c.id): c
        for c in db.scalars(select(Chunk).where(Chunk.id.in_(ids)))
    }
    doc_ids = {r.document_id for r in rows.values()}
    titles = {
        str(d.id): d.title
        for d in db.scalars(select(Document).where(Document.id.in_(doc_ids)))
    }

    sources: list[Source] = []
    for i, m in enumerate(matches, start=1):
        chunk = rows.get(m["id"])
        meta = m.get("metadata") or {}
        text = chunk.text if chunk else meta.get("text", "")
        if not text:
            continue
        document_id = str(chunk.document_id) if chunk else meta.get("document_id", "")
        sources.append(
            Source(
                n=i,
                document_id=document_id,
                title=titles.get(document_id, "Removed document"),
                page=chunk.page if chunk else int(meta.get("page", 1)),
                text=text,
                score=round(float(m.get("score", 0.0)), 4),
            )
        )
    # Re-number after any skips so citations are always contiguous.
    for i, s in enumerate(sources, start=1):
        s.n = i
    return sources


def build_user_prompt(question: str, sources: list[Source]) -> str:
    context = "\n\n".join(
        f"[{s.n}] ({s.title}, p.{s.page}) {s.text}" for s in sources
    )
    return f"Context:\n{context}\n\nQuestion: {question}"


def history_messages(
    db: Session, conversation_id: uuid.UUID, limit_turns: int
) -> list[dict]:
    """The most recent prior turns, oldest-first, as plain chat messages.
    Context passages from old turns are NOT replayed — history carries the
    conversational thread; retrieval runs fresh on each new question."""
    rows = list(
        db.scalars(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.seq.desc())
            .limit(limit_turns)
        )
    )
    rows.reverse()
    return [{"role": r.role, "content": r.content} for r in rows]


def stream_answer(
    question: str,
    sources: list[Source],
    history: Iterable[dict] = (),
) -> Generator[str, None, None]:
    """Yields text fragments from Claude. Raises ChatNotConfigured if the key
    is absent; lets anthropic errors propagate for the caller to translate."""
    settings = get_settings()
    if not settings.ANTHROPIC_API_KEY:
        raise ChatNotConfigured(
            "The answer model is not configured on this server."
        )

    import anthropic

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    messages = [*history, {"role": "user", "content": build_user_prompt(question, sources)}]

    with client.messages.stream(
        model=settings.LLM_MODEL_DEV,
        max_tokens=settings.CHAT_MAX_TOKENS,
        system=SYSTEM_PROMPT,
        messages=messages,
    ) as stream:
        for text in stream.text_stream:
            yield text
