# 🏗️ BrainStack — Product Phase 2: The Real Foundation (Backend Phase 0)

> **Companion to `PROJECT_IDEA.md`, `PROJECT_GUIDE.md`, and `PHASE_1.md`.**
> Phase 1 shipped the entire product surface — live at
> [brainstack.space](https://brainstack.space) — with a demo-wired login and a
> mock session. Phase 2 builds the thing behind it: a **real multi-tenant
> FastAPI backend** with JWT auth, so two companies can genuinely sign up, log
> in, and each see only their own workspace.
>
> **Naming note:** this is **Backend Phase 0 — "Foundation (no AI)"** in
> `PROJECT_GUIDE.md` Part 3 (3–5 days). Product docs count Phases 1, 2, 3…;
> the guide's backend plan counts 0, 1, 2… — this doc is where the two
> numbering systems meet. **Zero AI in this phase, by design** — the guide's
> principle is "get the boring part behind you so AI phases are pure AI."

---

## 1. Goal & definition of done (from PROJECT_GUIDE.md §Phase 0)

A boring, working multi-tenant SaaS skeleton.

**Done when:**

1. Two companies can **sign up**, **log in**, and see **only their own (empty)
   workspace** — real accounts in Supabase Postgres, not the demo session.
2. `get_current_user()` is the **only** source of `(user, tenant_id, role)` in
   the entire backend — the tenant boundary that later becomes the Pinecone
   namespace. Never from a request body. This rule starts now and never bends.
3. A throwaway vector can be `upsert`ed and `query`ed in a **test Pinecone
   namespace** from a script (proves the vector DB is wired; no product AI).

---

## 2. What already exists (and what this phase must NOT redo)

| Already done (Phase 1 / setup) | Consequence for Phase 2 |
|---|---|
| Supabase Postgres provisioned, `DATABASE_URL` tested (session pooler) | **No local Postgres, no docker-compose** — the guide's `docker-compose.yml` step is replaced by cloud services we already verified |
| Upstash Redis live, `REDIS_URL` tested | Same — no local Redis. (Phase 2 barely uses Redis; it's wired into config now so later phases just import it) |
| `JWT_SECRET` (random 64-hex), `JWT_ALGORITHM`, expiry in root `.env` | Auth config is ready — the backend reads the **root `.env`** |
| Pinecone account + key tested (no index yet) | The smoke script creates/uses the `brainstack` index (§8) |
| Frontend auth pages (login/signup/forgot/invite/onboarding) — validation real, submit demo-wired | Phase 2 **rewires their submit handlers** to the real API. No visual changes |
| `stores/session.ts` mock (Demo User, Lovely / Another Company, role simulator) | Becomes a **real session store** hydrated from the API (§9) |
| RBAC UI: sidebar/palette filter by role via `lib/nav.ts` | Role now comes from the JWT instead of the simulator |

---

## 3. Stack & repo layout

Python 3.12 · **FastAPI** · **SQLAlchemy 2.0** + **Alembic** migrations ·
**Pydantic v2** (+ `pydantic-settings` reading the root `.env`) · `bcrypt` for
password hashing · `PyJWT` for tokens · `pytest` + `httpx` for tests ·
`uvicorn` dev server.

```
brainstack/
├── docs/                            ← you are here
├── frontend/                             ← Phase 1 (unchanged except auth wiring)
└── backend/                             ← NEW — the FastAPI backend
    ├── requirements.txt
    ├── alembic.ini
    ├── alembic/                     ← migrations (autogenerate + review)
    ├── app/
    │   ├── main.py                  ← app factory, CORS, routers
    │   ├── config.py                ← pydantic-settings ← root .env
    │   ├── db.py                    ← engine, SessionLocal, get_db()
    │   ├── models/                  ← Tenant, User, Document, Chunk
    │   ├── schemas/                 ← request/response Pydantic models
    │   ├── core/
    │   │   ├── security.py          ← hash/verify password, create/decode JWT
    │   │   └── deps.py              ← ⭐ get_current_user() → (user, tenant_id, role)
    │   └── routers/
    │       ├── health.py            ← GET /health (DB + Redis ping)
    │       └── auth.py              ← signup / login / me / invites
    ├── scripts/
    │   └── pinecone_smoke.py        ← create index, upsert + query test vector
    └── tests/
        └── test_auth.py             ← the §1 definition-of-done, as pytest
```

---

## 4. Data model (metadata only — vectors live in Pinecone later)

All tables carry `id` (UUID), `created_at`. Every tenant-owned table carries
`tenant_id` (FK, indexed) — the multi-tenancy spine.

- **Tenant** — `name`, `slug`.
- **User** — `tenant_id`, `email` (unique), `name`, `password_hash`,
  `role` (`admin` | `manager` | `employee` — same three roles as `lib/nav.ts`).
  First user of a tenant is its `admin`.
- **Invite** — `tenant_id`, `email`, `role`, `token`, `expires_at`,
  `accepted_at`. (No email sending in this phase — the admin copies the invite
  link. The frontend's `/invite` page already exists for accepting it.)
- **Document** — `tenant_id`, `title`, `source_type` (`pdf` | `url` | `text`),
  `status` (`processing` | `ready` | `failed`), `error`. *Created now, used by
  the ingestion phase.*
- **Chunk** — `tenant_id`, `document_id`, `chunk_index`, `text`, `token_count`.
  *Postgres stores chunk text/metadata; Pinecone will store the vector keyed
  by `chunk_id`.*

---

## 5. API surface

Base URL: `http://localhost:8000` (prod later: `https://api.brainstack.space`).

| Method & path | Auth | Does |
|---|---|---|
| `GET /health` | — | `{status, db, redis}` — pings both |
| `POST /auth/signup` | — | `{company_name, name, email, password}` → creates **Tenant + admin User**, returns token + user |
| `POST /auth/login` | — | `{email, password}` → token + user |
| `GET /auth/me` | 🔒 | `{user, tenant, role}` — what the frontend session hydrates from |
| `POST /auth/invites` | 🔒 admin | `{email, role}` → invite link with one-time token |
| `GET /auth/invites/{token}` | — | Validates a token → `{company_name, email, role}` (powers the invite page's greeting) |
| `POST /auth/invites/{token}/accept` | — | `{name, password}` → creates User in that tenant, returns token |

**Token design:** a single JWT access token (HS256, `JWT_SECRET`,
`ACCESS_TOKEN_EXPIRE_MINUTES=60`), claims `{sub: user_id, tenant_id, role}`.
Sent as `Authorization: Bearer`. No refresh tokens in this phase — expiry
just returns you to login; refresh lands with a later hardening pass.

**`get_current_user()`** (`core/deps.py`): decodes the Bearer token, loads the
user, yields `(user, tenant_id, role)`. Every future endpoint — documents,
ask, analytics — takes tenancy **only** from this dependency. 🔑 This is the
project's most important architectural rule (PROJECT_GUIDE.md §Phase 0).

**CORS:** `http://localhost:3000`, `https://brainstack.space`,
`https://app.brainstack.space`, `https://www.brainstack.space`.

---

## 6. Frontend wiring (the only `frontend/` changes)

- **`frontend/lib/api.ts`** (new) — tiny fetch wrapper: reads
  `NEXT_PUBLIC_API_URL`, attaches the Bearer token, one typed helper per
  endpoint, throws typed errors the forms can show.
- **`stores/session.ts`** — becomes real: persists `{token, user, tenant,
  role}`; `login()/signup()/logout()/hydrate()` actions call the API. The
  **role simulator stays** (it's a UI preview tool) but now defaults to your
  real role and is clearly labeled as a preview.
- **Auth pages** — same UI, real submits: signup → `/auth/signup` →
  onboarding; login → `/auth/login` → dashboard; invite page → validate +
  accept endpoints. Forgot-password stays a polite stub (no email service yet).
- **Route protection** — the `(app)` layout redirects to `/login` when no
  token; auth pages redirect to `/dashboard` when logged in.
- **Topbar** — shows the real user + company name; tenant *switcher* remains
  visual-only (one membership per user for now); logout works.
- **`.env`/Vercel** — `NEXT_PUBLIC_API_URL=http://localhost:8000` locally.
  The deployed site keeps demo-mode until the backend deploys (§10) — the
  code detects an empty `NEXT_PUBLIC_API_URL` and keeps current demo behavior,
  so **production never half-breaks** while the backend is local-only.

---

## 7. Tests (the definition of done, executable)

`pytest backend/tests/test_auth.py` against a throwaway schema:

1. Signup Company A → login works, `/auth/me` returns role `admin`, tenant Company A.
2. Signup Company B → its admin sees tenant Company B.
3. **Isolation:** Company A's token can never read anything of Company B's (asserted
   on `/auth/me` now; the pattern every future endpoint test copies).
4. Wrong password → 401. Expired/garbage token → 401. Invite flow end-to-end.
5. Non-admin calling `POST /auth/invites` → 403.

---

## 8. Pinecone smoke test (`backend/scripts/pinecone_smoke.py`)

Per the guide: create the **`brainstack`** index (serverless, cosine,
dimension **384** = `all-MiniLM-L6-v2`, our dev embedding model), then
`upsert` one throwaway vector into namespace `_smoke`, `query` it back,
delete it, print timings. Proves the key + index + namespace mechanics before
any AI phase needs them.

---

## 9. Build order

1. **Scaffold** — `backend/` venv, requirements, config from root `.env`, `db.py`,
   `GET /health` green against Supabase + Upstash.
2. **Models + Alembic** — the five tables; `alembic upgrade head` creates them
   in Supabase; verify in the Supabase table editor.
3. **Auth core** — security.py (bcrypt, JWT), signup/login/me,
   `get_current_user()`.
4. **Invites** — endpoints + tokens.
5. **Tests** — §7 suite green.
6. **Frontend wiring** — §6, demo-fallback preserved.
7. **Pinecone smoke** — §8 script run once, output saved into the phase notes.
8. **Docs** — `PHASE_2_COMPLETE.md` with what-shipped + your checklist.

---

## 10. What YOU will need to do (heads-up, none of it now)

- **Nothing to sign up for** — every credential this phase needs is already
  in the root `.env` and tested. ✅
- **Run it locally** when I hand it over: `uvicorn` for the API +
  `npm run dev` for the web app (exact commands will be in
  `PHASE_2_COMPLETE.md`).
- **Later, optional (end of phase):** deploy the API to **Render free tier**
  (or Railway) and add a GoDaddy CNAME `api` → the host they give you, then
  set `NEXT_PUBLIC_API_URL=https://api.brainstack.space` in Vercel — that's
  the moment the **live** site's login becomes real. Free tiers sleep after
  ~15 min idle (first request takes ~30s to wake) — fine for a learning
  project; we can revisit hosting when the AI phases need to stay warm.

---

## 11. Explicitly OUT of this phase

- Any AI at all (RAG lab is the next phase — `PROJECT_GUIDE.md` §Phase 1).
- Document upload/ingestion (tables exist; endpoints come with the pipeline).
- Email sending (invites are copy-a-link; forgot-password stays stubbed).
- Refresh tokens, password reset, multi-tenant-per-user, billing.
- Unlocking any Coming-Soon page — the shell's lock states don't change yet.
