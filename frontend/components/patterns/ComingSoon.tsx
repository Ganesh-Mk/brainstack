import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { CircleCheck, Clock } from "lucide-react";
import { APP_NAV, SETTINGS_TABS } from "@/lib/nav";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { LockBadge } from "@/components/patterns/LockBadge";
import { NotifyButton } from "@/components/patterns/NotifyButton";
import { PagePreview } from "@/components/patterns/PagePreview";

type Resolved = {
  icon: LucideIcon;
  title: string;
  pitch: string;
  unlocksIn?: string;
};

function resolve(href: string): Resolved | undefined {
  const nav = APP_NAV.find((item) => item.href === href);
  if (nav) {
    return {
      icon: nav.icon,
      title: nav.label,
      pitch: nav.blurb,
      unlocksIn: nav.unlocksIn,
    };
  }
  const tab = SETTINGS_TABS.find((item) => item.href === href);
  if (tab) {
    return {
      icon: tab.icon,
      title: tab.label,
      pitch: tab.blurb,
      unlocksIn: tab.unlocksIn,
    };
  }
  return undefined;
}

/**
 * ⭐ The premium "Coming Soon" page state. Everything it can know from the
 * nav registry (icon, title, pitch, unlock phase) it looks up by `href` —
 * pages only supply the feature-specific capability bullets and a dimmed
 * preview mock of the eventual interface.
 */
export function ComingSoon({
  href,
  bullets,
  preview,
  title: titleOverride,
  pitch: pitchOverride,
}: {
  href: string;
  bullets: string[];
  preview?: ReactNode;
  title?: string;
  pitch?: string;
}) {
  const resolved = resolve(href);
  const Icon = resolved?.icon ?? Clock;
  const title = titleOverride ?? resolved?.title ?? "Coming soon";
  const pitch = pitchOverride ?? resolved?.pitch ?? "";
  const unlocksIn = resolved?.unlocksIn;

  return (
    <div className="bs-fade-up mx-auto w-full max-w-5xl">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-primary text-on-primary shadow-xs">
          <Icon className="h-5.5 w-5.5" />
        </span>
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight text-primary">
              {title}
            </h1>
            <LockBadge />
          </div>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">
            {pitch}
          </p>
        </div>
      </div>

      {unlocksIn && (
        <Badge variant="accent" className="mt-5">
          <Clock className="h-3 w-3" />
          Unlocks in: {unlocksIn}
        </Badge>
      )}

      <Card className="mt-6 p-5">
        <p className="text-xs font-semibold tracking-wide text-subtle uppercase">
          What this page will do
        </p>
        <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {bullets.map((bullet) => (
            <li
              key={bullet}
              className="flex items-start gap-2.5 text-sm leading-6 text-primary"
            >
              <CircleCheck className="mt-1 h-4 w-4 shrink-0 text-accent" />
              {bullet}
            </li>
          ))}
        </ul>
      </Card>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <NotifyButton feature={title} />
      </div>

      {preview && <PagePreview>{preview}</PagePreview>}
    </div>
  );
}
