# Phase 11 — Public API & API keys

> **Goal:** turn BrainStack from a product you *use* into a platform you *build
> on*. A workspace admin mints a key, and their own systems can ask, ingest and
> search — with every call metered, attributed, capped and auditable.
>
> Backend-guide mapping: **new** (the guide's Part 3 ends at Phase 8). This is
> the first product phase with no curriculum phase behind it — the AI is done;
> this is platform work.

The Settings → API keys page already promises exactly three things. This plan
is built backwards from them, because they are a contract we wrote:

1. *Programmatic access to ask, ingest and search*
2. *Scoped keys per environment with instant revocation*
3. *Usage visible per key in Analytics*

---

## Status — 11a–11g complete

Backend suite **82 → 139 green**. Frontend builds clean, **42 routes**.

| Step | State |
|---|---|
| **11a** keys · `Principal` · management routes · `/v1/me` | ✅ |
| **11b** `/v1/ask` (JSON + SSE) · `/v1/search` | ✅ |
| **11c** `/v1/documents*` | ✅ |
| **11d** `api_requests` · metering · limits · cost caps · audit | ✅ |
| **11e** Settings → API keys (create → reveal → revoke → usage) | ✅ |
| **11f** Analytics section · Observability channel · `/stats/api` | ✅ |
| **11g** public API reference · retention prune | ✅ |

### Three extractions the plan implied but didn't name

`/v1` handlers had to be thin, which meant the shared work had to move out of
the app routers first:

- **`services/ask.py`** — the graph loop, token accounting, drafting step and
  cost arithmetic. `conversations.py` now consumes it too, so there is exactly
  one implementation of "run the agent and measure it."
- **`services/library.py`** — PDF sniffing, size limits, storage upload, the
  Celery-vs-BackgroundTasks dispatch, the four-step delete. Raises
  `LibraryError`; each router translates it into its own vocabulary.
- **`services/traces.py`** — the `query_traces` writer, now shared.

### Deviations, all deliberate

- **`api_key_events` shipped in 11a**, not 11d — the create/revoke routes were
  being written anyway.
- **`ApiKeyEvent.created_at` / `ApiRequest.created_at` are stamped
  client-side**, unlike every other table here. `server_default=func.now()` is
  whole-second on SQLite and `datetime.now()` is ~15ms-granular on Windows, so
  create-then-revoke tied and newest-first ordering came out arbitrary. The
  audit query also sorts by `id` as a tiebreaker. Same class of bug the
  phase-5 `message_seq_ordering` migration fixed.
- **`/v1/ask` does not extract long-term memory.** Memory is about a person; a
  service account isn't one, and API traffic would poison a human's recalled
  facts. Conversation summaries still work.
- **The cost cap does *not* inherit ratelimit's degrade-to-no-op.** Without
  Redis the limiter is a no-op by design, but a spend ceiling falls back to
  querying `query_traces`. A cost cap is worth a query; a request counter
  isn't.

### Billing and pricing removed

BrainStack will not integrate a payment gateway, so every surface that
promised one is gone rather than left as a locked teaser:

| Removed | Was |
|---|---|
| `app/(app)/settings/billing/` | a locked "Plan management and usage-based billing" page |
| `app/(marketing)/pricing/` | Starter/Team/Enterprise tiers at $49/mo + feature matrix |
| homepage `PricingPreview` section | the same three tiers, 108 lines |
| `SETTINGS_TABS` → Billing | the settings tab |
| `MARKETING_LINKS` → Pricing, footer → Pricing | nav links |
| `proxy.ts` → `/pricing` | marketing host allowlist entry |

Inbound links to `/pricing` now 404 — accepted deliberately. API keys still
carry `rate_limit_per_hour` and `monthly_cost_cap_usd`: those are **spend
guardrails**, not commerce, and they matter more without a billing system, not
less. `/settings/models` keeps showing token prices, because attributed cost
is an observability number here rather than an invoice.

### Retention scheduling

`api_requests` gains a row per `/v1` call and is the fastest-growing table the
platform has. It is pruned to `API_REQUEST_RETENTION_DAYS` (90) nightly at
**03:17 UTC** — an odd minute so nothing else ever lines up on the same tick.

There are two schedulers because there are two environments:

| Where | How | Covers |
|---|---|---|
| `docker compose` | a **`beat`** service running `celery -A app.worker beat`, plus a `prune_api_requests` task | the production shape |
| the live deploy | `.github/workflows/prune-api-requests.yml` | the real Supabase database |

Render's free tier has **no worker dynos and no cron jobs**, so Celery beat
never runs against production — the scheduled GitHub Action is the only
scheduler this project actually has. It needs one repository secret,
`DATABASE_URL`, and fails loudly with a pointer to Settings → Secrets until
it is set, rather than succeeding while doing nothing.

Two deliberate choices in that workflow:

- **It installs four packages, not `requirements.txt`.** The prune path
  touches `config`, `db` and `models` only; pulling in pymupdf, fastembed and
  langgraph to run one `DELETE` would cost minutes per night for nothing.
  Verified in a clean venv with exactly those four, against production, with
  no `.env` on disk — the CI shape.
- **`prune_api_requests` does not autoretry**, unlike `ingest_document`. A
  missed night is picked up by the next one, and retrying a bulk `DELETE`
  against a table that just failed only piles work onto whatever broke.

`beat` is its own compose service rather than `worker --beat`: beat only
*enqueues*, the worker executes, and folding them together means scaling to
two workers would fire the prune twice.

Rejected calls (`401`/`403`) have a **null `tenant_id`** by design — nothing
resolved a tenant — so tenant-scoped cleanup never removes them. Retention is
what ages them out.

### Verified

Full ASGI stack via `TestClient`: auth, scopes, revocation, expiry,
cross-tenant isolation on both `/v1/search` and `/v1/documents`, metering of
successes *and* rejections, request-id round-trip, route-template storage,
the two-ledger join, per-key and per-tenant limits, cost caps with and without
Redis, and that a broken ledger cannot break a response. Both migrations
generated offline as Postgres DDL and diffed against the models; single head.

**Not yet run against real Postgres or a live server.** That is the remaining
step — see "Before deploying" below.

---

## Before deploying

1. Commit the in-flight multi-workspace work (§0) — still uncommitted.
2. `alembic upgrade head` against Supabase (two new revisions:
   `b4e1c7a90d31`, `c8f3a52be104`).
3. Smoke the real thing: mint a key in the UI, `curl /v1/me`, `/v1/search`,
   `/v1/ask`, then revoke and confirm the 401.
4. ~~Schedule `scripts/prune_api_requests.py` daily.~~ **Done** — see
   "Retention scheduling" below. One repo secret still needs adding.
5. Add a Phase 11 production e2e battery in the established style, and update
   every e2e cleanup block to the new FK order:
   `api_requests → api_key_events → api_keys → query_traces → memories → … → tenants`.

---

## 0. Before anything — land the in-flight work

`git status` is **not clean**. The multi-workspace-per-tenant-email change is
uncommitted across `backend/app/routers/auth.py`, `models/user.py`,
`schemas/auth.py`, `routers/stats.py`, `routers/company.py`,
`frontend/lib/api.ts`, `stores/session.ts`, `components/layout/Topbar.tsx`, plus
migration `9c41d7aa02be` and `tests/test_workspaces.py` (both untracked).

Phase 11 touches four of those same files. **Commit and verify that work
first** — otherwise every API-keys diff is entangled with it, and the migration
chain (`down_revision`) is ambiguous.

---

## 1. The decisions (make these before writing code)

### 1.1 A separate `/v1` namespace — not the app's routes

The public API is `/v1/*`, a new router tree. It does **not** reuse
`/conversations`, `/documents`, `/stats`.

*Why:* the app's internal routes are a private contract between our own frontend
and backend — we change them whenever a phase needs it (and we have, eight
times). A public API is a promise to someone else's code. Mixing the two means
every internal refactor is a breaking change for customers. `/v1` is cheap now
and buys the freedom to keep moving.

Internally the `/v1` handlers are thin — they call the same
`services/chat.py`, `services/ingestion.py`, `services/agent.py`. No logic is
duplicated; only the contract is separate.

### 1.2 One `Principal`, two ways to authenticate

`get_current_user()` is the cardinal rule of this codebase: the **only** source
of `(user, tenant_id, role)`, never a request body. API keys must not weaken it.

Add `app/core/principal.py`:

```python
@dataclass
class Principal:
    tenant_id: uuid.UUID
    role: str                      # for MCP/capability gating
    user_id: uuid.UUID             # the human accountable for this call
    kind: str                      # "session" | "api_key"
    api_key_id: uuid.UUID | None
    environment: str               # "live" | "test" | "app"
    scopes: frozenset[str]
```

- `get_current_user()` keeps working exactly as today and gains a
  `.principal` projection (`kind="session"`, `environment="app"`).
- `get_api_principal()` is a **new** dependency used only by `/v1`. It resolves
  `Authorization: Bearer bsk_...` → the `api_keys` row → a `Principal`.

Both derive `tenant_id` server-side from a database row. The rule holds.

> **Rejected alternative:** overloading `get_current_user` to accept both token
> types. It would silently let an API key reach every internal route, including
> `/auth/members` and `/stats/*` — a scope system that only exists on half the
> surface is not a scope system.

### 1.3 Key format and storage

```
bsk_live_7hK2p...   (prefix "bsk_live" · 32 chars of secrets.token_urlsafe)
bsk_test_9dQ4m...
```

- Stored as **`sha256(key)`**, unique-indexed. The plaintext exists exactly
  once, in the create response.
- `last4` and `prefix` stored in the clear, for the `bsk_live_••••••4f2a`
  display the preview mock already shows.
- **sha256, not bcrypt** — deliberately. Bcrypt is slow *by design* to defend
  low-entropy human passwords against offline cracking. An API key is 192 bits
  of CSPRNG output; there is nothing to crack, and bcrypt on every request would
  put ~100ms of work in front of every call. This is the correct answer and a
  good one to be able to explain.
- Note the contrast with `Invite.token`, which is stored in plaintext
  (`models/user.py`). That was acceptable for a 7-day single-use link; it is not
  acceptable for a long-lived credential. Deliberate divergence, worth a comment
  in the model.

### 1.4 Scopes — RBAC for machines

| Scope | Grants |
|---|---|
| `ask:write` | `POST /v1/ask` |
| `search:read` | `POST /v1/search` |
| `documents:read` | `GET /v1/documents`, `GET /v1/documents/{id}` |
| `documents:write` | `POST /v1/documents`, `POST /v1/documents/url`, `DELETE` |
| `actions:write` | the key's agent session connects to the Company MCP Server |
| `analytics:read` | `GET /v1/usage` |

`actions:write` is the important one: it is the machine equivalent of
`require_manager`. A key without it produces an agent session where
`assign_ticket` **is not in the tool list** — the same capability-not-permission
model as Phase 7, extended to programmatic callers. That is the sentence this
phase earns.

Enforcement is a dependency factory: `requires("documents:write")` → 403 with
`{"code": "insufficient_scope", "required": "documents:write"}`.

### 1.5 Environments — honest scope

`environment ∈ {live, test}`. What it actually does:

- picks the key prefix (`bsk_live_` / `bsk_test_`),
- gets its **own rate-limit bucket and cost cap**,
- **tags every usage row and query trace**, so test traffic can be excluded from
  cost, latency and quality numbers.

What it does **not** do: give you a separate data sandbox. Both environments
read and write the same workspace, the same Pinecone namespace. Say this
plainly in the UI and the docs — a "test" key that quietly mutates production
documents is worse than no test mode at all.

*(A true sandbox would mean a second Pinecone namespace per tenant and a
document-set fork. Real, but a phase of its own, and Pinecone's free tier caps
namespaces. Out of scope — write down why.)*

### 1.6 Attribution — extend, don't fork

Two ledgers at two grains, and they are **joined, not duplicated**:

- **`query_traces`** (exists) stays the *AI* ledger — one row per answer, with
  tokens, cost, latency, tools. Gains three columns:
  `api_key_id` (nullable), `channel` (`app` | `api`), `environment`.
- **`api_requests`** (new) is the *HTTP* ledger — one cheap row per `/v1` call,
  including the ones that never touch a model (`/v1/search`, document listing,
  4xx/429 rejections). Carries `query_trace_id` (nullable) instead of copying
  cost.

**Cost is authored exactly once**, in `query_traces`. API-channel spend is a
join, never a second sum. This is what stops the Analytics page from
double-counting the moment someone asks through a key.

> Everything on the Observability page keeps working unchanged, and API asks
> start appearing there next to app asks with a key badge. That is the whole
> point of extending rather than forking.

---

## 2. Data model

```python
# app/models/apikey.py

class ApiKey(Base):
    __tablename__ = "api_keys"
    id, tenant_id (FK tenants, index)
    name                 String(80)          # "Prod ingest worker"
    environment          String(8)           # live | test
    prefix               String(16)          # "bsk_live"
    last4                String(4)
    key_hash             String(64) unique index   # sha256 hex
    scopes               String(255)         # csv, mirrors ROLES-style convention
    created_by_user_id   Uuid index
    created_at, expires_at (nullable), last_used_at (nullable)
    revoked_at (nullable), revoked_by_user_id (nullable)
    rate_limit_per_hour  Integer             # default from settings
    monthly_cost_cap_usd Float (nullable)

class ApiRequest(Base):
    __tablename__ = "api_requests"
    id, tenant_id (FK, index), api_key_id (FK api_keys, index)
    request_id           String(36)          # echoed as X-Request-Id
    method               String(8)
    route                String(80)          # TEMPLATE ("/v1/documents/{id}"), never the raw path
    status_code          Integer
    latency_ms           Integer
    error_code           String(40) (nullable)   # insufficient_scope | rate_limited | ...
    query_trace_id       Uuid (nullable)     # → the AI ledger, where cost lives
    environment          String(8)
    ip                   String(45)
    user_agent           String(120)
    created_at           index

class ApiKeyEvent(Base):
    __tablename__ = "api_key_events"
    id, tenant_id, api_key_id, actor_user_id
    action               String(24)   # created|revoked|rotated|scopes_changed|limits_changed
    detail               Text         # JSON before/after
    ip, created_at
```

Migration: `down_revision = "9c41d7aa02be"` (or `338e045b9114` if §0 is
reverted). Export the new models from `app/models/__init__.py` or autogenerate
won't see them.

**Two things that bite later, decided now:**

- **`route` is the template, not the raw path.** Storing
  `/v1/documents/{document_id}` keeps cardinality bounded and makes "top
  endpoints" a `GROUP BY`. Raw paths make it useless and leak IDs.
- **Retention.** `api_requests` is the fastest-growing table this platform will
  have, on a Supabase free tier. A daily prune (Celery beat in the compose
  stack, a `scripts/prune_api_requests.py` cron elsewhere) deletes rows older
  than `API_REQUEST_RETENTION_DAYS = 90`. Aggregates for older windows come from
  `query_traces`, which is small.

**Cleanup order.** `api_requests` → `api_key_events` → `api_keys` → then
`query_traces` → `memories` → … → `tenants`. Every e2e cleanup block must be
updated — this is exactly the failure mode audit finding #1 recorded.

---

## 3. The `/v1` surface

| Method | Route | Scope | Notes |
|---|---|---|---|
| `GET` | `/v1/me` | — | key introspection: tenant, name, env, scopes, limits, usage this hour. The "is my key working" call. |
| `POST` | `/v1/ask` | `ask:write` | JSON by default; SSE when `Accept: text/event-stream`. Body: `{question, conversation_id?, stream?}`. Returns `{answer, sources[], trace[], usage{input_tokens,output_tokens,cost_usd}, conversation_id, trace_id}`. |
| `POST` | `/v1/search` | `search:read` | **Retrieval only, no model.** `{query, top_k?}` → ranked chunks with scores, document, page, text. Cheap, deterministic, no LLM spend. |
| `POST` | `/v1/documents` | `documents:write` | multipart, 202 + document id |
| `POST` | `/v1/documents/url` | `documents:write` | 202 |
| `GET` | `/v1/documents` | `documents:read` | list + ingestion status |
| `GET` | `/v1/documents/{id}` | `documents:read` | poll `status`, `chunks_done/chunk_count` |
| `DELETE` | `/v1/documents/{id}` | `documents:write` | 204 |
| `GET` | `/v1/usage` | `analytics:read` | this key's own metering — so customers can bill their own users |

**`/v1/search` is the sleeper feature.** It exposes the hybrid retrieval stack
(dense + BM25 + RRF + optional rerank) without a model call. It's the "bring
your own LLM" endpoint, it's near-free, it's fast, and it is the single best
demo of what the retrieval work in Phase 8 actually bought.

**Ingestion is async**, so `POST /v1/documents` returns 202 and the caller polls
`GET /v1/documents/{id}` until `status == "ready"`. Webhooks would be nicer but
are a real subsystem (delivery, retries, HMAC signing, a dead-letter view) — a
separate phase. Say so in the docs rather than half-building it.

**Not exposed in v1:** conversation CRUD, memories, members, evals. Add them
when someone asks; a public route is easy to add and painful to remove.

### Management routes (session-auth, admin, not `/v1`)

```
GET    /api-keys                  list (never returns the hash or plaintext)
POST   /api-keys                  create → ONLY response containing the key
POST   /api-keys/{id}/revoke      instant
PATCH  /api-keys/{id}             name / scopes / limits (audited)
GET    /api-keys/{id}/usage       per-key rollup + last 20 requests
GET    /api-keys/audit            the ApiKeyEvent log
```

Admin-only, via the existing `require_admin`. Minting a credential that can read
the whole corpus is an admin act.

---

## 4. The request path (where accountability is enforced)

A single dependency chain on the `/v1` router, in this order:

1. **Resolve** — `sha256` the bearer token → indexed lookup. Cache
   `hash → (key row)` in Redis, 60s TTL, for latency. `401 invalid_api_key`.
2. **Validate** — `revoked_at`, `expires_at`. `401 key_revoked` /
   `401 key_expired`.
3. **Scope** — route's required scope ∈ key scopes. `403 insufficient_scope`.
4. **Rate limit** — two buckets, key first then tenant. Generalize
   `ratelimit.check()` from `check(tenant_id)` to `check(bucket_key, limit)` so
   the existing per-tenant call is one of several. Response always carries
   `X-RateLimit-Limit / -Remaining / -Reset`; a 429 also carries `Retry-After`.
5. **Cost cap** — if `monthly_cost_cap_usd` is set, a Redis counter (reconciled
   from `query_traces` on cache miss) gates the call. Over cap →
   `429 cost_cap_exceeded` with the cap and the reset date. **This is the
   guardrail that makes handing out keys survivable** — an LLM endpoint without
   a spend ceiling is an incident waiting for a for-loop.
6. **Run.**
7. **Meter, in `finally`** — write the `ApiRequest` row, bump `last_used_at`.
   Follows the existing `_write_trace` discipline exactly: own `SessionLocal`,
   every exception swallowed and logged. **Metering must never break the
   response.** For SSE asks, the row is written after the stream closes, and
   carries the `query_trace_id` the stream just produced.

`ratelimit.py`'s best property — *degrades to a no-op without Redis, because
protection is an upgrade and never an outage* — is preserved. Note the
consequence honestly: without Redis, limits and cost caps don't enforce. That's
the same trade already made and documented.

**Instant revocation** means busting the Redis cache entry on revoke, not just
setting `revoked_at`. Without Redis there's no cache and revocation is already
instant. Both paths must be tested.

### Errors

One shape everywhere, so client code can branch on a stable string:

```json
{ "code": "insufficient_scope", "message": "This key lacks documents:write.",
  "request_id": "8f2c…" }
```

`X-Request-Id` on every response, stored on the `ApiRequest` row. When a
customer emails "call 8f2c failed", it's one indexed lookup.

---

## 5. Analytics & accountability surfaces

This is the half of the feature that makes it a *platform* rather than a
credential, so it gets equal weight in the plan.

**Settings → API keys** (the page in the screenshot, made real)
- Table: Name · env badge · `bsk_live_••••4f2a` · scopes · created by · last
  used · requests 7d · cost 7d · status · Revoke.
- Row expands to a per-key panel: requests/day sparkline, top endpoints, error
  rate, p50/p95 latency, spend vs. cap, last 20 requests with status + request
  id.
- Audit tab: the `ApiKeyEvent` log — who created what, when, from where, and
  who revoked it. **Nothing here is deletable.**

**Analytics** (`GET /stats/analytics` extended, plus a new `GET /stats/api`)
- New section "Programmatic access": requests/day stacked by key, app-vs-API
  split, cost attributed to the API channel, p50/p95 by endpoint, a
  2xx/4xx/429/5xx breakdown.
- Existing tiles gain an env filter so `test` traffic can be excluded from the
  numbers we quote.

**Observability** — a `Channel` column: `app` or `api · Prod worker`, and a
filter. The trace table already carries everything else; it just gains an actor.

**Dashboard** — one `KpiTile`: "API calls (7d)".

**The safety valves are part of accountability, not separate from it:** per-key
hourly limits, per-key monthly cost caps, expiry dates, scope minimisation, an
immutable audit log, and instant revocation. Together they are the answer to
"what happens when a key leaks" — which is the only question that matters, and
the answer must be a paragraph, not a shrug.

---

## 6. Frontend work

Follow the existing conventions exactly — semantic tokens only (the Appearance
page rewrites the primitives at runtime), `Modal`/`Table`/`Badge`/`Button` from
`components/ui`, the `useStatsResource` hook + `DEMO_*` fixtures so the deployed
site still renders with no backend, and `AdminsOnly` for the gate.

1. `lib/nav.ts` — `SETTINGS_TABS`: API keys `locked: true → false`, drop
   `unlocksIn`. (Billing was subsequently removed outright — see below.)
2. `settings/api-keys/page.tsx` — replace the `ComingSoon` body with a
   `view.tsx` client component. Keep the `metadata` export. Model the mutation
   pattern on `components/settings/MembersManager.tsx`, the only settings page
   with real create/delete flows.
3. **Create modal** — name, environment `SegmentedControl`, scope checkboxes
   (default: `ask:write` + `search:read` + `documents:read`; `actions:write`
   off, with an explicit warning that it grants company-system actions), expiry,
   hourly limit, monthly cost cap.
4. **One-time reveal modal** — the key, a copy button, an unmissable "this is
   the only time you'll see it", and ready-to-paste `curl` / Python / JS
   snippets with the real key substituted. This is the moment the feature either
   feels professional or doesn't.
5. **Revoke** — confirm modal naming the key, then instant, with a toast.
6. `lib/api.ts` — `ApiApiKey`, `ApiApiKeyCreated`, `ApiKeyUsage`, `ApiApiStats`
   types near the `ApiMember` block; methods next to `modelConfig`.
7. Analytics / Observability / Dashboard additions per §5, reusing the existing
   bespoke div-bar chart pattern (no new charting dependency for this).
8. Marketing `/docs` — the "API reference" card is currently a `soon: true`
   teaser. Making it real is the natural close: quickstart, auth, scopes, the
   endpoint table, error codes, rate-limit headers, and `/v1/openapi.json`
   served from FastAPI.

---

## 7. Build order

Each step ends demo-able — the principle the whole project has held to.

| Step | What | Days | Done when |
|---|---|---|---|
| **11a** | `api_keys` model + migration, `Principal`, `get_api_principal`, management routes, `GET /v1/me` | 1–2 | `curl -H "Authorization: Bearer bsk_live_…" /v1/me` returns the workspace |
| **11b** | `/v1/ask` (JSON + SSE) and `/v1/search` | 1–2 | a script asks a question and gets a cited answer with no browser involved |
| **11c** | `/v1/documents*` | 1 | a script uploads a PDF and polls it to `ready` |
| **11d** | Accountability: `api_requests` + `api_key_events`, `query_traces` columns, metering, per-key limits, cost caps, revocation cache | 2 | a revoked key 401s instantly; a key over its cap 429s; every call has a row |
| **11e** | Settings → API keys UI: create → reveal → table → revoke → per-key usage | 2 | the screenshot's mock is the real page |
| **11f** | Analytics / Observability / Dashboard surfaces | 1–2 | API spend and app spend are separable, and don't double-count |
| **11g** | Public docs, `/v1/openapi.json`, retention prune, tests + prod e2e battery | 1–2 | a stranger can integrate from the docs alone |

**~9–13 days.** 11a–11c alone is a legitimate stopping point: a working public
API. 11d is what makes it responsible. Do not ship 11a–11c to real users
without 11d — an unmetered, uncapped LLM endpoint behind a long-lived credential
is the one genuinely dangerous thing in this plan.

---

## 8. Tests

New `backend/tests/test_api_keys.py`. Non-negotiable cases:

- create returns the plaintext **once**; list/get never do; the hash never
  appears in any response
- non-admin cannot create, revoke or patch a key
- revoked key → 401; expired key → 401; garbage key → 401 (and all three write
  an `api_requests` row — rejections are the ones you most need logged)
- scope enforcement: a `search:read`-only key gets 403 on `/v1/documents`
- `actions:write` absent → the agent session has no MCP tools (mirror
  `test_mcp_rbac.py`)
- **cross-tenant leak test**: tenant A's key cannot read tenant B's documents or
  retrieve B's chunks. The namespace-isolation test, re-run at the new boundary.
  This is the most valuable test in the phase.
- rate limit → 429 with `Retry-After` and correct `X-RateLimit-*`
- cost cap → 429 `cost_cap_exceeded`
- an `api_requests` row is written on success **and** on error; a `query_trace`
  from `/v1/ask` carries `channel="api"` and the right `api_key_id`
- audit rows on create / revoke / scope change
- metering failure does not break the response (inject a failing session)

`conftest.py`'s autouse `sealed_seams` must seal any new outbound seam, or the
suite hits live services — the `.env` holds real keys.

Then a production e2e battery in the established style: signup → mint key →
ask → ingest → poll → search → hit the limit → revoke → confirm 401 → verify
the analytics numbers → clean up **in the new FK order**.

---

## 9. Config additions

```python
API_KEY_DEFAULT_RATE_LIMIT_PER_HOUR: int = 120
API_KEY_MAX_PER_TENANT: int = 20
API_KEY_DEFAULT_EXPIRY_DAYS: int = 0        # 0 = never
API_REQUEST_RETENTION_DAYS: int = 90
API_KEY_CACHE_TTL: int = 60                 # seconds, Redis
API_V1_ENABLED: bool = True                 # kill switch
```

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| Uncapped spend through a leaked key | per-key cost cap + hourly limit + expiry + instant revoke + audit (§4) |
| `api_requests` outgrows the free Postgres tier | template routes, 90-day prune, aggregates from `query_traces` |
| Redis absent → limits and caps silently don't enforce | inherited, documented trade; surface "limits inactive" in the UI when `stats/config` reports no Redis |
| Public API freezes internal refactoring | that's precisely why `/v1` is separate (§1.1) |
| "test" env implies a sandbox it isn't | say so in the UI and docs; scope a real sandbox as its own phase (§1.5) |
| Merge friction with the in-flight multi-workspace work | land it first (§0) |
| 512MB Render instance, cold starts | `/v1` adds no new model or process; `/v1/search` is the cheap path and should be the recommended default in docs |
