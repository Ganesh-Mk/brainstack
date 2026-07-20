import type { Metadata } from "next";
import { FileUp, Globe, Link2, Upload } from "lucide-react";
import { ComingSoon } from "@/components/patterns/ComingSoon";
import { Ph, PreviewCard } from "@/components/patterns/preview";

export const metadata: Metadata = { title: "Add Sources" };

function AddSourcesPreview() {
  return (
    <div className="space-y-4">
      <PreviewCard className="flex flex-col items-center border-2 border-dashed border-border-strong bg-canvas py-12">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface text-accent shadow-xs">
          <FileUp className="h-5.5 w-5.5" />
        </span>
        <p className="mt-4 text-sm font-semibold text-primary">
          Drop files here, or click to browse
        </p>
        <p className="mt-1 text-xs text-subtle">
          PDF, Word, Markdown, plain text · up to 50&nbsp;MB each
        </p>
      </PreviewCard>
      <div className="grid gap-4 sm:grid-cols-2">
        <PreviewCard>
          <p className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Globe className="h-4 w-4 text-accent" /> Paste a URL
          </p>
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-border-strong bg-surface px-3 py-2 text-xs text-subtle">
            <Link2 className="h-3.5 w-3.5" /> https://help.acme.example/…
          </div>
        </PreviewCard>
        <PreviewCard>
          <p className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Upload className="h-4 w-4 text-accent" /> Connect a source
          </p>
          <div className="mt-3 flex gap-2">
            <Ph className="h-8 w-20" />
            <Ph className="h-8 w-20" />
            <Ph className="h-8 w-20" />
          </div>
        </PreviewCard>
      </div>
    </div>
  );
}

export default function AddSourcesPage() {
  return (
    <ComingSoon
      href="/knowledge/add"
      bullets={[
        "Drag-and-drop upload for PDFs, Word docs and text",
        "Paste any URL — the page is fetched and cleaned automatically",
        "Batch uploads that process in parallel",
        "Every source lands in YOUR workspace only — isolated per company",
      ]}
      preview={<AddSourcesPreview />}
    />
  );
}
