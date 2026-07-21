"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  api,
  type ApiTenant,
  type ApiUser,
  type ApiWorkspace,
  isBackendConfigured,
} from "@/lib/api";
import type { Role } from "@/lib/nav";

/**
 * Session store.
 *
 * With a backend configured (NEXT_PUBLIC_API_URL set), this holds a real JWT
 * session: signup/login store the token + user + tenant, and `hydrate()`
 * re-validates it against /auth/me on load. With no backend (the deployed
 * Phase 1 site before the API deploys), it falls back to the original demo
 * identity so the product stays fully explorable.
 *
 * `role` is what the sidebar / command palette / pages gate on. When logged
 * in it mirrors the account's real role; the avatar-menu role simulator can
 * still override it locally to preview the RBAC — that's a UI tool, it never
 * changes the account or the token.
 *
 * `workspaces` is the real list from /auth/workspaces — every tenant where
 * this email has a user row. Switching mints a fresh token server-side, then
 * the app reloads so every page refetches inside the new workspace.
 */

const DEMO_USER: ApiUser = {
  id: "demo",
  email: "you@lovelydesign.in",
  name: "Demo User",
  role: "admin",
};
const DEMO_TENANT: ApiTenant = {
  id: "lovely",
  name: "Lovely",
  slug: "lovely",
};

type SessionState = {
  token: string | null;
  user: ApiUser;
  tenant: ApiTenant;
  workspaces: ApiWorkspace[];
  /** Effective role for RBAC gating (may be a simulated preview). */
  role: Role;
  /** True when this is a real logged-in account (not demo, not simulated). */
  authed: boolean;

  setRole: (role: Role) => void;

  loginWith: (result: {
    access_token: string;
    user: ApiUser;
    tenant: ApiTenant;
  }) => void;
  logout: () => void;
  hydrate: () => Promise<void>;
  loadWorkspaces: () => Promise<void>;
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      token: null,
      user: DEMO_USER,
      tenant: DEMO_TENANT,
      workspaces: isBackendConfigured
        ? []
        : [{ tenant: DEMO_TENANT, role: "admin" as Role }],
      role: "admin",
      authed: false,

      setRole: (role) => set({ role }),

      loginWith: ({ access_token, user, tenant }) =>
        set({
          token: access_token,
          user,
          tenant,
          workspaces: [{ tenant, role: user.role }],
          role: user.role,
          authed: true,
        }),

      logout: () =>
        set({
          token: null,
          user: DEMO_USER,
          tenant: DEMO_TENANT,
          workspaces: [],
          role: "admin",
          authed: false,
        }),

      // Re-validate a persisted token on app load; drop it if the server
      // rejects it (expired/revoked). No-op in demo mode.
      hydrate: async () => {
        const token = get().token;
        if (!isBackendConfigured || !token) return;
        try {
          const { user, tenant } = await api.me(token);
          set({ user, tenant, role: user.role, authed: true });
          void get().loadWorkspaces();
        } catch {
          get().logout();
        }
      },

      loadWorkspaces: async () => {
        const token = get().token;
        if (!isBackendConfigured || !token) return;
        try {
          set({ workspaces: await api.listWorkspaces(token) });
        } catch {
          /* keep whatever we had — the switcher degrades to current tenant */
        }
      },
    }),
    {
      name: "brainstack-session",
      partialize: (s) => ({
        token: s.token,
        user: s.user,
        tenant: s.tenant,
        role: s.role,
        authed: s.authed,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<SessionState>),
      }),
    },
  ),
);
