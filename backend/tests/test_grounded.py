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
from app.services import ask, chat, evaluation, grounded


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
