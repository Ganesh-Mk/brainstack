"""Phase 10 — rate limiting, member management, prompt-cache structure,
ingestion dispatch."""

from __future__ import annotations

import uuid

from app.config import get_settings
from app.core import ratelimit
from app.services import agent
from tests.conftest import auth_header, signup
from tests.test_chat import make_convo, mock_answer  # noqa: F401
from tests.test_documents import fakes  # noqa: F401


class FakeRedis:
    def __init__(self):
        self.counts: dict[str, int] = {}

    def incr(self, key):
        self.counts[key] = self.counts.get(key, 0) + 1
        return self.counts[key]

    def expire(self, key, ttl):
        pass


def ask(client, token, convo_id):
    return client.post(
        f"/conversations/{convo_id}/messages",
        headers=auth_header(token),
        json={"content": "hi"},
    )


def test_rate_limit_per_tenant(client, mock_answer, monkeypatch):  # noqa: F811
    fake = FakeRedis()
    monkeypatch.setattr(ratelimit, "_redis", lambda: fake)
    monkeypatch.setattr(get_settings(), "RATE_LIMIT_ASKS_PER_HOUR", 2)

    a = signup(client, "RL Co", "A", "a@rl-co.example").json()
    convo = make_convo(client, a["access_token"])
    assert ask(client, a["access_token"], convo).status_code == 200
    assert ask(client, a["access_token"], convo).status_code == 200
    r = ask(client, a["access_token"], convo)
    assert r.status_code == 429
    assert "resets in" in r.json()["detail"]

    # a different tenant has its own budget
    b = signup(client, "RL Co B", "B", "b@rl-co-b.example").json()
    convo_b = make_convo(client, b["access_token"])
    assert ask(client, b["access_token"], convo_b).status_code == 200


def test_rate_limit_noop_without_redis(client, mock_answer, monkeypatch):  # noqa: F811
    monkeypatch.setattr(ratelimit, "_redis", lambda: None)
    monkeypatch.setattr(get_settings(), "RATE_LIMIT_ASKS_PER_HOUR", 1)
    a = signup(client, "RL Co C", "C", "c@rl-co-c.example").json()
    convo = make_convo(client, a["access_token"])
    for _ in range(3):  # over the limit, but no Redis → allowed
        assert ask(client, a["access_token"], convo).status_code == 200


# ── members & workspace ──────────────────────────────────────────────────────


def seed_team(client):
    a = signup(client, "Team Co", "Admin", "admin@team-co.example").json()
    ha = auth_header(a["access_token"])
    invite = client.post(
        "/auth/invites", headers=ha,
        json={"email": "emp@team-co.example", "role": "employee"},
    ).json()
    emp = client.post(
        f"/auth/invites/{invite['token']}/accept",
        json={"name": "Emp", "password": "password123"},
    ).json()
    return a, ha, emp


def test_member_lifecycle(client):
    a, ha, emp = seed_team(client)

    members = client.get("/auth/members", headers=ha).json()
    assert [m["role"] for m in members] == ["admin", "employee"]

    # employees can't see the member list
    he = auth_header(emp["access_token"])
    assert client.get("/auth/members", headers=he).status_code == 403

    # promote employee → manager
    emp_id = emp["user"]["id"]
    r = client.patch(f"/auth/members/{emp_id}", headers=ha, json={"role": "manager"})
    assert r.status_code == 200 and r.json()["role"] == "manager"

    # guards: not your own role, not yourself
    my_id = a["user"]["id"]
    assert client.patch(f"/auth/members/{my_id}", headers=ha, json={"role": "employee"}).status_code == 400
    assert client.delete(f"/auth/members/{my_id}", headers=ha).status_code == 400

    # cross-tenant member ids are 404, not 403 (no existence leak)
    other = signup(client, "Team Co B", "O", "o@team-co-b.example").json()
    assert (
        client.patch(
            f"/auth/members/{emp_id}",
            headers=auth_header(other["access_token"]),
            json={"role": "admin"},
        ).status_code
        == 404
    )

    # remove the member
    assert client.delete(f"/auth/members/{emp_id}", headers=ha).status_code == 204
    assert len(client.get("/auth/members", headers=ha).json()) == 1


def test_workspace_rename(client):
    a, ha, _ = seed_team(client)
    r = client.patch("/auth/tenant", headers=ha, json={"name": "Renamed Studio"})
    assert r.status_code == 200 and r.json()["name"] == "Renamed Studio"
    assert client.get("/auth/me", headers=ha).json()["tenant"]["name"] == "Renamed Studio"


# ── prompt caching ───────────────────────────────────────────────────────────


def test_prompt_cache_marks_static_prefix(monkeypatch):
    monkeypatch.setattr(get_settings(), "PROMPT_CACHE_ENABLED", True)
    state = agent.initial_state(
        uuid.uuid4(), "q", [], role="employee",
        summary="Earlier talk.", memories=["The user's name is Alex."],
    )
    content = state["messages"][0].content
    assert isinstance(content, list) and len(content) == 2
    assert content[0]["cache_control"] == {"type": "ephemeral"}
    assert "BrainStack" in content[0]["text"]  # static half
    assert "Alex" in content[1]["text"] and "cache_control" not in content[1]

    monkeypatch.setattr(get_settings(), "PROMPT_CACHE_ENABLED", False)
    state = agent.initial_state(uuid.uuid4(), "q", [], role="employee")
    assert isinstance(state["messages"][0].content, str)


# ── ingestion dispatch ───────────────────────────────────────────────────────


def test_celery_dispatch_switch(client, fakes, monkeypatch):  # noqa: F811
    from tests.test_documents import MINIMAL_PDF

    sent = []

    class FakeTask:
        @staticmethod
        def delay(doc_id):
            sent.append(doc_id)

    import app.worker

    monkeypatch.setattr(app.worker, "ingest_document", FakeTask)
    monkeypatch.setattr(get_settings(), "INGEST_MODE", "celery")

    a = signup(client, "Celery Co", "C", "c@celery-co.example").json()
    r = client.post(
        "/documents",
        headers=auth_header(a["access_token"]),
        files={"file": ("x.pdf", MINIMAL_PDF, "application/pdf")},
    )
    assert r.status_code == 202
    assert sent == [r.json()["id"]]  # queued to celery, not BackgroundTasks
