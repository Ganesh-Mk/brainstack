import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base

# Pipeline lifecycle. `queued` on creation, then the ingestion task walks
# extracting -> chunking -> embedding -> ready (or failed at any point).
DOCUMENT_STATUSES = (
    "queued",
    "extracting",
    "chunking",
    "embedding",
    "ready",
    "failed",
)


class Document(Base):
    """Metadata + pipeline status. The original file lives in Supabase
    Storage (`file_path`); the vectors live in Pinecone (namespace =
    tenant_id, vector id = chunk id)."""

    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("tenants.id"), index=True
    )
    title: Mapped[str] = mapped_column(String(255))
    source_type: Mapped[str] = mapped_column(String(20))  # pdf | url | text
    source_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="queued")
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    page_count: Mapped[int] = mapped_column(Integer, default=0)
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    chunks_done: Mapped[int] = mapped_column(Integer, default=0)  # progress bar
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Chunk(Base):
    """Chunk text + metadata in Postgres; the embedding vector lives in
    Pinecone keyed by this row's id (namespace = tenant_id)."""

    __tablename__ = "chunks"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("tenants.id"), index=True
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("documents.id"), index=True
    )
    chunk_index: Mapped[int] = mapped_column(Integer)
    page: Mapped[int] = mapped_column(Integer, default=1)  # citation target
    text: Mapped[str] = mapped_column(Text)
    token_count: Mapped[int] = mapped_column(Integer, default=0)
    content_sha: Mapped[str] = mapped_column(
        String(64), index=True, default=""
    )  # embedding-cache key
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class EmbeddingCache(Base):
    """sha256(chunk_text) -> vector. Keyed by content hash and shared across
    tenants — identical text yields identical vectors, and nothing tenant-
    specific can leak through a hash lookup. Re-ingesting the same document
    while debugging costs nothing (PROJECT_GUIDE §Phase 2 tip)."""

    __tablename__ = "embedding_cache"

    content_sha: Mapped[str] = mapped_column(String(64), primary_key=True)
    model: Mapped[str] = mapped_column(String(120))
    vector: Mapped[str] = mapped_column(Text)  # JSON-encoded list[float]
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
