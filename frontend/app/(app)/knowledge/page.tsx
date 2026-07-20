import type { Metadata } from "next";
import { FileText, Globe, Search } from "lucide-react";
import { ComingSoon } from "@/components/patterns/ComingSoon";
import { PreviewCard } from "@/components/patterns/preview";
import { Badge } from "@/components/ui/Badge";

export const metadata: Metadata = { title: "Library" };

const SAMPLE_DOCS = [
  {
    name: "policies-2026.pdf",
    kind: "PDF",
    icon: FileText,
    chunks: 312,
    status: "Ready",
    added: "Jul 12",
  },
  {
    name: "onboarding-handbook.docx",
    kind: "Word",
    icon: FileText,
    chunks: 148,
    status: "Ready",
    added: "Jul 11",
  },
  {
    name: "help.lovelydesign.in/refunds",
    kind: "URL",
    icon: Globe,
    chunks: 36,
    status: "Ready",
    added: "Jul 10",
  },
  {
    name: "security-whitepaper.pdf",
    kind: "PDF",
    icon: FileText,
    chunks: 204,
    status: "Indexing…",
    added: "Jul 10",
  },
];

function LibraryPreview() {
  return (
    <PreviewCard className="p-0">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div className="flex w-64 items-center gap-2 rounded-lg border border-border bg-canvas px-3 py-1.5 text-xs text-subtle">
          <Search className="h-3.5 w-3.5" /> Search sources…
        </div>
        <span className="rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-on-primary">
          + Add sources
        </span>
      </div>
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-canvas">
          <tr>
            {["Source", "Type", "Chunks", "Status", "Added"].map((h) => (
              <th
                key={h}
                className="px-5 py-2.5 text-left text-[10px] font-semibold tracking-wide text-muted uppercase"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SAMPLE_DOCS.map((doc) => (
            <tr key={doc.name} className="border-b border-border last:border-0">
              <td className="flex items-center gap-2.5 px-5 py-3 font-medium text-primary">
                <doc.icon className="h-4 w-4 text-subtle" />
                {doc.name}
              </td>
              <td className="px-5 py-3 text-muted">{doc.kind}</td>
              <td className="px-5 py-3 text-muted">{doc.chunks}</td>
              <td className="px-5 py-3">
                <Badge variant={doc.status === "Ready" ? "success" : "warning"}>
                  {doc.status}
                </Badge>
              </td>
              <td className="px-5 py-3 text-muted">{doc.added}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PreviewCard>
  );
}

export default function LibraryPage() {
  return (
    <ComingSoon
      href="/knowledge"
      bullets={[
        "Every source in one searchable list — PDFs, docs and URLs",
        "Status at a glance: processing, ready, failed",
        "Chunk counts and metadata per document",
        "Open any source and preview what the assistant sees",
        "Delete a source and its knowledge is gone everywhere, instantly",
      ]}
      preview={<LibraryPreview />}
    />
  );
}
