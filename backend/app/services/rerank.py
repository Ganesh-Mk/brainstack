"""Cross-encoder re-ranking (Phase 8) — usually the biggest quality jump.

A cross-encoder reads (question, passage) TOGETHER and scores actual
relevance, where the bi-encoder (our embedder) scored two independent
compressions. Too slow to run over a whole corpus; perfect over the ~25
candidates retrieval already found.

Same deployment trick as embeddings.py: ONNX via fastembed, lazy-loaded,
free-tier sized (~23M params). Any failure — model download, OOM, scoring —
returns None and retrieval keeps its pre-rerank order. Quality features must
never take down answering.
"""

from __future__ import annotations

import logging

from app.config import get_settings

log = logging.getLogger("rerank")

_model = None
_failed = False  # don't retry a broken load on every question


def get_model():
    global _model, _failed
    if _model is None and not _failed:
        try:
            from fastembed.rerank.cross_encoder import TextCrossEncoder

            _model = TextCrossEncoder(model_name=get_settings().RERANK_MODEL)
        except Exception:
            log.warning("cross-encoder unavailable — reranking disabled", exc_info=True)
            _failed = True
    return _model


def scores(question: str, texts: list[str]) -> list[float] | None:
    """Relevance score per text (higher = better), or None if unavailable."""
    if not get_settings().RERANK_ENABLED or not texts:
        return None
    model = get_model()
    if model is None:
        return None
    try:
        return [float(s) for s in model.rerank(question, texts)]
    except Exception:
        log.warning("rerank scoring failed — keeping retrieval order", exc_info=True)
        return None
