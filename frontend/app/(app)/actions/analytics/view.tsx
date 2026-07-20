"use client";

import { useCallback } from "react";
import { ChartColumn, RefreshCw } from "lucide-react";
import { api, type ApiWorkforceRow } from "@/lib/api";
import { DEMO_WORKFORCE, useCompanyResource } from "@/hooks/useCompany";
import { useMounted } from "@/hooks/useMounted";
import { ManagersOnly } from "@/components/patterns/ManagersOnly";
import { PageHeader } from "@/components/patterns/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

export function WorkforceView() {
  const mounted = useMounted();
  const fetcher = useCallback(
    (token: string) => api.companyAnalytics(token).then((r) => r.analytics),
    [],
  );
  const { data, error, loading, demo, allowed, refresh, refreshing } =
    useCompanyResource<ApiWorkforceRow[]>(fetcher, DEMO_WORKFORCE);

  if (!mounted)
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );

  const rows = data ?? [];
  const maxActive = Math.max(1, ...rows.map((r) => r.open + r.in_progress));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        icon={ChartColumn}
        title="Workforce Analytics"
        description="Team workload and resolution metrics, pulled live from the company systems via get_analytics."
        badge={demo ? <Badge variant="neutral">Sample data</Badge> : undefined}
        actions={
          allowed && !demo ? (
            <Button variant="outline" size="sm" onClick={() => void refresh()}>
              <RefreshCw
                className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"}
              />
              Refresh
            </Button>
          ) : undefined
        }
      />

      {!allowed ? (
        <ManagersOnly what="Workforce data" />
      ) : loading ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : error ? (
        <Card className="bg-canvas text-sm text-muted">{error}</Card>
      ) : (
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold tracking-wide text-subtle uppercase">
              Active tickets by team member
            </p>
            <span className="font-mono text-xs text-subtle">
              via get_analytics (Company MCP)
            </span>
          </div>
          <ul className="mt-5 space-y-5">
            {rows.map((w) => {
              const active = w.open + w.in_progress;
              return (
                <li key={w.name} className="flex items-center gap-3.5">
                  <Avatar name={w.name} size="sm" />
                  <div className="w-36 shrink-0">
                    <p className="truncate text-sm font-medium text-primary">
                      {w.name}
                    </p>
                    <p className="truncate text-[10px] text-subtle">
                      {w.title} · avg {w.avg_resolution_hours}h
                    </p>
                  </div>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-raised">
                    <div
                      className="h-full rounded-full bg-accent transition-[width] duration-500"
                      style={{ width: `${(active / maxActive) * 100}%` }}
                    />
                  </div>
                  <p className="w-32 shrink-0 text-right text-xs text-muted">
                    {active} active · {w.closed_this_month} closed
                  </p>
                </li>
              );
            })}
          </ul>
          <p className="mt-5 text-xs leading-5 text-subtle">
            Ask in chat: <span className="text-muted">“Show me Priya&apos;s workload”</span> —
            the agent reads the same numbers over MCP.
          </p>
        </Card>
      )}
    </div>
  );
}
