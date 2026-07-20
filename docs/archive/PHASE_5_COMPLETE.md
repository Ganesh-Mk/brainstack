# ✅ Phase 5 — COMPLETE (Backend Phase 3: Grounded Q&A + Citations + Streaming)

> **Status: built, tested, and LIVE.** Ask BrainStack is unlocked on
> app.brainstack.space — token-by-token streamed answers built strictly from
> your workspace's documents, with clickable `[n]` citations that show the
> exact passage AND open the source PDF at the cited page.
>
> The guide's milestone: **"This is already a portfolio project."** It is.
>
> Verified with **real Claude**: 17/17 automated e2e checks locally, then the
> identical suite against **production** — where the only deviation was the
> documented one-time cold start (first-ever request: 30.6s to first token;
> warm: **4.5s**, with a correctly cited answer).

---

## Part A — What was built

### The ask flow (backend)

```
question ─→ embed (fastembed, same model as ingestion)
         ─→ Pinecone top-6, namespace = tenant_id
         ─→ hydrate full chunk text from Postgres
         ─→ numbered context: [1] (handbook, p.2) …
         ─→ grounded prompt + last 6 turns of history
         ─→ Claude (claude-haiku-4-5), streaming
         ─→ SSE to the browser:  sources → delta* → done | error
```

- **`sources` is sent before the first token** — the citation panel renders
  while the model is still thinking.
- **The grounding prompt applies the lab's findings** (PHASE_3 §6.5): the
  refusal is one trained sentence — production measured it at **64
  characters**, every time — so the UI can rely on its shape. Citations are
  instructed to sit *after the claim they support*, numbered against the
  context, never invented.
- **History without replay**: the last 6 turns ride along for follow-ups
  ("do those roll over?" worked in production), but old context passages are
  not re-sent — retrieval runs fresh per question. Cost stays flat.
- **Persistence contract**: the user message and assistant message commit
  *together, after the stream completes*. A mid-stream failure emits `error`
  and persists **nothing** — history never contains half-answers (tested).
- **Empty library short-circuit**: friendly pointer to Add Sources, zero
  model calls, zero cost.
- **Conversations are per-user within the tenant** — your coworker cannot
  see, ask into, or delete your threads (tested: same-tenant employee gets
  404s).
- **One stream per conversation** at a time (409 otherwise).
- **`GET /documents/{id}/file`** serves the original PDF through auth — the
  private bucket stays private; the viewer fetches it as a blob.

### A real bug the tests caught before production

Message order was initially `created_at` — but a turn's user + assistant rows
commit in **one transaction**, so Postgres stamps them with the *identical*
timestamp and the order is genuinely ambiguous. Messages now carry an explicit
per-conversation `seq`. (SQLite's coarse timestamps exposed in a test what
would have been an intermittent production bug.)

### The Ask experience (frontend) 🔓

Three panes, all inside the existing design system:

- **Conversations** — list with active state, hover-delete, auto-titles from
  the first question, `+` for a new thread.
- **Chat** — user bubbles right, grounded answers left; **token-by-token
  streaming** with a typing cursor and a three-dot "retrieving" state before
  the first token; a **purpose-built markdown renderer** (the exact subset
  the system prompt enforces — paragraphs, bold, dash lists, inline code)
  with **`[n]` rendered as clickable citation chips**; composer with
  Enter-to-send / Shift+Enter newline and auto-growing textarea; on failure
  the question is returned to the input (because nothing was saved).
- **Sources** — the passages behind the selected answer, with relevance
  scores; clicking a chip highlights the matching passage; **p.N opens the
  PDF viewer at that page** (Tier 1 + Tier 2 citations together).
- **Dashboard** — "Questions asked" is the second real KPI.
- Demo mode intact: a canned cited exchange with a "Sample data" chip.

---

## Part B — Verification results

**Local (real Claude): 17/17.** **Production: 16/17 + warm-latency retest.**

```
[PASS] event order sources->deltas->done
[PASS] answer contains the fact          "Employees receive **25 days**… [1]"
[PASS] answer cites [n] within range     cited [1]
[PASS] follow-up uses history            "No, leave does not roll over [5]"
[PASS] unanswerable question refuses     "I don't know — that isn't covered
                                          in this workspace's documents."
[PASS] refusal is short                  64 chars
[PASS] 6 messages in order               user/assistant ×3
[PASS] assistant messages carry sources  (pages within the real document)
[PASS] title from first question · question_count == 3
[PASS] file endpoint serves the PDF
[PASS] conversation listed · deleted
[prod] first-ever request: 30.6s to first token (one-time model download)
[prod] warm request: 4.5s to first token, correctly cited answer
```

Also true: **you had already added `ANTHROPIC_API_KEY` to Render** — the
production run answered with real Claude on the first try. Nothing left to
configure.

### Cost check

Each question ≈ 2–3k input + a few hundred output tokens on Haiku — roughly
**$0.005**. A hundred questions ≈ half a dollar. Swap to Sonnet for demos by
setting `LLM_MODEL_DEV=claude-sonnet-5` on Render.

---

## Part C — YOUR browser checklist

**The headline flow (the portfolio-project moment):**
- [ ] app.brainstack.space → **Ask BrainStack** (no 🔒 in the sidebar anymore)
- [ ] Make sure your Library has at least one ready document (the lab's
      `handbook.pdf` from `lab/data/` is perfect — the checklist below assumes
      it)
- [ ] Ask: **"How many days of annual leave do employees get?"**
- [ ] Watch: sources appear on the right *first*, then the answer **types
      itself out**, ending with a `[1]` chip
      ⏱️ *First question after the backend slept: up to ~60s (wake + model
      warm-up). After that: a few seconds.*
- [ ] Click the **[1] chip** → the source panel highlights the passage
- [ ] Click **p.N** on that source → the PDF opens **at that page** ← this is
      the moment
- [ ] Ask the follow-up: **"And do those days roll over?"** → it answers from
      conversation context
- [ ] Ask: **"What is the parental leave policy?"** → one short sentence:
      *"I don't know — that isn't covered in this workspace's documents."*

**The state that persists:**
- [ ] Refresh the page → the conversation is still there, titled after your
      first question, citations still clickable
- [ ] New conversation via **+**, ask something else, switch between the two
- [ ] Delete a conversation → gone

**The boundaries:**
- [ ] Invite/preview a second user (or role-preview Employee) — they can ask,
      but they get their **own** conversation list; yours is invisible to them
- [ ] Sign into a second company → Ask there answers only from *its* (empty)
      library — the friendly "no sources yet" reply, instantly
- [ ] Dashboard → "Questions asked" counts your real questions now

---

## Definition of done (from PHASE_5.md §1)

- [x] Ask on the live site → answer streams token by token
- [x] Click `[2]` → land on the right PDF page **and** see the grounding
      passage beside it (Tier 1 + Tier 2)
- [x] Unanswerable → the short, consistent refusal (64 chars, measured)
- [x] Follow-ups work through conversation history
- [x] 36/36 unit+integration tests; 17/17 live e2e with real Claude
- [ ] **You:** the checklist above — especially the citation-to-page moment

**Next:** `PROJECT_GUIDE.md` **Backend Phase 4 — The Agent (LangGraph)**:
first a raw tool-calling loop written by hand (feel the loop), then LangGraph
state/nodes/edges, then `astream_events()` wired into the SSE stream — and the
**Agent Trace panel** comes alive. Tavily web search joins the toolset.
