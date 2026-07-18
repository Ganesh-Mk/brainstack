import type { Metadata } from "next";
import { ComingSoon } from "@/components/patterns/ComingSoon";
import { PreviewCard } from "@/components/patterns/preview";

export const metadata: Metadata = { title: "Models & cost" };

const MODEL_ROWS = [
  { task: "Agent planning & reasoning", model: "claude-opus-4-8" },
  { task: "Answer synthesis", model: "claude-sonnet-5" },
  { task: "Evaluation judge", model: "claude-haiku-4-5" },
  { task: "Embeddings", model: "text-embedding-3-small" },
];

function ModelsPreview() {
  return (
    <div className="space-y-4">
      <PreviewCard className="space-y-3">
        {MODEL_ROWS.map((row) => (
          <div
            key={row.task}
            className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
          >
            <p className="text-sm text-primary">{row.task}</p>
            <span className="rounded-lg border border-border-strong bg-canvas px-3 py-1.5 font-mono text-xs text-muted">
              {row.model}
            </span>
          </div>
        ))}
      </PreviewCard>
      <PreviewCard>
        <p className="text-sm font-semibold text-primary">
          Hard token ceiling per request
        </p>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-2 flex-1 rounded-full bg-surface-raised">
            <div className="h-full w-1/3 rounded-full bg-accent" />
          </div>
          <span className="font-mono text-xs text-muted">4,096 tokens</span>
        </div>
        <p className="mt-2 text-xs leading-5 text-subtle">
          Cost discipline is built in: cheap models by default, premium only
          where the quality earns it.
        </p>
      </PreviewCard>
    </div>
  );
}

export default function ModelsSettingsPage() {
  return (
    <ComingSoon
      href="/settings/models"
      bullets={[
        "Pick the model per task — reasoning, synthesis, judging",
        "Hard token ceilings on every request",
        "Embedding provider selection with cache-aware re-indexing",
        "Live cost estimates as you change the mix",
      ]}
      preview={<ModelsPreview />}
    />
  );
}
