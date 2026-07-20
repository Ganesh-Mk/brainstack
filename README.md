<div align="center">

# 🧠 BrainStack

**The AI knowledge platform for your entire organization.**
Your company's second brain — fully stacked.

[**Website**](https://brainstack.space) · [**App**](https://app.brainstack.space) · [**API**](https://api.brainstack.space/docs)

</div>

---

## What is BrainStack?

BrainStack is a multi-tenant B2B SaaS platform that turns a company's private
documents and internal systems into an intelligent, conversational assistant
for its people.

Instead of digging through wikis, PDFs, and dashboards, people **ask a
question** and get a **grounded, cited answer** — produced by an AI agent that
searches the company's own knowledge and the web, and can **take real actions**
in the company's external systems through **MCP (Model Context Protocol)**.

It isn't a chatbot. The chat is the entry point; the product is everything
around it — a document workspace, a live view of the agent's reasoning,
clickable citations, roles that decide what the agent may *do*, and analytics
over cost, latency, and answer quality.

---

## Features

**Knowledge**
- Multi-source ingestion — PDFs, documents, and URLs
- Live ingestion pipeline — extraction → chunking → embedding → indexing
- Searchable document library with previews and status

**Intelligence**
- Grounded Q&A (RAG) — answers built strictly from the company's own knowledge
- Agentic reasoning — the agent decides when to search, act, or answer directly
- Native tools for knowledge and web search; MCP for external systems
- Short-term conversation context and long-term memory
- Self-correction — the agent reviews its own answer and retries when weak

**Actions**
- Role-based operations against a company's own APIs, exposed over MCP
- Pluggable systems — point BrainStack at an MCP server; the agent never changes

**The product surface**
- Live agent trace — watch each step as it happens
- Inline citations — open the source at the cited page, passage shown alongside
- Token-by-token streaming answers
- Analytics — cost, latency, token usage, and retrieval-quality scores

**Platform**
- Multi-tenancy — many companies, fully isolated data and connections
- Roles & permissions — admins configure, employees ask, managers act. A user's
  role decides whether their session connects to the company's action tools at
  all, so unavailable tools are absent by construction, not blocked by a prompt
- Evaluation — faithfulness and retrieval-relevance scoring
- Observability — every retrieval, tool call, latency, and cost is traceable

---

## Architecture

```
                      ┌────────────────────────────────────────────┐
 brainstack.space     │  backend · FastAPI                         │
 app.brainstack.space │                                            │
        │             │   LangGraph agent                          │      ┌──────────────────┐
        ▼             │    ├ search_knowledge ──► Pinecone + BM25  │ MCP  │ company systems  │
 ┌────────────┐  SSE  │    │   (hybrid RRF, per-tenant namespace)  │◄────►│ (own service)    │
 │  frontend  │◄─────►│    ├ web_search ───────► Tavily            │      │  assign_ticket   │
 │  Next.js   │       │    └ MCP tools* ─────── discovered, not    │      │  list_tickets    │
 └────────────┘       │        *manager/admin    hardcoded         │      │  get_analytics   │
                      │                                            │      └──────────────────┘
                      │   reflection critic · memory extractor     │
                      │   query traces · eval runner · rate limit  │
                      └───────┬──────────────┬─────────────┬───────┘
                          Supabase        Pinecone      Upstash
                          Postgres        (vectors)     Redis
```

**The native-vs-MCP boundary:** knowledge and web search are *native* tools —
they're the product's core and feed the citation pipeline directly. External
company systems sit behind **MCP**: the agent discovers their tools over the
protocol at session start, so swapping the ticketing system is a URL change,
not an agent change. Authorization works the same way — a session's role
decides which tools are *discovered at all*. There is nothing to jailbreak,
because for an employee the action tools simply don't exist.

## Quality, as numbers

A 22-question golden dataset (including questions the corpus can't answer,
where refusing *is* the right answer) is scored by LLM judges plus
deterministic checks, end-to-end through the real API:

| metric | deployed config | with cross-encoder rerank |
|---|---|---|
| faithfulness | 0.977 | 1.000 |
| answer relevance | 0.955 | 0.932 |
| retrieval hit-rate | 1.000 | 1.000 |
| citation validity | 0.955 | 1.000 |

Every production question also leaves a trace row — latency, first-token
latency, tools used, token usage, attributed cost — feeding the Analytics
and Observability pages.

## Tradeoffs, made on purpose

- **Pinecone, one index, namespace-per-tenant** — isolation by construction;
  the namespace comes from the authenticated session, never from a request.
- **Hybrid retrieval always on; cross-encoder rerank opt-in** — the reranker
  measurably improves faithfulness (table above) but a second ONNX model
  doesn't fit a 512MB instance. BM25+RRF is pure Python and free.
- **Reflection capped at two attempts, structurally** — the critic can only
  examine the first draft; the second ships regardless. Never loops, never
  returns empty.
- **Celery for ingestion in the compose stack, BackgroundTasks on the free
  dyno** — same pipeline; the queue (restart-safe, retrying, inspectable)
  runs where a worker process exists.
- **Prompt caching** on the stable system-prefix; per-conversation memory and
  summaries stay outside the cached block.
- **Rate limiting per tenant** (Redis fixed-window) that degrades to a no-op
  if Redis is missing — protection is never an outage.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS |
| Backend | Python, FastAPI, SQLAlchemy, Alembic, JWT auth, Celery |
| AI | LangGraph, Claude, MCP (Model Context Protocol), fastembed (ONNX) |
| Retrieval | Pinecone (dense) + BM25/RRF (hybrid) + optional cross-encoder |
| Data | Supabase (Postgres), Pinecone (vectors), Upstash (Redis) |
| Hosting | Vercel (web), Render (API + company systems) |

## Run it

```bash
# the full production shape: api + worker + company MCP server +
# postgres + redis + frontend (Pinecone/Claude/etc. via .env keys)
docker compose up --build
```

Or each piece directly: `backend/` (uvicorn), `company/` (uvicorn),
`frontend/` (next dev). Evaluate answer quality any time:

```bash
python backend/eval/run_eval.py http://localhost:8000
```

## Repository

```
frontend/   Next.js — marketing site and product shell
backend/    FastAPI — API, agent, retrieval, memory, eval, observability
company/    The company-systems service — REST + MCP over streamable-http
lab/        RAG-from-scratch experiments that set the retrieval defaults
docs/       Product definition, architecture, and build guide
```

Documentation lives in [`docs/`](docs) — start with
[`PROJECT_IDEA.md`](docs/PROJECT_IDEA.md) for the product and
[`PROJECT_GUIDE.md`](docs/PROJECT_GUIDE.md) for the architecture.
