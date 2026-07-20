# ✅ Phase 8 COMPLETE — Memory & Advanced RAG (Backend Phase 6)

> Shipped 2026-07-20. Verified: 70 backend tests, local e2e 13/13,
> production e2e 13/13 (real Claude + Pinecone + the new retrieval stack).

## What changed

### Retrieval is now a pipeline
```
dense top-25 (Pinecone) ─┐
                         ├─ RRF merge ─ [cross-encoder rerank]* ─ top-6
BM25 top-25 (Postgres) ──┘
```
- **Hybrid (BM25 + RRF):** chunk text already lived in Postgres, so BM25
  (`rank-bm25`) runs over the tenant's own chunks and merges with the dense
  ranking via Reciprocal Rank Fusion — order-based, no score-normalization
  games. This is what finds exact tokens: the e2e proves `ERR_4021` is
  answered correctly, and a unit test pins the exact failure mode (dense
  retrieval faked to MISS the chunk → hybrid still surfaces it).
- **Cross-encoder rerank** (`Xenova/ms-marco-MiniLM-L-6-v2`, fastembed
  ONNX): reads (question, passage) together and reorders the merged
  candidates. **OFF by default in deployment** — see war story below.
  `RERANK_ENABLED=true` turns it on where there's memory headroom.
- Source `score` stays the dense cosine (BM25-only candidates get theirs
  from the embedding cache) so the UI's relevance % keeps meaning.
- **Query rewriting — subsumed, by decision:** the agent already writes its
  own `search_knowledge` queries with full history in context, which IS the
  rewrite step. Verified live: *"And which of those error codes is safe to
  retry automatically?"* resolves correctly in a follow-up turn.

### Memory, both kinds
- **Short-term:** sliding window (6 turns) + automatic summarization —
  once a thread outgrows the window, older turns compress into
  `conversations.summary` (one haiku call AFTER the answer is delivered)
  and are injected ahead of recent turns.
- **Long-term:** post-answer extraction of durable facts the USER stated
  (usually none) → `memories` table + `"{tenant}-mem"` Pinecone namespace,
  tagged per user; recall is top-3, cosine-gated at 0.35, injected into the
  system prompt. Live demo (production): tell it *"I'm Alex, I run the
  Bangalore office"* in one conversation, ask *"what's my name?"* in a NEW
  one → *"You're Alex, and you run the Bangalore office."*
- **Memory page** (`/agent/memory`) unlocked: view + forget (deletes the
  vector with the row). `/memories` GET/DELETE, tenant+user scoped.

### Reflection (capped at 2, structurally)
A grounding critic (haiku, fails open) examines the FIRST draft only —
`drafts` in graph state makes a second critique unreachable, unit-tested on
the real compiled graph. A rejected draft emits SSE `reset` (UI clears the
streamed text) + a `reflection` trace step with the critique, then the
rewrite streams. The 2nd draft ships regardless: never loops, never empty.

## Protocol additions
- SSE event `reset`; trace kind `reflection` (⚡-adjacent warning styling).
- Every memory/summary/reflection feature degrades to a no-op on failure —
  quality features never take down answering (and the test suite seals
  these seams so it stays hermetic).

## ⚔️ War story — the reranker OOM
With `RERANK_ENABLED=true` as the default, the FIRST production ask loaded
a second ONNX model next to the embedder and the 512MB Render free instance
was OOM-killed — `/health` returned 502s. Hotfix: rerank is opt-in;
hybrid RRF (pure Python, no model) stays on everywhere. The lesson repeats
from Phase 3: local green means nothing until the deployment target agrees.

## Verified
- 70/70 backend tests (11 new: dense-miss→BM25-hit, tenant isolation of the
  BM25 corpus, RRF agreement, reflection cap/skip/clean-pass, extraction
  dedupe + score gate, /memories scoping, summary overflow trigger).
- Local e2e 13/13; **production e2e 13/13** (one stochastic follow-up miss
  on the first prod run — passed on rerun; noted, not hidden).

## 🌐 Browser checklist (app.brainstack.space)
- [ ] Ask: *"My name is <you>, I run the <city> office. What's our refund
      policy?"* → answer as usual. Open **Memory** (Intelligence) → the two
      facts are listed.
- [ ] NEW conversation: *"What's my name?"* → answered from memory.
- [ ] Memory page → forget a fact → it's gone (and stays gone).
- [ ] Ask something with an exact code/term from your documents → the right
      source appears even for rare tokens.
- [ ] Keep one conversation going past ~4 exchanges → early context still
      referenced correctly (the summary is doing its job, invisibly).
- [ ] If you ever see a **⟳ Reflecting** step: the draft was rejected and
      rewritten in front of you — the streamed text clears and restarts.
