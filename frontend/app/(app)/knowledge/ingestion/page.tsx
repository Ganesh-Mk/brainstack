import type { Metadata } from "next";
import { CircleCheck, FileText, LoaderCircle } from "lucide-react";
import { ComingSoon } from "@/components/patterns/ComingSoon";
import { PreviewCard } from "@/components/patterns/preview";
import { Progress } from "@/components/ui/Progress";

export const metadata: Metadata = { title: "Ingestion" };

const STEPS = [
  { label: "Extracting text", done: true },
  { label: "Splitting into chunks", done: true },
  { label: "Generating embeddings", done: false, progress: "212 / 312" },
  { label: "Indexing", done: false },
];

function IngestionPreview() {
  return (
    <div className="space-y-4">
      <PreviewCard>
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2.5 text-sm font-semibold text-primary">
            <FileText className="h-4 w-4 text-subtle" />
            security-whitepaper.pdf
          </p>
          <span className="text-xs font-medium text-accent">68%</span>
        </div>
        <Progress value={68} className="mt-3" />
        <ul className="mt-4 grid gap-2.5 sm:grid-cols-4">
          {STEPS.map((step) => (
            <li
              key={step.label}
              className="flex items-center gap-2 text-xs text-primary"
            >
              {step.done ? (
                <CircleCheck className="h-3.5 w-3.5 shrink-0 text-success" />
              ) : step.progress ? (
                <LoaderCircle className="h-3.5 w-3.5 shrink-0 animate-spin text-accent" />
              ) : (
                <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-border-strong" />
              )}
              <span>
                {step.label}
                {step.progress && (
                  <span className="ml-1 text-subtle">({step.progress})</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </PreviewCard>
      <PreviewCard>
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2.5 text-sm font-semibold text-primary">
            <FileText className="h-4 w-4 text-subtle" />
            policies-2026.pdf
          </p>
          <span className="flex items-center gap-1 text-xs font-medium text-success">
            <CircleCheck className="h-3.5 w-3.5" /> Indexed · 312 chunks
          </span>
        </div>
        <Progress value={100} className="mt-3" />
      </PreviewCard>
    </div>
  );
}

export default function IngestionPage() {
  return (
    <ComingSoon
      href="/knowledge/ingestion"
      bullets={[
        "Watch every document flow through extract → chunk → embed → index",
        "Live per-document progress with chunk counts",
        "Parallel processing — many documents at once",
        "Failures surface here with a reason and a retry",
      ]}
      preview={<IngestionPreview />}
    />
  );
}
