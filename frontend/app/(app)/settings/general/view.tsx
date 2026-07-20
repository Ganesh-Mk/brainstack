"use client";

import { useEffect, useState } from "react";
import { api, ApiError, isBackendConfigured } from "@/lib/api";
import { useMounted } from "@/hooks/useMounted";
import { AdminsOnly } from "@/components/patterns/ManagersOnly";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Hint, Input, Label } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSessionStore } from "@/stores/session";
import { toast } from "@/stores/toast";

export function GeneralSettingsView() {
  const mounted = useMounted();
  const demo = !isBackendConfigured;
  const token = useSessionStore((s) => s.token);
  const role = useSessionStore((s) => s.role);
  const tenant = useSessionStore((s) => s.tenant);
  const hydrate = useSessionStore((s) => s.hydrate);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(tenant.name);
  }, [tenant.name]);

  if (!mounted) return <Skeleton className="h-48 w-full rounded-2xl" />;
  if (role !== "admin") return <AdminsOnly what="Workspace configuration" />;

  const save = async () => {
    if (demo || !token) {
      toast("Demo mode", "Renaming works once your workspace is live.");
      return;
    }
    setSaving(true);
    try {
      await api.renameTenant(token, name.trim());
      await hydrate(); // refresh the session's tenant everywhere
      toast("Saved", "Workspace renamed.");
    } catch (e) {
      toast("Couldn't save", e instanceof ApiError ? e.message : "Try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div>
          <Label htmlFor="ws-name">Workspace name</Label>
          <Input
            id="ws-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
          />
          <Hint>Shown across the product and on invites.</Hint>
        </div>
        <div>
          <Label>Workspace slug</Label>
          <Input value={tenant.slug} readOnly className="font-mono text-xs" />
          <Hint>Fixed at signup — identifies the workspace internally.</Hint>
        </div>
        <Button
          onClick={() => void save()}
          disabled={saving || name.trim().length < 2 || name.trim() === tenant.name}
        >
          Save changes
        </Button>
      </Card>
    </div>
  );
}
