"""Grounded mode — the answer path for our own fine-tuned model.

`LLM_PROVIDER=local` routes here instead of through the LangGraph agent.
Same retrieval, same prompt, same SSE events out; a different model writes the
answer. See docs/FINETUNE_PLAN.md §6.

Why this is a separate path and not a model swap inside agent.py:

  The agent's job is tool ROUTING — decide between knowledge search and web
  search, emit tool-call JSON, loop, reflect. A 3B model does that badly, and
  when it failed we would be measuring its JSON discipline, not the skill we
  actually trained. So the local model gets the sub-task it was trained for:
  read numbered passages, write a cited answer, refuse when the answer isn't
  there. Claude keeps the tools.

This revives the shape of the Phase-5 direct path that chat.py retired when
the agent became the only ask path — deliberately, and only behind the flag.

The event contract is the point of this module. It yields exactly what
ask.run() yields, in the same order, so the frontend, the SSE route, /v1/ask
and eval/run_eval.py all work unchanged:

    ("trace", …)  ("sources", …)  ("delta", …)×n  ("trace", drafting)
"""

from __future__ import annotations

import json
import logging
import re
import time
import uuid
from typing import Generator, Iterator

import httpx

from app import db as app_db
from app.config import get_settings
from app.services import agent, chat

log = logging.getLogger("grounded")


class LocalModelUnavailable(RuntimeError):
    """Ollama isn't running or doesn't have the model — a clear message beats
    a connection traceback, because the fix is always 'start Ollama'."""


# Grounded answering should be boring and repeatable: the same passages should
# produce the same answer. Creativity here is indistinguishable from making
# things up.
TEMPERATURE = 0.2

# Read out of the production prompt rather than retyped — the UI, the eval
# harness (evaluation.is_refusal) and the training data all key off this exact
# sentence, so there must be exactly one copy of it in the codebase.
_REFUSAL_MATCH = re.search(r'"(I don\'t know[^"]*)"', chat.SYSTEM_PROMPT)
REFUSAL = (
    _REFUSAL_MATCH.group(1)
    if _REFUSAL_MATCH
    else "I don't know — that isn't covered in this workspace's documents."
)


# The UI polls this whenever the model picker is opened, so it must be fast
# and it must never raise — an unreachable model is a status to display, not
# an error to handle.
#
# The connect budget is separate and small on purpose: a dead host is resolved
# dual-stack, so the client tries IPv6 then IPv4 and a single flat timeout gets
# spent TWICE (measured 4.4s for a nominal 2s). Worst case here is ~1.6s.
PROBE_TIMEOUT = httpx.Timeout(1.5, connect=0.8)
PROBE_BUDGET_S = 1.6  # what we tell the user when it elapses

# Why the hosted deployment can never satisfy `local`. Stated once, here,
# because the UI shows it and it is the reason the switch exists at all.
LOCAL_NOTE = (
    "Runs on your own machine through Ollama. A hosted API server cannot reach "
    "it — run the backend locally to use this model."
)


def probe() -> tuple[bool, str]:
    """(reachable, one-line status). Distinguishes 'Ollama is down' from
    'Ollama is up but the model was never created' — different fixes, so the
    UI must not collapse them into one red dot."""
    settings = get_settings()
    want = settings.LLM_MODEL_LOCAL
    try:
        resp = httpx.get(
            settings.OLLAMA_BASE_URL.rstrip("/") + "/models", timeout=PROBE_TIMEOUT
        )
        resp.raise_for_status()
        installed = {m.get("id", "") for m in (resp.json().get("data") or [])}
    except httpx.ConnectError:
        return False, f"Ollama isn't running at {settings.OLLAMA_BASE_URL}"
    except httpx.TimeoutException:
        return False, f"Ollama didn't respond within {PROBE_BUDGET_S:.1f}s"
    except Exception as e:
        return False, f"Ollama check failed ({e.__class__.__name__})"

    # Ollama reports tags as `name:tag`; `brainstack-3b` matches
    # `brainstack-3b:latest`.
    if not any(i == want or i.startswith(want + ":") for i in installed if i):
        return False, f"Ollama is running, but '{want}' isn't installed"
    return True, "ready"


def _history_from(messages: list) -> list[dict]:
    """The prior turns out of the agent state.

    initial_state() builds [system, *history, question]. We rebuild the system
    message ourselves and re-ask the question with fresh context, so what is
    left in the middle is the conversational thread.
    """
    from langchain_core.messages import AIMessage, HumanMessage

    turns = []
    for m in messages[1:-1]:
        if isinstance(m, HumanMessage):
            turns.append({"role": "user", "content": str(m.content)})
        elif isinstance(m, AIMessage):
            turns.append({"role": "assistant", "content": str(m.content)})
    return turns


def _stream_completion(messages: list[dict]) -> Iterator[tuple[str, dict]]:
    """Ollama's OpenAI-compatible chat completions, streamed.

    Yields ("delta", text) per token and one final ("usage", {...}). Ollama
    reports usage on the last chunk when we ask for it; if a version doesn't,
    the counts stay 0 and only cost attribution is poorer.
    """
    settings = get_settings()
    url = settings.OLLAMA_BASE_URL.rstrip("/") + "/chat/completions"
    body = {
        "model": settings.LLM_MODEL_LOCAL,
        "messages": messages,
        "stream": True,
        "temperature": TEMPERATURE,
        "max_tokens": settings.CHAT_MAX_TOKENS,
        "stream_options": {"include_usage": True},
    }
    try:
        with httpx.Client(timeout=settings.LLM_LOCAL_TIMEOUT) as client:
            with client.stream("POST", url, json=body) as resp:
                if resp.status_code == 404:
                    raise LocalModelUnavailable(
                        f"Ollama has no model named '{settings.LLM_MODEL_LOCAL}'. "
                        f"Run: ollama list"
                    )
                if resp.status_code >= 400:
                    resp.read()
                    raise LocalModelUnavailable(
                        f"Ollama returned HTTP {resp.status_code}: {resp.text[:200]}"
                    )
                for line in resp.iter_lines():
                    if not line or not line.startswith("data: "):
                        continue
                    payload = line[6:].strip()
                    if payload == "[DONE]":
                        break
                    try:
                        data = json.loads(payload)
                    except json.JSONDecodeError:
                        continue
                    for choice in data.get("choices") or []:
                        text = (choice.get("delta") or {}).get("content")
                        if text:
                            yield ("delta", {"text": text})
                    if data.get("usage"):
                        yield ("usage", data["usage"])
    except httpx.ConnectError as e:
        raise LocalModelUnavailable(
            f"Could not reach Ollama at {settings.OLLAMA_BASE_URL}. "
            "Is it running? Try: ollama serve"
        ) from e
    except httpx.ReadTimeout as e:
        raise LocalModelUnavailable(
            f"Ollama did not finish within {settings.LLM_LOCAL_TIMEOUT:.0f}s. "
            "CPU inference is slow — raise LLM_LOCAL_TIMEOUT or use a smaller quant."
        ) from e


def run(state) -> Generator[tuple[str, object], None, "object"]:
    """Same signature and same event contract as ask.run()."""
    from app.services.ask import AskFailed, AskOutcome

    settings = get_settings()
    t_start = time.perf_counter()
    question = state["question"]
    trace: list[dict] = []

    # ── retrieve (identical to the agent path — retrieval is NOT what we
    #    changed, which is what makes the comparison fair) ──────────────────
    t0 = time.perf_counter()
    session = app_db.SessionLocal()
    try:
        found = chat.retrieve(session, uuid.UUID(state["tenant_id"]), question)
    finally:
        session.close()

    # Recalled memories join the context as NUMBERED PASSAGES rather than as a
    # system-prompt block.
    #
    # Why the two paths differ here: Claude reads "use these facts, no citation
    # needed" and complies. Our fine-tune cannot — all 1,010 training rows cite
    # a numbered passage, so it has never seen a fact that shouldn't be cited,
    # and given memories in the prompt it staples an arbitrary [n] onto them
    # (verified: it cited the annual-leave passage for "who is the CEO"). That
    # passes citation_validity while pointing at nothing.
    #
    # Making the memory a real passage works WITH the trained habit instead of
    # against it, and the resulting citation is true: the fact IS in block [n].
    passages = list(found) + [
        chat.Source(
            n=len(found) + i + 1,
            document_id="",
            title="Saved memory",
            page=1,
            text=m,
            score=1.0,
            source_type="text",
        )
        for i, m in enumerate(state.get("memories") or [])
    ]
    sources = [s.to_dict() for s in passages]

    step = {
        "n": 1,
        "kind": "knowledge",
        "label": "Searching knowledge",
        "detail": question[:300],
        "ms": round((time.perf_counter() - t0) * 1000),
    }
    trace.append(step)
    yield ("trace", step)
    yield ("sources", sources)

    first_token_at: float | None = None
    in_tokens = out_tokens = 0
    draft_started = t_start

    if not passages:
        # Nothing indexed, nothing matched, nothing remembered. The trained
        # behaviour for "the context does not contain it" is the refusal — so
        # emit it directly rather than asking the model to refuse over an empty
        # context block, a shape it never saw in training.
        answer = REFUSAL
        first_token_at = time.perf_counter()
        yield ("delta", {"text": answer})
    else:
        # The grounded static prompt (exactly what the model was fine-tuned on)
        # plus the conversation summary. Memories are NOT here — they are
        # passages above. Rebuilding the system message means the summary has
        # to be re-added explicitly; dropping it lost the older turns.
        system = chat.SYSTEM_PROMPT + agent.dynamic_context(
            state.get("summary"), None
        )
        messages = [{"role": "system", "content": system}]
        messages += _history_from(state["messages"])
        messages.append(
            {"role": "user", "content": chat.build_user_prompt(question, passages)}
        )

        parts: list[str] = []
        draft_started = time.perf_counter()  # after retrieval — drafting only
        for kind, payload in _stream_completion(messages):
            if kind == "delta":
                if first_token_at is None:
                    first_token_at = time.perf_counter()
                parts.append(payload["text"])
                yield ("delta", payload)
            else:
                in_tokens = int(payload.get("prompt_tokens") or 0)
                out_tokens = int(payload.get("completion_tokens") or 0)
        answer = "".join(parts).strip()
        if not answer:
            raise AskFailed("the local model produced no answer text")

    drafting = {
        "n": len(trace) + 1,
        "kind": "drafting",
        "label": "Drafting the answer",
        "ms": round((time.perf_counter() - draft_started) * 1000),
    }
    trace.append(drafting)
    yield ("trace", drafting)

    return AskOutcome(
        answer=answer,
        sources=sources,
        trace=trace,
        input_tokens=in_tokens,
        output_tokens=out_tokens,
        # Not None and not a price: this model ran on hardware we already own.
        # Zero is the honest number, and it is half the point of the exercise.
        cost_usd=0.0,
        first_token_ms=(
            round((first_token_at - t_start) * 1000) if first_token_at else None
        ),
        latency_ms=round((time.perf_counter() - t_start) * 1000),
        model=settings.LLM_MODEL_LOCAL,
    )
