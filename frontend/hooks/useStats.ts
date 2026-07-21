"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  type ApiAnalytics,
  type ApiDashboardStats,
  type ApiEvalRun,
  type ApiQueryTrace,
  isBackendConfigured,
} from "@/lib/api";
import { useSessionStore } from "@/stores/session";

/** Phase 9 stats fetching. `adminOnly` pages honor the role simulator the
 * same way the company pages do: a simulated non-admin sees the gate. */
export function useStatsResource<T>(
  fetcher: (token: string) => Promise<T>,
  demoValue: T,
  adminOnly = false,
) {
  const token = useSessionStore((s) => s.token);
  const role = useSessionStore((s) => s.role);
  const demo = !isBackendConfigured;
  const allowed = !adminOnly || role === "admin";

  const [data, setData] = useState<T | null>(demo ? demoValue : null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    if (demo || !token || !allowed) return;
    setRefreshing(true);
    try {
      setData(await fetcher(token));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load stats.");
    } finally {
      setRefreshing(false);
    }
  }, [demo, token, allowed, fetcher]);

  useEffect(() => {
    if (demo || !token || !allowed) return;
    const t = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(t);
  }, [demo, token, allowed, refresh]);

  return {
    data,
    error,
    loading: !demo && allowed && data === null && error === null,
    demo,
    role,
    allowed,
    refresh,
    refreshing,
  };
}

// ── demo data (deployed site before a backend exists) ───────────────────────

export const DEMO_DASHBOARD: ApiDashboardStats = {
  documents: 3,
  documents_ready: 3,
  chunks: 352,
  conversations: 12,
  memories: 4,
  questions_asked: 87,
  avg_latency_ms: 5400,
  cost_usd_30d: 1.84,
  tool_usage: { knowledge: 61, web: 14, action: 6, reflection: 3 },
  recent_questions: [
    {
      question: "What is our refund policy?",
      status: "ok",
      latency_ms: 5200,
      tool_kinds: ["planning", "knowledge", "drafting"],
      created_at: new Date(Date.now() - 3600e3).toISOString(),
    },
    {
      question: "Compare our refund policy with the industry",
      status: "ok",
      latency_ms: 11800,
      tool_kinds: ["planning", "knowledge", "web", "drafting"],
      created_at: new Date(Date.now() - 7200e3).toISOString(),
    },
  ],
};

export const DEMO_ANALYTICS: ApiAnalytics = {
  window_days: 14,
  totals: { questions: 87, errors: 2, cost_usd: 1.84, input_tokens: 912_000, output_tokens: 64_000 },
  latency_ms: { p50: 4800, p95: 11200 },
  first_token_ms: { p50: 2100, p95: 4900 },
  per_day: Array.from({ length: 12 }, (_, i) => ({
    date: new Date(Date.now() - (11 - i) * 86400e3).toISOString().slice(0, 10),
    questions: [3, 5, 4, 7, 6, 9, 8, 11, 9, 13, 11, 14][i],
    errors: i === 4 ? 1 : 0,
    cost_usd: 0.02 + i * 0.01,
    avg_latency_ms: 4200 + (i % 4) * 600,
  })),
  tool_usage: { knowledge: 61, web: 14, action: 6, reflection: 3 },
  top_questions: [
    { question: "What is our refund policy?", count: 9 },
    { question: "How many days of annual leave do we get?", count: 7 },
    { question: "Compare our refund policy with the industry", count: 4 },
  ],
};

export const DEMO_TRACES: ApiQueryTrace[] = [
  {
    id: "t1", question: "Assign the login-bug ticket to Priya and show her workload",
    status: "ok", latency_ms: 9800, first_token_ms: 4100,
    tool_kinds: ["planning", "action", "drafting"], source_count: 0,
    input_tokens: 6200, output_tokens: 240, cost_usd: 0.0074,
    model: "claude-haiku-4-5", created_at: new Date(Date.now() - 1500e3).toISOString(),
  },
  {
    id: "t2", question: "Compare our refund policy with what competitors offer",
    status: "ok", latency_ms: 12400, first_token_ms: 5200,
    tool_kinds: ["planning", "knowledge", "web", "drafting"], source_count: 9,
    input_tokens: 9800, output_tokens: 410, cost_usd: 0.0119,
    model: "claude-haiku-4-5", created_at: new Date(Date.now() - 3600e3).toISOString(),
  },
  {
    id: "t3", question: "What does ERR_4021 mean?",
    status: "ok", latency_ms: 6100, first_token_ms: 2900,
    tool_kinds: ["planning", "knowledge", "drafting"], source_count: 6,
    input_tokens: 5100, output_tokens: 180, cost_usd: 0.006,
    model: "claude-haiku-4-5", created_at: new Date(Date.now() - 7200e3).toISOString(),
  },
];

export const DEMO_EVALS: ApiEvalRun[] = [
  {
    id: "e2", dataset_size: 22, faithfulness: 0.91, relevance: 0.95,
    retrieval_hit: 0.86, citation_validity: 1.0, model: "claude-haiku-4-5",
    notes: "chunk size 400 / overlap 80", per_question: null,
    created_at: new Date(Date.now() - 86400e3).toISOString(),
  },
  {
    id: "e1", dataset_size: 22, faithfulness: 0.82, relevance: 0.93,
    retrieval_hit: 0.77, citation_validity: 0.95, model: "claude-haiku-4-5",
    notes: "before hybrid retrieval", per_question: null,
    created_at: new Date(Date.now() - 4 * 86400e3).toISOString(),
  },
];
