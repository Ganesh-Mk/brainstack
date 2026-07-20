# RAG lab — what actually happened

Real output from real runs against `data/handbook.pdf` (a 4-page, ~7,800-character
fictional employee handbook). Reproduce any of it with
`lab/.venv/Scripts/python experiments.py <n>`.

Setup: `all-MiniLM-L6-v2` embeddings (384 dimensions, local, free), hand-written
character chunker, hand-written cosine similarity.

---

## 6.1 — Semantic search is not keyword search

Cosine similarity between short phrases:

```
  +0.5038  'refund'            <-> 'return policy'
  +0.6739  'refund'            <-> 'money back'
  -0.0052  'refund'            <-> 'the cat sat on the mat'
  +0.4018  'annual leave'      <-> 'paid time off'
  -0.0001  'annual leave'      <-> 'the cat sat on the mat'
  +0.4942  'laptop encryption' <-> 'device security'
```

**`refund` ↔ `return policy` scores 0.50 with zero words in common.** Keyword
search scores that pair at 0. Meanwhile an unrelated sentence scores ~0.000 —
not a small number, essentially *nothing*.

That gap is the entire reason this technique exists. The handbook deliberately
never uses the word "refund" (its section is titled "Returns"), so every
successful retrieval below is happening on meaning alone.

**Surprise:** the "unrelated" scores came out at −0.005 and −0.0001, i.e. dead
zero rather than merely low. Two random English sentences are close to
orthogonal in this space — there's far less background similarity than expected.

---

## 6.2 — Chunk size is a real dial, and it has a peak

8 evaluation questions, each with a string that must appear in a retrieved
chunk. `hit@1` = the single top-scoring chunk contains the answer.

```
    size  overlap  chunks   hit@1   hit@3
     150       30      66    5/8     8/8
     300       60      33    5/8     8/8
     400       80      26    8/8     8/8   <- best
     800      100      13    7/8     8/8
    1500      200       7    6/8     8/8
    3000      300       4    4/8     8/8
```

A clean inverted U: **5/8 → 8/8 → 4/8**. Both extremes lose, for different
reasons:

- **Too small** — the vector is precise but the retrieved window is too narrow
  to contain the surrounding context that makes the answer usable.
- **Too large** — one vector must represent many unrelated topics at once, so
  it represents none of them strongly. At 3,000 characters the whole handbook
  is 4 chunks and retrieval is barely better than a coin flip.

**Surprise:** `hit@3` is 8/8 at *every* size, which looks like "chunk size
doesn't matter" until you notice that at size 3000 the top-3 is 3 of 4 chunks —
i.e. almost the entire document. A generous k hides bad retrieval. That is a
lesson about **metrics**, not about chunking: measure at k=1 on small corpora.

---

## 6.3 — Overlap protects against arithmetic, not semantics

Tested the mechanism directly: for each chunk size, is the target sentence
still *intact* inside at least one chunk? A sentence split across two chunks
can never be retrieved whole, regardless of how good the model or query is.

Target phrase: `"reported to the studio director on the same day"`, from a
deliberately long sentence in the Security section. Sizes 120→520 in steps of 20:

```
  overlap= 0   sentence intact at 18/21 chunk sizes
               split apart at sizes: 180, 260, 520
  overlap=60   sentence intact at 21/21 chunk sizes
```

With no overlap, whether a fact survives is decided by **where the character
count happens to land** — pure arithmetic, nothing to do with the content. Three
of twenty-one otherwise-reasonable settings silently destroy this fact.

Overlap repeats each chunk's tail at the head of the next, so a straddled fact
is whole *somewhere*. It costs duplicated text and buys immunity to luck.

---

## 6.4 / 6.5 — Hallucination and grounding

**Not yet run — the Anthropic account has no credit.** The retrieval half of
every experiment is local and free; only the final answer step calls the API.
Add a few dollars at console.anthropic.com → Plans & Billing and re-run:

```
lab/.venv/Scripts/python experiments.py 4 5
```

What to expect: the handbook has **no parental leave section**. Experiment 4
asks about it with no grounding rule and should produce a confident, fluent,
completely invented answer. Experiment 5 asks the identical question with one
sentence added to the prompt —

> *"Answer using ONLY the context below. If the answer is not in the context,
> say you don't know and do not guess."*

— and should refuse. That single instruction is the difference between a demo
and something a company can trust. Record both answers here when you run it.

---

## 6.6 — The query decides what you retrieve

The handbook has two money-related topics: client **returns** and employee
expense **reimbursement**. Both sit close to the word "refund" in embedding
space, so phrasing changes what comes back:

```
  [vague]    "What is the refund policy?"
      best client-returns score  : 0.359
      top-3 topics               : [client-returns, client-returns, employee-expenses]
      wrong-topic chunks in top-3: 1

  [specific] "Can a client send work back and get their money back?"
      best client-returns score  : 0.500
      top-3 topics               : [client-returns, client-returns, other]
      wrong-topic chunks in top-3: 0
```

Same document, same index, same model — only the question changed. The vague
query scores the correct passage **39% lower** and drags a competing topic into
the context window.

**Surprise:** I expected the vague query to fail outright and retrieve the wrong
section at rank 1. It didn't — it still found the right passage first, just with
much less confidence and worse company. The honest lesson is softer than
"ambiguity breaks retrieval" but more useful: *the retrieved context is the
ceiling on the answer quality*, and a vague question lowers that ceiling
quietly rather than loudly.

This is why later phases invest in query rewriting, hybrid search, re-ranking,
and evaluation — all of them are attempts to raise that ceiling.

---

## The frameworks, at the end

### LangChain's splitter vs the hand-written one

Same document, same target size (400/80) — both produced **26 chunks**:

```
  chunks starting mid-word — hand-written : 18
  chunks starting mid-word — LangChain    :  1
```

Our chunker cuts blindly every N characters. `RecursiveCharacterTextSplitter`
tries separators in order (paragraph → line → sentence → word) and only cuts
mid-word as a last resort. Same concept, better boundaries — and nothing
conceptually hidden inside it.

### Pinecone vs the hand-written cosine

Identical embeddings pushed to both. Same 5 questions:

```
question                                                  agree  max score delta
----------------------------------------------------------------------------------
Can a client send work back and get their money back?       YES         0.000450
How many days of annual leave do I get?                     YES         0.000000
What are the core working hours?                            YES         0.000000
How fast is a blocking issue acknowledged?                  YES         0.000000
What happens if my laptop is stolen?                        YES         0.000450
```

**Every question: identical top-5, identical order.** The largest score
difference anywhere was 0.00045 — float32 rounding, not a difference in method.

Side by side on one query:

```
  rank  hand-rolled cosine        Pinecone
     1  0.5001 p1-c640            0.4999 p1-c640
     2  0.4131 p1-c320            0.4126 p1-c320
     3  0.3769 p4-c320            0.3766 p4-c320
```

This is the point of doing it raw first. **Pinecone is the `cosine_top_k` in
`rag_lab.py`, running at scale behind a namespace.** It adds an index (so it
doesn't compare against every vector), a namespace (so one tenant can't see
another's — that's the multi-tenancy boundary from Backend Phase 0), and
durability. It does not add an idea.

---

## Things worth remembering

1. **A vector database is a list plus an index.** The search itself is one line
   of arithmetic. Six lines total, including the sort.
2. **The embedding model never sees your question and your document together.**
   Each is embedded independently, then compared. That's why it scales: the
   documents are embedded once, forever.
3. **Retrieval is the bottleneck.** The model can only be as right as the
   passages it was handed. Every quality problem in a RAG system should be
   diagnosed at the retrieval step *first*.
4. **Grounding is a prompt instruction, not an architecture.** One sentence
   turns confident invention into "I don't know."
5. **Measure at k=1.** A generous k flatters bad retrieval, especially on small
   corpora.
6. **Page numbers must be carried from extraction onward.** They cost nothing
   at the start and are impossible to reconstruct later — they become the
   clickable citations in the product.
