"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSessionStore } from "@/stores/session";

/**
 * Tier-1 citations: the source PDF, opened at the cited page. The file comes
 * through the auth'd backend endpoint as a blob (the bucket is private), so
 * we mint an object URL and hand it to the browser's built-in viewer with
 * `#page=N`.
 */
export function PdfViewer({
  documentId,
  page,
  title,
  onClose,
}: {
  documentId: string | null;
  page: number;
  title: string;
  onClose: () => void;
}) {
  const token = useSessionStore((s) => s.token);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!documentId || !token) return;
    let objectUrl: string | null = null;
    let cancelled = false;

    api
      .fetchDocumentFile(token, documentId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(
        (e) =>
          !cancelled &&
          setError(
            e instanceof Error && e.message
              ? e.message
              : "Couldn't load the document.",
          ),
      );

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setUrl(null);
      setError(null);
    };
  }, [documentId, token]);

  return (
    <Modal
      open={documentId !== null}
      onClose={onClose}
      title={`${title} — page ${page}`}
      size="xl"
    >
      {error ? (
        <p className="py-16 text-center text-sm text-muted">{error}</p>
      ) : url ? (
        <iframe
          src={`${url}#page=${page}`}
          title={title}
          className="h-[70vh] w-full rounded-lg border border-border bg-surface-raised"
        />
      ) : (
        <Skeleton className="h-[70vh] w-full rounded-lg" />
      )}
    </Modal>
  );
}
