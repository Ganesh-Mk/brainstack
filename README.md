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

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS |
| Backend | Python, FastAPI, SQLAlchemy, JWT auth |
| AI | LangChain / LangGraph, Claude, MCP (Model Context Protocol) |
| Data | Supabase (Postgres), Pinecone (vectors), Upstash (Redis) |
| Hosting | Vercel (web), Render (API) |

---

## Repository

```
frontend/   Next.js — marketing site and product shell
backend/    FastAPI — API, auth, multi-tenancy
docs/       Product definition, architecture, and build guide
```

Documentation lives in [`docs/`](docs) — start with
[`PROJECT_IDEA.md`](docs/PROJECT_IDEA.md) for the product and
[`PROJECT_GUIDE.md`](docs/PROJECT_GUIDE.md) for the architecture.
