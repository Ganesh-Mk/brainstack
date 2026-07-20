# ✅ Phase 2 — COMPLETE & DEPLOYED (Backend Phase 0: Foundation)

> **Status: built, verified, and LIVE in production.**
> The backend runs on Render at **`api.brainstack.space`**, the frontend on
> Vercel at **`app.brainstack.space`**, both talking to Supabase Postgres and
> Upstash Redis. Signing up on the live site creates a real account. **Zero AI
> in this phase, by design** — this is the foundation the AI phases plug into.

---

## Part A — What was built

A new **`backend/`** FastAPI backend (Python 3.12), plus auth wiring in `frontend/`.

**Verified before writing this report:**
- `pytest` — **9/9 green** (auth, tenant isolation, invites, RBAC).
- Frontend — `npm run lint` clean, `npm run build` compiles (all routes).
- **Live against Supabase** — `/health` returns `{db: ok, redis: ok}`; full
  flow tested with real requests: admin signup → invite (manager) → accept →
  manager blocked from inviting (403) → reused invite rejected (404).
- **Pinecone** — the `brainstack` index was created (serverless, cosine,
  dim 384) and a test vector round-tripped (upsert → query score 1.0 →
  delete). **PASS.**

### 1. The backend (`backend/`)

- **Config** (`app/config.py`) — `pydantic-settings` reads the **repo-root
  `.env`** (one master env for the whole project; extra keys ignored).
  `DATABASE_URL` gets the `+psycopg` driver injected for SQLAlchemy.
- **DB** (`app/db.py`) — SQLAlchemy 2.0 engine with `pool_pre_ping` (the
  Supabase session pooler drops idle connections), `get_db()` dependency.
- **Models** (`app/models/`) — `Tenant`, `User` (role admin/manager/employee),
  `Invite`, `Document`, `Chunk`. Every tenant-owned row carries an indexed
  `tenant_id`. Documents/Chunks exist now, filled by the ingestion phase.
- **Migrations** (`alembic/`) — env wired to the app's own metadata + URL, so
  migrations and the app always target the same DB. One migration applied;
  all five tables live in Supabase (confirmed via `information_schema`).
- **Security** (`app/core/security.py`) — bcrypt hashing; HS256 JWT with
  `{sub, tenant_id, role, iat, exp}` and required-claim validation on decode.
- **⭐ `get_current_user()`** (`app/core/deps.py`) — the project's cardinal
  rule: the **only** source of `(user, tenant_id, role)`. Reads tenancy/role
  from the DB row (not the token) so a stale token can't outlive a role
  change. `require_admin` builds on it for RBAC. `tenant_id` becomes the
  Pinecone namespace in later phases.
- **Endpoints** — `GET /health`; `POST /auth/signup` (creates Tenant + admin),
  `/auth/login`, `GET /auth/me`, `POST /auth/invites` (admin), `GET
  /auth/invites/{token}`, `POST /auth/invites/{token}/accept`. CORS allows
  localhost:3000 + the three production domains.

### 2. Tests (`backend/tests/`)

SQLite-backed, hermetic (same models run on Postgres in prod). Covers: tenant
+ admin creation, login/`me`, duplicate-email 409, wrong-password 401,
missing/garbage token 401, **two-tenant isolation**, full invite flow with
one-time enforcement, non-admin invite 403, password-length 422.

### 3. Frontend wiring (`frontend/`) — same UI, now real

- **`lib/api.ts`** — typed fetch client. **Demo-mode contract:**
  `isBackendConfigured` is false when `NEXT_PUBLIC_API_URL` is empty, and the
  auth pages keep their original demo behavior. Set the env var → the same
  pages go live. **Production never half-breaks** while the API is local-only.
- **`stores/session.ts`** — real JWT session (token/user/tenant/role/authed),
  `login/signup/accept` store it, `hydrate()` re-validates against `/auth/me`
  on load and drops expired tokens. The avatar **role simulator** stays as a
  local RBAC *preview* (labeled "Preview a role", your real role tagged
  "yours"); in demo mode it's the old "Demo role" tool.
- **`components/layout/SessionGate.tsx`** — protects the app shell: unauth →
  `/login`; transparent pass-through in demo mode.
- **Login / Signup / Invite pages** — real API calls with loading states and
  server error messages; invite page reads `?token=`, fetches the invite, and
  collects name + password. All fall back to demo behavior with no backend.
- **Topbar** — Sign out now clears the session; shows the real user + company.

---

## Part B — What YOU need to do

### ▶️ Run it locally (2 terminals)

```bash
# 1) API  (from backend/)
.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
#    → http://localhost:8000/docs   /health shows {db: ok, redis: ok}

# 2) Web  (from frontend/)  — .env.local already has NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
#    → http://localhost:3000
```

Then: **Sign up** a company → you land in the dashboard as its **admin** (a
real row in Supabase). **Sign out**, **sign back in**. Open the Supabase table
editor and watch your `tenants` / `users` rows appear. Try a second company —
each sees only its own workspace.

**Invites (no email yet):** as admin, the invite link form lives in the app;
copy the generated `/invite?token=…` link into a private window to accept it
and create a teammate in your tenant. *(A polished admin UI for generating
invites lands when Team & Roles unlocks; the endpoint + accept flow work now.)*

### ✅ DONE — the API is live in production (2026-07-20)

The backend is deployed and the live site's login is **real**.

**Render** (free tier, Singapore region) — service `brainstack`, auto-deploys
from `main`:

| Setting | Value |
|---|---|
| Root Directory | `backend` |
| Build Command | `pip install -r requirements.txt && alembic upgrade head` |
| Start Command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Health Check | `/health` |
| Env vars (Render dashboard) | `PYTHON_VERSION=3.12.7`, `DATABASE_URL`, `JWT_SECRET`, `JWT_ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `REDIS_URL`, `PINECONE_API_KEY`, `PINECONE_INDEX` |

The migration runs on every deploy (idempotent), so schema changes ship
automatically.

**Custom domain** — GoDaddy CNAME `api` → `brainstack-1red.onrender.com`;
Render issued SSL. The internal `*.onrender.com` URL is never used by the app.

**Vercel** — `NEXT_PUBLIC_API_URL=https://api.brainstack.space` (Production),
Root Directory `frontend`.

**The live stack, all verified with real requests:**

```
brainstack.space          → landing            (200)
app.brainstack.space      → product shell      (200)
api.brainstack.space      → {"status":"ok","db":"ok","redis":"ok"}
                            live signup → 201, role admin, row in Supabase
```

> ⚠️ **Two deploy behaviors worth remembering**
> 1. Render's Root Directory means **only commits touching `backend/` trigger a
>    backend deploy** (Vercel rebuilds on every push). To force one:
>    Render → Manual Deploy → *Deploy latest commit*.
> 2. **Render doesn't post GitHub commit checks** — only Vercel appears in the
>    "All checks have passed" box. Watch Render deploys in its own dashboard.
> 3. Free tier **sleeps after ~15 min idle** — the first request then takes
>    ~30–60s. Revisit when the AI phases need it always warm (paid instance, or
>    a cron pinging `/health`).

### Nothing to sign up for

Every credential this phase used is already in the root `.env` and tested
(Supabase, Redis, Pinecone), and mirrored into Render's dashboard.
`frontend/.env.local` keeps `NEXT_PUBLIC_API_URL=http://localhost:8000` for
local dev; Vercel holds the production value.

---

## Definition of done (from PHASE_2.md §1)

- [x] Two companies sign up, log in, see only their own empty workspace — real
      accounts in Supabase
- [x] `get_current_user()` is the sole source of `(user, tenant_id, role)`
- [x] Throwaway vector upserted/queried in a test Pinecone namespace
- [x] Auth test suite green (9/9); frontend lint + build clean
- [x] Frontend demo-mode preserved when `NEXT_PUBLIC_API_URL` is empty
- [x] **Bonus:** backend deployed to Render at `api.brainstack.space` and wired
      to the live frontend — the production login is real

**Phase 2 is wrapped.** Next: `PROJECT_GUIDE.md` **Backend Phase 1 —
"RAG from scratch, in a script"** (the most important learning phase — raw
embeddings, chunking, cosine similarity by hand, then Pinecone). No FastAPI,
no frontend; one Python script in `backend/` or a new `lab/` folder.
