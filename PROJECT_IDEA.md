# 🧠 BrainStack

> **The AI knowledge platform for your entire organization.**
> Your company's second brain — fully stacked.

---

## 1. What is BrainStack?

BrainStack is a **multi-tenant B2B SaaS platform** that lets any company turn its private
documents and systems into an intelligent, conversational assistant for its people.

Instead of digging through wikis, PDFs, and internal tools, people simply **ask a question** and get
a **grounded, cited answer** — produced by an AI **agent** that can search the company's own
knowledge, browse the web, and **take real actions in the company's systems** through a standard
protocol called **MCP (Model Context Protocol)**.

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
- 🔌 **MCP tool layer** — every capability (knowledge search, web search, tickets, analytics) is an
  **MCP server**; the agent is an **MCP client** that calls them through one standard protocol.
- 🧠 **Memory** — short-term conversation context + long-term memory across sessions.
- 🔁 **Self-correction** — the agent reflects on its own answer and retries if it isn't good enough.

### Actions & Integrations (via MCP)
- 🎫 **Role-based actions** — managers can trigger real operations (assign a ticket, pull analytics)
  that hit the company's own APIs, wrapped as MCP servers.
- 🧩 **Pluggable systems** — a company connects its systems by pointing BrainStack at an MCP server;
  the agent code never changes. New integration = new MCP server, not new agent code.

### The "wow" surface (what makes it feel like a product)
- 🔍 **Live Agent Trace panel** — watch the agent's steps in real time
  (`Planning → Searching docs → Tickets MCP → Drafting`).
- 📎 **Inline citations** — every fact links to its source; click to open the doc with the passage highlighted.
- ⌨️ **Token-by-token streaming** — answers stream in live.
- 📊 **Analytics dashboard** — cost, latency, token usage, and retrieval-quality (eval) scores.

### Platform & Trust
- 🏢 **Multi-tenancy** — many companies, fully isolated data and connections per tenant.
- 👥 **Roles & permissions** — admins (manage sources, connections, settings), employees (ask
  questions), and managers (trigger actions). **A user's role decides which MCP servers their agent
  session can access** — employees can't reach manager tools.
- ✅ **Evaluation** — measure answer faithfulness & retrieval relevance (RAGAS / LLM-as-judge).
- 🔭 **Observability** — trace every step (what was retrieved, which MCP tool was called, latency, cost).

---

## 3. Tech Stack

> **Fully Python-based backend.** Python owns the AI ecosystem (LangChain / LangGraph / MCP / eval),
> and **FastAPI** handles the API, auth, and orchestration — no separate language needed.

| Layer | Technology | Why |
|---|---|---|
| **AI / Agent core** | **Python**, LangChain, **LangGraph** | The entire agent/RAG ecosystem is Python-first. |
| **Tool protocol** | **MCP (Model Context Protocol)** — official Python SDK + LangGraph MCP adapters | Standard, pluggable way for the agent to call tools and company systems. |
| **Backend API** | **FastAPI** | Serves the app, auth, ingestion jobs, and streaming. |
| **LLM** | Claude (Opus / Sonnet) or GPT via API | Reasoning + generation. |
| **Embeddings** | `text-embedding-3` (or open-source) | Turn text into vectors. |
| **Vector DB** | **Pinecone** (per-tenant namespaces) → pgvector / Qdrant (compare) | Store & search embeddings, isolated per company. |
| **Async jobs** | **Celery** / FastAPI background tasks | Parallel document ingestion. |
| **Frontend** | **Next.js / React** | Streaming chat UI, agent-trace panel, dashboards. |
| **Database** | **PostgreSQL** | Users, tenants, roles, documents, connections, metadata. |
| **Cache / queue** | **Redis** | Caching + job queue backend for ingestion. |
| **Eval** | RAGAS / LLM-as-judge | Measure answer quality. |
| **Observability** | LangSmith (tracing) | Debug and monitor the agent + MCP calls. |
| **Infra** | Docker | Containerized services (app + MCP servers). |

**Target architecture:**
```
Next.js frontend
      │  (HTTP + streaming/SSE)
      ▼
FastAPI backend   ── auth, tenants, roles, ingestion, streaming
      │
      ▼
LangGraph Agent   ── the brain (planner / router / reflect)  ── also an MCP CLIENT
      │
      │  speaks the MCP protocol
      ├──────────────┬───────────────┬────────────────┐
      ▼              ▼               ▼                ▼
┌───────────┐  ┌──────────┐   ┌────────────┐   ┌─────────────┐
│Knowledge  │  │ Web      │   │ Tickets    │   │ Analytics   │   ← MCP SERVERS
│MCP (RAG)  │  │search MCP│   │ MCP (mock  │   │ MCP (mock   │
│           │  │          │   │ company API)│   │ company API)│
└─────┬─────┘  └──────────┘   └─────┬──────┘   └──────┬──────┘
      ▼                             ▼                 ▼
 Pinecone +                  Company's ticket   Company's HR /
 PostgreSQL                  system (mock)      analytics (mock)
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
   `🧠 Planning → 🔍 Knowledge MCP (search docs) → 🌐 Web search MCP → ✍️ Drafting email`.
7. The answer **streams in** token-by-token, with **inline citations** ([1], [2]).
8. User clicks a citation → the source PDF opens with the **exact passage highlighted**.
9. User asks a follow-up ("make it shorter") — the agent **remembers** the context.
10. On the **dashboard**, the user sees analytics: cost, latency, retrieval-quality score.

### Journey 3 — Taking an action (Manager, via MCP)
11. A **manager** asks:
    *"Assign the login-bug ticket to Priya, and show me her workload this week."*
12. Because the user is a manager, their session is connected to the **Tickets MCP** and
    **Analytics MCP** servers (an employee's session would not be).
13. The agent plans, then calls the MCP tools:
    `assign_ticket(ticket="login-bug", assignee="Priya")` →
    `get_analytics(employee="Priya", range="this_week")`.
14. The agent replies:
    *"✅ Assigned the login-bug ticket to Priya. She now has 6 open tickets this week (up from 4),
    avg resolution 1.2 days."*
    The **Agent Trace** shows: `🧠 Planning → 🎫 Tickets MCP → 📊 Analytics MCP → ✍️ Summarizing`.

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
> **async workers (Celery / background tasks)** so many chunks embed concurrently.

### 🔹 Pipeline 2 — Answering a question (the Agent)

The system does **not** just "search + answer." A **LangGraph** agent (the brain) decides what to do,
and it reaches every tool as an **MCP client** talking to **MCP servers**.

```
                    ┌─────────────┐
   User question →  │   PLANNER   │  "Needs: internal docs + an action"
                    └──────┬──────┘
                           ▼
                    ┌─────────────┐
                    │   ROUTER    │  picks which MCP tool(s) to call
                    └──────┬──────┘        (limited by the user's ROLE)
              ┌────────────┼───────────────┬───────────────┐
              ▼            ▼               ▼               ▼
        ┌──────────┐ ┌──────────┐   ┌────────────┐  ┌────────────┐
        │Knowledge │ │ Web      │   │ Tickets    │  │ Analytics  │  ← MCP SERVERS
        │MCP (RAG) │ │search MCP│   │ MCP        │  │ MCP        │
        └────┬─────┘ └────┬─────┘   └─────┬──────┘  └─────┬──────┘
             └────────────┴───────────────┴───────────────┘
                          ▼
                   ┌─────────────┐
                   │  SYNTHESIZE │  LLM writes grounded answer + citations
                   └──────┬──────┘
                          ▼
                   ┌─────────────┐
                   │   REFLECT   │  "Did I answer? Enough sources?"
                   └──────┬──────┘
                     yes ▼   no → loop back
                   Stream to user
```

**Step by step:**

1. **Retrieve (RAG "R")** — For knowledge questions, the agent calls the **Knowledge MCP**, which
   embeds the *question* and asks Pinecone (in the tenant's namespace) for the top-k closest chunks.
   *(Concept: semantic search + tenant isolation.)*
2. **Augment (RAG "A")** — Build a prompt stuffing those chunks in as context:
   *"Using ONLY the context below, answer and cite sources. Context: [...] Question: [...]"*
   *(Concept: prompt construction, grounding to prevent hallucination.)*
3. **Generate (RAG "G")** — The LLM writes the answer from that context and cites each fact.
   *(Concept: generation + citation.)*
4. **The Agent + MCP layer** — The **PLANNER / ROUTER / REFLECT** loop makes it an *agent*: the LLM
   decides whether to search knowledge, search the web, or take an action. It calls every tool
   through **MCP**, so tools are pluggable and the agent code stays the same. The **user's role**
   decides which MCP servers the session can even see. *(Concept: agents, LangGraph, MCP, tool-calling, RBAC.)*
5. **Memory** — Conversation history (short-term) + past facts embedded and stored for long-term
   memory (RAG on the conversation). *(Concept: agent memory.)*
6. **Stream out** — Tokens stream to the frontend (token-by-token effect); each graph node and MCP
   call emits an event → powers the live **Agent Trace panel**. *(Concept: streaming, observability.)*

### 🔹 The MCP layer in detail (how tools actually connect)

- **MCP server** = a standardized wrapper around one capability. It advertises its tools
  (e.g. `search_docs`, `assign_ticket(ticket, assignee)`, `get_analytics(employee, range)`) and
  handles the real work behind them (query Pinecone, call the company's ticket API, etc.).
- **MCP client** = the LangGraph agent. On session start it asks each permitted server *"what tools
  do you have?"*, gets a standard list, and can call any of them — without custom per-tool glue.
- **Analogy:** MCP is "USB for AI tools." The agent is the brain; MCP servers are its hands, and any
  hand can be swapped without changing the brain.
- **Why it's ideal for multi-tenancy:** Company A uses one ticket system, Company B another — each is
  just a different MCP server. Onboarding a company = "connect your MCP servers," not "wait for a
  custom integration." Role-based access = "connect only the servers this role is allowed to use."

### 🔹 Cross-cutting layer (senior-level signal)
- **Evaluation** — Score answers: faithful to sources? retrieval relevant? (RAGAS / LLM-as-judge).
  Feeds the analytics dashboard. *(The #1 thing juniors skip and seniors obsess over.)*
- **Observability** — Trace every step (LangSmith): what was retrieved, which MCP tool was called,
  latency, cost. *(Concept: production AI monitoring.)*

---

## 6. One-sentence mental model

> **Ingestion** turns documents into searchable *meaning* (vectors in Pinecone, isolated per company).
> **Answering** is a LangGraph *agent* that plans, and — through **MCP** — decides which tools to use
> (knowledge, web, tickets, analytics), grounds the LLM on what it retrieves, self-checks, and streams
> a cited answer or takes a real action back.

> **RAG** lets the agent *know* things. **MCP** lets the agent *do* things. The agent is the brain;
> MCP servers are its swappable hands.

Every concept to learn — **RAG, agents, LangGraph, MCP, vector DB, Pinecone, memory, evaluation,
multi-tenancy, RBAC** — has a natural home in those sentences. Nothing is bolted on.

---

## 7. Concepts Covered (learning checklist)

- [x] **Agentic AI** (the whole system — autonomous planning, tool use, self-correction)
- [x] **GenAI** (LLM-generated answers, drafting, summarization)
- [x] **NLP** (embeddings, chunking, semantic search, text understanding & generation)
- [x] RAG (chunking, embeddings, retrieval, grounding)
- [x] Vector databases / Pinecone (per-tenant namespaces; + pgvector, Qdrant comparison)
- [x] AI Agents (planning, routing, reflection)
- [x] LangGraph (stateful graphs, loops, tool-calling)
- [x] **MCP (Model Context Protocol)** — building MCP servers + agent as MCP client
- [x] Tool use & actions (knowledge, web search, tickets, analytics — all via MCP)
- [x] Agent memory (short + long term)
- [x] Advanced RAG (hybrid search, re-ranking, query rewriting)
- [x] Evaluation (RAGAS, LLM-as-judge)
- [x] Observability (LangSmith tracing)
- [x] Streaming responses
- [x] Multi-tenant SaaS architecture (tenant isolation via Pinecone namespaces + Postgres)
- [x] Role-based access control (role decides which MCP servers a session can use)
- [x] Async job processing (Celery / background tasks) for ingestion
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
`pgvector` · `Qdrant` · `Embeddings` · `Semantic Search` · `Hybrid Search` · `Re-ranking`
`Query Rewriting` · `Prompt Engineering` · `Tool Calling` · `Function Calling` · `Agent Memory`
`Self-Correction / Reflection` · `Hallucination Control` · `Grounding & Citations`
`Guardrails` · `Streaming (SSE)` · `Evaluation (RAGAS / LLM-as-Judge)` · `LLMOps`
`Observability (LangSmith)` · `Multi-Tenant SaaS` · `RBAC` · `FastAPI` · `Celery` · `Redis`
`PostgreSQL` · `Next.js` · `Docker`

---

*Next: the implementation plan (phase-by-phase build) — to be written separately.*
