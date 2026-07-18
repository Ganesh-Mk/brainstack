import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/** Dashboard stat tile: label, value, optional delta + icon. */
export function KpiTile({
  label,
  value,
  delta,
  deltaTone = "neutral",
  icon: Icon,
  className,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: "up" | "down" | "neutral";
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-surface p-5 shadow-xs",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold tracking-wide text-subtle uppercase">
          {label}
        </p>
        {Icon && (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-primary">
        {value}
      </p>
      {delta && (
        <p
          className={cn(
            "mt-1 text-xs font-medium",
            deltaTone === "up" && "text-success",
            deltaTone === "down" && "text-danger",
            deltaTone === "neutral" && "text-subtle",
          )}
        >
          {delta}
        </p>
      )}
    </div>
  );
}
