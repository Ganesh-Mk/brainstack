import type { ComponentProps } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    <label
      className={cn("mb-1.5 block text-sm font-medium text-primary", className)}
      {...props}
    />
  );
}

const controlBase =
  "w-full rounded-lg border border-border-strong bg-surface px-3 text-sm text-primary " +
  "placeholder:text-subtle transition focus:border-accent focus:outline-2 " +
  "focus:outline-offset-0 focus:outline-accent/30 disabled:opacity-50";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(controlBase, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(controlBase, "min-h-24 py-2.5 leading-6", className)}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        className={cn(controlBase, "h-10 appearance-none pr-9", className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-subtle" />
    </div>
  );
}

export function Hint({ className, ...props }: ComponentProps<"p">) {
  return (
    <p className={cn("mt-1.5 text-xs text-subtle", className)} {...props} />
  );
}

export function FieldError({ className, ...props }: ComponentProps<"p">) {
  return (
    <p className={cn("mt-1.5 text-xs text-danger", className)} {...props} />
  );
}
