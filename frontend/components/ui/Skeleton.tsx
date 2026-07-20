import { cn } from "@/lib/cn";

/** Shimmering placeholder block. Size it with className. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("bs-shimmer rounded-md", className)}
    />
  );
}
