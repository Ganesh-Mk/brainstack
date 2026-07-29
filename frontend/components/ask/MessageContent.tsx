"use client";

import {
  Fragment,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Brain, ExternalLink, FileText, Globe } from "lucide-react";
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
 * can't clip it. INTERACTIVE: it stays open while the cursor is over it
 * (the chip's close is delay-based and cancelled on entry), the URL is a
 * real link, and long passages expand with "Learn more". */
export function SourcePopover({
  source,
  anchor,
  onEnter,
  onLeave,
  onOpen,
}: {
  source: ApiSource;
  anchor: DOMRect;
  onEnter?: () => void;
  onLeave?: () => void;
  onOpen?: (s: ApiSource) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const margin = 12;
  const viewport = typeof window !== "undefined" ? window.innerWidth : 1200;
  const width = Math.min(340, viewport - margin * 2); // phones get full width
  const left = Math.min(
    Math.max(margin, anchor.left + anchor.width / 2 - width / 2),
    viewport - width - margin,
  );
  const showBelow = anchor.top < 300;
  return (
    <div
      role="tooltip"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className="bs-scale-in fixed z-50 overflow-hidden rounded-xl border border-border bg-surface shadow-lg"
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
          ) : source.source_type === "text" ? (
            <Brain className="h-3 w-3" />
          ) : (
            <FileText className="h-3 w-3" />
          )}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-primary">
          {source.title}
        </span>
        <span className="shrink-0 rounded-md bg-accent-soft px-1.5 py-0.5 font-mono text-[10px] font-semibold text-accent-700">
          {source.source_type === "url"
            ? "web"
            : source.source_type === "text"
              ? "memory"
              : `p.${source.page}`}
        </span>
      </div>
      <div className="px-3 py-2.5">
        {source.source_type === "url" && source.source_url && (
          <a
            href={source.source_url}
            target="_blank"
            rel="noreferrer"
            className="mb-2 flex items-center gap-1.5 font-mono text-[10px] text-accent hover:underline"
          >
            <ExternalLink className="h-2.5 w-2.5 shrink-0" />
            <span className="min-w-0 truncate">{source.source_url}</span>
          </a>
        )}
        <p
          className={cn(
            "text-xs leading-5 text-muted",
            expanded ? "max-h-60 overflow-y-auto" : "line-clamp-6",
          )}
        >
          “{source.text}”
        </p>
        {source.text.length > 340 && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="mt-1.5 text-[11px] font-medium text-accent hover:underline"
          >
            {expanded ? "Show less" : "Learn more"}
          </button>
        )}
      </div>
      <div className="flex items-center justify-between border-t border-border px-3 py-1.5">
        <span className="font-mono text-[10px] text-subtle">
          relevance {source.score.toFixed(2)}
        </span>
        {/* A remembered fact has no file and no page to open — it came from
            what you told the assistant, not from a document. */}
        {source.source_type === "text" ? (
          <span className="text-[10px] text-subtle">from your saved memory</span>
        ) : (
          <button
            type="button"
            onClick={() => onOpen?.(source)}
            className="flex items-center gap-1 text-[10px] font-medium text-accent hover:underline"
          >
            open
            {source.source_type === "url" ? " the page" : ` p.${source.page}`}
            <ExternalLink className="h-2.5 w-2.5" />
          </button>
        )}
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
  // Delay-based close so the cursor can travel from chip to popover — the
  // card only closes once the pointer has left BOTH.
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = () => {
    if (!source) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setAnchor(ref.current?.getBoundingClientRect() ?? null);
  };
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };
  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setAnchor(null), 180);
  };
  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={() => source && onOpen?.(source)}
        onMouseEnter={show}
        onMouseLeave={scheduleClose}
        onFocus={show}
        onBlur={scheduleClose}
        aria-label={`Citation ${n}${source ? `: ${source.title}` : ""}`}
        className={cn(
          "mx-0.5 inline-flex h-4.5 min-w-4.5 translate-y-[-1px] items-center justify-center rounded-md px-1 align-middle font-mono text-[10px] font-semibold transition",
          "bg-accent-soft text-accent-700 hover:bg-accent hover:text-on-accent",
        )}
      >
        {n}
      </button>
      {anchor && source && (
        <SourcePopover
          source={source}
          anchor={anchor}
          onEnter={cancelClose}
          onLeave={scheduleClose}
          onOpen={onOpen}
        />
      )}
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

/** One markdown-style `| a | b |` line → trimmed cells. */
function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

const isTableLine = (line: string) =>
  line.trim().startsWith("|") && line.trim().endsWith("|");
const isSeparatorRow = (cells: string[]) =>
  cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c));

type Block =
  | { type: "p" | "ul" | "ol"; lines: string[] }
  | { type: "table"; header: string[] | null; rows: string[][] };

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
  // Group lines into paragraphs, dash/numbered lists and pipe-tables. The
  // model mostly writes prose, but tabular asks (workloads, stats) come back
  // as markdown tables — rendering the pipes as text is unreadable.
  const blocks: Block[] = [];
  for (const raw of content.split("\n")) {
    const line = raw.trimEnd();
    const last = blocks[blocks.length - 1];
    if (!line.trim()) {
      blocks.push({ type: "p", lines: [] }); // paragraph break
      continue;
    }
    if (isTableLine(line)) {
      const cells = splitRow(line);
      if (last?.type === "table") {
        if (isSeparatorRow(cells)) {
          // header separator: promote the previous row to a header
          if (last.header === null && last.rows.length > 0) {
            last.header = last.rows.shift() ?? null;
          }
        } else {
          last.rows.push(cells);
        }
      } else {
        blocks.push({ type: "table", header: null, rows: [cells] });
      }
      continue;
    }
    const isBullet = /^\s*[-*]\s+/.test(line);
    const isNumbered = /^\s*\d+[.)]\s+/.test(line);
    if (isBullet) {
      if (last?.type === "ul") last.lines.push(line);
      else blocks.push({ type: "ul", lines: [line] });
    } else if (isNumbered) {
      if (last?.type === "ol") last.lines.push(line);
      else blocks.push({ type: "ol", lines: [line] });
    } else {
      if (last?.type === "p" && last.lines.length > 0) last.lines.push(line);
      else blocks.push({ type: "p", lines: [line] });
    }
  }

  return (
    <div className={cn("space-y-2.5 text-sm leading-6", className)}>
      {blocks.map((block, i) => {
        if (block.type === "table") {
          if (block.rows.length === 0 && !block.header) return null;
          return (
            <div
              key={i}
              className="overflow-x-auto rounded-xl border border-border"
            >
              <table className="w-full text-left text-[13px]">
                {block.header && (
                  <thead>
                    <tr className="border-b border-border bg-surface-raised/60">
                      {block.header.map((cell, j) => (
                        <th
                          key={j}
                          className="px-3 py-2 font-semibold whitespace-nowrap text-primary"
                        >
                          {renderInline(cell, sources, onOpenSource)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                )}
                <tbody className="divide-y divide-border">
                  {block.rows.map((row, r) => (
                    <tr key={r}>
                      {row.map((cell, c) => (
                        <td key={c} className="px-3 py-2 align-top text-muted">
                          {renderInline(cell, sources, onOpenSource)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
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
        if (block.type === "ol") {
          return (
            <ol key={i} className="space-y-1 pl-1">
              {block.lines.map((line, j) => {
                const num = line.match(/^\s*(\d+)[.)]\s+/)?.[1] ?? String(j + 1);
                return (
                  <li key={j} className="flex gap-2">
                    <span className="w-4 shrink-0 text-right font-mono text-xs leading-6 text-subtle">
                      {num}.
                    </span>
                    <span>
                      {renderInline(
                        line.replace(/^\s*\d+[.)]\s+/, ""),
                        sources,
                        onOpenSource,
                      )}
                    </span>
                  </li>
                );
              })}
            </ol>
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
