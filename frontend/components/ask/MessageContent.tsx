"use client";

import {
  Fragment,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ExternalLink, FileText, Globe } from "lucide-react";
import type { ApiSource } from "@/lib/api";
import { cn } from "@/lib/cn";

/**
 * Purpose-built renderer for assistant answers. The system prompt constrains
 * output to short paragraphs, dash lists, bold and inline code — so this
 * handles exactly that subset, plus the thing no generic markdown library
 * gives us: `[n]` citations rendered as chips that PREVIEW the source on
 * hover and open it on click.
 */

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[\d+\](?:\[\d+\])*)/g;
const CITE = /\[(\d+)\]/g;

/** Hover card for one source — fixed-positioned so the chat scroll area
 * can't clip it. Pointer-events off: it's a preview; clicking the chip
 * opens the source itself. Shared by citation chips and the sources row. */
export function SourcePopover({
  source,
  anchor,
}: {
  source: ApiSource;
  anchor: DOMRect;
}) {
  const width = 340;
  const margin = 12;
  const left = Math.min(
    Math.max(margin, anchor.left + anchor.width / 2 - width / 2),
    (typeof window !== "undefined" ? window.innerWidth : 1200) - width - margin,
  );
  const showBelow = anchor.top < 280;
  return (
    <div
      role="tooltip"
      className="bs-scale-in pointer-events-none fixed z-50 overflow-hidden rounded-xl border border-border bg-surface shadow-lg"
      style={{
        width,
        left,
        ...(showBelow
          ? { top: anchor.bottom + 8 }
          : { bottom: window.innerHeight - anchor.top + 8 }),
      }}
    >
      <div className="flex items-center gap-2 border-b border-border bg-surface-raised/60 px-3 py-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
          {source.source_type === "url" ? (
            <Globe className="h-3 w-3" />
          ) : (
            <FileText className="h-3 w-3" />
          )}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-primary">
          {source.title}
        </span>
        <span className="shrink-0 rounded-md bg-accent-soft px-1.5 py-0.5 font-mono text-[10px] font-semibold text-accent-700">
          {source.source_type === "url" ? "web" : `p.${source.page}`}
        </span>
      </div>
      <div className="px-3 py-2.5">
        {source.source_type === "url" && source.source_url && (
          <p className="mb-2 flex items-center gap-1.5 truncate font-mono text-[10px] text-accent">
            <ExternalLink className="h-2.5 w-2.5 shrink-0" />
            {source.source_url}
          </p>
        )}
        <p className="line-clamp-6 text-xs leading-5 text-muted">
          “{source.text}”
        </p>
      </div>
      <div className="flex items-center justify-between border-t border-border px-3 py-1.5">
        <span className="font-mono text-[10px] text-subtle">
          relevance {source.score.toFixed(2)}
        </span>
        <span className="flex items-center gap-1 text-[10px] font-medium text-accent">
          click to open
          {source.source_type === "url" ? " the page" : ` p.${source.page}`}
          <ExternalLink className="h-2.5 w-2.5" />
        </span>
      </div>
    </div>
  );
}

function CitationChip({
  n,
  source,
  onOpen,
}: {
  n: number;
  source?: ApiSource;
  onOpen?: (s: ApiSource) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={() => source && onOpen?.(source)}
        onMouseEnter={() =>
          source && setAnchor(ref.current?.getBoundingClientRect() ?? null)
        }
        onMouseLeave={() => setAnchor(null)}
        onFocus={() =>
          source && setAnchor(ref.current?.getBoundingClientRect() ?? null)
        }
        onBlur={() => setAnchor(null)}
        aria-label={`Citation ${n}${source ? `: ${source.title}` : ""}`}
        className={cn(
          "mx-0.5 inline-flex h-4.5 min-w-4.5 translate-y-[-1px] items-center justify-center rounded-md px-1 align-middle font-mono text-[10px] font-semibold transition",
          "bg-accent-soft text-accent-700 hover:bg-accent hover:text-on-accent",
        )}
      >
        {n}
      </button>
      {anchor && source && <SourcePopover source={source} anchor={anchor} />}
    </>
  );
}

function renderInline(
  text: string,
  sources?: ApiSource[] | null,
  onOpenSource?: (s: ApiSource) => void,
): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (!part) return null;
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-primary">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="rounded bg-surface-raised px-1 py-0.5 font-mono text-[0.85em]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (/^\[\d+\]/.test(part)) {
      const nums = [...part.matchAll(CITE)].map((m) => Number(m[1]));
      return (
        <Fragment key={i}>
          {nums.map((n, j) => (
            <CitationChip
              key={j}
              n={n}
              source={sources?.find((s) => s.n === n)}
              onOpen={onOpenSource}
            />
          ))}
        </Fragment>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export function MessageContent({
  content,
  sources,
  onOpenSource,
  className,
}: {
  content: string;
  /** The message's sources — powers the hover previews on `[n]` chips. */
  sources?: ApiSource[] | null;
  onOpenSource?: (s: ApiSource) => void;
  className?: string;
}) {
  // Group lines into paragraphs and dash-lists.
  const blocks: { type: "p" | "ul"; lines: string[] }[] = [];
  for (const raw of content.split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      blocks.push({ type: "p", lines: [] }); // paragraph break
      continue;
    }
    const isItem = /^\s*[-*]\s+/.test(line);
    const last = blocks[blocks.length - 1];
    if (isItem) {
      if (last?.type === "ul") last.lines.push(line);
      else blocks.push({ type: "ul", lines: [line] });
    } else {
      if (last?.type === "p" && last.lines.length > 0) last.lines.push(line);
      else blocks.push({ type: "p", lines: [line] });
    }
  }

  return (
    <div className={cn("space-y-2.5 text-sm leading-6", className)}>
      {blocks.map((block, i) => {
        if (block.lines.length === 0) return null;
        if (block.type === "ul") {
          return (
            <ul key={i} className="space-y-1 pl-1">
              {block.lines.map((line, j) => (
                <li key={j} className="flex gap-2">
                  <span
                    aria-hidden
                    className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-border-strong"
                  />
                  <span>
                    {renderInline(
                      line.replace(/^\s*[-*]\s+/, ""),
                      sources,
                      onOpenSource,
                    )}
                  </span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            {renderInline(block.lines.join(" "), sources, onOpenSource)}
          </p>
        );
      })}
    </div>
  );
}
