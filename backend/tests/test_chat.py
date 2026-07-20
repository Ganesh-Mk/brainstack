"""Conversations + grounded-answer stream tests.

Claude is mocked at the chat-service seam (stream_answer / retrieve), so the
suite is hermetic; the SSE protocol, persistence rules, isolation, and the
failure contract all run for real.
"""

from __future__ import annotations

import io
import json

import pytest

from app.routers import conversations as convo_router
from app.services import chat as chat_service
from tests.conftest import auth_header, signup
from tests.test_documents import MINIMAL_PDF, fakes, upload_pdf  # noqa: F401

FAKE_SOURCES = [
    chat_service.Source(
        n=1,
        document_id="00000000-0000-0000-0000-000000000001",
        title="handbook",
        page=2,
        text="Every employee receives 25 days of paid annual leave per year.",
        score=0.61,
    )
]


def parse_sse(body: str) -> list[tuple[str, object]]:
    events = []
    for frame in body.strip().split("\n\n"):
        lines = frame.strip().split("\n")
        event = next(l[7:] for l in lines if l.startswith("event: "))
        data = json.loads(next(l[6:] for l in lines if l.startswith("data: ")))
        events.append((event, data))
    return events


@pytest.fixture
def admin(client, fakes):  # noqa: F811 — fakes patches storage/vectors
    return signup(client, "Company A", "Ada", "ada@company-a.com").json()


@pytest.fixture
def mock_answer(monkeypatch):
    """Patch retrieval + the model stream with deterministic fakes."""
    monkeypatch.setattr(
        chat_service, "retrieve", lambda db, tenant_id, q: list(FAKE_SOURCES)
    )

    captured: dict = {}

    def fake_stream(question, sources, history=()):
        captured["question"] = question
        captured["history"] = list(history)
        yield "You get **25 days** of leave "
        yield "[1]."

    monkeypatch.setattr(chat_service, "stream_answer", fake_stream)
    return captured


def make_convo(client, token) -> str:
    r = client.post("/conversations", headers=auth_header(token))
    assert r.status_code == 201
    return r.json()["id"]


def ask(client, token, convo_id, content="How many leave days do I get?"):
    return client.post(
        f"/conversations/{convo_id}/messages",
        headers=auth_header(token),
        json={"content": content},
    )


# ─────────────────────────────────────────────────────────────────────────────


def test_full_ask_flow(client, admin, mock_answer):
    upload_pdf(client, admin["access_token"])  # a ready document must exist
    convo_id = make_convo(client, admin["access_token"])

    r = ask(client, admin["access_token"], convo_id)
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/event-stream")

    events = parse_sse(r.text)
    kinds = [e for e, _ in events]
    assert kinds[0] == "sources", "sources must arrive before any token"
    assert "delta" in kinds and kinds[-1] == "done"
    assert kinds.count("error") == 0

    sources = events[0][1]
    assert sources[0]["n"] == 1 and sources[0]["page"] == 2

    text = "".join(d["text"] for e, d in events if e == "delta")
    assert "25 days" in text and "[1]" in text

    # Persisted: both messages, sources on the assistant, title from question.
    detail = client.get(
        f"/conversations/{convo_id}", headers=auth_header(admin["access_token"])
    ).json()
    assert [m["role"] for m in detail["messages"]] == ["user", "assistant"]
    assert detail["messages"][1]["sources"][0]["title"] == "handbook"
    assert detail["title"].startswith("How many leave days")
    assert detail["question_count"] == 1


def test_history_flows_into_prompt(client, admin, mock_answer):
    upload_pdf(client, admin["access_token"])
    convo_id = make_convo(client, admin["access_token"])
    ask(client, admin["access_token"], convo_id, "First question?")
    ask(client, admin["access_token"], convo_id, "And a follow-up?")
    assert mock_answer["question"] == "And a follow-up?"
    roles = [m["role"] for m in mock_answer["history"]]
    assert roles == ["user", "assistant"], "prior turn should be in history"


def test_empty_library_short_circuits(client, admin, mock_answer, monkeypatch):
    """No ready documents -> friendly reply, and the model is NEVER called."""
    def explode(*a, **k):
        raise AssertionError("model must not be called with an empty library")

    monkeypatch.setattr(chat_service, "stream_answer", explode)
    convo_id = make_convo(client, admin["access_token"])
    events = parse_sse(ask(client, admin["access_token"], convo_id).text)
    assert events[0] == ("sources", [])
    text = "".join(d["text"] for e, d in events if e == "delta")
    assert "no indexed documents" in text
    assert events[-1][0] == "done"


def test_midstream_failure_persists_nothing(client, admin, mock_answer, monkeypatch):
    upload_pdf(client, admin["access_token"])
    convo_id = make_convo(client, admin["access_token"])

    def broken_stream(question, sources, history=()):
        yield "The answer is"
        raise RuntimeError("model blew up")

    monkeypatch.setattr(chat_service, "stream_answer", broken_stream)
    events = parse_sse(ask(client, admin["access_token"], convo_id).text)
    assert events[-1][0] == "error"
    assert "Nothing was saved" in events[-1][1]["detail"]

    detail = client.get(
        f"/conversations/{convo_id}", headers=auth_header(admin["access_token"])
    ).json()
    assert detail["messages"] == []  # no half-answers, no orphaned question


def test_not_configured_yields_clear_error(client, admin, mock_answer, monkeypatch):
    upload_pdf(client, admin["access_token"])
    convo_id = make_convo(client, admin["access_token"])

    def unconfigured(question, sources, history=()):
        raise chat_service.ChatNotConfigured("The answer model is not configured.")
        yield  # pragma: no cover

    monkeypatch.setattr(chat_service, "stream_answer", unconfigured)
    events = parse_sse(ask(client, admin["access_token"], convo_id).text)
    assert events[-1][0] == "error"
    assert "not configured" in events[-1][1]["detail"]


def test_validation(client, admin, mock_answer):
    convo_id = make_convo(client, admin["access_token"])
    r = client.post(
        f"/conversations/{convo_id}/messages",
        headers=auth_header(admin["access_token"]),
        json={"content": "   "},
    )
    assert r.status_code == 422
    r = client.post(
        f"/conversations/{convo_id}/messages",
        headers=auth_header(admin["access_token"]),
        json={"content": "x" * 5000},
    )
    assert r.status_code == 422


def test_isolation_between_users_and_tenants(client, fakes, mock_answer):  # noqa: F811
    a = signup(client, "Company A", "Ada", "ada@company-a.com").json()
    b = signup(client, "Company B", "Gil", "gil@company-b.com").json()
    convo_id = make_convo(client, a["access_token"])

    # Another tenant: list empty, direct access 404 (get/delete/ask).
    assert (
        client.get("/conversations", headers=auth_header(b["access_token"])).json()
        == []
    )
    for method, path in [
        ("get", f"/conversations/{convo_id}"),
        ("delete", f"/conversations/{convo_id}"),
    ]:
        assert (
            getattr(client, method)(path, headers=auth_header(b["access_token"]))
        ).status_code == 404
    assert ask(client, b["access_token"], convo_id).status_code == 404

    # Another USER in the SAME tenant: also invisible (conversations are personal).
    invite = client.post(
        "/auth/invites",
        headers=auth_header(a["access_token"]),
        json={"email": "emp@company-a.com", "role": "employee"},
    ).json()
    emp = client.post(
        f"/auth/invites/{invite['token']}/accept",
        json={"name": "Emp", "password": "password123"},
    ).json()
    assert (
        client.get(
            f"/conversations/{convo_id}", headers=auth_header(emp["access_token"])
        ).status_code
        == 404
    )
    # But employees can create and use their own.
    own = make_convo(client, emp["access_token"])
    assert own != convo_id


def test_delete_conversation_removes_messages(client, admin, mock_answer):
    upload_pdf(client, admin["access_token"])
    convo_id = make_convo(client, admin["access_token"])
    ask(client, admin["access_token"], convo_id)
    r = client.delete(
        f"/conversations/{convo_id}", headers=auth_header(admin["access_token"])
    )
    assert r.status_code == 204
    assert (
        client.get(
            f"/conversations/{convo_id}", headers=auth_header(admin["access_token"])
        ).status_code
        == 404
    )


def test_document_file_endpoint(client, admin, fakes):  # noqa: F811
    doc = upload_pdf(client, admin["access_token"]).json()
    r = client.get(
        f"/documents/{doc['id']}/file", headers=auth_header(admin["access_token"])
    )
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content == MINIMAL_PDF

    b = signup(client, "Company B", "Gil", "gil@company-b.com").json()
    assert (
        client.get(
            f"/documents/{doc['id']}/file", headers=auth_header(b["access_token"])
        ).status_code
        == 404
    )
    assert client.get(f"/documents/{doc['id']}/file").status_code == 401


def test_grounding_prompt_construction():
    """Unit: numbered context + citation-ready formatting."""
    prompt = chat_service.build_user_prompt("What about leave?", FAKE_SOURCES)
    assert "[1] (handbook, p.2)" in prompt
    assert prompt.endswith("Question: What about leave?")
    assert "25 days" in prompt
