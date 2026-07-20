"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  FileText,
  FileUp,
  Globe,
  Upload,
  X,
} from "lucide-react";
import { api, ApiError, isBackendConfigured } from "@/lib/api";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/patterns/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FieldError, Hint, Input, Label } from "@/components/ui/Field";
import { useSessionStore } from "@/stores/session";
import { toast } from "@/stores/toast";

const MAX_MB = 15;
const MAX_BYTES = MAX_MB * 1024 * 1024;

function prettySize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AddSourcesView() {
  const router = useRouter();
  const token = useSessionStore((s) => s.token);
  const demo = !isBackendConfigured;

  // ── file upload state ──────────────────────────────────────────────────
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState("");
  const [uploading, setUploading] = useState(false);

  // ── url state ──────────────────────────────────────────────────────────
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState("");
  const [submittingUrl, setSubmittingUrl] = useState(false);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const accepted: File[] = [];
    let problem = "";
    for (const file of Array.from(incoming)) {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        problem = `“${file.name}” isn't a PDF. Only PDF files are supported for now.`;
        continue;
      }
      if (file.size === 0) {
        problem = `“${file.name}” is empty.`;
        continue;
      }
      if (file.size > MAX_BYTES) {
        problem = `“${file.name}” is over ${MAX_MB} MB.`;
        continue;
      }
      accepted.push(file);
    }
    setFileError(problem);
    if (accepted.length) {
      setFiles((prev) => {
        const names = new Set(prev.map((f) => f.name));
        return [...prev, ...accepted.filter((f) => !names.has(f.name))];
      });
    }
  }, []);

  const uploadAll = async () => {
    if (files.length === 0) return;
    if (demo || !token) {
      toast("Demo mode", "Uploads work once your workspace is live.");
      return;
    }
    setUploading(true);
    setFileError("");
    let ok = 0;
    for (const file of files) {
      try {
        await api.uploadDocument(token, file);
        ok += 1;
      } catch (e) {
        setFileError(
          e instanceof ApiError
            ? `“${file.name}”: ${e.message}`
            : `“${file.name}” failed to upload.`,
        );
        break;
      }
    }
    setUploading(false);
    if (ok > 0) {
      toast(
        ok === 1 ? "Ingestion started" : `${ok} documents queued`,
        "Watch progress in the Library.",
      );
      router.push("/knowledge");
    }
  };

  const submitUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = url.trim();
    if (!/^https?:\/\/.+\..+/.test(value)) {
      setUrlError("Enter a full web address, e.g. https://example.com/guide");
      return;
    }
    setUrlError("");
    if (demo || !token) {
      toast("Demo mode", "URL ingestion works once your workspace is live.");
      return;
    }
    setSubmittingUrl(true);
    try {
      await api.ingestUrl(token, value);
      toast("Fetching page", "The article is being read and indexed.");
      router.push("/knowledge");
    } catch (err) {
      setUrlError(
        err instanceof ApiError ? err.message : "Something went wrong.",
      );
    } finally {
      setSubmittingUrl(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        icon={Upload}
        title="Add sources"
        description="Grow this workspace's knowledge. Every source is read, chunked and indexed — then your assistant can answer from it."
        badge={demo ? <Badge variant="neutral">Demo mode</Badge> : undefined}
      />

      <div className="grid gap-4 lg:grid-cols-5">
        {/* ── Upload PDFs ─────────────────────────────────────────────── */}
        <Card className="space-y-4 lg:col-span-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-primary">
              <FileText className="h-4 w-4 text-accent" />
              Upload documents
            </p>
            <p className="mt-1 text-xs leading-5 text-muted">
              PDF · up to {MAX_MB} MB each. More formats arrive with a later
              phase.
            </p>
          </div>

          <div
            role="button"
            tabIndex={0}
            aria-label="Upload PDFs"
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              addFiles(e.dataTransfer.files);
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition",
              dragOver
                ? "border-accent bg-accent-soft"
                : "border-border-strong bg-canvas hover:border-accent/60 hover:bg-surface-raised/50",
            )}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface text-accent shadow-xs">
              <FileUp className="h-5 w-5" />
            </span>
            <p className="mt-3.5 text-sm font-medium text-primary">
              {dragOver ? "Drop to add" : "Drop PDFs here, or click to browse"}
            </p>
            <p className="mt-1 text-xs text-subtle">
              They stay private to this workspace.
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {files.length > 0 && (
            <ul className="space-y-2">
              {files.map((file) => (
                <li
                  key={file.name}
                  className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2"
                >
                  <FileText className="h-4 w-4 shrink-0 text-subtle" />
                  <span className="min-w-0 flex-1 truncate text-sm text-primary">
                    {file.name}
                  </span>
                  <span className="font-mono text-[11px] whitespace-nowrap text-subtle">
                    {prettySize(file.size)}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${file.name}`}
                    disabled={uploading}
                    onClick={() =>
                      setFiles((prev) => prev.filter((f) => f !== file))
                    }
                    className="rounded p-1 text-subtle transition hover:bg-surface-raised hover:text-primary"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {fileError && <FieldError>{fileError}</FieldError>}

          {files.length > 0 && (
            <Button
              variant="accent"
              className="w-full"
              onClick={() => void uploadAll()}
              disabled={uploading}
            >
              <Upload className="h-4 w-4" />
              {uploading
                ? "Uploading…"
                : files.length === 1
                  ? "Upload and index"
                  : `Upload ${files.length} documents`}
            </Button>
          )}
        </Card>

        {/* ── Right column ─────────────────────────────────────────────── */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <p className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Globe className="h-4 w-4 text-accent" />
              Add a web page
            </p>
            <p className="mt-1 text-xs leading-5 text-muted">
              The article is fetched and cleaned — navigation and ads are
              stripped automatically.
            </p>
            <form onSubmit={submitUrl} className="mt-4 space-y-3" noValidate>
              <div>
                <Label htmlFor="source-url">Page URL</Label>
                <Input
                  id="source-url"
                  type="url"
                  inputMode="url"
                  placeholder="https://docs.company.com/policies"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
                {urlError ? (
                  <FieldError>{urlError}</FieldError>
                ) : (
                  <Hint>
                    Public pages only — logins aren&apos;t supported yet.
                  </Hint>
                )}
              </div>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="w-full"
                disabled={submittingUrl}
              >
                {submittingUrl ? "Fetching…" : "Fetch and index"}
                {!submittingUrl && <ArrowRight className="h-4 w-4" />}
              </Button>
            </form>
          </Card>

          <Card className="bg-canvas">
            <p className="text-xs font-semibold tracking-wide text-subtle uppercase">
              What happens next
            </p>
            <ol className="mt-3 space-y-2.5">
              {[
                ["Extract", "Text is pulled out, page by page."],
                ["Chunk", "Split into overlapping passages."],
                ["Embed", "Each passage becomes a meaning vector."],
                ["Index", "Stored in your workspace's private index."],
              ].map(([step, detail], i) => (
                <li key={step} className="flex gap-2.5 text-xs leading-5">
                  <span className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-surface-raised font-mono text-[10px] font-semibold text-muted">
                    {i + 1}
                  </span>
                  <span className="text-muted">
                    <span className="font-medium text-primary">{step}</span>{" "}
                    — {detail}
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}
