# ✅ Phase 10 COMPLETE — Production Polish (Backend Phase 8)

> Shipped 2026-07-20. 76 backend tests, production e2e 13/13. Every page in
> the product is now real or explicitly "Later · after launch" (Billing,
> API keys).

## What shipped

### Celery + Redis (the guide's migration, as a decision)
`app/worker.py`: `ingest_document` task with `acks_late` (a killed worker's
job is redelivered) and retry backoff. The documents router dispatches by
`INGEST_MODE`: the Render free dyno keeps `inline` (BackgroundTasks — no
worker process exists on that tier), `docker compose` runs the real shape
with a dedicated worker. Same pipeline, different WHERE.

### Rate limiting
Per-tenant fixed hour window (Redis INCR/EXPIRE) checked on the ask
endpoint BEFORE any model spend; 429 carries the reset time. Without Redis
it's a no-op — protection is never an outage. Unit-tested both ways.

### Prompt caching — implemented, measured, honestly reported
The stable system-prefix is sent as a `cache_control: ephemeral` block
(summary/memories stay outside it). **Measurement**: repeat calls on
`claude-haiku-4-5` with this account reported `cache_creation: 0 /
cache_read: 0` even with a 3.3k-token prefix, via both langchain and the
raw SDK — the API is not registering cache writes here. The mechanism is
correct per the documented API and costs nothing to keep on; the cost drop
is **not** claimed until the usage numbers show it. (This is the Phase 3
lesson again: measure, don't assume.)

### Member management & workspace settings
- `GET/PATCH/DELETE /auth/members` — list, role change, remove; can't
  change your own role or remove yourself; cross-tenant ids are 404s.
- `PATCH /auth/tenant` — rename the workspace.
- **Team & Roles** page: live member list, role dropdowns, invite links
  (copy-paste), removal. **Settings**: General (rename), Members (same
  manager), Models & cost (read-only live config from `/stats/config` —
  env-managed on purpose: changing models is a deploy, not a click),
  Connections (the live MCP connection state).
- The livest RBAC demo in the e2e: **promote a member via the API and
  their session immediately discovers the MCP tools** (capable+connected,
  3 tools) — role → capability, end to end.

### Docker Compose — the full production shape
api + celery worker + company MCP server + Postgres 16 + Redis 7 +
frontend; Pinecone/Supabase Storage/Anthropic/Tavily stay managed keys.
Images: backend 934MB, company 279MB, frontend 1.16GB. **Verified live**:
the stack booted (fresh Postgres migrated at startup), signup worked
against the containerized DB, the backend discovered the company MCP
server over the compose network (`connected: true`), and a real document
went through the **Celery** queue to `ready` (`Task ingest_document
succeeded in 78.7s` — cold model download included). One found-bug: the
Windows-generated `package-lock.json` omits linux-musl optional deps
(`@emnapi/*`), which breaks `npm ci` in-container — the image uses
`npm install` with the reason documented in the Dockerfile. (Docker
Desktop's WSL backend crashed at the very end of the session — after all
images had built and the stack had been verified; noted for honesty.)

### Skipped, without guilt (guide's words)
Qdrant benchmark — the `VectorStore` seam exists (`services/
vectorstore.py`); the benchmark adds a README table, not a capability.

## Verified
- 76/76 backend tests (rate-limit window + no-op fallback, member
  lifecycle with guards, prompt-cache block structure, Celery dispatch).
- **Production e2e 13/13**: full member lifecycle, promotion→capability,
  rename, config endpoint gating, ask regression.
- `docker compose config` valid; backend/company/frontend images build.

## 🌐 Browser checklist (app.brainstack.space, admin)
- [ ] **Team & Roles** (Admin section): your account listed; invite a
      teammate → copy the link → open it in a private window → accept.
- [ ] Change the new member's role to manager → log in as them →
      Operations section appears; Connections shows Connected.
- [ ] **Settings → General**: rename the workspace → the sidebar and
      topbar pick it up.
- [ ] **Settings → Models & cost**: the live model lineup and budgets.
- [ ] **Settings → Members / Connections**: the same live surfaces.
- [ ] `docker compose up --build` locally boots the whole platform.
