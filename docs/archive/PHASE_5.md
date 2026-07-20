# 💬 BrainStack — Product Phase 5: Grounded Q&A with Citations + Streaming (Backend Phase 3)

> **Companion to `PROJECT_GUIDE.md` Part 3 §Phase 3 (5–7 days).** The pipeline
> from Phase 4 filled tenant namespaces with vectors; this phase finally asks
> them questions. **Ask BrainStack unlocks** — token-by-token streamed answers
> built strictly from the workspace's own documents, with clickable `[1]`
> citations that open the source PDF at the right page.
>
> The guide's words: **"This is already a portfolio project."**

---

## 1. Goal & definition of done

**Done when** (from the guide): you ask a question on the live site, **watch
the answer type itself out**, click a `[2]` citation, **land on the right PDF
page, and see the exact grounding passage in a side panel next to it**
(Tier-2 citations, per architecture decision #5).

Plus the Phase-3-lab lesson carried forward: when the answer isn't in the
documents, the reply is the **short, consistent refusal** — never invention,
never rambling.

---

## 2. Backend — new surface

### Conversations are persisted (small, deliberate scope-pull)

The guide's Phase 3 is stateless, but the Ask page Phase 1 promised has a
conversations pane, and a chat that forgets everything on refresh feels
broken. So: two small tables now, which also become the substrate for
short-term memory in the agent phase.

- **`conversations`** — `id`, `tenant_id`, `user_id`, `title` (auto from the
  first question), `created_at`, `updated_at`.
- **`messages`** — `id`, `conversation_id`, `tenant_id`, `role`
  (`user | assistant`), `content`, `sources` (JSON: the retrieved chunks the
  answer cited), `created_at`.

Conversations are **per-user** within the tenant (your questions aren't your
coworker's), enforced the usual way — ids from `get_current_user()` only.

### Endpoints

| Method & path | Does |
|---|---|
| `GET /conversations` | The user's conversations, newest first |
| `POST /conversations` | Create (empty, titled "New conversation" until first question) |
| `GET /conversations/{id}` | One conversation with its messages + sources |
| `DELETE /conversations/{id}` | Delete conversation + messages |
| `POST /conversations/{id}/messages` → **SSE** | The main event: send a question, stream the answer |
| `GET /documents/{id}/file` | The stored PDF bytes (auth'd) — what the citation viewer opens |

### The ask flow (inside the SSE endpoint)

```
question
  → embed (fastembed, same model as ingestion)
  → pinecone.query(namespace=tenant_id, top_k=6)
  → fetch full chunk texts from Postgres by id
  → numbered context: [1] (doc, p.4) …text…  [2] …
  → prompt = grounding rule + context + recent history + question
  → claude (streaming) → SSE to the browser
  → persist user msg + assistant msg (with sources) on completion
```

**SSE event protocol** (fetch + ReadableStream on the client — `EventSource`
can't send auth headers):

| event | payload |
|---|---|
| `sources` | the retrieved chunks — `[{n, document_id, title, page, text, score}]` — sent **first**, so citation chips can render before the first token |
| `delta` | a text fragment |
| `done` | message ids + usage (tokens in/out) |
| `error` | human-readable failure |

**Prompting** (findings from the lab, §6.5, applied):
- The grounding rule verbatim — short, consistent refusals the UI can rely on.
- "Cite with bracketed numbers like [1] that refer to the numbered context;
  cite after the specific claim, not in a clump at the end."
- Recent conversation history included (last ~6 turns) so follow-ups work —
  history text is capped, retrieval runs on the *new* question.

**Guardrails & edge cases:**
- Empty library → immediate friendly answer ("no sources yet — add documents
  first"), no model call, no cost.
- Retrieval returns nothing relevant (all scores ~0) → still answer grounded;
  the rule handles it.
- Model/stream failure mid-answer → `error` event; the partial assistant
  message is **not** persisted (no half-answers in history).
- Question length capped; answer `max_tokens` capped (cost discipline).
- Concurrent asks in one conversation → second request 409s while one streams.

### Model & cost

`claude-haiku-4-5` (from `LLM_MODEL_DEV` env) — the lab proved it grounds and
refuses correctly, and it's the cost-discipline choice while the product is a
learning vehicle. Swapping to Sonnet for demos = one env var on Render.
Typical Q&A call: ~2–3k input + ≤1k output ≈ **fractions of a cent**.

---

## 3. Frontend — Ask BrainStack unlocks 🔓

The Phase-1 mock becomes real, same three-pane layout:

| Pane | Real behaviour |
|---|---|
| **Conversations** (left) | List + New conversation + delete; auto-titles from the first question; active state |
| **Chat** (center) | User/assistant bubbles; **token-by-token streaming** with a typing cursor; light markdown (paragraphs, bold, lists); `[1]` renders as a clickable accent chip; refusals styled quietly; empty state that points to the Library when there are no sources |
| **Sources** (right) | The retrieved passages for the selected answer; clicking a citation chip highlights the matching passage; **"Open page N"** opens the PDF viewer |
| **PDF viewer** | Modal: fetches `GET /documents/{id}/file` as a blob (auth header), renders in the browser's viewer at `#page=N` — Tier 1 + Tier 2 together |

Demo-mode contract continues: no `NEXT_PUBLIC_API_URL` → the Phase-1 mock
conversation with a "Sample data" chip.

The **dashboard's "Questions asked"** KPI becomes the second real number.

---

## 4. Tests

- Backend: conversation CRUD + per-user + cross-tenant isolation; SSE event
  sequence (mocked Claude stream) — sources first, deltas, done; empty-library
  short-circuit; refusal path persists correctly; mid-stream failure persists
  nothing; file endpoint auth + cross-tenant 404.
- Live e2e (local + production): upload handbook → ask "What is the refund
  policy?" → streamed answer cites [n] → sources match pages → follow-up
  question uses history → unanswerable question refuses → file endpoint
  serves the PDF.

---

## 5. Out of scope (next phases)

- Web search, the agent loop, LangGraph, the Trace panel (Phase 6 — the
  agent). The Ask page's trace pane stays a teaser.
- Query rewriting / hybrid search / re-ranking (advanced RAG, with the agent).
- Evaluation scores on answers (Phase 7).

---

## 6. What YOU need to do

**One 2-minute task, before this deploys:** Render dashboard → your
`brainstack` service → **Environment** → add:

- `ANTHROPIC_API_KEY` = (copy from root `.env`)

That's the only key production is missing (local already works). Optional at
the same time: `LLM_MODEL_DEV=claude-haiku-4-5` (defaults to this anyway).

Then, after it ships: the browser checklist in `PHASE_5_COMPLETE.md` —
including the satisfying one: *click a citation, land on the page.*
