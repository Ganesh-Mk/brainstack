"""The agent — lab/agent_lab.py's raw loop, grown up into LangGraph.

Same two native tools (knowledge search, web search — NOT MCP, per
architecture decision #2), same decision point (does the model want tools?),
but now with:

  * a StateGraph: agent node ↔ tools node, conditional edge, step cap
  * trace events streamed to the UI as each step happens (via the custom
    stream writer), and persisted with the answer
  * sources accumulated across tool calls with contiguous [n] numbering —
    web results join the same citation list as knowledge passages

The tool DESCRIPTIONS are the router. When the agent searches the web for
internal policy, fix the description, not the loop (PROJECT_GUIDE §Phase 4).
"""

from __future__ import annotations

import time
import uuid
from typing import Annotated, TypedDict

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from langgraph.config import get_stream_writer
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages

from app import db as app_db
from app.config import get_settings
from app.services import chat


class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    tenant_id: str
    sources: list[dict]  # chat.Source dicts, numbered contiguously
    steps_used: int
    trace: list[dict]


# ── Tools (schemas only — execution is ours, in the tools node) ─────────────

TOOL_SCHEMAS = [
    {
        "name": "search_knowledge",
        "description": (
            "Search this workspace's internal documents: policies, handbooks, "
            "procedures, product docs — anything the company has written "
            "down. ALWAYS try this first for questions about the company, "
            "its rules, numbers, or people. Returns numbered passages with "
            "page references."
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
            "competitors, industry norms, news, prices, technology facts — "
            "anything that would not appear in the company's own documents. "
            "Never use this for internal policy or company-specific facts."
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

SYSTEM_PROMPT = """You are BrainStack, a company knowledge assistant with tools.

Routing rules:
- Questions about the company, its policies, documents or people -> search_knowledge first.
- Questions about the outside world (competitors, news, current facts) -> web_search.
- Comparisons between internal policy and the outside world -> use both.
- Simple conversational replies (greetings, thanks) need no tools.

Behavior rules, follow exactly:
1. When you decide to use tools, call them immediately — write NO text before
   tool calls.
2. Ground every claim in tool results. Cite with bracketed numbers like [1]
   or [2][5], placed directly after the claim they support. Only cite numbers
   that exist in the results (web results are numbered in the same sequence).
3. If the tools cannot answer the question, reply with one short sentence:
   "I don't know — I couldn't find that in this workspace's documents or on
   the web." Do not guess.
4. Be concise. Plain markdown: short paragraphs, bold key figures, dash lists
   where they help. No headings, no preamble.
"""


# ── Tool implementations ────────────────────────────────────────────────────


def _run_knowledge(tenant_id: str, query: str, start_n: int) -> tuple[str, list[dict]]:
    """Returns (tool_result_text, new_source_dicts). Numbering continues from
    start_n so citations stay contiguous across multiple tool calls."""
    session = app_db.SessionLocal()
    try:
        found = chat.retrieve(session, uuid.UUID(tenant_id), query)
    finally:
        session.close()
    if not found:
        return (
            "No matching passages. Either nothing relevant is indexed in this "
            "workspace, or the library is empty.",
            [],
        )
    new_sources = []
    lines = []
    for offset, s in enumerate(found):
        s.n = start_n + offset
        new_sources.append(s.to_dict())
        lines.append(f"[{s.n}] ({s.title}, p.{s.page}) {s.text}")
    return "\n\n".join(lines), new_sources


def _run_web(query: str, start_n: int) -> tuple[str, list[dict]]:
    settings = get_settings()
    if not settings.TAVILY_API_KEY:
        return "Web search is not configured on this server.", []
    from tavily import TavilyClient

    client = TavilyClient(api_key=settings.TAVILY_API_KEY)
    res = client.search(
        query, max_results=settings.WEB_SEARCH_MAX_RESULTS, search_depth="basic"
    )
    results = res.get("results", [])
    if not results:
        return "The web search returned no results.", []
    new_sources = []
    lines = []
    for offset, r in enumerate(results):
        n = start_n + offset
        text = (r.get("content") or "")[:500]
        new_sources.append(
            {
                "n": n,
                "document_id": "",
                "title": r.get("title") or r.get("url", "Web result"),
                "page": 1,
                "text": text,
                "score": round(float(r.get("score", 0.0)), 4),
                "source_type": "web",
                "source_url": r.get("url"),
            }
        )
        lines.append(f"[{n}] ({r.get('title', 'web')}) {text}\nURL: {r.get('url')}")
    return "\n\n".join(lines), new_sources


# ── Nodes ───────────────────────────────────────────────────────────────────


def agent_node(state: AgentState) -> dict:
    settings = get_settings()
    writer = get_stream_writer()
    step_n = len(state["trace"]) + 1
    label = "Planning" if state["steps_used"] == 0 else "Reviewing results"
    trace_step = {"n": step_n, "kind": "planning", "label": label}
    writer({"trace": trace_step})

    llm = ChatAnthropic(
        model=settings.LLM_MODEL_AGENT,
        api_key=settings.ANTHROPIC_API_KEY,
        max_tokens=settings.CHAT_MAX_TOKENS,
        streaming=True,
    ).bind_tools(TOOL_SCHEMAS)
    response = llm.invoke(state["messages"])
    return {"messages": [response], "trace": state["trace"] + [trace_step]}


def tools_node(state: AgentState) -> dict:
    writer = get_stream_writer()
    last = state["messages"][-1]
    assert isinstance(last, AIMessage)

    sources = list(state["sources"])
    trace = list(state["trace"])
    tool_messages: list[ToolMessage] = []

    for call in last.tool_calls:
        query = str(call["args"].get("query", ""))[:300]
        kind = "knowledge" if call["name"] == "search_knowledge" else "web"
        t0 = time.perf_counter()
        if call["name"] == "search_knowledge":
            text, new_sources = _run_knowledge(
                state["tenant_id"], query, len(sources) + 1
            )
        else:
            text, new_sources = _run_web(query, len(sources) + 1)
        ms = round((time.perf_counter() - t0) * 1000)

        sources.extend(new_sources)
        step = {
            "n": len(trace) + 1,
            "kind": kind,
            "label": "Searching knowledge" if kind == "knowledge" else "Searching the web",
            "detail": query,
            "ms": ms,
        }
        trace.append(step)
        writer({"trace": step})
        writer({"sources": sources})
        tool_messages.append(ToolMessage(content=text, tool_call_id=call["id"]))

    return {
        "messages": tool_messages,
        "sources": sources,
        "steps_used": state["steps_used"] + len(last.tool_calls),
        "trace": trace,
    }


def route(state: AgentState) -> str:
    last = state["messages"][-1]
    if (
        isinstance(last, AIMessage)
        and last.tool_calls
        and state["steps_used"] < get_settings().AGENT_MAX_STEPS
    ):
        return "tools"
    return END


_graph = None


def get_graph():
    global _graph
    if _graph is None:
        builder = StateGraph(AgentState)
        builder.add_node("agent", agent_node)
        builder.add_node("tools", tools_node)
        builder.set_entry_point("agent")
        builder.add_conditional_edges("agent", route, {"tools": "tools", END: END})
        builder.add_edge("tools", "agent")
        _graph = builder.compile()
    return _graph


# ── Entry point for the SSE endpoint ────────────────────────────────────────


def initial_state(
    tenant_id: uuid.UUID, question: str, history: list[dict]
) -> AgentState:
    messages: list[BaseMessage] = [SystemMessage(content=SYSTEM_PROMPT)]
    for turn in history:
        cls = HumanMessage if turn["role"] == "user" else AIMessage
        messages.append(cls(content=turn["content"]))
    messages.append(HumanMessage(content=question))
    return {
        "messages": messages,
        "tenant_id": str(tenant_id),
        "sources": [],
        "steps_used": 0,
        "trace": [],
    }


def chunk_text(chunk) -> str:
    """Extract streamed text from an AIMessageChunk (anthropic content can be
    a string or a list of typed blocks)."""
    content = getattr(chunk, "content", None)
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            part.get("text", "")
            for part in content
            if isinstance(part, dict) and part.get("type") in ("text", None)
        )
    return ""
