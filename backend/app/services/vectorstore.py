"""Pinecone — the production version of the lab's cosine_top_k.

One index, one namespace per tenant. The namespace is ALWAYS derived from
get_current_user()'s tenant_id upstream — never from request data — so one
tenant's vectors are invisible to another by construction.

Vector id == the chunk row's Postgres id, which is what makes precise
deletion (and later, citation lookups) possible.
"""

from __future__ import annotations

from typing import Any

from app.config import get_settings

_index = None

UPSERT_BATCH = 100  # guide: batch 100 — fast, and respects request-size limits
DELETE_BATCH = 1000


class VectorStoreError(RuntimeError):
    pass


def get_index():
    global _index
    if _index is None:
        from pinecone import Pinecone

        settings = get_settings()
        if not settings.PINECONE_API_KEY:
            raise VectorStoreError("PINECONE_API_KEY is not configured")
        _index = Pinecone(api_key=settings.PINECONE_API_KEY).Index(
            settings.PINECONE_INDEX
        )
    return _index


def upsert(namespace: str, vectors: list[dict[str, Any]]) -> None:
    """vectors: [{id, values, metadata}] — batched at 100."""
    index = get_index()
    for i in range(0, len(vectors), UPSERT_BATCH):
        index.upsert(vectors=vectors[i : i + UPSERT_BATCH], namespace=namespace)


def delete_ids(namespace: str, ids: list[str]) -> None:
    """Idempotent — deleting already-absent ids is a no-op in Pinecone."""
    if not ids:
        return
    index = get_index()
    for i in range(0, len(ids), DELETE_BATCH):
        index.delete(ids=ids[i : i + DELETE_BATCH], namespace=namespace)


def namespace_count(namespace: str) -> int:
    stats = get_index().describe_index_stats()
    ns = stats.get("namespaces", {}).get(namespace)
    return int(ns["vector_count"]) if ns else 0
