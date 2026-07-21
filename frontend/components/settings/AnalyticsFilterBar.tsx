"use client";

import { FlaskConical } from "lucide-react";
import type { AnalyticsFilters } from "@/lib/api";
import { cn } from "@/lib/cn";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

/**
 * Window / channel / test-traffic filters for the Analytics page.
 *
 * `include_test` defaults to off, and that is the point rather than a
 * preference: the create-key modal tells people a test key's traffic stays
 * out of their quality numbers, so the default has to make that true.
 *
 * Laid out to wrap: three independent groups that flow onto their own rows
 * on a phone instead of a single row that scrolls sideways.
 */
export function AnalyticsFilterBar({
  value,
  onChange,
  disabled,
}: {
  value: AnalyticsFilters;
  onChange: (next: AnalyticsFilters) => void;
  disabled?: boolean;
}) {
  const set = (patch: Partial<AnalyticsFilters>) =>
    onChange({ ...value, ...patch });

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-5 gap-y-3",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      <Group label="Window">
        <SegmentedControl
          value={String(value.days)}
          onChange={(v) => set({ days: Number(v) as AnalyticsFilters["days"] })}
          options={[
            { value: "7", label: "7d" },
            { value: "14", label: "14d" },
            { value: "30", label: "30d" },
          ]}
        />
      </Group>

      <Group label="Source">
        <SegmentedControl
          value={value.channel}
          onChange={(v) => set({ channel: v as AnalyticsFilters["channel"] })}
          options={[
            { value: "all", label: "All" },
            { value: "app", label: "App" },
            { value: "api", label: "API" },
          ]}
        />
      </Group>

      <label
        className="flex cursor-pointer items-center gap-2 self-end rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-muted transition hover:text-primary"
        title="Test-key traffic is excluded from these numbers by default."
      >
        <input
          type="checkbox"
          className="accent-[var(--color-accent)]"
          checked={value.include_test}
          onChange={(e) => set({ include_test: e.target.checked })}
        />
        <FlaskConical className="h-3.5 w-3.5" />
        Include test keys
      </label>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-subtle uppercase">
        {label}
      </p>
      {children}
    </div>
  );
}
