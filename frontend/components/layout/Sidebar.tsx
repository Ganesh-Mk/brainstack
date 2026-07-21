"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";
import { LockBadge } from "@/components/patterns/LockBadge";
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
import { SIDEBAR_DEFAULT, useUiStore } from "@/stores/ui";

function NavRow({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition",
        active
          ? "bg-primary font-medium text-on-primary shadow-xs"
          : "text-muted hover:bg-surface-raised hover:text-primary",
      )}
    >
      <Icon className="h-4.5 w-4.5 shrink-0" />
      <span className="truncate">{item.label}</span>
      {item.locked && (
        <LockBadge
          compact
          className={cn("ml-auto", active && "text-on-primary/60")}
        />
      )}
    </Link>
  );
}

function NavList({
  role,
  pathname,
  onNavigate,
}: {
  role: Role;
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
            <p className="mb-1.5 px-2.5 text-[11px] font-semibold tracking-widest text-subtle uppercase">
              {group}
            </p>
            <div className="space-y-0.5">
              {items.map((item) => (
                <NavRow
                  key={item.href}
                  item={item}
                  active={isNavActive(pathname, item.href)}
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
  const width = useUiStore((s) => s.sidebarWidth);
  const setWidth = useUiStore((s) => s.setSidebarWidth);
  const mobileNavOpen = useUiStore((s) => s.mobileNavOpen) && mounted;
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen);
  const storeRole = useSessionStore((s) => s.role);
  const role: Role = mounted ? storeRole : "admin";

  // Drag the right edge to resize (clamped in the store). Pointer capture
  // keeps the drag alive even when the cursor leaves the handle.
  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;
    const move = (ev: PointerEvent) => setWidth(startW + ev.clientX - startX);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <>
      {/* ── Desktop ─────────────────────────────────────────────────── */}
      <aside
        style={{ width: mounted ? width : SIDEBAR_DEFAULT }}
        className="relative hidden shrink-0 flex-col border-r border-border bg-canvas lg:flex"
      >
        <div className="flex h-14 shrink-0 items-center border-b border-border px-4">
          <BrandMark href="/dashboard" glyphClassName="h-7 w-7" />
        </div>
        <NavList role={role} pathname={pathname} />
        {/* resize handle */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          onPointerDown={startDrag}
          className="absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize transition hover:bg-accent/25 active:bg-accent/40"
        />
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
              pathname={pathname}
              onNavigate={() => setMobileNavOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
