"""Grounded Q&A: retrieve → numbered context → grounded prompt → stream.

This is the lab's rag_lab.py grown up: same embedding model, same grounding
rule (whose exact behaviour the lab measured — short, consistent refusals),
but retrieval runs against the tenant's Pinecone namespace and the answer
streams token by token.

Phase 8 turned retrieve() into a pipeline:
  dense top-25 (Pinecone)  ┐
                           ├─ RRF merge → cross-encoder rerank → top-6
  BM25 top-25 (Postgres)   ┘
BM25 over the tenant's chunk rows is what finds exact tokens ("ERR_4021")
that embeddings shrug at; the cross-encoder reads (question, passage)
together and fixes the ordering. Both degrade gracefully to plain dense.
"""

from __future__ import annotations

import json
import math
import re
import uuid
from dataclasses import asdict, dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Chunk, Document, EmbeddingCache, Message
from app.services import embeddings, rerank, vectorstore


@dataclass
class Source:
    """One retrieved passage, numbered for citation. source_type decides how
    the UI opens it: pdf -> the stored file at the cited page, url -> the
    original web page."""

    n: int
    document_id: str
    title: str
    page: int
    text: str
    score: float
    source_type: str = "pdf"
    source_url: str | None = None

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


_TOKEN_RE = re.compile(r"[a-z0-9]+")


def _tokens(text: str) -> list[str]:
    """Lowercase alnum runs: 'ERR_4021' -> ['err', '4021'] — exactly the rare
    tokens BM25 exists to catch."""
    return _TOKEN_RE.findall(text.lower())


def _bm25_ranking(db: Session, tenant_id: uuid.UUID, question: str) -> list[str]:
    """Chunk ids ranked by BM25 over the tenant's corpus (best first).
    Empty list on any failure — hybrid is an upgrade, not a dependency."""
    settings = get_settings()
    try:
        from rank_bm25 import BM25Okapi

        rows = list(
            db.execute(
                select(Chunk.id, Chunk.text)
                .where(Chunk.tenant_id == tenant_id)
                .order_by(Chunk.created_at.desc())
                .limit(settings.BM25_MAX_CHUNKS)
            )
        )
        if not rows:
            return []
        corpus = [_tokens(text) for _, text in rows]
        q = _tokens(question)
        if not q:
            return []
        scored = BM25Okapi(corpus).get_scores(q)
        ranked = sorted(
            zip((str(cid) for cid, _ in rows), scored),
            key=lambda p: p[1],
            reverse=True,
        )
        # Only ids that actually matched something.
        return [cid for cid, s in ranked[: settings.RETRIEVE_CANDIDATES] if s > 0]
    except Exception:
        return []


def _rrf_merge(rankings: list[list[str]], k: int) -> list[str]:
    """Reciprocal Rank Fusion: score(id) = Σ 1/(k + rank). Order-only inputs —
    no score normalization games between cosine and BM25."""
    fused: dict[str, float] = {}
    for ranking in rankings:
        for rank, cid in enumerate(ranking, start=1):
            fused[cid] = fused.get(cid, 0.0) + 1.0 / (k + rank)
    return [cid for cid, _ in sorted(fused.items(), key=lambda p: p[1], reverse=True)]


def _cosine_from_cache(db: Session, qvec: list[float], shas: list[str]) -> dict[str, float]:
    """Dense scores for BM25-only candidates, served from the embedding cache
    (ingestion filled it) — the UI's relevance % stays meaningful without
    re-embedding anything."""
    if not shas:
        return {}
    settings = get_settings()
    rows = db.execute(
        select(EmbeddingCache.content_sha, EmbeddingCache.vector).where(
            EmbeddingCache.content_sha.in_(shas),
            EmbeddingCache.model == settings.EMBEDDING_MODEL,
        )
    )
    qnorm = math.sqrt(sum(x * x for x in qvec)) or 1.0
    out: dict[str, float] = {}
    for sha, raw in rows:
        vec = json.loads(raw)
        dot = sum(a * b for a, b in zip(qvec, vec))
        vnorm = math.sqrt(sum(x * x for x in vec)) or 1.0
        out[sha] = dot / (qnorm * vnorm)
    return out


def retrieve(db: Session, tenant_id: uuid.UUID, question: str) -> list[Source]:
    """The Phase 8 pipeline: dense + BM25 → RRF → cross-encoder → top-K.
    Every stage degrades to the previous one on failure."""
    settings = get_settings()
    qvec = embeddings.embed_raw([question])[0]
    res = vectorstore.get_index().query(
        vector=qvec,
        top_k=settings.RETRIEVE_CANDIDATES,
        namespace=str(tenant_id),
        include_metadata=True,
    )
    matches = res.get("matches", [])
    dense_ranking = [m["id"] for m in matches]
    dense_scores = {m["id"]: float(m.get("score", 0.0)) for m in matches}

    rankings = [dense_ranking]
    if settings.HYBRID_ENABLED:
        bm25 = _bm25_ranking(db, tenant_id, question)
        if bm25:
            rankings.append(bm25)
    candidate_ids = _rrf_merge(rankings, settings.RRF_K)[: settings.RETRIEVE_CANDIDATES]
    if not candidate_ids:
        return []

    # Hydrate rows + documents.
    uuids = []
    for cid in candidate_ids:
        try:
            uuids.append(uuid.UUID(cid))
        except ValueError:
            continue
    rows = {str(c.id): c for c in db.scalars(select(Chunk).where(Chunk.id.in_(uuids)))}
    doc_ids = {r.document_id for r in rows.values()}
    docs = {
        str(d.id): d
        for d in db.scalars(select(Document).where(Document.id.in_(doc_ids)))
    }
    meta_by_id = {m["id"]: (m.get("metadata") or {}) for m in matches}

    # Fill dense scores for BM25-only candidates from the embedding cache.
    missing = [
        rows[cid].content_sha
        for cid in candidate_ids
        if cid not in dense_scores and cid in rows and rows[cid].content_sha
    ]
    by_sha = _cosine_from_cache(db, qvec, missing)
    for cid in candidate_ids:
        if cid not in dense_scores and cid in rows:
            dense_scores[cid] = by_sha.get(rows[cid].content_sha, 0.0)

    def text_of(cid: str) -> str:
        if cid in rows:
            return rows[cid].text
        return meta_by_id.get(cid, {}).get("text", "")

    candidates = [cid for cid in candidate_ids if text_of(cid)]

    # Cross-encoder rerank (order only — scores stay cosine for the UI).
    ranked = candidates
    ce = rerank.scores(question, [text_of(cid) for cid in candidates])
    if ce is not None:
        ranked = [cid for _, cid in sorted(zip(ce, candidates), key=lambda p: -p[0])]

    sources: list[Source] = []
    for i, cid in enumerate(ranked[: settings.CHAT_TOP_K], start=1):
        chunk = rows.get(cid)
        meta = meta_by_id.get(cid, {})
        document_id = str(chunk.document_id) if chunk else meta.get("document_id", "")
        doc = docs.get(document_id)
        sources.append(
            Source(
                n=i,
                document_id=document_id,
                title=doc.title if doc else "Removed document",
                page=chunk.page if chunk else int(meta.get("page", 1)),
                text=text_of(cid),
                score=round(dense_scores.get(cid, 0.0), 4),
                source_type=doc.source_type if doc else "pdf",
                source_url=doc.source_url if doc else None,
            )
        )
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


# NOTE: the Phase-5 direct streaming path (stream_answer) was retired when
# the agent became the only ask path — the grounding rule lives on in
# SYSTEM_PROMPT above and in the agent's own prompt.
