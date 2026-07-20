import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Memory(Base):
    """Phase 8 long-term memory: one durable fact the user stated, extracted
    after an answer (most exchanges yield none). The embedding lives in
    Pinecone namespace f"{tenant_id}-mem" keyed by this row's id; deleting
    the row deletes the vector too. Scoped tenant AND user — your facts are
    not your coworker's."""

    __tablename__ = "memories"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("tenants.id"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id"), index=True
    )
    content: Mapped[str] = mapped_column(Text)
    conversation_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, nullable=True
    )  # where it was learned (no FK: survives conversation deletion)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
