"""Phase 7 — RBAC by capability.

The thesis of the phase, as a test: an employee's agent session contains NO
company tools — not blocked, not refused, absent. Plus: the manager merge,
graceful degradation, MCP execution through the real graph with `action`
trace steps, and the /connections + /company/* endpoint gating.
"""

from __future__ import annotations

import uuid

import pytest
from langchain_core.messages import AIMessage, ToolMessage

from app.config import get_settings
from app.services import agent, mcp_client
from tests.conftest import auth_header, signup
from tests.test_agent import FakeChat

FAKE_MCP_TOOLS = [
    {
        "name": "assign_ticket",
        "description": "Assign a ticket to an employee.",
        "input_schema": {
            "type": "object",
            "properties": {"ticket_key": {"type": "string"}, "assignee": {"type": "string"}},
            "required": ["ticket_key", "assignee"],
        },
    },
    {
        "name": "get_analytics",
        "description": "Workload analytics.",
        "input_schema": {"type": "object", "properties": {"employee": {"type": "string"}}},
    },
]

NATIVE = [t["name"] for t in agent.TOOL_SCHEMAS]


@pytest.fixture
def mcp_on(monkeypatch):
    """MCP 'configured' with discovery mocked — records who discovers."""
    settings = get_settings()
    monkeypatch.setattr(settings, "COMPANY_MCP_URL", "http://company.test")
    monkeypatch.setattr(settings, "MCP_SHARED_SECRET", "s3cret")
    calls: list[tuple[str, str]] = []

    def fake_discover(tenant_id, role):
        calls.append((tenant_id, role))
        return [dict(t) for t in FAKE_MCP_TOOLS]

    monkeypatch.setattr(mcp_client, "discover_tools", fake_discover)
    return calls


# ── the capability layer ─────────────────────────────────────────────────────


def test_employee_session_has_no_mcp_tools(mcp_on):
    """THE phase thesis: absent by construction, not blocked by a prompt."""
    tools = agent.assemble_tools("t-1", "employee")
    assert [t["name"] for t in tools] == NATIVE
    assert mcp_on == []  # no discovery call — the connection was never made


def test_manager_and_admin_sessions_merge_mcp_tools(mcp_on):
    for role in ("manager", "admin"):
        tools = agent.assemble_tools("t-1", role)
        assert [t["name"] for t in tools] == NATIVE + ["assign_ticket", "get_analytics"]
    assert mcp_on == [("t-1", "manager"), ("t-1", "admin")]


def test_unconfigured_manager_gets_native_only():
    # autouse fixture leaves MCP unconfigured; no mock needed — is_configured
    # short-circuits before any network attempt.
    tools = agent.assemble_tools("t-1", "manager")
    assert [t["name"] for t in tools] == NATIVE


def test_discovery_failure_degrades_to_native(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "COMPANY_MCP_URL", "http://company.test")
    monkeypatch.setattr(settings, "MCP_SHARED_SECRET", "s3cret")

    async def boom(tenant_id, role):
        raise ConnectionError("company system napping")

    monkeypatch.setattr(mcp_client, "_discover", boom)
    assert [t["name"] for t in agent.assemble_tools("t-1", "manager")] == NATIVE


def test_system_prompt_is_role_aware():
    with_actions = agent.system_prompt("manager", True)
    without = agent.system_prompt("employee", False)
    assert "Company systems" in with_actions and "never claim" in with_actions.lower()
    assert "manager and admin accounts only" in without
    # initial_state wires it through
    state = agent.initial_state(uuid.uuid4(), "q", [], role="employee")
    # With prompt caching on, system content is a block list — stringify.
    assert "manager and admin accounts only" in str(state["messages"][0].content)
    assert [t["name"] for t in state["tool_schemas"]] == NATIVE


# ── MCP execution through the real graph ─────────────────────────────────────


def test_graph_runs_mcp_tool_with_action_trace(mcp_on, monkeypatch):
    monkeypatch.setattr(agent, "ChatAnthropic", FakeChat)
    executed: list[tuple] = []

    def fake_call(name, args, tenant_id, role):
        executed.append((name, args, tenant_id, role))
        return ("Done — ticket reassigned to Priya N.", False)

    monkeypatch.setattr(agent.mcp_client, "call_tool", fake_call)
    agent._graph = None
    FakeChat.calls = 0
    FakeChat.script = [
        AIMessage(
            content="",
            tool_calls=[
                {
                    "name": "assign_ticket",
                    "args": {"ticket_key": "login-bug", "assignee": "Priya"},
                    "id": "t1",
                    "type": "tool_call",
                }
            ],
        ),
        AIMessage(content="Reassigned login-bug to Priya N."),
    ]
    try:
        state = agent.initial_state(uuid.uuid4(), "assign login-bug to priya", [], role="manager")
        traces, final = [], None
        for mode, payload in agent.get_graph().stream(state, stream_mode=["custom", "values"]):
            if mode == "custom" and "trace" in payload:
                traces.append(payload["trace"])
            elif mode == "values":
                final = payload

        assert [t["kind"] for t in traces] == ["planning", "action", "planning"]
        action = traces[1]
        assert action["label"] == "Company MCP · assign_ticket"
        assert "login-bug" in action["detail"] and action["ms"] is not None
        # executed over the client with the session's tenant + role
        (name, args, tenant_id, role) = executed[0]
        assert name == "assign_ticket" and role == "manager"
        assert args == {"ticket_key": "login-bug", "assignee": "Priya"}
        # actions are facts, not citations: no sources
        assert final["sources"] == []
        # the tool result reached the model as a ToolMessage
        tool_msgs = [m for m in final["messages"] if isinstance(m, ToolMessage)]
        assert "reassigned to Priya N" in tool_msgs[0].content
    finally:
        agent._graph = None


# ── endpoints ────────────────────────────────────────────────────────────────


def make_users(client):
    """admin + employee in one tenant; returns (admin_headers, emp_headers)."""
    a = signup(client, "Company A", "Admin", "admin@company-a.com").json()
    invite = client.post(
        "/auth/invites",
        headers=auth_header(a["access_token"]),
        json={"email": "emp@company-a.com", "role": "employee"},
    ).json()
    emp = client.post(
        f"/auth/invites/{invite['token']}/accept",
        json={"name": "Emp", "password": "password123"},
    ).json()
    return auth_header(a["access_token"]), auth_header(emp["access_token"])


def test_connections_reports_by_role(client, mcp_on):
    admin_h, emp_h = make_users(client)

    r = client.get("/connections", headers=admin_h).json()
    assert r["configured"] and r["capable"] and r["connected"]
    assert [t["name"] for t in r["tools"]] == ["assign_ticket", "get_analytics"]
    assert r["transport"] == "streamable-http"

    r = client.get("/connections", headers=emp_h).json()
    assert r["configured"] and not r["capable"] and not r["connected"]
    assert r["tools"] == []
    # discovery ran for the admin only — never for the employee
    assert [role for _, role in mcp_on] == ["admin"]


def test_connections_unconfigured(client):
    admin_h, _ = make_users(client)
    r = client.get("/connections", headers=admin_h).json()
    assert not r["configured"] and not r["connected"] and r["tools"] == []


def test_company_proxies_are_role_gated(client, mcp_on, monkeypatch):
    admin_h, emp_h = make_users(client)

    # employees: 403 from the dependency, regardless of configuration
    assert client.get("/company/tickets", headers=emp_h).status_code == 403
    assert client.get("/company/analytics", headers=emp_h).status_code == 403

    # manager/admin: proxied with the secret + identity headers
    seen = {}

    class FakeResp:
        def raise_for_status(self):
            pass

        def json(self):
            return {"tickets": []}

    def fake_get(url, headers=None, params=None, timeout=None):
        seen.update({"url": url, "headers": headers})
        return FakeResp()

    from app.routers import company

    monkeypatch.setattr(company.httpx, "get", fake_get)
    assert client.get("/company/tickets", headers=admin_h).json() == {"tickets": []}
    assert seen["url"] == "http://company.test/tickets"
    assert seen["headers"]["X-MCP-Secret"] == "s3cret"
    assert seen["headers"]["X-Role"] == "admin"


def test_company_proxies_503_when_unconfigured(client):
    admin_h, _ = make_users(client)
    assert client.get("/company/tickets", headers=admin_h).status_code == 503

    # unauthenticated: 401 before anything else
    assert client.get("/company/tickets").status_code == 401
