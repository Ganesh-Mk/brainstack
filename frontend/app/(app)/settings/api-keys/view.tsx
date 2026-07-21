"use client";

import { useMounted } from "@/hooks/useMounted";
import { AdminsOnly } from "@/components/patterns/ManagersOnly";
import { ApiKeysManager } from "@/components/settings/ApiKeysManager";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSessionStore } from "@/stores/session";

export function ApiKeysSettingsView() {
  const mounted = useMounted();
  const role = useSessionStore((s) => s.role);
  if (!mounted) return <Skeleton className="h-64 w-full rounded-2xl" />;
  // Minting a credential that can read the whole corpus is an admin act.
  if (role !== "admin") return <AdminsOnly what="API key management" />;
  return <ApiKeysManager />;
}
