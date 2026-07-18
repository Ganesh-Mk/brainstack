import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** The standard surface: hairline border, soft shadow, rounded-2xl. */
export function Card({
  className,
  interactive = false,
  ...props
}: ComponentProps<"div"> & {
  /** Adds the hover lift used for clickable cards. */
  interactive?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-surface p-6 shadow-xs",
        interactive &&
          "transition hover:-translate-y-0.5 hover:border-border-strong hover:shadow-xl",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: ComponentProps<"h2">) {
  return (
    <h2
      className={cn("text-lg font-semibold text-primary", className)}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: ComponentProps<"p">) {
  return (
    <p className={cn("mt-1 text-sm leading-6 text-muted", className)} {...props} />
  );
}
