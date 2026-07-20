# ✅ Phase 3 — COMPLETE (Backend Phase 1: RAG From Scratch)

> **Status: built, and all six experiments have now been run with real
> numbers.** Anthropic credit was added, so the two generation experiments
> completed — and one of them produced a result that contradicts the
> textbook. See §6.4 in Part B.
>
> Nothing was deployed and nothing in the product changed. This phase exists
> to make one mechanic — retrieval — genuinely understood before it gets
> wrapped in frameworks.

---

## Part A — How RAG actually works (the whole flow)

Read this once and the code in `lab/` will be obvious.

### The problem

You want to ask a question about *your company's* documents. You can't just
ask Claude — it has never seen them. You also can't paste the entire document
set into every question: too big, too slow, too expensive.

So: **find the few passages most likely to contain the answer, and paste only
those.** That's Retrieval-Augmented Generation. "Augmented" means the model
isn't recalling anything — it's reading what you just handed it.

Everything below is the machinery for "find the few passages."

### Step 1 — Extract

`PDF → plain text`, keeping the **page number** for every piece of text.

Page numbers cost nothing now and are impossible to reconstruct later. They
become the clickable citations in the product ("answered from page 3").

→ `extract_pdf()` in `lab/rag_lab.py`

### Step 2 — Chunk

`one long text → many small pieces`

Why not embed the whole document as one vector? Because a single vector has to
stand for the entire meaning. A document covering leave, expenses, and security
would produce a vector that's a blurry average of all three and strongly
matches nothing.

So we cut the text into windows of ~400 characters, each window overlapping the
previous one by ~80 characters.

**Why overlap:** the cuts are arbitrary. If a sentence lands exactly on a
boundary, it gets sliced in half and neither half is findable. Overlap repeats
the tail of each chunk at the head of the next, so a straddled fact is intact
*somewhere*. (Experiment 6.3 proves this: with no overlap, 3 of 21 chunk sizes
silently destroyed a target sentence.)

→ `split()` in `lab/rag_lab.py`

### Step 3 — Embed ⭐ the key idea

`text → a list of 384 numbers`

An embedding model converts text into coordinates in a 384-dimensional space,
positioned so that **text with similar meaning lands in similar places.**

This is the part that feels like magic and isn't. The model was trained on
enormous amounts of text; it learned that "refund" and "money back" appear in
the same kinds of contexts, so it places them near each other. It doesn't
understand them — it has learned where they belong.

The consequence: **`refund` and `return policy` score 0.50 similar despite
sharing zero words** (measured, experiment 6.1). Keyword search scores that
pair at exactly zero. That gap is why this technique exists.

We embed every chunk once, up front. That's the "index."

→ `embed()` in `lab/rag_lab.py` (model: `all-MiniLM-L6-v2`, local and free)

### Step 4 — Store

`chunks + their vectors → somewhere you can search`

In the lab this is a **JSON file**. In production it's Pinecone. Conceptually
they're the same thing: a list of `(id, text, vector)`.

### Step 5 — Retrieve ⭐ the entire search engine

When a question arrives:

1. Embed the **question** with the same model → one 384-number vector.
2. Compare it against every chunk vector.
3. Sort by similarity, take the top 5.

The comparison is **cosine similarity**:

```
cos(a, b) = (a · b) / (‖a‖ × ‖b‖)
```

The dot product measures how much two vectors point the same direction;
dividing by their lengths removes magnitude so only *direction* matters —
direction is meaning. Result: 1.0 = identical meaning, ~0 = unrelated.

**That is the whole search engine.** One line of arithmetic, six lines with the
sort. Everything a vector database adds is engineering around this line.

→ `cosine_similarity()` and `cosine_top_k()` in `lab/rag_lab.py`

### Step 6 — Generate

Build a prompt: `[grounding rule] + [the 5 retrieved chunks] + [the question]`,
send it to Claude, print the answer.

**The grounding rule is one sentence and it is load-bearing:**

> *"Answer using ONLY the context below. If the answer is not in the context,
> say you don't know and do not guess."*

The textbook reason for this rule is "otherwise the model invents an answer."
**We tested that and it turned out not to be true on a current model** — see
§6.4/6.5 in Part B. The rule still matters, but for different reasons: it makes
the refusal *short, consistent, and machine-detectable*, and it makes that
behaviour a guarantee of **your system** rather than a habit of whichever model
you happen to be calling this month.

→ `build_prompt()` and `ask_claude()` in `lab/rag_lab.py`

### The whole loop, once more

```
        ONCE, up front                        PER QUESTION
   ┌──────────────────────┐            ┌───────────────────────┐
   │ PDF                  │            │ question              │
   │  ↓ extract (+ pages) │            │  ↓ embed              │
   │ text                 │            │ query vector          │
   │  ↓ split (400/80)    │            │  ↓ cosine vs all      │
   │ chunks               │            │ top-5 chunks          │
   │  ↓ embed             │            │  ↓ stuff into prompt  │
   │ vectors → store  ────┼───────────▶│  ↓ Claude             │
   └──────────────────────┘            │ grounded answer       │
                                       └───────────────────────┘
```

### Where this goes next

Every later phase is an attack on one weak point in that diagram:

| Weakness found here | Fixed by |
|---|---|
| Chunk boundaries are dumb | Better splitters (Backend Phase 2) |
| A vague question retrieves worse | Query rewriting (Phase 3) |
| Top-5 by cosine isn't always the best 5 | Hybrid search + re-ranking (Phase 3) |
| "Is the answer actually right?" is unmeasured | Evaluation / LLM-as-judge (Phase 7) |
| One tenant must never see another's chunks | Pinecone **namespaces** — already wired to `tenant_id` from Backend Phase 0 |

---

## Part B — What was built

Everything lives in **`lab/`** (its own venv — `sentence-transformers` pulls in
PyTorch, and keeping it out of `backend/requirements.txt` keeps every Render
deploy lean). Nothing here is deployed or imported by the product.

| File | What it is |
|---|---|
| `generate_handbook.py` | Builds the test corpus: a 4-page fictional *Lovely* employee handbook, designed so the experiments prove things (see below) |
| `rag_lab.py` | ⭐ The naked pipeline — extraction, hand-written chunker, embeddings, JSON store, **hand-written cosine similarity**, prompt, Claude call |
| `experiments.py` | The six experiments, each printing real numbers |
| `rag_framework.py` | The same pipeline with LangChain's splitter + Pinecone, side by side with ours |
| `compare.py` | Asserts hand-rolled top-5 == Pinecone top-5 across 5 questions; exits non-zero on disagreement |
| `NOTES.md` | ⭐ **The results, with real output and what surprised us** |

**The corpus is engineered to make lessons visible:**
- The refunds section is titled **"Returns"** and the word *refund* never
  appears in the document — so retrieving it proves matching on *meaning*.
- There is deliberately **no parental leave section** — that's the hallucination test.
- One sentence about a stolen laptop is deliberately long — that's the chunk-boundary test.
- Two topics (client *returns*, employee *reimbursement*) sit close in meaning —
  that's the ambiguous-query test.

### Headline results (full detail in `lab/NOTES.md`)

- **Semantic search works:** `refund` ↔ `return policy` = **0.5038** with zero
  shared words; `refund` ↔ an unrelated sentence = **−0.0052** (effectively zero).
- **Chunk size has a measurable peak:** hit@1 across 8 questions went
  **5/8 → 8/8 → 4/8** for chunk sizes 150 → 400 → 3000. A clean inverted U.
- **Overlap prevents real data loss:** with `overlap=0`, the target sentence was
  destroyed at **3 of 21** chunk sizes; with `overlap=60`, **0 of 21**.
- **Query phrasing matters:** a vague query scored the correct passage **39%
  lower** than a specific one and pulled a wrong-topic chunk into the context.
- **LangChain's splitter is measurably better at the same size:** it started a
  chunk mid-word **1** time vs our **18**.
- **⭐ Pinecone == our six lines:** across all 5 test questions, **identical
  top-5 in identical order**, max score difference **0.00045** (float32 noise).

### ⚠️ §6.4 — the experiment that contradicted the textbook

The classic demo says: ask about something absent from the documents with no
grounding rule, and watch the model confidently invent an answer.

**It wouldn't.** Four escalating conditions on `claude-haiku-4-5` — the
cheapest current model, the one most likely to slip:

```
  [DECLINED]  neutral instruction + retrieved context
  [DECLINED]  helpful HR persona + retrieved context
  [DECLINED]  persona told "Never say you don't know — always give a number"
  [DECLINED]  same pressured persona, NO retrieved context at all

  invented in 0/4 conditions
```

It declined **even when explicitly instructed never to decline**, and even with
no context at all. Same result for two other absent facts. The model appears to
treat "a specific company's internal policy" as something it structurally
cannot know.

### §6.5 — so what *is* the grounding rule for?

Compare the **shape** of the refusals rather than whether they refuse:

```
  "What is the parental leave policy?"
     ungrounded : 685 chars, improvises advice ("check your contract",
                  "policies vary by country")
     grounded   :  81 chars, "I don't know. The parental leave policy is
                  not mentioned in the provided context."
```

**8× shorter and always the identical shape.** Three real reasons to keep the
rule, none of them the textbook one:

1. **Consistent** — a predictable refusal is something the UI can *detect* and
   act on ("no answer found — here's who to ask"). Free prose isn't parseable.
2. **Yours, not borrowed** — §6.4's good behaviour belongs to this model, this
   phrasing, today. It isn't contractual. The instruction moves the guarantee
   into your system.
3. **No adjacent invention** — ungrounded answers volunteer plausible
   general-world advice next to company policy. For a company assistant that's
   still a wrong answer, just a subtler one.

### A measurement lesson worth more than the experiment

The first run of §6.4 reported **"invented in 2/4"**. That was alarming — and
wrong. My decline-detector matched `"don't know"` and `"not mentioned"` but
missed `"I don't have information about…"`. The model had declined all four
times; **the classifier was broken, not the system.**

In evaluation work the measurement is at least as likely to be wrong as the
thing being measured. This is exactly why Backend Phase 7 uses LLM-as-judge
instead of substring matching.

---

## Part C — What YOU need to do

### ✅ Blocker cleared — credit added, everything ran

The two generation experiments were blocked on an empty Anthropic balance
(`BadRequestError: Your credit balance is too low`). You added credit, and both
now run — §6.4 and §6.5 above are real output. Total spend was a few dozen
Haiku calls, i.e. small fractions of a cent.

**Nothing is blocking you now.** Every experiment reproduces on demand.

### ✅ Your test checklist

Run these in order. **Everything on this list works right now** — no setup left.

**Setup (once):**
- [ ] `cd lab`
- [ ] `.venv/Scripts/python generate_handbook.py` — should print `4 pages, ~7796 characters`
- [ ] Open `lab/data/handbook.pdf` and skim it — confirm the section is called
      **"Returns"** and the word *refund* appears nowhere

**The core lesson — works now, no credit needed:**
- [ ] `.venv/Scripts/python experiments.py 1`
      → `refund` ↔ `return policy` ≈ **0.50**, `refund` ↔ cat sentence ≈ **0.00**.
      **This is the moment the concept clicks. Don't skip it.**
- [ ] `.venv/Scripts/python experiments.py 2`
      → watch hit@1 rise then fall: 5/8 → 8/8 → 4/8
- [ ] `.venv/Scripts/python experiments.py 3`
      → overlap=0 splits the sentence at 3 sizes; overlap=60 at none
- [ ] `.venv/Scripts/python experiments.py 6`
      → vague query scores 0.359, specific scores 0.500

**The pipeline end to end:**
- [ ] `.venv/Scripts/python rag_lab.py "How many days of annual leave do I get and can I carry them over?"`
      → top-5 with scores, then a correct grounded answer
      (*25 days, does not roll over* — both facts from the retrieved chunks)
- [ ] Ask **your own** question: `.venv/Scripts/python rag_lab.py "when is payday?"`
- [ ] **Break it on purpose:** open `rag_lab.py`, set `CHUNK_SIZE = 3000`, re-run,
      and watch the retrieved chunks get worse. Set it back to 400.

**The payoff — proves the frameworks add no new idea:**
- [ ] `.venv/Scripts/python rag_framework.py`
      → our splitter starts mid-word 18×, LangChain's 1×; then the two
      retrievers print side by side
- [ ] `.venv/Scripts/python compare.py`
      → **all 5 questions: identical top-5, identical order.** This is the
      "oh — it's the same thing" moment the phase is built around.

**The generation experiments (credit now added):**
- [ ] `.venv/Scripts/python experiments.py 4` — four attempts to induce
      hallucination → expect **`invented in 0/4`**. Read the four answers; note
      it refuses even when told *"never say you don't know"*
- [ ] `.venv/Scripts/python experiments.py 5` — same questions, grounded vs not
      → expect ~**685 chars → 81 chars** and an identical refusal shape
- [ ] **Form your own view:** given that the model already declines, would you
      still ship the grounding rule? (My argument is in §6.5 — disagree with it
      if you can defend the alternative.)

**The real definition of done:**
- [ ] Explain to someone else, without notes, why `refund` and `return policy`
      score 0.5 — and why that means a vector database is "a list plus an index"

### 🧹 Optional cleanup

The lab wrote 26 test vectors into the Pinecone `_lab` namespace — deliberately
separate from the per-tenant namespaces the product will use, so it pollutes
nothing. Remove them any time with:

```
.venv/Scripts/python compare.py --clean
```

---

## Definition of done (from PHASE_3.md §1)

- [x] Hand-written chunker, hand-written cosine similarity, JSON store — no
      framework used until the end
- [x] **All six experiments run with real results** (4–5 completed after credit
      was added)
- [x] Same query returns the **same top-5 in the same order** from the
      hand-rolled retriever and from Pinecone — verified across 5 questions
- [x] Full pipeline produces a correct grounded answer end to end
- [x] Results and surprises written down (`lab/NOTES.md`), including the two
      findings that contradicted the plan
- [x] Nothing deployed, no product page changed, `backend/` untouched
- [ ] **You:** work through the test checklist above
- [ ] **You:** be able to explain embeddings without notes

**Next:** `PROJECT_GUIDE.md` **Backend Phase 2 — the real ingestion pipeline**
(upload → parse → chunk → embed → store, async, per-tenant, with live
progress). That's the phase where this lab's mechanics move into the API and
the **Knowledge** pages in the product finally light up.
