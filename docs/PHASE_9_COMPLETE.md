# ✅ Phase 9 COMPLETE — Evaluation & Observability (Backend Phase 7) 🏆

> Shipped 2026-07-20. The guide: *"Most portfolio AI projects have a demo.
> Almost none have a number."* BrainStack now has numbers:

| metric | production (hybrid, rerank off) | local (cross-encoder ON) |
|---|---|---|
| **faithfulness** | 0.977 | **1.000** |
| **relevance** | 0.955 | 0.932 |
| **retrieval hit-rate** | 1.000 | 1.000 |
| **citation validity** | 0.955 | **1.000** |

22 golden questions (incl. 2 refusal traps — both refused correctly in both
runs). So the Phase 8 reranker decision can now be stated the senior way:
*"the cross-encoder takes faithfulness 0.977 → 1.000 and citation validity
0.955 → 1.000; it stays opt-in because it OOMs a 512MB instance."*

## What was built

1. **Golden dataset** — `backend/eval/golden.jsonl`: 22 questions authored
   from the handbook, expected keywords (with `|` alternatives), and two
   questions the corpus can't answer — grading the REFUSAL rule too.
2. **LLM-as-judge** (`services/evaluation.py`) — faithfulness + relevance
   scorers (haiku, strict JSON, honest-refusal-scores-1.0), plus
   deterministic retrieval hit-rate and citation validity ([n] must exist).
3. **Eval runner** (`eval/run_eval.py`) — throwaway tenant over the real
   API → real ingestion → real SSE agent → judged → table printed →
   `eval_runs` row stored (the Evaluation page's history) → cleanup.
4. **`query_traces`** — one row per ask, ok AND error: latency,
   first-token latency, tool kinds, source count, approximate token usage,
   attributed cost (haiku list prices), model. Written outside the answer
   path; can never block or break answering.
5. **Stats API** — `/stats/dashboard` (every role, tenant-scoped),
   `/stats/analytics`, `/stats/traces`, `/stats/evals` (admin-only).
6. **Four pages unlocked** — Dashboard (KPIs, tool-usage bars, memory
   count), Analytics (per-day chart with error stacking, p50/p95 answer +
   first-token latency, token/cost totals, top questions), Evaluation
   (run history, score chips, per-question drill-down), Observability
   (per-request trace table). All with demo fallback.

## Decisions (guide items done as tradeoffs, not builds)

- **RAGAS:** skipped. Its role is cross-checking judges we already built;
  the dependency tree (datasets/pandas/langchain-community) is real weight
  on a 512MB deploy. Our judges + deterministic metrics cover the need.
- **LangSmith:** honored if `LANGCHAIN_*` env vars are set (langchain picks
  them up natively); not required, nothing breaks without it.

## Verified

- 70 backend tests → **79** after Phase 9 (trace on ok + error, dashboard
  scoping + role-openness, admin 403s, percentile/judge mechanics).
- Production e2e **12/12** — including a found-in-the-wild observability
  win: the first ask after idle showed `first_token 26.2s of 26.9s total`,
  which is the free-tier cold start, now measurable instead of anecdotal.
- Two real eval runs stored (the table above) — visible on the Evaluation
  page in production.

## 🌐 Browser checklist (app.brainstack.space, admin account)

- [ ] **Dashboard** shows real counts (ask something first if it's zeros).
- [ ] **Analytics** (Insights): per-day bars, p50/p95 latency, top
      questions; refresh after asking and the numbers move.
- [ ] **Observability**: your question is the top row — tools, first-token
      time, tokens, cost.
- [ ] **Evaluation**: two runs with the scores above; open the
      per-question breakdown on the latest run.
- [ ] Switch role simulator to Employee → Insights section disappears;
      Dashboard remains (it's for everyone).
