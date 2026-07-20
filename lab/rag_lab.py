"""rag_lab.py — RAG with nothing hidden.

The entire retrieval mechanic behind BrainStack, written by hand:

    PDF -> text -> chunks -> vectors -> [cosine similarity] -> top-k -> Claude

No LangChain. No Pinecone. No vector database. The "database" is a JSON file
and the "search engine" is six lines of arithmetic (see cosine_similarity).
That is genuinely all a vector store does — everything else is scale.

Run it:
    lab/.venv/Scripts/python rag_lab.py
    lab/.venv/Scripts/python rag_lab.py "how many days of annual leave?"

Poke at it: change CHUNK_SIZE, change TOP_K, ask your own questions, and
watch the retrieved chunks change. That's the point of this phase.
"""

from __future__ import annotations

import json
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

import fitz  # PyMuPDF
import numpy as np
from dotenv import load_dotenv

LAB = Path(__file__).parent
ROOT = LAB.parent
load_dotenv(ROOT / ".env")

import os  # noqa: E402  (must follow load_dotenv)

PDF_PATH = LAB / "data" / "handbook.pdf"
STORE_PATH = LAB / "data" / "store.json"

# Both read from the repo-root .env so the lab and the product agree.
EMBED_MODEL = os.getenv("EMBEDDING_MODEL_DEV", "all-MiniLM-L6-v2")
LLM_MODEL = os.getenv("LLM_MODEL_DEV", "claude-haiku-4-5")

# Defaults chosen by measurement, not by folklore: experiment 6.2 sweeps these
# and 400/80 scored best on this corpus (8/8 hit@1). Re-run that experiment if
# you swap in your own document — the sweet spot moves with the material.
CHUNK_SIZE = 400  # characters — try 150 and 3000 (experiment 6.2)
CHUNK_OVERLAP = 80  # characters — try 0 (experiment 6.3)
TOP_K = 5


# ─────────────────────────────────────────────────────────────────────────────
# Step 1 — extraction
# ─────────────────────────────────────────────────────────────────────────────


@dataclass
class Chunk:
    id: str
    text: str
    page: int
    vector: list[float] | None = None


def extract_pdf(path: Path) -> list[tuple[int, str]]:
    """PDF -> [(page_number, text)]. Page numbers are kept from the very start
    because they become citations in a later phase ("answer, per page 3")."""
    doc = fitz.open(path)
    pages = [(i + 1, page.get_text()) for i, page in enumerate(doc)]
    doc.close()
    return pages


# ─────────────────────────────────────────────────────────────────────────────
# Step 2 — chunking (written by hand, on purpose)
# ─────────────────────────────────────────────────────────────────────────────


def split(
    pages: list[tuple[int, str]], size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP
) -> list[Chunk]:
    """Fixed-width sliding window over the text of each page.

    This is the naive chunker: cut every `size` characters, then step back
    `overlap` characters so the next chunk repeats the tail of the previous
    one. The overlap is why a sentence that lands on a boundary still survives
    intact somewhere. Set overlap=0 and a fact split across the seam becomes
    unfindable — that is experiment 6.3, and it is worth feeling once.

    A real splitter (LangChain's RecursiveCharacterTextSplitter, used in
    rag_framework.py) is smarter: it prefers to break on paragraph, then
    sentence, then word boundaries instead of mid-word. Same idea, better cuts.
    """
    step = size - overlap
    if step <= 0:
        raise ValueError("overlap must be smaller than size")

    chunks: list[Chunk] = []
    for page_no, text in pages:
        text = " ".join(text.split())  # normalize whitespace
        if not text:
            continue
        for start in range(0, len(text), step):
            piece = text[start : start + size]
            if not piece.strip():
                continue
            chunks.append(Chunk(id=f"p{page_no}-c{start}", text=piece, page=page_no))
            if start + size >= len(text):
                break  # don't emit tail-fragments of an already-covered span
    return chunks


# ─────────────────────────────────────────────────────────────────────────────
# Step 3 — embedding
# ─────────────────────────────────────────────────────────────────────────────

_model = None


def get_model():
    """Loaded lazily — the first call downloads ~90MB (once, then cached)."""
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer

        _model = SentenceTransformer(EMBED_MODEL)
    return _model


def embed(texts: list[str]) -> np.ndarray:
    """Text -> vectors. Each vector is 384 floats: the model's numeric opinion
    about what the text MEANS. Two texts about the same idea land near each
    other even with no words in common — that's the whole trick."""
    return np.asarray(get_model().encode(texts, show_progress_bar=False), dtype=np.float32)


# ─────────────────────────────────────────────────────────────────────────────
# Step 4 — the "vector database" (a list, saved as JSON)
# ─────────────────────────────────────────────────────────────────────────────


def build_store(size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[Chunk]:
    pages = extract_pdf(PDF_PATH)
    chunks = split(pages, size=size, overlap=overlap)
    vectors = embed([c.text for c in chunks])
    for chunk, vec in zip(chunks, vectors):
        chunk.vector = vec.tolist()
    return chunks


def save_store(chunks: list[Chunk], path: Path = STORE_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps([asdict(c) for c in chunks]), encoding="utf-8")


def load_store(path: Path = STORE_PATH) -> list[Chunk]:
    return [Chunk(**d) for d in json.loads(path.read_text(encoding="utf-8"))]


# ─────────────────────────────────────────────────────────────────────────────
# Step 5 — retrieval: the entire search engine
# ─────────────────────────────────────────────────────────────────────────────


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """The formula, written out rather than imported:

        cos(a, b) = (a · b) / (||a|| * ||b||)

    The dot product measures how much two vectors point the same way; dividing
    by the lengths removes magnitude so only DIRECTION matters. Result is -1..1
    (in practice ~0..1 for these embeddings). 1.0 = identical meaning.
    """
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


def cosine_top_k(
    query_vec: np.ndarray, chunks: list[Chunk], k: int = TOP_K
) -> list[tuple[float, Chunk]]:
    """Score every chunk, sort, take k. That's it. That's the search.

    Pinecone does exactly this — with an index so it doesn't have to compare
    against literally everything, and a namespace so one tenant's vectors are
    invisible to another. The math per comparison is the line above.
    """
    scored = [
        (cosine_similarity(query_vec, np.asarray(c.vector, dtype=np.float32)), c)
        for c in chunks
    ]
    scored.sort(key=lambda pair: pair[0], reverse=True)
    return scored[:k]


# ─────────────────────────────────────────────────────────────────────────────
# Step 6 — generation
# ─────────────────────────────────────────────────────────────────────────────

GROUNDED_RULE = (
    "Answer using ONLY the context below. If the answer is not in the context, "
    "say you don't know and do not guess."
)


def build_prompt(question: str, hits: list[tuple[float, Chunk]], grounded: bool = True) -> str:
    """Stuff retrieved chunks into the prompt. This is the 'augmented' in
    Retrieval-Augmented Generation — the model isn't recalling anything, it's
    reading what we just handed it."""
    context = "\n\n".join(f"[page {c.page}] {c.text}" for _, c in hits)
    rule = GROUNDED_RULE if grounded else "Answer the question."
    return f"{rule}\n\nContext:\n{context}\n\nQuestion: {question}"


class ClaudeUnavailable(RuntimeError):
    """Raised when the API can't be called (no credit, bad key, no network).

    The retrieval half of this lab — chunking, embeddings, cosine similarity —
    is entirely local and free. Only the final answer step needs the API, so
    every experiment separates 'retrieval evidence' from 'generation evidence'
    and still teaches its lesson when this is raised.
    """


def ask_claude(prompt: str, max_tokens: int = 500) -> str:
    import anthropic

    client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from the env
    try:
        response = client.messages.create(
            model=LLM_MODEL,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
    except anthropic.BadRequestError as e:
        if "credit balance" in str(e).lower():
            raise ClaudeUnavailable(
                "Anthropic account has no credit. Add a small amount at "
                "console.anthropic.com -> Plans & Billing, then re-run. "
                "(Retrieval above already ran — it's local and free.)"
            ) from e
        raise
    except anthropic.AuthenticationError as e:
        raise ClaudeUnavailable("ANTHROPIC_API_KEY is invalid or revoked.") from e
    except anthropic.APIConnectionError as e:
        raise ClaudeUnavailable("Can't reach the Anthropic API (network).") from e
    return "".join(b.text for b in response.content if b.type == "text")


# ─────────────────────────────────────────────────────────────────────────────
# The whole loop
# ─────────────────────────────────────────────────────────────────────────────


def answer(question: str, chunks: list[Chunk], grounded: bool = True, k: int = TOP_K) -> str:
    query_vec = embed([question])[0]
    hits = cosine_top_k(query_vec, chunks, k=k)

    print(f"\nQ: {question}")
    print(f"  retrieved top-{k} (chunks are arbitrary character windows, so a")
    print(f"  chunk usually STARTS mid-sentence in the previous section):")
    for score, chunk in hits:
        print(f"    {score:.4f} [p{chunk.page}] …{chunk.text[:100]}…")

    try:
        reply = ask_claude(build_prompt(question, hits, grounded=grounded))
    except ClaudeUnavailable as e:
        print(f"\nA: [generation skipped] {e}\n")
        return ""
    print(f"\nA: {reply}\n")
    return reply


def main() -> None:
    question = (
        " ".join(sys.argv[1:])
        if len(sys.argv) > 1
        else "What is the refund policy?"
    )

    print(f"Building store from {PDF_PATH.name} "
          f"(size={CHUNK_SIZE}, overlap={CHUNK_OVERLAP})…")
    chunks = build_store()
    save_store(chunks)
    print(f"  {len(chunks)} chunks embedded -> {STORE_PATH.name}")
    print(f"  vector dimension: {len(chunks[0].vector)}")

    answer(question, chunks)


if __name__ == "__main__":
    main()
