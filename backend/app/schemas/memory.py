import uuid
from datetime import datetime

from pydantic import BaseModel


class MemoryOut(BaseModel):
    id: uuid.UUID
    content: str
    conversation_id: uuid.UUID | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
