"use client";

import {
  CircleAlert,
  CircleCheck,
  FileText,
  Globe,
  type LucideIcon,
} from "lucide-react";
import { type ApiDocument, type DocumentStatus, isProcessing } from "@/lib/api";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import { Tooltip } from "@/components/ui/Tooltip";

/** Icon tile for a document's source kind — shared by all knowledge pages. */
export function SourceIcon({
  sourceType,
  className,
}: {
  sourceType: ApiDocument["source_type"];
  className?: string;
}) {
  const Icon: LucideIcon = sourceType === "url" ? Globe : FileText;
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-raised text-muted",
        className,
      )}
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}

export const STAGE_LABELS: Record<DocumentStatus, string> = {
  queued: "Queued",
  extracting: "Extracting",
  chunking: "Chunking",
  embedding: "Embedding",
  ready: "Ready",
  failed: "Failed",
};

/**
 * Status cell for the library table: a quiet success badge when done, a live
 * mini progress bar while the pipeline runs, a danger badge (with the error
 * on hover) when it failed.
 */
export function StatusCell({ doc }: { doc: ApiDocument }) {
  if (doc.status === "ready") {
    return (
      <Badge variant="success">
        <CircleCheck className="h-3 w-3" />
        Ready
      </Badge>
    );
  }
  if (doc.status === "failed") {
    return (
      <Tooltip label={doc.error ?? "Ingestion failed"}>
        <Badge variant="danger" className="cursor-default">
          <CircleAlert className="h-3 w-3" />
          Failed
        </Badge>
      </Tooltip>
    );
  }
  // In flight — label + thin live bar. Extract/chunk phases have no chunk
  // count yet, so the bar pulses at a small width instead of sitting at 0.
  const pct =
    doc.status === "embedding" && doc.chunk_count > 0
      ? Math.round((doc.chunks_done / doc.chunk_count) * 100)
      : null;
  return (
    <div className="min-w-32">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium text-primary">
          {STAGE_LABELS[doc.status]}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-subtle">
          {pct !== null ? `${doc.chunks_done}/${doc.chunk_count}` : "…"}
        </span>
      </div>
      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-surface-raised">
        <div
          className={cn(
            "h-full rounded-full bg-accent transition-all duration-500",
            pct === null && "animate-pulse",
          )}
          style={{ width: pct !== null ? `${Math.max(pct, 4)}%` : "18%" }}
        />
      </div>
    </div>
  );
}

/** Horizontal pipeline stepper for the Ingestion page. */
const PIPELINE_STAGES: { key: string; label: string }[] = [
  { key: "extracting", label: "Extract" },
  { key: "chunking", label: "Chunk" },
  { key: "embedding", label: "Embed" },
  { key: "ready", label: "Index" },
];

function stageIndex(status: DocumentStatus): number {
  switch (status) {
    case "queued":
      return -1;
    case "extracting":
      return 0;
    case "chunking":
      return 1;
    case "embedding":
      return 2;
    case "ready":
      return 4; // past the end — everything done
    case "failed":
      return -2;
  }
}

export function PipelineStages({ doc }: { doc: ApiDocument }) {
  const active = stageIndex(doc.status);
  const failed = doc.status === "failed";

  return (
    <ol className="flex items-center">
      {PIPELINE_STAGES.map((stage, i) => {
        const done = active > i;
        const current = active === i;
        return (
          <li key={stage.key} className="flex items-center">
            {i > 0 && (
              <span
                aria-hidden
                className={cn(
                  "mx-1.5 h-px w-5 sm:w-8",
                  done || current ? "bg-accent" : "bg-border-strong",
                )}
              />
            )}
            <span
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium whitespace-nowrap",
                done && "border-accent-200 bg-accent-soft text-accent-700",
                current &&
                  !failed &&
                  "border-accent bg-accent text-on-accent shadow-xs",
                !done && !current && "border-border bg-surface text-subtle",
                failed && "border-border bg-surface text-subtle",
              )}
            >
              {done ? (
                <CircleCheck className="h-3 w-3" />
              ) : current ? (
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
              ) : null}
              {stage.label}
              {current && stage.key === "embedding" && doc.chunk_count > 0 && (
                <span className="font-mono tabular-nums opacity-80">
                  {doc.chunks_done}/{doc.chunk_count}
                </span>
              )}
            </span>
          </li>
        );
      })}
      {failed && (
        <li className="ml-2.5">
          <Badge variant="danger">
            <CircleAlert className="h-3 w-3" />
            Failed
          </Badge>
        </li>
      )}
    </ol>
  );
}

/** "48 pages · 312 chunks" secondary line, hiding zeros gracefully. */
export function docMeta(doc: ApiDocument): string {
  const parts: string[] = [];
  if (doc.source_type === "pdf" && doc.page_count > 0) {
    parts.push(`${doc.page_count} ${doc.page_count === 1 ? "page" : "pages"}`);
  }
  if (doc.chunk_count > 0) parts.push(`${doc.chunk_count} chunks`);
  if (doc.source_type === "url" && doc.source_url) {
    try {
      parts.unshift(new URL(doc.source_url).hostname);
    } catch {
      /* ignore malformed */
    }
  }
  return parts.join(" · ");
}

/** True if any document in the list is still being processed. */
export function anyProcessing(docs: ApiDocument[]): boolean {
  return docs.some((d) => isProcessing(d.status));
}
