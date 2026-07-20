"use client";

import { useCallback, useState } from "react";
import { ChevronDown, ClipboardCheck, RefreshCw } from "lucide-react";
import { api, type ApiEvalRun } from "@/lib/api";
import { timeAgo } from "@/lib/time";
import { DEMO_EVALS, useStatsResource } from "@/hooks/useStats";
import { useMounted } from "@/hooks/useMounted";
import { AdminsOnly } from "@/components/patterns/ManagersOnly";
import { EmptyState } from "@/components/patterns/EmptyState";
import { PageHeader } from "@/components/patterns/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";

function Score({ label, value }: { label: string; value: number }) {
  const tone =
    value >= 0.9 ? "text-success" : value >= 0.75 ? "text-warning" : "text-danger";
  return (
    <div className="min-w-24">
      <p className="text-[10px] font-semibold tracking-wide text-subtle uppercase">
        {label}
      </p>
      <p className={cn("mt-0.5 font-mono text-lg font-semibold", tone)}>
        {value.toFixed(2)}
      </p>
    </div>
  );
}

export function EvaluationView() {
  const mounted = useMounted();
  const fetcher = useCallback(
    (token: string) => api.statsEvals(token).then((r) => r.runs),
    [],
  );
  const { data, error, loading, demo, allowed, refresh, refreshing } =
    useStatsResource<ApiEvalRun[]>(fetcher, DEMO_EVALS, true);
  const [open, setOpen] = useState<string | null>(null);

  if (!mounted)
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );

  const runs = data ?? [];

  return (
    <div className="bs-fade-up mx-auto w-full max-w-4xl space-y-6">
      <PageHeader
        icon={ClipboardCheck}
        title="Evaluation"
        description="Golden-dataset runs — proof the answers are good, as numbers that move when the system changes."
        badge={demo ? <Badge variant="neutral">Sample data</Badge> : undefined}
        actions={
          allowed && !demo ? (
            <Button variant="outline" size="sm" onClick={() => void refresh()}>
              <RefreshCw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              Refresh
            </Button>
          ) : undefined
        }
      />

      {!allowed ? (
        <AdminsOnly what="Evaluation history" />
      ) : loading ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : error ? (
        <Card className="bg-canvas text-sm text-muted">{error}</Card>
      ) : runs.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No eval runs yet"
          description="Run `python eval/run_eval.py` against the API — the scored run appears here, and the next one shows whether you made things better."
        />
      ) : (
        <div className="space-y-3">
          {runs.map((run, i) => (
            <Card key={run.id} className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-primary">
                    {run.dataset_size} questions · {run.model}
                    {i === 0 && (
                      <Badge variant="accent" className="ml-2">
                        latest
                      </Badge>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-subtle">
                    {run.created_at ? timeAgo(run.created_at) : ""}
                    {run.notes ? ` · ${run.notes}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-6">
                  <Score label="Faithfulness" value={run.faithfulness} />
                  <Score label="Relevance" value={run.relevance} />
                  <Score label="Retrieval hit" value={run.retrieval_hit} />
                  <Score label="Citations" value={run.citation_validity} />
                </div>
              </div>

              {run.per_question && (
                <>
                  <button
                    className="mt-3 flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                    onClick={() => setOpen(open === run.id ? null : run.id)}
                  >
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 transition-transform",
                        open === run.id && "rotate-180",
                      )}
                    />
                    {open === run.id ? "Hide" : "Show"} per-question breakdown
                  </button>
                  {open === run.id && (
                    <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
                      {run.per_question.map((q) => {
                        const ok =
                          q.faithfulness >= 0.5 && q.relevance >= 0.5 && q.retrieval_hit;
                        return (
                          <li
                            key={q.id}
                            className="flex items-baseline justify-between gap-3 text-xs"
                          >
                            <p className="min-w-0 truncate text-primary">
                              <span className={ok ? "text-success" : "text-danger"}>
                                {ok ? "✓" : "✗"}
                              </span>{" "}
                              {q.question}
                            </p>
                            <p className="shrink-0 font-mono text-subtle">
                              f{q.faithfulness.toFixed(1)} · r{q.relevance.toFixed(1)}
                              {q.expect_refusal && (q.refused ? " · refused ✓" : " · SHOULD refuse")}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
