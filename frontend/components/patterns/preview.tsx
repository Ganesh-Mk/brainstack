import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/**
 * Tiny primitives for the dimmed "eventual interface" mocks behind Coming
 * Soon pages. `Ph` is a muted placeholder bar; size it with className.
 * These render inside <PagePreview> (aria-hidden), so sample copy is fine.
 */
export function Ph({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-md bg-surface-raised", className)}
      {...props}
    />
  );
}

export function PreviewCard({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-surface p-5 shadow-xs",
        className,
      )}
      {...props}
    />
  );
}
