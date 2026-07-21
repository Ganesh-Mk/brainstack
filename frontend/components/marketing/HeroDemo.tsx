"use client";

/**
 * The hero's live product demo — an auto-playing replay of four REAL,
 * documented platform behaviors (see docs/PHASE_8_COMPLETE.md and
 * backend/eval/golden.jsonl):
 *
 *   1. Know     — golden question #6 answered from handbook.pdf, cited.
 *   2. Act      — the manager MCP journey (assign_ticket → get_analytics).
 *   3. Remember — long-term memory recall in a brand-new conversation.
 *   4. Refuse   — golden refusal trap #21: no grounding → no answer.
 *
 * Nothing here is invented: the questions, sources, tool names and outcomes
 * are the ones the production e2e + eval runs actually exercise.
 */

import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "motion/react";
import {
  BookOpenCheck,
  Brain,
  Check,
  CircleCheck,
  Database,
  FileSearch,
  LoaderCircle,
  PenLine,
  Sparkles,
  Ticket,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

/* ── Script data ─────────────────────────────────────────────────────── */

type Token = { t: string; cite?: number; strong?: boolean };
type Step = { icon: LucideIcon; label: string; mono?: string; ms: number };

type Scenario = {
  key: string;
  tab: string;
  role: "Employee" | "Manager";
  question: string;
  steps: Step[];
  answer: Token[];
  source?: { ref: number; doc: string; quote: string };
  meta: string;
};

const SCENARIOS: Scenario[] = [
  {
    key: "know",
    tab: "Know",
    role: "Employee",
    question: "How long do clients have to return a deliverable for a refund?",
    steps: [
      { icon: Brain, label: "Planning", ms: 900 },
      {
        icon: FileSearch,
        label: "Knowledge search",
        mono: "hybrid · dense + BM25 → RRF",
        ms: 1250,
      },
      { icon: PenLine, label: "Drafting", ms: 500 },
    ],
    answer: [
      { t: "Clients can send back any deliverable within " },
      { t: "30 days", strong: true },
      { t: " of final handover ", cite: 1 },
      { t: ". After that window, the studio offers " },
      { t: "credit instead of money back", strong: true },
      { t: " — and it never expires ", cite: 2 },
      { t: "." },
    ],
    source: {
      ref: 1,
      doc: "handbook.pdf · page 1",
      quote:
        "“Clients may send back any deliverable within 30 days of final handover…”",
    },
    meta: "6 chunks retrieved · grounded · 2 citations",
  },
  {
    key: "act",
    tab: "Act",
    role: "Manager",
    question: "Assign the login-bug ticket to Priya and show me her workload.",
    steps: [
      { icon: Brain, label: "Planning", ms: 900 },
      {
        icon: Ticket,
        label: "Company MCP",
        mono: "assign_ticket(login-bug → Priya)",
        ms: 1150,
      },
      {
        icon: TrendingUp,
        label: "Company MCP",
        mono: "get_analytics(Priya, this_week)",
        ms: 1150,
      },
      { icon: PenLine, label: "Summarizing", ms: 500 },
    ],
    answer: [
      { t: "Done — the " },
      { t: "login-bug", strong: true },
      { t: " ticket is assigned to Priya. She now has " },
      { t: "6 open tickets", strong: true },
      { t: " this week (up from 4), with an average resolution of 1.2 days." },
    ],
    meta: "2 MCP tools called · role: manager · action verified",
  },
  {
    key: "remember",
    tab: "Remember",
    role: "Employee",
    question: "What's my name, and which office do I run?",
    steps: [
      { icon: Brain, label: "Planning", ms: 900 },
      {
        icon: Database,
        label: "Memory recall",
        mono: "top-3 · cosine-gated ≥ 0.35",
        ms: 1200,
      },
      { icon: PenLine, label: "Drafting", ms: 500 },
    ],
    answer: [
      { t: "You're " },
      { t: "Alex", strong: true },
      { t: " — and you run the " },
      { t: "Bangalore office", strong: true },
      { t: ". You told me in an earlier conversation, so I remembered." },
    ],
    meta: "new conversation · 2 facts recalled from long-term memory",
  },
  {
    key: "refuse",
    tab: "Refuse",
    role: "Employee",
    question: "What's our policy on cryptocurrency payments?",
    steps: [
      { icon: Brain, label: "Planning", ms: 900 },
      {
        icon: FileSearch,
        label: "Knowledge search",
        mono: "hybrid · dense + BM25 → RRF",
        ms: 1250,
      },
      {
        icon: BookOpenCheck,
        label: "Grounding check",
        mono: "no supporting passages",
        ms: 1000,
      },
    ],
    answer: [
      { t: "Your documents don't cover cryptocurrency payments, so " },
      { t: "I won't guess", strong: true },
      { t: ". Try adding the finance policy to your knowledge base — I'll have a grounded answer then." },
    ],
    meta: "0 supporting chunks · honest refusal (scores 1.0 on eval)",
  },
];

const TYPE_MS = 26;
const TOKEN_MS = 34;
const HOLD_MS = 3400;

function scenarioDuration(s: Scenario) {
  const chars = s.question.length * TYPE_MS + 350;
  const steps = s.steps.reduce((a, b) => a + b.ms, 0);
  const words = s.answer.reduce(
    (a, tok) => a + tok.t.split(" ").length + (tok.cite ? 1 : 0),
    0,
  );
  return chars + steps + words * TOKEN_MS + (s.source ? 420 : 0) + HOLD_MS;
}

/* ── Playback state ──────────────────────────────────────────────────── */

type Playback = {
  typed: number; // question chars visible
  stepState: number[]; // 0 pending · 1 active · 2 done
  tokens: number; // answer word-units visible
  showSource: boolean;
  showMeta: boolean;
};

const initialPlayback = (s: Scenario): Playback => ({
  typed: 0,
  stepState: s.steps.map(() => 0),
  tokens: 0,
  showSource: false,
  showMeta: false,
});

const finishedPlayback = (s: Scenario): Playback => ({
  typed: s.question.length,
  stepState: s.steps.map(() => 2),
  tokens: Infinity,
  showSource: true,
  showMeta: true,
});

/** Split the answer into word-units so streaming feels token-by-token. */
function toUnits(answer: Token[]) {
  const units: Token[] = [];
  for (const tok of answer) {
    const words = tok.t.split(" ");
    words.forEach((w, i) => {
      if (w !== "")
        units.push({ t: w + (i < words.length - 1 ? " " : ""), strong: tok.strong });
      else if (i < words.length - 1) units.push({ t: " " });
    });
    if (tok.cite) units.push({ t: "", cite: tok.cite });
  }
  return units;
}

/* ── Component ───────────────────────────────────────────────────────── */

export function HeroDemo() {
  const reduced = useReducedMotion();
  const [idx, setIdx] = useState(0);
  const scenario = SCENARIOS[idx];
  const [playing, setPlaying] = useState<Playback>(() =>
    initialPlayback(SCENARIOS[0]),
  );
  // Reduced motion shows the finished state — derived at render so it's
  // right on the first paint, with no playback effect running at all.
  const pb = reduced ? finishedPlayback(scenario) : playing;

  useEffect(() => {
    if (reduced) return;
    // Cancellation is a per-effect closure flag — a shared ref would get
    // reset by the next effect run before the old async loop noticed.
    let cancelled = false;
    const sleep = (ms: number) =>
      new Promise<void>((r) => setTimeout(r, ms));

    async function play() {
      setPlaying(initialPlayback(scenario));
      await sleep(350);
      // 1 — type the question
      for (let c = 1; c <= scenario.question.length; c++) {
        if (cancelled) return;
        setPlaying((p) => ({ ...p, typed: c }));
        await sleep(TYPE_MS);
      }
      await sleep(280);
      // 2 — trace steps, sequentially
      for (let s = 0; s < scenario.steps.length; s++) {
        if (cancelled) return;
        setPlaying((p) => ({
          ...p,
          stepState: p.stepState.map((v, i) =>
            i < s ? 2 : i === s ? 1 : 0,
          ),
        }));
        await sleep(scenario.steps[s].ms);
      }
      if (cancelled) return;
      setPlaying((p) => ({ ...p, stepState: p.stepState.map(() => 2) }));
      // 3 — stream the answer
      const units = toUnits(scenario.answer);
      for (let t = 1; t <= units.length; t++) {
        if (cancelled) return;
        setPlaying((p) => ({ ...p, tokens: t }));
        await sleep(TOKEN_MS);
      }
      // 4 — source card + meta
      if (scenario.source) {
        await sleep(360);
        if (cancelled) return;
        setPlaying((p) => ({ ...p, showSource: true }));
      }
      await sleep(240);
      if (cancelled) return;
      setPlaying((p) => ({ ...p, showMeta: true }));
      // 5 — hold, then advance. Reset the playback for the NEXT scenario
      // in the same tick as the index change — otherwise one frame renders
      // the new scenario with the old (finished) playback state.
      await sleep(HOLD_MS);
      if (cancelled) return;
      setPlaying(initialPlayback(SCENARIOS[(idx + 1) % SCENARIOS.length]));
      setIdx((i) => (i + 1) % SCENARIOS.length);
    }

    play();
    return () => {
      cancelled = true;
    };
  }, [idx, reduced, scenario]);

  const units = toUnits(scenario.answer);
  const visibleUnits = units.slice(
    0,
    pb.tokens === Infinity ? units.length : pb.tokens,
  );
  const answerDone = visibleUnits.length >= units.length;
  // The answer may NEVER appear before the trace finishes — belt (the
  // script is sequential) and suspenders (any stale playback state from a
  // scenario switch can't leak an early answer through).
  const traceDone =
    pb.stepState.length > 0 && pb.stepState.every((v) => v === 2);
  const anyAnswer = traceDone && visibleUnits.length > 0;

  return (
    <div className="relative">
      {/* soft accent glow behind the window */}
      <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-tr from-accent-100 via-transparent to-accent-soft blur-2xl" />

      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface shadow-xl">
        {/* window chrome */}
        <div className="flex items-center gap-1.5 border-b border-border bg-canvas px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
          <span className="ml-3 rounded-md bg-surface px-2 py-0.5 font-mono text-[10px] text-subtle">
            app.brainstack.space
          </span>
          <span
            className={cn(
              "ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold",
              scenario.role === "Manager"
                ? "bg-accent-soft text-accent-700"
                : "bg-surface-raised text-muted",
            )}
          >
            {scenario.role}
          </span>
        </div>

        <div className="grid sm:grid-cols-[1.5fr_1fr]">
          {/* ── chat side ── */}
          <div className="flex min-h-[264px] flex-col gap-3 p-4">
            {/* question bubble */}
            <div className="ml-auto w-fit max-w-[92%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-xs leading-5 text-on-primary">
              {scenario.question.slice(0, pb.typed)}
              {pb.typed < scenario.question.length && (
                <span className="bs-caret ml-px inline-block h-3 w-[5px] translate-y-0.5 rounded-[1px] bg-white/80" />
              )}
            </div>

            {/* answer bubble */}
            <AnimatePresence mode="wait">
              {anyAnswer && (
                <motion.div
                  key={scenario.key}
                  initial={reduced ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="w-fit max-w-[95%] rounded-2xl rounded-bl-md border border-border bg-canvas px-3.5 py-2.5 text-xs leading-5 text-primary"
                >
                  {visibleUnits.map((u, i) =>
                    u.cite ? (
                      <motion.span
                        key={i}
                        initial={reduced ? false : { scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 18 }}
                        className="mx-0.5 inline-block rounded bg-accent-soft px-1 font-medium text-accent-700"
                      >
                        [{u.cite}]
                      </motion.span>
                    ) : (
                      <span
                        key={i}
                        className={cn(u.strong && "font-semibold text-accent-700")}
                      >
                        {u.t}
                      </span>
                    ),
                  )}
                  {!answerDone && (
                    <span className="ml-0.5 inline-block h-3 w-1 animate-pulse rounded-sm bg-accent align-middle" />
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* cited source panel */}
            <AnimatePresence>
              {traceDone && pb.showSource && scenario.source && (
                <motion.div
                  initial={reduced ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35 }}
                  className="rounded-lg border-l-2 border-accent bg-accent-soft/60 px-3 py-2 text-[10px] leading-4 text-muted"
                >
                  <span className="font-semibold text-primary">
                    [{scenario.source.ref}]
                  </span>{" "}
                  {scenario.source.doc} — {scenario.source.quote}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── trace side ── */}
          <div className="border-t border-border bg-canvas p-4 sm:border-t-0 sm:border-l">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-widest text-subtle uppercase">
              <Sparkles className="h-3 w-3" /> Agent trace
            </p>
            <ul className="mt-3 space-y-2.5 text-[11px]">
              {scenario.steps.map((step, i) => {
                const state = pb.stepState[i];
                return (
                  <motion.li
                    key={`${scenario.key}-${i}`}
                    initial={reduced ? false : { opacity: 0, x: -8 }}
                    animate={{
                      opacity: state === 0 ? 0.35 : 1,
                      x: 0,
                    }}
                    transition={{ duration: 0.3 }}
                    className={cn(
                      "flex flex-col gap-0.5",
                      state === 1 ? "text-accent" : "text-primary",
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      {state === 2 ? (
                        <CircleCheck className="h-3 w-3 shrink-0 text-success" />
                      ) : state === 1 ? (
                        <LoaderCircle className="h-3 w-3 shrink-0 animate-spin" />
                      ) : (
                        <span className="h-3 w-3 shrink-0 rounded-full border border-border-strong" />
                      )}
                      <step.icon className="h-3 w-3 shrink-0 text-subtle" />
                      <span className={cn(state === 1 && "font-medium")}>
                        {step.label}
                      </span>
                    </span>
                    {step.mono && state > 0 && (
                      <motion.span
                        initial={reduced ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="pl-[42px] font-mono text-[9px] text-subtle"
                      >
                        {step.mono}
                      </motion.span>
                    )}
                  </motion.li>
                );
              })}
            </ul>

            {/* meta card */}
            <div className="mt-4 min-h-[42px]">
              <AnimatePresence>
                {traceDone && pb.showMeta && (
                  <motion.div
                    initial={reduced ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="rounded-lg border border-border bg-surface p-2.5"
                  >
                    <p className="flex items-start gap-1.5 font-mono text-[9px] leading-4 text-subtle">
                      <Check className="mt-px h-3 w-3 shrink-0 text-success" />
                      {scenario.meta}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* ── scenario tabs ── */}
        <div className="flex items-center gap-1.5 border-t border-border bg-canvas px-3 py-2">
          {SCENARIOS.map((s, i) => {
            const active = i === idx;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => {
                  // Reset playback with the index so no frame mixes the new
                  // scenario with the old scenario's finished state.
                  setPlaying(initialPlayback(s));
                  setIdx(i);
                }}
                aria-label={`Show the “${s.tab}” demo`}
                className={cn(
                  "relative overflow-hidden rounded-full px-2.5 py-1 text-[10px] font-semibold transition",
                  active
                    ? "bg-primary text-on-primary"
                    : "text-subtle hover:bg-surface-raised hover:text-primary",
                )}
              >
                {active && !reduced && (
                  <span
                    key={`bar-${s.key}-${idx}`}
                    className="absolute inset-x-0 bottom-0 h-[2px] origin-left bg-accent-300"
                    style={{
                      animation: `bs-grow-x ${scenarioDuration(s)}ms linear both`,
                    }}
                  />
                )}
                {s.tab}
              </button>
            );
          })}
          <span className="ml-auto hidden font-mono text-[9px] text-subtle sm:block">
            replaying real production behavior
          </span>
        </div>
      </div>
    </div>
  );
}
