"""Phase 8 — hybrid retrieval, reflection, and both kinds of memory.

Real logic, sealed seams: BM25+RRF run for real over SQLite chunks; the
reflection cap runs on the REAL compiled graph; extraction/summary run with
a scripted haiku.
"""

from __future__ import annotations

import uuid

import pytest
from langchain_core.messages import AIMessage

from app import db as app_db
from app.config import get_settings
from app.models import Chunk, Conversation, Document, Memory, Message
from app.services import agent, chat, memory
from app.services import vectorstore
from tests.conftest import auth_header, signup
from tests.test_agent import FakeChat, tool_call


def seed_user(client):
    a = signup(client, "Memory Co", "M", "m@memory-co.example").json()
    return a, auth_header(a["access_token"])


def make_chunks(tenant_id, texts):
    session = app_db.SessionLocal()
    try:
        doc = Document(
            tenant_id=tenant_id, title="ops-runbook", source_type="pdf", status="ready"
        )
        session.add(doc)
        session.flush()
        rows = [
            Chunk(
                tenant_id=tenant_id,
                document_id=doc.id,
                chunk_index=i,
                page=i + 1,
                text=t,
                content_sha=f"sha-{i}",
            )
            for i, t in enumerate(texts)
        ]
        session.add_all(rows)
        session.commit()
        return doc, rows
    finally:
        session.close()


# ── hybrid retrieval ─────────────────────────────────────────────────────────


def test_bm25_plus_rrf_finds_exact_token_dense_missed(client, monkeypatch):
    """The guide's done-when: 'ERR_4021 finds the exact doc'. Dense retrieval
    (faked) misses the chunk entirely; the BM25 leg must surface it."""
    a, h = seed_user(client)
    tenant_id = uuid.UUID(a["tenant"]["id"])
    filler = [f"General policy paragraph number {i} about leave and travel." for i in range(20)]
    err_text = "ERR_4021 is raised when the payment gateway rejects a stored card."
    doc, rows = make_chunks(tenant_id, filler + [err_text])
    err_id = str(rows[-1].id)

    dense_ids = [str(r.id) for r in rows[:10]]  # dense finds only filler

    class FakeIndex:
        def query(self, **kw):
            return {
                "matches": [
                    {"id": cid, "score": 0.5 - i * 0.01, "metadata": {}}
                    for i, cid in enumerate(dense_ids)
                ]
            }

    monkeypatch.setattr(vectorstore, "get_index", lambda: FakeIndex())
    monkeypatch.setattr(
        "app.services.chat.embeddings.embed_raw", lambda texts: [[0.0] * 384]
    )

    session = app_db.SessionLocal()
    try:
        sources = chat.retrieve(session, tenant_id, "what causes ERR_4021?")
    finally:
        session.close()

    texts = [s.text for s in sources]
    assert any("ERR_4021" in t for t in texts), texts
    assert [s.n for s in sources] == list(range(1, len(sources) + 1))


def test_retrieval_isolated_per_tenant(client, monkeypatch):
    a, _ = seed_user(client)
    b = signup(client, "Other Co", "O", "o@other-co.example").json()
    tenant_b = uuid.UUID(b["tenant"]["id"])
    make_chunks(uuid.UUID(a["tenant"]["id"]), ["Secret alpha document text."])

    class EmptyIndex:
        def query(self, **kw):
            assert kw["namespace"] == str(tenant_b)  # namespace from caller only
            return {"matches": []}

    monkeypatch.setattr(vectorstore, "get_index", lambda: EmptyIndex())
    monkeypatch.setattr(
        "app.services.chat.embeddings.embed_raw", lambda texts: [[0.0] * 384]
    )
    session = app_db.SessionLocal()
    try:
        # BM25 runs over tenant_b's chunks only — none exist → no leak from A.
        assert chat.retrieve(session, tenant_b, "secret alpha") == []
    finally:
        session.close()


def test_rrf_merge_prefers_agreement():
    merged = agent  # silence linter on unused import pattern
    out = chat._rrf_merge([["a", "b", "c"], ["b", "d"]], k=60)
    assert out[0] == "b"  # ranked by both lists


# ── reflection ───────────────────────────────────────────────────────────────


@pytest.fixture
def reflect_graph(monkeypatch):
    monkeypatch.setattr(agent, "ChatAnthropic", FakeChat)
    monkeypatch.setattr(
        agent,
        "_run_knowledge",
        lambda tenant_id, query, start_n: (
            f"[{start_n}] leave is 25 days",
            [{"n": start_n, "document_id": "d", "title": "hb", "page": 1,
              "text": "leave is 25 days", "score": 0.6,
              "source_type": "pdf", "source_url": None}],
        ),
    )
    agent._graph = None
    FakeChat.calls = 0
    yield
    agent._graph = None


def run_graph(state):
    events = {"trace": [], "resets": 0}
    final = None
    for mode, payload in agent.get_graph().stream(state, stream_mode=["custom", "values"]):
        if mode == "custom":
            if "trace" in payload:
                events["trace"].append(payload["trace"])
            if payload.get("reset"):
                events["resets"] += 1
        else:
            final = payload
    return events, final


def test_reflection_rewrites_once_then_ships(reflect_graph, monkeypatch):
    critiques = []

    def fake_critique(draft, sources, question):
        critiques.append(draft)
        return (False, "The 30-day figure is not in the sources.")

    monkeypatch.setattr(agent, "critique", fake_critique)
    FakeChat.script = [
        AIMessage(content="", tool_calls=[tool_call("search_knowledge", "leave", "t1")]),
        AIMessage(content="You get 30 days [1]."),  # bad draft
        AIMessage(content="You get 25 days [1]."),  # rewrite
    ]
    state = agent.initial_state(uuid.uuid4(), "how much leave?", [])
    events, final = run_graph(state)

    assert events["resets"] == 1
    kinds = [t["kind"] for t in events["trace"]]
    assert "reflection" in kinds
    # Even though the critic would still say no, the 2nd draft ships: the
    # critic examined exactly ONE draft (the cap, from the drafts gate).
    assert len(critiques) == 1
    assert final["drafts"] == 1
    assert final["messages"][-1].content == "You get 25 days [1]."


def test_reflection_clean_pass_adds_no_noise(reflect_graph, monkeypatch):
    monkeypatch.setattr(agent, "critique", lambda *a: (True, ""))
    FakeChat.script = [
        AIMessage(content="", tool_calls=[tool_call("search_knowledge", "leave", "t1")]),
        AIMessage(content="You get 25 days [1]."),
    ]
    events, final = run_graph(agent.initial_state(uuid.uuid4(), "leave?", []))
    assert events["resets"] == 0
    assert "reflection" not in [t["kind"] for t in events["trace"]]
    assert final["drafts"] == 1


def test_reflection_skipped_without_sources(reflect_graph, monkeypatch):
    called = []
    monkeypatch.setattr(agent, "critique", lambda *a: called.append(1) or (True, ""))
    FakeChat.script = [AIMessage(content="Hello!")]
    events, final = run_graph(agent.initial_state(uuid.uuid4(), "hi", []))
    assert called == []  # nothing to ground against → no critic call


# ── long-term memory ─────────────────────────────────────────────────────────


def test_extract_store_dedupe_and_recall_gate(client, monkeypatch):
    a, _ = seed_user(client)
    tenant_id = uuid.UUID(a["tenant"]["id"])
    user_id = uuid.UUID(a["user"]["id"])

    monkeypatch.setattr(memory, "haiku", lambda *a, **k: '["The user\'s name is Alex."]')
    monkeypatch.setattr(
        "app.services.memory.embeddings.embed_raw", lambda texts: [[0.1] * 384 for _ in texts]
    )
    upserts = []
    monkeypatch.setattr(
        "app.services.memory.vectorstore.upsert", lambda ns, vecs: upserts.append((ns, vecs))
    )

    session = app_db.SessionLocal()
    try:
        n = memory.extract_and_store(session, tenant_id, user_id, uuid.uuid4(), "I'm Alex", "Hi Alex!")
        assert n == 1
        ns, vecs = upserts[0]
        assert ns == f"{tenant_id}-mem"
        assert vecs[0]["metadata"]["user_id"] == str(user_id)
        # same fact again → deduped
        assert memory.extract_and_store(session, tenant_id, user_id, uuid.uuid4(), "I'm Alex", "Hi!") == 0
    finally:
        session.close()

    # recall applies the score gate
    class MemIndex:
        def query(self, **kw):
            assert kw["namespace"] == f"{tenant_id}-mem"
            assert kw["filter"] == {"user_id": str(user_id)}
            return {"matches": [
                {"id": "1", "score": 0.9, "metadata": {"content": "The user's name is Alex."}},
                {"id": "2", "score": 0.1, "metadata": {"content": "noise"}},
            ]}

    monkeypatch.setattr(vectorstore, "get_index", lambda: MemIndex())
    monkeypatch.setattr(
        "app.services.memory.embeddings.embed_raw", lambda texts: [[0.1] * 384]
    )
    assert memory.recall(tenant_id, user_id, "what's my name?") == [
        "The user's name is Alex."
    ]


def test_extraction_usually_returns_nothing(client, monkeypatch):
    a, _ = seed_user(client)
    monkeypatch.setattr(memory, "haiku", lambda *a, **k: "[]")
    session = app_db.SessionLocal()
    try:
        assert (
            memory.extract_and_store(
                session, uuid.UUID(a["tenant"]["id"]), uuid.UUID(a["user"]["id"]),
                uuid.uuid4(), "How many leave days?", "25 days [1].",
            )
            == 0
        )
    finally:
        session.close()


def test_memories_endpoints_scoped_and_delete(client, monkeypatch):
    a, ha = seed_user(client)
    b = signup(client, "Other Co2", "O", "o@other-co2.example").json()
    hb = auth_header(b["access_token"])

    session = app_db.SessionLocal()
    row = Memory(
        tenant_id=uuid.UUID(a["tenant"]["id"]),
        user_id=uuid.UUID(a["user"]["id"]),
        content="The user's name is Alex.",
    )
    session.add(row)
    session.commit()
    mem_id = str(row.id)
    session.close()

    assert [m["content"] for m in client.get("/memories", headers=ha).json()] == [
        "The user's name is Alex."
    ]
    assert client.get("/memories", headers=hb).json() == []  # not yours
    assert client.delete(f"/memories/{mem_id}", headers=hb).status_code == 404

    deleted = []
    monkeypatch.setattr(
        "app.services.memory.vectorstore.delete_ids", lambda ns, ids: deleted.append((ns, ids))
    )
    assert client.delete(f"/memories/{mem_id}", headers=ha).status_code == 204
    assert deleted and deleted[0][1] == [mem_id]
    assert client.get("/memories", headers=ha).json() == []


# ── short-term summary ───────────────────────────────────────────────────────


def test_summary_updates_once_window_overflows(client, monkeypatch):
    a, _ = seed_user(client)
    tenant_id = uuid.UUID(a["tenant"]["id"])
    session = app_db.SessionLocal()
    convo = Conversation(tenant_id=tenant_id, user_id=uuid.UUID(a["user"]["id"]))
    session.add(convo)
    session.flush()
    for i in range(4):  # 4 <= window (6): nothing to summarize
        session.add(Message(conversation_id=convo.id, tenant_id=tenant_id,
                            role="user" if i % 2 == 0 else "assistant",
                            seq=i + 1, content=f"turn {i}"))
    session.commit()

    monkeypatch.setattr(memory, "haiku", lambda *a, **k: "People discussed turns.")
    assert memory.maybe_update_summary(session, convo.id) is False

    for i in range(4, 10):
        session.add(Message(conversation_id=convo.id, tenant_id=tenant_id,
                            role="user" if i % 2 == 0 else "assistant",
                            seq=i + 1, content=f"turn {i}"))
    session.commit()
    assert memory.maybe_update_summary(session, convo.id) is True
    session.refresh(convo)
    assert convo.summary == "People discussed turns."
    session.close()


def test_system_prompt_carries_memory_and_summary():
    p = agent.system_prompt(
        "employee", False, summary="Earlier: leave discussion.",
        memories=["The user's name is Alex."],
    )
    assert "Earlier: leave discussion." in p
    assert "The user's name is Alex." in p
    assert "do not recite" in p
