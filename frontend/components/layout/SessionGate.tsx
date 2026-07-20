"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isBackendConfigured } from "@/lib/api";
import { useMounted } from "@/hooks/useMounted";
import { useSessionStore } from "@/stores/session";

/**
 * Protects the app shell. With a backend configured, an unauthenticated
 * visitor is bounced to /login; a persisted token is re-validated against
 * /auth/me on mount. With no backend (deployed Phase 1 demo), it's a
 * transparent pass-through so the product stays explorable.
 */
export function SessionGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const mounted = useMounted();
  const authed = useSessionStore((s) => s.authed);
  const hydrate = useSessionStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (mounted && isBackendConfigured && !authed) {
      router.replace("/login");
    }
  }, [mounted, authed, router]);

  // Before hydration, or while redirecting an unauthed visitor, render nothing
  // to avoid a flash of the protected shell.
  if (isBackendConfigured && mounted && !authed) return null;

  return <>{children}</>;
}
