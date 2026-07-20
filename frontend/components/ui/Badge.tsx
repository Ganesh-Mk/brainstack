import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export type BadgeVariant =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "lock";

const variants: Record<BadgeVariant, string> = {
  neutral: "border border-border bg-surface-raised text-muted",
  accent: "border border-accent-200 bg-accent-soft text-accent-700",
  success: "border border-success/25 bg-success/10 text-success",
  warning: "border border-warning/25 bg-warning/10 text-warning",
  danger: "border border-danger/25 bg-danger/10 text-danger",
  lock: "border border-border bg-surface-raised text-subtle",
};

export function Badge({
  variant = "neutral",
  className,
  ...props
}: ComponentProps<"span"> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
