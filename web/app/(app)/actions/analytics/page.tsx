import type { Metadata } from "next";
import { ComingSoon } from "@/components/patterns/ComingSoon";
import { PreviewCard } from "@/components/patterns/preview";
import { Avatar } from "@/components/ui/Avatar";

export const metadata: Metadata = { title: "Workforce Analytics" };

const WORKLOAD = [
  { name: "Priya N", open: 6, resolved: 11, avg: "1.2 d", pct: 86 },
  { name: "Dev K", open: 4, resolved: 9, avg: "1.6 d", pct: 62 },
  { name: "Sara M", open: 3, resolved: 12, avg: "0.9 d", pct: 48 },
  { name: "Rahul T", open: 2, resolved: 7, avg: "2.1 d", pct: 33 },
];

function WorkforcePreview() {
  return (
    <PreviewCard>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold tracking-wide text-subtle uppercase">
          Open tickets by team member · this week
        </p>
        <span className="font-mono text-xs text-subtle">
          via get_analytics (Company MCP)
        </span>
      </div>
      <ul className="mt-5 space-y-4">
        {WORKLOAD.map((w) => (
          <li key={w.name} className="flex items-center gap-3.5">
            <Avatar name={w.name} size="sm" />
            <div className="w-24 shrink-0">
              <p className="truncate text-sm font-medium text-primary">
                {w.name}
              </p>
              <p className="text-[10px] text-subtle">avg {w.avg}</p>
            </div>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-raised">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${w.pct}%` }}
              />
            </div>
            <p className="w-24 shrink-0 text-right text-xs text-muted">
              {w.open} open · {w.resolved} done
            </p>
          </li>
        ))}
      </ul>
    </PreviewCard>
  );
}

export default function WorkforceAnalyticsPage() {
  return (
    <ComingSoon
      href="/actions/analytics"
      bullets={[
        "“Show me Priya's workload this week” — answered from live data",
        "Pulled from your HR/analytics systems over MCP",
        "Compare load and resolution time across the team",
        "Manager-and-above only, like every external action",
      ]}
      preview={<WorkforcePreview />}
    />
  );
}
