"use client";

import { Users } from "lucide-react";
import { isBackendConfigured } from "@/lib/api";
import { useMounted } from "@/hooks/useMounted";
import { AdminsOnly } from "@/components/patterns/ManagersOnly";
import { PageHeader } from "@/components/patterns/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { MembersManager } from "@/components/settings/MembersManager";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSessionStore } from "@/stores/session";

export function TeamView() {
  const mounted = useMounted();
  const role = useSessionStore((s) => s.role);
  const demo = !isBackendConfigured;

  if (!mounted)
    return (
      <div className="max-w-3xl space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        icon={Users}
        title="Team & Roles"
        description="Who can ask, who can act, who administers — invites, roles and removal."
        badge={demo ? <Badge variant="neutral">Sample data</Badge> : undefined}
      />

      {role !== "admin" ? (
        <AdminsOnly what="Member management" />
      ) : (
        <>
          <MembersManager />
          <Card className="bg-canvas">
            <p className="text-xs leading-6 text-muted">
              <span className="font-semibold text-primary">What roles mean:</span>{" "}
              <span className="font-medium">employees</span> ask questions over
              the knowledge base; <span className="font-medium">managers</span>{" "}
              additionally get the company systems connected to their agent
              (tickets, workforce data) — enforced by capability, not by
              prompt; <span className="font-medium">admins</span> also manage
              sources, members and settings.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
