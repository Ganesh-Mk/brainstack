"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * True after hydration, false during SSR and the first client render.
 * Components that read persisted stores (sidebar state, mock role, theme)
 * render server-safe defaults until mounted, avoiding hydration mismatches.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true, // client snapshot
    () => false, // server snapshot
  );
}
