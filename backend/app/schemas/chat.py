import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ConversationOut(BaseModel):
    id: uuid.UUID
    title: str
    question_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SourceOut(BaseModel):
    n: int
    document_id: str
    title: str
    page: int
    text: str
    score: float
    # Defaults tolerate messages persisted before these fields existed.
    source_type: str = "pdf"
    source_url: str | None = None


class TraceStep(BaseModel):
    n: int
    kind: Literal["planning", "knowledge", "web", "action", "reflection", "drafting"]
    label: str
    detail: str | None = None
    ms: int | None = None


class MessageOut(BaseModel):
    id: uuid.UUID
    role: Literal["user", "assistant"]
    content: str
    sources: list[SourceOut] | None = None
    trace: list[TraceStep] | None = None
    created_at: datetime


class ConversationDetail(ConversationOut):
    messages: list[MessageOut] = []


class AskRequest(BaseModel):
    content: str = Field(min_length=1, max_length=4000)
