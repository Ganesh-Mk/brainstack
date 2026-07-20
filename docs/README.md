# BrainStack — docs

## Active

| Doc | What it is |
|---|---|
| [`PROJECT_IDEA.md`](PROJECT_IDEA.md) | The product: what BrainStack is, who it's for, the feature set. |
| [`PROJECT_GUIDE.md`](PROJECT_GUIDE.md) | The learning + build guide: every AI concept explained, and the 8-phase backend plan (Part 3). The north star. |
| [`PHASE_6.md`](PHASE_6.md) | **Current phase** — the agent (LangGraph): tools that decide, live trace panel. |

## `archive/`

Phases that are **finished and shipped**. Kept for reference (decisions,
deployment settings, what was verified) but not part of active work.

| Doc | Shipped |
|---|---|
| `archive/PHASE_1.md` / `PHASE_1_COMPLETE.md` | Product shell, design system, marketing site — live on Vercel |
| `archive/PHASE_2.md` / `PHASE_2_COMPLETE.md` | Multi-tenant FastAPI backend + JWT auth — live on Render |
| `archive/PHASE_3.md` / `PHASE_3_COMPLETE.md` | RAG from scratch (`lab/`) — all 6 experiments run; includes the full RAG explainer |
| `archive/PHASE_4.md` / `PHASE_4_COMPLETE.md` | Real ingestion pipeline — live; Knowledge section unlocked |
| `archive/PHASE_5.md` / `PHASE_5_COMPLETE.md` | Grounded Q&A + citations + streaming — live; Ask unlocked |

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
| Phase 3 | Backend Phase 1 — RAG from scratch | ✅ done (`lab/`, all experiments run) |
| Phase 4 | Backend Phase 2 — real ingestion pipeline | ✅ live (Knowledge unlocked) |
| Phase 5 | Backend Phase 3 — grounded Q&A + citations + streaming | ✅ live (Ask unlocked) |
| Phase 6 | Backend Phase 4 — the agent (LangGraph) | 🔨 planned |

## The live stack

```
brainstack.space       → marketing        (Vercel)
app.brainstack.space   → product shell    (Vercel, root dir `frontend`)
api.brainstack.space   → FastAPI          (Render, root dir `backend`)
                       → Supabase Postgres + Upstash Redis + Pinecone
```
