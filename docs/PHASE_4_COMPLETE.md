# ✅ Phase 4 — COMPLETE (Backend Phase 2: The Real Ingestion Pipeline)

> **Status: built, tested, and LIVE — the Knowledge section is unlocked on
> app.brainstack.space.** Upload a PDF on the live site and watch it move
> through Extracting → Chunking → Embedding (n/N) → Ready, landing as vectors
> in your workspace's private Pinecone namespace.
>
> Verified twice before this report: **26/26 automated e2e checks** against
> real Supabase + Pinecone + Storage locally, then the same suite re-run
> against **production** (api.brainstack.space). Results in Part C.

---

## Part A — What was built

### The pipeline (backend)

```
POST /documents (202, instantly)          POST /documents/url
        │                                        │
        ▼  background task, own DB session       ▼
   queued → extracting → chunking → embedding (n/N) → ready
                │             │            │
             PyMuPDF     LangChain     fastembed → cache → Pinecone
           (页 numbers)   splitter      (batches of 100, live progress
                          (400/80)       committed after every batch)
```

- **`POST /documents`** — multipart PDF upload. Validates extension/MIME,
  rejects empties, enforces 15MB, checks the `%PDF-` magic bytes (a `.txt`
  renamed to `.pdf` is caught). Stores the original in **Supabase Storage**
  (private bucket, path `{tenant_id}/{document_id}.pdf` — the tenant boundary
  extends into storage). Returns `202` immediately; the pipeline runs behind
  it.
- **`POST /documents/url`** — fetches the page (20s timeout, 5MB cap),
  extracts the article with **trafilatura** (nav/ads stripped), uses the
  page's real `<title>`. **SSRF-guarded**: only http(s), and the hostname is
  DNS-resolved and rejected if any address is private/loopback/link-local —
  the backend will not fetch your cloud metadata endpoint.
- **Chunking** — LangChain `RecursiveCharacterTextSplitter` at **400/80**,
  the values the Phase 3 lab measured as optimal (8/8 hit@1). Page numbers
  ride along on every chunk — they become Phase 5's citations.
- **Embeddings** — the lab's exact model (`all-MiniLM-L6-v2`, 384-dim) via
  **fastembed** (ONNX): identical vectors, no PyTorch, fits Render's free
  tier. Every text is cached in Postgres by `sha256(text)` — **re-ingesting
  the same document costs $0** (verified: second upload embeds zero texts).
- **Pinecone** — batch upsert of 100, `namespace = tenant_id` (derived only
  from `get_current_user()`), vector id = chunk row id, metadata carries
  `{document_id, page, text}` for citation lookups without a DB round-trip.
- **Progress** — `chunks_done` is committed after every batch; the frontend
  polls and the bar moves in real time.

### Correctness properties (the edge-case work)

| Property | How |
|---|---|
| **Never half-indexed** | Any failure → status `failed` with a human-readable error, and every vector/chunk the run wrote is removed. A failed document is inert. |
| **Deletion always wins** | `DELETE` works even mid-pipeline: it cleans vectors → chunks → file → row, and the running task re-checks the document at every stage *and every batch*, aborting and removing its own writes if the row is gone. |
| **Tenant isolation** | List/get/delete all filter on the authenticated tenant; cross-tenant access is a **404** (existence is not confirmed). Vectors live in per-tenant namespaces keyed by the same dependency. |
| **RBAC** | Mirrors the nav registry: all roles read the library; **add + delete are admin-only** (403 otherwise). |
| **Stable list order** | Newest-first with an id tiebreak, so the table never reshuffles between polls. |
| **Failure paths are user-legible** | Password-protected PDF, scanned-image PDF (no text), unreachable URL, non-article page, oversized page — each produces a distinct, readable error on the document. |

### The Knowledge section (frontend) 🔓

Three Coming-Soon pages became real — same design system, zero new visual
vocabulary, everything token-driven:

- **Library** (`/knowledge`, all roles) — search-filterable table; source icon
  + title + "48 pages · 312 chunks" meta line; status as a quiet success
  badge, a **live inline progress bar** (`182/312`), or a danger badge with
  the error on hover; relative timestamps; hover-reveal delete with a proper
  confirm modal; skeleton loading; empty state with a call-to-action.
- **Add Sources** (`/knowledge/add`, admin) — drag-and-drop **multi-file**
  dropzone with client-side validation (type/size/empty), per-file list with
  sizes, one-click upload of the batch; URL card with inline validation; a
  compact "What happens next" pipeline explainer.
- **Ingestion** (`/knowledge/ingestion`, admin) — each document as a live
  4-stage stepper (Extract → Chunk → Embed n/N → Index) with a pulsing
  current stage and a "N processing" badge in the header.
- **Dashboard** — "Documents indexed" is now the **first real number** on the
  dashboard (with "N processing" as its delta while the pipeline runs).
- **Polling** — one shared hook: 1.5s while anything is processing, silent
  when idle. **Demo mode intact**: with no `NEXT_PUBLIC_API_URL`, the pages
  show sample data with a "Sample data" chip — nothing half-breaks.
- The **Roadmap** page auto-updated (it renders from the nav registry —
  Knowledge now shows as live).

### Also done for you

- The **Supabase `documents` bucket** was created programmatically (private,
  15MB limit) — the manual step from the plan disappeared.
- New migration applied to Supabase (`documents` pipeline fields, `chunks.page`
  + `content_sha`, new `embedding_cache` table). Render re-runs migrations on
  every deploy, so schema stays in sync automatically.

---

## Part B — Concepts this phase made real

1. **Async job with progress** — `202 Accepted` + a background task that
   commits progress in batches is the simplest honest version of a job queue.
   (Its limits are known: a Render free-tier sleep mid-pipeline could kill a
   task. Fine at current document sizes; Celery/queue is a later phase, per
   the guide.)
2. **Namespace-per-tenant** — the Phase 0 rule (`tenant_id` only from the
   auth dependency) now physically partitions the vector space. Tenant B's
   namespace stayed at **0 vectors** throughout every test.
3. **Content-addressed caching** — `sha256(text)` as the cache key means
   dedup is free and tenant-safe (identical text ⇒ identical vector; nothing
   tenant-specific can leak through a hash).
4. **The lab paid off directly** — chunk size (400/80), the splitter choice,
   page-number plumbing, and the embedding model were all decisions *measured*
   in Phase 3, not guessed.

---

## Part C — Verification results

**Local, against real Supabase/Pinecone/Storage: 26/26.**
**Production (api.brainstack.space, Render free tier): 26/26** — the identical
suite, re-run after deploy. fastembed ran comfortably within the free tier's
memory; the URL pipeline pulled a real Wikipedia article to `ready` with 53
chunks and the page's true title. Vercel serves the three unlocked Knowledge
pages (verified in the deployed HTML — no Coming Soon remnants).

Highlights from the automated run:

```
[PASS] pipeline reached ready         — extracting → chunking → embedding → ready
[PASS] page_count correct (4)           chunks 26, progress 26/26
[PASS] pinecone namespace count == chunk_count — 26 vs 26
[PASS] semantic query returns handbook text
[PASS] vector metadata carries citation fields
[PASS] tenant B list empty / get 404 / delete 404 / namespace 0
[PASS] txt rejected 415; fake-pdf magic-bytes rejected 415
[PASS] corrupt pdf -> failed with readable error
[PASS] localhost URL blocked (SSRF)
[PASS] url pipeline ready with real title ("Product design - Wikipedia")
[PASS] delete -> 204; namespace back to 0; library empty
```

---

## Part D — YOUR browser checklist

Everything below is on the live site. (Local works too: `uvicorn` +
`npm run dev` as before.)

**The happy path:**
- [ ] Log into **app.brainstack.space** (or sign up a fresh company)
- [ ] Sidebar: **Knowledge group has no 🔒 anymore** — Library, Add Sources,
      Ingestion are live
- [ ] **Add Sources** → drop a real PDF (a manual, a paper, anything with
      text ≤15MB) → *Upload and index*
- [ ] You land in the **Library**: watch the status move
      **Extracting → Chunking → Embedding 40/118 → Ready** with the bar
      filling — no refreshes
      ⏱️ *First upload after the backend has been idle takes ~60–90s extra:
      free-tier wake + one-time embedding-model download. After that it's
      seconds.*
- [ ] Open **Ingestion** while something processes — the stage pills light up
      live
- [ ] **Dashboard** → "Documents indexed" now shows your real count
- [ ] **Add Sources → Add a web page** → paste a public article/docs URL →
      watch it appear with the page's real title
- [ ] Search box in the Library filters instantly

**The guardrails (try to break it):**
- [ ] Try uploading a `.txt` or an image → clean error, nothing added
- [ ] Rename some `.txt` to `.pdf` and upload → rejected ("does not look like
      a valid PDF")
- [ ] Paste `http://localhost:8000` as a URL → it fails safely (SSRF guard)
- [ ] Avatar menu → **preview the Employee role** → Add Sources & Ingestion
      vanish from the sidebar; the Library stays (read-only — no delete
      buttons). Switch back to admin.
- [ ] Delete a document → confirm modal → it's gone; dashboard count drops

**The isolation proof (the one that matters):**
- [ ] Open a private window → sign up a **second company** → its Library is
      empty, its dashboard shows 0 — your documents are invisible to it

**Optional, for the satisfying visual:**
- [ ] [app.pinecone.io](https://app.pinecone.io) → `brainstack` index → watch
      your tenant's namespace vector count rise on upload and hit 0 on delete

---

## Definition of done (from PHASE_4.md §1)

- [x] Live PDF upload walks Extracting → Chunking → Embedding (n/N) → Ready
      without a refresh
- [x] Vector count rises in that tenant's namespace; a second tenant sees
      nothing (verified: 0 vectors, 404s)
- [x] Delete removes chunks from Postgres AND vectors from the namespace
      (verified to zero)
- [x] Re-ingesting the same document costs ~$0 (cache-hit test: zero texts
      re-embedded)
- [x] 26/26 automated e2e checks + 26/26 unit/integration tests green
- [ ] **You:** run the browser checklist above

**Next:** `PROJECT_GUIDE.md` **Backend Phase 3 — Grounded Q&A with citations
+ streaming**: `POST /chat/stream`, token-by-token answers with `[1]`-style
citations that open the PDF at the right page — the phase the guide calls
"already a portfolio project." The **Ask BrainStack** page unlocks.
