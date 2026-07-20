# BrainStack — docs

## Active

| Doc | What it is |
|---|---|
| [`PROJECT_IDEA.md`](PROJECT_IDEA.md) | The product: what BrainStack is, who it's for, the feature set. |
| [`PROJECT_GUIDE.md`](PROJECT_GUIDE.md) | The learning + build guide: every AI concept explained, and the 8-phase backend plan (Part 3). The north star. |
| [`PHASE_3.md`](PHASE_3.md) | **Current phase** — the plan. |
| [`PHASE_3_COMPLETE.md`](PHASE_3_COMPLETE.md) | Phase 3 results, a full explanation of how RAG works, and the test checklist. |

## `archive/`

Phases that are **finished and shipped**. Kept for reference (decisions,
deployment settings, what was verified) but not part of active work.

| Doc | Shipped |
|---|---|
| `archive/PHASE_1.md` / `PHASE_1_COMPLETE.md` | Product shell, design system, marketing site — live on Vercel |
| `archive/PHASE_2.md` / `PHASE_2_COMPLETE.md` | Multi-tenant FastAPI backend + JWT auth — live on Render |

## How the numbering works

Two tracks meet in these docs:

- **Product phases** (`PHASE_1`, `PHASE_2`, `PHASE_3` …) — what *we* ship, in
  order. This is the numbering used by these files.
- **Backend phases** (`PROJECT_GUIDE.md` Part 3: Phase 0, 1, 2 …) — the AI
  curriculum. Each product phase names which backend phase it implements.

Current mapping:

| Product | Backend (guide) | Status |
|---|---|---|
| Phase 1 | — (frontend only) | ✅ live |
| Phase 2 | Backend Phase 0 — Foundation | ✅ live |
| Phase 3 | Backend Phase 1 — RAG from scratch | ✅ built (`lab/`, not deployed) |

## The live stack

```
brainstack.space       → marketing        (Vercel)
app.brainstack.space   → product shell    (Vercel, root dir `frontend`)
api.brainstack.space   → FastAPI          (Render, root dir `backend`)
                       → Supabase Postgres + Upstash Redis + Pinecone
```
