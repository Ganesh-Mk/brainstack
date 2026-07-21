import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class ApiKey(Base):
    """A workspace's programmatic credential (PHASE_11 §2).

    Deliberately unlike `Invite.token`, which is stored in plaintext: an
    invite is a single-use 7-day link, an API key is a long-lived credential.
    Only `sha256(key)` is persisted — the plaintext exists exactly once, in
    the create response.

    sha256 and not bcrypt on purpose: bcrypt is slow by design to protect
    low-entropy human passwords from offline cracking. This token is 192 bits
    of CSPRNG output, so there is nothing to crack, and bcrypt would put
    ~100ms in front of every API call.
    """

    __tablename__ = "api_keys"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("tenants.id"), index=True
    )
    name: Mapped[str] = mapped_column(String(80))
    environment: Mapped[str] = mapped_column(String(8), default="live")  # live | test
    prefix: Mapped[str] = mapped_column(String(16), default="bsk_live")
    last4: Mapped[str] = mapped_column(String(4), default="")
    key_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    scopes: Mapped[str] = mapped_column(String(255), default="")  # csv

    created_by_user_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    revoked_by_user_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)

    # Guardrails (enforced in Phase 11d; carried on the row from day one so
    # keys minted now don't need backfilling).
    rate_limit_per_hour: Mapped[int] = mapped_column(Integer, default=120)
    monthly_cost_cap_usd: Mapped[float | None] = mapped_column(Float, nullable=True)

    tenant = relationship("Tenant", lazy="joined")


class ApiRequest(Base):
    """One row per /v1 call — the HTTP ledger (PHASE_11 §1.6).

    Includes the calls that never touch a model (/v1/search, listings) and the
    ones that were refused (401/403/429) — rejections are the rows you most
    need when a key leaks.

    Carries `query_trace_id` rather than copying tokens and cost: spend is
    authored exactly once, in query_traces, so API cost is a join and never a
    second sum.
    """

    __tablename__ = "api_requests"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True, index=True)
    api_key_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, nullable=True, index=True
    )
    request_id: Mapped[str] = mapped_column(String(36), index=True)
    method: Mapped[str] = mapped_column(String(8))
    # The route TEMPLATE ("/v1/documents/{document_id}"), never the raw path:
    # bounded cardinality, a GROUP BY that means something, and no ids leaked
    # into an analytics table.
    route: Mapped[str] = mapped_column(String(80), index=True)
    status_code: Mapped[int] = mapped_column(Integer)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    error_code: Mapped[str | None] = mapped_column(String(40), nullable=True)
    query_trace_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    environment: Mapped[str] = mapped_column(String(8), default="live")
    ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        index=True,
    )


class ApiKeyEvent(Base):
    """Append-only audit of everything that ever happened to a key.

    Nothing here is deletable or editable by the API — "who minted the
    credential that read the whole corpus, and when was it revoked" must
    survive the key itself.
    """

    __tablename__ = "api_key_events"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("tenants.id"), index=True
    )
    api_key_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("api_keys.id"), index=True
    )
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    # created | revoked | rotated | scopes_changed | limits_changed
    action: Mapped[str] = mapped_column(String(24))
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON
    ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    # Stamped client-side, unlike every other table here: an audit log is read
    # newest-first, and `func.now()` resolves to whole seconds on SQLite, so
    # create-then-revoke ties and the order becomes arbitrary. The same class
    # of bug the phase-5 `message_seq_ordering` migration fixed. server_default
    # stays as the fallback for any non-ORM insert.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        index=True,
    )
