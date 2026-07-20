"""MCP client — how the agent reaches the Company MCP Server.

Deliberate deviation from the guide (documented in PHASE_7.md): the official
`mcp` SDK instead of langchain-mcp-adapters, because our tools node executes
tools itself — we want the protocol calls (`list_tools`, `call_tool`), not
wrapped LangChain tools.

Every request carries the caller's tenant + role in headers, authenticated by
the shared secret. Those values come from get_current_user() upstream — the
cardinal rule holds across the service boundary.

Discovery is cached process-wide (~5 min): the tool CATALOG is the same for
every tenant; who may USE it is decided per session by the capability layer
in agent.assemble_tools() and re-checked server-side per call.
"""

from __future__ import annotations

import asyncio
import logging
import threading
import time
from contextlib import asynccontextmanager

import httpx

from app.config import get_settings

log = logging.getLogger("mcp")

NATIVE_TOOL_NAMES = {"search_knowledge", "web_search"}

# discovery cache: (expires_at_monotonic, schemas)
_cache: tuple[float, list[dict]] | None = None
_cache_lock = threading.Lock()
_FAILURE_TTL = 30.0  # don't hammer a napping/unreachable service


def is_configured() -> bool:
    s = get_settings()
    return bool(s.COMPANY_MCP_URL and s.MCP_SHARED_SECRET)


def _mcp_url() -> str:
    base = get_settings().COMPANY_MCP_URL.rstrip("/")
    return base if base.endswith("/mcp") else f"{base}/mcp"


def _headers(tenant_id: str, role: str) -> dict[str, str]:
    return {
        "X-MCP-Secret": get_settings().MCP_SHARED_SECRET,
        "X-Tenant-Id": tenant_id,
        "X-Role": role,
    }


@asynccontextmanager
async def _session(tenant_id: str, role: str):
    """One initialized MCP session per call — the server is stateless, and a
    fresh connection is what lets the free-tier prop service nap safely.
    Generous timeouts: the first call after idle may be a cold start."""
    from mcp import ClientSession
    from mcp.client.streamable_http import streamable_http_client

    async with httpx.AsyncClient(
        headers=_headers(tenant_id, role),
        timeout=httpx.Timeout(60, read=120),
        follow_redirects=True,
    ) as http:
        async with streamable_http_client(_mcp_url(), http_client=http) as (
            read,
            write,
            _,
        ):
            async with ClientSession(read, write) as session:
                await session.initialize()
                yield session


async def _discover(tenant_id: str, role: str) -> list[dict]:
    async with _session(tenant_id, role) as session:
        tools = (await session.list_tools()).tools
    return [
        {
            "name": t.name,
            "description": t.description or "",
            "input_schema": t.inputSchema,
        }
        for t in tools
        if t.name not in NATIVE_TOOL_NAMES  # native names are reserved
    ]


def discover_tools(tenant_id: str, role: str) -> list[dict]:
    """Anthropic-format tool schemas from the Company MCP Server, cached.
    Returns [] when not configured or unreachable — the agent then simply
    runs with native tools only (and Connections shows 'disconnected')."""
    global _cache
    if not is_configured():
        return []
    with _cache_lock:
        if _cache is not None and time.monotonic() < _cache[0]:
            return list(_cache[1])
    try:
        schemas = asyncio.run(_discover(tenant_id, role))
        ttl = float(get_settings().MCP_DISCOVERY_TTL)
    except Exception:
        log.warning("Company MCP discovery failed", exc_info=True)
        schemas, ttl = [], _FAILURE_TTL
    with _cache_lock:
        _cache = (time.monotonic() + ttl, schemas)
    return list(schemas)


async def _call(name: str, args: dict, tenant_id: str, role: str) -> tuple[str, bool]:
    async with _session(tenant_id, role) as session:
        result = await session.call_tool(name, args)
    text = "\n".join(
        c.text for c in result.content if getattr(c, "text", None)
    ) or "(the company system returned no text)"
    return text, bool(result.isError)


def call_tool(name: str, args: dict, tenant_id: str, role: str) -> tuple[str, bool]:
    """Execute one MCP tool. Returns (result_text, is_error). Errors come back
    as readable text (the server writes human messages) so the agent can relay
    them instead of crashing the stream."""
    try:
        return asyncio.run(_call(name, args, tenant_id, role))
    except Exception:
        log.warning("Company MCP call %s failed", name, exc_info=True)
        return (
            "The company system could not be reached right now. "
            "Tell the user the action did not happen and to try again shortly.",
            True,
        )


def reset_cache() -> None:
    """Test hook."""
    global _cache
    with _cache_lock:
        _cache = None
