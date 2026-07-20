"use client";

import { useMounted } from "@/hooks/useMounted";
import { AdminsOnly } from "@/components/patterns/ManagersOnly";
import { MembersManager } from "@/components/settings/MembersManager";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSessionStore } from "@/stores/session";

export function MembersSettingsView() {
  const mounted = useMounted();
  const role = useSessionStore((s) => s.role);
  if (!mounted) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (role !== "admin") return <AdminsOnly what="Member management" />;
  return <MembersManager />;
}
