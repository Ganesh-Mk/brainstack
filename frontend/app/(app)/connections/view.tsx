"use client";

import { useCallback } from "react";
import {
  Cable,
  ChartColumn,
  CircleCheck,
  CircleOff,
  List,
  RefreshCw,
  Server,
  ShieldCheck,
  Ticket,
  type LucideIcon,
} from "lucide-react";
import { api, type ApiConnections } from "@/lib/api";
import { DEMO_CONNECTIONS, useCompanyResource } from "@/hooks/useCompany";
import { useMounted } from "@/hooks/useMounted";
import { PageHeader } from "@/components/patterns/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

const TOOL_ICONS: Record<string, LucideIcon> = {
  assign_ticket: Ticket,
  list_tickets: List,
  get_analytics: ChartColumn,
};

export function ConnectionsView() {
  const mounted = useMounted();
  const fetcher = useCallback((token: string) => api.connections(token), []);
  const { data, error, loading, demo, role, allowed, refresh, refreshing } =
    useCompanyResource<ApiConnections>(fetcher, DEMO_CONNECTIONS);

  if (!mounted) return <ConnectionsSkeleton />;

  // The employee view IS the feature: this session has no connection.
  const conn = allowed ? data : null;
  const connected = Boolean(conn?.connected);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        icon={Cable}
        title="Connections"
        description="Company systems your agent can reach over MCP — discovered live, gated by role."
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

      {loading ? (
        <ConnectionsSkeleton />
      ) : (
        <>
          <Card className={connected ? "border-success/30" : undefined}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3.5">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-on-primary">
                  <Server className="h-5 w-5" />
                </span>
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold text-primary">
                    Company MCP Server
                    {connected ? (
                      <Badge variant="success">
                        <CircleCheck className="h-3 w-3" /> Connected
                      </Badge>
                    ) : (
                      <Badge variant="neutral">
                        <CircleOff className="h-3 w-3" />
                        {allowed ? "Not connected" : "No connection"}
                      </Badge>
                    )}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-muted">
                    ticketing + workforce · streamable-http
                  </p>
                </div>
              </div>
              <Badge variant={allowed ? "accent" : "neutral"}>
                <ShieldCheck className="h-3 w-3" />
                {allowed
                  ? "Your role connects to this system"
                  : `Not available to the ${role} role`}
              </Badge>
            </div>

            {allowed && (
              <>
                <p className="mt-4 text-xs font-semibold tracking-wide text-subtle uppercase">
                  Discovered tools
                </p>
                {connected && conn ? (
                  <ul className="mt-2.5 grid gap-2.5 sm:grid-cols-3">
                    {conn.tools.map((tool) => {
                      const Icon = TOOL_ICONS[tool.name] ?? Ticket;
                      return (
                        <li
                          key={tool.name}
                          className="rounded-xl border border-border bg-canvas p-3"
                        >
                          <p className="flex items-center gap-1.5 font-mono text-xs font-semibold text-primary">
                            <Icon className="h-3.5 w-3.5 text-accent" />
                            {tool.name}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-muted">
                            {tool.description}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-2.5 rounded-xl border border-dashed border-border-strong bg-canvas p-4 text-xs leading-5 text-muted">
                    {error ??
                      (conn && !conn.configured
                        ? "No Company MCP Server is configured for this deployment."
                        : "The company system didn't answer discovery — it may be waking up. Try refresh in a few seconds.")}
                  </p>
                )}
              </>
            )}
          </Card>

          <Card className="bg-canvas">
            <p className="text-xs leading-6 text-muted">
              <span className="font-semibold text-primary">
                How role gating works:
              </span>{" "}
              when a manager or admin asks a question, their agent session
              discovers these tools over MCP and can act with them. An
              employee&apos;s session never connects to this server — the
              action tools simply don&apos;t exist for them. Not blocked by a
              prompt; absent by construction.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}

function ConnectionsSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-48 w-full rounded-2xl" />
      <Skeleton className="h-20 w-full rounded-2xl" />
    </div>
  );
}
