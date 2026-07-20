"""Phase 9 — query traces on every ask, stats endpoints, judge mechanics."""

from __future__ import annotations

import uuid

from app import db as app_db
from app.models import EvalRun, QueryTrace
from app.routers.stats import _pct
from app.services import evaluation
from tests.conftest import auth_header, signup
from tests.test_chat import ask, make_convo, mock_answer  # noqa: F401
from tests.test_documents import fakes  # noqa: F401


def test_ask_writes_a_query_trace(client, mock_answer):  # noqa: F811
    a = signup(client, "Trace Co", "T", "t@trace-co.example").json()
    convo = make_convo(client, a["access_token"])
    r = ask(client, a["access_token"], convo)
    assert r.status_code == 200

    session = app_db.SessionLocal()
    try:
        rows = list(session.query(QueryTrace).all())
    finally:
        session.close()
    assert len(rows) == 1
    t = rows[0]
    assert t.status == "ok"
    assert t.tenant_id == uuid.UUID(a["tenant"]["id"])
    assert t.question == "How many leave days do I get?"
    assert t.latency_ms >= 0
    assert "knowledge" in t.tool_kinds
    assert t.source_count == len(mock_answer["state"]["sources"]) or t.source_count >= 1


def test_failed_ask_writes_error_trace(client, monkeypatch):
    from app.services import agent as agent_service

    def broken():
        raise RuntimeError("model exploded")

    monkeypatch.setattr(agent_service, "get_graph", broken)
    a = signup(client, "Err Co", "E", "e@err-co.example").json()
    convo = make_convo(client, a["access_token"])
    r = ask(client, a["access_token"], convo)
    assert r.status_code == 200  # SSE stream carries the error event

    session = app_db.SessionLocal()
    try:
        t = session.query(QueryTrace).one()
        assert t.status == "error"
    finally:
        session.close()


def test_dashboard_open_to_all_roles_and_scoped(client, mock_answer):  # noqa: F811
    a = signup(client, "Dash Co", "D", "d@dash-co.example").json()
    convo = make_convo(client, a["access_token"])
    ask(client, a["access_token"], convo)

    invite = client.post(
        "/auth/invites",
        headers=auth_header(a["access_token"]),
        json={"email": "emp@dash-co.example", "role": "employee"},
    ).json()
    emp = client.post(
        f"/auth/invites/{invite['token']}/accept",
        json={"name": "Emp", "password": "password123"},
    ).json()

    r = client.get("/stats/dashboard", headers=auth_header(emp["access_token"]))
    assert r.status_code == 200  # dashboard is for everyone
    body = r.json()
    assert body["questions_asked"] == 1
    assert body["tool_usage"]["knowledge"] == 1

    # a different tenant sees zeros — scoping via get_current_user only
    b = signup(client, "Dash Co B", "B", "b@dash-co-b.example").json()
    assert (
        client.get("/stats/dashboard", headers=auth_header(b["access_token"])).json()[
            "questions_asked"
        ]
        == 0
    )


def test_admin_only_stats_endpoints(client, mock_answer):  # noqa: F811
    a = signup(client, "Gate Co", "G", "g@gate-co.example").json()
    convo = make_convo(client, a["access_token"])
    ask(client, a["access_token"], convo)
    invite = client.post(
        "/auth/invites",
        headers=auth_header(a["access_token"]),
        json={"email": "emp@gate-co.example", "role": "manager"},
    ).json()
    mgr = client.post(
        f"/auth/invites/{invite['token']}/accept",
        json={"name": "M", "password": "password123"},
    ).json()

    for path in ("/stats/analytics", "/stats/traces", "/stats/evals"):
        assert client.get(path, headers=auth_header(mgr["access_token"])).status_code == 403
        assert client.get(path, headers=auth_header(a["access_token"])).status_code == 200

    body = client.get("/stats/analytics", headers=auth_header(a["access_token"])).json()
    assert body["totals"]["questions"] == 1
    assert body["latency_ms"]["p50"] is not None
    assert body["top_questions"][0]["question"].startswith("How many leave days")

    tr = client.get("/stats/traces", headers=auth_header(a["access_token"])).json()
    assert len(tr["traces"]) == 1 and tr["traces"][0]["status"] == "ok"


def test_evals_endpoint_lists_runs(client):
    a = signup(client, "Eval Co", "E", "e@eval-co.example").json()
    session = app_db.SessionLocal()
    session.add(
        EvalRun(
            dataset_size=22, faithfulness=0.91, relevance=0.95,
            retrieval_hit=0.86, citation_validity=1.0, model="claude-haiku-4-5",
        )
    )
    session.commit()
    session.close()
    runs = client.get("/stats/evals", headers=auth_header(a["access_token"])).json()["runs"]
    assert runs[0]["faithfulness"] == 0.91 and runs[0]["dataset_size"] == 22


# ── deterministic metric mechanics ───────────────────────────────────────────


def test_percentiles():
    assert _pct([], 0.5) is None
    assert _pct([100], 0.95) == 100
    assert _pct(list(range(0, 101)), 0.50) == 50  # odd count → exact rank
    assert _pct(list(range(0, 101)), 0.95) == 95


def test_retrieval_hit_supports_alternatives():
    sources = [{"n": 1, "text": "Leave does not roll over into the next year."}]
    assert evaluation.retrieval_hit(sources, ["not roll over | does not roll"])
    assert not evaluation.retrieval_hit(sources, ["cryptocurrency"])
    assert evaluation.retrieval_hit(sources, [])  # nothing expected


def test_citation_validity():
    sources = [{"n": 1, "text": "a"}, {"n": 2, "text": "b"}]
    assert evaluation.citation_validity("Fine [1][2].", sources)
    assert not evaluation.citation_validity("Fine [3].", sources)
    assert evaluation.citation_validity("No citations at all.", sources)


def test_refusal_detector():
    assert evaluation.is_refusal("I don't know — that isn't covered in this workspace's documents.")
    assert not evaluation.is_refusal("You get 25 days [1].")
