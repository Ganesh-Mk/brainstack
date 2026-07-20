"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeft, X } from "lucide-react";
import { BrandGlyph, BrandMark } from "@/components/brand/BrandMark";
import { LockBadge } from "@/components/patterns/LockBadge";
import { Tooltip } from "@/components/ui/Tooltip";
import { useMounted } from "@/hooks/useMounted";
import { cn } from "@/lib/cn";
import {
  APP_NAV,
  NAV_GROUP_ORDER,
  isNavActive,
  roleAllows,
  type NavItem,
  type Role,
} from "@/lib/nav";
import { useSessionStore } from "@/stores/session";
import { useUiStore } from "@/stores/ui";

function NavRow({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const row = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition",
        collapsed && "justify-center px-0 py-2.5",
        active
          ? "bg-primary font-medium text-on-primary shadow-xs"
          : "text-muted hover:bg-surface-raised hover:text-primary",
      )}
    >
      <Icon className="h-4.5 w-4.5 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {!collapsed && item.locked && (
        <LockBadge
          compact
          className={cn("ml-auto", active && "text-on-primary/60")}
        />
      )}
    </Link>
  );
  if (collapsed) {
    return <Tooltip label={item.label} className="w-full">{row}</Tooltip>;
  }
  return row;
}

function NavList({
  role,
  collapsed,
  pathname,
  onNavigate,
}: {
  role: Role;
  collapsed: boolean;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {NAV_GROUP_ORDER.map((group) => {
        const items = APP_NAV.filter(
          (item) => item.group === group && roleAllows(item, role),
        );
        if (items.length === 0) return null;
        return (
          <div key={group}>
            {collapsed ? (
              <div className="mx-2 mb-2 h-px bg-border" />
            ) : (
              <p className="mb-1.5 px-2.5 text-[11px] font-semibold tracking-widest text-subtle uppercase">
                {group}
              </p>
            )}
            <div className="space-y-0.5">
              {items.map((item) => (
                <NavRow
                  key={item.href}
                  item={item}
                  active={isNavActive(pathname, item.href)}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const mounted = useMounted();
  const collapsed = useUiStore((s) => s.sidebarCollapsed) && mounted;
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const mobileNavOpen = useUiStore((s) => s.mobileNavOpen) && mounted;
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen);
  const storeRole = useSessionStore((s) => s.role);
  const role: Role = mounted ? storeRole : "admin";

  return (
    <>
      {/* ── Desktop ─────────────────────────────────────────────────── */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col border-r border-border bg-canvas transition-[width] duration-200 lg:flex",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <div
          className={cn(
            "flex h-14 shrink-0 items-center border-b border-border",
            collapsed ? "justify-center px-0" : "px-4",
          )}
        >
          {collapsed ? (
            <Link href="/dashboard" aria-label="BrainStack dashboard">
              <BrandGlyph className="h-7 w-7" />
            </Link>
          ) : (
            <BrandMark href="/dashboard" glyphClassName="h-7 w-7" />
          )}
        </div>
        <NavList role={role} collapsed={collapsed} pathname={pathname} />
        <div className="shrink-0 border-t border-border p-3">
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted transition hover:bg-surface-raised hover:text-primary",
              collapsed && "justify-center px-0",
            )}
          >
            <PanelLeft className="h-4.5 w-4.5" />
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* ── Mobile drawer ───────────────────────────────────────────── */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="bs-fade-in absolute inset-0 bg-primary/40 backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="bs-scale-in absolute inset-y-0 left-0 flex w-72 flex-col border-r border-border bg-canvas shadow-xl">
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
              <BrandMark href="/dashboard" glyphClassName="h-7 w-7" />
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close navigation"
                className="rounded-md p-1.5 text-subtle transition hover:bg-surface-raised hover:text-primary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavList
              role={role}
              collapsed={false}
              pathname={pathname}
              onNavigate={() => setMobileNavOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
