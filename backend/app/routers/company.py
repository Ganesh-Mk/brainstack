"""Connections + thin read-proxies to the Company Systems service.

/connections is readable by every role — showing an employee that the
connection EXISTS for managers (but not for them) is the Phase 7 lesson
made visible in the UI.

/company/* are manager/admin-only proxies over the company service's REST
face, for the Tickets and Workforce Analytics pages. The browser never
talks to the company service (or holds its secret) — tenant + role travel
from get_current_user() only.
"""

from __future__ import annotations

import time

import httpx
from fastapi import APIRouter, Depends, HTTPException

from app.config import get_settings
from app.core.deps import CurrentUser, get_current_user, require_manager
from app.services import mcp_client

router = APIRouter(tags=["company"])


def _wake_company_service(budget_s: float = 60.0) -> dict:
    """Ping the company service's /health until it answers 200 (or the
    budget runs out). Render spins the service up on first request after a
    nap, but a single long request doesn't reliably ride the cold start —
    short repeated pings do. Returns diagnostics that /connections surfaces,
    so a failing wake is observable from outside (we can't read Render logs)."""
    settings = get_settings()
    base = settings.COMPANY_MCP_URL.rstrip("/").removesuffix("/mcp")
    t0 = time.monotonic()
    detail = "no attempt"
    while time.monotonic() - t0 < budget_s:
        try:
            r = httpx.get(f"{base}/health", timeout=15)
            detail = f"status={r.status_code}"
            if r.status_code == 200:
                return {"ok": True, "detail": detail, "ms": int((time.monotonic() - t0) * 1000)}
        except Exception as e:  # noqa: BLE001 — diagnostic surface
            detail = f"{type(e).__name__}: {str(e)[:160]}"
        time.sleep(3)
    return {"ok": False, "detail": detail, "ms": int((time.monotonic() - t0) * 1000)}


@router.get("/connections")
def connections(
    refresh: bool = False,
    current: CurrentUser = Depends(get_current_user),
) -> dict:
    """Connection status as THIS session sees it — role decides capability.
    `refresh=true` (the UI's Refresh button) busts the discovery cache and
    wakes the napping service first instead of re-serving a cached failure."""
    configured = mcp_client.is_configured()
    capable = current.role in ("manager", "admin")
    tools: list[dict] = []
    wake: dict | None = None
    if configured and capable:
        if refresh:
            mcp_client.reset_cache()
            wake = _wake_company_service()
        tools = mcp_client.discover_tools(str(current.tenant_id), current.role)
    out = {
        "server": "Company Systems",
        "transport": "streamable-http",
        "configured": configured,
        "role": current.role,
        "capable": capable,
        # connected = this session would get these tools merged into its agent
        "connected": bool(tools),
        "tools": [
            {"name": t["name"], "description": t["description"]} for t in tools
        ],
    }
    if wake is not None:
        out["wake"] = wake
    return out


def _company_get(path: str, current: CurrentUser, params: dict | None = None) -> dict:
    settings = get_settings()
    if not mcp_client.is_configured():
        raise HTTPException(503, "The company system is not connected.")
    base = settings.COMPANY_MCP_URL.rstrip("/").removesuffix("/mcp")
    headers = {
        "X-MCP-Secret": settings.MCP_SHARED_SECRET,
        "X-Tenant-Id": str(current.tenant_id),
        "X-Role": current.role,
    }
    try:
        r = httpx.get(
            f"{base}{path}", headers=headers, params=params or {}, timeout=65
        )  # generous: the free-tier prop system may be waking up
        r.raise_for_status()
        return r.json()
    except httpx.HTTPError:
        raise HTTPException(502, "The company system could not be reached.")


@router.get("/company/tickets")
def company_tickets(
    current: CurrentUser = Depends(require_manager),
) -> dict:
    return _company_get("/tickets", current)


@router.get("/company/analytics")
def company_analytics(
    current: CurrentUser = Depends(require_manager),
) -> dict:
    return _company_get("/analytics", current)
