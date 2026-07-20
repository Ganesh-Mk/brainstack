# 🤖 BrainStack — Product Phase 6: The Agent (Backend Phase 4)

> **Companion to `PROJECT_GUIDE.md` Part 3 §Phase 4 (7–10 days).** Phase 5
> shipped a *fixed* pipeline: every question retrieves, every answer comes
> from documents. Phase 6 replaces it with **a brain that decides** — search
> the workspace's knowledge, search the web, or both, or neither — and shows
> its reasoning live in the **Agent Trace panel**.
>
> The guide's done-when: *"Compare our refund policy with competitors"*
> visibly does `🧠 Planning → 🔍 Knowledge → 🌐 Web → ✍️ Drafting` in the
> trace, live.

---

## 1. Goal & definition of done

1. Ask a **doc question** → the agent uses only knowledge search, cites `[n]`
   as before.
2. Ask a **current-events question** → it reaches for **web search (Tavily)**
   instead.
3. Ask the **comparison question** → it uses *both*, and the trace shows every
   step as it happens.
4. Grounding survives: unanswerable-from-anywhere still gets the short refusal.
5. All of Phase 5's guarantees hold (persistence contract, isolation,
   citations to the page, cost caps).

---

## 2. The guide's pedagogy, honored: raw loop first

Same pattern as Phase 3's lab — **feel the mechanism before the framework**:

- **`lab/agent_lab.py`** — the raw `while stop_reason == "tool_use"` loop,
  written by hand with the Anthropic SDK. Two real tools (`search_knowledge`
  against real Pinecone, `web_search` against real Tavily), heavily
  commented, run against real questions. The learning artifact stays in
  `lab/` forever.
- **Then** the production version in `backend/` uses **LangGraph**:
  `AgentState`, an agent node ↔ tools node loop with conditional edges, and
  event streaming into the existing SSE endpoint.

The guide's warning becomes a task: *"your agent will search the web for
internal policy — that's a bug in your tool descriptions."* Tool descriptions
get written carefully and **tested with a routing eval** (a handful of
questions asserting which tool(s) got called).

---

## 3. Backend

### The two native tools (per architecture decision #2 — NOT MCP)

| Tool | Does |
|---|---|
| `search_knowledge` | The Phase-5 retrieval: embed → tenant namespace top-6 → chunk hydration. Returns numbered passages. Description tuned: *"internal company documents, policies, handbooks — always try this first for anything about the company."* |
| `web_search` | **Tavily** (`TAVILY_API_KEY` — already in `.env`, tested). Returns titles + snippets + URLs. Description tuned: *"current public information — competitors, news, prices, anything not in company documents."* |

### The graph

```
            ┌──────────┐   tool_calls?   ┌───────────┐
 question → │  agent    │ ──────yes────→ │  tools    │ ──┐
            │ (Claude + │ ←──────────────│ (execute) │   │ loop (max 4 steps)
            │  tools)   │       results  └───────────┘   │
            └──────────┘ ←───────────────────────────────┘
                 │ no tool calls
                 ▼
             final answer (streamed)
```

- **State**: messages, tenant_id, accumulated sources, trace steps.
- **Caps**: max 4 tool invocations per question, tool results truncated,
  overall timeout — a runaway loop costs cents, not dollars.
- **Model**: `claude-haiku-4-5` by default (env-swappable). The root `.env`'s
  `LLM_MODEL_AGENT=claude-opus-4-8` gets revised to Haiku — cost discipline
  while learning; one env var upgrades it for demos.

### SSE protocol grows a `trace` event

```
trace   {n, kind: planning|knowledge|web|drafting, label, detail?, ms}
sources {…}   ← now accumulates across knowledge-tool calls; web results
               join the list as {source_type: "web", source_url, title}
delta   {text}
done    {…}   ← now includes the full trace
```

The frontend's sources panel **already handles URL-type sources** (Phase 5
fix) — web citations get the "Open page" treatment for free.

- **The trace is persisted** on the assistant message (like sources), so
  history shows how every answer was produced.
- Citations: knowledge passages stay `[n]`-citable; web results are numbered
  into the same list so the model can cite them too.

---

## 4. Frontend

| Surface | Change |
|---|---|
| **Ask page — right panel** | Becomes two tabs: **Sources** (as today) and **Trace** — the live agent steps with pulsing current step, per-step timing, tool icons. The guide's demo moment. |
| **Agent Trace page** (`/agent/trace`) 🔓 | Unlocks: recent answers across your conversations with their full traces — step timeline, tools used, duration. The Phase-1 mock becomes real. |
| Dashboard | Activity feed stays sample data (Phase 7 makes it real) — no change. |

Demo mode: canned trace matching the Phase-1 mock.

---

## 5. Tests

- Graph loop with a scripted fake LLM: knowledge-only path, web-only path,
  both-tools path, max-steps cap, no-tools direct answer.
- Trace event sequence + persistence; sources accumulate + renumber across
  calls; refusal path unchanged.
- **Routing eval** (real Claude, local only): ~6 questions asserting the
  right tool(s) fired — the tool-description tuning loop the guide demands.
- All Phase ≤5 suites stay green.

## 6. Out of scope

- MCP + the company systems + RBAC-gated connections (**Phase 7** — the
  guide's ⭐⭐ differentiator, with the employee/manager demo).
- Memory beyond the existing history window, reflection, advanced RAG
  (guide Phase 6), evaluation (guide Phase 7).

---

## 7. What YOU need to do

**One 2-minute task before deploy:** Render → `brainstack` service →
Environment → add **`TAVILY_API_KEY`** (copy from root `.env`). Local already
works. Tavily's free tier = 1,000 searches/month — plenty.

Then: the browser checklist in `PHASE_6_COMPLETE.md`, whose centerpiece is
the guide's own demo — watching *Planning → Knowledge → Web → Drafting* light
up live.
