"""Company Systems — a small, separate FastAPI service.

Plays the role of "the company's existing internal systems" (ticketing + HR).
Two faces, same in-memory store:

  - Plain REST (/tickets, /analytics) — "the company system's own API",
    read by the BrainStack backend's thin proxies for the UI pages.
  - MCP at /mcp (streamable-http) — what the agent discovers and calls.

Both faces sit behind the shared-secret middleware in security.py.
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware

from . import store
from .mcp_server import mcp
from .security import ACTION_ROLES, auth_middleware, current_role, current_tenant


@asynccontextmanager
async def lifespan(app: FastAPI):
    # The streamable-http session manager must be running for /mcp to serve.
    async with mcp.session_manager.run():
        yield


app = FastAPI(title="BrainStack Company Systems", version="1.0.0", lifespan=lifespan)
app.add_middleware(BaseHTTPMiddleware, dispatch=auth_middleware)

# Serve the MCP endpoint at exactly /mcp (the sub-app's internal path is "/").
mcp.settings.streamable_http_path = "/"
app.mount("/mcp", mcp.streamable_http_app())


def _ctx() -> str:
    """Tenant for REST calls; role-gated like the tools (defense in depth)."""
    tenant, role = current_tenant.get(), current_role.get()
    if not tenant:
        raise HTTPException(400, "Missing X-Tenant-Id header")
    if role not in ACTION_ROLES:
        raise HTTPException(403, "Requires manager or admin role")
    return tenant


@app.get("/health")
def health():
    return {"status": "ok", "service": "company-systems"}


@app.get("/tickets")
def tickets(assignee: str | None = None):
    return {"tickets": store.list_tickets(_ctx(), assignee)}


@app.get("/employees")
def employees():
    return {"employees": store.tenant_state(_ctx())["employees"]}


@app.get("/analytics")
def analytics(employee: str | None = None):
    try:
        return {"analytics": store.analytics(_ctx(), employee)}
    except ValueError as e:
        raise HTTPException(404, str(e))


@app.post("/reset")
def reset():
    """Re-seed the calling tenant's data (handy for demos/tests)."""
    tenant = _ctx()
    store.reset(tenant)
    store.tenant_state(tenant)
    return {"status": "reseeded"}
