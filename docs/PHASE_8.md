# 🧠 BrainStack — Product Phase 8: Memory & Advanced RAG (Backend Phase 6)

> **Companion to `PROJECT_GUIDE.md` Part 3 §Phase 6 (7–10 days).**
> Goal: **quality** — each addition measured, per the guide. Built
> autonomously (user pre-approved the full run to completion).

## 1. What gets built (guide order, highest ROI first)

1. **Short-term memory, upgraded** — the sliding window stays; when a
   conversation outgrows it, the older turns are summarized (one Haiku call
   after the answer is delivered) into `conversations.summary`, which is
   injected ahead of the recent turns. Long chats stop forgetting their
   beginning.
2. **Query rewriting — subsumed by the agent (decision).** The guide's
   rewrite step exists to turn "what about managers?" into a standalone
   query. Our agent already does exactly this: the model writes the
   `search_knowledge` query itself with full history in context. A separate
   rewrite call would be a second model call doing the same job. Verified by
   an e2e multi-turn test instead of re-implemented.
3. **Re-ranking** — dense retrieval widens to top-25 candidates; a
   cross-encoder (`Xenova/ms-marco-MiniLM-L-6-v2` via fastembed ONNX — same
   family as the embedder, free-tier friendly) reranks to the final top-6.
   Lazy-loaded; any load/scoring failure falls back to the pre-rerank order.
4. **Hybrid search (guide option b)** — chunk text already lives in Postgres,
   so BM25 (`rank-bm25`) runs over the tenant's chunks and merges with dense
   candidates via **RRF** before reranking. This is what makes exact tokens
   like error codes findable when embeddings shrug.
5. **Reflection** — after a drafted answer (when sources were used), a Haiku
   critic checks grounding/citations. On failure: ONE retry with the
   critique (2 attempts max, tracked in state; the 2nd draft ships
   regardless — never loops, never empty). The UI sees an SSE `reset` event
   (clear the streamed draft) + a `reflection` trace step, so the retry is
   visible, not hidden.
6. **Long-term memory** — after each answer, a Haiku extractor pulls durable
   facts the USER stated ("I'm Alex", "I run the Bangalore office") — most
   exchanges yield none. Facts live in a `memories` table and are embedded
   into a per-tenant `"{tenant}-mem"` Pinecone namespace; at ask time the
   top-3 relevant memories (score-gated) are injected into the system
   prompt. The **Memory page** (`/agent/memory`) unlocks: view + delete
   (delete removes the vector too).

## 2. Schema

- `conversations.summary` TEXT NULL
- `memories` (id, tenant_id, user_id, content, conversation_id NULL,
  created_at) — vector lives in Pinecone keyed by row id.

## 3. New config (all safe defaults; no new Render env needed)

`RETRIEVE_CANDIDATES=25`, `RERANK_ENABLED=true`, `HYBRID_ENABLED=true`,
`BM25_MAX_CHUNKS=5000`, `MEMORY_ENABLED=true`, `MEMORY_TOP_K=3`,
`MEMORY_MIN_SCORE=0.35`, `REFLECTION_ENABLED=true` (2 attempts fixed),
`SUMMARY_MODEL`/extractor/critic all = `LLM_MODEL_DEV` (haiku).

## 4. Protocol / UI changes

- SSE: new `reset` event (clear live draft); trace kind `reflection`.
- `/memories` GET/DELETE; Memory page unlocked (list, delete, explainer).

## 5. Done when (guide)

Follow-ups work naturally (e2e multi-turn), an exact error-code lookup finds
its chunk (e2e), reflection is capped at 2 attempts (unit-tested on the real
graph), memories persist across conversations (e2e), and the retrieval
upgrades are measured on the lab questions (before/after table in the
complete doc).
