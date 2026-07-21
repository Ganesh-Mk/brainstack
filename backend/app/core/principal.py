"""The `/v1` authentication seam (PHASE_11 §1.2).

🔑 The cardinal rule of this codebase (see core/deps.py) is that
`(user, tenant_id, role)` comes from a server-side database row and never
from anything the caller sends. API keys must not weaken it, so they get
their OWN dependency rather than being folded into `get_current_user`.

Folding them in was considered and rejected: it would silently let an API key
reach every internal route, including /auth/members and /stats/*. A scope
system that only covers half the surface is not a scope system.

`Principal` is the shared vocabulary both paths produce, so services below
this layer never care which one authenticated the call.
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from typing import Any

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core import ratelimit
from app.core.deps import CurrentUser, get_current_user
from app.db import get_db
from app.services import apikeys

_bearer = HTTPBearer(auto_error=False)


class ApiError(HTTPException):
    """A `/v1` error with a stable machine-readable `code`.

    Client code branches on the code, never on the prose. The handler in
    main.py flattens it to {code, message, request_id}.
    """

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        headers: dict[str, str] | None = None,
        **extra: Any,
    ):
        super().__init__(status_code=status_code, detail=message)
        self.code = code
        self.message = message
        self.response_headers = headers or {}
        self.extra = extra


@dataclass(frozen=True)
class Principal:
    """Who is making this call, and what they may do."""

    tenant_id: uuid.UUID
    role: str  # drives MCP/capability gating, exactly as for a session
    user_id: uuid.UUID  # the human accountable for the call
    kind: str  # "session" | "api_key"
    api_key_id: uuid.UUID | None = None
    environment: str = "app"  # "app" | "live" | "test"
    scopes: frozenset[str] = field(default_factory=frozenset)

    @property
    def is_api_key(self) -> bool:
        return self.kind == "api_key"


def principal_from_session(current: CurrentUser) -> Principal:
    """Project the existing session auth onto the same vocabulary. A session
    carries no scopes — it is bounded by the user's role instead."""
    return Principal(
        tenant_id=current.tenant_id,
        role=current.role,
        user_id=current.user.id,
        kind="session",
        environment="app",
    )


def get_session_principal(
    current: CurrentUser = Depends(get_current_user),
) -> Principal:
    return principal_from_session(current)


def _rate_limit_headers(used: int, limit: int) -> dict[str, str]:
    reset = ratelimit.window_reset()
    return {
        "X-RateLimit-Limit": str(limit),
        "X-RateLimit-Remaining": str(max(0, limit - used)),
        "X-RateLimit-Reset": str(reset),
    }


def _enforce_rate_limits(key) -> None:
    """Two buckets, key first then tenant. The per-key bucket is what stops
    one runaway integration from eating the whole workspace's budget; the
    tenant bucket is the outer bound the app route already respects.

    Inherits ratelimit's degrade-to-no-op property: without Redis this does
    nothing, because protection is an upgrade and never an outage. The cost
    cap (services/usage.py) is the guardrail that still holds in that case.
    """
    per_key = ratelimit.hit(f"apikey:{key.id}", key.rate_limit_per_hour)
    if per_key is not None:
        used, limit = per_key
        if used > limit:
            raise ApiError(
                429,
                "rate_limited",
                f"This key has used its {limit} requests for the hour.",
                headers={
                    **_rate_limit_headers(used, limit),
                    "Retry-After": str(max(1, ratelimit.window_reset() - int(time.time()))),
                },
                limit=limit,
                scope_of_limit="key",
            )

    tenant_limit = get_settings().RATE_LIMIT_ASKS_PER_HOUR
    per_tenant = ratelimit.hit(f"apitenant:{key.tenant_id}", tenant_limit)
    if per_tenant is not None:
        used, limit = per_tenant
        if used > limit:
            raise ApiError(
                429,
                "rate_limited",
                f"This workspace has used its {limit} API requests for the hour.",
                headers={
                    "Retry-After": str(max(1, ratelimit.window_reset() - int(time.time()))),
                },
                limit=limit,
                scope_of_limit="workspace",
            )


def get_api_principal(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> Principal:
    """Resolve `Authorization: Bearer bsk_...` into a Principal."""
    invalid = ApiError(
        401,
        "invalid_api_key",
        "Provide a workspace API key as `Authorization: Bearer bsk_...`.",
    )
    if credentials is None or not apikeys.looks_like_api_key(credentials.credentials):
        raise invalid

    key = apikeys.find_by_plaintext(db, credentials.credentials)
    if key is None:
        raise invalid
    if key.revoked_at is not None:
        raise ApiError(401, "key_revoked", "This API key has been revoked.")
    if apikeys.is_expired(key):
        raise ApiError(401, "key_expired", "This API key has expired.")

    apikeys.touch_last_used(db, key)
    scopes = apikeys.parse_scopes(key.scopes)

    # Metering (Phase 11d) reads these off request.state.
    request.state.api_key_id = key.id
    request.state.tenant_id = key.tenant_id
    request.state.environment = key.environment

    _enforce_rate_limits(key)

    return Principal(
        tenant_id=key.tenant_id,
        role=apikeys.role_for_scopes(scopes),
        user_id=key.created_by_user_id,
        kind="api_key",
        api_key_id=key.id,
        environment=key.environment,
        scopes=scopes,
    )


def require_scope(scope: str):
    """Dependency factory: gate a `/v1` route on one scope."""

    def dependency(principal: Principal = Depends(get_api_principal)) -> Principal:
        if scope not in principal.scopes:
            raise ApiError(
                403,
                "insufficient_scope",
                f"This key lacks the `{scope}` scope.",
                required=scope,
            )
        return principal

    return dependency
