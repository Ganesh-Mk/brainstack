# ✅ Phase 6 — COMPLETE (Backend Phase 4: The Agent)

> **Status: built, tested, and LIVE.** The fixed answer pipeline is gone —
> every question now goes to **an agent that decides**: search the
> workspace's knowledge, search the web (Tavily), both, or neither. And you
> watch it decide, live, in the **Agent trace** panel.
>
> The guide's done-when, verified with real Claude + real Tavily:
> *"Compare our refund policy with competitors"* produced exactly
> **`Planning → Knowledge → Web → Reviewing → Drafting`** — live in the
> trace, then persisted with the answer.

---

## Part A — What was built

### The raw loop first (`lab/agent_lab.py`)

Per the guide's pedagogy — feel the mechanism before the framework — the agent
exists twice:

- **The lab version**: a hand-written `while stop_reason == "tool_use"` loop
  with the Anthropic SDK. ~40 lines of actual mechanism. Run it:
  `backend/.venv/Scripts/python lab/agent_lab.py` — it prints each tool
  decision as it happens. First run routed all three test questions
  correctly with zero tuning.
- **The production version**: the same loop as a **LangGraph StateGraph** —
  `agent` node ↔ `tools` node, a conditional edge on "did the model ask for
  tools?", and a hard cap of 4 tool calls per question.

### The two native tools (NOT MCP — architecture decision #2)

| Tool | Backed by | Routing cue in its description |
|---|---|---|
| `search_knowledge` | The Phase-5 retrieval (fastembed → tenant namespace → chunk hydration) | *"ALWAYS try this first for questions about the company"* |
| `web_search` | **Tavily** | *"CURRENT or EXTERNAL information… never for internal policy"* |

The descriptions are the router — and they worked on the first try, in the
lab and in the routing eval. (MCP arrives next phase, for *external company
systems* only.)

### The SSE protocol grew a `trace` channel

```
trace   {n, kind: planning|knowledge|web|drafting, label, detail, ms}
sources accumulate across tool calls, numbered contiguously — web results
        join the SAME citation list as {source_type: "web", source_url}
delta   the streamed answer tokens (unchanged)
done    now carries the full trace
```

- Traces are **persisted** on every assistant message (new column +
  migration) — history shows how each answer was made, not just what it said.
- Web citations reuse the Phase-5 URL-source treatment: the sources panel
  shows **"Open page"** for them automatically.
- All Phase-5 guarantees held: sources-before-tokens, nothing persisted on
  mid-stream failure, one stream per conversation, per-user isolation.

### Frontend

- **Ask page, right panel** → two tabs: **Sources** and **Agent trace**. On
  send, the panel auto-switches to the trace — you watch steps light up with
  a pulsing current step, tool queries in monospace, per-step timings — then
  flips to Sources when the answer lands.
- **Agent Trace page** (`/agent/trace`) 🔓 — recent answers with their full
  step timelines, total durations, and Knowledge/Web badges.
- Cost discipline: the agent runs **`claude-haiku-4-5`** (the stale
  `LLM_MODEL_AGENT=claude-opus-4-8` in `.env` was corrected). One env var on
  Render upgrades it for demos.

---

## Part B — Verification

**Unit/integration: 40/40** — including 4 graph-loop tests where a scripted
fake model drives the *real* compiled graph (routing paths, source
renumbering across tools, the runaway-loop cap).

**Live e2e (real Claude + real Tavily): local 16/16, production 16/16** —
the identical suite against api.brainstack.space, including the guide's
comparison demo end-to-end with mixed pdf+web citations persisted.

*(Deploy war story, worth remembering: the first production deploy silently
kept serving Phase 5 — the agent libraries were installed locally but never
pinned in `requirements.txt`, so Render's build crashed on import and the
health check refused to promote it. The gate did its job; the fix was three
lines of pins.)*

```
[PASS] K: "How many days of annual leave?"    → planning, knowledge, planning, drafting
       ("25 days… [1]" — web never touched)
[PASS] W: "Latest stable version of Python?"  → planning, web, planning, drafting
       ("Python 3.14" — knowledge never touched)
[PASS] C: "Compare our refund policy with the industry"
       → planning, knowledge, web, planning, drafting
       (1,041-char cited answer; sources mixed {pdf, web})
[PASS] trace persisted with the message; web sources carry real URLs
```

A real bug the tests caught: LangGraph's `add_messages` dedupes by message
id — a naive test double returning the same message object twice silently
*replaced* instead of appending. Worth knowing forever.

---

## Part C — YOUR browser checklist

**The demo (the guide says record this one):**
- [ ] app.brainstack.space → **Ask BrainStack** (make sure the handbook or
      any PDF is in your Library)
- [ ] Ask: **"Compare our client refund policy with what's typical in the
      industry."**
- [ ] Watch the right panel: it flips to **Agent trace** and the steps light
      up one by one — *Planning → Searching knowledge → Searching the web →
      Reviewing results → Drafting* — with the actual search queries and
      timings
      ⏱️ *First question after idle: up to ~60s (free-tier wake). Then fast.*
- [ ] When the answer lands, the panel flips to **Sources** — knowledge
      passages with `p.N` (opens the PDF) *and* web results with **Open
      page** (opens the article), all in one numbered list
- [ ] Click a `[n]` chip in the answer — it highlights the matching source

**The routing proof:**
- [ ] Ask **"How many days of annual leave do we get?"** → trace shows
      *knowledge only* — no web step
- [ ] Ask **"What's the latest stable version of Python?"** → trace shows
      *web only* — no knowledge step
- [ ] Ask something in neither ("what's our office wifi password?") → the
      short refusal, as always

**The record:**
- [ ] Sidebar → **Agent Trace** (Intelligence group — no 🔒 anymore): every
      recent answer with its full step timeline and Knowledge/Web badges
- [ ] Refresh the conversation — the trace is still there on old answers
      (persisted, not ephemeral)

---

## Definition of done (from PHASE_6.md §1)

- [x] Doc question → knowledge only; web question → web only; comparison →
      both — all three verified with real models
- [x] The trace shows every step live, then persists with the answer
- [x] Grounding + refusal survived the agent transition
- [x] All Phase ≤5 guarantees intact (40/40 tests)
- [ ] **You:** the checklist — especially the comparison demo

**Next:** `PROJECT_GUIDE.md` **Backend Phase 5 — MCP + RBAC** ⭐⭐ — the
differentiator. A real Company MCP Server (tickets + workforce analytics),
the agent as an MCP client, and the demo that sells the whole project: a
manager assigns a ticket by asking; an employee *can't*, because the tool
**doesn't exist in their session**. Connections, Tickets, and Workforce
Analytics pages unlock.
