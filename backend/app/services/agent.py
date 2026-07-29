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

Phase 7 — the external boundary is MCP, and RBAC works by CAPABILITY:
assemble_tools() merges the Company MCP Server's tools into the list only for
manager/admin sessions. An employee's agent never connects — assign_ticket
does not exist in their session, absent by construction, not blocked by a
prompt. (The server re-validates role per call anyway: defense in depth.)
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
from app.services import chat, mcp_client


class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    tenant_id: str
    role: str
    tool_schemas: list[dict]  # assembled per session by capability (RBAC)
    sources: list[dict]  # chat.Source dicts, numbered contiguously
    steps_used: int
    trace: list[dict]
    drafts: int  # Phase 8 reflection: attempts examined (hard cap 2)
    question: str  # the current user question (reflection critic context)
    # Phase 8 context, carried in raw as well as baked into the system
    # message: grounded mode builds its OWN system prompt and would otherwise
    # have no way to recover these.
    summary: str | None
    memories: list[str]


# ── Native tools (schemas only — execution is ours, in the tools node) ──────

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

ACTION_ROLES = ("manager", "admin")


def assemble_tools(tenant_id: str, role: str) -> list[dict]:
    """The capability layer — THE RBAC mechanism of this codebase.

    Everyone gets the native tools. Only manager/admin sessions get the
    Company MCP tools discovered and merged; for an employee no connection
    is even made — the tools don't exist in their session."""
    tools = list(TOOL_SCHEMAS)
    if role in ACTION_ROLES:
        tools += mcp_client.discover_tools(tenant_id, role)
    return tools


SYSTEM_PROMPT = """You are BrainStack, a company knowledge assistant with tools.

Routing rules:
- Questions about the company, its policies, documents or people -> search_knowledge first.
- Questions about the outside world (competitors, news, current facts) -> web_search.
- Comparisons between internal policy and the outside world -> use both.
- Follow-ups that point at earlier results ("those error codes", "that
  policy") -> search_knowledge again with a SELF-CONTAINED query rebuilt
  from the conversation (name the actual codes/topics, never "those").
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

# Appended for manager/admin sessions that have the Company tools merged.
_ACTIONS_PROMPT = """
Company systems (tickets, workforce analytics) are connected to this session.
- Requests to assign/reassign tickets, list tickets, or report on an
  employee's workload -> use those company tools directly. Confirm what you
  DID (past tense, from the tool result) — never claim an action you didn't
  perform.
- Action results are facts from the company system; report them without
  bracketed citations (citations are for documents and web sources only).
- If a company tool returns an error message, relay it plainly and suggest
  the fix it mentions.
"""

# Appended for sessions WITHOUT action tools, so refusals are informative
# rather than hallucinated.
_NO_ACTIONS_PROMPT = """
This session has no access to the company's ticketing or workforce systems —
those actions are available to manager and admin accounts only. If asked to
assign tickets or report workloads, say you can't do that from this account
in one polite sentence; a manager or admin can. Never pretend an action
happened.
"""


def system_prompt_parts(
    role: str,
    has_action_tools: bool,
    summary: str | None = None,
    memories: list[str] | None = None,
) -> tuple[str, str]:
    """(static, dynamic) halves of the system prompt.

    The static half is identical for every question a given role asks — the
    Phase 10 prompt-cache prefix. Summary + memories vary per conversation
    and stay outside the cached block. Memory is context, not instruction —
    the prompt says use it when relevant, never recite it unprompted."""
    static = SYSTEM_PROMPT + (
        _ACTIONS_PROMPT if has_action_tools else _NO_ACTIONS_PROMPT
    )
    return static, dynamic_context(summary, memories)


def dynamic_context(summary: str | None, memories: list[str] | None) -> str:
    """The per-conversation half of the system prompt: older turns compressed,
    plus what we remember about this user.

    Shared with grounded mode (services/grounded.py), which builds a different
    static half but must carry the SAME memory block — otherwise selecting the
    local model silently forgets everything the user has ever told us."""
    dynamic = ""
    if summary:
        dynamic += (
            "\nConversation so far (older turns, summarized):\n" + summary + "\n"
        )
    if memories:
        dynamic += (
            "\nLong-term memory — facts stated in earlier conversations by "
            "THE PERSON YOU ARE TALKING TO ('the user' below means them). "
            "Answer their questions about themselves from these facts "
            "directly and confidently (no citation needed); do not recite "
            "them unprompted:\n"
            + "\n".join(f"- {m}" for m in memories)
            + "\n"
        )
    return dynamic


def system_prompt(
    role: str,
    has_action_tools: bool,
    summary: str | None = None,
    memories: list[str] | None = None,
) -> str:
    static, dynamic = system_prompt_parts(role, has_action_tools, summary, memories)
    return static + dynamic


# ── Reflection (Phase 8): critique the draft, retry at most once ────────────

CRITIC_SYSTEM = """You are a strict grounding auditor for an AI answer.

Given numbered source passages and a draft answer, check:
1. Every factual claim is supported by the sources (or is an honest "I don't
   know" / a report of a tool action).
2. Citations [n] point at passages that actually support the claim.
3. The draft answers the question that was asked.

Output ONLY JSON: {"grounded": true/false, "problems": "<one short sentence,
empty when grounded>"}. Be strict about invented facts, lenient about style."""


def critique(draft: str, sources: list[dict], question: str) -> tuple[bool, str]:
    """(grounded, problems). Fails open — a broken critic must never block
    an answer."""
    try:
        from app.services import memory as memory_service

        ctx = "\n\n".join(
            f"[{s['n']}] {s['text'][:600]}" for s in sources[:8]
        )
        raw = memory_service.haiku(
            CRITIC_SYSTEM,
            f"Sources:\n{ctx}\n\nQuestion: {question[:500]}\n\nDraft answer:\n{draft[:2500]}",
            max_tokens=150,
        )
        import json as _json
        import re as _re

        m = _re.search(r"\{.*\}", raw, _re.DOTALL)
        data = _json.loads(m.group(0)) if m else {}
        return bool(data.get("grounded", True)), str(data.get("problems", ""))[:300]
    except Exception:
        return True, ""


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
    ).bind_tools(state.get("tool_schemas") or TOOL_SCHEMAS)
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
        t0 = time.perf_counter()
        if call["name"] == "search_knowledge":
            detail = str(call["args"].get("query", ""))[:300]
            kind, label = "knowledge", "Searching knowledge"
            text, new_sources = _run_knowledge(
                state["tenant_id"], detail, len(sources) + 1
            )
        elif call["name"] == "web_search":
            detail = str(call["args"].get("query", ""))[:300]
            kind, label = "web", "Searching the web"
            text, new_sources = _run_web(detail, len(sources) + 1)
        else:
            # Merged from the Company MCP Server — execute over the protocol.
            # Only reachable when the capability layer put it in the session.
            detail = ", ".join(f"{k}: {v}" for k, v in call["args"].items() if v)[:300]
            kind, label = "action", f"Company MCP · {call['name']}"
            text, _is_err = mcp_client.call_tool(
                call["name"], call["args"], state["tenant_id"], state["role"]
            )
            new_sources = []  # actions are facts, not citations
        ms = round((time.perf_counter() - t0) * 1000)

        sources.extend(new_sources)
        step = {
            "n": len(trace) + 1,
            "kind": kind,
            "label": label,
            "detail": detail,
            "ms": ms,
        }
        trace.append(step)
        writer({"trace": step})
        if new_sources:
            writer({"sources": sources})
        tool_messages.append(ToolMessage(content=text, tool_call_id=call["id"]))

    return {
        "messages": tool_messages,
        "sources": sources,
        "steps_used": state["steps_used"] + len(last.tool_calls),
        "trace": trace,
    }


def reflect_node(state: AgentState) -> dict:
    """Examine the draft. Grounded → ship it. Not grounded → tell the UI to
    clear the streamed draft (reset), record a reflection trace step, and
    send the critique back for ONE rewrite. drafts is the attempt counter —
    route() never sends a second draft here, so 2 attempts is a hard cap."""
    writer = get_stream_writer()
    last = state["messages"][-1]
    draft = last.content if isinstance(last.content, str) else str(last.content)

    t0 = time.perf_counter()
    grounded, problems = critique(draft, state["sources"], state["question"])
    ms = round((time.perf_counter() - t0) * 1000)

    if grounded:
        # No trace step for a clean pass — the timeline stays honest about
        # WORK done, not checks passed.
        return {"drafts": state["drafts"] + 1}

    step = {
        "n": len(state["trace"]) + 1,
        "kind": "reflection",
        "label": "Reflecting — rewriting the draft",
        "detail": problems or "The draft wasn't fully grounded.",
        "ms": ms,
    }
    writer({"reset": True})
    writer({"trace": step})
    retry = HumanMessage(
        content=(
            f"Your draft answer has grounding problems: {problems or 'unsupported claims'}. "
            "Rewrite the answer using ONLY the tool results above. Keep "
            "citations only where a source genuinely supports the claim; "
            "drop anything you cannot support."
        )
    )
    return {
        "messages": [retry],
        "drafts": state["drafts"] + 1,
        "trace": state["trace"] + [step],
    }


def route(state: AgentState) -> str:
    last = state["messages"][-1]
    if (
        isinstance(last, AIMessage)
        and last.tool_calls
        and state["steps_used"] < get_settings().AGENT_MAX_STEPS
    ):
        return "tools"
    if (
        get_settings().REFLECTION_ENABLED
        and isinstance(last, AIMessage)
        and not last.tool_calls
        and state["sources"]  # nothing to ground against otherwise
        and state["drafts"] == 0  # examine the FIRST draft only
    ):
        return "reflect"
    return END


def route_after_reflect(state: AgentState) -> str:
    # A retry request was appended → back to the agent; otherwise ship.
    return "agent" if isinstance(state["messages"][-1], HumanMessage) else END


_graph = None


def get_graph():
    global _graph
    if _graph is None:
        builder = StateGraph(AgentState)
        builder.add_node("agent", agent_node)
        builder.add_node("tools", tools_node)
        builder.add_node("reflect", reflect_node)
        builder.set_entry_point("agent")
        builder.add_conditional_edges(
            "agent", route, {"tools": "tools", "reflect": "reflect", END: END}
        )
        builder.add_conditional_edges(
            "reflect", route_after_reflect, {"agent": "agent", END: END}
        )
        builder.add_edge("tools", "agent")
        _graph = builder.compile()
    return _graph


# ── Entry point for the SSE endpoint ────────────────────────────────────────


def initial_state(
    tenant_id: uuid.UUID,
    question: str,
    history: list[dict],
    role: str = "employee",
    summary: str | None = None,
    memories: list[str] | None = None,
) -> AgentState:
    # Capability assembly happens HERE, once per question — role comes from
    # get_current_user() upstream, never from the client.
    tools = assemble_tools(str(tenant_id), role)
    has_actions = len(tools) > len(TOOL_SCHEMAS)
    static, dynamic = system_prompt_parts(role, has_actions, summary, memories)
    if get_settings().PROMPT_CACHE_ENABLED:
        # Anthropic prompt caching: the stable prefix block is marked
        # ephemeral-cacheable; per-conversation context stays uncached after
        # it. Cuts repeat input cost on every follow-up question.
        blocks: list = [
            {
                "type": "text",
                "text": static,
                "cache_control": {"type": "ephemeral"},
            }
        ]
        if dynamic:
            blocks.append({"type": "text", "text": dynamic})
        system_msg = SystemMessage(content=blocks)
    else:
        system_msg = SystemMessage(content=static + dynamic)
    messages: list[BaseMessage] = [system_msg]
    for turn in history:
        cls = HumanMessage if turn["role"] == "user" else AIMessage
        messages.append(cls(content=turn["content"]))
    messages.append(HumanMessage(content=question))
    return {
        "messages": messages,
        "tenant_id": str(tenant_id),
        "role": role,
        "tool_schemas": tools,
        "sources": [],
        "steps_used": 0,
        "trace": [],
        "drafts": 0,
        "question": question,
        "summary": summary,
        "memories": list(memories or []),
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
