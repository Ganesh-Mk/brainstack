"use client";

import { useEffect, useState } from "react";
import { Globe, MessagesSquare, Search, Sparkles, Zap } from "lucide-react";
import {
  api,
  type ApiMessage,
  type ApiTraceStep,
  isBackendConfigured,
} from "@/lib/api";
import { timeAgo } from "@/lib/time";
import { TraceSteps, traceDuration } from "@/components/ask/TraceSteps";
import { EmptyState } from "@/components/patterns/EmptyState";
import { PageHeader } from "@/components/patterns/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSessionStore } from "@/stores/session";

type TraceEntry = {
  id: string;
  question: string;
  conversationTitle: string;
  trace: ApiTraceStep[];
  created_at: string;
};

const DEMO_ENTRIES: TraceEntry[] = [
  {
    id: "demo-action",
    question: "Assign the login-bug ticket to Priya and show her workload",
    conversationTitle: "Ticket triage",
    trace: [
      { n: 1, kind: "planning", label: "Planning" },
      { n: 2, kind: "action", label: "Company MCP · assign_ticket", detail: "ticket_key: login-bug, assignee: Priya", ms: 610 },
      { n: 3, kind: "action", label: "Company MCP · get_analytics", detail: "employee: Priya", ms: 240 },
      { n: 4, kind: "planning", label: "Reviewing results" },
      { n: 5, kind: "drafting", label: "Drafting the answer", ms: 2100 },
    ],
    created_at: new Date(Date.now() - 1500e3).toISOString(),
  },
  {
    id: "demo",
    question: "Compare our refund policy with what competitors offer",
    conversationTitle: "Refund policy comparison",
    trace: [
      { n: 1, kind: "planning", label: "Planning" },
      { n: 2, kind: "knowledge", label: "Searching knowledge", detail: "refund policy terms", ms: 430 },
      { n: 3, kind: "web", label: "Searching the web", detail: "industry standard refund policies", ms: 1800 },
      { n: 4, kind: "planning", label: "Reviewing results" },
      { n: 5, kind: "drafting", label: "Drafting the answer", ms: 3400 },
    ],
    created_at: new Date(Date.now() - 3600e3).toISOString(),
  },
];

const RECENT_CONVERSATIONS = 6;

export function AgentTraceView() {
  const demo = !isBackendConfigured;
  const token = useSessionStore((s) => s.token);
  const [entries, setEntries] = useState<TraceEntry[] | null>(
    demo ? DEMO_ENTRIES : null,
  );

  useEffect(() => {
    if (demo || !token) return;
    const t = setTimeout(async () => {
      try {
        const convos = await api.listConversations(token);
        const details = await Promise.all(
          convos
            .slice(0, RECENT_CONVERSATIONS)
            .map((c) => api.getConversation(token, c.id)),
        );
        const found: TraceEntry[] = [];
        for (const detail of details) {
          detail.messages.forEach((m: ApiMessage, i: number) => {
            if (m.role !== "assistant" || !m.trace?.length) return;
            const prev = detail.messages[i - 1];
            found.push({
              id: m.id,
              question: prev?.role === "user" ? prev.content : "(question)",
              conversationTitle: detail.title,
              trace: m.trace,
              created_at: m.created_at,
            });
          });
        }
        found.sort((a, b) => b.created_at.localeCompare(a.created_at));
        setEntries(found.slice(0, 12));
      } catch {
        setEntries([]);
      }
    }, 0);
    return () => clearTimeout(t);
  }, [demo, token]);

  const toolBadges = (trace: ApiTraceStep[]) => {
    const used = new Set(trace.map((s) => s.kind));
    return (
      <span className="flex items-center gap-1.5">
        {used.has("knowledge") && (
          <Badge variant="accent">
            <Search className="h-3 w-3" /> Knowledge
          </Badge>
        )}
        {used.has("web") && (
          <Badge variant="accent">
            <Globe className="h-3 w-3" /> Web
          </Badge>
        )}
        {used.has("action") && (
          <Badge variant="warning">
            <Zap className="h-3 w-3" /> Action
          </Badge>
        )}
      </span>
    );
  };

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        icon={Sparkles}
        title="Agent Trace"
        description="How each answer was produced — the agent's plan, the tools it chose, and how long every step took."
        badge={demo ? <Badge variant="neutral">Sample data</Badge> : undefined}
      />

      {entries === null ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <Card key={i} className="space-y-3">
              <Skeleton className="h-4 w-72" />
              <Skeleton className="h-24 w-full max-w-sm" />
            </Card>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title="No traces yet"
          description="Ask a question and the agent's reasoning will be recorded here — every step, every tool, every millisecond."
          action={
            <ButtonLink href="/ask" variant="accent" size="sm">
              <Sparkles className="h-4 w-4" />
              Ask something
            </ButtonLink>
          }
        />
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <Card key={entry.id} className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
                <div className="min-w-0">
                  <p className="max-w-xl truncate text-sm font-medium text-primary">
                    “{entry.question}”
                  </p>
                  <p className="mt-0.5 text-xs text-subtle">
                    {entry.conversationTitle} · {timeAgo(entry.created_at)}
                    {traceDuration(entry.trace) && (
                      <> · {traceDuration(entry.trace)} total</>
                    )}
                  </p>
                </div>
                {toolBadges(entry.trace)}
              </div>
              <div className="mt-4 max-w-md">
                <TraceSteps steps={entry.trace} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
