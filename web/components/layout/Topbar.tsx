"use client";

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
  Search,
  User,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import {
  Dropdown,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
} from "@/components/ui/Dropdown";
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
  const tenants = useSessionStore((s) => s.tenants);
  const setTenant = useSessionStore((s) => s.setTenant);
  const storeRole = useSessionStore((s) => s.role);
  const setRole = useSessionStore((s) => s.setRole);
  const authed = useSessionStore((s) => s.authed);
  const logout = useSessionStore((s) => s.logout);
  const role: Role = mounted ? storeRole : "admin";
  const tenantName = mounted ? tenant.name : "Acme Corp";

  const signOut = () => {
    logout();
    router.push("/login");
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-canvas/80 px-4 backdrop-blur sm:gap-3 sm:px-6">
      <button
        type="button"
        onClick={() => setMobileNavOpen(true)}
        aria-label="Open navigation"
        className="rounded-lg p-2 text-muted transition hover:bg-surface-raised hover:text-primary lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Tenant switcher (mock — real multi-tenancy lands in Backend Phase 0) */}
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
        <DropdownLabel>Workspace</DropdownLabel>
        {tenants.map((t) => (
          <DropdownItem
            key={t.id}
            active={t.id === tenant.id}
            onClick={() => setTenant(t.id)}
          >
            <Building2 className="h-4 w-4 text-subtle" />
            {t.name}
            {t.id === tenant.id && (
              <Check className="ml-auto h-4 w-4 text-accent" />
            )}
          </DropdownItem>
        ))}
        <DropdownSeparator />
        <p className="px-2.5 py-1.5 text-xs leading-5 text-subtle">
          Demo workspaces — real multi-tenancy arrives with the backend.
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
          href="/roadmap"
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
    </header>
  );
}
