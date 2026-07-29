# 🧭 Fine-tuning plan — our own LLM inside BrainStack

> The step-by-step plan for `docs/FINETUNE_CONTEXT.md`.
> Written in easy English, on purpose. Read this top to bottom once.

**Status: all five steps are built.** The code is in
[`training/`](../training/) — see [`training/README.md`](../training/README.md)
for what each piece does and how to run it. What is *not* done is the running:
that needs source documents, a Colab session and Ollama on your laptop.
Jump to [§10](#10-what-i-need-from-you) for your list.

---

## 0. The whole thing in one picture

```
        ┌──────────────────────────────────────────────────────┐
        │  STEP 1 · DATA        (my laptop, ~4 h)               │
        │  Claude Haiku writes 1,000-1,500 perfect answers      │
        │  → train.jsonl                                        │
        └───────────────────────┬──────────────────────────────┘
                                │  upload to Google Drive
                                ▼
        ┌──────────────────────────────────────────────────────┐
        │  STEP 2 · TRAIN       (free Colab T4 GPU, ~3 h)       │
        │  Qwen 2.5 3B + QLoRA learns the behaviour             │
        │  → LoRA adapter (~60 MB)                              │
        └───────────────────────┬──────────────────────────────┘
                                │
                                ▼
        ┌──────────────────────────────────────────────────────┐
        │  STEP 3 · EXPORT      (Colab + laptop, ~2.5 h)        │
        │  merge → GGUF 4-bit → Ollama on my laptop             │
        │  → `ollama run brainstack-3b` works                   │
        └───────────────────────┬──────────────────────────────┘
                                │
                                ▼
        ┌──────────────────────────────────────────────────────┐
        │  STEP 4 · INTEGRATE   (backend code, ~3 h)            │
        │  LLM_PROVIDER=anthropic | local                       │
        │  → the Ask path can run on MY model                   │
        └───────────────────────┬──────────────────────────────┘
                                │
                                ▼
        ┌──────────────────────────────────────────────────────┐
        │  STEP 5 · PROVE       (eval harness, ~2 h)            │
        │  22 golden questions × 2 models                       │
        │  → the comparison table = the deliverable             │
        └──────────────────────────────────────────────────────┘
```

**Total: about 12–15 hours of real work.** Spread it over 2–3 days.
Do not try to do it in one sitting — Step 2 and Step 3 have long waiting times.

---

## 1. First, the words you need

You will see these words everywhere. Here they are in plain English.

| Word | Easy meaning |
|---|---|
| **Base model** | A small LLM someone else already trained. We start from it. |
| **Fine-tuning** | Showing the base model many examples so it copies a style/skill. |
| **Distillation** | A big smart model (Claude) writes the examples. The small model copies them. Teacher → student. |
| **LoRA** | Instead of changing all 3 billion numbers in the model, we add a small extra layer and only train that. Much cheaper. |
| **QLoRA** | LoRA, but the base model is squeezed to 4-bit first so it fits in a small GPU. |
| **Adapter** | The small file LoRA produces (~60 MB). Useless alone — it plugs into the base model. |
| **Epoch** | One full pass over all the training examples. |
| **GGUF** | A file format for running models on a CPU. Ollama eats GGUF. |
| **Quantized / 4-bit** | Numbers stored with less precision. Model gets ~4× smaller, slightly dumber. |
| **Ollama** | An app that runs a GGUF model on your laptop and gives you an OpenAI-style API. |

**One sentence to remember:**
> We are not teaching the model *facts*. We are teaching it a *habit* —
> "read the numbered blocks, answer only from them, put [1] after each claim,
> say 'I don't know' when the blocks don't have it."

---

## 2. Two decisions — ✅ both taken

These were the only open questions. Both were resolved as recommended below and
the code is built that way.

### Decision A — the base model

The context doc says "Llama 3.2 3B or Qwen 2.5 3B (pick one and say why)".

**My pick: `Qwen/Qwen2.5-3B-Instruct`.**

Why:

| | Qwen 2.5 3B | Llama 3.2 3B |
|---|---|---|
| License | Apache 2.0 — free, no forms | Llama license, **gated on HuggingFace** |
| Download in Colab | Works right away | You must accept the license + paste an HF token first |
| Instruction following | Slightly stronger on the benchmarks | Slightly weaker |
| Unsloth support | Yes | Yes |

The gating is the practical reason. Free Colab sessions die. Every time a
session restarts you re-download. A gated model means one more thing that can
break at 11 pm. Apache 2.0 also sounds better in an interview when they ask
"could we ship this commercially?" — the answer is just "yes".

Llama 3.2 3B stays as a one-line swap if Qwen disappoints. Nothing else in the
pipeline changes.

### Decision B — where the local model plugs in

⚠️ **I found something the context doc did not know.**

The context doc says: *"the Ask path uses my fine-tuned model, the agent path
stays on Claude."* But in the code today, **there is only one path.**

`backend/app/services/chat.py:258` says it out loud:

> `# NOTE: the Phase-5 direct streaming path (stream_answer) was retired when`
> `# the agent became the only ask path`

So today: `ask.py` → runs the LangGraph agent → agent decides tools → answers.
There is no simple "context in, cited answer out" path left to swap.

This matters because **a 3B model cannot reliably do tool-calling.** Asking it
to be a drop-in agent would fail, and the failure would be about tool JSON, not
about grounded answering — which is the skill we actually trained. We would
prove nothing.

Two ways forward:

```
  OPTION 1  (recommended)  — "grounded mode"
  ─────────────────────────────────────────────────────────
  question ──► retrieve (unchanged, hybrid+rerank)
                    │
                    ▼
             build_user_prompt()   ← already exists, chat.py:233
                    │
                    ▼
             MY 3B MODEL  ──► cited answer
  Claude does the tools. My model does the reading.
  Exactly what we trained. Small, honest, provable.

  OPTION 2  — full agent swap
  ─────────────────────────────────────────────────────────
  Replace ChatAnthropic in agent.py with the local model.
  It must emit tool-call JSON, loop, reflect.
  High chance of failure for reasons unrelated to our training.
```

**I recommend Option 1.** It brings back the retired Phase-5 path as the
"local provider" path. It is also the more honest interview story: *"I picked
the sub-task my model was trained for, and measured exactly that."*

The rest of this plan assumes Option 1. Say the word if you want Option 2.

---

## 3. STEP 1 · DATA

> Make the examples. This step decides everything. A great dataset with a weak
> setup beats a great setup with a weak dataset.

### The flow

```
   ┌─────────────────────────────────────────────────┐
   │ SOURCE TEXT                                     │
   │  • our real chunks (~93, from lab/data)         │
   │  • public docs for volume (see below)           │
   └───────────────────┬─────────────────────────────┘
                       │  chunk it the SAME way ingestion does
                       │  (CHUNK_SIZE=400, OVERLAP=80)
                       ▼
   ┌─────────────────────────────────────────────────┐
   │ Pick 4-6 chunks  ──►  fake a "Context:" block    │
   │ exactly like chat.build_user_prompt()            │
   └───────────────────┬─────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        ▼                             ▼
  85% ANSWERABLE                15% REFUSAL TRAP
  Claude invents a question     the question is about
  the chunks DO answer          something NOT in the chunks
        │                             │
        ▼                             ▼
  Claude writes the ideal       correct output is the exact
  cited answer                  refusal sentence from
        │                       chat.py SYSTEM_PROMPT
        └──────────────┬──────────────┘
                       ▼
   ┌─────────────────────────────────────────────────┐
   │ train.jsonl   (~1,200 rows)                      │
   │ {"system": <chat.py SYSTEM_PROMPT>,              │
   │  "user":   "Context:\n[1] (...) ...\n\nQuestion: …",│
   │  "assistant": "…claim [2]. …claim [4]."}         │
   └─────────────────────────────────────────────────┘
```

### The single most important rule of this step

The `system` and `user` strings must be **byte-identical in shape** to what the
backend really sends at question time. We will not hand-write them. The script
will **import the real functions**:

```python
from app.services.chat import SYSTEM_PROMPT, build_user_prompt, Source
```

If the prompt format drifts even a little, the model gets confused in
production and we will not know why. Importing makes drift impossible.

### Where the text comes from

93 chunks is not enough for 1,200 varied examples. We need more text. We need
text that *looks like company documents* — policies, handbooks, procedures.

Plan: `training/sources/` with a small list of public, freely usable documents:

- our own `lab/data/handbook.pdf` (the real thing — most important)
- public HR / employee handbook PDFs from government and university sites
- open-source project docs (README, CONTRIBUTING, security policy)
- public API documentation pages

Target ~400–600 chunks total. Each chunk gets used in 2–3 different examples
with different companion chunks, which is where the 1,200 comes from.

### Quality controls the script must have

These are what make it a real engineering artifact and not a toy:

1. **Cheap validation on every row.** Reuse the eval code we already own:
   `evaluation.citation_validity()` — if the answer cites `[7]` but the context
   only has 6 blocks, drop the row. Bad rows teach bad habits.
2. **Refusal rows must actually be refusals** — check with
   `evaluation.is_refusal()`.
3. **Resumable.** Append to the file as we go, keep a `done` set. Colab is
   free; your laptop's wifi is not guaranteed. A crash at row 900 must not cost
   an hour.
4. **A `--limit` flag** so we can run 20 rows first and read them with our own
   eyes before spending money on 1,200.
5. **Distractor chunks on purpose.** Some context blocks should be irrelevant.
   Real retrieval returns junk in the top-6. The model must learn to ignore it,
   not cite it.

### 💰 Honest cost note

The context doc says "cents". The real number is higher — I want you to know
before you run it, not after.

Per example: ~2,500 input tokens + ~250 output tokens.
At `claude-haiku-4-5` prices in `config.py` ($1 / $5 per million):

```
1,200 examples ≈ 3.0M input + 0.30M output
               ≈ $3.00      + $1.50        ≈ $4.50
```

So: **roughly $3–7 total.** Still tiny, still worth it. If you want it lower,
run 800 examples (~$3) — that is enough for a LoRA on a 3B model.

### Deliverables

```
training/
├── README.md              ← explains the whole pipeline
├── generate_data.py       ← the script
├── sources/               ← the source documents
└── data/
    ├── train.jsonl        (~1,100 rows)
    └── val.jsonl          (~100 rows, held out, never trained on)
```

### Time

| Task | Time |
|---|---|
| Collect source documents | 30 min |
| Write `generate_data.py` | 1 h 30 min |
| Run with `--limit 20`, read every row by hand | 30 min |
| Full run (unattended — go do something else) | 45–90 min |
| Spot-check the output, fix, maybe re-run part | 30 min |
| **Total** | **~4 hours** (only ~2.5 h of it is you working) |

---

## 4. STEP 2 · TRAIN

> Teach the small model to copy the teacher.

### The flow

```
   train.jsonl ──upload──► Google Drive
                              │
                              ▼
                    ┌───────────────────────┐
                    │  Google Colab (free)  │
                    │  Runtime → T4 GPU     │
                    └──────────┬────────────┘
                               │
      1. pip install unsloth   │
      2. load Qwen2.5-3B-Instruct in 4-bit
      3. attach LoRA adapter (r=16, alpha=16)
      4. format rows into Qwen's chat template
      5. train 2 epochs
      6. watch the loss go down
                               │
                               ▼
                    ┌───────────────────────┐
                    │  LoRA adapter ~60 MB  │
                    │  saved to Drive       │
                    └───────────────────────┘
```

### What "training" actually looks like

You will watch one number: **loss**. It should fall, then flatten.

```
 loss
  2.0 │●
      │ ●●
  1.5 │   ●●●
      │      ●●●●
  1.0 │          ●●●●●●●●●●●●        ← flattening = it has learned
      └──────────────────────────► steps
```

If loss goes down but **validation loss goes up**, the model is memorising
instead of learning. That is called overfitting — the fix is fewer epochs.
This is exactly why we hold out `val.jsonl` in Step 1.

### Settings we will start with

| Setting | Value | Why (easy version) |
|---|---|---|
| LoRA rank `r` | 16 | How much new capacity we add. 16 is the standard starting point. |
| `lora_alpha` | 16 | How loudly the new layer speaks. Match to r. |
| Epochs | 2 | 1 is often too few, 3 usually starts memorising. |
| Batch size | 2 + grad accum 4 | T4 has 16 GB. This fits. |
| Learning rate | 2e-4 | The normal LoRA number. |
| Max seq length | 2048 | Our prompts are long (6 context blocks). Must not truncate. |

⚠️ **Watch the sequence length.** 6 chunks × 400 tokens + system prompt + answer
gets close to 2048. If rows are being cut off, the model never sees the end of
its own training answers. The notebook will print the token-length distribution
before training starts, so we catch this early.

### Free Colab realities (plan for these)

- The session dies after ~90 min idle. Do not close the tab.
- You get a T4 most times, sometimes nothing. Try again later.
- Save checkpoints to Drive, not to the Colab disk. Colab disk vanishes.

### Deliverables

- `training/finetune_colab.ipynb` — the notebook, kept in the repo
- LoRA adapter on Drive
- A screenshot of the loss curve (interview material — bring it)

### Time

| Task | Time |
|---|---|
| Write the notebook | 1 h |
| Install + load model in Colab (first time is slow) | 20 min |
| Training run, 1,100 rows × 2 epochs on a T4 | 40–70 min |
| Look at the numbers, maybe re-run once with fewer epochs | 45 min |
| **Total** | **~3 hours** |

---

## 5. STEP 3 · EXPORT

> Get the model off Colab and onto your laptop.

### The flow

```
  LoRA adapter (60 MB)  +  base model (6 GB)
              │
              ▼  merge  (in Colab — needs the RAM)
        merged model  (~6 GB, fp16)
              │
              ▼  convert + quantize to Q4_K_M
        brainstack-3b.gguf  (~2 GB)
              │
              ▼  download to laptop  (2 GB — takes a while)
              ▼
        ┌──────────────────────────────────┐
        │  Ollama  (install first)         │
        │  Modelfile → ollama create       │
        │  → ollama run brainstack-3b      │
        └──────────────────────────────────┘
```

### Why 4-bit (`Q4_K_M`)

Your laptop has **7.7 GB RAM and no GPU**. The full model is ~6 GB — it would
technically load and then fight the OS for memory. 4-bit is ~2 GB, leaves room
for the backend and your browser, and the quality loss on a task this narrow is
small.

`Q4_K_M` is the usual sweet spot: smaller than Q5, noticeably better than Q4_0.

### The Modelfile

Ollama needs a small text file that says "here is the model, and here is its
system prompt". Ours will carry `chat.py`'s `SYSTEM_PROMPT` as the default, plus
a low temperature (grounded answering should be boring and repeatable, not
creative).

### ⚠️ Expect this to be slow

CPU inference on a 3B model, no GPU: roughly **5–15 tokens per second**.
A 150-token answer takes 10–30 seconds. That is fine for a demo and for the
eval. It is not fine for production — which is exactly why production stays on
Claude, and why that is a *decision* you can defend, not a limitation you hit.

### Deliverables

- Ollama installed and working
- `brainstack-3b` model registered locally
- `training/Modelfile` in the repo
- A first manual test: paste a real context block, see a cited answer come back

### Time

| Task | Time |
|---|---|
| Merge + convert + quantize in Colab | 30–45 min |
| Download 2 GB | 10–40 min (depends on your line) |
| Install Ollama on Windows | 15 min |
| Modelfile + `ollama create` + first test | 30 min |
| **Total** | **~2.5 hours** |

---

## 6. STEP 4 · INTEGRATE

> Put the model into BrainStack, behind a switch, without breaking anything.

### The flow

```
                       ┌──────────────────────────┐
   question ──────────►│  LLM_PROVIDER = ?        │
                       └───────┬──────────┬───────┘
                               │          │
                   "anthropic" │          │ "local"
                    (DEFAULT)  │          │
                               ▼          ▼
                    ┌──────────────┐  ┌────────────────────┐
                    │ LangGraph    │  │ grounded mode      │
                    │ agent        │  │ retrieve →         │
                    │ (Claude)     │  │ build_user_prompt →│
                    │ tools, web,  │  │ Ollama 3B →        │
                    │ reflection   │  │ cited answer       │
                    └──────┬───────┘  └─────────┬──────────┘
                           │                    │
                           └────────┬───────────┘
                                    ▼
                          same SSE events out
                       (delta / sources / trace / done)
                     the frontend does not change at all
```

### The config additions

```python
# Local fine-tuned model (grounded mode)
LLM_PROVIDER: str = "anthropic"          # anthropic | local
OLLAMA_BASE_URL: str = "http://localhost:11434/v1"
LLM_MODEL_LOCAL: str = "brainstack-3b"
```

Default is `anthropic`. **Production is untouched.** Render never sees `local`.
If the env var is missing, everything behaves exactly as it does today.

### The key design rule

The new path must emit **the same SSE events in the same order** as the agent
path: `trace` → `sources` → `delta`… → `done`. If it does, then:

- the frontend needs zero changes
- **the eval runner needs zero changes** — it talks to the real API, so it will
  score the local model through the exact same pipe it scores Claude through

That last point is what makes Step 5 nearly free. It is worth the care here.

### What we will touch

| File | Change |
|---|---|
| `config.py` | 3 new settings, all with safe defaults |
| `services/grounded.py` *(new)* | the revived direct path — retrieve, prompt, stream from Ollama |
| `services/ask.py` | one `if` at the top: which path to run |
| `training/README.md` | document the switch |

`agent.py`, `chat.py`, all routers, and the frontend: **unchanged.**

### Tests

- Existing tests must all still pass with the default (`anthropic`). Non-negotiable.
- New: a test that with `LLM_PROVIDER=local` and Ollama mocked, the SSE event
  sequence is identical to the agent path's.

### Time

| Task | Time |
|---|---|
| Config + the provider switch | 30 min |
| `grounded.py` — streaming, sources, trace, token counting | 1 h 30 min |
| Make the SSE shape match exactly (this is the fiddly part) | 45 min |
| Tests, run the full suite | 45 min |
| **Total** | **~3 hours** |

---

## 7. STEP 5 · PROVE

> Numbers, side by side. This is the actual deliverable.

### The flow

```
   backend running locally
        │
        ├── LLM_PROVIDER=anthropic ──► python eval/run_eval.py
        │                              --notes "baseline: claude-haiku-4-5"
        │                                    │
        │                                    ▼
        │                         eval_runs row  #1
        │
        └── LLM_PROVIDER=local ─────► python eval/run_eval.py
                                       --notes "brainstack-3b (finetuned)"
                                             │
                                             ▼
                                  eval_runs row  #2
                                             │
                                             ▼
                            ┌────────────────────────────────┐
                            │   the comparison table         │
                            │   → docs/FINETUNE_RESULTS.md   │
                            │   → the Evaluation page shows  │
                            │     both runs already          │
                            └────────────────────────────────┘
```

The runner already stores `model` on every `EvalRun` row, so the two runs
label themselves. The Evaluation page in the app will show both without any
frontend work.

### The table we are aiming for

| Metric | Claude Haiku 4.5 | brainstack-3b | What it means |
|---|---|---|---|
| faithfulness | 0.977 | ? | did it make things up? |
| relevance | ? | ? | did it answer the question asked? |
| retrieval_hit | ? | ? | same for both — retrieval is shared |
| citation_validity | ? | ? | are the [n] real? |
| refusal on traps | ? | ? | did it say "I don't know" when it should? |
| avg latency | ~2 s | ~20 s | the honest cost of CPU |

### 🎯 What counts as success — set this expectation now

A 3B model on a CPU **will not beat Claude**. That is not the goal and it is
not a failure.

Success is:

> **Citation validity and refusal-on-traps close to Claude's, faithfulness
> within a reasonable gap, at zero API cost and full data privacy.**

That sentence is the interview answer. "My 3B model held citation validity at
0.95 vs Claude's 1.0, refused 3 of 3 traps, and costs nothing to run" is a far
stronger answer than "mine was better" — because it is *true*, and because it
shows you know what a small model is and is not for.

If the numbers come out bad, that is also useful: we look at *which* questions
failed, and that tells us what the dataset was missing. That loop —
train → measure → fix the data → retrain — **is** ML engineering. It is the
thing they are hiring for.

### Deliverables

- `docs/FINETUNE_RESULTS.md` — the table, plus per-question notes on failures
- Two rows in `eval_runs`, visible on the Evaluation page
- A short "what I would do next" section (more data? more epochs? bigger LoRA?)

### Time

| Task | Time |
|---|---|
| Baseline eval run (Claude) | 15 min |
| Local eval run (CPU is slow: ~20 s × 22 questions + judging) | 30–40 min |
| Write up the comparison honestly | 45 min |
| **Total** | **~2 hours** |

---

## 8. The whole schedule

```
  DAY 1 (~4 h)   Step 1 · DATA
                 ├── collect sources
                 ├── write generate_data.py
                 └── generate train.jsonl        ← the long unattended run

  DAY 2 (~5.5 h) Step 2 · TRAIN     (Colab, ~3 h)
                 Step 3 · EXPORT    (~2.5 h)     ← long download, be patient

  DAY 3 (~5 h)   Step 4 · INTEGRATE (~3 h)
                 Step 5 · PROVE     (~2 h)
                 └── docs/FINETUNE_RESULTS.md
```

If the interview is close, the **minimum path to a working demo** is Days 1–3
with 800 examples instead of 1,200 and 1 epoch instead of 2. That cuts about
2 hours and costs maybe 3 points of faithfulness. Polish later.

---

## 9. What could go wrong (and the fix, ready in advance)

| Risk | Sign you'll see | Fix |
|---|---|---|
| Prompts get truncated at 2048 tokens | Token histogram has a spike at the cap | Fewer chunks per example, or raise to 3072 |
| Model never refuses | Trap answers invent things | Raise refusal share 15% → 25%, retrain |
| Model cites `[9]` when only 6 blocks exist | `citation_validity` drops | We already filter these rows out at generation |
| Colab gives no GPU | "No accelerator available" | Wait a few hours, or use Kaggle's free T4 (same notebook) |
| Ollama too slow to be usable | 40+ s per answer | Drop to Q4_0, or cut `CHAT_TOP_K` to 4 for local mode |
| Laptop runs out of RAM | Backend or Ollama gets killed | Close Docker/Chrome; Ollama unloads after idle |
| Existing tests break | CI red | Default stays `anthropic` — if they break, the switch leaked. Fix before anything else. |

---

## 10. What I need from you

The code is built. These are the parts only you can do, in order.

### 🔴 Now — blocks everything downstream

**Put 8–12 source documents in `training/sources/`.**
Read [`training/sources/README.md`](../training/sources/README.md) — it lists
what kind of document works, where to get them free and legally, and how to
check them.

The handbook alone gives **25 passages**. We need **400–600, across 8+
documents**. The document *count* matters as much as the passage count: every
example mixes passages from one document with distractors from others, and with
one document there are no real distractors.

Check with:
```bash
backend/.venv/Scripts/python.exe training/generate_data.py --dry-run
```

### 🟡 Then — Step 1, and read the output

```bash
P=backend/.venv/Scripts/python.exe
$P training/generate_data.py --count 40 --limit 10    # ~$0.01
```
**Read those 10 rows yourself.** Are the questions natural? Are the `[n]`
markers after the claim they support? Are the traps really unanswerable? If the
data is wrong, everything downstream is wrong and no amount of GPU fixes it.

Then the real run (~30–45 min, ~$4.50 for 1,200 rows):
```bash
$P training/generate_data.py --count 1200
```

### 🟡 Step 2 — Colab

Upload `training/data/train.jsonl` + `val.jsonl` to Google Drive in a folder
called `brainstack`, open `training/finetune_colab.ipynb` in Colab, set
**Runtime → T4 GPU**, run top to bottom. Don't close the tab.

### 🟡 Step 3 — your laptop

1. Install [Ollama for Windows](https://ollama.com/download).
2. Download the `.gguf` from Drive into `training/`.
3. `python training/make_modelfile.py` then
   `cd training && ollama create brainstack-3b -f Modelfile`

### 🟢 Steps 4–5 — just run them

```bash
# .env: LLM_PROVIDER=anthropic
python eval/run_eval.py --notes "baseline: claude-haiku-4-5"
# .env: LLM_PROVIDER=local   (Ollama running)
python eval/run_eval.py --notes "brainstack-3b (finetuned)"
python training/compare_eval.py          # → docs/FINETUNE_RESULTS.md
```

### 🔵 One decision, whenever you like

`eval/golden.jsonl` has only **2** refusal traps out of 22 questions. That makes
refusal-on-traps — the metric a small model is most likely to fail — move in 50%
steps. Adding ~6 more traps would make it a real measurement, but it re-bases
the **0.977** faithfulness figure already quoted in `PHASE_9_COMPLETE.md`, so
both models would need re-running. Say the word and I'll add them.
