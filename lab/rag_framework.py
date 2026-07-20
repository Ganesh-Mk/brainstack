"""rag_framework.py — the same pipeline, now with the industrial tools.

Only two pieces change from rag_lab.py:

    hand-written split()   ->  LangChain RecursiveCharacterTextSplitter
    JSON file + cosine_top_k  ->  Pinecone index + namespace

Everything else — extraction, the embedding model, the prompt, the answer —
is identical. Run this AFTER rag_lab.py and after the experiments, so the
comparison lands: you already know what these two things do, because you
wrote them.

Run:  lab/.venv/Scripts/python rag_framework.py
"""

from __future__ import annotations

import os
import time

from langchain_text_splitters import RecursiveCharacterTextSplitter

import rag_lab as R

NAMESPACE = "_lab"  # deliberately separate from any real tenant namespace
INDEX_NAME = os.getenv("PINECONE_INDEX", "brainstack")


# ─────────────────────────────────────────────────────────────────────────────
# Swap 1 — the splitter
# ─────────────────────────────────────────────────────────────────────────────


def split_with_langchain(
    pages: list[tuple[int, str]],
    size: int = R.CHUNK_SIZE,
    overlap: int = R.CHUNK_OVERLAP,
) -> list[R.Chunk]:
    """Same inputs, same outputs, smarter cuts.

    Our split() cuts blindly every N characters. RecursiveCharacterTextSplitter
    tries a list of separators in order — paragraph, then line, then sentence,
    then word — and only falls back to a hard character cut if nothing else
    fits. So chunks tend to begin and end at meaningful places.
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=size,
        chunk_overlap=overlap,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    chunks: list[R.Chunk] = []
    for page_no, text in pages:
        for i, piece in enumerate(splitter.split_text(" ".join(text.split()))):
            chunks.append(R.Chunk(id=f"lc-p{page_no}-{i}", text=piece, page=page_no))
    return chunks


def compare_boundaries() -> None:
    print("=" * 74)
    print("Splitter comparison — where do the cuts land?")
    print("=" * 74)
    pages = R.extract_pdf(R.PDF_PATH)
    mine = R.split(pages)
    theirs = split_with_langchain(pages)

    print(f"\n  hand-written      : {len(mine)} chunks")
    print(f"  RecursiveCharacter: {len(theirs)} chunks\n")

    def starts_mid_word(chunks: list[R.Chunk]) -> int:
        # A chunk that starts lowercase mid-word is a blind cut.
        return sum(
            1
            for c in chunks
            if c.text and c.text[0].islower() and not c.text.startswith(" ")
        )

    print(f"  chunks starting mid-word — hand-written : {starts_mid_word(mine)}")
    print(f"  chunks starting mid-word — LangChain    : {starts_mid_word(theirs)}")
    print("\n  First three cuts, side by side:\n")
    for i in range(3):
        print(f"   [{i}] ours : …{mine[i].text[:70]}…")
        print(f"       lc   : …{theirs[i].text[:70]}…")
    print(
        "\n  Lesson: same concept, better boundaries. Nothing conceptual is\n"
        "  hidden in the library — it is the chunker you wrote, plus a\n"
        "  preference for splitting where humans would."
    )


# ─────────────────────────────────────────────────────────────────────────────
# Swap 2 — the vector store
# ─────────────────────────────────────────────────────────────────────────────


def pinecone_index():
    from pinecone import Pinecone

    key = os.getenv("PINECONE_API_KEY")
    if not key:
        raise RuntimeError("PINECONE_API_KEY missing from the root .env")
    return Pinecone(api_key=key).Index(INDEX_NAME)


def upsert_to_pinecone(chunks: list[R.Chunk]) -> None:
    index = pinecone_index()
    vectors = [
        {
            "id": c.id,
            "values": c.vector,
            "metadata": {"page": c.page, "text": c.text[:900]},
        }
        for c in chunks
    ]
    for i in range(0, len(vectors), 100):
        index.upsert(vectors=vectors[i : i + 100], namespace=NAMESPACE)
    print(f"  upserted {len(vectors)} vectors into namespace '{NAMESPACE}'")


def query_pinecone(question: str, k: int = R.TOP_K) -> list[tuple[float, str]]:
    index = pinecone_index()
    qv = R.embed([question])[0].tolist()
    res = index.query(
        vector=qv, top_k=k, namespace=NAMESPACE, include_metadata=True
    )
    return [(m["score"], m["id"]) for m in res.get("matches", [])]


def main() -> None:
    compare_boundaries()

    print("\n" + "=" * 74)
    print("Vector store comparison — JSON file vs Pinecone")
    print("=" * 74 + "\n")

    chunks = R.build_store()  # our own chunker + embeddings
    print(f"  built {len(chunks)} chunks locally")
    upsert_to_pinecone(chunks)
    print("  waiting for the index to catch up…")
    time.sleep(6)

    question = "Can a client send work back and get their money back?"
    qv = R.embed([question])[0]
    local = [(s, c.id) for s, c in R.cosine_top_k(qv, chunks, k=R.TOP_K)]
    remote = query_pinecone(question, k=R.TOP_K)

    print(f"\n  Q: {question}\n")
    print(f"  {'rank':>4}  {'hand-rolled cosine':<34} {'Pinecone':<34}")
    for i in range(max(len(local), len(remote))):
        left = f"{local[i][0]:.4f} {local[i][1]}" if i < len(local) else ""
        right = f"{remote[i][0]:.4f} {remote[i][1]}" if i < len(remote) else ""
        print(f"  {i + 1:>4}  {left:<34} {right:<34}")

    same = [a for _, a in local] == [b for _, b in remote]
    print(
        f"\n  Same top-{R.TOP_K}, same order: {'YES' if same else 'NO'}\n"
        "  This is the point of the whole phase: Pinecone is the cosine_top_k\n"
        "  you hand-wrote, running at scale behind a namespace. Nothing about\n"
        "  the idea changed — only the engineering around it."
    )


if __name__ == "__main__":
    main()
