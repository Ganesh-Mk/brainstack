# 📥 BrainStack — Product Phase 4: The Real Ingestion Pipeline (Backend Phase 2)

> **Companion to `PROJECT_GUIDE.md` Part 3 §Phase 2 (5–7 days) and the Phase 3
> lab.** Phase 3 proved the mechanics by hand: extract → chunk → embed →
> cosine → answer. Phase 4 moves those mechanics into the live product —
> async, per-tenant, with live progress — and **unlocks the first real
> feature pages**: the entire Knowledge section.
>
> This is the phase where a user uploads a PDF on **app.brainstack.space**
> and watches it become searchable vectors in *their own* Pinecone namespace.

---

## 1. Goal & definition of done

**Goal:** `upload → parse → chunk → embed → store`, async, per-tenant, with
live progress — in production.

**Done when** (from the guide):

1. Upload a real PDF on the live site and watch the status move through
   **Extracting → Chunking → Embedding (n/N) → Ready** without refreshing.
2. The vector count rises **in that tenant's namespace** in the Pinecone
   console — and a second tenant's library shows nothing.
3. Deleting the document removes its chunks from Postgres **and** its vectors
   from the tenant's namespace.
4. Re-ingesting the same document costs ~$0 (embedding cache hits).

---

## 2. What carries over from the lab (and what changes)

| From the lab (`lab/`) | In the product (`backend/`) |
|---|---|
| PyMuPDF extraction with page numbers | Same — pages become citations in Phase 5 |
| Hand-written 400/80 chunker | **LangChain `RecursiveCharacterTextSplitter`** at the same 400/80 — the lab proved it's the same idea with better cuts (mid-word starts: 18 → 1) |
| `all-MiniLM-L6-v2` via sentence-transformers (PyTorch) | **Same model via `fastembed`** (ONNX). Same 384-dim vectors, compatible with the existing Pinecone index — but no PyTorch, so it fits the Render free tier |
| JSON file store | **Pinecone**, `namespace=tenant_id`, batch upsert of 100 |
| One synchronous script | **FastAPI `BackgroundTasks`** — `POST /documents` returns `202` immediately, pipeline runs behind it |
| — | **Embedding cache**: `sha256(chunk_text) → vector` in Postgres. Re-ingesting while debugging is free (guide's explicit tip — "you will re-ingest a *lot*") |

**Why fastembed and not the lab's sentence-transformers:** PyTorch is hundreds
of MB and Render's free tier has 512MB RAM. fastembed runs the identical model
on ONNX in a fraction of that. Identical vectors, deployable footprint.
*(Fallback if Render still struggles: OpenAI `text-embedding-3-small` with
`dimensions=384` — your key is already tested — same index, no re-architecture.)*

---

## 3. Backend — new surface

### Data model changes (one Alembic migration)

- **`documents`** gains: `source_url` (nullable), `file_path` (nullable — where
  the original lives in storage), `page_count`, `chunk_count`,
  `chunks_done` (progress numerator), `status` gains values
  `extracting | chunking | embedding | ready | failed` (was `processing | ready | failed`),
  `error` stays.
- **`chunks`** gains: `page` (for citations), `content_sha` (indexed — the
  embedding-cache key). The Pinecone vector ID **is** the chunk row's `id`.
- **New `embedding_cache`**: `content_sha (pk)`, `vector (JSON)`, `model`,
  `created_at`. Keyed by text hash, shared across tenants — safe, because
  identical text produces identical vectors; no tenant data leaks through a
  hash lookup.

### File storage — Supabase Storage

Uploaded PDFs must live somewhere durable (Phase 5's citations open the PDF at
a page, so the original file is needed later, not just its chunks).

- **Supabase Storage** (already in your stack, free 1GB): private bucket
  `documents`, object path `{tenant_id}/{document_id}.pdf` — the tenant
  boundary extends into storage paths.
- Backend uploads with the service key; downloads later come through the
  backend (never a public bucket).
- **One manual step for you**: create the bucket in the Supabase dashboard
  (2 clicks — exact steps will be in the completion doc).

### Endpoints (all behind `get_current_user`, tenancy from the dependency only)

| Method & path | Does |
|---|---|
| `POST /documents` (multipart) | Validate PDF (type, ≤15MB) → store file → create `Document(status="extracting")` → schedule pipeline → **`202` + document** |
| `POST /documents/url` | `{url}` → create doc → pipeline uses **trafilatura** to extract the article text |
| `GET /documents` | The tenant's library, newest first |
| `GET /documents/{id}` | One document — **this is the polling target** (status + `chunks_done/chunk_count`) |
| `DELETE /documents/{id}` | Delete Pinecone vectors by chunk IDs (tenant namespace) → chunk rows → storage object → document row |

### The pipeline (`app/services/ingestion.py`)

```
extracting:  PDF → PyMuPDF pages (or URL → trafilatura text)
chunking:    RecursiveCharacterTextSplitter(400, 80) → chunk rows w/ page + sha
embedding:   for each batch of 100 chunks:
                cache lookup by sha → embed only the misses (fastembed)
                write misses to embedding_cache
                pinecone.upsert(batch, namespace=tenant_id)
                documents.chunks_done += len(batch)   ← the progress bar
ready        (any exception → status="failed", error=str(e), partial vectors cleaned)
```

Metadata on every vector: `{document_id, page, text[:900]}` — enough for
Phase 5 to cite without a Postgres round-trip.

---

## 4. Frontend — the Knowledge section unlocks 🔓

The Phase-1 promise pays off: flip `locked: false` in `lib/nav.ts` and replace
three `<ComingSoon>` pages with the real thing. The mocks built in Phase 1 are
the design spec — the real pages keep their layout.

| Page | Becomes |
|---|---|
| **Knowledge → Library** (`/knowledge`) | Real table: name, source icon (pdf/url), status badge, **live progress bar** while embedding (polls `GET /documents/{id}` every 1.5s until `ready`/`failed`), chunk & page counts, delete with confirm |
| **Knowledge → Add Sources** (`/knowledge/add`) | Real dropzone (drag-drop + click, PDF ≤15MB) and a URL form; submit → toast → redirect to the Library where progress is already ticking |
| **Knowledge → Ingestion** (`/knowledge/ingestion`) | The live pipeline view: the most recent documents rendered as stage indicators (Extract → Chunk → Embed n/N → Ready) — the "watch it work" page from the Phase-1 mock |
| Dashboard | One real number appears: **Documents indexed** (count from the API). Everything else stays sample-data |

Demo-mode contract continues: with `NEXT_PUBLIC_API_URL` unset, these pages
show the Phase-1 mock previews (no half-broken production).

---

## 5. Deployment notes

- `backend/requirements.txt` gains: `fastembed`, `langchain-text-splitters`,
  `pinecone`, `trafilatura`, `python-multipart`, `httpx`. **No PyTorch.**
- First fastembed call downloads the ONNX model (~30MB) to disk — on Render
  this happens once per deploy at first ingestion; acceptable now, revisit if
  cold ingests annoy.
- Render free tier sleeps: an upload right after a wake works (the request
  itself wakes it) — but a sleep **mid-pipeline** can kill a background task.
  Mitigation now: docs are small and the pipeline runs in seconds; real fix
  (worker + queue) is deliberately deferred per the guide ("BackgroundTasks
  now, Celery later").
- New env var: none required — Supabase URL + secret key, Pinecone key, and
  the model names are already in `.env` and on Render. ✅

---

## 6. Testing

- **Backend pytest**: upload flow (mocking storage/Pinecone/embeddings),
  tenant isolation on list/get/delete (tenant B cannot see or delete tenant
  A's doc — 404), URL validation, size/type rejection, delete cleanup calls.
- **Live verification** (I'll run before handoff): signup → upload a real
  multi-page PDF → poll to `ready` → Pinecone namespace count matches
  `chunk_count` → query vectors return the doc's text → delete → namespace
  back to zero.
- **Your checklist** in `PHASE_4_COMPLETE.md`: do the same through the browser
  on app.brainstack.space, plus the two-tenant isolation check.

---

## 7. Explicitly OUT of scope

- Asking questions / retrieval endpoints (that's Phase 5 — Grounded Q&A with
  citations + streaming, the "portfolio project" milestone).
- DOCX/other formats (PDF + URL only, per the guide), OCR for scanned PDFs.
- Celery/queue workers, retry semantics, webhooks.
- Unlocking any page outside the Knowledge group.

---

## 8. What YOU need to do

- **One 2-minute task, before I wire storage**: Supabase dashboard →
  **Storage → New bucket** → name `documents`, **private** (not public) →
  create. Everything else — code, migration, deploy — needs nothing from you.
- After it ships: run the browser checklist in `PHASE_4_COMPLETE.md`.
