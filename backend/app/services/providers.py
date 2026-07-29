"""Which answering models this deployment can offer, and whether they work.

Backs the Ask page's model picker. The list is deliberately computed per
request rather than cached: `local` availability is whatever Ollama is doing
right now, and a stale green dot is worse than no dot.

The honest shape of this feature: on the hosted deployment `local` is always
unavailable, because Render's backend cannot reach a laptop. That is not a bug
to hide — the picker states it (grounded.LOCAL_NOTE), which is a better
explanation of the architecture than any README paragraph.
"""

from __future__ import annotations

from app.config import get_settings
from app.services import grounded

# The provider ids `ask.run()` understands. Anything else is a 422.
PROVIDERS = ("anthropic", "local")


def describe() -> list[dict]:
    """One entry per provider, newest-truth availability included."""
    settings = get_settings()

    key_configured = bool(settings.ANTHROPIC_API_KEY)
    hosted = {
        "id": "anthropic",
        "label": settings.LLM_MODEL_AGENT,
        "title": "Claude",
        "kind": "hosted",
        "available": key_configured,
        "detail": "ready" if key_configured else "ANTHROPIC_API_KEY is not configured",
        "note": "The full agent: knowledge search, web search, reflection.",
        "is_default": settings.LLM_PROVIDER == "anthropic",
    }

    ok, detail = grounded.probe()
    local = {
        "id": "local",
        "label": settings.LLM_MODEL_LOCAL,
        "title": "Our fine-tuned model",
        "kind": "local",
        "available": ok,
        "detail": detail,
        "note": grounded.LOCAL_NOTE,
        "is_default": settings.LLM_PROVIDER == "local",
    }
    return [hosted, local]


def resolve(requested: str | None) -> str:
    """The provider an ask should use. None/blank falls back to the configured
    default, so every existing caller keeps its current behaviour."""
    if not requested:
        return get_settings().LLM_PROVIDER
    if requested not in PROVIDERS:
        raise ValueError(f"unknown model provider: {requested!r}")
    return requested
