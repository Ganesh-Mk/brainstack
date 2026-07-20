# 🚢 BrainStack — Product Phase 10: Production Polish (Backend Phase 8)

> **Companion to `PROJECT_GUIDE.md` Part 3 §Phase 8 (5–7 days).** The
> deferred keywords, added as *decisions* with the why written down.

## What gets built

1. **Celery + Redis** (`app/worker.py`) — ingestion queued instead of
   riding the request process: survives restarts (`acks_late`), retries
   with backoff, scales workers, inspectable. Deployment reality: Render's
   free tier has no worker dynos → the deployed service keeps
   `INGEST_MODE=inline`; `docker compose up` runs the full shape with the
   worker. Same pipeline either way; the switch is WHERE it runs.
2. **Prompt caching** — the stable system-prompt prefix marked
   `cache_control: ephemeral`; per-conversation summary/memories stay
   outside the cached block. Measured honestly (see complete doc).
3. **Docker Compose** — api + worker + company MCP server + Postgres +
   Redis + frontend. Pinecone/Supabase Storage/Anthropic/Tavily stay
   managed services (keys, not containers).
4. **Rate limiting** — per-tenant fixed hour window in Redis on the ask
   endpoint (429 with reset time, checked BEFORE any model spend);
   no-Redis → no-op, protection is never an outage.
5. **Member management + workspace settings** — `/auth/members`
   (list/role-change/remove with self-guards), `/auth/tenant` rename;
   Team & Roles page + Settings General/Members/Models/Connections become
   real. Models & cost is read-only on purpose: config is env-managed
   (12-factor), changing it is a deploy, not a click.
6. **README** — architecture diagram, native-vs-MCP boundary, tradeoffs
   with data (the eval table), compose instructions.
7. **Qdrant benchmark — skipped without guilt** (guide's own words): the
   `VectorStore` seam exists (`services/vectorstore.py`); the benchmark
   adds a table to the README, not a capability to the product.

## Done when

Compose config validates and images build; every remaining page is real or
explicitly "Later · after launch" (Billing, API keys); member lifecycle
verified in production; rate limiting unit-tested with its no-op fallback.
