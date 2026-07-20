import { FlaskConical } from "lucide-react";
import {
  CountUp,
  Reveal,
  Stagger,
  StaggerItem,
} from "@/components/marketing/motion";

/**
 * The platform's REAL evaluation numbers — from the two stored production
 * eval runs (docs/PHASE_9_COMPLETE.md). Nothing rounded up, nothing
 * invented; the "with reranker" deltas are the measured local runs.
 */

const METRICS: {
  value: number;
  label: string;
  note: string;
}[] = [
  {
    value: 0.977,
    label: "Faithfulness",
    note: "1.000 with the cross-encoder reranker on",
  },
  {
    value: 0.955,
    label: "Answer relevance",
    note: "LLM-as-judge, strict JSON scoring",
  },
  {
    value: 1.0,
    label: "Retrieval hit-rate",
    note: "expected passage found — every time",
  },
  {
    value: 0.955,
    label: "Citation validity",
    note: "every [n] resolves to a real source",
  },
];

const FOOTNOTES = [
  "22 golden questions",
  "2 refusal traps — both refused correctly",
  "measured against production, not localhost",
  "runs stored & browsable on the Evaluation page",
];

export function EvalNumbers() {
  return (
    <section className="relative overflow-hidden bg-primary text-on-primary">
      {/* faint dotted backdrop */}
      <div className="bs-dotgrid absolute inset-0 opacity-10" />
      <div className="relative mx-auto max-w-6xl px-6 py-20 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <p className="flex items-center justify-center gap-2 text-xs font-semibold tracking-widest text-accent-300 uppercase">
              <FlaskConical className="h-3.5 w-3.5" />
              Evaluation
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight lg:text-4xl">
              A demo is a claim. A number is proof.
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mt-4 text-base leading-7 text-white/70">
              Every answer BrainStack gives is scored by an automated judge for
              faithfulness to its sources and relevance to the question. These
              are the latest production scores — live on the Evaluation page,
              not a slide.
            </p>
          </Reveal>
        </div>

        <Stagger className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
          {METRICS.map((m) => (
            <StaggerItem
              key={m.label}
              className="bg-primary p-7 text-center sm:p-8"
            >
              <p className="text-4xl font-semibold tracking-tight tabular-nums lg:text-5xl">
                <CountUp value={m.value} decimals={3} duration={1.8} />
              </p>
              <p className="mt-2 text-sm font-semibold text-accent-300">
                {m.label}
              </p>
              <p className="mt-1.5 text-xs leading-5 text-white/55">{m.note}</p>
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal delay={0.25}>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {FOOTNOTES.map((f) => (
              <span
                key={f}
                className="flex items-center gap-2 font-mono text-[11px] text-white/50"
              >
                <span className="h-1 w-1 rounded-full bg-accent-400" />
                {f}
              </span>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
