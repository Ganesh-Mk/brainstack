"""Supabase Storage — the original uploaded files.

Private `documents` bucket; object path is `{tenant_id}/{document_id}.pdf`,
so the tenant boundary extends into storage. All access goes through the
backend with the service key — the bucket is never public.
"""

from __future__ import annotations

import uuid

import httpx

from app.config import get_settings


class StorageError(RuntimeError):
    pass


def _base() -> tuple[str, dict]:
    settings = get_settings()
    if not settings.SUPABASE_URL or not settings.SUPABASE_SECRET_KEY:
        raise StorageError("Supabase storage is not configured")
    headers = {
        "Authorization": f"Bearer {settings.SUPABASE_SECRET_KEY}",
        "apikey": settings.SUPABASE_SECRET_KEY,
    }
    return settings.SUPABASE_URL.rstrip("/"), headers


def object_path(tenant_id: uuid.UUID, document_id: uuid.UUID) -> str:
    return f"{tenant_id}/{document_id}.pdf"


def upload_pdf(tenant_id: uuid.UUID, document_id: uuid.UUID, data: bytes) -> str:
    base, headers = _base()
    bucket = get_settings().STORAGE_BUCKET
    path = object_path(tenant_id, document_id)
    resp = httpx.post(
        f"{base}/storage/v1/object/{bucket}/{path}",
        headers={**headers, "Content-Type": "application/pdf"},
        content=data,
        timeout=60.0,
    )
    if resp.status_code >= 400:
        raise StorageError(f"upload failed ({resp.status_code}): {resp.text[:200]}")
    return path


def download(path: str) -> bytes:
    base, headers = _base()
    bucket = get_settings().STORAGE_BUCKET
    resp = httpx.get(
        f"{base}/storage/v1/object/{bucket}/{path}", headers=headers, timeout=60.0
    )
    if resp.status_code >= 400:
        raise StorageError(f"download failed ({resp.status_code})")
    return resp.content


def delete_object(path: str) -> None:
    """Best-effort delete — a missing object is not an error (idempotent)."""
    base, headers = _base()
    bucket = get_settings().STORAGE_BUCKET
    resp = httpx.delete(
        f"{base}/storage/v1/object/{bucket}/{path}", headers=headers, timeout=30.0
    )
    if resp.status_code >= 400 and resp.status_code != 404:
        raise StorageError(f"delete failed ({resp.status_code})")
