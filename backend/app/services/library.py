"""Creating and removing documents — shared by the app routes and /v1.

Extracted in Phase 11c. PDF sniffing, size limits, storage upload, the
Celery-vs-BackgroundTasks dispatch and the four-step delete are the same work
whichever contract asked for it; only the error *shape* differs. So the logic
lives here and raises `LibraryError`, which each router translates into its
own vocabulary (HTTPException for the app, ApiError for /v1).
"""

from __future__ import annotations

import uuid
from urllib.parse import urlparse

from sqlalchemy import delete as sa_delete
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Chunk, Document
from app.services import ingestion, storage, vectorstore


class LibraryError(Exception):
    """A refusal with a status, a stable code, and a human message."""

    def __init__(self, status_code: int, code: str, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message


def dispatch_ingestion(background_tasks, doc_id: uuid.UUID) -> None:
    """Inline (BackgroundTasks) on the free-tier deploy; Celery in the
    docker-compose production shape. Same pipeline either way — the switch is
    WHERE it runs, not WHAT runs (Phase 10)."""
    if get_settings().INGEST_MODE == "celery":
        from app.worker import ingest_document

        ingest_document.delay(str(doc_id))
    elif background_tasks is not None:
        # Called through the module, not a bound name, so tests can seal the
        # pipeline with a single monkeypatch.
        background_tasks.add_task(ingestion.run_ingestion, doc_id)


def create_pdf_document(
    db: Session, tenant_id: uuid.UUID, filename: str | None, content_type: str | None, data: bytes
) -> Document:
    settings = get_settings()

    name = filename or ""
    is_pdf_name = name.lower().endswith(".pdf")
    is_pdf_type = (content_type or "") in ("application/pdf", "application/x-pdf")
    if not (is_pdf_name or is_pdf_type):
        raise LibraryError(
            415,
            "unsupported_media_type",
            "Only PDF files are supported. For web pages, use the URL endpoint.",
        )
    if len(data) == 0:
        raise LibraryError(400, "empty_file", "The file is empty.")
    if len(data) > settings.MAX_UPLOAD_BYTES:
        raise LibraryError(
            413,
            "file_too_large",
            f"File is larger than {settings.MAX_UPLOAD_BYTES // (1024 * 1024)}MB.",
        )
    if not data.startswith(b"%PDF-"):
        raise LibraryError(
            415, "unsupported_media_type", "This file does not look like a valid PDF."
        )

    title = name.rsplit("/", 1)[-1].rsplit("\\", 1)[-1] or "Untitled document"
    if title.lower().endswith(".pdf"):
        title = title[:-4]
    title = title.strip()[:255] or "Untitled document"

    doc = Document(
        tenant_id=tenant_id, title=title, source_type="pdf", status="queued"
    )
    db.add(doc)
    db.flush()  # assign doc.id before the storage path uses it

    try:
        doc.file_path = storage.upload_pdf(tenant_id, doc.id, data)
    except storage.StorageError:
        db.rollback()
        raise LibraryError(
            502, "storage_unavailable", "File storage is unavailable. Try again shortly."
        )

    db.commit()
    db.refresh(doc)
    return doc


def create_url_document(db: Session, tenant_id: uuid.UUID, url: str) -> Document:
    url = url.strip()
    parsed = urlparse(url)
    # Fast, caller-facing validation here; the pipeline repeats it with a full
    # SSRF/DNS check before actually fetching.
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise LibraryError(422, "invalid_url", "Enter a full http(s):// web address.")

    doc = Document(
        tenant_id=tenant_id,
        title=(parsed.netloc + parsed.path).rstrip("/")[:255],
        source_type="url",
        source_url=url,
        status="queued",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


def delete_document(db: Session, doc: Document) -> None:
    """Full cleanup: vectors -> chunk rows -> stored file -> document row.
    Safe mid-ingestion: the pipeline re-checks the document's existence at
    every stage and removes anything it wrote after this ran."""
    chunk_ids = [
        str(cid)
        for cid in db.scalars(select(Chunk.id).where(Chunk.document_id == doc.id))
    ]
    try:
        vectorstore.delete_ids(str(doc.tenant_id), chunk_ids)
    except vectorstore.VectorStoreError:
        raise LibraryError(
            502, "vector_store_unavailable", "Vector store is unavailable. Try again shortly."
        )

    db.execute(sa_delete(Chunk).where(Chunk.document_id == doc.id))

    if doc.file_path:
        try:
            storage.delete_object(doc.file_path)
        except storage.StorageError:
            pass  # the row and vectors matter; an orphaned blob does not

    db.delete(doc)
    db.commit()
