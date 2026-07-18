import type { Metadata } from "next";
import {
  Brain,
  Cable,
  CircleCheck,
  Globe,
  PenLine,
  Search,
} from "lucide-react";
import { ComingSoon } from "@/components/patterns/ComingSoon";
import { PreviewCard } from "@/components/patterns/preview";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Agent Trace" };

const TRACE = [
  {
    icon: Brain,
    label: "Planning",
    detail: "Needs internal docs + an external action",
    ms: "410 ms",
    kind: "node",
  },
  {
    icon: Search,
    label: "search_knowledge (native)",
    detail: "5 chunks from policies-2026.pdf · similarity 0.89",
    ms: "820 ms",
    kind: "tool",
  },
  {
    icon: Globe,
    label: "web_search (native)",
    detail: "3 results · competitor refund pages",
    ms: "1.2 s",
    kind: "tool",
  },
  {
    icon: Cable,
    label: "assign_ticket (Company MCP)",
    detail: 'ticket="login-bug" → assignee="Priya"',
    ms: "640 ms",
    kind: "mcp",
  },
  {
    icon: PenLine,
    label: "Synthesize + cite",
    detail: "Grounded answer, 4 citations",
    ms: "2.1 s",
    kind: "node",
  },
];

function TracePreview() {
  return (
    <PreviewCard>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold tracking-wide text-subtle uppercase">
          Trace · “Assign login-bug to Priya and summarize the refund policy”
        </p>
        <span className="font-mono text-xs text-subtle">total 5.2 s · $0.027</span>
      </div>
      <ol className="relative mt-5 space-y-4 border-l border-border pl-6">
        {TRACE.map((step) => (
          <li key={step.label} className="relative">
            <span
              className={cn(
                "absolute top-0.5 -left-[30px] flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-surface",
                step.kind === "mcp"
                  ? "bg-accent text-on-accent"
                  : "bg-surface-raised text-muted",
              )}
            >
              <step.icon className="h-3 w-3" />
            </span>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <p className="text-sm font-medium text-primary">{step.label}</p>
              <span className="font-mono text-[10px] text-subtle">
                {step.ms}
              </span>
              <CircleCheck className="h-3.5 w-3.5 text-success" />
            </div>
            <p className="mt-0.5 font-mono text-xs text-muted">{step.detail}</p>
          </li>
        ))}
      </ol>
    </PreviewCard>
  );
}

export default function AgentTracePage() {
  return (
    <ComingSoon
      href="/agent/trace"
      bullets={[
        "Every reasoning step, streamed live as it happens",
        "See which tools ran — native knowledge/web vs Company MCP",
        "Latency and cost per step, totaled per question",
        "Exactly which chunks were retrieved, and why",
        "Reflection attempts made visible — watch it self-correct",
      ]}
      preview={<TracePreview />}
    />
  );
}
