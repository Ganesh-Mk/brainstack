"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Role } from "@/lib/nav";

/**
 * MOCK session — Phase 1 has no backend. This store powers the demo:
 * the role simulator (avatar menu) flips `role`, and the sidebar / pages
 * show or hide capabilities accordingly. Replaced by real FastAPI JWT
 * sessions in Backend Phase 0.
 */
type SessionState = {
  user: { name: string; email: string };
  tenant: { id: string; name: string };
  tenants: { id: string; name: string }[];
  role: Role;
  setRole: (role: Role) => void;
  setTenant: (id: string) => void;
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      user: { name: "Demo User", email: "you@acme.example" },
      tenant: { id: "acme", name: "Acme Corp" },
      tenants: [
        { id: "acme", name: "Acme Corp" },
        { id: "globex", name: "Globex Ltd" },
      ],
      role: "admin",
      setRole: (role) => set({ role }),
      setTenant: (id) => {
        const tenant = get().tenants.find((t) => t.id === id);
        if (tenant) set({ tenant });
      },
    }),
    {
      name: "brainstack-session",
      partialize: (s) => ({ role: s.role, tenant: s.tenant }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<SessionState>),
      }),
    },
  ),
);
