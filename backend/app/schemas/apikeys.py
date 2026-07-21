import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

Environment = Literal["live", "test"]


class ApiKeyCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    environment: Environment = "live"
    scopes: list[str] = Field(min_length=1)
    expires_in_days: int | None = Field(default=None, ge=1, le=3650)
    rate_limit_per_hour: int | None = Field(default=None, ge=0, le=100_000)
    monthly_cost_cap_usd: float | None = Field(default=None, ge=0)


class ApiKeyOut(BaseModel):
    """What a key looks like after creation — never the plaintext, never the hash."""

    id: uuid.UUID
    name: str
    environment: Environment
    prefix: str
    last4: str
    masked: str  # "bsk_live_••••4f2a" — what the UI renders
    scopes: list[str]
    created_by_user_id: uuid.UUID
    created_at: datetime
    expires_at: datetime | None
    last_used_at: datetime | None
    revoked_at: datetime | None
    rate_limit_per_hour: int
    monthly_cost_cap_usd: float | None
    active: bool
    # Rolling 7-day activity, filled from the two ledgers by the list route.
    requests_7d: int = 0
    errors_7d: int = 0
    cost_usd_7d: float = 0.0


class ApiKeyCreated(ApiKeyOut):
    """The ONLY response that ever contains the plaintext key."""

    key: str


class ApiKeyEventOut(BaseModel):
    id: uuid.UUID
    api_key_id: uuid.UUID
    actor_user_id: uuid.UUID | None
    action: str
    detail: str | None
    created_at: datetime


class ScopeOut(BaseModel):
    scope: str
    description: str


class ApiKeyCatalog(BaseModel):
    """Drives the create-key form so the UI never hardcodes the scope list."""

    scopes: list[ScopeOut]
    environments: list[str]
    default_scopes: list[str]
    default_rate_limit_per_hour: int
    max_keys_per_tenant: int

# The /v1 contract lives in app/schemas/v1.py — separate on purpose.
