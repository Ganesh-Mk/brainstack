"use client";

import {
  Brain,
  Globe,
  PenLine,
  RefreshCw,
  Search,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { ApiTraceStep } from "@/lib/api";
import { cn } from "@/lib/cn";

const KIND_META: Record<
  ApiTraceStep["kind"],
  { icon: LucideIcon; tint: string }
> = {
  planning: { icon: Brain, tint: "text-muted" },
  knowledge: { icon: Search, tint: "text-accent" },
  web: { icon: Globe, tint: "text-accent" },
  // An action step MUTATES a company system — visually distinct from reads.
  action: { icon: Zap, tint: "text-warning" },
  // Reflection fired = the first draft failed its grounding audit.
  reflection: { icon: RefreshCw, tint: "text-warning" },
  drafting: { icon: PenLine, tint: "text-success" },
};

/**
 * The agent's reasoning as a vertical step timeline. `live` marks the run as
 * in-progress: the last step pulses, and a drafting placeholder appears once
 * tokens start arriving.
 */
export function TraceSteps({
  steps,
  live = false,
  drafting = false,
  className,
}: {
  steps: ApiTraceStep[];
  live?: boolean;
  drafting?: boolean;
  className?: string;
}) {
  const shown: ApiTraceStep[] = drafting
    ? [
        ...steps,
        { n: steps.length + 1, kind: "drafting", label: "Drafting the answer" },
      ]
    : steps;

  if (shown.length === 0) {
    return (
      <p className={cn("px-2 py-6 text-center text-xs text-subtle", className)}>
        {live ? "Starting up…" : "No trace recorded for this answer."}
      </p>
    );
  }

  return (
    <ol className={cn("space-y-0.5", className)}>
      {shown.map((step, i) => {
        const meta = KIND_META[step.kind];
        const Icon = meta.icon;
        const isCurrent = live && i === shown.length - 1;
        return (
          <li key={`${step.n}-${step.kind}`} className="flex gap-2.5">
            {/* rail */}
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border",
                  isCurrent
                    ? "border-accent bg-accent-soft"
                    : "border-border bg-surface",
                )}
              >
                <Icon
                  className={cn(
                    "h-3 w-3",
                    meta.tint,
                    isCurrent && "animate-pulse text-accent",
                  )}
                />
              </span>
              {i < shown.length - 1 && (
                <span aria-hidden className="w-px flex-1 bg-border" />
              )}
            </div>
            {/* content — label row is min-h-6 so it centers on the 24px icon */}
            <div className="min-w-0 flex-1 pb-3">
              <div className="flex min-h-6 items-center justify-between gap-2">
                <p
                  className={cn(
                    "text-xs font-medium",
                    isCurrent ? "text-accent-700" : "text-primary",
                  )}
                >
                  {step.label}
                  {isCurrent && "…"}
                </p>
                {typeof step.ms === "number" && (
                  <span className="font-mono text-[10px] whitespace-nowrap text-subtle">
                    {step.ms >= 1000
                      ? `${(step.ms / 1000).toFixed(1)}s`
                      : `${step.ms}ms`}
                  </span>
                )}
              </div>
              {step.detail && (
                <p className="mt-0.5 truncate font-mono text-[11px] text-subtle">
                  “{step.detail}”
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Total wall time of a recorded trace, prettified. */
export function traceDuration(steps: ApiTraceStep[]): string | null {
  const total = steps.reduce((sum, s) => sum + (s.ms ?? 0), 0);
  if (total === 0) return null;
  return total >= 1000 ? `${(total / 1000).toFixed(1)}s` : `${total}ms`;
}
