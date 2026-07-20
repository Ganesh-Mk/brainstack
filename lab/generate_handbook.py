"""Generate the lab corpus: a fictional Lovely employee handbook PDF.

Why generate instead of downloading one: the experiments in experiments.py are
written against this exact content, and it's built to make specific lessons
visible:

  * The refunds section never uses the word "refund" — it's titled "Returns".
    A query about "refund policy" can only find it by MEANING. That's the
    proof that embeddings aren't keyword search.
  * There is deliberately NO parental leave section. Asking about it is how we
    watch the model hallucinate (experiment 6.4).
  * The laptop replacement rule is stated as one long sentence so it can be
    split across a chunk boundary (experiment 6.3, overlap=0).

Run:  lab/.venv/Scripts/python generate_handbook.py
"""

from pathlib import Path

import fitz  # PyMuPDF

OUT = Path(__file__).parent / "data" / "handbook.pdf"

# (heading, [paragraphs])
SECTIONS: list[tuple[str, list[str]]] = [
    (
        "Welcome to Lovely",
        [
            "Lovely is a product design studio. This handbook describes how we "
            "work together, what we expect of each other, and the policies that "
            "keep the studio running smoothly. It applies to every employee, "
            "contractor, and intern.",
            "If something here is unclear, ask your manager. This document is "
            "reviewed twice a year and updated as our practices change.",
        ],
    ),
    (
        "Returns",
        [
            "Clients may send back any deliverable within 30 days of final "
            "handover if it does not match the agreed specification. The studio "
            "issues the money back in full, to the original payment method, "
            "within 10 business days of the request being approved.",
            "After 30 days we offer studio credit rather than money back. Credit "
            "does not expire and may be applied to any future engagement.",
            "Work that has been published, printed, or shipped to the client's "
            "own customers cannot be sent back. In those cases we offer a "
            "revision round at no cost instead.",
            "Requests are approved by the account lead. If a client disputes a "
            "decision, it is escalated to the studio director, whose decision is "
            "final.",
        ],
    ),
    (
        "Leave and Time Off",
        [
            "Every employee receives 25 days of paid annual leave per calendar "
            "year, in addition to public holidays. Leave does not roll over "
            "into the following year, so plan accordingly.",
            "Request leave at least two weeks in advance through the studio "
            "calendar. Requests longer than five consecutive days need manager "
            "approval. During a client launch week, leave is granted only in "
            "exceptional circumstances.",
            "Sick leave is uncapped and untracked. We trust people to rest when "
            "they are unwell and to tell their manager the same day if they "
            "cannot work.",
            "Unpaid sabbatical of up to three months is available after four "
            "years of continuous service, subject to director approval.",
        ],
    ),
    (
        "Expenses and Reimbursement",
        [
            "Submit expenses within 45 days of the purchase date. Anything "
            "submitted later is not reimbursed except with director approval.",
            "Receipts are required for every claim over 500 rupees. Photographs "
            "of paper receipts are acceptable. Claims are paid with the next "
            "monthly payroll run.",
            "Client travel is reimbursed at cost: standard-class rail, economy "
            "flights, and mid-range hotels. Taxis are reimbursed when public "
            "transport is impractical or unsafe.",
            "Software subscriptions under 2000 rupees per month can be approved "
            "by your manager. Anything above that needs director sign-off "
            "before purchase, not after.",
        ],
    ),
    (
        "Security and Devices",
        [
            "Every studio laptop is issued with full-disk encryption enabled and "
            "must not be disabled. Use the studio password manager for all work "
            "credentials; never reuse a personal password for a work account.",
            "Two-factor authentication is mandatory on every account that "
            "supports it, including email, source control, and the design tools.",
            "A studio laptop is replaced on a fixed cycle and any device that is "
            "lost or stolen must be reported to the studio director on the same "
            "day so that it can be wiped remotely before a replacement is issued "
            "from the spare pool, which normally takes two working days.",
            "Client files are stored only in the studio drive. Do not copy client "
            "work to personal cloud storage, personal email, or an unencrypted "
            "USB drive.",
        ],
    ),
    (
        "Onboarding",
        [
            "New joiners are paired with an onboarding buddy for their first "
            "month. The buddy is not their manager; the point is to have someone "
            "to ask the questions that feel too small to raise elsewhere.",
            "The first week is deliberately light on client work: accounts and "
            "access on day one, a studio tools walkthrough on day two, and "
            "shadowing a live project for the rest of the week.",
            "A formal check-in happens at 30, 60, and 90 days. Probation ends at "
            "90 days with a written confirmation.",
            "Every new joiner is issued a laptop, a monitor, and a desk chair. "
            "Hardware requests beyond that are made through your manager and "
            "reviewed at the start of each quarter.",
        ],
    ),
    (
        "Working Hours and Remote Work",
        [
            "Core hours are 11:00 to 16:00. Outside those hours you are free to "
            "arrange your day as suits you, provided your commitments to the "
            "team and to clients are met.",
            "The studio operates on a hybrid pattern: two days in the studio and "
            "three days remote is the default. Teams may agree a different split "
            "if every member of the team consents.",
            "Fully remote arrangements are possible for roles that do not "
            "require regular in-person collaboration, and are agreed in writing "
            "with the studio director before they begin.",
            "If you work from a different timezone for more than two weeks, tell "
            "your manager in advance so that meetings can be scheduled sensibly.",
        ],
    ),
    (
        "Pay and Progression",
        [
            "Salaries are reviewed once a year, in April. Reviews consider the "
            "market rate for the role, the scope of work you are handling, and "
            "the feedback gathered during the year.",
            "Payday is the last working day of each month. Payslips are issued "
            "through the payroll portal two days before payday.",
            "Promotion is not tied to the annual review. A promotion case can be "
            "raised at any point in the year by you or by your manager, and is "
            "decided by the director together with two senior peers.",
            "There is no individual performance bonus. When the studio has a "
            "strong year, a single profit share is distributed equally to "
            "everyone who has been employed for at least six months.",
        ],
    ),
    (
        "Feedback and Reviews",
        [
            "Every person has a one-to-one with their manager every two weeks. "
            "It is the employee's meeting: they set the agenda and the manager "
            "listens more than they speak.",
            "Written feedback is gathered twice a year from the people you work "
            "with most closely. It is shared with you in full, with names "
            "attached, because anonymous feedback tends to be less useful and "
            "less kind.",
            "Concerns about conduct are raised with your manager, or with the "
            "studio director if your manager is the subject of the concern. "
            "Every concern is acknowledged within two working days.",
        ],
    ),
    (
        "Client Communication",
        [
            "One person owns the relationship with each client: the account "
            "lead. All commitments about scope, timing, or price come from them, "
            "so that a client never receives two different answers.",
            "Never promise a date in a live conversation. Take the request away, "
            "check it against the plan, and confirm in writing the same day.",
            "Written updates go out every Friday for every active engagement, "
            "even the quiet ones. A short update on a week where nothing "
            "changed is more reassuring than silence.",
            "Bad news is delivered early and directly. A slipped deadline raised "
            "two weeks ahead is a scheduling problem; the same slip raised on "
            "the day is a trust problem.",
        ],
    ),
    (
        "Confidentiality and Intellectual Property",
        [
            "Client work is confidential indefinitely, including after the "
            "engagement ends and after you leave the studio.",
            "Work produced for a client belongs to that client on final payment. "
            "Tools, libraries, and internal components the studio builds along "
            "the way remain the property of the studio.",
            "Adding a project to your personal portfolio requires the client's "
            "written permission. The account lead will request it on your "
            "behalf; do not approach the client directly.",
            "Do not discuss an unannounced client project in public, including "
            "on social media and at industry events, until the client has "
            "announced it themselves.",
        ],
    ),
    (
        "Support Escalation and Response Times",
        [
            "Client issues are raised in the shared support channel and triaged "
            "by the account lead each morning.",
            "A blocking issue, meaning the client cannot use the delivered work "
            "at all, is acknowledged within 2 hours and worked continuously "
            "until resolved.",
            "A major issue, meaning a significant feature is broken but a "
            "workaround exists, is acknowledged within 1 business day and "
            "resolved within 5 business days.",
            "A minor issue, such as a cosmetic defect or a copy change, is "
            "acknowledged within 2 business days and batched into the next "
            "scheduled revision round.",
            "If an issue is not resolved within its target, the account lead "
            "notifies the client directly with a revised estimate rather than "
            "letting the deadline pass silently.",
        ],
    ),
]

PAGE_W, PAGE_H = fitz.paper_size("a4")
MARGIN = 64
BODY_SIZE = 10.5
HEAD_SIZE = 15
LEADING = 15.5


def wrap(text: str, font: str, size: float, width: float) -> list[str]:
    """Greedy word wrap using real glyph widths."""
    words, lines, line = text.split(), [], ""
    for word in words:
        candidate = f"{line} {word}".strip()
        if fitz.get_text_length(candidate, fontname=font, fontsize=size) <= width:
            line = candidate
        else:
            if line:
                lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc = fitz.open()
    width = PAGE_W - 2 * MARGIN

    page = doc.new_page(width=PAGE_W, height=PAGE_H)
    y = MARGIN

    def new_page() -> None:
        nonlocal page, y
        page = doc.new_page(width=PAGE_W, height=PAGE_H)
        y = MARGIN

    def write(text: str, font: str, size: float, gap_after: float) -> None:
        nonlocal y
        for line in wrap(text, font, size, width):
            if y + LEADING > PAGE_H - MARGIN:
                new_page()
            page.insert_text((MARGIN, y), line, fontname=font, fontsize=size)
            y += LEADING
        y += gap_after

    write("Lovely — Employee Handbook", "helv", 20, 18)

    for heading, paragraphs in SECTIONS:
        # Keep a heading with at least one line of its section.
        if y + LEADING * 3 > PAGE_H - MARGIN:
            new_page()
        write(heading, "hebo", HEAD_SIZE, 6)
        for para in paragraphs:
            write(para, "helv", BODY_SIZE, 8)
        y += 6

    doc.save(OUT)
    doc.close()
    print(f"wrote {OUT}  ({len(SECTIONS)} sections)")

    check = fitz.open(OUT)
    chars = sum(len(p.get_text()) for p in check)
    print(f"  {check.page_count} pages, {chars} characters of extractable text")
    check.close()


if __name__ == "__main__":
    main()
