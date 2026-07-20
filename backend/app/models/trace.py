import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class QueryTrace(Base):
    """One row per ask (PROJECT_GUIDE §2.16) — successes AND failures.
    This is the raw material of the Analytics + Observability pages: latency
    percentiles, cost per day, tool usage, top questions."""

    __tablename__ = "query_traces"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("tenants.id"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    conversation_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    question: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(12), default="ok")  # ok | error
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    first_token_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tool_kinds: Mapped[str] = mapped_column(String(120), default="")  # csv of trace kinds
    source_count: Mapped[int] = mapped_column(Integer, default=0)
    input_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    output_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cost_usd: Mapped[float | None] = mapped_column(Float, nullable=True)
    model: Mapped[str] = mapped_column(String(80), default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )


class EvalRun(Base):
    """One golden-dataset run (eval/run_eval.py) — the Evaluation page's
    history. per_question holds the full JSON breakdown for drill-down."""

    __tablename__ = "eval_runs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    dataset_size: Mapped[int] = mapped_column(Integer)
    faithfulness: Mapped[float] = mapped_column(Float)
    relevance: Mapped[float] = mapped_column(Float)
    retrieval_hit: Mapped[float] = mapped_column(Float)
    citation_validity: Mapped[float] = mapped_column(Float)
    model: Mapped[str] = mapped_column(String(80), default="")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    per_question: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
