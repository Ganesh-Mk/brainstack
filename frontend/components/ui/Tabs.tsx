import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/cn";

export type PillTab = {
  label: string;
  href: string;
  icon?: LucideIcon;
  locked?: boolean;
};

/** Horizontal pill navigation (settings tabs, filters). Scrolls on overflow. */
export function PillTabs({
  tabs,
  activeHref,
  className,
}: {
  tabs: PillTab[];
  activeHref: string;
  className?: string;
}) {
  return (
    <nav
      className={cn(
        "flex items-center gap-1 overflow-x-auto pb-1 [scrollbar-width:none]",
        className,
      )}
    >
      {tabs.map((tab) => {
        const active = activeHref === tab.href;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition",
              active
                ? "bg-primary text-on-primary"
                : "text-muted hover:bg-surface-raised hover:text-primary",
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {tab.label}
            {tab.locked && <Lock className="h-3 w-3 opacity-60" />}
          </Link>
        );
      })}
    </nav>
  );
}
