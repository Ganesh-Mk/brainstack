"""Grounded mode — the LLM_PROVIDER=local path for our fine-tuned model.

The contract under test is not "does it answer" (that needs a real model and
is what eval/run_eval.py measures). It is: does this path emit EXACTLY the
event sequence the agent path emits, so that the frontend, /v1/ask and the
eval harness all keep working without a line of change.

Retrieval and the Ollama stream are the only things faked.
"""

from __future__ import annotations

import uuid

import pytest
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from app.config import get_settings
from app.services import ask, chat, evaluation, grounded, providers
from tests.conftest import auth_header, signup


def _state(question: str = "How many leave days do we get?", history: list | None = None) -> dict:
    """The subset of AgentState that grounded.run() reads."""
    messages = [SystemMessage(content="ignored — grounded mode rebuilds it")]
    messages += history or []
    messages.append(HumanMessage(content=question))
    return {
        "question": question,
        "tenant_id": str(uuid.uuid4()),
        "messages": messages,
    }


def _source(n: int, text: str) -> chat.Source:
    return chat.Source(
        n=n, document_id="d1", title="Handbook", page=2, text=text, score=0.9
    )


@pytest.fixture
def local_provider(monkeypatch):
    monkeypatch.setattr(get_settings(), "LLM_PROVIDER", "local")
    monkeypatch.setattr(get_settings(), "LLM_MODEL_LOCAL", "brainstack-3b")


@pytest.fixture
def fake_retrieval(monkeypatch):
    """Two passages back, as chat.retrieve would return them."""
    monkeypatch.setattr(
        chat,
        "retrieve",
        lambda db, tenant_id, q: [
            _source(1, "Employees get 25 days of paid annual leave."),
            _source(2, "Leave does not roll over."),
        ],
    )


@pytest.fixture
def fake_ollama(monkeypatch):
    def stream(messages):
        stream.messages = messages
        for word in ("Employees get ", "**25 days** ", "[1]."):
            yield ("delta", {"text": word})
        yield ("usage", {"prompt_tokens": 700, "completion_tokens": 12})

    stream.messages = None
    monkeypatch.setattr(grounded, "_stream_completion", stream)
    return stream


def drain(gen):
    """Run a run()-shaped generator to completion → (events, outcome)."""
    events = []
    while True:
        try:
            events.append(next(gen))
        except StopIteration as stop:
            return events, stop.value


# ── the event contract ──────────────────────────────────────────────────────


def test_event_sequence_matches_the_agent_path(local_provider, fake_retrieval, fake_ollama):
    events, outcome = drain(grounded.run(_state()))
    kinds = [e for e, _ in events]

    assert kinds[0] == "trace"  # retrieval step, before anything else
    assert kinds[1] == "sources"  # sources land before the first token
    assert set(kinds[2:-1]) == {"delta"}
    assert kinds[-1] == "trace"  # the closing drafting step

    assert events[0][1]["kind"] == "knowledge"
    assert events[-1][1]["kind"] == "drafting"
    # Trace step numbers are contiguous from 1 — the UI renders them in order.
    assert [t["n"] for e, t in events if e == "trace"] == [1, 2]
    assert outcome.trace == [t for e, t in events if e == "trace"]


def test_outcome_carries_the_local_model_and_zero_cost(
    local_provider, fake_retrieval, fake_ollama
):
    _, outcome = drain(grounded.run(_state()))

    assert outcome.answer == "Employees get **25 days** [1]."
    assert outcome.model == "brainstack-3b"
    # Zero, not None: the run happened and cost nothing. Analytics and the
    # eval comparison both depend on telling those apart.
    assert outcome.cost_usd == 0.0
    assert outcome.input_tokens == 700
    assert outcome.output_tokens == 12
    assert outcome.first_token_ms is not None
    assert [s["n"] for s in outcome.sources] == [1, 2]


def test_the_model_gets_the_production_prompt(local_provider, fake_retrieval, fake_ollama):
    """The whole training pipeline assumes this shape. If it drifts, the
    fine-tune silently stops matching what it was trained on."""
    drain(grounded.run(_state("How many leave days do we get?")))
    messages = fake_ollama.messages

    assert messages[0]["role"] == "system"
    assert messages[0]["content"] == chat.SYSTEM_PROMPT
    assert messages[-1]["role"] == "user"
    assert messages[-1]["content"] == chat.build_user_prompt(
        "How many leave days do we get?",
        [_source(1, "Employees get 25 days of paid annual leave."),
         _source(2, "Leave does not roll over.")],
    )


def test_memories_become_numbered_passages(local_provider, fake_retrieval, fake_ollama):
    """Two regressions in one.

    1. Grounded mode rebuilds the system message, so Phase 8 context has to be
       re-added — dropping it made the local model answer "I don't know" to
       questions the user had already told it the answer to.
    2. Memories arrive as CITABLE passages, not as a prompt block. The model
       cites everything it was trained on, so a memory in the system prompt got
       an arbitrary [n] pointing at an unrelated passage.
    """
    state = _state()
    state["memories"] = ["Ganesh is the CEO of Lovely.", "Ganesh is a Software Engineer."]
    _, outcome = drain(grounded.run(state))

    # 2 retrieved + 2 memories, numbered contiguously so [3]/[4] are real.
    assert [s["n"] for s in outcome.sources] == [1, 2, 3, 4]
    mem = [s for s in outcome.sources if s["source_type"] == "text"]
    assert [s["n"] for s in mem] == [3, 4]
    assert mem[0]["text"] == "Ganesh is the CEO of Lovely."
    assert mem[0]["title"] == "Saved memory"

    user_prompt = fake_ollama.messages[-1]["content"]
    assert "[3] (Saved memory, p.1) Ganesh is the CEO of Lovely." in user_prompt

    # The memory must NOT also be in the system prompt — that is the shape
    # that produced fabricated citations.
    assert "Ganesh is the CEO" not in fake_ollama.messages[0]["content"]


def test_memory_alone_is_enough_to_answer(local_provider, monkeypatch, fake_ollama):
    """Retrieval finds nothing, but we remember something → still answerable,
    so it must not short-circuit to the refusal."""
    monkeypatch.setattr(chat, "retrieve", lambda db, tenant_id, q: [])
    state = _state()
    state["memories"] = ["Ganesh is the CEO of Lovely."]
    _, outcome = drain(grounded.run(state))

    assert outcome.answer != grounded.REFUSAL
    assert [s["n"] for s in outcome.sources] == [1]


def test_conversation_summary_reaches_the_local_model(
    local_provider, fake_retrieval, fake_ollama
):
    state = _state()
    state["summary"] = "Earlier they asked about refunds and leave policy."
    drain(grounded.run(state))

    system = fake_ollama.messages[0]["content"]
    assert "Earlier they asked about refunds" in system


def test_no_memories_leaves_the_prompt_exactly_as_trained(
    local_provider, fake_retrieval, fake_ollama
):
    """The common case must stay byte-identical to the fine-tuning format."""
    drain(grounded.run(_state()))
    assert fake_ollama.messages[0]["content"] == chat.SYSTEM_PROMPT


def test_prior_turns_are_replayed_for_follow_ups(local_provider, fake_retrieval, fake_ollama):
    history = [HumanMessage(content="what about sick leave?"), AIMessage(content="It is uncapped [1].")]
    drain(grounded.run(_state(history=history)))

    middle = fake_ollama.messages[1:-1]
    assert middle == [
        {"role": "user", "content": "what about sick leave?"},
        {"role": "assistant", "content": "It is uncapped [1]."},
    ]


# ── refusal ─────────────────────────────────────────────────────────────────


def test_the_refusal_string_is_the_one_everything_else_recognises():
    assert grounded.REFUSAL in chat.SYSTEM_PROMPT
    assert evaluation.is_refusal(grounded.REFUSAL)


def test_empty_retrieval_refuses_without_calling_the_model(local_provider, monkeypatch):
    monkeypatch.setattr(chat, "retrieve", lambda db, tenant_id, q: [])

    def explode(messages):
        raise AssertionError("the model must not be called with no passages")
        yield  # pragma: no cover — keeps this a generator

    monkeypatch.setattr(grounded, "_stream_completion", explode)

    events, outcome = drain(grounded.run(_state()))
    assert outcome.answer == grounded.REFUSAL
    assert outcome.sources == []
    assert [e for e, _ in events] == ["trace", "sources", "delta", "trace"]


# ── the switch ──────────────────────────────────────────────────────────────


def test_default_provider_is_anthropic():
    """Production must never route to a model it cannot host."""
    from app.config import Settings

    assert Settings.model_fields["LLM_PROVIDER"].default == "anthropic"


def test_ask_run_routes_to_grounded_when_local(local_provider, monkeypatch):
    sentinel = object()

    def fake_run(state):
        yield ("delta", {"text": "from grounded"})
        return sentinel

    monkeypatch.setattr(grounded, "run", fake_run)

    events, outcome = drain(ask.run(_state()))
    assert events == [("delta", {"text": "from grounded"})]
    assert outcome is sentinel


def test_per_request_provider_beats_the_configured_default(monkeypatch):
    """The Ask page's picker. Config says anthropic; this ask says local."""
    monkeypatch.setattr(get_settings(), "LLM_PROVIDER", "anthropic")
    monkeypatch.setattr(grounded, "run", lambda state: iter(()))

    events, _ = drain(ask.run(_state(), provider="local"))
    assert events == []  # reached grounded, not the graph


def test_unknown_provider_is_rejected(local_provider):
    with pytest.raises(ValueError):
        drain(ask.run(_state(), provider="gpt-5"))


# ── the picker's data ───────────────────────────────────────────────────────


def test_describe_reports_local_as_unavailable_when_ollama_is_down(monkeypatch):
    monkeypatch.setattr(grounded, "probe", lambda: (False, "Ollama isn't running"))
    rows = {p["id"]: p for p in providers.describe()}

    assert rows["local"]["available"] is False
    assert rows["local"]["detail"] == "Ollama isn't running"
    # The static note must be present even when down — it is the explanation
    # a hosted user needs, and it is why the red dot is expected there.
    assert "cannot reach" in rows["local"]["note"]
    assert rows["anthropic"]["available"] is True  # .env has a key


def test_probe_distinguishes_down_from_model_missing(monkeypatch):
    """Two different fixes, so they must not collapse into one message."""
    import httpx

    def down(url, timeout):
        raise httpx.ConnectError("refused")

    monkeypatch.setattr(grounded.httpx, "get", down)
    ok, detail = grounded.probe()
    assert ok is False and "isn't running" in detail

    class Resp:
        def raise_for_status(self):
            pass

        def json(self):
            return {"data": [{"id": "llama3:latest"}]}

    monkeypatch.setattr(grounded.httpx, "get", lambda url, timeout: Resp())
    ok, detail = grounded.probe()
    assert ok is False and "isn't installed" in detail


def test_probe_matches_a_tagged_model_name(monkeypatch):
    """Ollama reports `brainstack-3b:latest`; the setting says `brainstack-3b`."""

    class Resp:
        def raise_for_status(self):
            pass

        def json(self):
            return {"data": [{"id": "brainstack-3b:latest"}]}

    monkeypatch.setattr(grounded.httpx, "get", lambda url, timeout: Resp())
    assert grounded.probe() == (True, "ready")


def test_models_endpoint_requires_auth(client):
    assert client.get("/models").status_code == 401


def test_models_endpoint_lists_both_providers(client, monkeypatch):
    monkeypatch.setattr(grounded, "probe", lambda: (True, "ready"))
    token = signup(client, "Picker Co", "Ann", "ann@picker-co.com").json()["access_token"]

    body = client.get("/models", headers=auth_header(token)).json()
    assert [p["id"] for p in body] == ["anthropic", "local"]
    assert all({"label", "title", "kind", "available", "detail", "note"} <= p.keys() for p in body)


def test_ask_run_uses_the_graph_when_anthropic(monkeypatch):
    monkeypatch.setattr(get_settings(), "LLM_PROVIDER", "anthropic")
    monkeypatch.setattr(
        grounded, "run", lambda state: pytest.fail("must not reach grounded mode")
    )

    class DeadGraph:
        def stream(self, state, stream_mode):
            return iter(())

    monkeypatch.setattr(ask.agent, "get_graph", DeadGraph)

    with pytest.raises(ask.AskFailed):  # the graph ran and produced nothing
        drain(ask.run(_state()))
