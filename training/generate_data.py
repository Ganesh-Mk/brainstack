"""Step 1 · DATA — build the fine-tuning set by distillation.

Claude Haiku (the teacher) writes ideal grounded answers over context blocks
we assemble ourselves; those pairs train a 3B model (the student) to do the
same. See docs/FINETUNE_PLAN.md §3.

The one rule this file exists to enforce:

    the training prompts are built by the SAME functions the backend uses at
    question time — `chat.SYSTEM_PROMPT` and `chat.build_user_prompt()` are
    imported, never re-typed.

If the production prompt ever changes shape, this script changes with it and
the model keeps matching. Hand-copied prompts drift silently and the model
gets worse for reasons nobody can find.

Two kinds of row:

  answerable (~85%)  context contains the answer -> cited answer
  refusal    (~15%)  context does NOT contain it -> the exact refusal
                     sentence from chat.SYSTEM_PROMPT, verbatim

Distractor passages are mixed into EVERY example on purpose: real retrieval
puts junk in the top-6, so the model must learn to leave it uncited.

Usage:
    python training/generate_data.py --limit 20        # smoke test, read these
    python training/generate_data.py --count 1200      # the real run
    python training/generate_data.py --count 1200      # again = resumes
"""

from __future__ import annotations

import argparse
import json
import random
import re
import sys
import threading
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.config import get_settings  # noqa: E402
from app.services import evaluation, extraction, ingestion  # noqa: E402
from app.services.chat import SYSTEM_PROMPT, Source, build_user_prompt  # noqa: E402

HERE = Path(__file__).parent
SOURCES_DIR = HERE / "sources"
DATA_DIR = HERE / "data"
RAW_PATH = DATA_DIR / "generated.jsonl"
TRAIN_PATH = DATA_DIR / "train.jsonl"
VAL_PATH = DATA_DIR / "val.jsonl"
HANDBOOK = ROOT / "lab" / "data" / "handbook.pdf"

# The refusal string is READ OUT of the production system prompt, not typed
# here. The UI and evaluation.is_refusal() both key off this exact sentence;
# if the prompt is reworded, this script fails loudly instead of teaching the
# model a sentence the rest of the system no longer recognises.
_m = re.search(r'"(I don\'t know[^"]*)"', SYSTEM_PROMPT)
if not _m:
    raise SystemExit(
        "Could not find the refusal sentence in chat.SYSTEM_PROMPT. "
        "The production prompt changed — update this script before generating."
    )
REFUSAL = _m.group(1)
assert evaluation.is_refusal(REFUSAL), "the refusal sentence must satisfy is_refusal()"


# ── source text ─────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class Passage:
    doc: str
    page: int
    text: str


def load_passages() -> list[Passage]:
    """Every source document, chunked EXACTLY as ingestion chunks it."""
    files: list[Path] = []
    if HANDBOOK.exists():
        files.append(HANDBOOK)
    if SOURCES_DIR.exists():
        for p in sorted(SOURCES_DIR.iterdir()):
            # sources/README.md explains the folder — it is not training
            # material. (It got ingested once. 10 passages of instructions.)
            if p.suffix.lower() in (".pdf", ".txt", ".md") and p.stem.lower() != "readme":
                files.append(p)

    splitter = ingestion._splitter()  # the real one: CHUNK_SIZE / CHUNK_OVERLAP
    passages: list[Passage] = []
    for path in files:
        title = path.stem.replace("_", " ").replace("-", " ").title()
        try:
            if path.suffix.lower() == ".pdf":
                _, pages = extraction.extract_pdf(path.read_bytes())
            else:
                pages = [(1, path.read_text(encoding="utf-8", errors="replace"))]
        except Exception as e:
            print(f"  ! skipped {path.name}: {e}")
            continue
        n_before = len(passages)
        for page_no, text in pages:
            for piece in splitter.split_text(" ".join(text.split())):
                piece = piece.strip()
                if len(piece) < 120:  # too short to answer anything from
                    continue
                passages.append(Passage(doc=title, page=page_no, text=piece))
        print(f"  · {path.name:<40} {len(passages) - n_before:>4} passages")
    return passages


# ── recipes (deterministic, so a resumed run rebuilds the same plan) ─────────


@dataclass(frozen=True)
class Recipe:
    id: int
    kind: str  # "answerable" | "refusal"
    picks: tuple[int, ...]  # indices into the passage list, display order
    style: str


STYLES = [
    "a specific factual lookup",
    "a question about a number, amount, limit or deadline",
    "a question about a procedure — what steps to follow, in what order",
    "a yes/no question that needs a short reason after the answer",
    "a question whose answer needs TWO different passages combined",
    "a natural, slightly informal question the way a busy employee types it",
]


def build_recipes(passages: list[Passage], count: int, refusal_frac: float, seed: int) -> list[Recipe]:
    rng = random.Random(seed)
    by_doc: dict[str, list[int]] = {}
    for i, p in enumerate(passages):
        by_doc.setdefault(p.doc, []).append(i)
    docs = sorted(by_doc)

    recipes: list[Recipe] = []
    for rid in range(count):
        kind = "refusal" if rng.random() < refusal_frac else "answerable"
        primary_doc = rng.choice(docs)
        pool = by_doc[primary_doc]

        # 2-3 CONSECUTIVE passages: consecutive chunks overlap, so together
        # they carry a whole idea instead of two half-sentences.
        n_primary = min(len(pool), rng.choice([2, 2, 3]))
        start = rng.randrange(0, max(1, len(pool) - n_primary + 1))
        picks = list(pool[start : start + n_primary])

        # distractors from OTHER documents — the junk retrieval really returns
        others = [i for d in docs if d != primary_doc for i in by_doc[d]]
        n_distract = min(len(others), rng.choice([2, 2, 3]))
        if n_distract:
            picks += rng.sample(others, n_distract)

        rng.shuffle(picks)  # the answer must not always live in block [1]
        recipes.append(
            Recipe(id=rid, kind=kind, picks=tuple(picks), style=STYLES[rid % len(STYLES)])
        )
    return recipes


def sources_for(recipe: Recipe, passages: list[Passage]) -> list[Source]:
    return [
        Source(
            n=i + 1,
            document_id="",
            title=passages[idx].doc,
            page=passages[idx].page,
            text=passages[idx].text,
            score=0.0,
        )
        for i, idx in enumerate(recipe.picks)
    ]


# ── the teacher ─────────────────────────────────────────────────────────────

ANSWERABLE_SYSTEM = """You write training examples for a company knowledge assistant.

You are given numbered context passages. Produce ONE example:

1. "question" — a question a real employee would ask, that IS fully answerable
   from the passages. Write it as a person would type it, not as a quiz.
2. "answer" — the ideal answer, following these rules exactly:
   - Use ONLY the passages. Never add outside knowledge or general advice.
   - Cite with bracketed numbers like [1] or [2][4], placed directly after the
     specific claim they support — not clumped at the end.
   - Only cite passage numbers that exist above.
   - Be concise. Plain markdown: short paragraphs, bold for key figures, dash
     lists where they help. No headings, no preamble.

Citation placement matters. The marker goes AFTER the claim, never before it
and never at the start of a sentence:

  GOOD  Claims must be submitted within **45 days** of purchase [1]. Receipts
        are required above 500 [1], and payment lands with the next payroll
        run [3].
  BAD   Submit your claim within [1] **45 days**. [1] Receipts are required.

Some passages are irrelevant to your question. Ignore them and do not cite them.
Never mention "the passages", "the context" or these instructions in either field.

Output ONLY JSON: {"question": "...", "answer": "..."}"""

REFUSAL_SYSTEM = """You write REFUSAL training examples for a company knowledge assistant.

Given numbered context passages, write ONE question that:
- sounds natural and plausible for this kind of company document,
- is CLEARLY NOT answerable from the passages — the specific fact is simply
  absent. Adjacent topic, missing fact.

Bad (the passages answer it): "How many days of annual leave do we get?"
  when a passage states the number.
Good (adjacent, absent): "How many days of paternity leave do we get?"
  when the passages cover annual leave only.

Do not write a question the passages answer even partly. Never mention
"the passages" or "the context".

Output ONLY JSON: {"question": "..."}"""

VERIFY_SYSTEM = """You check whether a question can be answered from passages.

Answer "yes" only if the passages contain the specific information the question
asks for. Partial or related information that does not actually answer the
question is "no".

Output ONLY JSON: {"answerable": true/false}"""


class Teacher:
    """Claude Haiku, with usage accounting. Thread-safe."""

    def __init__(self, model: str, api_key: str):
        import anthropic

        self._client = anthropic.Anthropic(api_key=api_key, max_retries=4)
        self.model = model
        self._lock = threading.Lock()
        self.in_tokens = 0
        self.out_tokens = 0
        self.calls = 0

    def __call__(self, system: str, user: str, max_tokens: int = 700, temperature: float = 1.0) -> str:
        res = self._client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        with self._lock:
            self.calls += 1
            self.in_tokens += res.usage.input_tokens
            self.out_tokens += res.usage.output_tokens
        return "".join(b.text for b in res.content if getattr(b, "type", "") == "text")

    def cost_usd(self) -> float:
        s = get_settings()
        return (
            self.in_tokens * s.PRICE_INPUT_PER_MTOK + self.out_tokens * s.PRICE_OUTPUT_PER_MTOK
        ) / 1_000_000


def _json_object(raw: str) -> dict:
    m = re.search(r"\{.*\}", raw, re.DOTALL)
    if not m:
        raise ValueError("no JSON object in the reply")
    return json.loads(m.group(0))


# ── one row ─────────────────────────────────────────────────────────────────


class Rejected(Exception):
    """This example failed a quality gate. Cheaper to drop than to fix."""


# A citation that OPENS a sentence is citing nothing — the claim it supports
# hasn't been made yet. Caught in the first smoke run ("[1] Receipts are
# required"), and worth a hard gate: placement is a habit, and the model
# copies whatever habit the data has.
_CITATION_OPENS_SENTENCE = re.compile(r"(?:\A|[.!?:]\s+|\n\s*)\[\d+\]")


def _placement_is_sane(answer: str) -> bool:
    return not _CITATION_OPENS_SENTENCE.search(answer)


# Near-duplicate questions waste training capacity and quietly over-weight
# whatever topic they repeat. With a small passage pool the teacher WILL
# repeat itself (the first smoke run produced "standing desk" twice), so
# dedup is a gate, not a nicety.
_STOPWORDS = frozenset(
    "a an and are as at be by can do does for from get how i if in is it me my need of on or "
    "our should the to we what when where which who why will with you your".split()
)
_seen_fingerprints: list[frozenset[str]] = []
_seen_lock = threading.Lock()


def _fingerprint(question: str) -> frozenset[str]:
    return frozenset(w for w in re.findall(r"[a-z]+", question.lower()) if w not in _STOPWORDS)


def claim_question(question: str, threshold: float = 0.6) -> bool:
    """Register this question unless something too similar is already in.
    Jaccard over content words — crude, cheap, and enough at this scale."""
    fp = _fingerprint(question)
    if len(fp) < 3:
        return False
    with _seen_lock:
        for other in _seen_fingerprints:
            union = len(fp | other)
            if union and len(fp & other) / union >= threshold:
                return False
        _seen_fingerprints.append(fp)
        return True


def make_row(recipe: Recipe, passages: list[Passage], teacher: Teacher, verify: bool) -> dict:
    sources = sources_for(recipe, passages)
    context_only = build_user_prompt("", sources).rsplit("\n\nQuestion:", 1)[0]

    if recipe.kind == "answerable":
        raw = teacher(
            ANSWERABLE_SYSTEM + f"\n\nMake it {recipe.style}.",
            context_only + "\n\nWrite the example now.",
        )
        data = _json_object(raw)
        question = str(data.get("question", "")).strip()
        answer = str(data.get("answer", "")).strip()

        if not (10 <= len(question) <= 300):
            raise Rejected("question length")
        if not (20 <= len(answer) <= 2000):
            raise Rejected("answer length")
        if not claim_question(question):
            raise Rejected("near-duplicate question")
        if not re.search(r"\[\d+\]", answer):
            raise Rejected("answer has no citation")
        if evaluation.is_refusal(answer):
            raise Rejected("teacher refused an answerable question")
        if not _placement_is_sane(answer):
            raise Rejected("citation opens a sentence")
        # The gate that matters most: never teach a citation that points at a
        # passage which does not exist. Same check the eval harness runs.
        if not evaluation.citation_validity(answer, [s.to_dict() for s in sources]):
            raise Rejected("invalid citation number")
    else:
        raw = teacher(REFUSAL_SYSTEM, context_only + "\n\nWrite the question now.", max_tokens=200)
        question = str(_json_object(raw).get("question", "")).strip()
        if not (10 <= len(question) <= 300):
            raise Rejected("question length")
        if not claim_question(question):
            raise Rejected("near-duplicate question")
        if verify:
            # Traps are the rows most likely to be silently wrong: if the
            # passages DO answer it, we would be teaching the model to refuse
            # a question it should have answered. One cheap call per trap.
            v = _json_object(
                teacher(
                    VERIFY_SYSTEM,
                    f"{context_only}\n\nQuestion: {question}",
                    max_tokens=60,
                    temperature=0.0,
                )
            )
            if v.get("answerable") is True:
                raise Rejected("trap question was actually answerable")
        answer = REFUSAL

    return {
        "id": recipe.id,
        "kind": recipe.kind,
        "system": SYSTEM_PROMPT,
        "user": build_user_prompt(question, sources),
        "assistant": answer,
        "n_blocks": len(sources),
        "docs": sorted({s.title for s in sources}),
    }


# ── train/val split + report ────────────────────────────────────────────────


def split_and_report(val_frac: float, seed: int) -> None:
    rows = [json.loads(l) for l in RAW_PATH.read_text(encoding="utf-8").splitlines() if l.strip()]
    if not rows:
        print("\nno rows generated.")
        return
    rows.sort(key=lambda r: r["id"])
    rng = random.Random(seed)
    rng.shuffle(rows)
    n_val = max(1, int(len(rows) * val_frac))
    val, train = rows[:n_val], rows[n_val:]

    for path, part in ((TRAIN_PATH, train), (VAL_PATH, val)):
        path.write_text(
            "".join(json.dumps(r, ensure_ascii=False) + "\n" for r in part), encoding="utf-8"
        )

    kinds = Counter(r["kind"] for r in rows)
    # Rough token estimate (~4 chars/token) so we catch a max-seq-length
    # problem HERE, before wasting a Colab session on truncated rows.
    lengths = sorted((len(r["system"]) + len(r["user"]) + len(r["assistant"])) // 4 for r in rows)
    p50 = lengths[len(lengths) // 2]
    p95 = lengths[int(len(lengths) * 0.95)]

    print(f"\n  rows            {len(rows)}  (train {len(train)} / val {len(val)})")
    print(f"  answerable      {kinds['answerable']}")
    print(f"  refusal traps   {kinds['refusal']}  ({kinds['refusal'] / len(rows):.0%})")
    print(f"  est. tokens     p50 {p50}  p95 {p95}  max {lengths[-1]}")
    if lengths[-1] > 2048:
        print("  ⚠ some rows exceed 2048 tokens — train with max_seq_length=3072")
    print(f"\n  wrote {TRAIN_PATH.relative_to(ROOT)} and {VAL_PATH.relative_to(ROOT)}")


# ── main ────────────────────────────────────────────────────────────────────


def main() -> int:
    ap = argparse.ArgumentParser(description="Generate the fine-tuning dataset.")
    ap.add_argument("--count", type=int, default=1200, help="target number of rows")
    ap.add_argument("--limit", type=int, default=0, help="stop after N new rows (smoke test)")
    ap.add_argument("--refusal-frac", type=float, default=0.15)
    ap.add_argument("--val-frac", type=float, default=0.08)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--no-verify", action="store_true", help="skip the trap double-check (cheaper)")
    ap.add_argument("--dry-run", action="store_true", help="print one prompt, call nothing")
    args = ap.parse_args()

    settings = get_settings()
    if not settings.ANTHROPIC_API_KEY and not args.dry_run:
        print("ANTHROPIC_API_KEY is not set in the repo-root .env")
        return 1

    print("\n== loading sources ==")
    passages = load_passages()
    if len(passages) < 20:
        print(f"\nonly {len(passages)} passages — add documents to {SOURCES_DIR}")
        return 1
    docs = len({p.doc for p in passages})
    print(f"  {len(passages)} passages across {docs} documents")
    if docs < 2:
        print("  ⚠ only one document: every example's distractors will come from it too")

    recipes = build_recipes(passages, args.count, args.refusal_frac, args.seed)

    if args.dry_run:
        r = recipes[0]
        row_sources = sources_for(r, passages)
        print("\n== what one prompt looks like ==\n")
        print(build_user_prompt("<the question Claude will invent>", row_sources)[:2500])
        return 0

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    done: set[int] = set()
    if RAW_PATH.exists():
        for line in RAW_PATH.read_text(encoding="utf-8").splitlines():
            if line.strip():
                prev = json.loads(line)
                done.add(prev["id"])
                # Seed the dedup index, or a resumed run happily re-asks
                # every question the first run already asked.
                claim_question(prev["user"].rsplit("Question: ", 1)[-1])
        print(f"  resuming — {len(done)} rows already generated")

    todo = [r for r in recipes if r.id not in done]
    if args.limit:
        todo = todo[: args.limit]
    if not todo:
        print("  nothing to do — already complete")
        split_and_report(args.val_frac, args.seed)
        return 0

    teacher = Teacher(settings.LLM_MODEL_DEV, settings.ANTHROPIC_API_KEY)
    write_lock = threading.Lock()
    counts = Counter()
    t0 = time.perf_counter()

    print(f"\n== generating {len(todo)} rows · {args.workers} workers · {teacher.model} ==\n")

    def work(recipe: Recipe) -> None:
        try:
            row = make_row(recipe, passages, teacher, verify=not args.no_verify)
        except Rejected as e:
            with write_lock:
                counts["rejected"] += 1
                counts[f"reject:{e}"] += 1
            return
        except Exception as e:  # API hiccup, bad JSON — one row is not worth dying for
            with write_lock:
                counts["error"] += 1
            print(f"  ! row {recipe.id}: {e.__class__.__name__}: {e}")
            return
        # Append immediately: a crash at row 900 must not cost the first 899.
        with write_lock:
            with RAW_PATH.open("a", encoding="utf-8") as f:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
            counts["kept"] += 1
            counts[row["kind"]] += 1
            n = counts["kept"] + counts["rejected"] + counts["error"]
            if n % 25 == 0 or n == len(todo):
                rate = n / max(0.001, time.perf_counter() - t0)
                eta = (len(todo) - n) / max(0.001, rate) / 60
                print(
                    f"  {n:>5}/{len(todo)}  kept={counts['kept']} "
                    f"rejected={counts['rejected']} err={counts['error']}  "
                    f"${teacher.cost_usd():.2f}  eta {eta:.0f}m"
                )

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        list(pool.map(work, todo))

    print(f"\n== done in {(time.perf_counter() - t0) / 60:.1f} min ==")
    print(f"  kept {counts['kept']}   rejected {counts['rejected']}   errors {counts['error']}")
    for k, v in sorted(counts.items()):
        if k.startswith("reject:"):
            print(f"    {k[7:]:<40} {v}")
    print(f"  {teacher.calls} calls · {teacher.in_tokens:,} in · {teacher.out_tokens:,} out "
          f"· ${teacher.cost_usd():.2f}")

    split_and_report(args.val_frac, args.seed)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
