import { cn } from "@/lib/cn";

export function Progress({
  value,
  className,
}: {
  /** 0–100 */
  value: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-surface-raised",
        className,
      )}
    >
      <div
        className="h-full rounded-full bg-accent transition-all duration-500"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
