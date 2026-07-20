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

import httpx
from fastapi import APIRouter, Depends, HTTPException

from app.config import get_settings
from app.core.deps import CurrentUser, get_current_user, require_manager
from app.services import mcp_client

router = APIRouter(tags=["company"])


@router.get("/connections")
def connections(current: CurrentUser = Depends(get_current_user)) -> dict:
    """Connection status as THIS session sees it — role decides capability."""
    configured = mcp_client.is_configured()
    capable = current.role in ("manager", "admin")
    tools: list[dict] = []
    if configured and capable:
        tools = mcp_client.discover_tools(str(current.tenant_id), current.role)
    return {
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
