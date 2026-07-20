import { ShieldCheck } from "lucide-react";
import { EmptyState } from "@/components/patterns/EmptyState";

/**
 * What an employee sees on a manager/admin page — and the Phase 7 lesson,
 * stated where it applies: their agent session never connects to the company
 * systems, so the tools behind this page don't exist for them.
 */
export function ManagersOnly({ what }: { what: string }) {
  return (
    <EmptyState
      icon={ShieldCheck}
      title="Managers and admins only"
      description={`${what} comes from the company systems over MCP. An employee's session never connects to them — the tools don't exist there, so there's nothing to show.`}
    />
  );
}

/** Admin-gated insights pages (Analytics / Evaluation / Observability). */
export function AdminsOnly({ what }: { what: string }) {
  return (
    <EmptyState
      icon={ShieldCheck}
      title="Admins only"
      description={`${what} covers the whole workspace — cost, latency and quality across every user — so it's visible to admin accounts only.`}
    />
  );
}
