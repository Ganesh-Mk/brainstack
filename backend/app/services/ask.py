"""Running the agent graph once — shared by the app's SSE stream and /v1/ask.

Extracted in Phase 11b. The promise in PHASE_11 §1.1 is that `/v1` handlers
are thin and the logic is shared: only the *contract* is separate, never the
work. This module is where that promise is kept — the graph loop, the token
accounting, the drafting trace step and the cost arithmetic live here once.

`run()` is a generator that yields ("event", payload) pairs and *returns* an
AskOutcome. Callers either forward the events to SSE (the app route, /v1/ask
with `Accept: text/event-stream`) or drain them and keep only the outcome
(/v1/ask JSON).

What is deliberately NOT here: conversation persistence, memory extraction,
the per-conversation streaming lock, rate limiting. Those belong to the caller
— the app route and the public API make different choices about all four.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Generator

from app.config import get_settings
from app.services import agent


class AskFailed(RuntimeError):
    """The graph produced no answer text."""


@dataclass
class AskOutcome:
    answer: str
    sources: list[dict] = field(default_factory=list)
    trace: list[dict] = field(default_factory=list)
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float | None = None
    first_token_ms: int | None = None
    latency_ms: int = 0
    model: str = ""


def cost_of(input_tokens: int, output_tokens: int) -> float | None:
    """Attributed spend, at the configured list prices (Phase 9)."""
    if not (input_tokens or output_tokens):
        return None
    settings = get_settings()
    usd = (
        input_tokens * settings.PRICE_INPUT_PER_MTOK
        + output_tokens * settings.PRICE_OUTPUT_PER_MTOK
    ) / 1_000_000
    return round(usd, 6)


def run(state) -> Generator[tuple[str, object], None, AskOutcome]:
    """Stream the graph. Yields ("trace"|"sources"|"reset"|"delta", payload)."""
    settings = get_settings()

    # The provider switch lives HERE, not in the routes, for the same reason
    # the graph loop does: one implementation, and both callers (the app's SSE
    # route and /v1/ask) get it for free. `local` runs our own fine-tuned
    # model over the same retrieval — see services/grounded.py.
    if settings.LLM_PROVIDER == "local":
        from app.services import grounded

        return (yield from grounded.run(state))

    t_start = time.perf_counter()

    answer_parts: list[str] = []
    sources: list[dict] = []
    trace: list[dict] = []
    draft_started: float | None = None
    first_token_at: float | None = None
    in_tokens = out_tokens = 0  # approximate — summed per model call

    for mode, payload in agent.get_graph().stream(
        state, stream_mode=["messages", "custom"]
    ):
        if mode == "custom":
            if "trace" in payload:
                trace.append(payload["trace"])
                yield ("trace", payload["trace"])
            if "sources" in payload:
                sources = payload["sources"]
                yield ("sources", sources)
            if payload.get("reset"):
                # Reflection rejected the draft: clear it everywhere — the
                # retry streams fresh, only the final draft persists.
                answer_parts.clear()
                draft_started = None
                yield ("reset", {})
        elif mode == "messages":
            chunk, meta = payload
            if meta.get("langgraph_node") != "agent":
                continue
            um = getattr(chunk, "usage_metadata", None) or {}
            if um.get("input_tokens"):
                in_tokens += um["input_tokens"]
            if (getattr(chunk, "response_metadata", None) or {}).get("stop_reason"):
                out_tokens += um.get("output_tokens", 0)
            text = agent.chunk_text(chunk)
            if text:
                # first_token_at is NOT reset by a reflection retry: it
                # measures when the user first saw movement, which is what
                # first-token latency means.
                if first_token_at is None:
                    first_token_at = time.perf_counter()
                if draft_started is None:
                    draft_started = time.perf_counter()
                answer_parts.append(text)
                yield ("delta", {"text": text})

    answer = "".join(answer_parts).strip()
    if not answer:
        raise AskFailed("agent produced no answer text")

    # Close the trace with the drafting step (streamed AND persisted).
    drafting = {
        "n": len(trace) + 1,
        "kind": "drafting",
        "label": "Drafting the answer",
        "ms": round((time.perf_counter() - (draft_started or t_start)) * 1000),
    }
    trace.append(drafting)
    yield ("trace", drafting)

    return AskOutcome(
        answer=answer,
        sources=sources,
        trace=trace,
        input_tokens=in_tokens,
        output_tokens=out_tokens,
        cost_usd=cost_of(in_tokens, out_tokens),
        first_token_ms=(
            round((first_token_at - t_start) * 1000) if first_token_at else None
        ),
        latency_ms=round((time.perf_counter() - t_start) * 1000),
        model=settings.LLM_MODEL_AGENT,
    )
