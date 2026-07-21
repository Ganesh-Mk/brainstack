import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Knowledge & ingestion",
  description:
    "Supported formats, the ingestion pipeline, chunking behavior, retrieval, and what deleting a source really does.",
};

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-12 text-xl font-semibold tracking-tight text-primary">
      {children}
    </h2>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-sm leading-6 text-muted">{children}</p>;
}

const STAGES: [string, string][] = [
  ["Extract", "Text is pulled out page by page (PDF) or from the cleaned article body (web pages — navigation and ads are stripped). Every piece is tagged with your workspace."],
  ["Chunk", "Text is split into overlapping passages of ~400 tokens with an 80-token overlap, so ideas that straddle a boundary aren't lost. This size is lab-measured against a golden dataset — not a guess."],
  ["Embed", "Each passage becomes a meaning vector using a sentence-embedding model, in parallel batches."],
  ["Index", "Vectors land in your workspace's own private namespace. No other workspace can ever retrieve them."],
];

export default function KnowledgeDocsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 lg:py-20">
      <Link
        href="/docs"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Docs
      </Link>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-primary">
        Knowledge &amp; ingestion
      </h1>
      <p className="mt-4 text-base leading-7 text-muted">
        What happens between &quot;upload&quot; and &quot;the assistant cited
        page 12&quot; — formats, the pipeline, retrieval, and deletion.
      </p>

      <H2>Supported sources</H2>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-raised/60 text-xs text-subtle">
            <tr>
              <th className="px-4 py-2.5 font-semibold">Source</th>
              <th className="px-4 py-2.5 font-semibold">Limits</th>
              <th className="px-4 py-2.5 font-semibold">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-muted">
            <tr>
              <td className="px-4 py-2.5 font-medium text-primary">PDF</td>
              <td className="px-4 py-2.5">up to 15 MB per file</td>
              <td className="px-4 py-2.5">
                Text-based PDFs; page numbers are preserved for citations.
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2.5 font-medium text-primary">Web page</td>
              <td className="px-4 py-2.5">public URLs</td>
              <td className="px-4 py-2.5">
                The article body is fetched and cleaned; pages behind logins
                aren&apos;t supported yet.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <P>
        Uploads can also go through the API —{" "}
        <code className="rounded bg-surface-raised px-1 py-0.5 font-mono text-[0.85em]">
          POST /v1/documents
        </code>{" "}
        and{" "}
        <code className="rounded bg-surface-raised px-1 py-0.5 font-mono text-[0.85em]">
          POST /v1/documents/url
        </code>{" "}
        (see the{" "}
        <Link href="/docs/api" className="font-medium text-accent hover:underline">
          API reference
        </Link>
        ).
      </P>

      <H2>The pipeline</H2>
      <P>
        Every source moves through four stages, visible live on the Add
        Sources page:
      </P>
      <ol className="mt-4 space-y-3">
        {STAGES.map(([title, text], i) => (
          <li key={title}>
            <Card className="flex gap-3.5 p-4">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-xs font-semibold text-accent-700">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-primary">{title}</p>
                <p className="mt-0.5 text-sm leading-6 text-muted">{text}</p>
              </div>
            </Card>
          </li>
        ))}
      </ol>
      <P>
        A document is <strong className="text-primary">Ready</strong> when its
        last chunk is indexed — from that moment it&apos;s part of every
        answer&apos;s retrieval. If a stage fails, the document shows{" "}
        <strong className="text-primary">Failed</strong> with the actual error;
        delete it and re-add after fixing the source.
      </P>

      <H2>How retrieval works</H2>
      <P>
        Questions don&apos;t just do a similarity lookup. BrainStack runs{" "}
        <strong className="text-primary">hybrid retrieval</strong>: a dense
        vector search (meaning) and a BM25 keyword search (exact terms like
        error codes or product names) run side by side, and the two rankings
        are fused. That&apos;s why <em>&quot;ERR_4021&quot;</em> hits even when
        embeddings alone would miss it. The top passages become the numbered
        citations in the answer — every fact in an answer traces back to one.
      </P>

      <H2>Deleting a source</H2>
      <P>
        Removing a document from the Library deletes its indexed knowledge{" "}
        <strong className="text-primary">immediately and everywhere</strong> —
        the stored file, the chunks, and the vectors in your namespace. The
        next question simply can&apos;t draw on it. Existing answers keep
        their text, but their citations into that source no longer open.
      </P>

      <H2>Getting better answers</H2>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-muted">
        <li>
          • Prefer text-native PDFs over scans — extraction quality decides
          answer quality.
        </li>
        <li>
          • Split giant compilations into topical documents; retrieval ranks
          passages, and focused sources produce cleaner passages.
        </li>
        <li>
          • Index the page that CONTAINS the facts, not a landing page that
          links to them.
        </li>
      </ul>

      <div className="mt-12 flex flex-wrap gap-3">
        <Link
          href="/docs/mcp"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
        >
          Next: Connecting your systems (MCP){" "}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
