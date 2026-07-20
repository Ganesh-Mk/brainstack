"use client";

import { Plus, Workflow } from "lucide-react";
import { isProcessing } from "@/lib/api";
import { timeAgo } from "@/lib/time";
import {
  docMeta,
  PipelineStages,
  SourceIcon,
} from "@/components/knowledge/bits";
import { EmptyState } from "@/components/patterns/EmptyState";
import { PageHeader } from "@/components/patterns/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDocuments } from "@/hooks/useDocuments";

const SHOW_LATEST = 8;

export function IngestionView() {
  const { docs, error, loading, demo, refresh } = useDocuments();

  const latest = (docs ?? []).slice(0, SHOW_LATEST);
  const active = (docs ?? []).filter((d) => isProcessing(d.status)).length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        icon={Workflow}
        title="Ingestion"
        description="Documents moving through the pipeline, live — extract, chunk, embed, index. Each stage lights up as it completes."
        badge={
          demo ? (
            <Badge variant="neutral">Sample data</Badge>
          ) : active > 0 ? (
            <Badge variant="accent">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
              {active} processing
            </Badge>
          ) : undefined
        }
      />

      {loading ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <Card key={i} className="space-y-3">
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-6 w-full max-w-md" />
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card className="p-10 text-center text-sm text-muted">
          {error}{" "}
          <button
            type="button"
            onClick={() => void refresh()}
            className="font-medium text-accent hover:text-accent-hover"
          >
            Retry
          </button>
        </Card>
      ) : latest.length === 0 ? (
        <EmptyState
          icon={Workflow}
          title="Nothing in the pipeline"
          description="When a source is added, you'll watch it move through every stage here in real time."
          action={
            <ButtonLink href="/knowledge/add" variant="accent" size="sm">
              <Plus className="h-4 w-4" />
              Add a source
            </ButtonLink>
          }
        />
      ) : (
        <div className="space-y-3">
          {latest.map((doc) => (
            <Card key={doc.id} className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
                <div className="flex min-w-0 items-center gap-3">
                  <SourceIcon sourceType={doc.source_type} />
                  <div className="min-w-0">
                    <p className="max-w-80 truncate text-sm font-medium text-primary">
                      {doc.title}
                    </p>
                    <p className="text-xs text-subtle">
                      {docMeta(doc) || "Processing…"} · {timeAgo(doc.created_at)}
                    </p>
                  </div>
                </div>
                <PipelineStages doc={doc} />
              </div>
              {doc.status === "failed" && doc.error && (
                <p className="mt-3 rounded-lg border border-danger/25 bg-danger/5 px-3 py-2 text-xs leading-5 text-danger">
                  {doc.error}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
