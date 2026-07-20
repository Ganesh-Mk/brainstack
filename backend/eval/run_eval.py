"""The eval runner (Phase 9) — `python eval/run_eval.py [base_url] [--notes "..."]`.

Provisions a throwaway eval tenant over the REAL API, ingests the handbook,
asks all golden questions through the real SSE agent, judges every answer
(faithfulness + relevance via haiku; retrieval hit + citation validity
deterministically), prints the table, stores an eval_runs row (the
Evaluation page's history), and cleans up after itself.

This is the guide's senior signal: change a config, run this, and say
"faithfulness went 0.82 → 0.91" instead of "feels better".
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
import uuid
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

GOLDEN = Path(__file__).parent / "golden.jsonl"
HANDBOOK = Path(__file__).resolve().parents[2] / "lab" / "data" / "handbook.pdf"


def sse_events(text: str):
    events = []
    for frame in text.strip().split("\n\n"):
        ev, data = None, ""
        for line in frame.split("\n"):
            if line.startswith("event: "):
                ev = line[7:].strip()
            elif line.startswith("data: "):
                data += line[6:]
        if ev:
            events.append((ev, json.loads(data) if data else {}))
    return events


def ask(client: httpx.Client, base: str, h: dict, convo_id: str, q: str):
    with client.stream(
        "POST", f"{base}/conversations/{convo_id}/messages", headers=h,
        json={"content": q},
    ) as r:
        body = "".join(r.iter_text())
    events = sse_events(body)
    text = []
    for e, d in events:
        if e == "delta":
            text.append(d["text"])
        elif e == "reset":
            text = []
    sources = next((d for e, d in events if e == "sources"), [])
    return "".join(text), sources, events[-1][0] == "done" if events else False


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("base_url", nargs="?", default="http://localhost:8000")
    parser.add_argument("--notes", default="")
    args = parser.parse_args()
    base = args.base_url.rstrip("/")

    from app.services import evaluation

    golden = [json.loads(l) for l in GOLDEN.read_text().splitlines() if l.strip()]
    run_tag = uuid.uuid4().hex[:8]
    client = httpx.Client(timeout=300)

    print(f"\n== eval run {run_tag} · {len(golden)} questions · {base} ==\n")

    a = client.post(f"{base}/auth/signup", json={
        "company_name": f"EvalRun {run_tag}", "name": "Eval",
        "email": f"eval+{run_tag}@test.example", "password": "password123",
    }).json()
    h = {"Authorization": f"Bearer {a['access_token']}"}
    with open(HANDBOOK, "rb") as f:
        doc = client.post(f"{base}/documents", headers=h,
                          files={"file": ("handbook.pdf", f, "application/pdf")}).json()
    for _ in range(120):
        d = client.get(f"{base}/documents/{doc['id']}", headers=h).json()
        if d["status"] in ("ready", "failed"):
            break
        time.sleep(1)
    if d["status"] != "ready":
        print("ingestion failed — aborting")
        return 1
    time.sleep(4)

    rows = []
    for item in golden:
        convo = client.post(f"{base}/conversations", headers=h).json()["id"]
        answer, sources, done = ask(client, base, h, convo, item["question"])
        if not done:
            rows.append({**item, "answer": "(stream failed)", "faithfulness": 0.0,
                         "relevance": 0.0, "retrieval_hit": False,
                         "citation_valid": False, "refused": False})
            continue

        faith, faith_why = evaluation.faithfulness(answer, sources)
        rel, rel_why = evaluation.relevance(item["question"], answer)
        refused = evaluation.is_refusal(answer)
        if item["expect_refusal"]:
            # For trap questions the REFUSAL is the correct behavior; judges
            # already treat honest refusals as 1.0, hit-rate is n/a → count
            # the refusal itself.
            hit = refused
        else:
            hit = evaluation.retrieval_hit(sources, item["expected_keywords"])
        rows.append({
            "id": item["id"], "question": item["question"],
            "answer": answer[:400], "refused": refused,
            "expect_refusal": item["expect_refusal"],
            "faithfulness": faith, "faithfulness_why": faith_why,
            "relevance": rel, "relevance_why": rel_why,
            "retrieval_hit": hit,
            "citation_valid": evaluation.citation_validity(answer, sources),
        })
        mark = "✓" if (faith >= 0.5 and rel >= 0.5 and hit) else "✗"
        print(f"  {mark} q{item['id']:>2} faith={faith:.1f} rel={rel:.1f} "
              f"hit={'y' if hit else 'N'} cite={'y' if rows[-1]['citation_valid'] else 'N'} "
              f"| {item['question'][:55]}")

    scores = {
        "faithfulness": round(statistics.mean(r["faithfulness"] for r in rows), 3),
        "relevance": round(statistics.mean(r["relevance"] for r in rows), 3),
        "retrieval_hit": round(sum(r["retrieval_hit"] for r in rows) / len(rows), 3),
        "citation_validity": round(sum(r["citation_valid"] for r in rows) / len(rows), 3),
    }
    print(f"\n  {'metric':<20}{'score':>7}")
    for k, v in scores.items():
        print(f"  {k:<20}{v:>7.3f}")

    # store the run (direct DB write — the runner is an offline tool)
    from app.config import get_settings
    from app.db import Base  # noqa: F401
    from app.models import EvalRun
    from sqlalchemy import create_engine, text as sq
    from sqlalchemy.orm import Session

    engine = create_engine(get_settings().sqlalchemy_url)
    with Session(engine) as s:
        s.add(EvalRun(
            dataset_size=len(rows), model=get_settings().LLM_MODEL_AGENT,
            notes=args.notes or None, per_question=json.dumps(rows),
            **scores,
        ))
        s.commit()

    # cleanup the eval tenant
    client.delete(f"{base}/documents/{doc['id']}", headers=h)
    tenant_id = a["tenant"]["id"]
    with engine.begin() as c:
        for stmt in (
            "delete from query_traces where tenant_id = :t",
            "delete from memories where tenant_id = :t",
            "delete from messages where tenant_id = :t",
            "delete from conversations where tenant_id = :t",
            "delete from chunks where tenant_id = :t",
            "delete from documents where tenant_id = :t",
            "delete from users where tenant_id = :t",
            "delete from tenants where id = :t",
        ):
            c.execute(sq(stmt), {"t": tenant_id})
    try:
        from app.services import vectorstore
        vectorstore.get_index().delete(delete_all=True, namespace=f"{tenant_id}-mem")
    except Exception:
        pass
    print("\n  (eval tenant cleaned up; run stored)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
