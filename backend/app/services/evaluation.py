"""LLM-as-judge scorers (Phase 9) — our own, before reaching for a library.

Two judged metrics (haiku, strict JSON, one call each) and two deterministic
ones. The judges grade DIFFERENT things:

  faithfulness — is every claim in the answer supported by the retrieved
                 sources? (hallucination detector; refusals score 1.0)
  relevance    — does the answer address the question that was asked?

Deterministic, no model involved:

  retrieval_hit     — did the expected keywords appear in retrieved chunks?
  citation_validity — does every [n] in the answer cite a source that exists?
"""

from __future__ import annotations

import json
import re

from app.services.memory import haiku

FAITHFULNESS_SYSTEM = """You judge whether an answer is faithful to its sources.

Given numbered source passages and an answer, score how well every factual
claim in the answer is supported by the passages:
- 1.0: every claim supported (an honest "I don't know" is also 1.0)
- 0.5: mostly supported, minor unsupported detail
- 0.0: contains invented or contradicted claims

Output ONLY JSON: {"score": <0.0-1.0>, "reason": "<one short sentence>"}"""

RELEVANCE_SYSTEM = """You judge whether an answer addresses the question asked.

- 1.0: directly answers the question (a clear "that isn't covered in the
  documents" for an unanswerable question is also 1.0)
- 0.5: partially answers or buries the answer
- 0.0: off-topic or answers a different question

Output ONLY JSON: {"score": <0.0-1.0>, "reason": "<one short sentence>"}"""


def _judge(system: str, user: str) -> tuple[float, str]:
    raw = haiku(system, user, max_tokens=120)
    m = re.search(r"\{.*\}", raw, re.DOTALL)
    data = json.loads(m.group(0)) if m else {}
    score = max(0.0, min(1.0, float(data.get("score", 0.0))))
    return score, str(data.get("reason", ""))[:200]


def faithfulness(answer: str, sources: list[dict]) -> tuple[float, str]:
    ctx = "\n\n".join(f"[{s['n']}] {s['text'][:500]}" for s in sources[:8]) or "(none)"
    return _judge(
        FAITHFULNESS_SYSTEM, f"Sources:\n{ctx}\n\nAnswer:\n{answer[:2500]}"
    )


def relevance(question: str, answer: str) -> tuple[float, str]:
    return _judge(
        RELEVANCE_SYSTEM, f"Question: {question}\n\nAnswer:\n{answer[:2500]}"
    )


def retrieval_hit(sources: list[dict], expected_keywords: list[str]) -> bool:
    """True when every expected keyword-group appears in some retrieved chunk.
    A keyword entry may offer alternatives split by ' | '."""
    if not expected_keywords:
        return True
    blob = " ".join(s["text"].lower() for s in sources)
    for kw in expected_keywords:
        if not any(alt.strip().lower() in blob for alt in kw.split("|")):
            return False
    return True


_CITATION_RE = re.compile(r"\[(\d+)\]")


def citation_validity(answer: str, sources: list[dict]) -> bool:
    """Every [n] the answer uses must point at a source that was returned."""
    valid = {s["n"] for s in sources}
    cited = {int(n) for n in _CITATION_RE.findall(answer)}
    return cited.issubset(valid)


def is_refusal(answer: str) -> bool:
    a = answer.lower()
    return any(
        marker in a
        for marker in (
            "i don't know",
            "isn't covered",
            "not covered in",
            "couldn't find",
            "don't have information",
            "no information about",
        )
    )
