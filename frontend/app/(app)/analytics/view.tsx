"use client";

import { useCallback } from "react";
import { ChartLine, Clock, DollarSign, MessageSquare, RefreshCw, Zap } from "lucide-react";
import { api, type ApiAnalytics } from "@/lib/api";
import { DEMO_ANALYTICS, useStatsResource } from "@/hooks/useStats";
import { useMounted } from "@/hooks/useMounted";
import { AdminsOnly } from "@/components/patterns/ManagersOnly";
import { PageHeader } from "@/components/patterns/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { KpiTile } from "@/components/ui/KpiTile";
import { Skeleton } from "@/components/ui/Skeleton";

const fmtMs = (ms: number | null) =>
  ms === null ? "—" : ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;

export function AnalyticsView() {
  const mounted = useMounted();
  const fetcher = useCallback((token: string) => api.statsAnalytics(token), []);
  const { data, error, loading, demo, allowed, refresh, refreshing } =
    useStatsResource<ApiAnalytics>(fetcher, DEMO_ANALYTICS, true);

  if (!mounted)
    return (
      <div className="w-full max-w-6xl space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );

  const a = data ?? DEMO_ANALYTICS;

  // The API returns only days that HAVE traffic — pad to a continuous
  // window (anchored on the newest data day, so this stays pure) so one
  // busy day renders as one bar on a real 14-day axis instead of a single
  // full-width block.
  const byDate = new Map(a.per_day.map((d) => [d.date, d]));
  const endMs = a.per_day.length
    ? new Date(`${a.per_day[a.per_day.length - 1].date}T00:00:00Z`).getTime()
    : 0;
  const days = Array.from({ length: a.window_days }, (_, i) => {
    const date = new Date(endMs - (a.window_days - 1 - i) * 86400e3)
      .toISOString()
      .slice(0, 10);
    return (
      byDate.get(date) ?? {
        date,
        questions: 0,
        errors: 0,
        cost_usd: 0,
        avg_latency_ms: null,
      }
    );
  });
  const maxQ = Math.max(1, ...days.map((d) => d.questions + d.errors));

  return (
    <div className="bs-fade-up w-full max-w-6xl space-y-6">
      <PageHeader
        icon={ChartLine}
        title="Analytics"
        description="LLMOps for this workspace — cost, latency percentiles, token usage and what the agent actually did."
        badge={demo ? <Badge variant="neutral">Sample data</Badge> : undefined}
        actions={
          allowed && !demo ? (
            <Button variant="outline" size="sm" onClick={() => void refresh()}>
              <RefreshCw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              Refresh
            </Button>
          ) : undefined
        }
      />

      {!allowed ? (
        <AdminsOnly what="Workspace analytics" />
      ) : loading ? (
        <Skeleton className="h-72 w-full rounded-2xl" />
      ) : error ? (
        <Card className="bg-canvas text-sm text-muted">{error}</Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiTile
              label={`Questions · ${a.window_days}d`}
              value={String(a.totals.questions)}
              delta={a.totals.errors ? `${a.totals.errors} failed` : "no failures"}
              deltaTone={a.totals.errors ? "down" : "up"}
              icon={MessageSquare}
            />
            <KpiTile
              label="Cost"
              value={`$${a.totals.cost_usd.toFixed(2)}`}
              delta={`${(a.totals.input_tokens / 1000).toFixed(0)}k in · ${(a.totals.output_tokens / 1000).toFixed(0)}k out tokens`}
              icon={DollarSign}
            />
            <KpiTile
              label="Answer latency"
              value={fmtMs(a.latency_ms.p50)}
              delta={`p95 ${fmtMs(a.latency_ms.p95)}`}
              icon={Clock}
            />
            <KpiTile
              label="First token"
              value={fmtMs(a.first_token_ms.p50)}
              delta={`p95 ${fmtMs(a.first_token_ms.p95)}`}
              icon={Zap}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <p className="text-xs font-semibold tracking-wide text-subtle uppercase">
                Questions per day
              </p>
              {a.per_day.length === 0 ? (
                <p className="mt-6 text-sm text-muted">
                  No questions in the last {a.window_days} days.
                </p>
              ) : (
                <div className="mt-6">
                  <div className="flex h-36 items-end gap-1.5">
                    {days.map((d) => {
                      const total = d.questions + d.errors;
                      return (
                        <div
                          key={d.date}
                          title={`${d.date}: ${d.questions} questions${d.errors ? `, ${d.errors} errors` : ""} · $${d.cost_usd.toFixed(3)}`}
                          className="flex h-full flex-1 flex-col justify-end gap-px"
                        >
                          {d.errors > 0 && (
                            <div
                              className="mx-auto w-full max-w-8 rounded-t-sm bg-danger/60"
                              style={{ height: `${(d.errors / maxQ) * 100}%` }}
                            />
                          )}
                          {d.questions > 0 && (
                            <div
                              className={
                                d.errors > 0
                                  ? "mx-auto w-full max-w-8 bg-accent"
                                  : "mx-auto w-full max-w-8 rounded-t-sm bg-accent"
                              }
                              style={{
                                height: `${Math.max((d.questions / maxQ) * 100, 3)}%`,
                              }}
                            />
                          )}
                          {total === 0 && (
                            <div className="mx-auto h-1 w-full max-w-8 rounded-t-sm bg-surface-raised" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-1.5 flex gap-1.5 border-t border-border pt-1.5">
                    {days.map((d, i) => (
                      <span
                        key={d.date}
                        className="flex-1 text-center font-mono text-[9px] text-subtle"
                      >
                        {i % 2 === 0 ? d.date.slice(5).replace("-", "/") : ""}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <p className="mt-3 text-xs text-subtle">
                Last {a.window_days} days · hover a bar for cost and errors
              </p>
            </Card>

            <Card className="lg:col-span-2">
              <p className="text-xs font-semibold tracking-wide text-subtle uppercase">
                Top questions
              </p>
              {a.top_questions.length === 0 ? (
                <p className="mt-4 text-sm text-muted">Nothing asked yet.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {a.top_questions.map((q) => (
                    <li key={q.question} className="flex items-start justify-between gap-3">
                      <p className="min-w-0 truncate text-sm text-primary">
                        “{q.question}”
                      </p>
                      <Badge variant="neutral" className="shrink-0">
                        ×{q.count}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
