"""The ingestion pipeline: extract -> chunk -> embed -> store, with live
progress. Runs as a FastAPI BackgroundTask after POST /documents returns 202.

Design rules, learned the hard way in the Phase 3 lab and hardened here:

* The task owns its OWN database session — the request's session is long
  closed by the time this runs.
* Progress is committed after every batch so the frontend's polling sees
  chunks_done tick upward in real time.
* The document is re-fetched at every stage boundary and every batch: if the
  user deleted it mid-pipeline, the task aborts and removes anything it
  already wrote (vectors + chunk rows). Deletion always wins.
* Any failure marks the document `failed` with a human-readable error and
  removes partial vectors/chunks, so a failed document is inert — never a
  half-indexed one.
"""

from __future__ import annotations

import logging
import uuid

from langchain_text_splitters import RecursiveCharacterTextSplitter
from sqlalchemy import delete as sa_delete
from sqlalchemy import select

from app import db as app_db
from app.config import get_settings
from app.models import Chunk, Document
from app.services import embeddings, extraction, storage, vectorstore

log = logging.getLogger("ingestion")


def _splitter() -> RecursiveCharacterTextSplitter:
    settings = get_settings()
    return RecursiveCharacterTextSplitter(
        chunk_size=settings.CHUNK_SIZE,
        chunk_overlap=settings.CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", " ", ""],
    )


def _cleanup(db, document_id: uuid.UUID, tenant_id: uuid.UUID) -> None:
    """Remove everything the pipeline may have written for this document."""
    chunk_ids = [
        str(cid)
        for cid in db.scalars(
            select(Chunk.id).where(Chunk.document_id == document_id)
        )
    ]
    try:
        vectorstore.delete_ids(str(tenant_id), chunk_ids)
    except Exception:  # vector cleanup is best-effort; ids are tenant-scoped
        log.exception("vector cleanup failed for document %s", document_id)
    db.execute(sa_delete(Chunk).where(Chunk.document_id == document_id))
    db.commit()


def run_ingestion(document_id: uuid.UUID) -> None:
    settings = get_settings()
    # Late-bound so tests can point SessionLocal at their own engine.
    db = app_db.SessionLocal()
    doc: Document | None = None
    try:
        doc = db.get(Document, document_id)
        if doc is None:  # deleted before we even started
            return
        tenant_id = doc.tenant_id

        # ── extract ────────────────────────────────────────────────────────
        doc.status = "extracting"
        db.commit()

        if doc.source_type == "pdf":
            data = storage.download(doc.file_path)
            page_count, pages = extraction.extract_pdf(data)
        else:  # url
            title, text = extraction.extract_url(doc.source_url)
            # The router stored a URL-derived placeholder; swap in the page's
            # real title now that we have it.
            if title:
                doc.title = title
            page_count, pages = 1, [(1, text)]

        doc = db.get(Document, document_id)
        if doc is None:
            return
        doc.page_count = page_count

        # ── chunk ──────────────────────────────────────────────────────────
        doc.status = "chunking"
        db.commit()

        splitter = _splitter()
        chunks: list[Chunk] = []
        index = 0
        for page_no, text in pages:
            for piece in splitter.split_text(" ".join(text.split())):
                if not piece.strip():
                    continue
                chunks.append(
                    Chunk(
                        tenant_id=tenant_id,
                        document_id=document_id,
                        chunk_index=index,
                        page=page_no,
                        text=piece,
                        token_count=max(1, len(piece) // 4),
                        content_sha=embeddings.content_sha(piece),
                    )
                )
                index += 1

        if not chunks:
            raise extraction.ExtractionError("Document produced no usable text.")

        db.add_all(chunks)
        doc = db.get(Document, document_id)
        if doc is None:
            _cleanup(db, document_id, tenant_id)
            return
        doc.chunk_count = len(chunks)
        doc.chunks_done = 0
        doc.status = "embedding"
        db.commit()

        # ── embed + upsert, in batches, with live progress ────────────────
        batch_size = settings.EMBED_BATCH_SIZE
        total_hits = 0
        for start in range(0, len(chunks), batch_size):
            batch = chunks[start : start + batch_size]

            # Deletion always wins: check before each (potentially slow) batch.
            doc = db.get(Document, document_id)
            if doc is None:
                _cleanup(db, document_id, tenant_id)
                return

            vectors, hits = embeddings.embed_with_cache(
                db, [c.text for c in batch]
            )
            total_hits += hits
            vectorstore.upsert(
                str(tenant_id),
                [
                    {
                        "id": str(c.id),
                        "values": vec,
                        "metadata": {
                            "document_id": str(document_id),
                            "page": c.page,
                            "text": c.text[:900],
                        },
                    }
                    for c, vec in zip(batch, vectors)
                ],
            )
            doc.chunks_done = min(start + len(batch), len(chunks))
            db.commit()  # <- the progress bar

        # ── done ───────────────────────────────────────────────────────────
        doc = db.get(Document, document_id)
        if doc is None:
            _cleanup(db, document_id, tenant_id)
            return
        doc.status = "ready"
        doc.error = None
        db.commit()
        log.info(
            "ingested %s: %d chunks, %d cache hits", document_id, len(chunks), total_hits
        )

    except Exception as e:
        log.exception("ingestion failed for %s", document_id)
        db.rollback()
        doc = db.get(Document, document_id)
        if doc is not None:
            _cleanup(db, document_id, doc.tenant_id)
            doc = db.get(Document, document_id)
            if doc is not None:
                doc.status = "failed"
                doc.error = (
                    str(e)
                    if isinstance(e, (extraction.ExtractionError, storage.StorageError))
                    else "Ingestion failed unexpectedly. Try again or contact support."
                )
                doc.chunk_count = 0
                doc.chunks_done = 0
                db.commit()
    finally:
        db.close()
