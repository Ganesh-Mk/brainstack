"""The Company MCP Server — the boundary that makes Phase 7 the differentiator.

Three tools over streamable-http. Every tool re-validates tenant + role from
the authenticated request context (layer 2 of RBAC) — the capability layer in
the backend is the star, but the server never trusts the client.

Tools return plain formatted text: MCP results feed straight into the
agent's tool-result message, so human-readable beats JSON here.
"""

from __future__ import annotations

import json

from mcp.server.fastmcp import FastMCP

from . import store
from .security import require_action_role

mcp = FastMCP(
    "brainstack-company",
    instructions="Company ticketing and workforce systems for BrainStack.",
    stateless_http=True,
)


def _fmt_ticket(t: dict) -> str:
    assignee = t["assignee"] or "unassigned"
    return f"[{t['id']} {t['key']}] {t['title']} — {t['status']}, {t['priority']} priority, assignee: {assignee}"


@mcp.tool()
def list_tickets(assignee: str = "") -> str:
    """List the company's support/engineering tickets, optionally filtered by
    assignee name. Shows id, key, title, status, priority and assignee."""
    tenant_id, _ = require_action_role()
    tickets = store.list_tickets(tenant_id, assignee or None)
    if not tickets:
        return f"No tickets found{f' for assignee {assignee!r}' if assignee else ''}."
    return "\n".join(_fmt_ticket(t) for t in tickets)


@mcp.tool()
def assign_ticket(ticket_key: str, assignee: str) -> str:
    """Assign (or reassign) a ticket to an employee. Use the ticket key
    (e.g. 'login-bug') or id (e.g. 'T-101') and the employee's name."""
    tenant_id, _ = require_action_role()
    ticket = store.assign_ticket(tenant_id, ticket_key, assignee)
    return (
        f"Done — ticket reassigned to {ticket['assignee']}.\n{_fmt_ticket(ticket)}"
    )


@mcp.tool()
def get_analytics(employee: str = "") -> str:
    """Workload analytics for the team, or one employee by name: open and
    in-progress tickets, closed this month, average resolution time."""
    tenant_id, _ = require_action_role()
    rows = store.analytics(tenant_id, employee or None)
    return json.dumps(rows, indent=1)
