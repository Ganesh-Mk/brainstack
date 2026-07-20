"use client";

import { create } from "zustand";

export type ToastVariant = "default" | "success" | "error";

export type Toast = {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
};

type ToastState = {
  toasts: Toast[];
  push: (t: Omit<Toast, "id" | "variant"> & { variant?: ToastVariant }) => void;
  dismiss: (id: number) => void;
};

let nextId = 1;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (t) =>
    set((s) => ({
      toasts: [
        ...s.toasts,
        { id: nextId++, variant: t.variant ?? "default", ...t },
      ].slice(-4), // keep the stack short
    })),
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((toast) => toast.id !== id) })),
}));

/** Convenience imperative API: `toast("Saved", "Your changes are live.")` */
export function toast(
  title: string,
  description?: string,
  variant: ToastVariant = "default",
) {
  useToastStore.getState().push({ title, description, variant });
}
