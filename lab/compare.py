"""compare.py — prove the hand-rolled retriever and Pinecone agree.

rag_framework.py *shows* the comparison; this *asserts* it, over several
questions, and exits non-zero if they ever disagree. It is the closing
argument of Backend Phase 1:

    the vector database is not a different idea — it is your six lines,
    indexed and namespaced.

Run:            lab/.venv/Scripts/python compare.py
Clean up after: lab/.venv/Scripts/python compare.py --clean
"""

from __future__ import annotations

import sys
import time

import rag_lab as R
import rag_framework as F

QUESTIONS = [
    "Can a client send work back and get their money back?",
    "How many days of annual leave do I get?",
    "What are the core working hours?",
    "How fast is a blocking issue acknowledged?",
    "What happens if my laptop is stolen?",
]


def clean() -> None:
    F.pinecone_index().delete(delete_all=True, namespace=F.NAMESPACE)
    print(f"deleted every vector in namespace '{F.NAMESPACE}'")


def main() -> int:
    if "--clean" in sys.argv:
        clean()
        return 0

    print("Building local store and mirroring it into Pinecone…")
    chunks = R.build_store()
    F.upsert_to_pinecone(chunks)
    time.sleep(6)  # serverless index needs a moment to become queryable

    failures = 0
    print(f"\n{'question':<56} {'agree':>6}  {'max score delta':>15}")
    print("-" * 82)
    for question in QUESTIONS:
        qv = R.embed([question])[0]
        local = R.cosine_top_k(qv, chunks, k=R.TOP_K)
        remote = F.query_pinecone(question, k=R.TOP_K)

        local_ids = [c.id for _, c in local]
        remote_ids = [rid for _, rid in remote]
        agree = local_ids == remote_ids
        delta = max(
            (abs(a - b) for (a, _), (b, _) in zip(local, remote)), default=0.0
        )
        failures += not agree
        print(f"{question[:56]:<56} {'YES' if agree else 'NO':>6}  {delta:>15.6f}")

    print("-" * 82)
    if failures:
        print(f"\n{failures}/{len(QUESTIONS)} disagreed — investigate before trusting either.")
        return 1
    print(
        f"\nAll {len(QUESTIONS)} questions: identical top-{R.TOP_K}, identical order.\n"
        "Score deltas are float noise (Pinecone stores float32 and computes\n"
        "server-side), not a difference in method.\n\n"
        "That's the phase-1 lesson, verified: retrieval is cosine similarity\n"
        "over embeddings. A vector database adds an index, a namespace, and\n"
        "durability — it does not add an idea."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
