"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  Building2,
  Check,
  ChevronDown,
  CircleHelp,
  LogOut,
  Menu,
  Palette,
  Plus,
  Search,
  User,
} from "lucide-react";
import { api, ApiError, isBackendConfigured } from "@/lib/api";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import {
  Dropdown,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
} from "@/components/ui/Dropdown";
import { Input, Label } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Tooltip } from "@/components/ui/Tooltip";
import { useMounted } from "@/hooks/useMounted";
import { cn } from "@/lib/cn";
import { ROLES, type Role } from "@/lib/nav";
import { useSessionStore } from "@/stores/session";
import { toast } from "@/stores/toast";
import { useUiStore } from "@/stores/ui";

const ROLE_LABELS: Record<Role, string> = {
  employee: "Employee",
  manager: "Manager",
  admin: "Admin",
};

export function Topbar() {
  const router = useRouter();
  const mounted = useMounted();
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen);
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen);
  const user = useSessionStore((s) => s.user);
  const tenant = useSessionStore((s) => s.tenant);
  const workspaces = useSessionStore((s) => s.workspaces);
  const loginWith = useSessionStore((s) => s.loginWith);
  const loadWorkspaces = useSessionStore((s) => s.loadWorkspaces);
  const token = useSessionStore((s) => s.token);
  const storeRole = useSessionStore((s) => s.role);
  const setRole = useSessionStore((s) => s.setRole);
  const authed = useSessionStore((s) => s.authed);
  const logout = useSessionStore((s) => s.logout);
  const role: Role = mounted ? storeRole : "admin";
  const tenantName = mounted ? tenant.name : "Lovely";

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const signOut = () => {
    logout();
    router.push("/login");
  };

  // Switching mints a fresh workspace-scoped token, then reloads the app so
  // EVERY page refetches inside the new workspace — no stale data anywhere.
  const switchTo = async (tenantId: string) => {
    if (tenantId === tenant.id) return;
    if (!isBackendConfigured || !token) {
      toast("Demo mode", "Workspace switching works on a live account.");
      return;
    }
    try {
      const result = await api.switchWorkspace(token, tenantId);
      loginWith(result);
      window.location.reload();
    } catch (e) {
      toast(
        "Couldn't switch workspace",
        e instanceof ApiError ? e.message : undefined,
        "error",
      );
    }
  };

  const createWorkspace = async () => {
    const name = newName.trim();
    if (name.length < 2 || busy) return;
    if (!isBackendConfigured || !token) {
      toast("Demo mode", "Creating workspaces works on a live account.");
      return;
    }
    setBusy(true);
    try {
      const result = await api.createWorkspace(token, name);
      loginWith(result);
      window.location.reload();
    } catch (e) {
      setBusy(false);
      toast(
        "Couldn't create workspace",
        e instanceof ApiError ? e.message : undefined,
        "error",
      );
    }
  };

  return (
    // relative + z: the workspace/user dropdowns must paint above page
    // content (cards create their own stacking contexts below).
    <header className="relative z-40 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-canvas/80 px-4 backdrop-blur sm:gap-3 sm:px-6">
      <button
        type="button"
        onClick={() => setMobileNavOpen(true)}
        aria-label="Open navigation"
        className="rounded-lg p-2 text-muted transition hover:bg-surface-raised hover:text-primary lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Workspace switcher — real multi-tenancy: every workspace this email
          belongs to, plus creating a new one. */}
      <Dropdown
        align="left"
        trigger={
          <span className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-primary transition hover:bg-surface-raised">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-soft text-accent">
              <Building2 className="h-3.5 w-3.5" />
            </span>
            <span className="hidden sm:inline">{tenantName}</span>
            <ChevronDown className="h-3.5 w-3.5 text-subtle" />
          </span>
        }
      >
        <DropdownLabel>Workspaces</DropdownLabel>
        {(mounted && workspaces.length > 0
          ? workspaces
          : [{ tenant, role: user.role }]
        ).map((w) => (
          <DropdownItem
            key={w.tenant.id}
            active={w.tenant.id === tenant.id}
            onClick={() => void switchTo(w.tenant.id)}
          >
            <Building2 className="h-4 w-4 text-subtle" />
            <span className="min-w-0 flex-1 truncate">{w.tenant.name}</span>
            <span className="text-[10px] text-subtle">{ROLE_LABELS[w.role]}</span>
            {w.tenant.id === tenant.id && (
              <Check className="h-4 w-4 shrink-0 text-accent" />
            )}
          </DropdownItem>
        ))}
        <DropdownSeparator />
        <DropdownItem
          onClick={() => {
            setNewName("");
            setCreating(true);
            void loadWorkspaces();
          }}
        >
          <Plus className="h-4 w-4 text-accent" />
          <span className="font-medium text-accent">New workspace</span>
        </DropdownItem>
        <p className="px-2.5 py-1.5 text-xs leading-5 text-subtle">
          Each workspace has its own knowledge, memory and team.
        </p>
      </Dropdown>

      <div className="flex-1" />

      {/* Search / command palette */}
      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        className="hidden w-56 items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-subtle transition hover:border-border-strong sm:flex"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="rounded border border-border bg-surface-raised px-1.5 py-0.5 font-sans text-[10px] font-medium text-subtle">
          ⌘K
        </kbd>
      </button>
      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        aria-label="Search"
        className="rounded-lg p-2 text-muted transition hover:bg-surface-raised hover:text-primary sm:hidden"
      >
        <Search className="h-4.5 w-4.5" />
      </button>

      <Tooltip label="Notifications — coming soon">
        <button
          type="button"
          aria-label="Notifications"
          onClick={() =>
            toast(
              "Notifications are coming",
              "You'll see ingestion and agent activity here once the backend lands.",
            )
          }
          className="rounded-lg p-2 text-muted transition hover:bg-surface-raised hover:text-primary"
        >
          <Bell className="h-4.5 w-4.5" />
        </button>
      </Tooltip>

      <Tooltip label="Help & docs">
        <Link
          href="/docs"
          aria-label="Help"
          className="rounded-lg p-2 text-muted transition hover:bg-surface-raised hover:text-primary"
        >
          <CircleHelp className="h-4.5 w-4.5" />
        </Link>
      </Tooltip>

      {/* User menu + demo role simulator */}
      <Dropdown
        trigger={
          <span className="flex items-center gap-2 rounded-lg p-1 transition hover:bg-surface-raised">
            <Avatar name={user.name} size="sm" />
            <ChevronDown className="hidden h-3.5 w-3.5 text-subtle sm:block" />
          </span>
        }
      >
        <div className="px-2.5 py-2">
          <p className="text-sm font-semibold text-primary">{user.name}</p>
          <p className="text-xs text-subtle">{user.email}</p>
        </div>
        <DropdownSeparator />
        <DropdownLabel>
          {authed ? "Preview a role (RBAC)" : "Demo role — try the RBAC"}
        </DropdownLabel>
        {ROLES.map((r) => (
          <DropdownItem key={r} active={r === role} onClick={() => setRole(r)}>
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                r === role ? "bg-accent" : "bg-border-strong",
              )}
            />
            {ROLE_LABELS[r]}
            {authed && r === user.role && (
              <span className="text-[10px] text-subtle">yours</span>
            )}
            {r === role && <Check className="ml-auto h-4 w-4 text-accent" />}
          </DropdownItem>
        ))}
        <DropdownSeparator />
        <Link href="/settings/appearance" className="block">
          <DropdownItem>
            <Palette className="h-4 w-4 text-subtle" />
            Appearance
          </DropdownItem>
        </Link>
        <Link href="/settings/account" className="block">
          <DropdownItem>
            <User className="h-4 w-4 text-subtle" />
            Account
          </DropdownItem>
        </Link>
        <DropdownSeparator />
        <DropdownItem onClick={signOut}>
          <LogOut className="h-4 w-4 text-subtle" />
          Sign out
        </DropdownItem>
      </Dropdown>

      {/* New-workspace modal */}
      <Modal
        open={creating}
        onClose={() => !busy && setCreating(false)}
        title="Create a new workspace"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreating(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              variant="accent"
              size="sm"
              onClick={() => void createWorkspace()}
              disabled={busy || newName.trim().length < 2}
            >
              <Plus className="h-4 w-4" />
              {busy ? "Creating…" : "Create workspace"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm leading-6 text-muted">
            A fresh workspace with its own private knowledge, conversations,
            memory and team — you&apos;ll be its admin. Your account switches
            to it right away.
          </p>
          <div>
            <Label htmlFor="workspace-name">Workspace name</Label>
            <Input
              id="workspace-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void createWorkspace();
              }}
              placeholder="e.g. Acme Research"
              autoFocus
            />
          </div>
        </div>
      </Modal>
    </header>
  );
}
