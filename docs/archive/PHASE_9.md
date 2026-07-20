# 📊 BrainStack — Product Phase 9: Evaluation & Observability (Backend Phase 7) 🏆

> **Companion to `PROJECT_GUIDE.md` Part 3 §Phase 7 (5–7 days).** The guide:
> *"Most portfolio AI projects have a demo. Almost none have a number."*
> Done when a config change can be answered with **"faithfulness went
> 0.82 → 0.91"** instead of "feels better".

## 1. What gets built

1. **Golden dataset** — 22 `(question, expected_keywords, expect_refusal)`
   pairs authored from the handbook (`backend/eval/golden.jsonl`), including
   trap questions the corpus can't answer (the refusal rule is part of what
   we grade).
2. **LLM-as-judge** — our own scorers (`services/evaluation.py`, haiku +
   strict JSON): **faithfulness** (is every claim supported by the retrieved
   sources?) and **answer relevance** (does it answer the question asked?),
   plus a deterministic **retrieval hit-rate** (expected keywords present in
   retrieved chunks) and **citation validity** (every [n] exists).
3. **Eval runner** — `python eval/run_eval.py <base_url>`: provisions a
   throwaway eval tenant over the real API, ingests the handbook, asks all
   22 through the real SSE agent, judges locally, prints the table, stores
   an `eval_runs` row (so the Evaluation page shows real history), cleans up.
4. **`query_traces` table** — one row per ask (§2.16): latency, first-token
   latency, tools used, sources, token usage + computed cost, status. Written
   for successes AND failures.
5. **Stats endpoints + four pages unlock** — Dashboard (workspace at a
   glance, every role), Analytics (cost/latency/tool usage/top questions,
   admin), Evaluation (eval-run history, admin), Observability (recent
   per-query traces, admin).
6. **RAGAS / LangSmith (guide items 4–5) — decisions, not builds.** RAGAS:
   skipped — its value is cross-checking judges we already built; the dep
   tree (langchain-community + datasets + pandas) outweighs it on a 512MB
   deploy. LangSmith: supported via env vars if set; not required. Both
   documented as tradeoffs.

## 2. Schema

- `query_traces` (id, tenant_id, user_id, conversation_id, question,
  status, latency_ms, first_token_ms, tool_kinds, source_count,
  input_tokens, output_tokens, cost_usd, model, created_at)
- `eval_runs` (id, dataset_size, faithfulness, relevance, retrieval_hit,
  citation_validity, model, notes, per_question JSON, created_at)

## 3. Done when

`eval.py` prints the table twice on two configs and the numbers move; the
four pages render real data in production; every production ask leaves a
trace row with cost attached.
