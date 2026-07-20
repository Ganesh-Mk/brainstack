"""Pinecone smoke test — proves the account/index/namespace mechanics work
before any AI phase needs them. No product AI here; a throwaway random vector.

Creates the `brainstack` index (serverless, cosine, dimension 384 =
all-MiniLM-L6-v2, our dev embedding model), upserts one vector into the
`_smoke` namespace, queries it back, deletes it, and prints timings.

Run:  api/.venv/Scripts/python scripts/pinecone_smoke.py
"""

import sys
import time
from pathlib import Path

# Make `app` importable when this script is run directly.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pinecone import Pinecone, ServerlessSpec

from app.config import get_settings

DIM = 384  # all-MiniLM-L6-v2
NAMESPACE = "_smoke"


def main() -> None:
    settings = get_settings()
    if not settings.PINECONE_API_KEY:
        raise SystemExit("PINECONE_API_KEY is not set in the root .env")

    pc = Pinecone(api_key=settings.PINECONE_API_KEY)
    index_name = settings.PINECONE_INDEX

    existing = {i["name"] for i in pc.list_indexes()}
    if index_name not in existing:
        print(f"Creating index '{index_name}' (cosine, dim {DIM})…")
        pc.create_index(
            name=index_name,
            dimension=DIM,
            metric="cosine",
            spec=ServerlessSpec(cloud="aws", region="us-east-1"),
        )
        while not pc.describe_index(index_name).status["ready"]:
            time.sleep(1)
        print("  index ready.")
    else:
        print(f"Index '{index_name}' already exists.")

    index = pc.Index(index_name)

    # A deterministic throwaway vector (no randomness needed; this is a wiring
    # test, not a similarity test).
    vec = [0.1] * DIM
    vec_id = "smoke-1"

    t0 = time.perf_counter()
    index.upsert(
        vectors=[{"id": vec_id, "values": vec, "metadata": {"note": "smoke"}}],
        namespace=NAMESPACE,
    )
    t_upsert = (time.perf_counter() - t0) * 1000

    # Give the serverless index a moment to index the write.
    time.sleep(2)

    t0 = time.perf_counter()
    res = index.query(
        vector=vec, top_k=1, namespace=NAMESPACE, include_metadata=True
    )
    t_query = (time.perf_counter() - t0) * 1000

    matches = res.get("matches", [])
    ok = bool(matches) and matches[0]["id"] == vec_id
    print(f"upsert: {t_upsert:.0f} ms | query: {t_query:.0f} ms")
    if matches:
        print(f"  top match: id={matches[0]['id']} score={matches[0]['score']:.4f}")

    index.delete(ids=[vec_id], namespace=NAMESPACE)
    print("  cleaned up test vector.")

    stats = index.describe_index_stats()
    print(f"index dimension={stats['dimension']} metric confirmed.")
    print("\nRESULT:", "PASS ✅" if ok else "FAIL ❌")
    if not ok:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
