"""The Knowledge Library API.

Tenancy comes ONLY from get_current_user() — every query filters on
current.tenant_id, and the Pinecone namespace is derived from the same value.
Roles mirror the frontend nav registry: any member can view the library;
adding and deleting sources is admin-only.
"""

from __future__ import annotations

import uuid

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    UploadFile,
    status,
)
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import CurrentUser, get_current_user, require_admin
from app.db import get_db
from app.models import Document
from app.schemas.documents import DocumentOut, UrlIngestRequest
from app.services import library, storage

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


def _http(err: library.LibraryError) -> HTTPException:
    """The app contract speaks HTTPException; /v1 speaks ApiError. Same
    refusal, two vocabularies (PHASE_11 §1.1)."""
    return HTTPException(status_code=err.status_code, detail=err.message)


@router.post("", response_model=DocumentOut, status_code=status.HTTP_202_ACCEPTED)
async def upload_document(
    file: UploadFile,
    background_tasks: BackgroundTasks,
    current: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Document:
    data = await file.read()
    try:
        doc = library.create_pdf_document(
            db, current.tenant_id, file.filename, file.content_type, data
        )
    except library.LibraryError as e:
        raise _http(e)
    library.dispatch_ingestion(background_tasks, doc.id)
    return doc


@router.post("/url", response_model=DocumentOut, status_code=status.HTTP_202_ACCEPTED)
def ingest_url(
    body: UrlIngestRequest,
    background_tasks: BackgroundTasks,
    current: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Document:
    try:
        doc = library.create_url_document(db, current.tenant_id, body.url)
    except library.LibraryError as e:
        raise _http(e)
    library.dispatch_ingestion(background_tasks, doc.id)
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
    try:
        library.delete_document(db, doc)
    except library.LibraryError as e:
        raise _http(e)
