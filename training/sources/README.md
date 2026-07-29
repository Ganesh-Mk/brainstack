# `training/sources/` — drop source documents here

**This folder is where YOU put files.** The generator reads everything in here
plus `lab/data/handbook.pdf` automatically.

Accepted: `.pdf`, `.txt`, `.md`. Anything else is ignored.

---

## Why we need more than the handbook

`lab/data/handbook.pdf` alone gives **25 passages**. That is enough to smoke-test
the script, and nowhere near enough to train on. With 25 passages the model sees
the same few paragraphs over and over and learns those paragraphs instead of the
skill.

**Target: 400–600 passages, across at least 8–10 different documents.**

The number of *documents* matters as much as the number of passages. Every
training example mixes passages from a main document with distractor passages
from **other** documents — that is what teaches "ignore the irrelevant block".
With one document there are no real distractors.

---

## What kind of documents

We are training the *habit* of grounded answering, not any company's facts. So
the text just has to **look like the documents BrainStack customers upload**:

✅ Good — dense, factual, full of rules and numbers:
- employee handbooks, HR policy documents
- expense / travel / leave policies
- IT and security policies, onboarding guides
- standard operating procedures
- product documentation, API docs, support knowledge-base articles
- terms of service, SLAs, refund policies

❌ Bad — nothing to ask a factual question about:
- novels, blog posts, opinion pieces, marketing copy
- anything mostly images or tables with no prose
- scanned PDFs (no extractable text — the script will skip them and say so)

---

## Where to get them, free and legal

Pick 8–12 documents totalling roughly 150–250 pages.

1. **University / government HR handbooks** — search
   `employee handbook filetype:pdf site:.edu` or `site:.gov`. These are public
   documents and are ideal: long, factual, full of policies.
2. **Open-source project docs** — save any project's `CONTRIBUTING.md`,
   `SECURITY.md`, `CODE_OF_CONDUCT.md`, or a docs page as `.md`.
3. **Public API documentation** — copy a docs page into a `.txt` file.
4. **Your own writing** — any policy-shaped document you already have.

⚠️ Do not put anything confidential in here. These files feed Claude's API
during generation, and the questions/answers derived from them end up in
`training/data/`. Public documents only.

---

## Naming

The filename becomes the document title the model sees in each citation
(`[1] (Employee Handbook, p.4) ...`). So name them readably:

```
employee_handbook_2024.pdf     ->  "Employee Handbook 2024"
it_security_policy.pdf         ->  "It Security Policy"
expense-and-travel-policy.pdf  ->  "Expense And Travel Policy"
```

---

## Check your work

```bash
# from the repo root
backend/.venv/Scripts/python.exe training/generate_data.py --dry-run
```

It prints how many passages each file produced and shows one example prompt.
If a file yields 0 passages it is probably a scanned PDF — replace it.

You want to see something like:

```
  · handbook.pdf                    25 passages
  · employee_handbook_2024.pdf     180 passages
  · it_security_policy.pdf          64 passages
  ...
  512 passages across 9 documents
```

---

*The documents themselves are gitignored — they are yours, sometimes large, and
not ours to redistribute. The `train.jsonl` derived from them IS committed.*
