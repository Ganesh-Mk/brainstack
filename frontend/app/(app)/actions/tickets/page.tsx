import type { Metadata } from "next";
import { MessageSquare } from "lucide-react";
import { ComingSoon } from "@/components/patterns/ComingSoon";
import { PreviewCard } from "@/components/patterns/preview";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";

export const metadata: Metadata = { title: "Tickets" };

const TICKETS = [
  {
    id: "TCK-142",
    title: "Login page throws 500 on SSO",
    assignee: "Priya N",
    priority: "High",
    status: "In progress",
  },
  {
    id: "TCK-139",
    title: "Refund flow stuck at confirmation",
    assignee: "Dev K",
    priority: "High",
    status: "Open",
  },
  {
    id: "TCK-136",
    title: "Dashboard charts blank on Safari",
    assignee: "Priya N",
    priority: "Medium",
    status: "Open",
  },
  {
    id: "TCK-131",
    title: "Update onboarding email copy",
    assignee: "Sara M",
    priority: "Low",
    status: "Done",
  },
];

function TicketsPreview() {
  return (
    <div className="space-y-4">
      <PreviewCard className="flex items-center gap-3 border-accent-200 bg-accent-soft/50">
        <MessageSquare className="h-4 w-4 shrink-0 text-accent" />
        <p className="text-xs leading-5 text-primary">
          <span className="font-semibold">Manager, in chat:</span> “Assign the
          login-bug ticket to Priya” → the agent calls{" "}
          <code className="rounded bg-surface px-1 font-mono text-[11px]">
            assign_ticket
          </code>{" "}
          on your Company MCP Server. This page shows the result.
        </p>
      </PreviewCard>
      <PreviewCard className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-canvas">
            <tr>
              {["Ticket", "Assignee", "Priority", "Status"].map((h) => (
                <th
                  key={h}
                  className="px-5 py-2.5 text-left text-[10px] font-semibold tracking-wide text-muted uppercase"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TICKETS.map((t) => (
              <tr key={t.id} className="border-b border-border last:border-0">
                <td className="px-5 py-3">
                  <p className="font-mono text-xs text-subtle">{t.id}</p>
                  <p className="font-medium text-primary">{t.title}</p>
                </td>
                <td className="px-5 py-3">
                  <span className="flex items-center gap-2 text-muted">
                    <Avatar name={t.assignee} size="sm" />
                    {t.assignee}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <Badge
                    variant={
                      t.priority === "High"
                        ? "danger"
                        : t.priority === "Medium"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {t.priority}
                  </Badge>
                </td>
                <td className="px-5 py-3">
                  <Badge
                    variant={
                      t.status === "Done"
                        ? "success"
                        : t.status === "In progress"
                          ? "accent"
                          : "neutral"
                    }
                  >
                    {t.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </PreviewCard>
    </div>
  );
}

export default function TicketsPage() {
  return (
    <ComingSoon
      href="/actions/tickets"
      bullets={[
        "Assign, reassign and track tickets from plain conversation",
        "Backed by YOUR ticketing system through the Company MCP Server",
        "Manager-and-above only — enforced at connection time",
        "Every action logged in the agent trace with its result",
      ]}
      preview={<TicketsPreview />}
    />
  );
}
