"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

const modalWidths = {
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
} as const;

/**
 * Global modal: centered overlay, capped to the viewport with a scrollable
 * body and an optional sticky footer. Closes on Escape / backdrop click.
 *
 * Rendered through a portal to <body>, and that is load-bearing rather than
 * tidiness: page containers carry `.bs-fade-up`, whose animation leaves a
 * transform on the element (an identity matrix, but still a transform). Any
 * non-`none` transform makes that element the containing block for
 * `position: fixed` descendants, so an inline modal centres itself inside the
 * page wrapper instead of the viewport — on Settings that meant a tall modal
 * hung 176px above the top of the screen with its title and first field
 * unreachable. The portal moves the overlay out of every transformed
 * ancestor, so `fixed inset-0` means the viewport again.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof modalWidths;
}) {
  // Hooks run unconditionally (before the early return); no-ops while closed.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Body scroll would otherwise continue behind the overlay.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open || !mounted) return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-primary/40 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "bs-scale-in flex max-h-[90vh] w-full flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xl",
          modalWidths[size],
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="text-base font-semibold text-primary">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 rounded-md p-1.5 text-subtle transition hover:bg-surface-raised hover:text-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border bg-canvas px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
