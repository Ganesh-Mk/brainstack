"""The LangGraph agent loop, driven by a scripted fake model.

The REAL compiled graph runs (nodes, edges, stream writer, caps); only
ChatAnthropic and the two tool implementations are replaced. This pins the
loop mechanics: routing, source accumulation/renumbering, the step cap.
"""

from __future__ import annotations

import pytest
from langchain_core.messages import AIMessage

from app.services import agent


class FakeChat:
    """Yields scripted AIMessages, one per agent-node invocation."""

    script: list[AIMessage] = []
    calls: int = 0

    def __init__(self, **kwargs):
        pass

    def bind_tools(self, tools):
        return self

    def invoke(self, messages):
        template = FakeChat.script[min(FakeChat.calls, len(FakeChat.script) - 1)]
        FakeChat.calls += 1
        # Fresh instance per call — LangGraph's add_messages dedupes by message
        # id, so returning the same object twice would REPLACE, not append.
        return AIMessage(
            content=template.content,
            tool_calls=[
                {**tc, "id": f"{tc['id']}-{FakeChat.calls}"}
                for tc in template.tool_calls
            ],
        )


def tool_call(name: str, query: str, call_id: str) -> dict:
    return {"name": name, "args": {"query": query}, "id": call_id, "type": "tool_call"}


@pytest.fixture
def fake_agent(monkeypatch):
    monkeypatch.setattr(agent, "ChatAnthropic", FakeChat)
    monkeypatch.setattr(
        agent,
        "_run_knowledge",
        lambda tenant_id, query, start_n: (
            f"[{start_n}] (handbook, p.2) leave is 25 days",
            [
                {
                    "n": start_n,
                    "document_id": "d1",
                    "title": "handbook",
                    "page": 2,
                    "text": "leave is 25 days",
                    "score": 0.6,
                    "source_type": "pdf",
                    "source_url": None,
                }
            ],
        ),
    )
    monkeypatch.setattr(
        agent,
        "_run_web",
        lambda query, start_n: (
            f"[{start_n}] (web) industry norm is 20 days",
            [
                {
                    "n": start_n,
                    "document_id": "",
                    "title": "Industry norms",
                    "page": 1,
                    "text": "industry norm is 20 days",
                    "score": 0.5,
                    "source_type": "web",
                    "source_url": "https://example.com/norms",
                }
            ],
        ),
    )
    agent._graph = None  # rebuild with the fakes
    FakeChat.calls = 0
    yield
    agent._graph = None


def run_graph(question="q"):
    state = agent.initial_state(
        tenant_id=__import__("uuid").uuid4(), question=question, history=[]
    )
    events = {"trace": [], "sources": []}
    final = None
    for mode, payload in agent.get_graph().stream(
        state, stream_mode=["custom", "values"]
    ):
        if mode == "custom":
            if "trace" in payload:
                events["trace"].append(payload["trace"])
            if "sources" in payload:
                events["sources"] = payload["sources"]
        else:
            final = payload
    return events, final


def test_knowledge_only_path(fake_agent):
    FakeChat.script = [
        AIMessage(content="", tool_calls=[tool_call("search_knowledge", "leave", "t1")]),
        AIMessage(content="You get 25 days [1]."),
    ]
    events, final = run_graph()
    kinds = [t["kind"] for t in events["trace"]]
    assert kinds == ["planning", "knowledge", "planning"]
    assert [s["source_type"] for s in events["sources"]] == ["pdf"]
    assert final["steps_used"] == 1


def test_both_tools_accumulate_and_renumber(fake_agent):
    FakeChat.script = [
        AIMessage(
            content="",
            tool_calls=[
                tool_call("search_knowledge", "our policy", "t1"),
                tool_call("web_search", "industry policy", "t2"),
            ],
        ),
        AIMessage(content="Ours is 25 [1]; industry is 20 [2]."),
    ]
    events, final = run_graph()
    assert [s["n"] for s in events["sources"]] == [1, 2]  # contiguous across tools
    assert [s["source_type"] for s in events["sources"]] == ["pdf", "web"]
    kinds = [t["kind"] for t in events["trace"]]
    assert kinds == ["planning", "knowledge", "web", "planning"]
    assert final["steps_used"] == 2


def test_step_cap_stops_a_runaway_loop(fake_agent):
    # The model ALWAYS asks for another search; the cap must end it.
    FakeChat.script = [
        AIMessage(content="", tool_calls=[tool_call("search_knowledge", "again", "t")]),
    ]
    events, final = run_graph()
    from app.config import get_settings

    assert final["steps_used"] == get_settings().AGENT_MAX_STEPS
    # After the cap, route() returns END even though tool_calls are pending.
    assert FakeChat.calls == get_settings().AGENT_MAX_STEPS + 1


def test_no_tools_direct_answer(fake_agent):
    FakeChat.script = [AIMessage(content="Hello! How can I help?")]
    events, final = run_graph("hi")
    assert [t["kind"] for t in events["trace"]] == ["planning"]
    assert events["sources"] == []
    assert final["steps_used"] == 0
