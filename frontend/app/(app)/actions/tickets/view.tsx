"use client";

import { useCallback } from "react";
import { MessageSquare, RefreshCw, Ticket } from "lucide-react";
import Link from "next/link";
import { api, type ApiTicket } from "@/lib/api";
import { timeAgo } from "@/lib/time";
import { DEMO_TICKETS, useCompanyResource } from "@/hooks/useCompany";
import { useMounted } from "@/hooks/useMounted";
import { ManagersOnly } from "@/components/patterns/ManagersOnly";
import { PageHeader } from "@/components/patterns/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Table, TD, TH, THead, TR } from "@/components/ui/Table";

const STATUS_META: Record<
  ApiTicket["status"],
  { label: string; variant: "neutral" | "accent" | "success" }
> = {
  open: { label: "Open", variant: "neutral" },
  in_progress: { label: "In progress", variant: "accent" },
  closed: { label: "Closed", variant: "success" },
};

const PRIORITY_VARIANT: Record<
  ApiTicket["priority"],
  "danger" | "warning" | "neutral"
> = { high: "danger", medium: "warning", low: "neutral" };

export function TicketsView() {
  const mounted = useMounted();
  const fetcher = useCallback(
    (token: string) => api.companyTickets(token).then((r) => r.tickets),
    [],
  );
  const { data, error, loading, demo, allowed, refresh, refreshing } =
    useCompanyResource<ApiTicket[]>(fetcher, DEMO_TICKETS);

  if (!mounted)
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        icon={Ticket}
        title="Tickets"
        description="The company ticketing system, live over MCP — assign from chat, watch the row change here."
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
        <ManagersOnly what="The ticket board" />
      ) : (
        <>
          <Card className="flex items-center gap-3 border-accent-200 bg-accent-soft/50 py-3.5">
            <MessageSquare className="h-4 w-4 shrink-0 text-accent" />
            <p className="text-xs leading-5 text-primary">
              <span className="font-semibold">Try it from chat:</span>{" "}
              <Link href="/ask" className="underline decoration-accent/40 underline-offset-2 hover:decoration-accent">
                ask BrainStack
              </Link>{" "}
              “Assign the login-bug ticket to Priya” — the agent calls{" "}
              <code className="rounded bg-surface px-1 font-mono text-[11px]">
                assign_ticket
              </code>{" "}
              on the Company MCP Server, then refresh this board to see it.
            </p>
          </Card>

          {loading ? (
            <Skeleton className="h-72 w-full rounded-2xl" />
          ) : error ? (
            <Card className="bg-canvas text-sm text-muted">{error}</Card>
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Ticket</TH>
                  <TH>Assignee</TH>
                  <TH>Priority</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Updated</TH>
                </tr>
              </THead>
              <tbody>
                {(data ?? []).map((t) => (
                  <TR key={t.id}>
                    <TD>
                      <p className="font-mono text-xs text-subtle">
                        {t.id} · {t.key}
                      </p>
                      <p className="font-medium text-primary">{t.title}</p>
                    </TD>
                    <TD>
                      {t.assignee ? (
                        <span className="flex items-center gap-2 text-muted">
                          <Avatar name={t.assignee} size="sm" />
                          {t.assignee}
                        </span>
                      ) : (
                        <span className="text-subtle">Unassigned</span>
                      )}
                    </TD>
                    <TD>
                      <Badge variant={PRIORITY_VARIANT[t.priority]}>
                        {t.priority[0].toUpperCase() + t.priority.slice(1)}
                      </Badge>
                    </TD>
                    <TD>
                      <Badge variant={STATUS_META[t.status].variant}>
                        {STATUS_META[t.status].label}
                      </Badge>
                    </TD>
                    <TD className="text-right text-xs whitespace-nowrap text-subtle">
                      {timeAgo(t.updated_at)}
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}

          <p className="text-xs text-subtle">
            This is a demo company system — its data reseeds whenever the
            service restarts.
          </p>
        </>
      )}
    </div>
  );
}
