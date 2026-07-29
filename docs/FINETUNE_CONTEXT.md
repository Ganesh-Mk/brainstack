# 🎯 Project: Fine-tune our own LLM for BrainStack

> Context document. Read this fully before doing anything.
> Written in easy English on purpose — keep all output the same way.

---

## 1. Who and why

I'm Ganesh, the builder of BrainStack (this repo). I'm interviewing at **Unlox**
(an edtech company) for an AI/ML Engineer role. I cleared Round 1. The interviewer
said: *"we want someone who knows how to train a model — we'll have our own LLM."*

So the goal: **actually fine-tune a small LLM and plug it into BrainStack** — my
live production RAG platform. Then in Round 2 I can say:

> "I trained my own model, plugged it into my live product behind a switch,
> and compared it against Claude with my own eval scores."

This is BOTH real learning AND interview ammo. It should later grow into a real
BrainStack feature (a new phase in the docs).

---

## 2. What BrainStack is (30 seconds)

Multi-tenant B2B SaaS: companies upload documents, employees chat with an AI that
answers ONLY from those documents, with citations. Stack: FastAPI backend
(`backend/`), Next.js frontend (`frontend/`), Supabase Postgres, Pinecone,
Upstash Redis. LLM = Claude (`claude-haiku-4-5`) called via `settings.LLM_MODEL_*`
in `backend/app/config.py`. Read `docs/README.md` and `docs/PROJECT_GUIDE.md`
for the full picture.

The LLM touchpoints in the backend:
- `app/services/ask.py` — grounded Q&A (RAG answer with citations) ← **our target**
- `app/services/agent.py` — the LangGraph agent (tools, web search) ← Claude keeps this
- `app/services/memory.py` — extracts facts from chats ← maybe later
- `app/services/evaluation.py` — the eval harness (22 golden questions, LLM judge,
  0.977 faithfulness score) ← **we use this to PROVE our model works**

---

## 3. The decisions already made (don't re-open these)

1. **What we fine-tune the model to do:** grounded answering — the skill of
   *"read the given numbered context blocks → answer only from them with [n]
   citations → refuse politely if the answer isn't in the context."*
   ⚠️ We do NOT teach the model any tenant's documents. Documents come from RAG
   at question time. Baking documents into weights would break multi-tenant
   isolation. We train the BEHAVIOR, not the knowledge.

2. **Training data = distillation** (the big model teaches the small one).
   Why: the production DB has only ~11 real query traces — way too small.
   So: a script feeds context chunks (our 93 real chunks + public documents for
   volume) to Claude Haiku → Claude writes ideal cited answers → that becomes
   ~1,000–2,000 training pairs. About **15% must be refusal traps** (context
   doesn't contain the answer → the correct output is a polite refusal).
   The pairs must use the SAME prompt format that `ask.py` really uses.

3. **Base model: a 3B model** — Llama 3.2 3B or Qwen 2.5 3B (pick one and say why).
   Why 3B: my laptop has NO GPU (Intel graphics, 7.7GB RAM), so the final model
   must run on CPU via **Ollama** (quantized 4-bit ≈ 2GB). Also trains fast.

4. **Training happens on free Google Colab** — Unsloth + QLoRA on the free T4 GPU.
   Zero cost. 1–2 epochs.

5. **Serving for the demo = Ollama on my laptop** (not installed yet — one of the
   steps). Production stays on Claude: the Render backend is a 512MB free
   instance and can never host an LLM (a reranker alone OOM-killed it once).

6. **Integration = a provider switch**, e.g. `LLM_PROVIDER=anthropic|local` +
   an Ollama base URL in `config.py`. When `local`, the **Ask path** uses my
   fine-tuned model (Ollama exposes an OpenAI-compatible API). The agent path
   stays on Claude. Nothing else in the services should need to change.

7. **Proof = the existing eval harness.** Run the 22 golden questions against
   BOTH Claude and my model. Compare faithfulness / citations / refusal-on-traps
   side by side. The comparison numbers ARE the deliverable.

8. **Where code lives:** a new `training/` folder in this repo — data generation
   script, the Colab notebook, README explaining the pipeline. It should look
   like a proper part of the project someone can walk through.

---

## 4. The 5 steps (the shape of the work)

```
1. DATA      → script generates ~1–2k (context → cited answer) pairs
               with Claude Haiku, incl. ~15% refusal traps,
               in ask.py's exact prompt format
2. TRAIN     → Colab free T4: Unsloth + QLoRA on the 3B base model
3. EXPORT    → GGUF 4-bit → install Ollama → run it on this laptop
4. INTEGRATE → LLM_PROVIDER switch in config; Ask path can use the local model
5. PROVE     → eval harness: Claude vs my model, side-by-side scores
```

Priority: a working end-to-end demo FIRST (interview is soon). Polish after.

---

## 5. Rules

- **Explain everything in easy English** — short sentences, simple words,
  step-flow diagrams like the box above. I'm learning fine-tuning for the first
  time; every plan/doc you write must teach me, not just instruct the code.
- **Don't touch production behavior** — Claude stays the default everywhere.
  The local model only activates behind the flag. All existing tests keep passing.
- **Don't spend money** — free Colab, free Ollama, only small Claude Haiku calls
  for data generation (cents).
- **First: write a proper step-by-step PLAN** (easy English, with what each step
  produces and roughly how long it takes). Show me the plan.
- **Do NOT start implementing until I say "go ahead."**
