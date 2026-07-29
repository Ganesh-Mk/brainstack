# ✅ Fine-tuning COMPLETE — our own answering model 🧠

> Shipped 2026-07-29. BrainStack no longer only *calls* an LLM — it has one we
> trained, plugged into the live product behind a switch, measured against
> Claude on our own eval harness.

| metric | claude-haiku-4-5 | **brainstack-3b** | Δ |
|---|---:|---:|---|
| **faithfulness** | 1.000 | **1.000** | = |
| **citation validity** | 1.000 | **1.000** | = |
| **retrieval hit-rate** | 1.000 | **1.000** | = |
| **refusal on traps** | 2/2 | **2/2** | = |
| relevance | 0.977 | 0.909 | −0.068 |
| avg latency | 18.5s | 26.0s | +7.5s |
| API cost | metered | **$0.00** | — |

22 golden questions, identical retrieval, identical judges — only the model
writing the answer differs. A 4-bit 3B model on a CPU **tied Claude on every
metric the fine-tune was trained to move.**

The senior way to state it: *"I distilled 1,010 grounded-answering examples
from Haiku, QLoRA'd Qwen2.5-3B on a free T4, served it 4-bit on CPU via Ollama,
and it matched Claude on faithfulness and citation validity at zero API cost —
losing only on relevance, two thirds of which turned out to be my own judge's
instability."*

---

## What was built

1. **Distillation pipeline** (`training/generate_data.py`) — assembles context
   blocks from 590 passages across 12 documents, has Haiku write the ideal
   cited answer, and gates every row before it reaches the dataset. Prompts are
   built by importing `chat.SYSTEM_PROMPT` and `chat.build_user_prompt()`, never
   retyped — even the refusal sentence is parsed back out of the live prompt,
   so a reworded prompt raises instead of silently teaching a stale sentence.
2. **Dataset** — `training/data/train.jsonl` (930) + `val.jsonl` (80). 17%
   refusal traps. Distractor passages in every example, because real retrieval
   puts junk in the top-6.
3. **Colab notebook** (`training/finetune_colab.ipynb`) — Unsloth + QLoRA on
   `Qwen/Qwen2.5-3B-Instruct`, r=16, 2 epochs, `train_on_responses_only`, with a
   token-length check that runs *before* training rather than after.
4. **Export** — merged → GGUF Q4_K_M (1.93 GB) → Ollama. `make_modelfile.py`
   generates the Modelfile from the live prompt for the same anti-drift reason.
5. **Grounded mode** (`backend/app/services/grounded.py`) — the `LLM_PROVIDER
   =local` answer path. Same retrieval, same prompt, same SSE event sequence;
   a different model writes the answer.
6. **The switch** — one `if` at the top of `ask.run()`, so both callers (the
   app's SSE route and `/v1/ask`) get it from one implementation, exactly as
   the graph loop was extracted in Phase 11b.
7. **The comparison** (`training/compare_eval.py`) → `FINETUNE_RESULTS.md`,
   including refusal-on-traps computed from `per_question` (the eval_runs table
   has no column for it, and averaging it into `retrieval_hit` would hide it).

## Decisions

1. **Train the behaviour, never the documents.** A model with a tenant's
   handbook in its weights would leak it to the next tenant. Documents come
   from RAG at question time, as before. What was trained is the habit: read
   numbered passages → cite with `[n]` → refuse when the answer isn't there.
2. **Qwen 2.5 3B over Llama 3.2 3B.** Apache 2.0, and not gated on HuggingFace
   — a dead Colab session costs a restart, not a token-paste ritual.
3. **Grounded mode, not an agent swap.** `chat.py:258` records that the direct
   Phase-5 path was retired when the agent became the only ask path. Rather
   than make a 3B model emit tool-call JSON — which it does badly, and whose
   failure would say nothing about grounding — the local model gets the
   sub-task it was trained for. Claude keeps the tools.
4. **Production stays on Claude.** `LLM_PROVIDER` defaults to `anthropic` and a
   test asserts that default. Render's 512MB free instance cannot host a model
   — the same constraint that made the reranker opt-in in Phase 8.
5. **Zero cost is a feature, not a consolation.** `cost_usd=0.0` on the outcome,
   not `None`: the run happened and cost nothing, and analytics must tell those
   apart.

## Verified

- **154 tests pass**, including 9 new ones in `test_grounded.py` that pin the
  SSE event contract — the reason the frontend, `/v1/ask` and `run_eval.py` all
  work unchanged under the switch.
- Dataset audited independently of the generator: 0 invalid citation numbers,
  0 citations opening a sentence, 0 traps that fail `is_refusal()`, 0 rows with
  a stale system prompt, 0 question overlap between train and val, all 12
  documents represented.
- Both eval runs stored in `eval_runs` — visible on the Evaluation page.
- `retrieval_hit` came back **1.000 on both runs**, confirming the switch
  changed the answering model and nothing else.

## War stories

**The first 6 generated rows looked fine until they were read.** One had
`[1] **45 days**` and `[1] Receipts are required` — citations placed *before*
the claim, and one opening a sentence. Training on that teaches the placement,
not the fact. Fixed with a worked good/bad example in the teacher prompt plus a
hard regex gate. Over the full run that gate rejected 6 rows, the duplicate
gate 168, and the trap double-check 6 more.

**The generator ingested its own README.** `sources/README.md` became 10
passages of instructions-as-training-data. Now skipped by name.

**Drive quota blew mid-export.** `save_pretrained_gguf` writes a ~6GB merged
model and a ~6GB F16 before the 2GB Q4 — 14GB against a 15GB free Drive. Fixed
by exporting to Colab's local disk and downloading only the Q4.

**C: had 0.1GB free.** Moving Ollama would have recovered 2.7GB with real
breakage risk; clearing `npm cache` + `pip cache` recovered 23.5GB with none.
Model store redirected to `D:\ollama\models` via `OLLAMA_MODELS`.

**A BOM broke the test suite.** Rewriting `.env` with PowerShell 5.1's
`-Encoding utf8` prepends a BOM, which turned the first key into
`\ufeffANTHROPIC_API_KEY` and blanked the real one. 10 tests failed within
minutes; stripped at the byte level, back to 154.

**The relevance gap wasn't what it looked like.** On q10 both models stated the
same fact with the same citation, yet ours scored 0.0 and Claude's 1.0.
Re-running the judge on the *unchanged* text returned 7× 0.0 and 1× 1.0.
`evaluation.relevance()` is one haiku call at default temperature with no
repeats, so a single borderline answer swings the aggregate by 0.045 — two
thirds of the whole gap. The genuine remainder is that the 3B answers the
question and stops, where Claude volunteers the adjacent caveat.

## Known limits

- **Only 2 of 22 golden questions are refusal traps**, so "2/2 vs 2/2" moves 50
  points on one question. It deserves ~6 more traps, which would re-base the
  0.977 faithfulness figure quoted in `PHASE_9_COMPLETE.md` and require
  re-running both models.
- **`evaluation.relevance()` should be sampled more than once**, or run at
  temperature 0. Documented above; not yet fixed.
- **The latency comparison is not like-for-like.** Claude's 18.5s is the agent
  path (tool calls + reflection critic); ours is a single CPU generation.

## Cost

| | |
|---|---:|
| Dataset generation (1,355 Haiku calls) | $1.57 |
| Eval judges, both runs | a few cents |
| Colab T4 (33 min training + export) | free |
| Ollama serving | free |

## Where things live

```
training/
├── README.md              the pipeline, explained
├── generate_data.py       Step 1 · distillation + quality gates
├── finetune_colab.ipynb   Steps 2-3 · QLoRA on a free T4, then GGUF
├── make_modelfile.py      Step 3 · Modelfile from the live prompt
├── compare_eval.py        Step 5 · the comparison document
├── sources/               source documents (gitignored)
└── data/train.jsonl       the dataset

backend/app/services/grounded.py   Step 4 · the local answer path
backend/app/services/ask.py        the provider switch (one if)
backend/tests/test_grounded.py     9 tests on the event contract

docs/FINETUNE_CONTEXT.md   why we did this
docs/FINETUNE_PLAN.md      the 5-step plan, in easy English
docs/FINETUNE_RESULTS.md   the scores + the judge investigation
```

## Running it

```bash
# demo the local model
LLM_PROVIDER=local          # in the repo-root .env
ollama serve                # OLLAMA_MODELS=D:\ollama\models
python -m uvicorn app.main:app --port 8000

# reproduce the comparison
LLM_PROVIDER=anthropic  python eval/run_eval.py --notes "baseline: claude"
LLM_PROVIDER=local      python eval/run_eval.py --notes "brainstack-3b"
python training/compare_eval.py
```
