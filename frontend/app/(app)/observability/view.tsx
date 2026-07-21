"use client";

import { useCallback } from "react";
import { Activity, RefreshCw } from "lucide-react";
import { api, type ApiQueryTrace } from "@/lib/api";
import { timeAgo } from "@/lib/time";
import { DEMO_TRACES, useStatsResource } from "@/hooks/useStats";
import { useMounted } from "@/hooks/useMounted";
import { AdminsOnly } from "@/components/patterns/ManagersOnly";
import { EmptyState } from "@/components/patterns/EmptyState";
import { PageHeader } from "@/components/patterns/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Table, TD, TH, THead, TR } from "@/components/ui/Table";

const fmtMs = (ms: number | null) =>
  ms === null ? "—" : ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;

export function ObservabilityView() {
  const mounted = useMounted();
  const fetcher = useCallback(
    (token: string) => api.statsTraces(token).then((r) => r.traces),
    [],
  );
  const { data, error, loading, demo, allowed, refresh, refreshing } =
    useStatsResource<ApiQueryTrace[]>(fetcher, DEMO_TRACES, true);

  if (!mounted)
    return (
      <div className="w-full max-w-6xl space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );

  const rows = data ?? [];

  return (
    <div className="bs-fade-up w-full max-w-6xl space-y-6">
      <PageHeader
        icon={Activity}
        title="Observability"
        description="One row per question — what was retrieved, which tools ran, how long it took and what it cost."
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
        <AdminsOnly what="Per-request tracing" />
      ) : loading ? (
        <Skeleton className="h-72 w-full rounded-2xl" />
      ) : error ? (
        <Card className="bg-canvas text-sm text-muted">{error}</Card>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No traces yet"
          description="Ask a question and its full trace — tools, latency, tokens, cost — lands here."
        />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Question</TH>
              <TH>Tools</TH>
              <TH className="text-right">Sources</TH>
              <TH className="text-right">First token</TH>
              <TH className="text-right">Total</TH>
              <TH className="text-right">Tokens</TH>
              <TH className="text-right">Cost</TH>
              <TH className="text-right">When</TH>
            </tr>
          </THead>
          <tbody>
            {rows.map((t) => (
              <TR key={t.id}>
                <TD className="max-w-72">
                  <p className="truncate font-medium text-primary">
                    {t.question}
                  </p>
                  {t.status === "error" && (
                    <Badge variant="danger" className="mt-1">
                      failed
                    </Badge>
                  )}
                </TD>
                <TD>
                  <span className="flex flex-wrap gap-1">
                    {t.tool_kinds
                      .filter((k) => k !== "planning" && k !== "drafting")
                      .map((k) => (
                        <Badge
                          key={k}
                          variant={
                            k === "action"
                              ? "warning"
                              : k === "reflection"
                                ? "warning"
                                : "accent"
                          }
                        >
                          {k}
                        </Badge>
                      ))}
                    {t.tool_kinds.filter((k) => k !== "planning" && k !== "drafting")
                      .length === 0 && (
                      <span className="text-xs text-subtle">direct</span>
                    )}
                  </span>
                </TD>
                <TD className="text-right text-muted">{t.source_count}</TD>
                <TD className="text-right font-mono text-xs text-muted">
                  {fmtMs(t.first_token_ms)}
                </TD>
                <TD className="text-right font-mono text-xs text-muted">
                  {fmtMs(t.latency_ms)}
                </TD>
                <TD className="text-right font-mono text-xs text-muted">
                  {t.input_tokens != null
                    ? `${((t.input_tokens + (t.output_tokens ?? 0)) / 1000).toFixed(1)}k`
                    : "—"}
                </TD>
                <TD className="text-right font-mono text-xs text-muted">
                  {t.cost_usd != null ? `$${t.cost_usd.toFixed(4)}` : "—"}
                </TD>
                <TD className="text-right text-xs whitespace-nowrap text-subtle">
                  {t.created_at ? timeAgo(t.created_at) : "—"}
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
