import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Dimmed, non-interactive mock of the eventual interface, shown beneath a
 * Coming Soon header so viewers *see* the real thing coming.
 */
export function PagePreview({
  children,
  label = "Preview of the real interface",
  className,
}: {
  children: ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <section className={cn("mt-10", className)}>
      <p className="mb-3 text-center text-xs font-semibold tracking-widest text-subtle uppercase">
        {label}
      </p>
      <div className="bs-preview" aria-hidden="true">
        {children}
      </div>
    </section>
  );
}
