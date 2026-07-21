"use client";

import { useCallback, useRef, useState } from "react";
import {
  Activity,
  Building2,
  ChartLine,
  ChevronLeft,
  ChevronRight,
  FileText,
  MessageSquare,
  Sparkles,
  Ticket,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

/** The platform section's cards as a horizontal, snap-scrolling carousel. */

type Feature = {
  icon: LucideIcon;
  category: string;
  title: string;
  text: string;
};

const FEATURES: Feature[] = [
  {
    icon: MessageSquare,
    category: "Intelligence",
    title: "Grounded Q&A",
    text: "Answers built only from your own knowledge — with “I don't know” instead of made-up facts.",
  },
  {
    icon: Sparkles,
    category: "Intelligence",
    title: "Live agent trace",
    text: "Watch every reasoning step in real time: planning, searching, acting, drafting.",
  },
  {
    icon: FileText,
    category: "Trust",
    title: "Inline citations",
    text: "Click any [1] to open the source at the exact page, with the grounding passage beside it.",
  },
  {
    icon: Upload,
    category: "Knowledge",
    title: "Multi-source ingestion",
    text: "PDFs, Word docs, URLs — parsed, chunked and indexed with live progress.",
  },
  {
    icon: Ticket,
    category: "Actions",
    title: "Role-based actions",
    text: "Managers assign tickets and pull analytics from chat. Employees can't — by construction.",
  },
  {
    icon: ChartLine,
    category: "Insights",
    title: "Quality you can measure",
    text: "Faithfulness scores, latency, cost per answer — a dashboard, not a demo.",
  },
  {
    icon: Building2,
    category: "Platform",
    title: "True multi-tenancy",
    text: "Every company's knowledge lives in its own isolated namespace. Always.",
  },
  {
    icon: Activity,
    category: "Platform",
    title: "Full observability",
    text: "Per-request traces of what was retrieved, which tools ran, and what it cost.",
  },
];

export function FeatureCarousel() {
  const track = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);

  const onScroll = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 8);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8);
  }, []);

  const nudge = (dir: -1 | 1) =>
    track.current?.scrollBy({ left: dir * 316, behavior: "smooth" });

  return (
    <div className="relative">
      {/* controls */}
      <div className="mb-4 flex items-center justify-end gap-2">
        {(
          [
            [-1, ChevronLeft, "Previous features", canLeft],
            [1, ChevronRight, "More features", canRight],
          ] as const
        ).map(([dir, Icon, label, enabled]) => (
          <button
            key={label}
            type="button"
            onClick={() => nudge(dir)}
            disabled={!enabled}
            aria-label={label}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full border transition",
              enabled
                ? "border-border bg-surface text-primary shadow-xs hover:border-accent hover:text-accent"
                : "border-border bg-surface text-subtle opacity-40",
            )}
          >
            <Icon className="h-4.5 w-4.5" />
          </button>
        ))}
      </div>

      {/* track */}
      <div
        ref={track}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="w-72 shrink-0 snap-start rounded-2xl border border-border bg-surface p-5 shadow-xs transition-shadow hover:shadow-lg"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <f.icon className="h-4.5 w-4.5" />
            </span>
            <p className="mt-4 text-xs font-semibold tracking-wide text-accent-700 uppercase">
              {f.category}
            </p>
            <h3 className="mt-1 text-base font-semibold text-primary">
              {f.title}
            </h3>
            <p className="mt-1.5 text-sm leading-6 text-muted">{f.text}</p>
          </div>
        ))}
      </div>

      {/* edge fades */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-canvas to-transparent transition-opacity",
          canLeft ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-canvas to-transparent transition-opacity",
          canRight ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}
