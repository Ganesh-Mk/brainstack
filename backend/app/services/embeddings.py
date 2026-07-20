"""Embeddings — the lab's model (all-MiniLM-L6-v2, 384-dim) via fastembed.

fastembed runs the identical model on ONNX instead of PyTorch: same vectors,
a fraction of the memory — which is what makes it deployable on the Render
free tier. The model file (~30MB) downloads once per instance on first use.

Every lookup goes through the Postgres embedding cache, keyed by
sha256(text): re-ingesting the same document while debugging costs nothing.
"""

from __future__ import annotations

import hashlib
import json
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import EmbeddingCache

_model = None


def get_model():
    global _model
    if _model is None:
        from fastembed import TextEmbedding

        _model = TextEmbedding(model_name=get_settings().EMBEDDING_MODEL)
    return _model


def content_sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def embed_raw(texts: list[str]) -> list[list[float]]:
    """Straight through the model, no cache. Order preserved."""
    return [vec.tolist() for vec in get_model().embed(texts)]


def embed_with_cache(db: Session, texts: Iterable[str]) -> tuple[list[list[float]], int]:
    """Embed texts, serving from / filling the Postgres cache.

    Returns (vectors in input order, cache_hits). Handles duplicate texts
    within one batch (embedded once, returned everywhere they appear).
    """
    settings = get_settings()
    texts = list(texts)
    shas = [content_sha(t) for t in texts]

    cached: dict[str, list[float]] = {}
    unique_shas = list(dict.fromkeys(shas))
    if unique_shas:
        rows = db.execute(
            select(EmbeddingCache).where(
                EmbeddingCache.content_sha.in_(unique_shas),
                EmbeddingCache.model == settings.EMBEDDING_MODEL,
            )
        ).scalars()
        for row in rows:
            cached[row.content_sha] = json.loads(row.vector)

    # Embed each distinct uncached text exactly once.
    miss_shas: list[str] = []
    miss_texts: list[str] = []
    seen: set[str] = set()
    for sha, text in zip(shas, texts):
        if sha not in cached and sha not in seen:
            seen.add(sha)
            miss_shas.append(sha)
            miss_texts.append(text)

    if miss_texts:
        for sha, vec in zip(miss_shas, embed_raw(miss_texts)):
            cached[sha] = vec
            db.add(
                EmbeddingCache(
                    content_sha=sha,
                    model=settings.EMBEDDING_MODEL,
                    vector=json.dumps(vec),
                )
            )
        db.flush()

    hits = len(texts) - len(miss_texts)
    return [cached[sha] for sha in shas], hits
