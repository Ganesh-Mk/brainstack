"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Search } from "lucide-react";
import { LockBadge } from "@/components/patterns/LockBadge";
import { useMounted } from "@/hooks/useMounted";
import { cn } from "@/lib/cn";
import {
  APP_NAV,
  SETTINGS_TABS,
  roleAllows,
  type Role,
} from "@/lib/nav";
import { useSessionStore } from "@/stores/session";
import { useUiStore } from "@/stores/ui";

type PaletteEntry = {
  label: string;
  href: string;
  group: string;
  icon: React.ComponentType<{ className?: string }>;
  locked: boolean;
};

export function CommandPalette() {
  const router = useRouter();
  const mounted = useMounted();
  const open = useUiStore((s) => s.paletteOpen);
  const setOpen = useUiStore((s) => s.setPaletteOpen);
  const storeRole = useSessionStore((s) => s.role);
  const role: Role = mounted ? storeRole : "admin";

  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global ⌘K / Ctrl+K toggle.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!useUiStore.getState().paletteOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  // Reset the query when the palette (re)opens — render-time adjustment,
  // per the React "adjusting state when a prop changes" pattern.
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setQuery("");
      setIndex(0);
    }
  }

  // Focus the input once the panel is in the DOM.
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const entries = useMemo<PaletteEntry[]>(() => {
    const nav = APP_NAV.filter((item) => roleAllows(item, role)).map(
      (item) => ({
        label: item.label,
        href: item.href,
        group: item.group,
        icon: item.icon,
        locked: item.locked,
      }),
    );
    const settings = SETTINGS_TABS.map((tab) => ({
      label: `Settings · ${tab.label}`,
      href: tab.href,
      group: "Settings",
      icon: tab.icon,
      locked: tab.locked,
    }));
    return [...nav, ...settings];
  }, [role]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.label.toLowerCase().includes(q) || e.group.toLowerCase().includes(q),
    );
  }, [entries, query]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onClick={() => setOpen(false)}
      className="fixed inset-0 z-50 flex items-start justify-center bg-primary/40 p-4 pt-[14vh] backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bs-scale-in w-full max-w-lg overflow-hidden rounded-xl border border-border bg-surface shadow-xl"
      >
        <div className="flex items-center gap-2.5 border-b border-border px-4">
          <Search className="h-4 w-4 shrink-0 text-subtle" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIndex((i) => Math.min(i + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setIndex((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter" && results[index]) {
                e.preventDefault();
                go(results[index].href);
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            placeholder="Jump to any page…"
            className="h-12 w-full bg-transparent text-sm text-primary outline-none placeholder:text-subtle"
          />
          <kbd className="rounded border border-border bg-surface-raised px-1.5 py-0.5 text-[10px] font-medium text-subtle">
            esc
          </kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto p-1.5">
          {results.length === 0 && (
            <li className="px-3 py-8 text-center text-sm text-subtle">
              Nothing matches &ldquo;{query}&rdquo;
            </li>
          )}
          {results.map((entry, i) => {
            const Icon = entry.icon;
            return (
              <li key={entry.href}>
                <button
                  type="button"
                  onClick={() => go(entry.href)}
                  onMouseEnter={() => setIndex(i)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition",
                    i === index
                      ? "bg-surface-raised text-primary"
                      : "text-muted",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate text-primary">{entry.label}</span>
                  {entry.locked && <LockBadge compact />}
                  <span className="ml-auto text-xs text-subtle">
                    {entry.group}
                  </span>
                  {i === index && (
                    <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-subtle" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
