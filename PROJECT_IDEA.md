# 🧠 BrainStack

> **The AI knowledge platform for your entire organization.**
> Your company's second brain — fully stacked.

---

## 1. What is BrainStack?

BrainStack is a **multi-tenant B2B SaaS platform** that lets any company turn its private
documents and systems into an intelligent, conversational assistant for its people.

Instead of digging through wikis, PDFs, and internal tools, people simply **ask a question** and get
a **grounded, cited answer** — produced by an AI **agent** that searches the company's own
knowledge and the web through **native tools**, and **takes real actions in the company's external
systems** (ticketing, HR, analytics) through a standard protocol called
**MCP (Model Context Protocol)**.

> **Design boundary:** internal knowledge retrieval (RAG), memory, and evaluation stay **native**
> for performance and simplicity. **MCP is reserved for external company systems**, where its
> standardized, pluggable interface earns its keep. A single mock **Company MCP Server**
> demonstrates end-to-end MCP development and integration.

It is **not** "just a chatbot." The chat is only the entry point. What makes BrainStack a real
product is everything *around* the intelligence: a document workspace, a live view of the agent's
reasoning, source citations you can click into, and an analytics dashboard — an **AI workspace**,
not a chat box.

**Who uses it:**
- **Companies (tenants)** — sign up, upload their knowledge, connect their systems, configure their workspace.
- **Employees** — ask questions grounded in internal knowledge, draft content, get work done.
- **Managers** — a higher-privilege role that can *act*, not just ask. A manager can say
  *"assign this ticket to Priya"* or *"show me analytics for John this week"*, and the agent calls
  the company's own systems (e.g. their ticketing / HR API) to do it.
  > ℹ️ *Tickets and analytics are an example of what the manager role can do. BrainStack does not
  > implement ticketing logic or own a tickets database — a small mock company API stands in for it.
  > The point is to demonstrate how the agent takes **role-based, real actions** in external company
  > systems through MCP.*

Multiple companies use the platform simultaneously, each with their data and connections fully
**isolated** (multi-tenancy).

---

## 2. Core Features

### Knowledge & Ingestion
- 📄 **Multi-source ingestion** — upload PDFs, Word docs, paste URLs, connect data sources.
- ⚙️ **Live ingestion pipeline** — visualize extraction → chunking → embedding → indexing with progress.
- 📚 **Document library** — searchable list of sources with previews and status ("Ready").

### Intelligence & Agent
- 💬 **Grounded Q&A (RAG)** — answers built strictly from the company's own knowledge.
- 🤖 **Agentic reasoning** — the agent decides *when* to search docs, search the web, take an action, or answer directly.
- 🔌 **Native tools + MCP layer** — knowledge search and web search are **native tools**; external
  company systems (tickets, analytics) are exposed through a **Company MCP Server**, and the agent
  is an **MCP client** that discovers and calls them through one standard protocol.
- 🧠 **Memory** — short-term conversation context + long-term memory across sessions.
- 🔁 **Self-correction** — the agent reflects on its own answer and retries if it isn't good enough,
  **capped at 2 attempts** (tracked in graph state), returning the best answer generated so far.

### Actions & Integrations (via MCP)
- 🎫 **Role-based actions** — managers can trigger real operations (assign a ticket, pull analytics)
  that hit the company's own APIs, exposed through the **Company MCP Server**.
- 🧩 **Pluggable systems** — a company connects its systems by pointing BrainStack at their MCP
  server; the agent code never changes. New external integration = new MCP server, not new agent code.

### The "wow" surface (what makes it feel like a product)
- 🔍 **Live Agent Trace panel** — watch the agent's steps in real time
  (`Planning → Searching docs (native) → Company MCP → Drafting`).
- 📎 **Inline citations** — every fact links to its source; click to open the doc **at the cited
  page** with the **retrieved passage shown in a side panel** next to it (Tier-2 citations).
- ⌨️ **Token-by-token streaming** — answers stream in live.
- 📊 **Analytics dashboard** — cost, latency, token usage, and retrieval-quality (eval) scores.

### Platform & Trust
- 🏢 **Multi-tenancy** — many companies, fully isolated data and connections per tenant.
- 👥 **Roles & permissions** — admins (manage sources, connections, settings), employees (ask
  questions), and managers (trigger actions). **A user's role decides whether their agent session
  connects to the Company MCP Server** — an employee's session never even discovers the manager
  action tools, so they're absent by construction, not blocked by a prompt.
- ✅ **Evaluation** — measure answer faithfulness & retrieval relevance (RAGAS / LLM-as-judge).
- 🔭 **Observability** — trace every step (what was retrieved, which MCP tool was called, latency, cost).

---

## 3. Tech Stack

> **Fully Python-based backend.** Python owns the AI ecosystem (LangChain / LangGraph / MCP / eval),
> and **FastAPI** handles the API, auth, and orchestration — no separate language needed.

| Layer | Technology | Why |
|---|---|---|
| **AI / Agent core** | **Python**, LangChain, **LangGraph** | The entire agent/RAG ecosystem is Python-first. |
| **Tool protocol** | **MCP (Model Context Protocol)** — official Python SDK (FastMCP, `streamable-http`) + LangGraph MCP adapters | Standard, pluggable way to call **external company systems**. Knowledge/web search stay native. |
| **Backend API** | **FastAPI** | Serves the app, auth, ingestion jobs, and streaming. |
| **LLM** | Claude — `haiku-4-5` (dev + eval judge), `opus-4-8` / `sonnet-5` (demos/prod) | Reasoning + generation. Cost-first: cheap in dev, swap up for demos. |
| **Embeddings** | Dev: local `all-MiniLM-L6-v2` (free) · Prod: OpenAI `text-embedding-3-small` | Turn text into vectors. (Anthropic has no embeddings API.) |
| **Vector DB** | **Pinecone** — one index, **namespace per tenant** | Store & search embeddings, isolated per company. Behind a `VectorStore` interface; optional Qdrant benchmark later. |
| **Async jobs** | **FastAPI BackgroundTasks** now → **Celery** later | Parallel document ingestion; Celery added deliberately in the polish phase. |
| **Frontend** | **Next.js / React** | Streaming chat UI, agent-trace panel, dashboards. |
| **Database** | **PostgreSQL** | Users, tenants, roles, documents, connections, metadata. |
| **Cache / queue** | **Redis** | Caching + job queue backend for ingestion. |
| **Eval** | RAGAS / LLM-as-judge | Measure answer quality. |
| **Observability** | LangSmith (tracing) | Debug and monitor the agent + MCP calls. |
| **Infra** | Docker | Containerized services (app + Company MCP Server + mock API). Pinecone is managed. |

**Target architecture:**
```
Next.js frontend
      │  (HTTP + streaming/SSE)
      ▼
FastAPI backend   ── auth, tenants, roles, ingestion, streaming
      │
      ▼
LangGraph Agent   ── the brain (planner / router / reflect)
      │
      ├───────────── NATIVE tools ─────────────┐
      ▼                                         ▼
┌───────────────┐                        ┌────────────┐
│ search_       │                        │ web_search │
│ knowledge     │                        │ (Tavily)   │
│ (RAG)         │                        └────────────┘
└──────┬────────┘
       ▼
  Pinecone (namespace per tenant) + PostgreSQL (metadata)

      │  ── MCP CLIENT (manager/admin sessions only) ──
      │     speaks the MCP protocol over streamable-HTTP
      ▼
┌──────────────────────────────┐
│   Company MCP Server (mock)   │   ← the ONE MCP server
│   assign_ticket · list_tickets│
│   · get_analytics             │
└──────────────┬───────────────┘
               ▼
   Mock Company API (tickets + HR/analytics)
```

---

## 4. User Flow (what the user sees)

Three journeys: **ingesting knowledge**, **asking a question**, and **taking an action**.

### Journey 1 — Setting up knowledge (Ingestion)
1. User signs in and lands on their company **workspace**.
2. Clicks **"Add Sources"** → uploads PDFs, pastes a URL, or connects a data source.
3. Watches a **live progress view**:
   `Extracting text → Splitting into chunks → Generating embeddings → Indexing (312/312) ✅`.
4. The document appears in the **Library**, marked **"Ready"**.

### Journey 2 — Asking a question (Retrieval + Agent)
5. An employee asks, e.g.
   *"Compare our Q3 refund policy with competitors, and draft an email summarizing it."*
6. The **Agent Trace panel** lights up in real time:
   `🧠 Planning → 🔍 Knowledge (native RAG) → 🌐 Web search (native) → ✍️ Drafting email`.
7. The answer **streams in** token-by-token, with **inline citations** ([1], [2]).
8. User clicks a citation → the source PDF opens **at the cited page**, with the **retrieved
   passage shown in a side panel** beside it (Tier-2 citations).
9. User asks a follow-up ("make it shorter") — the agent **remembers** the context.
10. On the **dashboard**, the user sees analytics: cost, latency, retrieval-quality score.

### Journey 3 — Taking an action (Manager, via MCP)
11. A **manager** asks:
    *"Assign the login-bug ticket to Priya, and show me her workload this week."*
12. Because the user is a manager, their session is connected to the **Company MCP Server**
    (an employee's session would not be — the action tools simply aren't in its tool list).
13. The agent plans, then calls the MCP tools on the Company MCP Server:
    `assign_ticket(ticket="login-bug", assignee="Priya")` →
    `get_analytics(employee="Priya", range="this_week")`.
14. The agent replies:
    *"✅ Assigned the login-bug ticket to Priya. She now has 6 open tickets this week (up from 4),
    avg resolution 1.2 days."*
    The **Agent Trace** shows: `🧠 Planning → 🎫 Company MCP → 📊 Company MCP → ✍️ Summarizing`.

> Steps 6, 8, 10, and the entire Journey 3 are what turn this from "a chatbot" into "a platform."

---

## 5. How It Processes in the Backend

Two pipelines: **Ingestion** (when a doc is uploaded) and **Answering** (when a question is asked).

### 🔹 Pipeline 1 — Ingestion

```
Upload → Parse → Chunk → Embed → Store
```

1. **Parse / Extract** — Read the raw file. PDF → text (PyMuPDF / Unstructured), URL → cleaned text.
   Keep **metadata**: filename, page number, source, and **tenant id**. *(Concept: document loaders.)*
2. **Chunk (Split)** — Split large docs into ~500–1000 token **chunks** with slight overlap so
   context isn't cut mid-sentence. *(Concept: chunking strategy — hugely affects quality.)*
3. **Embed** — Each chunk → an embedding model → a **vector** (~1536 numbers capturing meaning).
   *(Concept: embeddings — text turned into geometry; similar meaning = nearby vectors.)*
4. **Store** — Save `(vector, chunk text, metadata)` into **Pinecone** under the tenant's own
   **namespace** (this is how companies stay isolated). *(Concept: vector databases, indexing, multi-tenancy.)*

> This pipeline is embarrassingly parallel (chunks embed independently) — a great place to use
> **async workers (FastAPI BackgroundTasks now, Celery later)** so many chunks embed concurrently.

### 🔹 Pipeline 2 — Answering a question (the Agent)

The system does **not** just "search + answer." A **LangGraph** agent (the brain) decides what to do.
It calls **native tools** for knowledge and web search, and — for external company systems — acts as
an **MCP client** talking to the **Company MCP Server**.

```
                    ┌─────────────┐
   User question →  │   PLANNER   │  "Needs: internal docs + an action"
                    └──────┬──────┘
                           ▼
                    ┌─────────────┐
                    │   ROUTER    │  picks which tool(s) to call
                    └──────┬──────┘   (Company MCP available only if ROLE allows)
              ┌────────────┼──────────────────────────┐
        NATIVE ▼            ▼ NATIVE          MCP (role-gated) ▼
        ┌──────────┐ ┌──────────┐          ┌──────────────────────┐
        │Knowledge │ │ Web      │          │ Company MCP Server    │
        │(RAG)     │ │ search   │          │ tickets · analytics   │
        └────┬─────┘ └────┬─────┘          └──────────┬───────────┘
             └────────────┴─────────────────────────┘
                          ▼
                   ┌─────────────┐
                   │  SYNTHESIZE │  LLM writes grounded answer + citations
                   └──────┬──────┘
                          ▼
                   ┌─────────────┐
                   │   REFLECT   │  "Did I answer? Enough sources?"
                   └──────┬──────┘   (max 2 attempts, tracked in state,
                     yes ▼   no → loop back    then return best-so-far)
                   Stream to user
```

**Step by step:**

1. **Retrieve (RAG "R")** — For knowledge questions, the agent calls the **native
   `search_knowledge` tool**, which embeds the *question* and asks Pinecone (in the tenant's
   namespace) for the top-k closest chunks. *(Concept: semantic search + tenant isolation.)*
2. **Augment (RAG "A")** — Build a prompt stuffing those chunks in as context:
   *"Using ONLY the context below, answer and cite sources. Context: [...] Question: [...]"*
   *(Concept: prompt construction, grounding to prevent hallucination.)*
3. **Generate (RAG "G")** — The LLM writes the answer from that context and cites each fact.
   *(Concept: generation + citation.)*
4. **The Agent + tool layer** — The **PLANNER / ROUTER / REFLECT** loop makes it an *agent*: the LLM
   decides whether to search knowledge, search the web, or take an action. Knowledge and web are
   **native tools**; external actions go through the **Company MCP Server**, so external integrations
   stay pluggable and the agent code doesn't change. The **user's role** decides whether the session
   connects to the Company MCP Server at all. *(Concept: agents, LangGraph, MCP, tool-calling, RBAC.)*
5. **Memory** — Conversation history (short-term) + past facts embedded and stored for long-term
   memory (RAG on the conversation). *(Concept: agent memory.)*
6. **Stream out** — Tokens stream to the frontend (token-by-token effect); each graph node and MCP
   call emits an event → powers the live **Agent Trace panel**. *(Concept: streaming, observability.)*

### 🔹 The MCP layer in detail (how external tools connect)

- **Where MCP is used:** only for **external company systems**. Knowledge search and web search are
  native tools (in-process, on the hot path — no protocol, no network hop). The **Company MCP Server**
  is the one MCP server, exposing external actions like `assign_ticket(ticket, assignee)` and
  `get_analytics(employee, range)`.
- **MCP server** = a standardized wrapper around a company's external system. It advertises its tools
  and does the real work behind them (call the company's ticket/HR API). Runs as a long-running
  **HTTP service** (`streamable-http` transport), its own container.
- **MCP client** = the LangGraph agent. If the user's role permits, on session start it asks the
  Company MCP Server *"what tools do you have?"*, gets a standard list, and can call any of them —
  without custom per-tool glue.
- **Analogy:** MCP is "USB for AI tools." The agent is the brain; the Company MCP Server is a
  swappable hand for reaching outside systems.
- **Why it's ideal for external multi-tenancy:** Company A uses Jira, Company B uses Linear — each is
  just a different Company MCP Server URL. Onboarding = "point us at your MCP server," not "wait for a
  custom integration." Role-based access = "connect to the Company MCP Server only if this role may."

### 🔹 Cross-cutting layer (senior-level signal)
- **Evaluation** — Score answers: faithful to sources? retrieval relevant? (RAGAS / LLM-as-judge).
  Feeds the analytics dashboard. *(The #1 thing juniors skip and seniors obsess over.)*
- **Observability** — Trace every step (LangSmith): what was retrieved, which MCP tool was called,
  latency, cost. *(Concept: production AI monitoring.)*

---

## 6. One-sentence mental model

> **Ingestion** turns documents into searchable *meaning* (vectors in Pinecone, isolated per company
> via namespaces). **Answering** is a LangGraph *agent* that plans and picks tools — **native**
> knowledge/web search to *know*, the **Company MCP Server** to *do* — grounds the LLM on what it
> retrieves, self-checks (capped at 2 retries), and streams a cited answer or takes a real action back.

> **RAG (native)** lets the agent *know* things. **MCP (external systems)** lets the agent *do*
> things. The agent is the brain; the Company MCP Server is its swappable hand for reaching outside.

Every concept to learn — **RAG, agents, LangGraph, MCP, vector DB, Pinecone, memory, evaluation,
multi-tenancy, RBAC** — has a natural home in those sentences. Nothing is bolted on.

---

## 7. Concepts Covered (learning checklist)

- [x] **Agentic AI** (the whole system — autonomous planning, tool use, self-correction)
- [x] **GenAI** (LLM-generated answers, drafting, summarization)
- [x] **NLP** (embeddings, chunking, semantic search, text understanding & generation)
- [x] RAG (chunking, embeddings, retrieval, grounding)
- [x] Vector databases / **Pinecone** (index + per-tenant namespaces; optional Qdrant benchmark)
- [x] AI Agents (planning, routing, reflection with a hard cap)
- [x] LangGraph (stateful graphs, loops, tool-calling)
- [x] **MCP (Model Context Protocol)** — building a Company MCP Server (`streamable-http`) + agent as MCP client
- [x] Tool use & actions (knowledge + web search **native**; tickets + analytics **via the Company MCP Server**)
- [x] Agent memory (short + long term)
- [x] Advanced RAG (hybrid search, re-ranking, query rewriting)
- [x] Evaluation (RAGAS, LLM-as-judge)
- [x] Observability (LangSmith tracing)
- [x] Streaming responses
- [x] Multi-tenant SaaS architecture (tenant isolation via Pinecone namespaces + Postgres)
- [x] Role-based access control (role decides whether a session connects to the Company MCP Server)
- [x] Async job processing (FastAPI BackgroundTasks now → Celery later) for ingestion
- [x] LLM integration (Claude / GPT via API)
- [x] Prompt engineering (grounding, context injection, structured prompts)
- [x] Tool calling / function calling (through MCP)
- [x] Vector embeddings & semantic search
- [x] Hallucination control / grounding & citations
- [x] Context window management
- [x] Guardrails (role limits, "answer only from sources", "say I don't know")
- [x] LLMOps (evaluation + tracing + cost/latency monitoring)

---

## 8. Résumé / Interview Keywords

> One-glance list of the famous keywords this single project lets you legitimately claim.

`Agentic AI` · `AI Agents` · `GenAI` · `NLP` · `LLM` · `RAG` · `Advanced RAG`
`MCP (Model Context Protocol)` · `LangChain` · `LangGraph` · `Vector Database` · `Pinecone`
`Qdrant` · `Embeddings` · `Semantic Search` · `Hybrid Search` · `Re-ranking`
`Query Rewriting` · `Prompt Engineering` · `Tool Calling` · `Function Calling` · `Agent Memory`
`Self-Correction / Reflection` · `Hallucination Control` · `Grounding & Citations`
`Guardrails` · `Streaming (SSE)` · `Evaluation (RAGAS / LLM-as-Judge)` · `LLMOps`
`Observability (LangSmith)` · `Multi-Tenant SaaS` · `RBAC` · `FastAPI` · `Celery` · `Redis`
`PostgreSQL` · `Next.js` · `Docker`

---

*Next: the implementation plan (phase-by-phase build) — to be written separately.*
