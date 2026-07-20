"""The mock company system — deliberately dumb, per the guide.

In-memory dicts, seeded per tenant on first touch. It exists to be a PROP:
a stand-in for "the company's real ticketing/HR system" so the MCP boundary
has something real to act on. It resets when the process restarts (the UI
says so). Do not gold-plate it.
"""

from __future__ import annotations

import threading
from datetime import datetime, timedelta, timezone

_lock = threading.Lock()
_tenants: dict[str, dict] = {}

EMPLOYEES = [
    {"name": "Priya N", "title": "Manager, Delivery"},
    {"name": "Dev K", "title": "Product Engineer"},
    {"name": "Sara M", "title": "Design Engineer"},
]

_SEED_TICKETS = [
    ("login-bug", "Login fails with SSO accounts", "open", "Dev K", "high"),
    ("checkout-crash", "Checkout crashes on saved cards", "in_progress", "Sara M", "high"),
    ("slow-dashboard", "Dashboard takes 8s to load", "open", None, "medium"),
    ("email-bounce", "Invite emails bouncing for gmail", "in_progress", "Dev K", "medium"),
    ("dark-mode", "Customer request: dark mode", "open", None, "low"),
    ("export-csv", "CSV export drops unicode names", "closed", "Priya N", "medium"),
]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _seed() -> dict:
    base = datetime.now(timezone.utc)
    tickets = []
    for i, (key, title, status, assignee, priority) in enumerate(_SEED_TICKETS):
        tickets.append(
            {
                "id": f"T-{101 + i}",
                "key": key,
                "title": title,
                "status": status,
                "assignee": assignee,
                "priority": priority,
                "updated_at": (base - timedelta(hours=3 * i + 1)).isoformat(),
            }
        )
    return {"tickets": tickets, "employees": [dict(e) for e in EMPLOYEES]}


def tenant_state(tenant_id: str) -> dict:
    with _lock:
        if tenant_id not in _tenants:
            _tenants[tenant_id] = _seed()
        return _tenants[tenant_id]


def list_tickets(tenant_id: str, assignee: str | None = None) -> list[dict]:
    tickets = tenant_state(tenant_id)["tickets"]
    if assignee:
        needle = assignee.strip().lower()
        tickets = [
            t for t in tickets if t["assignee"] and needle in t["assignee"].lower()
        ]
    return [dict(t) for t in tickets]


def find_employee(tenant_id: str, name: str) -> dict | None:
    needle = name.strip().lower()
    for e in tenant_state(tenant_id)["employees"]:
        if needle in e["name"].lower():
            return dict(e)
    return None


def assign_ticket(tenant_id: str, ticket_key: str, assignee: str) -> dict:
    """Returns the updated ticket. Raises ValueError with a human-readable
    message on unknown ticket/employee — the agent relays it verbatim."""
    employee = find_employee(tenant_id, assignee)
    if employee is None:
        names = ", ".join(e["name"] for e in tenant_state(tenant_id)["employees"])
        raise ValueError(f"No employee matching '{assignee}'. Team members: {names}.")

    needle = ticket_key.strip().lower()
    with _lock:
        for t in _tenants[tenant_id]["tickets"]:
            if needle in (t["key"].lower(), t["id"].lower()) or needle in t["key"].lower():
                t["assignee"] = employee["name"]
                if t["status"] == "open":
                    t["status"] = "in_progress"
                t["updated_at"] = _now()
                return dict(t)
    raise ValueError(
        f"No ticket matching '{ticket_key}'. Try the ticket key, e.g. 'login-bug'."
    )


def analytics(tenant_id: str, employee: str | None = None) -> list[dict]:
    """Workload metrics per employee, computed from the ticket store plus a
    seeded 'historical' resolution figure (it's a prop)."""
    state = tenant_state(tenant_id)
    people = state["employees"]
    if employee:
        found = find_employee(tenant_id, employee)
        if found is None:
            names = ", ".join(e["name"] for e in people)
            raise ValueError(f"No employee matching '{employee}'. Team members: {names}.")
        people = [found]

    out = []
    for i, person in enumerate(people):
        mine = [t for t in state["tickets"] if t["assignee"] == person["name"]]
        out.append(
            {
                "name": person["name"],
                "title": person["title"],
                "open": sum(1 for t in mine if t["status"] == "open"),
                "in_progress": sum(1 for t in mine if t["status"] == "in_progress"),
                "closed_this_month": sum(1 for t in mine if t["status"] == "closed") + 2 + i,
                "avg_resolution_hours": [18, 26, 31][i % 3],
            }
        )
    return out


def reset(tenant_id: str) -> None:
    with _lock:
        _tenants.pop(tenant_id, None)
