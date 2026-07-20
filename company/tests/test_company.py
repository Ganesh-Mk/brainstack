"""Company Systems service — store logic, REST auth, and the server-side
role checks inside the MCP tools (RBAC layer 2, defense in depth).

The full streamable-http handshake is exercised by the phase e2e script
against the running service; here we test the parts in-process.
"""

import os

import pytest
from fastapi.testclient import TestClient

from app import mcp_server, store
from app.main import app
from app.security import RoleError, current_role, current_tenant

SECRET = "unit-test-secret"


@pytest.fixture(autouse=True)
def env(monkeypatch):
    monkeypatch.setenv("MCP_SHARED_SECRET", SECRET)
    # fresh store every test
    store._tenants.clear()


@pytest.fixture(scope="module")
def client():
    # ONE TestClient for the whole module: the FastMCP session manager can
    # only be started once per process, and TestClient runs the lifespan.
    os.environ["MCP_SHARED_SECRET"] = SECRET
    with TestClient(app) as c:
        yield c


def headers(role="manager", tenant="t-1", secret=SECRET):
    return {"X-MCP-Secret": secret, "X-Tenant-Id": tenant, "X-Role": role}


# ── store ────────────────────────────────────────────────────────────────────


def test_seeding_and_tenant_isolation():
    a = store.list_tickets("t-a")
    assert len(a) == 6 and a[0]["key"] == "login-bug"
    store.assign_ticket("t-a", "login-bug", "Sara")
    # tenant b seeds independently and is untouched by a's mutation
    b = next(t for t in store.list_tickets("t-b") if t["key"] == "login-bug")
    assert b["assignee"] == "Dev K"


def test_assign_moves_open_to_in_progress():
    t = store.assign_ticket("t-1", "slow-dashboard", "priya")
    assert t["assignee"] == "Priya N" and t["status"] == "in_progress"
    # accepts ticket id too
    t2 = store.assign_ticket("t-1", "T-101", "sara")
    assert t2["key"] == "login-bug" and t2["assignee"] == "Sara M"


def test_assign_errors_are_human_readable():
    with pytest.raises(ValueError, match="No employee matching 'Bob'"):
        store.assign_ticket("t-1", "login-bug", "Bob")
    with pytest.raises(ValueError, match="No ticket matching 'nope'"):
        store.assign_ticket("t-1", "nope", "Priya")


def test_analytics_counts_follow_the_tickets():
    before = {r["name"]: r for r in store.analytics("t-1")}
    store.assign_ticket("t-1", "slow-dashboard", "Priya")
    after = {r["name"]: r for r in store.analytics("t-1")}
    assert after["Priya N"]["in_progress"] == before["Priya N"]["in_progress"] + 1
    with pytest.raises(ValueError, match="No employee matching"):
        store.analytics("t-1", "Zed")


# ── MCP tools enforce role server-side (layer 2) ─────────────────────────────


def ctx(role, tenant="t-1"):
    current_tenant.set(tenant)
    current_role.set(role)


def test_tools_reject_non_manager_roles():
    for tool, args in [
        (mcp_server.assign_ticket, ("login-bug", "Priya")),
        (mcp_server.list_tickets, ()),
        (mcp_server.get_analytics, ()),
    ]:
        ctx("employee")
        with pytest.raises(RoleError, match="manager or admin"):
            tool(*args)


def test_tools_work_for_manager_and_admin():
    ctx("manager")
    assert "login-bug" in mcp_server.list_tickets()
    assert "Priya N" in mcp_server.assign_ticket("login-bug", "Priya")
    ctx("admin")
    assert "avg_resolution_hours" in mcp_server.get_analytics("Priya")


def test_tools_scope_by_tenant_from_context():
    ctx("manager", "t-x")
    mcp_server.assign_ticket("login-bug", "Sara")
    ctx("manager", "t-y")
    assert "assignee: Dev K" in mcp_server.list_tickets("Dev")  # t-y pristine


# ── REST face ────────────────────────────────────────────────────────────────


def test_rest_auth_and_gating(client):
    assert client.get("/health").status_code == 200  # open
    assert client.get("/tickets").status_code == 401  # no secret
    assert client.get("/tickets", headers=headers(secret="bad")).status_code == 401
    assert client.get("/tickets", headers=headers(role="employee")).status_code == 403
    r = client.get("/tickets", headers=headers())
    assert r.status_code == 200 and len(r.json()["tickets"]) == 6


def test_rest_reflects_mutations_and_reset(client):
    store.assign_ticket("t-1", "login-bug", "Priya")
    r = client.get("/tickets", headers=headers()).json()
    assert next(t for t in r["tickets"] if t["key"] == "login-bug")["assignee"] == "Priya N"
    client.post("/reset", headers=headers())
    r = client.get("/tickets", headers=headers()).json()
    assert next(t for t in r["tickets"] if t["key"] == "login-bug")["assignee"] == "Dev K"
    a = client.get("/analytics", headers=headers()).json()["analytics"]
    assert {row["name"] for row in a} == {"Priya N", "Dev K", "Sara M"}
