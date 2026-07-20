"use client";

import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Purpose-built renderer for assistant answers. The system prompt constrains
 * output to short paragraphs, dash lists, bold and inline code — so this
 * handles exactly that subset, plus the thing no generic markdown library
 * gives us: `[n]` citations rendered as clickable chips.
 */

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[\d+\](?:\[\d+\])*)/g;
const CITE = /\[(\d+)\]/g;

function renderInline(
  text: string,
  onCitation?: (n: number) => void,
  activeCitation?: number | null,
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
            <button
              key={j}
              type="button"
              onClick={() => onCitation?.(n)}
              aria-label={`Citation ${n}`}
              className={cn(
                "mx-0.5 inline-flex h-4.5 min-w-4.5 translate-y-[-1px] items-center justify-center rounded-md px-1 align-middle font-mono text-[10px] font-semibold transition",
                activeCitation === n
                  ? "bg-accent text-on-accent"
                  : "bg-accent-soft text-accent-700 hover:bg-accent-200",
              )}
            >
              {n}
            </button>
          ))}
        </Fragment>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export function MessageContent({
  content,
  onCitation,
  activeCitation,
  className,
}: {
  content: string;
  onCitation?: (n: number) => void;
  activeCitation?: number | null;
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
                      onCitation,
                      activeCitation,
                    )}
                  </span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            {renderInline(block.lines.join(" "), onCitation, activeCitation)}
          </p>
        );
      })}
    </div>
  );
}
