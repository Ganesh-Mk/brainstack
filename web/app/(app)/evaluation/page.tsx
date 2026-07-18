import type { Metadata } from "next";
import { ComingSoon } from "@/components/patterns/ComingSoon";
import { PreviewCard } from "@/components/patterns/preview";
import { Badge } from "@/components/ui/Badge";

export const metadata: Metadata = { title: "Evaluation" };

const RUNS = [
  {
    q: "What is the refund window for enterprise plans?",
    faithful: true,
    relevance: 0.94,
    source: "policies-2026.pdf",
  },
  {
    q: "Who approves security exceptions?",
    faithful: true,
    relevance: 0.91,
    source: "security-whitepaper.pdf",
  },
  {
    q: "What's the onboarding checklist for new hires?",
    faithful: true,
    relevance: 0.88,
    source: "onboarding-handbook.docx",
  },
  {
    q: "Do we support SSO on the starter plan?",
    faithful: false,
    relevance: 0.52,
    source: "pricing page (URL)",
  },
];

function EvaluationPreview() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Golden dataset", value: "24 questions" },
          { label: "Faithfulness", value: "0.91" },
          { label: "Context relevance", value: "0.86" },
        ].map((kpi) => (
          <PreviewCard key={kpi.label} className="p-4">
            <p className="text-[10px] font-semibold tracking-wide text-subtle uppercase">
              {kpi.label}
            </p>
            <p className="mt-1.5 text-xl font-semibold text-primary">
              {kpi.value}
            </p>
          </PreviewCard>
        ))}
      </div>
      <PreviewCard className="p-0">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="text-xs font-semibold tracking-wide text-subtle uppercase">
            Latest run · LLM-as-judge (claude-haiku-4-5)
          </p>
          <span className="font-mono text-xs text-subtle">eval #12 · Jul 16</span>
        </div>
        <ul>
          {RUNS.map((run) => (
            <li
              key={run.q}
              className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-border px-5 py-3 last:border-0"
            >
              <p className="min-w-0 flex-1 truncate text-sm text-primary">
                {run.q}
              </p>
              <span className="font-mono text-xs text-muted">
                rel {run.relevance.toFixed(2)}
              </span>
              <Badge variant={run.faithful ? "success" : "danger"}>
                {run.faithful ? "Faithful" : "Unsupported claim"}
              </Badge>
              <span className="hidden text-xs text-subtle sm:block">
                {run.source}
              </span>
            </li>
          ))}
        </ul>
      </PreviewCard>
    </div>
  );
}

export default function EvaluationPage() {
  return (
    <ComingSoon
      href="/evaluation"
      bullets={[
        "A golden dataset of real questions, run on every change",
        "LLM-as-judge faithfulness scoring — hallucinations get caught",
        "Context-relevance scores that pinpoint retrieval problems",
        "RAGAS comparison against standardized metrics",
        "“Faithfulness went 0.82 → 0.91” — numbers, not vibes",
      ]}
      preview={<EvaluationPreview />}
    />
  );
}
