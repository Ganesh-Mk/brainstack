import type { Metadata } from "next";
import { ComingSoon } from "@/components/patterns/ComingSoon";
import { Ph, PreviewCard } from "@/components/patterns/preview";

export const metadata: Metadata = { title: "Analytics" };

const KPIS = [
  { label: "Cost / day", value: "$4.87" },
  { label: "p50 latency", value: "2.1 s" },
  { label: "p95 latency", value: "6.8 s" },
  { label: "Tokens today", value: "412k" },
];

const BARS = [42, 58, 40, 66, 61, 78, 70, 88, 76, 95, 82, 100];

function AnalyticsPreview() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-4">
        {KPIS.map((kpi) => (
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
      <div className="grid gap-4 lg:grid-cols-2">
        <PreviewCard>
          <p className="text-xs font-semibold tracking-wide text-subtle uppercase">
            Faithfulness over time
          </p>
          <div className="mt-5 flex h-32 items-end gap-1.5">
            {BARS.map((h, i) => (
              <div
                key={i}
                style={{ height: `${h}%` }}
                className="flex-1 rounded-t bg-accent-200"
              />
            ))}
          </div>
        </PreviewCard>
        <PreviewCard>
          <p className="text-xs font-semibold tracking-wide text-subtle uppercase">
            Tool usage
          </p>
          <ul className="mt-4 space-y-3">
            {[
              { name: "search_knowledge", pct: 78 },
              { name: "web_search", pct: 34 },
              { name: "assign_ticket (MCP)", pct: 12 },
              { name: "get_analytics (MCP)", pct: 9 },
            ].map((tool) => (
              <li key={tool.name} className="flex items-center gap-3">
                <p className="w-40 shrink-0 truncate font-mono text-xs text-primary">
                  {tool.name}
                </p>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-raised">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${tool.pct}%` }}
                  />
                </div>
                <span className="w-8 text-right text-xs text-muted">
                  {tool.pct}%
                </span>
              </li>
            ))}
          </ul>
          <Ph className="mt-4 h-10 w-full" />
        </PreviewCard>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <ComingSoon
      href="/analytics"
      bullets={[
        "Cost per day, per model, per tenant — no surprises",
        "Latency percentiles (p50 / p95) across every request",
        "Faithfulness and retrieval-quality trends over time",
        "Which tools the agent actually uses, and how often",
        "Top questions your team asks — a window into what they need",
      ]}
      preview={<AnalyticsPreview />}
    />
  );
}
