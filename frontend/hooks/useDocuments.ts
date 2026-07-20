"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  ApiError,
  type ApiDocument,
  isBackendConfigured,
  isProcessing,
} from "@/lib/api";
import { useSessionStore } from "@/stores/session";

/** Demo-mode library — shown on the deployed site until the backend exists
 * for it, mirroring the dashboard's sample-data approach. */
export const DEMO_DOCUMENTS: ApiDocument[] = [
  {
    id: "demo-1",
    title: "policies-2026",
    source_type: "pdf",
    source_url: null,
    status: "ready",
    error: null,
    page_count: 48,
    chunk_count: 312,
    chunks_done: 312,
    created_at: new Date(Date.now() - 86400e3 * 2).toISOString(),
  },
  {
    id: "demo-2",
    title: "help.lovelydesign.in/refunds",
    source_type: "url",
    source_url: "https://help.lovelydesign.in/refunds",
    status: "ready",
    error: null,
    page_count: 1,
    chunk_count: 36,
    chunks_done: 36,
    created_at: new Date(Date.now() - 86400e3 * 3).toISOString(),
  },
  {
    id: "demo-3",
    title: "security-whitepaper",
    source_type: "pdf",
    source_url: null,
    status: "embedding",
    error: null,
    page_count: 32,
    chunk_count: 204,
    chunks_done: 121,
    created_at: new Date(Date.now() - 3600e3).toISOString(),
  },
];

const ACTIVE_POLL_MS = 1500;

/**
 * The tenant's document library, kept live.
 *
 * Polls every 1.5s while any document is still moving through the pipeline
 * (that's what animates the progress bars), and goes quiet once everything
 * is ready/failed. In demo mode it serves static sample data.
 */
export function useDocuments() {
  const token = useSessionStore((s) => s.token);
  const demo = !isBackendConfigured;

  const [docs, setDocs] = useState<ApiDocument[] | null>(demo ? DEMO_DOCUMENTS : null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The poll loop re-invokes refresh from a timeout; a ref avoids the
  // self-reference inside useCallback.
  const refreshRef = useRef<() => Promise<void>>(async () => {});

  const refresh = useCallback(async () => {
    if (demo || !token) return;
    try {
      const list = await api.listDocuments(token);
      setDocs(list);
      setError(null);

      if (timer.current) clearTimeout(timer.current);
      if (list.some((d) => isProcessing(d.status))) {
        timer.current = setTimeout(
          () => void refreshRef.current(),
          ACTIVE_POLL_MS,
        );
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load documents.");
    }
  }, [demo, token]);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    // Kick off via the same timer the poll loop uses — keeps setState out of
    // the effect body itself and gives one cleanup path for both.
    timer.current = setTimeout(() => void refreshRef.current(), 0);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [refresh]);

  return {
    docs,
    error,
    loading: docs === null && error === null,
    demo,
    token,
    refresh,
  };
}
