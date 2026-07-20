"""Conversations + agent-stream tests.

The agent graph is mocked at the agent.get_graph seam with a scripted event
stream, so the suite is hermetic; the SSE protocol (trace/sources/delta/done),
persistence rules, isolation, and the failure contract all run for real.
"""

from __future__ import annotations

import io
import json

import pytest

from app.routers import conversations as convo_router
from app.services import agent as agent_service
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
FAKE_SOURCE_DICTS = [s.to_dict() for s in FAKE_SOURCES]


class FakeChunk:
    def __init__(self, text):
        self.content = text


class FakeGraph:
    """graph.stream() replacement yielding a scripted event sequence."""

    def __init__(self, script):
        self.script = script

    def stream(self, state, stream_mode=None):
        yield from self.script(state)


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
    """Patch the agent graph with a deterministic scripted run."""
    captured: dict = {}

    def script(state):
        captured["state"] = state
        captured["question"] = state["messages"][-1].content
        captured["history"] = [
            {"role": "user" if m.type == "human" else "assistant", "content": m.content}
            for m in state["messages"][1:-1]
        ]
        yield ("custom", {"trace": {"n": 1, "kind": "planning", "label": "Planning"}})
        yield (
            "custom",
            {
                "trace": {
                    "n": 2,
                    "kind": "knowledge",
                    "label": "Searching knowledge",
                    "detail": "leave days",
                    "ms": 120,
                }
            },
        )
        yield ("custom", {"sources": list(FAKE_SOURCE_DICTS)})
        yield ("messages", (FakeChunk("You get **25 days** of leave "), {"langgraph_node": "agent"}))
        yield ("messages", (FakeChunk("[1]."), {"langgraph_node": "agent"}))

    monkeypatch.setattr(agent_service, "get_graph", lambda: FakeGraph(script))
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
    assert kinds[0] == "trace", "the agent announces planning first"
    assert "sources" in kinds and "delta" in kinds and kinds[-1] == "done"
    assert kinds.index("sources") < kinds.index("delta"), "sources before tokens"
    assert kinds.count("error") == 0

    trace_kinds = [d["kind"] for e, d in events if e == "trace"]
    assert trace_kinds == ["planning", "knowledge", "drafting"]

    sources = next(d for e, d in events if e == "sources")
    assert sources[0]["n"] == 1 and sources[0]["page"] == 2

    text = "".join(d["text"] for e, d in events if e == "delta")
    assert "25 days" in text and "[1]" in text

    # Persisted: both messages, sources on the assistant, title from question.
    detail = client.get(
        f"/conversations/{convo_id}", headers=auth_header(admin["access_token"])
    ).json()
    assert [m["role"] for m in detail["messages"]] == ["user", "assistant"]
    assert detail["messages"][1]["sources"][0]["title"] == "handbook"
    assert [t["kind"] for t in detail["messages"][1]["trace"]] == [
        "planning",
        "knowledge",
        "drafting",
    ], "the trace persists with the answer"
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


def test_web_sources_flow_through(client, admin, monkeypatch):
    """A web-tool run: url-typed sources reach the client and persist."""
    web_source = {
        "n": 1,
        "document_id": "",
        "title": "Industry norms",
        "page": 1,
        "text": "Typical is 20 days.",
        "score": 0.5,
        "source_type": "web",
        "source_url": "https://example.com/norms",
    }

    def script(state):
        yield ("custom", {"trace": {"n": 1, "kind": "planning", "label": "Planning"}})
        yield ("custom", {"trace": {"n": 2, "kind": "web", "label": "Searching the web", "ms": 300}})
        yield ("custom", {"sources": [web_source]})
        yield ("messages", (FakeChunk("Industry norm is 20 days [1]."), {"langgraph_node": "agent"}))

    monkeypatch.setattr(agent_service, "get_graph", lambda: FakeGraph(script))
    convo_id = make_convo(client, admin["access_token"])
    events = parse_sse(ask(client, admin["access_token"], convo_id).text)
    assert events[-1][0] == "done"
    detail = client.get(
        f"/conversations/{convo_id}", headers=auth_header(admin["access_token"])
    ).json()
    persisted = detail["messages"][1]["sources"][0]
    assert persisted["source_type"] == "web"
    assert persisted["source_url"] == "https://example.com/norms"


def test_midstream_failure_persists_nothing(client, admin, mock_answer, monkeypatch):
    upload_pdf(client, admin["access_token"])
    convo_id = make_convo(client, admin["access_token"])

    def script(state):
        yield ("messages", (FakeChunk("The answer is"), {"langgraph_node": "agent"}))
        raise RuntimeError("model blew up")

    monkeypatch.setattr(agent_service, "get_graph", lambda: FakeGraph(script))
    events = parse_sse(ask(client, admin["access_token"], convo_id).text)
    assert events[-1][0] == "error"
    assert "Nothing was saved" in events[-1][1]["detail"]

    detail = client.get(
        f"/conversations/{convo_id}", headers=auth_header(admin["access_token"])
    ).json()
    assert detail["messages"] == []  # no half-answers, no orphaned question


def test_not_configured_yields_clear_error(client, admin, mock_answer, monkeypatch):
    from app.config import get_settings

    upload_pdf(client, admin["access_token"])
    convo_id = make_convo(client, admin["access_token"])
    monkeypatch.setattr(get_settings(), "ANTHROPIC_API_KEY", "")
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
