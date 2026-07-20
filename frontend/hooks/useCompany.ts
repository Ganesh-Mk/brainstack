"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  type ApiConnections,
  type ApiTicket,
  type ApiWorkforceRow,
  isBackendConfigured,
} from "@/lib/api";
import { useSessionStore } from "@/stores/session";

/**
 * Company-systems data (Phase 7). The pages gate on the EFFECTIVE role from
 * the session store — so the avatar-menu role simulator shows exactly what an
 * employee would see (nothing), even on an admin account. The backend
 * enforces the same rule for real with the account's true role.
 */

export const DEMO_CONNECTIONS: ApiConnections = {
  server: "Company Systems",
  transport: "streamable-http",
  configured: true,
  role: "admin",
  capable: true,
  connected: true,
  tools: [
    {
      name: "assign_ticket",
      description:
        "Assign (or reassign) a ticket to an employee. Use the ticket key (e.g. 'login-bug') or id (e.g. 'T-101') and the employee's name.",
    },
    {
      name: "list_tickets",
      description:
        "List the company's support/engineering tickets, optionally filtered by assignee name.",
    },
    {
      name: "get_analytics",
      description:
        "Workload analytics for the team, or one employee by name: open and in-progress tickets, closed this month, average resolution time.",
    },
  ],
};

export const DEMO_TICKETS: ApiTicket[] = [
  { id: "T-101", key: "login-bug", title: "Login fails with SSO accounts", status: "in_progress", assignee: "Priya N", priority: "high", updated_at: new Date(Date.now() - 1200e3).toISOString() },
  { id: "T-102", key: "checkout-crash", title: "Checkout crashes on saved cards", status: "in_progress", assignee: "Sara M", priority: "high", updated_at: new Date(Date.now() - 14400e3).toISOString() },
  { id: "T-103", key: "slow-dashboard", title: "Dashboard takes 8s to load", status: "open", assignee: null, priority: "medium", updated_at: new Date(Date.now() - 25200e3).toISOString() },
  { id: "T-104", key: "email-bounce", title: "Invite emails bouncing for gmail", status: "in_progress", assignee: "Dev K", priority: "medium", updated_at: new Date(Date.now() - 36000e3).toISOString() },
  { id: "T-105", key: "dark-mode", title: "Customer request: dark mode", status: "open", assignee: null, priority: "low", updated_at: new Date(Date.now() - 46800e3).toISOString() },
  { id: "T-106", key: "export-csv", title: "CSV export drops unicode names", status: "closed", assignee: "Priya N", priority: "medium", updated_at: new Date(Date.now() - 57600e3).toISOString() },
];

export const DEMO_WORKFORCE: ApiWorkforceRow[] = [
  { name: "Priya N", title: "Manager, Delivery", open: 0, in_progress: 1, closed_this_month: 3, avg_resolution_hours: 18 },
  { name: "Dev K", title: "Product Engineer", open: 0, in_progress: 1, closed_this_month: 3, avg_resolution_hours: 26 },
  { name: "Sara M", title: "Design Engineer", open: 0, in_progress: 1, closed_this_month: 4, avg_resolution_hours: 31 },
];

export function useCompanyResource<T>(
  fetcher: (token: string) => Promise<T>,
  demoValue: T,
) {
  const token = useSessionStore((s) => s.token);
  const role = useSessionStore((s) => s.role);
  const demo = !isBackendConfigured;
  // Honor the role simulator: an "employee" session never even asks.
  const allowed = role === "manager" || role === "admin";

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
      setError(
        e instanceof ApiError ? e.message : "Failed to reach the company system.",
      );
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
