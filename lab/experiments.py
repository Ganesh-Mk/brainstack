"""experiments.py — the six experiments that make RAG click.

Each one prints real numbers. Run the whole set:

    lab/.venv/Scripts/python experiments.py

or one at a time:

    lab/.venv/Scripts/python experiments.py 1

Experiments 1-3 and 6a are pure retrieval: local, free, no API key needed.
Experiments 4, 5 and 6b call Claude and need credit on the Anthropic account;
they degrade to a clear message instead of crashing if there is none.
"""

from __future__ import annotations

import sys

import numpy as np

import rag_lab as R

# An evaluation set: question -> a string that MUST appear in a retrieved
# chunk for the retrieval to be considered correct. This turns "does retrieval
# feel right?" into a number we can compare across settings.
EVAL: list[tuple[str, str]] = [
    ("How many days of annual leave do I get?", "25 days"),
    ("What are the core working hours?", "11:00 to 16:00"),
    ("How fast is a blocking issue acknowledged?", "within 2 hours"),
    ("Can a client send work back and get their money back?", "30 days"),
    ("When is payday?", "last working day"),
    ("Do I need two-factor authentication?", "Two-factor"),
    ("What happens if my laptop is stolen?", "same day"),
    ("How long before I can take a sabbatical?", "four years"),
]


def hit_rate(chunks: list[R.Chunk], k: int = 3) -> tuple[int, int]:
    """How many eval questions retrieve a chunk containing the answer, in top-k."""
    hits = 0
    for question, needle in EVAL:
        qv = R.embed([question])[0]
        top = R.cosine_top_k(qv, chunks, k=k)
        if any(needle.lower() in c.text.lower() for _, c in top):
            hits += 1
    return hits, len(EVAL)


def header(n: str, title: str) -> None:
    print(f"\n{'=' * 74}\n{n}  {title}\n{'=' * 74}")


# ─────────────────────────────────────────────────────────────────────────────


def exp1_semantic_search() -> None:
    header("6.1", "Does semantic search actually work?")
    print(
        "Cosine similarity between short phrases. Watch 'refund' score high\n"
        "against 'return policy' — they share NO words — and near-zero against\n"
        "an unrelated sentence. This is the moment embeddings stop being magic.\n"
    )
    pairs = [
        ("refund", "return policy"),
        ("refund", "money back"),
        ("refund", "the cat sat on the mat"),
        ("annual leave", "paid time off"),
        ("annual leave", "the cat sat on the mat"),
        ("laptop encryption", "device security"),
    ]
    texts = sorted({t for pair in pairs for t in pair})
    vecs = dict(zip(texts, R.embed(texts)))
    for a, b in pairs:
        score = R.cosine_similarity(vecs[a], vecs[b])
        bar = "#" * int(max(score, 0) * 40)
        print(f"  {score:+.4f} |{bar:<40}| {a!r} <-> {b!r}")
    print(
        "\n  Lesson: similarity is computed over MEANING, not characters.\n"
        "  Keyword search scores 'refund' vs 'return policy' at zero overlap."
    )


def exp2_chunk_size() -> None:
    header("6.2", "Chunk size changes everything")
    print(
        "Same document, same 8 questions, different chunk widths.\n"
        "hit@1 = the single best-scoring chunk contains the answer.\n"
        "hit@3 is reported too, but note the chunk count: 'answer in the top 3\n"
        "of only 4 chunks' means almost the whole document, which is why hit@1\n"
        "is the honest metric on a corpus this size.\n"
    )
    print(f"  {'size':>6} {'overlap':>8} {'chunks':>7} {'hit@1':>7} {'hit@3':>7}")
    results = []
    for size, overlap in [(150, 30), (300, 60), (400, 80), (800, 100), (1500, 200), (3000, 300)]:
        chunks = R.build_store(size=size, overlap=overlap)
        h1, total = hit_rate(chunks, k=1)
        h3, _ = hit_rate(chunks, k=3)
        results.append((size, h1, total, len(chunks)))
        print(f"  {size:>6} {overlap:>8} {len(chunks):>7} {h1:>4}/{total} {h3:>4}/{total}")
    best = max(results, key=lambda r: r[1])
    print(
        f"\n  Best hit@1 here: size={best[0]} ({best[1]}/{best[2]} with {best[3]} chunks).\n"
        "  Small chunks -> precise vectors, but the retrieved snippet can be too\n"
        "  narrow to answer from. Large chunks -> one vector has to stand for\n"
        "  many unrelated topics, so it stands for none of them strongly.\n"
        "  That dilution, not storage cost, is why chunk size matters."
    )


def exp3_overlap() -> None:
    header("6.3", "Why overlap exists")
    print(
        "Overlap is about one thing: a fact that lands ON a chunk boundary.\n"
        "Rather than guess, test the mechanism directly — for each chunk size,\n"
        "is the target sentence still INTACT inside at least one chunk?\n"
        "A split sentence can never be retrieved whole, no matter how good the\n"
        "embedding model or the query is.\n"
    )
    # A phrase from the deliberately-long laptop sentence in the handbook.
    phrase = "reported to the studio director on the same day"
    sizes = list(range(120, 521, 20))

    for overlap in (0, 60):
        intact = []
        for size in sizes:
            chunks = R.build_store(size=size, overlap=overlap)
            ok = any(phrase in c.text for c in chunks)
            intact.append((size, ok))
        n_ok = sum(1 for _, ok in intact if ok)
        broken = [str(s) for s, ok in intact if not ok]
        print(f"  overlap={overlap:>3}  sentence intact at {n_ok}/{len(sizes)} chunk sizes")
        if broken:
            print(f"              split apart at sizes: {', '.join(broken)}")
    print(
        "\n  Lesson: with no overlap, whether a fact survives is decided by\n"
        "  arithmetic — where the character count happens to land. Overlap\n"
        "  repeats each chunk's tail at the head of the next, so a straddled\n"
        "  fact is whole in at least one chunk. It costs duplicated text and\n"
        "  buys immunity to luck."
    )


def exp4_hallucination() -> None:
    header("6.4", "Watch it hallucinate")
    print(
        "The handbook has NO parental leave section. Ask anyway, with no\n"
        "grounding rule, and see what a fluent, confident, invented answer\n"
        "looks like. This is the failure mode the whole product must prevent.\n"
    )
    chunks = R.build_store()
    try:
        R.answer(
            "What is the parental leave policy? How many weeks do I get?",
            chunks,
            grounded=False,
        )
    except R.ClaudeUnavailable as e:
        print(f"  [needs Anthropic credit] {e}")


def exp5_grounding() -> None:
    header("6.5", "Grounding: the one-line fix")
    print(
        "The same absent question, with one sentence added to the prompt:\n"
        f"    {R.GROUNDED_RULE!r}\n"
        "That single instruction is the difference between a toy and a product.\n"
    )
    chunks = R.build_store()
    try:
        R.answer(
            "What is the parental leave policy? How many weeks do I get?",
            chunks,
            grounded=True,
        )
    except R.ClaudeUnavailable as e:
        print(f"  [needs Anthropic credit] {e}")


def _topic(text: str) -> str:
    """Crude topic tag for the two money-related sections of the handbook."""
    t = text.lower()
    if "send back" in t or "studio credit" in t or "money back" in t:
        return "client-returns"
    if "expense" in t or "reimburs" in t or "receipt" in t or "claim over" in t:
        return "employee-expenses"
    return "other"


def exp6_retrieval_bottleneck() -> None:
    header("6.6", "The query decides what you retrieve")
    print(
        "This handbook has two money-back topics: client RETURNS and employee\n"
        "expense REIMBURSEMENT. Both are semantically close to the word\n"
        "'refund', so how the question is phrased changes what comes back.\n"
        "Compare a vague query with a specific one — same document, same index.\n"
    )
    chunks = R.build_store()
    queries = [
        ("vague   ", "What is the refund policy?"),
        ("specific", "Can a client send work back and get their money back?"),
    ]
    for label, question in queries:
        qv = R.embed([question])[0]
        top = R.cosine_top_k(qv, chunks, k=3)
        topics = [_topic(c.text) for _, c in top]
        best_correct = next(
            (s for s, c in top if _topic(c.text) == "client-returns"), None
        )
        print(f"  [{label}] {question}")
        print(f"      best client-returns score : "
              f"{best_correct:.3f}" if best_correct else "      not retrieved")
        print(f"      top-3 topics              : {topics}")
        print(f"      wrong-topic chunks in top-3: "
              f"{sum(1 for t in topics if t == 'employee-expenses')}")
        print()
    print(
        "  Lesson: the retrieved context is the ceiling on the answer. A vague\n"
        "  query scores the right passage lower and drags a competing topic\n"
        "  into the context window; the model then has to answer from a mix.\n"
        "  The fix is a better question, a better chunk, or a re-ranker — not a\n"
        "  better model. That is why the next phases invest in query rewriting,\n"
        "  hybrid search, re-ranking, and evaluation."
    )


EXPERIMENTS = {
    "1": exp1_semantic_search,
    "2": exp2_chunk_size,
    "3": exp3_overlap,
    "4": exp4_hallucination,
    "5": exp5_grounding,
    "6": exp6_retrieval_bottleneck,
}


def main() -> None:
    which = sys.argv[1:] or list(EXPERIMENTS)
    for key in which:
        fn = EXPERIMENTS.get(key)
        if fn is None:
            print(f"unknown experiment {key!r}; choose from {list(EXPERIMENTS)}")
            continue
        fn()
    print()


if __name__ == "__main__":
    np.set_printoptions(precision=4, suppress=True)
    main()
