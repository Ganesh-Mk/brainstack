import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Lightweight CSS tooltip — appears above the wrapped element on hover/focus. */
export function Tooltip({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("group/tip relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute bottom-full left-1/2 z-40 mb-1.5 -translate-x-1/2",
          "rounded-md bg-primary px-2 py-1 text-xs font-medium whitespace-nowrap text-on-primary",
          "opacity-0 transition-opacity duration-150",
          "group-hover/tip:opacity-100 group-focus-within/tip:opacity-100",
        )}
      >
        {label}
      </span>
    </span>
  );
}
