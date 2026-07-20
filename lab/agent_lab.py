"""agent_lab.py — the agent loop with nothing hidden.

Phase 3 proved retrieval by hand. This proves THE LOOP by hand, before
LangGraph wraps it in the product:

    while the model asks for tools:
        run the tools
        hand back the results
    print the final answer

That while-loop IS an agent. Everything else — LangGraph, traces, streaming —
is engineering around it.

Two real tools:
  search_knowledge  -> real embeddings + real Pinecone (namespace "_lab")
  web_search        -> real Tavily

Run with the BACKEND venv (it has anthropic + fastembed + pinecone + tavily):

    backend/.venv/Scripts/python lab/agent_lab.py
    backend/.venv/Scripts/python lab/agent_lab.py "your question"

Watch the printout: which tools it chooses IS the lesson. If it searches the
web for internal policy, the bug is in the tool DESCRIPTIONS, not the loop.
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

LAB = Path(__file__).parent
sys.path.insert(0, str(LAB.parent / "backend"))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(LAB.parent / ".env")

import anthropic  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.services import embeddings, extraction, vectorstore  # noqa: E402

NAMESPACE = "_lab"
MODEL = "claude-haiku-4-5"
MAX_STEPS = 4

# ── The tools — schema + implementation, side by side ───────────────────────
# The DESCRIPTIONS are load-bearing. They are the router. The model reads
# nothing else when deciding which tool fits a question.

TOOLS = [
    {
        "name": "search_knowledge",
        "description": (
            "Search the company's internal documents: policies, handbooks, "
            "procedures, anything the organization has written down. ALWAYS "
            "try this first for questions about the company, its rules, or "
            "its people. Returns numbered passages with page numbers."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "What to look for, phrased specifically.",
                }
            },
            "required": ["query"],
        },
    },
    {
        "name": "web_search",
        "description": (
            "Search the public web for CURRENT or EXTERNAL information: "
            "competitors, news, market prices, industry norms — anything "
            "that would not be written in the company's own documents. "
            "Do not use this for internal policy."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "The web search query."}
            },
            "required": ["query"],
        },
    },
]


def ensure_lab_namespace() -> None:
    """Index the handbook into the _lab namespace once, if it's empty."""
    if vectorstore.namespace_count(NAMESPACE) > 0:
        return
    print("(_lab namespace empty — indexing the handbook once…)")
    _, pages = extraction.extract_pdf((LAB / "data" / "handbook.pdf").read_bytes())
    texts, metas = [], []
    for page_no, text in pages:
        clean = " ".join(text.split())
        for start in range(0, len(clean), 320):
            piece = clean[start : start + 400]
            if piece.strip():
                texts.append(piece)
                metas.append(page_no)
    vecs = embeddings.embed_raw(texts)
    vectorstore.upsert(
        NAMESPACE,
        [
            {
                "id": f"lab-{i}",
                "values": v,
                "metadata": {"page": p, "text": t[:900], "document_id": "lab"},
            }
            for i, (v, t, p) in enumerate(zip(vecs, texts, metas))
        ],
    )
    time.sleep(5)
    print(f"(indexed {len(texts)} chunks)\n")


def search_knowledge(query: str) -> str:
    qvec = embeddings.embed_raw([query])[0]
    res = vectorstore.get_index().query(
        vector=qvec, top_k=4, namespace=NAMESPACE, include_metadata=True
    )
    matches = res.get("matches", [])
    if not matches:
        return "No internal documents are indexed."
    return "\n\n".join(
        f"[{i}] (handbook, p.{m['metadata']['page']}) {m['metadata']['text']}"
        for i, m in enumerate(matches, start=1)
    )


def web_search(query: str) -> str:
    from tavily import TavilyClient

    client = TavilyClient(api_key=get_settings().TAVILY_API_KEY)
    res = client.search(query, max_results=4, search_depth="basic")
    results = res.get("results", [])
    if not results:
        return "The web search returned nothing."
    return "\n\n".join(
        f"[W{i}] {r['title']} ({r['url']})\n{r['content'][:400]}"
        for i, r in enumerate(results, start=1)
    )


IMPLEMENTATIONS = {"search_knowledge": search_knowledge, "web_search": web_search}

SYSTEM = (
    "You are a company knowledge assistant with two tools. Use "
    "search_knowledge for anything about the company's own documents and "
    "policies; use web_search only for external/current information. Use "
    "both when a question compares internal policy with the outside world. "
    "Answer concisely, citing the bracketed passage numbers you relied on. "
    "If neither tool finds the answer, say you don't know."
)


def run(question: str) -> None:
    print(f"\nQ: {question}\n" + "─" * 72)
    client = anthropic.Anthropic()
    messages = [{"role": "user", "content": question}]
    t0 = time.perf_counter()

    for step in range(1, MAX_STEPS + 2):
        response = client.messages.create(
            model=MODEL,
            max_tokens=800,
            system=SYSTEM,
            tools=TOOLS,
            messages=messages,
        )

        # ← THE decision point. Everything hinges on stop_reason.
        if response.stop_reason != "tool_use":
            answer = "".join(b.text for b in response.content if b.type == "text")
            print(f"\n✍️  answer ({time.perf_counter() - t0:.1f}s total):\n{answer}")
            return

        # The model asked for tools. Echo its turn back, run each tool, and
        # hand the results over in ONE user message.
        messages.append({"role": "assistant", "content": response.content})
        results = []
        for block in response.content:
            if block.type != "tool_use":
                continue
            fn = IMPLEMENTATIONS[block.name]
            icon = "🔍" if block.name == "search_knowledge" else "🌐"
            t = time.perf_counter()
            output = fn(**block.input)
            ms = (time.perf_counter() - t) * 1000
            print(f"  {icon} step {step}: {block.name}({json.dumps(block.input)})"
                  f" -> {len(output)} chars in {ms:.0f}ms")
            results.append(
                {"type": "tool_result", "tool_use_id": block.id, "content": output}
            )
        messages.append({"role": "user", "content": results})

    print("(hit the step cap — forcing a final answer)")


if __name__ == "__main__":
    ensure_lab_namespace()
    questions = (
        [" ".join(sys.argv[1:])]
        if len(sys.argv) > 1
        else [
            "How many days of annual leave do employees get?",  # knowledge only
            "What is the latest stable version of Python?",  # web only
            "Compare our client refund policy with what's typical in the industry.",  # both
        ]
    )
    for q in questions:
        run(q)
