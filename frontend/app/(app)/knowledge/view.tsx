"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ExternalLink,
  FileText,
  Library,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { api, ApiError, type ApiDocument, isProcessing } from "@/lib/api";
import { timeAgo } from "@/lib/time";
import { PdfViewer } from "@/components/ask/PdfViewer";
import { docMeta, SourceIcon, StatusCell } from "@/components/knowledge/bits";
import { EmptyState } from "@/components/patterns/EmptyState";
import { PageHeader } from "@/components/patterns/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { Table, TD, TH, THead, TR } from "@/components/ui/Table";
import { useDocuments } from "@/hooks/useDocuments";
import { useMounted } from "@/hooks/useMounted";
import { useSessionStore } from "@/stores/session";
import { toast } from "@/stores/toast";

export function LibraryView() {
  const mounted = useMounted();
  const { docs, error, loading, demo, token, refresh } = useDocuments();
  const storeRole = useSessionStore((s) => s.role);
  const role = mounted ? storeRole : "admin";

  const [query, setQuery] = useState("");
  const [toDelete, setToDelete] = useState<ApiDocument | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pdf, setPdf] = useState<ApiDocument | null>(null);

  const filtered = useMemo(() => {
    if (!docs) return [];
    const q = query.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        (d.source_url ?? "").toLowerCase().includes(q),
    );
  }, [docs, query]);

  const confirmDelete = async () => {
    if (!toDelete) return;
    if (demo || !token) {
      toast("Demo mode", "Deleting works once your workspace is live.");
      setToDelete(null);
      return;
    }
    setDeleting(true);
    try {
      await api.deleteDocument(token, toDelete.id);
      toast("Source removed", `“${toDelete.title}” and its knowledge are gone.`);
      setToDelete(null);
      await refresh();
    } catch (e) {
      toast(
        "Couldn't delete",
        e instanceof ApiError ? e.message : "Something went wrong.",
        "error",
      );
    } finally {
      setDeleting(false);
    }
  };

  const readyCount = docs?.filter((d) => d.status === "ready").length ?? 0;

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        icon={Library}
        title="Library"
        description="Every source your workspace knows. Documents added here become the knowledge your assistant answers from."
        badge={demo ? <Badge variant="neutral">Sample data</Badge> : undefined}
        actions={
          role === "admin" ? (
            <ButtonLink href="/knowledge/add" variant="accent" size="sm">
              <Plus className="h-4 w-4" />
              Add sources
            </ButtonLink>
          ) : undefined
        }
      />

      <Card className="p-0">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-subtle" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search sources…"
              className="h-8 pl-9 text-xs"
              aria-label="Search sources"
            />
          </div>
          <span className="text-xs text-subtle">
            {docs
              ? `${docs.length} ${docs.length === 1 ? "source" : "sources"} · ${readyCount} ready`
              : ""}
          </span>
          {!demo && (
            <button
              type="button"
              onClick={() => void refresh()}
              aria-label="Refresh"
              className="ml-auto rounded-md p-1.5 text-subtle transition hover:bg-surface-raised hover:text-primary"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Body */}
        {loading ? (
          <div className="space-y-4 p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-52" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-10 text-center text-sm text-muted">
            {error}{" "}
            <button
              type="button"
              onClick={() => void refresh()}
              className="font-medium text-accent hover:text-accent-hover"
            >
              Retry
            </button>
          </div>
        ) : docs && docs.length === 0 ? (
          <EmptyState
            icon={Upload}
            title="No sources yet"
            description="Add your first PDF or URL and BrainStack will read, chunk and index it into this workspace's private knowledge."
            action={
              role === "admin" ? (
                <ButtonLink href="/knowledge/add" variant="accent" size="sm">
                  <Plus className="h-4 w-4" />
                  Add your first source
                </ButtonLink>
              ) : (
                <p className="text-xs text-subtle">
                  An admin can add sources to this workspace.
                </p>
              )
            }
            className="m-4"
          />
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-subtle">
            Nothing matches “{query}”.
          </div>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Source</TH>
                <TH className="hidden md:table-cell">Origin</TH>
                <TH>Status</TH>
                <TH className="hidden sm:table-cell">Added</TH>
                {role === "admin" && <TH className="w-10" aria-label="Actions" />}
              </TR>
            </THead>
            <tbody>
              {filtered.map((doc) => (
                <TR key={doc.id} className="group">
                  <TD>
                    <div className="flex items-center gap-3">
                      <SourceIcon sourceType={doc.source_type} />
                      <div className="min-w-0">
                        <p className="max-w-72 truncate text-sm font-medium text-primary">
                          {doc.title}
                        </p>
                        <p className="max-w-72 truncate text-xs text-subtle">
                          {docMeta(doc) ||
                            (isProcessing(doc.status) ? "Processing…" : "—")}
                        </p>
                      </div>
                    </div>
                  </TD>
                  <TD className="hidden md:table-cell">
                    {/* Where this knowledge actually came from — the live
                        page for web sources, the stored file for PDFs. */}
                    {doc.source_type === "url" && doc.source_url ? (
                      <a
                        href={doc.source_url}
                        target="_blank"
                        rel="noreferrer"
                        title={doc.source_url}
                        className="inline-flex max-w-56 items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-medium text-accent transition hover:bg-accent-soft"
                      >
                        <span className="min-w-0 truncate">
                          {(() => {
                            try {
                              return new URL(doc.source_url).hostname;
                            } catch {
                              return doc.source_url;
                            }
                          })()}
                        </span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    ) : doc.source_type === "pdf" ? (
                      <button
                        type="button"
                        onClick={() => setPdf(doc)}
                        disabled={demo}
                        className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-medium text-accent transition hover:bg-accent-soft disabled:opacity-60"
                      >
                        <FileText className="h-3 w-3 shrink-0" />
                        View PDF
                      </button>
                    ) : (
                      <span className="text-xs text-subtle">—</span>
                    )}
                  </TD>
                  <TD>
                    <StatusCell doc={doc} />
                  </TD>
                  <TD className="hidden text-xs whitespace-nowrap text-muted sm:table-cell">
                    {timeAgo(doc.created_at)}
                  </TD>
                  {role === "admin" && (
                    <TD>
                      <button
                        type="button"
                        onClick={() => setToDelete(doc)}
                        aria-label={`Delete ${doc.title}`}
                        className="rounded-md p-1.5 text-subtle opacity-0 transition group-hover:opacity-100 hover:bg-danger/10 hover:text-danger focus-visible:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </TD>
                  )}
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {!demo && docs && docs.length > 0 && (
        <p className="text-xs text-subtle">
          Sources are isolated to this workspace.{" "}
          <Link
            href="/knowledge/add"
            className="font-medium text-accent hover:text-accent-hover"
          >
            Watch the pipeline →
          </Link>
        </p>
      )}

      <Modal
        open={toDelete !== null}
        onClose={() => !deleting && setToDelete(null)}
        title="Remove this source?"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setToDelete(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => void confirmDelete()}
              disabled={deleting}
            >
              <Trash2 className="h-4 w-4" />
              {deleting ? "Removing…" : "Remove source"}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-6 text-muted">
          <span className="font-medium text-primary">“{toDelete?.title}”</span>{" "}
          will be removed from the library, and its indexed knowledge is
          deleted everywhere, immediately. Answers will no longer draw on it.
        </p>
      </Modal>

      <PdfViewer
        documentId={pdf?.id ?? null}
        page={1}
        title={pdf?.title ?? ""}
        onClose={() => setPdf(null)}
      />
    </div>
  );
}
