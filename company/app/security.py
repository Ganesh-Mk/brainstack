"""Cross-service auth + request context.

Every request from the BrainStack backend carries:
    X-MCP-Secret : shared secret between the two services
    X-Tenant-Id  : the caller's tenant (from get_current_user, never client input)
    X-Role       : the caller's role

The middleware validates the secret and stashes tenant/role in contextvars so
MCP tool handlers (which don't see the HTTP request) can enforce RBAC —
the guide's defense-in-depth: even a buggy or forged client can't act
without the right role, because the SERVER checks too.
"""

from __future__ import annotations

import os
from contextvars import ContextVar

from starlette.requests import Request
from starlette.responses import JSONResponse

current_tenant: ContextVar[str] = ContextVar("current_tenant", default="")
current_role: ContextVar[str] = ContextVar("current_role", default="")

ACTION_ROLES = ("manager", "admin")


def shared_secret() -> str:
    return os.environ.get("MCP_SHARED_SECRET", "")


async def auth_middleware(request: Request, call_next):
    if request.url.path in ("/health", "/", "/docs", "/openapi.json"):
        return await call_next(request)

    secret = shared_secret()
    if not secret or request.headers.get("x-mcp-secret") != secret:
        return JSONResponse({"detail": "Unauthorized"}, status_code=401)

    current_tenant.set(request.headers.get("x-tenant-id", ""))
    current_role.set(request.headers.get("x-role", ""))
    return await call_next(request)


class RoleError(PermissionError):
    pass


def require_action_role() -> tuple[str, str]:
    """Returns (tenant_id, role) or raises. Called inside every MCP tool."""
    tenant, role = current_tenant.get(), current_role.get()
    if not tenant:
        raise RoleError("Missing tenant context.")
    if role not in ACTION_ROLES:
        raise RoleError(
            "This tool requires the manager or admin role. The current session "
            f"has role '{role or 'unknown'}'."
        )
    return tenant, role
