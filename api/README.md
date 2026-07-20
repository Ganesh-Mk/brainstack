# BrainStack — API

FastAPI backend for **BrainStack**. **Backend Phase 0 — Foundation (no AI):**
multi-tenant auth (Tenant / User / Invite), JWT sessions, and the data model
(Document / Chunk) that later AI phases fill in. See `../docs/PHASE_2.md` for
the spec and `../docs/PROJECT_GUIDE.md` Part 3 for the roadmap.

## Setup

Reads the **repo-root `.env`** (shared master env). No separate api/.env.

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt   # Windows
# source .venv/bin/activate on macOS/Linux

# Apply migrations to Supabase
.venv/Scripts/alembic upgrade head

# Run the dev server
.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
```

- Docs: http://localhost:8000/docs
- Health: http://localhost:8000/health  → `{status, db, redis}`

## Tests

```bash
.venv/Scripts/python -m pytest         # SQLite-backed, hermetic
```

## Layout

- `app/config.py` — settings from root `.env`
- `app/db.py` — engine, session, `get_db()`
- `app/models/` — Tenant, User, Invite, Document, Chunk
- `app/core/security.py` — bcrypt + JWT
- `app/core/deps.py` — ⭐ `get_current_user()` → `(user, tenant_id, role)`,
  the **only** source of tenancy in the whole backend
- `app/routers/` — `health`, `auth`
- `scripts/pinecone_smoke.py` — create the `brainstack` index, round-trip a
  test vector
- `alembic/` — migrations

## Key rule

`get_current_user()` is the sole source of `tenant_id`. Every tenant-scoped
endpoint takes it from there — never from a request body. `tenant_id` becomes
the Pinecone namespace in later phases.
