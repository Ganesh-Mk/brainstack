"use client";

import { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import { api, isBackendConfigured } from "@/lib/api";
import { KpiTile } from "@/components/ui/KpiTile";
import { useSessionStore } from "@/stores/session";

/** Dashboard KPI #2 goes live: total questions asked by this user. */
export function QuestionsAskedTile() {
  const token = useSessionStore((s) => s.token);
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!isBackendConfigured || !token) return;
    const t = setTimeout(() => {
      void api
        .listConversations(token)
        .then((convos) =>
          setCount(convos.reduce((sum, c) => sum + c.question_count, 0)),
        )
        .catch(() => setCount(null));
    }, 0);
    return () => clearTimeout(t);
  }, [token]);

  if (!isBackendConfigured) {
    return (
      <KpiTile
        label="Questions asked"
        value="1,284"
        delta="+12% this week"
        deltaTone="up"
        icon={MessageSquare}
      />
    );
  }

  return (
    <KpiTile
      label="Questions asked"
      value={count === null ? "—" : String(count)}
      delta="live · yours"
      deltaTone="neutral"
      icon={MessageSquare}
    />
  );
}
