"""The public API's contract (PHASE_11 §3).

Deliberately NOT reused from app/schemas/chat.py. Those models describe the
private contract between our frontend and this backend and have changed with
every phase; these are a promise to someone else's code. When the two need to
diverge, that is a feature.
"""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

Environment = Literal["live", "test"]


class V1Tenant(BaseModel):
    id: uuid.UUID
    name: str
    slug: str


class V1Me(BaseModel):
    """`GET /v1/me` — the "is my key working" call."""

    key_id: uuid.UUID
    name: str
    environment: Environment
    masked: str
    scopes: list[str]
    role: str
    tenant: V1Tenant
    created_at: datetime
    expires_at: datetime | None
    rate_limit_per_hour: int
    monthly_cost_cap_usd: float | None


# ── ask ──────────────────────────────────────────────────────────────────────


class V1AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    # Omit to start a new conversation; pass it back to continue one. Multi-turn
    # context (history + summary) only works when the id is carried forward.
    conversation_id: uuid.UUID | None = None
    stream: bool = False


class V1Source(BaseModel):
    n: int
    title: str
    page: int
    text: str
    score: float
    source_type: str
    document_id: str | None = None
    source_url: str | None = None


class V1TraceStep(BaseModel):
    n: int
    kind: str
    label: str
    detail: str | None = None
    ms: int | None = None


class V1Usage(BaseModel):
    input_tokens: int
    output_tokens: int
    cost_usd: float | None
    latency_ms: int
    first_token_ms: int | None
    model: str


class V1AskResponse(BaseModel):
    answer: str
    sources: list[V1Source]
    trace: list[V1TraceStep]
    usage: V1Usage
    conversation_id: uuid.UUID
    trace_id: uuid.UUID | None


# ── search ───────────────────────────────────────────────────────────────────


class V1SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=4000)
    top_k: int | None = Field(default=None, ge=1, le=25)


class V1SearchResponse(BaseModel):
    query: str
    results: list[V1Source]
    latency_ms: int


# ── documents ────────────────────────────────────────────────────────────────


class V1DocumentUrlRequest(BaseModel):
    url: str = Field(min_length=1, max_length=2000)


class V1Document(BaseModel):
    id: uuid.UUID
    title: str
    source_type: str
    status: str  # queued | extracting | chunking | embedding | ready | failed
    chunk_count: int | None = None
    chunks_done: int | None = None
    error: str | None = None
    created_at: datetime


class V1DocumentList(BaseModel):
    documents: list[V1Document]
