"use client";

import { useCallback } from "react";
import { api, type ApiModelConfig } from "@/lib/api";
import { useStatsResource } from "@/hooks/useStats";
import { useMounted } from "@/hooks/useMounted";
import { AdminsOnly } from "@/components/patterns/ManagersOnly";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

const DEMO_CONFIG: ApiModelConfig = {
  answer_model: "claude-haiku-4-5",
  utility_model: "claude-haiku-4-5",
  local_model: "brainstack-3b",
  default_provider: "anthropic",
  embedding_model: "sentence-transformers/all-MiniLM-L6-v2",
  rerank_enabled: false,
  rerank_model: null,
  hybrid_search: true,
  chunk_size: 400,
  chunk_overlap: 80,
  answer_max_tokens: 1024,
  agent_max_steps: 4,
  rate_limit_per_hour: 60,
  prompt_cache: true,
  price_input_per_mtok: 1.0,
  price_output_per_mtok: 5.0,
  mcp_connected: true,
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-2.5 last:border-0">
      <p className="text-sm text-muted">{label}</p>
      <p className="text-right font-mono text-xs text-primary">{value}</p>
    </div>
  );
}

export function ModelsSettingsView() {
  const mounted = useMounted();
  const fetcher = useCallback((token: string) => api.modelConfig(token), []);
  const { data, error, loading, demo, allowed } =
    useStatsResource<ApiModelConfig>(fetcher, DEMO_CONFIG, true);

  if (!mounted) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (!allowed) return <AdminsOnly what="Model configuration" />;
  if (loading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (error) return <Card className="bg-canvas text-sm text-muted">{error}</Card>;

  const c = data ?? DEMO_CONFIG;
  const onOff = (b: boolean) => (
    <Badge variant={b ? "success" : "neutral"}>{b ? "on" : "off"}</Badge>
  );

  return (
    <div className="space-y-4">
      {demo && <Badge variant="neutral">Sample data</Badge>}
      <Card>
        <p className="text-xs font-semibold tracking-wide text-subtle uppercase">
          Models
        </p>
        <div className="mt-2">
          <Row
            label="Answers & agent"
            value={`${c.answer_model}${c.default_provider === "anthropic" ? " (default)" : ""}`}
          />
          <Row
            label="Fine-tuned, self-hosted"
            value={`${c.local_model}${c.default_provider === "local" ? " (default)" : ""}`}
          />
          <Row label="Utility (judges, memory, summaries)" value={c.utility_model} />
          <Row label="Embeddings" value={c.embedding_model} />
          <Row
            label="Cross-encoder rerank"
            value={c.rerank_enabled ? c.rerank_model : onOff(false)}
          />
          <Row label="Hybrid search (BM25 + RRF)" value={onOff(c.hybrid_search)} />
          <Row label="Prompt caching" value={onOff(c.prompt_cache)} />
        </div>
      </Card>
      <Card>
        <p className="text-xs font-semibold tracking-wide text-subtle uppercase">
          Budgets & cost
        </p>
        <div className="mt-2">
          <Row label="Chunk size / overlap" value={`${c.chunk_size} / ${c.chunk_overlap} tokens`} />
          <Row label="Answer budget" value={`${c.answer_max_tokens} tokens`} />
          <Row label="Agent tool-call cap" value={`${c.agent_max_steps} per question`} />
          <Row
            label="Rate limit"
            value={
              c.rate_limit_per_hour > 0
                ? `${c.rate_limit_per_hour} questions / hour / workspace`
                : "off"
            }
          />
          <Row
            label="Token prices (in / out)"
            value={`$${c.price_input_per_mtok} / $${c.price_output_per_mtok} per MTok`}
          />
        </div>
      </Card>
      <p className="text-xs leading-5 text-subtle">
        These values are environment-managed (12-factor) and shown here
        read-only — changing them is a deploy, not a click, on purpose.
      </p>
    </div>
  );
}
