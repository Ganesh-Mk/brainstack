"use client";

import { useEffect, useRef, useState } from "react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useToastStore, type Toast } from "@/stores/toast";

const AUTO_DISMISS_MS = 4500;
const LEAVE_MS = 340;

function ToastRow({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const [leaving, setLeaving] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    timers.current.push(
      setTimeout(() => setLeaving(true), AUTO_DISMISS_MS),
      setTimeout(() => dismiss(toast.id), AUTO_DISMISS_MS + LEAVE_MS),
    );
    const current = timers.current;
    return () => current.forEach(clearTimeout);
  }, [toast.id, dismiss]);

  const close = () => {
    setLeaving(true);
    setTimeout(() => dismiss(toast.id), LEAVE_MS);
  };

  const Icon =
    toast.variant === "success"
      ? CircleCheck
      : toast.variant === "error"
        ? CircleAlert
        : Info;

  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto relative mt-2.5 w-80 overflow-hidden rounded-xl border border-border bg-surface shadow-lg",
        leaving ? "bs-toast-out" : "bs-toast-in",
      )}
    >
      <div className="flex items-start gap-3 p-3.5 pr-9">
        <Icon
          className={cn(
            "mt-0.5 h-4.5 w-4.5 shrink-0",
            toast.variant === "success" && "text-success",
            toast.variant === "error" && "text-danger",
            toast.variant === "default" && "text-accent",
          )}
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-primary">{toast.title}</p>
          {toast.description && (
            <p className="mt-0.5 text-xs leading-5 text-muted">
              {toast.description}
            </p>
          )}
        </div>
      </div>
      <button
        onClick={close}
        aria-label="Dismiss"
        className="absolute top-2.5 right-2.5 rounded-md p-1 text-subtle transition hover:bg-surface-raised hover:text-primary"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <div className="bs-toast-bar h-0.5 w-full bg-accent" />
    </div>
  );
}

/** Global toast stack — bottom-right. Mount once in each surface layout. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex flex-col items-end">
      {toasts.map((t) => (
        <ToastRow key={t.id} toast={t} />
      ))}
    </div>
  );
}
