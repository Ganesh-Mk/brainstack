import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

DocumentStatus = Literal[
    "queued", "extracting", "chunking", "embedding", "ready", "failed"
]


class DocumentOut(BaseModel):
    id: uuid.UUID
    title: str
    source_type: Literal["pdf", "url", "text"]
    source_url: str | None
    status: DocumentStatus
    error: str | None
    page_count: int
    chunk_count: int
    chunks_done: int
    created_at: datetime

    model_config = {"from_attributes": True}


class UrlIngestRequest(BaseModel):
    url: str = Field(min_length=10, max_length=2000)
