"use client";

import { useCallback } from "react";
import {
  Brain,
  Clock,
  DollarSign,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Search,
  Upload,
  Workflow,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { api, type ApiDashboardStats } from "@/lib/api";
import { DEMO_DASHBOARD, useStatsResource } from "@/hooks/useStats";
import { useMounted } from "@/hooks/useMounted";
import { PageHeader } from "@/components/patterns/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { KpiTile } from "@/components/ui/KpiTile";
import { Skeleton } from "@/components/ui/Skeleton";

const QUICK_ACTIONS = [
  {
    href: "/ask",
    icon: MessageSquare,
    title: "Ask BrainStack",
    description: "Grounded, cited answers from your knowledge.",
  },
  {
    href: "/knowledge/add",
    icon: Upload,
    title: "Add sources",
    description: "Upload PDFs or paste URLs — and watch them index live.",
  },
  {
    href: "/agent/trace",
    icon: Workflow,
    title: "See the agent think",
    description: "Every answer's plan, tool calls and timing, step by step.",
  },
];

const fmtMs = (ms: number | null) =>
  ms === null ? "—" : ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;

export function DashboardView() {
  const mounted = useMounted();
  const fetcher = useCallback((token: string) => api.statsDashboard(token), []);
  const { data, error, loading, demo } = useStatsResource<ApiDashboardStats>(
    fetcher,
    DEMO_DASHBOARD,
  );

  if (!mounted || loading)
    return (
      <div className="w-full max-w-6xl space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
    );

  const s = data ?? DEMO_DASHBOARD;
  const usage = s.tool_usage;
  const usageTotal = Math.max(
    1,
    usage.knowledge + usage.web + usage.action + usage.reflection,
  );
  const usageRows = [
    { label: "Knowledge search", icon: Search, value: usage.knowledge },
    { label: "Web search", icon: FileText, value: usage.web },
    { label: "Company actions (MCP)", icon: Zap, value: usage.action },
    { label: "Reflection rewrites", icon: Brain, value: usage.reflection },
  ];

  return (
    <div className="bs-fade-up w-full max-w-6xl space-y-6">
      <PageHeader
        icon={LayoutDashboard}
        title="Dashboard"
        description="Your workspace at a glance — live from every question asked and document indexed."
        badge={demo ? <Badge variant="neutral">Sample data</Badge> : undefined}
      />

      {error && <Card className="bg-canvas text-sm text-muted">{error}</Card>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          label="Questions answered"
          value={String(s.questions_asked)}
          delta={`across ${s.conversations} conversations`}
          icon={MessageSquare}
        />
        <KpiTile
          label="Documents indexed"
          value={`${s.documents_ready}/${s.documents}`}
          delta={`${s.chunks.toLocaleString()} chunks searchable`}
          icon={FileText}
        />
        <KpiTile
          label="Avg answer time"
          value={fmtMs(s.avg_latency_ms)}
          delta="question → full answer"
          icon={Clock}
        />
        <KpiTile
          label="Spend · 30 days"
          value={`$${s.cost_usd_30d.toFixed(2)}`}
          delta="model tokens, attributed per question"
          icon={DollarSign}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <p className="text-xs font-semibold tracking-wide text-subtle uppercase">
            How the agent worked
          </p>
          <ul className="mt-5 space-y-4">
            {usageRows.map((row) => (
              <li key={row.label} className="flex items-center gap-3.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  <row.icon className="h-3.5 w-3.5" />
                </span>
                <p className="w-44 shrink-0 text-sm text-primary">{row.label}</p>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-raised">
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-500"
                    style={{ width: `${(row.value / usageTotal) * 100}%` }}
                  />
                </div>
                <p className="w-10 shrink-0 text-right text-xs text-muted">
                  {row.value}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-subtle">
            Counted per answered question, from the persisted agent traces.
          </p>
        </Card>

        <Card className="lg:col-span-2">
          <p className="text-xs font-semibold tracking-wide text-subtle uppercase">
            Memory
          </p>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-primary">
            {s.memories}
          </p>
          <p className="mt-1 text-sm text-muted">
            durable facts remembered across the workspace
          </p>
          <Link
            href="/agent/memory"
            className="mt-4 inline-block text-xs font-medium text-accent hover:underline"
          >
            View your memories →
          </Link>
        </Card>
      </div>

      {(s.recent_questions?.length ?? 0) > 0 && (
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold tracking-wide text-subtle uppercase">
              Recent questions
            </p>
            <Link
              href="/ask"
              className="text-xs font-medium text-accent hover:underline"
            >
              Ask something →
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-border">
            {s.recent_questions.map((q, i) => (
              <li
                key={i}
                className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <span
                  className={
                    q.status === "ok"
                      ? "h-1.5 w-1.5 shrink-0 rounded-full bg-success"
                      : "h-1.5 w-1.5 shrink-0 rounded-full bg-danger"
                  }
                />
                <p className="min-w-0 flex-1 truncate text-sm text-primary">
                  {q.question}
                </p>
                {q.tool_kinds
                  .filter((k) => k !== "planning" && k !== "drafting")
                  .map((k) => (
                    <Badge key={k} variant="neutral" className="hidden sm:inline-flex">
                      {k}
                    </Badge>
                  ))}
                <span className="shrink-0 font-mono text-[11px] text-subtle">
                  {fmtMs(q.latency_ms)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {QUICK_ACTIONS.map((action) => (
          <Link key={action.href} href={action.href} className="group">
            <Card interactive className="h-full p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-on-primary">
                <action.icon className="h-4.5 w-4.5" />
              </span>
              <p className="mt-4 text-sm font-semibold text-primary">
                {action.title}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted">
                {action.description}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
