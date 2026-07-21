"use client";

import { useCallback } from "react";
import { Terminal } from "lucide-react";
import {
  api,
  DEFAULT_ANALYTICS_FILTERS,
  type AnalyticsFilters,
  type ApiApiStats,
} from "@/lib/api";
import { DEMO_API_STATS, useStatsResource } from "@/hooks/useStats";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

const usd = (n: number) => `$${n.toFixed(n < 1 ? 4 : 2)}`;

const STATUS_TONE: Record<string, string> = {
  "2xx": "bg-success",
  "4xx": "bg-warning",
  "5xx": "bg-danger",
};

/**
 * The Analytics page's "Programmatic access" section (Phase 11f).
 *
 * Request counts come from api_requests, spend from query_traces. The two
 * ledgers are joined, never summed twice — which is why the app/API split
 * below always adds up to the workspace total shown above it.
 */
export function ApiUsageSection({
  filters = DEFAULT_ANALYTICS_FILTERS,
}: {
  filters?: AnalyticsFilters;
}) {
  const fetcher = useCallback(
    (token: string) => api.statsApi(token, filters),
    [filters],
  );
  const { data, error, loading, demo } = useStatsResource<ApiApiStats>(
    fetcher,
    DEMO_API_STATS,
    true,
  );

  if (loading) return <Skeleton className="h-56 w-full rounded-2xl" />;
  if (error) return null; // the page above already surfaced the failure

  const s = data ?? DEMO_API_STATS;
  const totalQuestions =
    s.channel_split.app_questions + s.channel_split.api_questions;
  const apiShare = totalQuestions
    ? Math.round((s.channel_split.api_questions / totalQuestions) * 100)
    : 0;
  const maxReq = Math.max(1, ...s.per_day.map((d) => d.requests));
  const statuses = Object.entries(s.status_breakdown).sort();

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-subtle uppercase">
          <Terminal className="h-3.5 w-3.5" /> Programmatic access
        </p>
        {demo && <Badge variant="neutral">Sample data</Badge>}
      </div>

      {s.totals.requests === 0 ? (
        <p className="mt-4 text-sm text-muted">
          No API calls in the last {s.window_days} days
          {!s.include_test && " (excluding test keys)"}. Create a key in
          Settings → API keys to call this workspace from your own systems.
        </p>
      ) : (
        <div className="mt-5 space-y-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="API calls" value={s.totals.requests.toLocaleString()} />
            <Stat
              label="Errors"
              value={s.totals.errors.toLocaleString()}
              tone={s.totals.errors ? "danger" : undefined}
            />
            <Stat
              label="Questions via API"
              value={`${s.channel_split.api_questions} · ${apiShare}%`}
            />
            <Stat label="API spend" value={usd(s.channel_split.api_cost_usd)} />
          </div>

          {/* app vs API, as one bar — the split, not two competing totals */}
          <div>
            <p className="mb-1.5 text-xs text-subtle">
              Questions: {s.channel_split.app_questions} in the app ·{" "}
              {s.channel_split.api_questions} over the API
            </p>
            <div className="flex h-2 overflow-hidden rounded-full bg-surface-raised">
              <div
                className="bg-accent"
                style={{ width: `${100 - apiShare}%` }}
                title={`App: ${s.channel_split.app_questions} · ${usd(s.channel_split.app_cost_usd)}`}
              />
              <div
                className="bg-info"
                style={{ width: `${apiShare}%` }}
                title={`API: ${s.channel_split.api_questions} · ${usd(s.channel_split.api_cost_usd)}`}
              />
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold tracking-wide text-subtle uppercase">
                Calls per day
              </p>
              <div className="flex h-20 items-end gap-1">
                {s.per_day.map((d) => (
                  <div
                    key={d.date}
                    className="flex h-full flex-1 flex-col justify-end gap-px"
                    title={`${d.date}: ${d.requests} calls, ${d.errors} errors`}
                  >
                    {d.errors > 0 && (
                      <div
                        className="w-full rounded-t-sm bg-danger/60"
                        style={{ height: `${(d.errors / maxReq) * 100}%` }}
                      />
                    )}
                    <div
                      className="w-full rounded-t-sm bg-accent"
                      style={{
                        height: `${Math.max(((d.requests - d.errors) / maxReq) * 100, 3)}%`,
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold tracking-wide text-subtle uppercase">
                Top endpoints
              </p>
              <ul className="space-y-1.5">
                {s.endpoints.slice(0, 5).map((e) => (
                  <li
                    key={e.route}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="truncate font-mono text-muted">
                      {e.route}
                    </span>
                    <span className="shrink-0 text-subtle">
                      {e.requests.toLocaleString()}
                      {e.errors > 0 && (
                        <span className="text-danger"> · {e.errors} err</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold tracking-wide text-subtle uppercase">
                Responses
              </p>
              <div className="flex flex-wrap gap-3">
                {statuses.map(([bucket, count]) => (
                  <span
                    key={bucket}
                    className="flex items-center gap-1.5 text-xs text-muted"
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${STATUS_TONE[bucket] ?? "bg-surface-raised"}`}
                    />
                    {bucket} · {count.toLocaleString()}
                  </span>
                ))}
              </div>
            </div>

            {s.by_key.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold tracking-wide text-subtle uppercase">
                  By key
                </p>
                <ul className="space-y-1.5">
                  {s.by_key.map((k) => (
                    <li
                      key={k.id}
                      className="flex items-center justify-between gap-3 text-xs"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-muted">{k.name}</span>
                        <Badge
                          variant={k.environment === "live" ? "accent" : "neutral"}
                        >
                          {k.environment}
                        </Badge>
                      </span>
                      <span className="shrink-0 text-subtle">
                        {k.requests.toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "danger";
}) {
  return (
    <div>
      <p className="text-xs text-subtle">{label}</p>
      <p
        className={
          tone === "danger"
            ? "text-lg font-semibold text-danger"
            : "text-lg font-semibold text-primary"
        }
      >
        {value}
      </p>
    </div>
  );
}
