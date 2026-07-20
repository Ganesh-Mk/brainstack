import type { Metadata } from "next";
import {
  Clock,
  DollarSign,
  FileText,
  LayoutDashboard,
  Map,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { KpiTile } from "@/components/ui/KpiTile";
import { DocsIndexedTile } from "@/components/knowledge/DocsIndexedTile";
import { LockBadge } from "@/components/patterns/LockBadge";
import { PageHeader } from "@/components/patterns/PageHeader";

export const metadata: Metadata = { title: "Dashboard" };

/** Decorative bars for the sample chart strip. Static, dimmed, aria-hidden. */
const CHART_BARS = [34, 48, 42, 61, 55, 72, 66, 81, 74, 92, 85, 100];

const ACTIVITY = [
  {
    icon: MessageSquare,
    text: "“What changed in the Q3 refund policy?” — answered with 4 citations",
    time: "2m ago",
  },
  {
    icon: FileText,
    text: "policies-2026.pdf finished indexing (312 chunks)",
    time: "18m ago",
  },
  {
    icon: Sparkles,
    text: "Agent used Knowledge + Web search for a competitor comparison",
    time: "1h ago",
  },
  {
    icon: ShieldCheck,
    text: "Faithfulness eval ran on 24 answers — avg 0.91",
    time: "3h ago",
  },
  {
    icon: Upload,
    text: "onboarding-handbook.docx added to the Library",
    time: "5h ago",
  },
];

const QUICK_ACTIONS = [
  {
    href: "/ask",
    icon: MessageSquare,
    title: "Ask BrainStack",
    description: "Grounded, cited answers from your knowledge.",
    locked: true,
  },
  {
    href: "/knowledge/add",
    icon: Upload,
    title: "Add sources",
    description: "Upload PDFs, docs, or paste URLs.",
    locked: true,
  },
  {
    href: "/roadmap",
    icon: Map,
    title: "See the roadmap",
    description: "What's live and what unlocks next.",
    locked: false,
  },
];

export default function DashboardPage() {
  return (
    <div className="bs-fade-up mx-auto w-full max-w-6xl space-y-6">
      <PageHeader
        icon={LayoutDashboard}
        title="Dashboard"
        description="Your workspace at a glance. The numbers below are sample data — live metrics arrive with the analytics backend."
        badge={
          <span className="flex items-center gap-2">
            <LockBadge />
            <Badge variant="neutral">Sample data</Badge>
          </span>
        }
      />

      <Badge variant="accent">
        <Clock className="h-3 w-3" />
        Live data unlocks in: Backend Phase 7 · Evaluation &amp; observability
      </Badge>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          label="Questions asked"
          value="1,284"
          delta="+12% this week"
          deltaTone="up"
          icon={MessageSquare}
        />
        <DocsIndexedTile />
        <KpiTile
          label="Avg faithfulness"
          value="0.91"
          delta="▲ 0.03 vs last week"
          deltaTone="up"
          icon={ShieldCheck}
        />
        <KpiTile
          label="Spend today"
          value="$3.42"
          delta="−18% vs yesterday"
          deltaTone="up"
          icon={DollarSign}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Sample chart strip */}
        <Card className="lg:col-span-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold tracking-wide text-subtle uppercase">
              Questions per day
            </p>
            <span className="flex items-center gap-1 text-xs font-medium text-success">
              <TrendingUp className="h-3.5 w-3.5" />
              trending up
            </span>
          </div>
          <div
            aria-hidden="true"
            className="mt-6 flex h-40 items-end gap-2 opacity-80"
          >
            {CHART_BARS.map((h, i) => (
              <div
                key={i}
                style={{ height: `${h}%` }}
                className={
                  i === CHART_BARS.length - 1
                    ? "flex-1 rounded-t-md bg-accent"
                    : "flex-1 rounded-t-md bg-accent-200"
                }
              />
            ))}
          </div>
          <p className="mt-3 text-xs text-subtle">
            Last 12 days · sample data
          </p>
        </Card>

        {/* Recent activity */}
        <Card className="lg:col-span-2">
          <p className="text-xs font-semibold tracking-wide text-subtle uppercase">
            Recent activity
          </p>
          <ul className="mt-4 space-y-3.5">
            {ACTIVITY.map((item) => (
              <li key={item.text} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  <item.icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm text-primary">{item.text}</p>
                  <p className="text-xs text-subtle">{item.time}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="grid gap-4 sm:grid-cols-3">
        {QUICK_ACTIONS.map((action) => (
          <Link key={action.href} href={action.href} className="group">
            <Card interactive className="h-full p-5">
              <div className="flex items-start justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-on-primary">
                  <action.icon className="h-4.5 w-4.5" />
                </span>
                {action.locked && <LockBadge compact />}
              </div>
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
