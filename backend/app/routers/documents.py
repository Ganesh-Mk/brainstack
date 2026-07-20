"""The Knowledge Library API.

Tenancy comes ONLY from get_current_user() — every query filters on
current.tenant_id, and the Pinecone namespace is derived from the same value.
Roles mirror the frontend nav registry: any member can view the library;
adding and deleting sources is admin-only.
"""

from __future__ import annotations

import uuid
from urllib.parse import urlparse

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    UploadFile,
    status,
)
from sqlalchemy import delete as sa_delete
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.deps import CurrentUser, get_current_user, require_admin
from app.db import get_db
from app.models import Chunk, Document
from app.schemas.documents import DocumentOut, UrlIngestRequest
from app.services import storage, vectorstore
from app.services.ingestion import run_ingestion

router = APIRouter(prefix="/documents", tags=["documents"])


def _get_owned(
    document_id: uuid.UUID, current: CurrentUser, db: Session
) -> Document:
    """Fetch a document inside the tenant boundary. Cross-tenant access is a
    404, not a 403 — we don't confirm that someone else's document exists."""
    doc = db.get(Document, document_id)
    if doc is None or doc.tenant_id != current.tenant_id:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.get("", response_model=list[DocumentOut])
def list_documents(
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Document]:
    return list(
        db.scalars(
            select(Document)
            .where(Document.tenant_id == current.tenant_id)
            # id as tiebreak keeps the order stable across polls even when two
            # documents share a timestamp.
            .order_by(Document.created_at.desc(), Document.id.desc())
        )
    )


@router.get("/{document_id}", response_model=DocumentOut)
def get_document(
    document_id: uuid.UUID,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Document:
    return _get_owned(document_id, current, db)


@router.get("/{document_id}/file")
def get_document_file(
    document_id: uuid.UUID,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """The stored original PDF — what the citation viewer opens at a page.
    Readable by every role (viewing sources is part of reading answers)."""
    from fastapi import Response

    doc = _get_owned(document_id, current, db)
    if doc.source_type != "pdf" or not doc.file_path:
        raise HTTPException(
            status_code=404, detail="This source has no stored file."
        )
    try:
        data = storage.download(doc.file_path)
    except storage.StorageError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="File storage is unavailable. Try again shortly.",
        )
    safe_name = "".join(
        ch for ch in doc.title if ch.isalnum() or ch in " ._-"
    ).strip() or "document"
    return Response(
        content=data,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{safe_name}.pdf"',
            "Cache-Control": "private, max-age=300",
        },
    )


def _dispatch_ingestion(background_tasks: BackgroundTasks, doc_id) -> None:
    """Inline (BackgroundTasks) on the free-tier deploy; Celery in the
    docker-compose production shape. Same pipeline either way — the switch
    is WHERE it runs, not WHAT runs (Phase 10, guide's 'why' in worker.py)."""
    if get_settings().INGEST_MODE == "celery":
        from app.worker import ingest_document

        ingest_document.delay(str(doc_id))
    else:
        background_tasks.add_task(run_ingestion, doc_id)


@router.post("", response_model=DocumentOut, status_code=status.HTTP_202_ACCEPTED)
async def upload_document(
    file: UploadFile,
    background_tasks: BackgroundTasks,
    current: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Document:
    settings = get_settings()

    name = file.filename or ""
    is_pdf_name = name.lower().endswith(".pdf")
    is_pdf_type = (file.content_type or "") in ("application/pdf", "application/x-pdf")
    if not (is_pdf_name or is_pdf_type):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only PDF files are supported. For web pages, use Add URL.",
        )

    data = await file.read()
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="The file is empty.")
    if len(data) > settings.MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=f"File is larger than {settings.MAX_UPLOAD_BYTES // (1024 * 1024)}MB.",
        )
    if not data.startswith(b"%PDF-"):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="This file does not look like a valid PDF.",
        )

    title = (name.rsplit("/", 1)[-1].rsplit("\\", 1)[-1] or "Untitled document")
    if title.lower().endswith(".pdf"):
        title = title[:-4]
    title = title.strip()[:255] or "Untitled document"

    doc = Document(
        tenant_id=current.tenant_id,
        title=title,
        source_type="pdf",
        status="queued",
    )
    db.add(doc)
    db.flush()  # assign doc.id before the storage path uses it

    try:
        doc.file_path = storage.upload_pdf(current.tenant_id, doc.id, data)
    except storage.StorageError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="File storage is unavailable. Try again shortly.",
        )

    db.commit()
    db.refresh(doc)
    _dispatch_ingestion(background_tasks, doc.id)
    return doc


@router.post("/url", response_model=DocumentOut, status_code=status.HTTP_202_ACCEPTED)
def ingest_url(
    body: UrlIngestRequest,
    background_tasks: BackgroundTasks,
    current: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Document:
    url = body.url.strip()
    parsed = urlparse(url)
    # Fast, user-facing validation here; the pipeline repeats it with a full
    # SSRF/DNS check before actually fetching.
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise HTTPException(
            status_code=422, detail="Enter a full http(s):// web address."
        )

    doc = Document(
        tenant_id=current.tenant_id,
        title=(parsed.netloc + parsed.path).rstrip("/")[:255],
        source_type="url",
        source_url=url,
        status="queued",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    _dispatch_ingestion(background_tasks, doc.id)
    return doc


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: uuid.UUID,
    current: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> None:
    """Full cleanup: vectors -> chunk rows -> stored file -> document row.
    Safe to call mid-ingestion: the pipeline re-checks the document's
    existence at every stage and removes anything it wrote after this ran."""
    doc = _get_owned(document_id, current, db)

    chunk_ids = [
        str(cid)
        for cid in db.scalars(select(Chunk.id).where(Chunk.document_id == doc.id))
    ]
    try:
        vectorstore.delete_ids(str(current.tenant_id), chunk_ids)
    except vectorstore.VectorStoreError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Vector store is unavailable. Try again shortly.",
        )

    db.execute(sa_delete(Chunk).where(Chunk.document_id == doc.id))

    if doc.file_path:
        try:
            storage.delete_object(doc.file_path)
        except storage.StorageError:
            pass  # orphaned file is acceptable; DB consistency wins

    db.delete(doc)
    db.commit()
