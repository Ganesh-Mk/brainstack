import type { Metadata } from "next";
import { CircleCheck, CircleDot, Lock, Map } from "lucide-react";
import { APP_NAV } from "@/lib/nav";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/patterns/PageHeader";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Roadmap" };

type Phase = {
  name: string;
  summary: string;
  status: "shipped" | "next" | "planned";
  /** hrefs of nav pages this phase unlocks (rendered from the registry). */
  unlocks: string[];
};

const PHASES: Phase[] = [
  {
    name: "Product Phase 1 · The product shell",
    summary:
      "The full BrainStack surface — marketing site, app shell, every feature page, the global design system, and hosting. You're looking at it.",
    status: "shipped",
    unlocks: ["/roadmap"],
  },
  {
    name: "Backend Phase 0 · Multi-tenant foundation",
    summary:
      "Real companies, users and roles — FastAPI, Postgres, JWT auth, tenant isolation.",
    status: "next",
    unlocks: ["/team"],
  },
  {
    name: "Backend Phase 2 · Ingestion pipeline",
    summary:
      "Upload → parse → chunk → embed → index, running async with live progress per document.",
    status: "planned",
    unlocks: ["/knowledge", "/knowledge/add", "/knowledge/ingestion"],
  },
  {
    name: "Backend Phase 3 · Grounded Q&A + streaming",
    summary:
      "The first real answers: retrieval over your documents, token-by-token streaming, clickable citations.",
    status: "planned",
    unlocks: ["/ask"],
  },
  {
    name: "Backend Phase 4 · The agent",
    summary:
      "A reasoning agent that decides when to search knowledge, search the web, or answer directly — with a live trace.",
    status: "planned",
    unlocks: ["/agent/trace"],
  },
  {
    name: "Backend Phase 5 · MCP + role-based actions",
    summary:
      "Managers act, not just ask — tickets and workforce analytics through your company's systems over MCP.",
    status: "planned",
    unlocks: ["/connections", "/actions/tickets", "/actions/analytics"],
  },
  {
    name: "Backend Phase 6 · Memory & advanced retrieval",
    summary:
      "Conversation memory, long-term facts, query rewriting, hybrid search and re-ranking.",
    status: "planned",
    unlocks: ["/agent/memory"],
  },
  {
    name: "Backend Phase 7 · Evaluation & observability",
    summary:
      "Proof it works: faithfulness scores, golden-dataset evals, per-request traces, and the live dashboard.",
    status: "planned",
    unlocks: ["/analytics", "/evaluation", "/observability", "/dashboard"],
  },
];

const STATUS_META = {
  shipped: {
    label: "Live",
    badge: "success" as const,
    icon: CircleCheck,
    dot: "bg-success",
  },
  next: {
    label: "Up next",
    badge: "accent" as const,
    icon: CircleDot,
    dot: "bg-accent",
  },
  planned: {
    label: "Planned",
    badge: "neutral" as const,
    icon: Lock,
    dot: "bg-border-strong",
  },
};

export default function RoadmapPage() {
  return (
    <div className="bs-fade-up mx-auto w-full max-w-3xl">
      <PageHeader
        icon={Map}
        title="Roadmap"
        description="BrainStack ships in deliberate stages — every page already exists, and each phase below switches one on. This page is generated from the same registry that drives the sidebar locks."
      />

      <ol className="relative mt-10 space-y-8 border-l border-border pl-8">
        {PHASES.map((phase) => {
          const meta = STATUS_META[phase.status];
          const pages = APP_NAV.filter((item) =>
            phase.unlocks.includes(item.href),
          );
          return (
            <li key={phase.name} className="relative">
              <span
                className={cn(
                  "absolute top-1.5 -left-[38.5px] h-3 w-3 rounded-full ring-4 ring-canvas",
                  meta.dot,
                )}
              />
              <Card className="p-5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-base font-semibold text-primary">
                    {phase.name}
                  </h2>
                  <Badge variant={meta.badge}>
                    <meta.icon className="h-3 w-3" />
                    {meta.label}
                  </Badge>
                </div>
                <p className="mt-1.5 text-sm leading-6 text-muted">
                  {phase.summary}
                </p>
                {pages.length > 0 && (
                  <div className="mt-3.5 flex flex-wrap gap-2">
                    {pages.map((page) => (
                      <Badge key={page.href} variant="neutral">
                        <page.icon className="h-3 w-3" />
                        {page.label}
                      </Badge>
                    ))}
                  </div>
                )}
              </Card>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
