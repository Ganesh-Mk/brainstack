# 🧠 BrainStack — Learning & Build Guide

> Companion to `PROJECT_IDEA.md`.
> **Part 1** validates the idea. **Part 2** explains every AI concept in plain English.
> **Part 3** is the phase-by-phase build plan.
>
> Written for someone who knows full-stack development but is new to AI/ML/agents.

---

# PART 1 — Is this idea correct and feasible?

## 1.1 The verdict

**Yes. The architecture is sound, and the concept list is honest — you can legitimately
claim every keyword in it.** This is one of the better "learn AI by building" project
designs I've seen, for three reasons:

1. **The concepts aren't bolted on.** RAG, agents, MCP, and multi-tenancy each have a real
   reason to exist here. Most learning projects staple "add a vector DB!" onto a todo app.
   Here, a company's private docs genuinely need retrieval, and a manager genuinely needs
   the agent to *act*, not just answer.
2. **The RAG/MCP split is the right mental model.** "RAG lets the agent *know* things,
   MCP lets the agent *do* things" is exactly correct and is the thing most people get
   confused about. You already have the key insight.
3. **It's honest about the mock.** Explicitly saying "we don't build ticketing, a mock
   company API stands in for it" is the difference between a scoped project and a project
   that eats you alive. Keep that discipline.

**But it is over-scoped as written.** Not wrong — just too much for one push. The plan in
Part 3 sequences it so every phase is independently demo-able, so if you stop at Phase 5
you still have a real portfolio project.

## 1.2 Architecture decisions & rationale

The design commits to the following choices. Each is stated with the reasoning behind it, so
the *why* is clear — that's the part that matters in a review or interview. All of them are
threaded through Parts 2 and 3.

### 1. Vector database — Pinecone

The vector store is **Pinecone**: one index, one **namespace per tenant**. Pinecone is the
dedicated, industry-standard vector database, and its namespace/index/metadata model is real
AI-engineering surface area worth learning — more than a Postgres extension would teach.

- **Tenant isolation = namespaces.** Every query targets `namespace=tenant_id`. This is
  Pinecone's native multi-tenancy primitive: a tenant physically can't query another tenant's
  namespace, which is stronger than a metadata filter that a forgotten `WHERE` clause could leak.
- **Behind a `VectorStore` interface.** Pinecone lives behind a thin protocol
  (`upsert`, `query`, `delete`). This keeps the SDK out of the agent/retrieval code, lets unit
  tests use a fake in-memory store (no network in CI), and makes benchmarking a second DB later
  a one-file change.

Tradeoff to manage: Pinecone is a separate managed service (network hop, API key, free-tier
limits). Embeddings are cached hard (§Phase 2) so dev iteration stays fast and free.

### 2. MCP for external systems only; RAG/memory/eval stay native

BrainStack keeps its internal knowledge pipeline — **RAG, memory, evaluation — as native
services** for performance and simplicity. **MCP is reserved for integrating external company
systems** (ticketing, CRM, HR, analytics), where a standardized, pluggable interface provides
clear architectural benefits. A single mock **Company MCP Server** demonstrates end-to-end MCP
development and integration.

The rationale: MCP exists to make external, swappable, third-party systems pluggable. Internal
vector search is core product on the hottest path — wrapping it in MCP would add a network hop
and serialization for a swappability that would never be used. Reserving MCP for the outside
world is exactly what the protocol is for.

Concretely:
- **Knowledge search and web search are native tools** — plain Python functions wired directly
  into LangGraph.
- **One Company MCP Server** (mock) exposes the external-system tools: `assign_ticket`,
  `list_tickets`, `get_analytics`. That single server is where MCP is learned end-to-end —
  writing the server, tool discovery, transport, and the agent as a client.
- **RBAC follows naturally:** a manager's session connects to the Company MCP Server; an
  employee's does not, so the action tools are physically absent from an employee's session
  (more in §2.12).

### 3. MCP transport — HTTP (Streamable HTTP), not stdio

The Company MCP Server runs as a **long-running HTTP service** (the Streamable HTTP transport),
in its own container, and the agent connects to it as a network client.

Many MCP tutorials use **stdio** transport, where the client spawns the server as a subprocess
over stdin/stdout. That's for local desktop tools (e.g. Claude Desktop launching a filesystem
server) and cannot work here: a multi-tenant web server can't spawn a subprocess per user
session. HTTP is the only transport that fits a web backend — this is the most common mistake
when moving MCP from a tutorial to a real app.

### 4. Async jobs — FastAPI BackgroundTasks now, Celery later

Ingestion runs on **FastAPI `BackgroundTasks`** initially: async ingestion in ~3 lines,
teaching the core lesson (don't block the request) without a broker or worker process.

**Celery + Redis** is introduced later, in Phase 8, once there's a concrete reason for it —
surviving a server restart, retries with backoff, multiple workers, and an inspectable job
queue. Adding it then makes it a deliberate decision rather than premature infrastructure.

### 5. Citations — Tier 2 (page jump + passage side panel)

Clicking a citation opens the source PDF **at the cited page** and shows the **retrieved chunk
text in a side panel** beside it, so the reader sees exactly which passage grounded the answer.

This is the deliberate middle tier:
- **Tier 1 (foundation):** store `page_number` in chunk metadata → citation opens the PDF at
  page 7. ~90% of the value in ~2 hours. Built first, since Tier 2 sits on top of it.
- **Tier 2 (target):** page jump **plus** the retrieved passage in a side panel. No text-layer
  coordinate math — the chunk text and page number are already in metadata, so it's a UI panel.
- **Tier 3 (out of scope):** true in-PDF bounding-box highlighting via PDF.js text-layer search.
  Days of work matching chunk text against the rendered text layer byte-for-byte, defeated by
  spacing/ligature/hyphenation mismatches. Not worth it for this project.

Build order: Tier 1 in Phase 3, then upgrade to Tier 2 in the same phase once the page-jump
works. The side panel is what makes citations feel trustworthy without the Tier-3 pain.

### 6. Reflection — capped at 2, return best-so-far

The agent's self-correction loop runs **at most 2 attempts** (`max_reflections = 2`), with the
count tracked in the LangGraph state. Once the limit is reached, it **stops retrying and
returns the best answer generated so far** — never looping forever, never returning nothing.
The edge condition checks the count; the terminal path returns the last (best) answer.

Without the cap, a stubborn agent loops indefinitely, each iteration costing a full LLM call.
The cap is a hard requirement, not a nice-to-have.

### 7. Evaluation — own LLM-as-judge first, then RAGAS

Evaluation starts with a **hand-written LLM-as-judge**: one LLM call that takes
(question, retrieved context, answer) and returns structured output like
`{faithful: bool, reason: str}`. It's ~30 lines, it makes the mechanics of measuring
faithfulness explicit, and it powers the analytics dashboard.

**RAGAS** is added afterward, to compare against standardized metrics and strengthen the
evaluation story. Leading with the custom judge means the "how do you actually measure quality"
question has a real, understood answer rather than a library black box.

### 8. Cost discipline from day one

Cost is a first-class constraint, not an afterthought:

- **Cheap models in dev** (`claude-haiku-4-5`); swap up to `opus-4-8`/`sonnet-5` only for demos
  or production, where the extra quality justifies the cost.
- **Local embedding model** during development (free, runs on the machine).
- **Cache embeddings** — never re-embed the same chunk twice (key by content hash).
- **Hard token ceiling** on every request.

The analytics dashboard (Phase 7) then measures this, making the discipline visible.

## 1.3 Feasibility summary

| Dimension | Verdict |
|---|---|
| **Technically achievable?** | Yes. Every piece is a well-trodden path with good docs. |
| **Right for learning AI?** | Excellent. Broad coverage without being a grab-bag. |
| **Scope** | Too big for one sprint; fine as a phased 8–12 week project. |
| **Hardest part** | Not the AI. It's the **agent trace UI + streaming plumbing** (async events → SSE → React). Your full-stack skills carry you here. |
| **Most valuable part** | The **MCP + RBAC** layer. Almost nobody has this on a résumé yet. |
| **Riskiest part** | Scope creep. Every phase can swallow a month if you let it. |
| **Realistic timeline** | ~10 weeks part-time (2–3 hrs/day). Phase 0–5 ≈ 6 weeks = a genuinely impressive project. |

**Bottom line: this is a build-worthy project.** The architecture — Pinecone with per-tenant
namespaces, MCP scoped to external systems while RAG/memory/eval stay native, HTTP MCP
transport, BackgroundTasks then Celery, Tier-2 citations, a capped reflection loop, a custom
eval judge backed by RAGAS, and cost discipline throughout — is sound, and the phased plan in
Part 3 keeps every stage independently demo-able.

---

# PART 2 — Every concept explained

Read this part once now, then re-read each section when you reach the phase that uses it.

## 2.1 The foundation: what an LLM actually is

**What it is:** A function. `text in → text out`. That's genuinely it. `f(prompt) → response`.

It has **no memory**, **no database**, **no internet**, and **no ability to act**. Every API
call is completely independent. If you ask "What's my name?" after telling it your name, it
has no idea — unless you resend that earlier message. It is *stateless*, exactly like an HTTP
request.

Everything else in this project — RAG, memory, agents, tools, MCP — exists to work around
those four limitations. That framing makes the whole stack click:

| Limitation | The workaround | You'll build it in |
|---|---|---|
| No knowledge of your docs | **RAG** | Phase 1–3 |
| No memory between calls | **Memory** (resend history) | Phase 6 |
| Can't do anything | **Tool calling** | Phase 4 |
| Can't reach your systems | **MCP** | Phase 5 |

**Key vocabulary:**

- **Token** — a chunk of text (~4 chars / ~0.75 words). "Hello world" ≈ 2 tokens. You pay per
  token, in and out. `"unbelievable"` might be `un|believ|able` = 3 tokens.
- **Context window** — the max tokens in one call (input + output). Modern Claude models:
  **1,000,000 tokens**. Huge — but not free, and not a substitute for retrieval.
- **System prompt** — the instructions that define the model's role and rules. Sent every call.
- **Temperature / sampling** — randomness knob on older models. Note: on current frontier
  Claude models (Opus 4.7+, Sonnet 5) `temperature` is **removed** — you steer with prompting.
- **Streaming** — get tokens as they're generated instead of waiting. That's the ChatGPT typing effect.

**Why not just paste all the docs into the 1M context?** Fair question, and worth
understanding *why the answer is no*:
1. **Cost.** 1M tokens per question × every user × every question = bankrupt.
2. **Latency.** Processing 1M tokens takes many seconds. Every question.
3. **It doesn't fit.** A company's wiki is 50M+ tokens.
4. **Quality drops.** Models get worse at finding one fact buried in a haystack.

RAG = send only the ~5 relevant paragraphs. Cheap, fast, and *more* accurate.

### In BrainStack
Your `llm.py` module is a thin wrapper over the Anthropic SDK. One place that calls the API,
so cost tracking, retries, and model swapping all live in one file.

```python
# Recommended models (as of 2026)
#   claude-opus-4-8    — most capable. Use for the agent's planning/reasoning.
#   claude-sonnet-5    — balanced. Good default for synthesis.
#   claude-haiku-4-5   — fast + cheap. Use for dev, and for LLM-as-judge eval.

import anthropic
client = anthropic.Anthropic()

response = client.messages.create(
    model="claude-opus-4-8",
    max_tokens=4096,
    system="You are BrainStack, a company knowledge assistant.",
    messages=[{"role": "user", "content": "What is our refund policy?"}],
)
```

---

## 2.2 Prompt engineering

**What it is:** Writing the instructions well. Not magic words — just clear, specific,
structured communication. It's the closest thing AI has to "API design."

**How it works:** The model predicts what should come next. Everything you put in the prompt
shifts that prediction. Vague prompt → vague prediction.

**The techniques that actually matter for you:**

| Technique | What it means |
|---|---|
| **Role setting** | "You are a company knowledge assistant." Sets the whole tone. |
| **Context injection** | Pasting retrieved docs into the prompt. This *is* the "A" in RAG. |
| **Structured prompts** | Use XML-ish tags: `<context>...</context><question>...</question>`. Models parse structure well. |
| **Grounding** | "Answer ONLY from the context below. If it's not there, say 'I don't know.'" |
| **Few-shot** | Show 2–3 examples of the output you want. |
| **Structured output** | Force valid JSON matching a schema (there's an API param for this — don't parse free text). |

### In BrainStack
Your grounding prompt is the single most important string in the codebase. Something like:

```python
SYNTHESIS_PROMPT = """You are BrainStack, {tenant_name}'s knowledge assistant.

Answer the question using ONLY the context below. Rules:
- Cite every fact with [1], [2] matching the source numbers.
- If the context does not contain the answer, say exactly:
  "I couldn't find that in your documents."
- Never use knowledge outside the context.

<context>
{context}
</context>

<question>
{question}
</question>"""
```

That "if not there, say I don't know" line is your **primary hallucination defense**. It's
also a **guardrail** — one of your checklist keywords, and it's literally one sentence.

---

## 2.3 Embeddings — the heart of the whole thing

**This is the concept to actually understand.** Everything retrieval-related is built on it.

**What it is:** A model that turns text into a list of numbers — a **vector**.

```
"How do I get a refund?"  →  [0.021, -0.4, 0.88, ... ]   (1536 numbers)
"What's your return policy?" → [0.019, -0.39, 0.87, ...]  ← almost the same numbers!
"The cat sat on the mat"  →  [-0.9, 0.1, -0.33, ...]      ← completely different
```

**Why it's magic:** Those numbers encode **meaning**, not spelling. "refund" and "return
policy" share zero words but land in nearly the same spot. That's why this is called
**semantic search** — searching by meaning instead of keywords. Ctrl+F can't do this.

**How it actually works (the intuition):**

Picture a map. Cities near each other are similar. Now imagine that map has 1536 dimensions
instead of 2. Every piece of text is a point on it. An embedding model was trained on
enormous amounts of text and learned to place text with similar meaning at nearby points.

- "dog" and "puppy" → close together
- "dog" and "cat" → nearby (both pets)
- "dog" and "quarterly revenue" → opposite sides of the map

**How you measure "nearby":** **cosine similarity** — the angle between two vectors.
`1.0` = identical meaning, `0.0` = unrelated, `-1.0` = opposite. That's the entire math you
need. One formula, and every vector DB implements it for you.

**The critical rule:** you must use the **same embedding model** for your documents and for
your queries. Different models = different maps = nonsense results. Changing your embedding
model later means **re-embedding every document**. Choose deliberately.

**Which model to use:**

| Model | Dims | Cost | Use when |
|---|---|---|---|
| `sentence-transformers/all-MiniLM-L6-v2` | 384 | **Free** (runs locally) | **Development.** Fast, no API key, no bill. |
| OpenAI `text-embedding-3-small` | 1536 | ~$0.02 / 1M tokens | Production. Cheap and good. |
| Voyage `voyage-3` | 1024 | ~$0.06 / 1M tokens | Production, best-in-class quality. |

> ⚠️ **Important practical note:** Anthropic does **not** provide an embeddings API. Claude
> generates text; it doesn't embed. So BrainStack will use **two providers**: Claude for
> generation, and OpenAI/Voyage/local for embeddings. That's normal and expected — but it
> means your `EmbeddingProvider` should be an interface from day one so you can swap it.

### In BrainStack
```
Ingestion: chunk text → embed → upsert vector into Pinecone (namespace = tenant)
Query:     question   → embed → find nearest vectors → those are your relevant chunks
```

Same model, both directions. That symmetry is the whole trick.

---

## 2.4 Chunking

**What it is:** Splitting a big document into small pieces before embedding.

**Why:** You can't embed a 200-page PDF into one vector — you'd be averaging the meaning of
the entire book into 1536 numbers. That vector means "generic business document" and matches
nothing usefully. You need one vector per *idea*.

**How it works — and why it decides your whole app's quality:**

Chunking is the highest-leverage, least-glamorous decision in RAG. Get it wrong and no amount
of clever prompting saves you.

- **Too small** (100 tokens): you retrieve a fragment. "The limit is 30 days." *What* limit?
  The context is gone.
- **Too big** (5000 tokens): you retrieve 5 topics to answer 1 question. Noise drowns the
  signal, and you pay for the noise.
- **Just right** (500–1000 tokens): one coherent idea per chunk.

**Overlap:** Chunks overlap by ~10–15% so an idea split across a boundary isn't lost.

```
Chunk 1: [.......... "Our refund policy allows returns within" ]
Chunk 2: [ "policy allows returns within 30 days of purchase..." ]
                └── overlap ──┘
```
Without overlap, "within" and "30 days" end up in different chunks and neither is retrievable.

**Strategies, from naive to good:**

| Strategy | How | Verdict |
|---|---|---|
| Fixed-size | Every 500 tokens, hard cut | Cuts mid-sentence. Don't. |
| **Recursive character** | Split on `\n\n`, then `\n`, then `. `, then chars | **Start here.** LangChain's `RecursiveCharacterTextSplitter`. Respects structure. |
| Document-aware | Split markdown by headers, code by function | Better when you know the format. |
| Semantic | Embed sentences, cut where meaning shifts | Fancy, slow, marginal gain. Skip for now. |

**Metadata is not optional.** Every chunk must carry:
```python
{
  "text": "Our refund policy allows returns within 30 days...",
  "tenant_id": "acme-corp",     # ← multi-tenancy lives here
  "document_id": "doc_123",
  "filename": "policies-2024.pdf",
  "page_number": 7,             # ← your citations live here
  "chunk_index": 12,
}
```
`tenant_id` is what makes Company A unable to see Company B's data.
`page_number` is what makes "click citation → open page 7" possible.
**Design this schema before you write the ingestion code.** Backfilling metadata means
re-ingesting everything.

---

## 2.5 Vector databases

**What it is:** A database that finds "the vectors nearest to this vector," fast.

**The problem it solves:** With 100k chunks, comparing your query against every single one is
100k math operations per question. Slow. Vector DBs use **ANN (Approximate Nearest Neighbor)**
indexes — HNSW being the common one — that find *almost* the closest matches in
logarithmic time. "Approximate" is fine: you don't need the mathematically perfect top-5,
you need 5 good ones.

**What a query looks like:**
```python
results = db.search(
    vector=embed("What is our refund policy?"),
    top_k=5,                        # give me the 5 nearest
    filter={"tenant_id": "acme"},   # ← isolation
)
```

**The options (you're using Pinecone):**

| DB | What it is | Note |
|---|---|---|
| **Pinecone** | Managed cloud vector DB | ✅ **Your choice.** Dedicated, industry-standard, teaches namespaces + index config. |
| Qdrant | Dedicated vector DB, self-hosted (Docker) | Optional later comparison; not required. |
| pgvector | Postgres extension | The MVP shortcut you deliberately skipped. |
| Chroma | Embedded, dev-focused | Fine for a Phase-1 notebook if you want zero setup. |

**Pinecone essentials you'll actually use:**

- **Index** — one index for the whole app (a vector DB with a fixed dimension + distance
  metric). Dimension **must match your embedding model** (e.g. 1536). Metric: **cosine**.
- **Namespace** — a partition *inside* an index. **This is your multi-tenancy.** One namespace
  per tenant; every read and write targets `namespace=tenant_id`.
- **Metadata** — the JSON you attach to each vector (`filename`, `page_number`, `document_id`,
  `chunk_index`). You filter *within* a namespace on this — e.g. "only this document."
- **Upsert / query / delete** — the three operations. `upsert` writes vectors, `query` finds
  nearest, `delete` removes them (delete a whole namespace to offboard a tenant).

```python
from pinecone import Pinecone
pc = Pinecone(api_key=...)
index = pc.Index("brainstack")

# write (ingestion) — namespace = tenant
index.upsert(
    vectors=[(chunk_id, vector, {"filename": "policy.pdf", "page_number": 7, ...})],
    namespace=tenant_id,                      # ← isolation
)

# read (query) — same namespace
res = index.query(
    vector=embed(question),
    top_k=5,
    namespace=tenant_id,                      # ← isolation
    filter={"document_id": doc_id},           # optional: within this tenant
    include_metadata=True,
)
```

**Multi-tenant isolation — namespaces:**

| Approach | How | Verdict |
|---|---|---|
| **Namespace per tenant** | `namespace=tenant_id` on every call | ✅ **Use this.** Pinecone's native primitive; a tenant physically can't query another's namespace. |
| Metadata filter only | `filter={"tenant_id": ...}` | Weaker — one forgotten filter leaks data. Namespaces fail safe. |
| Index per tenant | One Pinecone index per company | Wasteful; free tier caps index count. Don't. |

> 🔒 **The isolation rule:** the namespace must come **server-side, from the authenticated
> session** — never from anything the client sends. If `tenant_id` can come from a request
> body, someone will send another company's namespace. Derive it from the JWT, pass it down
> as a function argument, and make it the *only* source. This is your #1 security invariant,
> and it's the same instinct you already have from normal SaaS — Pinecone just makes the
> partition explicit.

> 🧱 **Wrap it in a `VectorStore` interface.** Keep the Pinecone SDK in one file behind
> `upsert(namespace, ...)` / `query(namespace, ...)` / `delete(namespace)`. Your retrieval
> and agent code call the interface, never Pinecone directly. Benefits: unit tests use a fake
> in-memory store (no network in CI), and swapping/benchmarking a second DB later is a
> one-file change, not a refactor.

---

## 2.6 RAG — Retrieval-Augmented Generation

**What it is:** Three steps. The name literally is the algorithm.

```
1. RETRIEVE  — find relevant chunks (vector search)
2. AUGMENT   — paste them into the prompt
3. GENERATE  — LLM answers from that pasted context
```

**The analogy:** An LLM is a brilliant consultant with amnesia who has never seen your
company. RAG is handing them the 5 relevant pages right before they answer. They don't
*learn* your docs — they *read* them, once, for this one question.

**The whole thing in ~15 lines:**

```python
def answer(question: str, tenant_id: str) -> str:
    # 1. RETRIEVE  (namespace = tenant → isolation)
    q_vec = embed(question)
    chunks = vector_store.query(q_vec, top_k=5, namespace=tenant_id)

    # 2. AUGMENT
    context = "\n\n".join(
        f"[{i+1}] (source: {c.filename}, p.{c.page_number})\n{c.text}"
        for i, c in enumerate(chunks)
    )
    prompt = SYNTHESIS_PROMPT.format(context=context, question=question)

    # 3. GENERATE
    return llm.complete(prompt)
```

**That's it. That's RAG.** Everything else is making these three steps better.

**Why it matters (say this in interviews):**
- **No training required.** No GPUs, no fine-tuning. Add a doc → instantly answerable.
- **Current.** Update the doc, the answer updates. A fine-tuned model is frozen at train time.
- **Citable.** You know exactly which chunks produced the answer → citations.
- **Grounded.** The model has the facts in front of it, so it makes up fewer.

**Fine-tuning vs RAG** (a question you *will* be asked):
> Fine-tuning teaches **behavior/style/format**. RAG provides **knowledge**.
> "Answer like our support team" → fine-tune. "Know our refund policy" → RAG.
> 95% of "we need AI on our docs" is RAG. People reach for fine-tuning and waste months.

### In BrainStack
This is Phase 3. Your first real, working, useful thing.

---

## 2.7 Advanced RAG

Naive RAG (2.6) works ~70% of the time. These techniques get you toward 90%. Add them
*after* you have a baseline you can measure the improvement against — otherwise you have
no idea if they helped.

### Query rewriting
**Problem:** Users write bad queries. Follow-ups are worse:
> User: "What's our refund policy?"
> User: "what about for enterprise?" ← embedding this alone retrieves garbage

**Fix:** Have the LLM rewrite the query using conversation history first.
> `"what about for enterprise?"` → `"What is the refund policy for enterprise customers?"`

One cheap LLM call (`claude-haiku-4-5`), huge quality gain on multi-turn. This alone is
often the biggest single win in a chat-based RAG app.

### Hybrid search
**Problem:** Semantic search is bad at exact strings. Search `"ERR_4021"` and vectors return
"error handling documentation" — semantically related, factually useless.

**Fix:** Run both, then merge:
- **Dense** (vectors) → catches meaning
- **Sparse** (BM25 keyword search) → catches exact terms, IDs, names, error codes

Merge with **RRF (Reciprocal Rank Fusion)** — a tiny formula that combines two ranked lists
without needing to normalize their scores. ~20 lines.

> 💡 **On Pinecone:** there's no built-in keyword index, so hybrid takes one of two shapes —
> Pinecone's native **sparse-dense vectors** (encode a BM25/SPLADE sparse vector alongside the
> dense one and query both), or a separate keyword pass (`rank-bm25` over the tenant's chunks)
> merged into your dense results with RRF. Both are legitimate; the sparse-dense route is the
> more "Pinecone-native" thing to learn. See Phase 6 for the build order.

### Re-ranking
**Problem:** Vector search is fast but rough. The true best chunk might rank #8.

**Fix:** Two-stage retrieval.
1. Vector search → grab top **25** (fast, approximate)
2. **Cross-encoder** re-ranks those 25 → keep top **5** (slow, precise)

The difference: an embedding model looks at the query and doc *separately* and compares
vectors. A cross-encoder reads query and doc **together** and scores actual relevance. Far
more accurate, far too slow to run on 100k docs — but perfect on 25.

Use `cross-encoder/ms-marco-MiniLM-L-6-v2` (free, local) or Cohere Rerank (API).

**Typically the biggest single quality jump in the whole pipeline.**

### The full advanced pipeline
```
question
  → query rewrite (LLM)
  → hybrid search (dense + BM25 → RRF)   → top 25
  → cross-encoder re-rank                → top 5
  → synthesize with citations
```

---

## 2.8 Hallucination, grounding, and citations

**Hallucination:** the model confidently states something false. It's not a bug — it's the
core mechanic. The model predicts *plausible* text. Plausible ≠ true. It will never be
"fixed"; it's managed.

**Your defenses, in order of power:**

| Defense | How | Strength |
|---|---|---|
| **Grounding** | "Answer ONLY from the context" | 🔥🔥🔥 Biggest single win |
| **Escape hatch** | "If not in context, say 'I don't know'" | 🔥🔥🔥 Gives it a way out other than inventing |
| **Citations** | Every fact tagged `[1]`, `[2]`, clickable | 🔥🔥 User can verify. Also a deterrent. |
| **Faithfulness eval** | LLM-judge scores answer vs. context | 🔥🔥 Catches it in your dashboard |
| **Low-confidence abstain** | If top similarity < threshold, don't answer | 🔥 Cheap safety net |

**How citations actually work** (it's less magic than it looks):
1. Number the chunks in the prompt: `[1] ... [2] ... [3]`
2. Tell the model to cite with those numbers
3. The model writes: `"Refunds are allowed within 30 days [1]."`
4. Your backend maps `[1]` → `{filename: "policies.pdf", page: 7, chunk_id: "..."}`
5. Frontend renders it as a link to that doc + page

The model doesn't "know" the source. You gave it a number and it echoed it back. That's the
entire trick — and it's why citations are so effective for so little effort.

---

## 2.9 Tool calling (function calling)

**What it is:** The LLM's only way to affect the world. It's the foundation of every agent.

**The crucial thing to understand — the model does NOT run anything.** It just *says* it
wants to. Your code runs it. Read the loop carefully:

```
1. You  → LLM:  "What's the weather in Pune?"
                 + "here are the tools you have: get_weather(city)"

2. LLM  → You:  ⏸ STOPS. Returns a structured request:
                 { tool: "get_weather", input: {"city": "Pune"} }
                 (stop_reason: "tool_use")

3. YOUR CODE runs the actual function. Calls a real API. Gets "32°C".
   ↑ This is your code. The model can't do this. It has no network.

4. You  → LLM:  "tool_result: 32°C"

5. LLM  → You:  "It's 32°C in Pune."  (stop_reason: "end_turn")
```

The model is a **brain in a jar**. It can only think and ask. Your code is the hands. Once
this clicks, agents and MCP stop being mysterious — they're just this loop, elaborated.

**A tool definition is just a JSON Schema:**
```python
{
  "name": "search_knowledge",
  "description": "Search the company's internal documents. Use this when the "
                 "question asks about internal policies, products, or processes.",
  "input_schema": {
    "type": "object",
    "properties": {
      "query": {"type": "string", "description": "The search query"}
    },
    "required": ["query"]
  }
}
```

> 🔑 **The `description` is the most important field.** It's the *only* thing the model uses
> to decide whether to call your tool. A vague description = a tool that never fires or
> fires constantly. Be prescriptive about **when** to call it, not just what it does.
> Tuning tool descriptions is a real skill and it's where a lot of "my agent doesn't work"
> problems actually live.

---

## 2.10 AI Agents

**What it is:** An LLM in a loop with tools, deciding its own steps.

**Chatbot vs. agent:**
```
Chatbot:  question → answer.                          One shot. Fixed.
Agent:    question → think → act → observe → think → act → ... → answer
                     └──── loops until done, decides its own path ────┘
```

**The whole thing:**
```python
while True:
    response = llm.call(messages, tools=tools)
    if response.stop_reason != "tool_use":
        break                          # done, it's answering
    for tool_call in response.tool_calls:
        result = execute(tool_call)    # YOUR code
        messages.append(result)
```
That's an agent. ~8 lines. Everything else is structure, safety, and observability around it.

**The famous patterns you'll implement:**

| Pattern | What it does |
|---|---|
| **ReAct** (Reason + Act) | Think → act → observe → repeat. The classic loop above. |
| **Planner** | Decompose the question into steps first, then execute. |
| **Router** | Pick which tool/path fits this query. |
| **Reflection** | Critique its own answer, retry if bad. **CAP IT AT 2.** |

**When you should NOT build an agent** (a genuinely senior take):
> Agents are slow, expensive, and non-deterministic. If your flow is always
> "search → answer," that's not an agent, that's a function — and a function is better.
> Build an agent only when the *path is genuinely unknown in advance.*
>
> BrainStack passes this test: "Compare our refund policy with competitors and draft an
> email" needs internal docs + web + drafting. "What's our refund policy?" needs one search.
> The agent's job is deciding which situation it's in. That's a real decision, so it earns
> its keep.

### In BrainStack
```
question → PLANNER → ROUTER → [tools...] → SYNTHESIZE → REFLECT → done
                       ↑                                    │
                       └────── if not good enough ──────────┘ (max 2×)
```

---

## 2.11 LangChain vs LangGraph

Constant source of confusion. The short version:

| | **LangChain** | **LangGraph** |
|---|---|---|
| Model | Chains — linear pipelines | **Graphs** — nodes + edges |
| Loops? | Awkward | **Native** |
| State? | Passed along | **Explicit shared state object** |
| Use for | Loaders, splitters, integrations | **The agent itself** |

**Why agents need a graph:** An agent loops (reflect → retry), branches (which tool?), and
carries state (retrieved chunks, history, iteration count). A linear chain models none of
that. A graph models all of it naturally.

**LangGraph's model — it's just a state machine, and you already know state machines:**

1. **State** — a typed dict every node reads and writes
2. **Nodes** — plain Python functions: `state → partial state update`
3. **Edges** — wiring. Fixed (`A → B`) or **conditional** (`if x: B else: C`)

```python
from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, END
import operator

class AgentState(TypedDict):
    question: str
    tenant_id: str
    role: str
    messages: Annotated[list, operator.add]   # accumulates
    retrieved_chunks: list
    answer: str
    reflection_count: int          # ← the loop guard

def plan(state: AgentState) -> dict:
    ...
    return {"messages": [plan_msg]}          # merged into state

def should_retry(state: AgentState) -> str:
    if state["reflection_count"] >= 2:       # ← HARD CAP
        return "end"
    return "retry" if not good_enough(state) else "end"

g = StateGraph(AgentState)
g.add_node("plan", plan)
g.add_node("route", route)
g.add_node("synthesize", synthesize)
g.add_node("reflect", reflect)
g.set_entry_point("plan")
g.add_edge("plan", "route")
g.add_edge("route", "synthesize")
g.add_edge("synthesize", "reflect")
g.add_conditional_edges("reflect", should_retry, {"retry": "route", "end": END})
app = g.compile()
```

**The killer feature for you:** `astream_events()`. LangGraph emits an event every time a
node starts/finishes and every time a tool is called. Pipe those to SSE and **your Agent
Trace panel builds itself.** You don't instrument anything — the framework already knows.
This is the single strongest reason to use LangGraph here.

---

## 2.12 MCP — Model Context Protocol ⭐

**The star of the project. Understand this deeply — very few people have it on a résumé yet.**

**What it is:** An open standard for how AI apps talk to tools. Anthropic released it in
late 2024 and it's become the industry standard.

**The problem it solves:**

Before MCP, every AI app wrote custom glue for every integration:
```
Your agent ──custom code──→ Jira
          ──custom code──→ Slack
          ──custom code──→ Postgres
          ──custom code──→ Salesforce

M agents × N tools = M×N integrations. Everyone rebuilds the same glue forever.
```

With MCP:
```
Your agent ──MCP──→ [Jira MCP server]
           ──MCP──→ [Slack MCP server]
           ──MCP──→ [Postgres MCP server]

M + N. Write a server once, every MCP client can use it.
```

**The analogy the docs use, and it's a good one:** MCP is **USB-C for AI tools.** Before USB,
every device had its own port. Now one port, any device. Your agent is the laptop; MCP servers
are the peripherals; the protocol is the port.

**The two roles:**

- **MCP Server** — *exposes* capabilities. Answers "what tools do you have?" and "run this
  tool with these args." **You will write one of these** — the Company MCP Server for the
  external ticketing/analytics systems.
- **MCP Client** — *consumes* them. Discovers tools, calls them. **Your LangGraph agent is
  this.**

**What a server exposes (three primitives — you'll mostly use the first):**
| Primitive | What | Analogy |
|---|---|---|
| **Tools** | Functions the model can call | `POST` — does something |
| **Resources** | Data the model can read | `GET` — returns something |
| **Prompts** | Reusable prompt templates | A saved snippet |

**The handshake:**
```
1. Agent connects to server
2. Agent: "tools/list"  → Server: [{name, description, input_schema}, ...]
3. Agent hands those schemas to the LLM as available tools
4. LLM decides: call assign_ticket(ticket="login-bug", assignee="Priya")
5. Agent: "tools/call" → Server executes → returns result
6. Agent feeds result back to LLM
```

Notice steps 3–6 are **exactly the tool-calling loop from 2.9**. MCP doesn't change the loop.
It standardizes *how you discover and invoke* the tools. That's the whole idea — and knowing
that MCP is "tool calling + a discovery protocol + a transport" is the thing that makes you
sound like you actually understand it.

**Writing a server is genuinely easy** (Python `mcp` SDK, FastMCP):
```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("Company")   # the single Company MCP Server (mock)

@mcp.tool()
def assign_ticket(ticket_id: str, assignee: str) -> str:
    """Assign a ticket to a team member. Use when a manager asks to
    assign, reassign, or hand off a ticket."""
    resp = httpx.post(f"{COMPANY_API}/tickets/{ticket_id}/assign",
                      json={"assignee": assignee})
    return resp.json()["message"]

if __name__ == "__main__":
    mcp.run(transport="streamable-http")   # ← HTTP, not stdio. See §1.2 decision #3.
```
The docstring becomes the tool description the LLM reads. The type hints become the JSON
Schema. That's it — that's a production MCP server.

**Transports:**
| Transport | How | For BrainStack |
|---|---|---|
| **stdio** | Client spawns server as subprocess | ❌ Can't spawn a subprocess per web session |
| **Streamable HTTP** | Server is a long-running HTTP service | ✅ **This one.** Each server = a container. |

### Where MCP fits in BrainStack — the boundary you drew

You made the senior call: **MCP is for external company systems only.** Draw the line clearly
in your head and your README:

```
        NATIVE (in-process, fast, core product)   │   MCP (external, pluggable, swappable)
  ──────────────────────────────────────────────  │  ─────────────────────────────────────
   • Knowledge search (RAG over Pinecone)          │   Company MCP Server (mock):
   • Web search (Tavily/Brave)                     │     • assign_ticket(ticket, assignee)
   • Memory                                        │     • list_tickets(assignee?)
   • Evaluation                                    │     • get_analytics(employee, range)
                                                   │
   Plain Python tools wired into LangGraph.        │   A long-running HTTP MCP server, its
   No protocol, no network hop.                    │   own container, discovered at runtime.
```

Knowledge and web are things *you* own and run on your hot path → native tools. Tickets/HR/
analytics are a *company's* systems that differ per tenant and change over time → exactly what
MCP is for. You build **one Company MCP Server** (mock) to learn the whole protocol end-to-end.

### Why MCP is *perfect* for the external boundary
Make sure you can say this out loud:

1. **Multi-tenancy:** Company A runs Jira, Company B runs Linear. Each is just a different
   **Company MCP Server URL** in that tenant's config. **Your agent code never changes.**
   Onboarding becomes "point us at your MCP server," not "wait 3 months for a custom integration."
2. **RBAC:** A user's role determines **whether their session connects to the Company MCP
   Server at all.** An employee's agent never even *discovers* `assign_ticket` — it isn't in
   its tool list. That's not a prompt saying "please don't"; the capability is physically
   absent. Security by construction, not by persuasion.
3. **Extensibility:** New external integration = new MCP server URL. Zero agent changes.

### Your tool inventory
| Tool | Kind | Backed by | Who gets it |
|---|---|---|---|
| `search_knowledge(query)` | **Native** | Pinecone (RAG) | everyone |
| `web_search(query)` | **Native** | Tavily / Brave API | everyone |
| `assign_ticket()`, `list_tickets()` | **MCP** 🔒 | Company MCP Server → mock company API | manager/admin |
| `get_analytics(employee, range)` | **MCP** 🔒 | Company MCP Server → mock company API | manager/admin |

🔒 = manager-only. Enforced at **connection time**, not prompt time.

```python
# Native tools every session gets; the Company MCP Server is role-gated.
NATIVE_TOOLS = [search_knowledge_tool, web_search_tool]

ROLE_CONNECTS_COMPANY_MCP = {
    "employee": False,
    "manager":  True,
    "admin":    True,
}

async def build_agent(user):
    tools = list(NATIVE_TOOLS)                      # everyone
    if ROLE_CONNECTS_COMPANY_MCP[user.role]:
        client = MultiServerMCPClient({"company": MCP_CONFIG["company"]})
        tools += await client.get_tools()          # tickets + analytics appear ONLY here
    return create_agent(tools)
```

An employee's `tools` list simply never contains `assign_ticket` — the agent can't call what
it can't see. Use **`langchain-mcp-adapters`** — it turns the Company MCP Server's tools into
LangGraph tools automatically, so native and MCP tools look identical to the agent.

> 🔒 **Security note that will impress people:** don't trust the role check in the agent
> alone. The Company MCP Server should *also* validate the caller's identity/role/tenant from
> a token it receives. Defense in depth: the agent won't call it, and the server would refuse
> anyway. This is exactly why keeping the external boundary behind MCP is nice — the trust
> check lives at a clean, standardized seam.

---

## 2.13 Memory

**Reminder:** the LLM is stateless. "Memory" is you resending things. There is no magic.

**Short-term (conversation memory)** — resend the conversation history each call:
```python
messages = [
    {"role": "user", "content": "What's our refund policy?"},
    {"role": "assistant", "content": "30 days [1]."},
    {"role": "user", "content": "What about enterprise?"},  # ← "what about" now resolves
]
```
That's it. That's how ChatGPT "remembers." It doesn't.

**The problem:** conversations grow past the context window, and you pay for every token
every turn. **Solutions:**
- **Sliding window** — keep the last N turns. Simple, lossy.
- **Summarization** — periodically compress old turns into a summary. What real apps do.
- **Prompt caching** — cache the stable prefix so repeated tokens cost ~10%. Big real win.
- **Compaction** — the API can auto-summarize as you approach the limit.

**Long-term (cross-session memory)** — RAG, but on the conversation instead of documents:
```
After a session: extract durable facts → embed → store in a `memories` table
Next session:    embed the new question → retrieve relevant memories → inject into prompt
```
> ⚠️ **Scope this tightly.** "Store everything the user said" produces noise that actively
> degrades answers. Extract *explicit, durable facts only*: "prefers concise answers,"
> "works on the Payments team," "reports go to Priya." One LLM call with a structured-output
> schema at session end. Nothing more.

---

## 2.14 Streaming

**What it is:** Get tokens as they're generated instead of waiting 10s for the full answer.

**Why it matters:** Pure perception, and it's enormous. Same total time, but the user sees
progress at 300ms instead of staring at a spinner for 10s. Non-streaming AI apps feel broken.

**The stack:**
```
Anthropic SDK (async generator)
    → LangGraph astream_events() (node + token events)
        → FastAPI SSE endpoint (text/event-stream)
            → React EventSource / fetch stream
                → tokens appear
```

**SSE vs WebSocket:** Use **SSE**. It's one-directional (server→client), which is exactly
what you need; it's plain HTTP; it auto-reconnects; no extra infra. WebSockets are for
bidirectional. Don't over-engineer.

```python
from fastapi.responses import StreamingResponse

@app.post("/chat/stream")
async def chat_stream(req: ChatRequest, user=Depends(current_user)):
    async def gen():
        async for event in agent.astream_events({"question": req.q, ...}, version="v2"):
            kind = event["event"]
            if kind == "on_chat_model_stream":
                token = event["data"]["chunk"].content
                yield f"data: {json.dumps({'type':'token','v':token})}\n\n"
            elif kind == "on_tool_start":
                yield f"data: {json.dumps({'type':'trace','v':event['name']})}\n\n"
        yield "data: [DONE]\n\n"
    return StreamingResponse(gen(), media_type="text/event-stream")
```

**Two event types on one stream** — `token` (the answer) and `trace` (the agent's steps).
Your frontend routes them to two panels. **That's how the Agent Trace panel works, and it's
one endpoint.** This is the "wow" feature and it costs you ~20 lines.

---

## 2.15 Evaluation

**Why it matters:** This is the #1 thing that separates people who've *built* AI from people
who've *watched a tutorial*. Everyone can make a demo that works on 3 questions. Almost
nobody can answer "did your change make it better?"

**The problem:** AI output is non-deterministic and fuzzy. `assertEqual` is useless. Your
only tool for months is vibes — until you build evals.

**The two metrics that matter for RAG:**

| Metric | Question | Catches |
|---|---|---|
| **Faithfulness** | Is the answer supported by the retrieved context? | **Hallucination** |
| **Context relevance** | Were the retrieved chunks actually relevant? | **Bad retrieval** |

Beautifully diagnostic: bad faithfulness → fix your **prompt**. Bad relevance → fix your
**chunking/retrieval**. It tells you *which half of the system is broken*.

**LLM-as-judge** — use a cheap LLM to grade your expensive one:
```python
JUDGE = """Given the CONTEXT and the ANSWER, is every claim in the ANSWER
supported by the CONTEXT? Answer strictly.

<context>{context}</context>
<answer>{answer}</answer>"""

result = client.messages.create(
    model="claude-haiku-4-5",       # cheap judge
    max_tokens=1024,
    messages=[{"role": "user", "content": JUDGE.format(...)}],
    output_config={"format": {"type": "json_schema", "schema": {
        "type": "object",
        "properties": {
            "faithful": {"type": "boolean"},
            "unsupported_claims": {"type": "array", "items": {"type": "string"}},
            "reason": {"type": "string"},
        },
        "required": ["faithful", "unsupported_claims", "reason"],
        "additionalProperties": False,
    }}},
)
```
Structured output means you get **valid JSON, guaranteed** — no regex, no parsing failures.

**Build a golden dataset:** 20–30 `(question, expected_answer, expected_source)` triples from
your own test docs. Run them on every meaningful change. **20 questions is enough to catch
real regressions** — don't wait until you have 500.

**RAGAS:** the standard library implementing these metrics. Add it *after* your own judge,
for the keyword and to compare against standard metrics.

---

## 2.16 Observability

**What it is:** Seeing inside the agent. Which prompt was actually sent? What came back?
Which chunks? How long? How much?

**Why you can't skip it:** When an agent gives a bad answer, the failure could be in
**any** of: query rewrite, retrieval, re-rank, prompt, tool call, or synthesis. Without
tracing you're guessing. With it, you look at the trace and see instantly that retrieval
returned garbage.

**LangSmith:** two env vars and every LangGraph node, LLM call, prompt, and token count is
traced automatically.
```bash
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=...
LANGCHAIN_PROJECT=brainstack
```
Free tier is plenty. Zero code changes.

**What to log yourself** (to Postgres, for your dashboard):
```python
{
  "trace_id": ..., "tenant_id": ..., "user_id": ..., "role": ...,
  "question": ..., "tools_called": ["search_docs", "web_search"],
  "chunks_retrieved": 5, "input_tokens": 3200, "output_tokens": 450,
  "cost_usd": 0.0271, "latency_ms": 4200,
  "faithfulness_score": 0.95, "reflection_count": 1,
}
```
One row per query. That table **is** your analytics dashboard — cost, latency, quality, tool
usage, all from one insert. **LLMOps** = this table + evals + tracing. That's the whole
keyword.

---

## 2.17 Multi-tenancy & RBAC (the AI-specific twist)

You know this from full-stack. The parts that are new:

| Layer | The AI-specific concern |
|---|---|
| **Vector store** | Every query **must** target `namespace=tenant_id`. A wrong/missing namespace = a cross-company data leak, silently, inside an LLM answer. |
| **Ingestion** | Vectors upserted into the tenant's namespace; `tenant_id` also in metadata as a belt-and-suspenders check. |
| **Agent session** | Role → whether the Company MCP Server connects. |
| **Company MCP Server** | Validates the caller's tenant/role independently (defense in depth). |
| **Prompts** | Tenant name/config injected per request. |

**The one that has no analogue in normal SaaS:** in a normal app, a missing `WHERE` clause
gives a wrong 200 that QA notices. Here, a missing tenant filter means another company's
confidential data gets **smoothly paraphrased into a fluent answer with citations.** It looks
correct. Nobody notices. That's a genuinely scary failure mode and it's why the
"derive tenant_id from the JWT, never the request body" rule is absolute.

> **Test it explicitly.** Write an integration test: two tenants, same question, assert
> Tenant A never sees Tenant B's chunk. This test is worth more than 50 unit tests, and
> it's a great thing to point at in an interview.

---

## 2.18 Guardrails

Constraints on what the AI can do/say. Cheap to add, high value:

| Guardrail | Implementation |
|---|---|
| Answer only from sources | One prompt line |
| Say "I don't know" | One prompt line |
| Role limits tools | Company MCP Server connection gating (§2.12) |
| Tenant isolation | Pinecone namespace derived from JWT, never the request body |
| Reflection cap | `max_reflections = 2` in state; return best-so-far |
| Token ceiling | `max_tokens` on every call |
| Rate limiting | Per-tenant, in Redis |
| PII | Don't log raw questions in prod, or redact |

---

## 2.19 Concept → Phase map

| Concept | Learn in |
|---|---|
| LLM basics, prompts, tokens | Phase 1 |
| Embeddings, chunking, vector search | Phase 1 |
| **Pinecone (index, namespaces, metadata)** | **Phase 1 → 2** |
| RAG, grounding, citations | Phase 1 → 3 |
| Async jobs (BackgroundTasks), ingestion pipeline | Phase 2 |
| Streaming (SSE) | Phase 3 |
| Multi-tenancy (namespaces), RBAC | Phase 0, 2, 5 |
| Tool calling (native tools) | Phase 4 |
| Agents, LangGraph | Phase 4 |
| **MCP (Company MCP Server + agent as client)** | **Phase 5** |
| Memory, reflection | Phase 6 |
| Advanced RAG | Phase 6 |
| Evaluation, observability, LLMOps | Phase 7 |
| Celery, Docker polish, (optional 2nd vector DB) | Phase 8 |

---

# PART 3 — The build plan

## 3.0 Principles

1. **One new concept per phase.** Never debug two unknowns at once.
2. **Every phase ends demo-able.** Stop anywhere and you have something real.
3. **Learn the concept naked before wrapping it in a framework.** Write raw RAG before
   LangGraph. Write raw tool-calling before MCP. You'll debug 10× faster forever after.
4. **Cheap models in dev.** `claude-haiku-4-5` + a local embedding model. Swap up for demos.
5. **Write down what surprised you** at the end of each phase. That file becomes your
   interview prep and your blog post.

---

## Phase 0 — Foundation (no AI) — 3–5 days

**Goal:** a boring, working multi-tenant SaaS skeleton. Zero AI.

**Build:**
- `docker-compose.yml`: Postgres, Redis
- FastAPI skeleton, SQLAlchemy + Alembic
- Models: `Tenant`, `User` (role: admin/employee/manager), `Document`, `Chunk`
  (Postgres stores metadata/status; the **vectors** live in Pinecone, keyed by `chunk_id`)
- JWT auth; `get_current_user()` dependency that yields `(user, tenant_id, role)`
- Next.js app: login, empty workspace shell
- **Pinecone account + one index** (`brainstack`, cosine, dimension = your embedding model's).
  Free tier is fine. Store the API key in env.

**Done when:** two companies can sign up, log in, and see only their own (empty) workspace,
and you can `upsert`/`query` a throwaway vector into a test namespace from a script.

**Why first:** you're fast at this. Get the boring part behind you so AI phases are pure AI.

> 🔑 **Do this now:** make `get_current_user()` the *only* source of `tenant_id`, forever.
> Every downstream function takes it as a parameter from there, and it becomes the Pinecone
> `namespace`. Never from a request body.

---

## Phase 1 — RAG from scratch, in a script — 4–6 days ⭐

**Goal:** understand embeddings/chunking/retrieval in your bones. **No FastAPI. No frontend.
No LangChain.** One Python script.

**This is the most important phase in the project. Do not rush it.**

**Build:**
```python
# rag_lab.py — the entire concept, naked
text   = extract_pdf("policy.pdf")              # PyMuPDF
chunks = split(text, size=800, overlap=100)     # write it yourself first!
vectors = [embed(c) for c in chunks]            # sentence-transformers, local, free
store(chunks, vectors)                          # even a JSON file is fine
# query
q_vec  = embed("What is the refund policy?")
top5   = cosine_top_k(q_vec, vectors, k=5)      # write the cosine formula yourself
answer = claude(build_prompt(top5, question))
print(answer)
```

> **Deliberately do NOT use Pinecone yet.** The point of Phase 1 is to feel cosine similarity
> in your own hands. Compute it yourself over an in-memory list (or a JSON file). Save
> Pinecone for the *end* of this phase, once you've seen the raw mechanics.

**Experiments to actually run** (this is where the learning lives):
- Print cosine similarity between `"refund"` / `"return policy"` / `"the cat sat on the mat"`.
  **Watch semantic search work.** This is the moment it clicks.
- Chunk at 200, 800, 3000 tokens. Ask the same question. See quality change.
- Set overlap to 0. Find a question that breaks.
- Ask about something not in the doc. Watch it hallucinate.
- Add "if not in context, say I don't know." Watch it stop. **That's grounding.**

**Then, and only then:** redo it with LangChain's `RecursiveCharacterTextSplitter` and
**Pinecone** — `upsert` your vectors into a test namespace, `query` for the top-5 — and
appreciate that Pinecone is doing exactly the `cosine_top_k` you just hand-wrote, but at scale
and behind a namespace. That "oh, it's the same thing" moment is the point of doing it raw first.

**Done when:** you can explain embeddings to a friend without notes, and the same query returns
the same top-5 from your hand-rolled version and from Pinecone.

---

## Phase 2 — Real ingestion pipeline — 5–7 days

**Goal:** upload → parse → chunk → embed → store, async, per-tenant, with live progress.

**Build:**
- `POST /documents` → save file, create `Document(status="processing")`, kick off
  `BackgroundTasks`, return `202` immediately
- Pipeline: PyMuPDF (PDF) / trafilatura (URL) → chunk → **batch-embed** →
  `vector_store.upsert(vectors, namespace=tenant_id)` (Pinecone), plus chunk metadata rows in Postgres
- Progress: update `Document.progress` (`chunks_done / chunks_total`); poll it from the frontend
- Document Library UI: list, status badge, progress bar, delete
  (delete = remove those `chunk_id`s from the tenant's Pinecone namespace + Postgres rows)
- Namespace = `tenant_id` on every upsert; `tenant_id` also in metadata

**Learn:** chunking at scale, metadata design, **Pinecone batch upsert** (batch 100 — massively
faster than one-at-a-time, and respects Pinecone's request-size limits), namespaces, async jobs.

**Done when:** upload a 50-page PDF, watch `Extracting → Chunking → Embedding (312/312) → Ready`,
and see the vector count rise in that tenant's namespace in the Pinecone console.

> 💡 **Cache your embeddings.** Key by `sha256(chunk_text)`. Re-ingesting the same doc while
> debugging should cost $0. You will re-ingest a *lot*.

---

## Phase 3 — Grounded Q&A with citations + streaming — 5–7 days

**Goal:** the first genuinely useful thing. Naive RAG, but polished.

**Build:**
- `POST /chat/stream` → SSE
- Retrieve (`namespace=tenant_id`) → build numbered context → synthesize with citations → stream
- Chat UI: token-by-token, markdown, `[1]`-as-link
- **Citations, Tier 1 then Tier 2** (see §1.2 decision #5):
  - Tier 1: click `[2]` → open the PDF at that chunk's `page_number`
  - Tier 2: alongside the PDF, a **side panel showing the exact retrieved chunk text** for that
    citation. You already have the chunk text + page from metadata, so it's a UI panel, not
    text-layer coordinate math.
- Guardrails: grounding prompt + "I don't know"

**Learn:** SSE, streaming, prompt construction, citations, grounding.

**Done when:** you ask a question, watch it type, click `[2]`, land on the right page, **and see
the grounding passage in the side panel next to it.**

**🎉 This is already a portfolio project.** Everything after this makes it a *standout* one.

---

## Phase 4 — The agent (LangGraph) — 7–10 days

**Goal:** replace the fixed pipeline with a brain that decides.

**Build in this order:**
1. **Raw tool-calling loop first.** No LangGraph. Two tools (`search_knowledge`, `web_search`
   via Tavily). Write the `while stop_reason == "tool_use"` loop by hand. **Feel the loop.**
2. **Then** port to LangGraph: `AgentState`, nodes (plan/route/synthesize), edges.
3. Wire `astream_events()` → your existing SSE endpoint → **Agent Trace panel**.

**Learn:** tool calling, agent loop, LangGraph state/nodes/edges, event streaming.

**Done when:** *"Compare our refund policy with competitors"* visibly does
`🧠 Planning → 🔍 Knowledge → 🌐 Web → ✍️ Drafting` in the trace panel, live.

> ⚠️ **Expect to spend real time tuning tool descriptions.** Your agent will search the web
> for internal policy, or search docs for today's weather. That's not a bug in the agent —
> it's a bug in your descriptions. This debugging *is* the lesson.

---

## Phase 5 — MCP + RBAC — 6–8 days ⭐⭐

**Goal:** the differentiator. Your **external** boundary becomes MCP; your agent becomes an MCP
client. Knowledge and web search **stay as the native tools you already built in Phase 4** —
you are *not* rewriting them as MCP servers (see §1.2 decision #2). You build one real MCP server
and learn the whole protocol through it.

**Build:**
1. **Mock company API** — plain FastAPI, in-memory dicts. Tickets + employee analytics.
   Deliberately dumb. ~1 hour. Do not gold-plate this — it's a prop.
2. **One Company MCP Server** (FastMCP, `streamable-http`, its own container) exposing
   `assign_ticket` · `list_tickets` · `get_analytics`, backed by the mock API.
3. **Agent as MCP client** — `langchain-mcp-adapters` + `MultiServerMCPClient`; MCP tools get
   merged into the agent's tool list right alongside the native knowledge/web tools.
4. **RBAC gating** — role decides whether the session connects to the Company MCP Server at
   all (§2.12). Also validate tenant/role *inside* the server (defense in depth).
5. Frontend: a "Connections" page showing whether this role is connected to the Company system.

**Learn:** MCP protocol, server vs client, tool discovery, `streamable-http` transport,
native-vs-MCP boundary decisions, capability-based security.

**Done when:**
- A **manager** asks *"Assign login-bug to Priya and show her workload"* → agent calls the MCP
  `assign_ticket` then `get_analytics`, trace shows `🔍 Knowledge (native) → 🎫 Company MCP → 📊 Company MCP`
- An **employee** asks the same → agent says it can't, because **`assign_ticket` doesn't exist
  in its session** (the Company MCP Server was never connected). Not because a prompt asked nicely.

**That employee/manager contrast is your demo.** Record it. It's the single most compelling
30 seconds of the project — and being able to say "knowledge search is native, only the
*external* company system is MCP, and here's why" is what makes it sound like engineering
rather than buzzword bingo.

---

## Phase 6 — Memory, reflection, advanced RAG — 7–10 days

**Goal:** quality. Add one thing at a time and **measure each** (this is why Phase 7's evals
almost belong here — consider pulling the golden dataset forward).

**Build, in this order (highest ROI first):**
1. **Short-term memory** — conversation history in state, sliding window + summarization
2. **Query rewriting** — biggest multi-turn win, one Haiku call
3. **Re-ranking** — cross-encoder, top-25 → top-5. Usually the biggest quality jump.
4. **Hybrid search (Pinecone way)** — Pinecone has no built-in BM25, so you have two options:
   (a) **Pinecone sparse-dense vectors** — encode each chunk with both a dense embedding and a
   sparse vector (BM25/SPLADE), upsert both, and query hybrid — the "proper" Pinecone approach
   and the more impressive one to learn; or (b) run a lightweight keyword pass (`rank-bm25`
   over the tenant's chunks) and merge with the dense results via **RRF**. Start with (b) if
   (a) feels heavy; either gets you the keyword. Note this Pinecone-specific wrinkle in your README.
5. **Reflection** — critique + retry, **run at most 2 attempts, count tracked in state, and on
   the 2nd failure return the best answer so far** (never loop, never return empty)
6. **Long-term memory** — extract explicit facts at session end, embed, retrieve next session

**Done when:** follow-ups work naturally, `"ERR_4021"` finds the exact doc, reflection never
loops more than twice, and you can point at numbers showing each addition helped.

---

## Phase 7 — Evaluation, observability, dashboard — 5–7 days

**Goal:** prove it works. The senior signal.

**Build:**
1. **Golden dataset** — 20–30 `(question, expected_answer, expected_source)` from your docs
2. **LLM-as-judge** — your own faithfulness + relevance scorers (Haiku + structured output)
3. **Eval runner** — `python eval.py` → scores the whole dataset → prints a table
4. **RAGAS** — add after, compare against your own metrics
5. **LangSmith** — two env vars
6. **`query_traces` table** — one row per query (§2.16)
7. **Analytics dashboard** — cost/day, p50/p95 latency, faithfulness over time, tool usage,
   top questions

**Done when:** you change your chunk size, run `eval.py`, and can say **"faithfulness went
0.82 → 0.91"** instead of "feels better."

> 🏆 **This phase is what makes people believe you've done this before.** Most portfolio AI
> projects have a demo. Almost none have a number.

---

## Phase 8 — Production polish — 5–7 days

**Goal:** the keywords you deferred, now added as *decisions*.

**Build:**
- **Celery + Redis** — migrate ingestion off BackgroundTasks. Write down *why*: survives
  restarts, retries with backoff, multiple workers, inspectable queue.
- **Prompt caching** — cache the stable system prompt prefix; measure the cost drop.
- **Docker Compose** for everything: app, Company MCP Server, mock API, Postgres, Redis, frontend
  (Pinecone is a managed service — it's an API key + env, not a container).
- **Rate limiting** per tenant (Redis)
- **Optional — second vector DB behind your `VectorStore` interface.** Because you already
  wrapped Pinecone (§2.5), adding a Qdrant adapter and **benchmarking the two** on the same
  corpus (ingest time, p95 query latency, cost, DX) is a one-file change and a strong README
  table — "I benchmarked Pinecone vs Qdrant, here's the data." Do it if you have time; skip
  without guilt if you don't.
- **README** with architecture diagram, the native-vs-MCP boundary explained, a "tradeoffs I
  made" section (why Pinecone, why MCP only for external, why cap reflection), and any benchmark data.

**Done when:** `docker compose up` boots the platform (app + Company MCP Server + mock API +
Postgres + Redis + frontend, talking to Pinecone), and your README explains your decisions with data.

---

## 3.1 Timeline

| Phase | Days | Cumulative |
|---|---|---|
| 0 — Foundation | 3–5 | ~1 wk |
| 1 — RAG from scratch ⭐ | 4–6 | ~2 wk |
| 2 — Ingestion pipeline | 5–7 | ~3 wk |
| 3 — Q&A + citations + streaming | 5–7 | **~4 wk ← portfolio-ready** |
| 4 — LangGraph agent | 7–10 | ~5.5 wk |
| 5 — MCP + RBAC ⭐⭐ | 6–8 | **~6.5 wk ← standout** |
| 6 — Memory + advanced RAG | 7–10 | ~8.5 wk |
| 7 — Eval + observability 🏆 | 5–7 | **~9.5 wk ← senior signal** |
| 8 — Polish | 5–7 | ~10.5 wk |

**Natural stopping points:** end of 3 (good), end of 5 (great), end of 7 (exceptional).

---

## 3.2 Recommended stack (with the changes from Part 1)

| Layer | Choice | Note |
|---|---|---|
| **LLM** | `claude-haiku-4-5` (dev + judge) → `claude-opus-4-8` (agent) / `claude-sonnet-5` (synth) for demos | Anthropic Python SDK. Cost-first: cheap in dev, swap up for demos. |
| **Embeddings** | Dev: `all-MiniLM-L6-v2` (local, free) · Prod: OpenAI `text-embedding-3-small` | ⚠️ Anthropic has no embeddings API. Dim must match Pinecone index. |
| **Vector DB** | **Pinecone** (one index, namespace per tenant) | Behind a `VectorStore` interface. Optional Qdrant benchmark in Phase 8. |
| **Knowledge / web tools** | **Native** Python tools in LangGraph | Not MCP — core product, hot path. |
| **Agent** | LangGraph | LangChain only for loaders/splitters |
| **MCP** | `mcp` (FastMCP) + `langchain-mcp-adapters` — **one Company MCP Server** | External systems only. **`streamable-http`, not stdio.** |
| **API** | FastAPI + SSE | |
| **Jobs** | BackgroundTasks → Celery in Phase 8 | |
| **DB** | Postgres (metadata/status/traces) | Vectors live in Pinecone, not Postgres. |
| **Cache/queue** | Redis | |
| **Frontend** | Next.js + Tailwind + shadcn/ui | |
| **Eval** | Own LLM-judge → RAGAS | Judge first, RAGAS after. |
| **Tracing** | LangSmith | 2 env vars |
| **Infra** | Docker Compose | Pinecone is managed (API key), not a container. |

## 3.3 Repo shape

```
brainstack/
├── docker-compose.yml
├── backend/
│   ├── app/
│   │   ├── api/            # routes: auth, documents, chat, analytics
│   │   ├── core/           # config, security, deps (get_current_user)
│   │   ├── models/         # SQLAlchemy
│   │   ├── ingestion/      # parse, chunk, embed, upsert-to-pinecone
│   │   ├── retrieval/      # vector_store.py (Pinecone behind interface), hybrid, rerank, query_rewrite
│   │   ├── tools/          # NATIVE tools: search_knowledge, web_search
│   │   ├── agent/          # graph.py, state.py, nodes/, mcp_client.py (connects Company MCP)
│   │   ├── llm/            # anthropic wrapper, cost tracking
│   │   └── eval/           # judge.py, golden_dataset.json, run_eval.py
├── company_mcp_server/     # THE MCP server — assign_ticket, list_tickets, get_analytics
├── mock_company_api/       # deliberately dumb, in-memory (backs the MCP server)
└── frontend/               # Next.js
```

---

## 3.4 Pitfalls — read before starting each phase

| Pitfall | Fix |
|---|---|
| Building UI before the AI works | Script → API → UI. Always. |
| Skipping Phase 1 to "get to the good part" | Phase 1 **is** the good part. Everything else assumes it. |
| Framework before fundamentals | Raw RAG before LangChain. Raw tools before MCP. |
| Chunk size chosen at random | Test 3 sizes on real questions in Phase 1. |
| Wrong/missing Pinecone namespace | Namespace = `tenant_id` from the JWT only. Write the two-tenant leak test. |
| Embedding dim ≠ index dim | Pinecone rejects the upsert. Set the index dimension to your model's, and don't change models mid-project. |
| Uncapped reflection | `max_reflections = 2`, in state, in the edge condition; return best-so-far. |
| Vague tool descriptions | Be prescriptive about **when** to call. Iterate on failures. |
| No evals | You'll optimize on vibes and regress silently. |
| stdio MCP transport | HTTP. You're a web server. |
| Re-embedding constantly in dev | Cache by content hash. |
| Gold-plating the mock API | It's a prop. 1 hour, in-memory dicts, move on. |
| Tier-3 PDF highlighting in week 1 | Page-level first. Come back if time allows. |

---

## 3.5 The interview answers this project earns you

If you finish Phase 5, you can answer these *from experience*:

- **"Explain RAG."** → 2.6. You wrote it from scratch.
- **"Why not fine-tune?"** → Knowledge vs. behavior. 2.6.
- **"How do you stop hallucination?"** → Grounding + escape hatch + citations + faithfulness
  eval. Layers, not a silver bullet. 2.8.
- **"How do you pick chunk size?"** → "I tested 200/800/3000 against a golden set and measured
  faithfulness." Almost nobody has a real answer here.
- **"What's MCP, and where did you use it?"** → "Tool calling plus a discovery protocol plus a
  transport — it turns M×N integrations into M+N. I used it **only for external company
  systems** (ticketing/analytics via one Company MCP Server), and kept knowledge search, web
  search, and memory as native tools because they're core product on the hot path. Knowing
  where the boundary goes is the point." 2.12. ← **This one lands.**
- **"How does RBAC work with agents?"** → "Role decides whether the session connects to the
  Company MCP Server at all. The employee's agent never discovers `assign_ticket` —
  capability-based, not prompt-based." ← **This one lands too.**
- **"How do you know it works?"** → Golden dataset + LLM-judge + trace table. 2.15.
- **"When would you *not* use an agent?"** → "When the path is known. Then it's a function,
  and a function is cheaper, faster, and deterministic." 2.10.
- **"Why Pinecone, and how do you isolate tenants?"** → "Dedicated industry-standard vector DB
  — I wanted to learn its index/namespace model, not the pgvector MVP shortcut. Isolation is a
  namespace per tenant, derived from the JWT, so a tenant physically can't query another's
  vectors. I kept it behind a `VectorStore` interface so I *could* benchmark a second DB." 2.5.

---

## 3.6 What to do tomorrow

1. Skim Part 2 once, end to end. Don't try to absorb it.
2. Re-read **2.3 (embeddings)** and **2.6 (RAG)** properly.
3. Start **Phase 0**. It's your comfort zone — build momentum.
4. Get an Anthropic API key. Set a **spend limit**.
5. Write `rag_lab.py` (Phase 1) on one PDF. Print those cosine similarities.

**The moment "refund" and "return policy" come back at `0.87` while "the cat sat on the mat"
comes back at `0.04` — that's the moment AI stops being magic and starts being engineering.**

Everything in this document is downstream of that one number.
