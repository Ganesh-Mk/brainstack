import type { Metadata } from "next";
import { ComingSoon } from "@/components/patterns/ComingSoon";
import { PreviewCard } from "@/components/patterns/preview";
import { Badge } from "@/components/ui/Badge";

export const metadata: Metadata = { title: "Observability" };

const TRACES = [
  {
    id: "tr_8f2a41",
    q: "Compare our refund policy with competitors…",
    tools: ["search_knowledge", "web_search"],
    tokens: "3.2k → 450",
    cost: "$0.027",
    ms: "4.2 s",
    score: 0.95,
  },
  {
    id: "tr_8f29be",
    q: "Assign login-bug to Priya and show workload",
    tools: ["assign_ticket", "get_analytics"],
    tokens: "1.8k → 210",
    cost: "$0.014",
    ms: "3.1 s",
    score: 1.0,
  },
  {
    id: "tr_8f28c7",
    q: "What's the onboarding checklist?",
    tools: ["search_knowledge"],
    tokens: "2.4k → 380",
    cost: "$0.019",
    ms: "2.4 s",
    score: 0.89,
  },
];

function ObservabilityPreview() {
  return (
    <PreviewCard className="p-0">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <p className="text-xs font-semibold tracking-wide text-subtle uppercase">
          Query traces
        </p>
        <span className="font-mono text-xs text-subtle">
          one row per question · exportable
        </span>
      </div>
      <ul>
        {TRACES.map((trace) => (
          <li
            key={trace.id}
            className="space-y-1.5 border-b border-border px-5 py-3.5 last:border-0"
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-mono text-[10px] text-subtle">
                {trace.id}
              </span>
              <p className="min-w-0 flex-1 truncate text-sm font-medium text-primary">
                {trace.q}
              </p>
              <Badge variant={trace.score >= 0.9 ? "success" : "warning"}>
                faithfulness {trace.score.toFixed(2)}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-muted">
              <span>tools: {trace.tools.join(", ")}</span>
              <span>tokens {trace.tokens}</span>
              <span>{trace.cost}</span>
              <span>{trace.ms}</span>
            </div>
          </li>
        ))}
      </ul>
    </PreviewCard>
  );
}

export default function ObservabilityPage() {
  return (
    <ComingSoon
      href="/observability"
      bullets={[
        "One trace per question — retrieval, tools, tokens, cost, latency",
        "Drill into exactly which chunks grounded any answer",
        "Filter by user, tool or time window",
        "LangSmith deep-links for step-level debugging",
      ]}
      preview={<ObservabilityPreview />}
    />
  );
}
