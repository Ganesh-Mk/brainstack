import type { Metadata } from "next";
import {
  ChartColumn,
  CircleCheck,
  List,
  Server,
  ShieldCheck,
  Ticket,
} from "lucide-react";
import { ComingSoon } from "@/components/patterns/ComingSoon";
import { PreviewCard } from "@/components/patterns/preview";
import { Badge } from "@/components/ui/Badge";

export const metadata: Metadata = { title: "Connections" };

const DISCOVERED_TOOLS = [
  {
    icon: Ticket,
    name: "assign_ticket",
    sig: "(ticket_id, assignee)",
    desc: "Assign a ticket to a team member",
  },
  {
    icon: List,
    name: "list_tickets",
    sig: "(assignee?)",
    desc: "List open tickets, optionally by assignee",
  },
  {
    icon: ChartColumn,
    name: "get_analytics",
    sig: "(employee, range)",
    desc: "Workload and resolution metrics",
  },
];

function ConnectionsPreview() {
  return (
    <div className="space-y-4">
      <PreviewCard className="border-success/30">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3.5">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-on-primary">
              <Server className="h-5 w-5" />
            </span>
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-primary">
                Company MCP Server
                <Badge variant="success">
                  <CircleCheck className="h-3 w-3" /> Connected
                </Badge>
              </p>
              <p className="mt-0.5 font-mono text-xs text-muted">
                https://mcp.acme.example · streamable-http
              </p>
            </div>
          </div>
          <Badge variant="accent">
            <ShieldCheck className="h-3 w-3" />
            Your role connects to this system
          </Badge>
        </div>
        <p className="mt-4 text-xs font-semibold tracking-wide text-subtle uppercase">
          Discovered tools
        </p>
        <ul className="mt-2.5 grid gap-2.5 sm:grid-cols-3">
          {DISCOVERED_TOOLS.map((tool) => (
            <li
              key={tool.name}
              className="rounded-xl border border-border bg-canvas p-3"
            >
              <p className="flex items-center gap-1.5 font-mono text-xs font-semibold text-primary">
                <tool.icon className="h-3.5 w-3.5 text-accent" />
                {tool.name}
                <span className="font-normal text-subtle">{tool.sig}</span>
              </p>
              <p className="mt-1 text-xs leading-5 text-muted">{tool.desc}</p>
            </li>
          ))}
        </ul>
      </PreviewCard>
      <PreviewCard className="bg-canvas">
        <p className="text-xs leading-6 text-muted">
          <span className="font-semibold text-primary">
            How role gating works:
          </span>{" "}
          an employee&apos;s session never connects to this server — the action
          tools simply don&apos;t exist for them. Not blocked by a prompt;
          absent by construction.
        </p>
      </PreviewCard>
    </div>
  );
}

export default function ConnectionsPage() {
  return (
    <ComingSoon
      href="/connections"
      bullets={[
        "One card per connected company system, speaking MCP",
        "Tools discovered automatically — no custom integration code",
        "Connection status, transport and last-seen at a glance",
        "Role-gated: employees never even discover the action tools",
        "Swap Jira for Linear by changing one URL — the agent never changes",
      ]}
      preview={<ConnectionsPreview />}
    />
  );
}
