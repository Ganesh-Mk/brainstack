"use client";

import { useEffect, useState } from "react";
import { Brain, MessageSquare, Trash2 } from "lucide-react";
import {
  api,
  ApiError,
  type ApiMemory,
  isBackendConfigured,
} from "@/lib/api";
import { timeAgo } from "@/lib/time";
import { useMounted } from "@/hooks/useMounted";
import { EmptyState } from "@/components/patterns/EmptyState";
import { PageHeader } from "@/components/patterns/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSessionStore } from "@/stores/session";
import { toast } from "@/stores/toast";

const DEMO_MEMORIES: ApiMemory[] = [
  { id: "m1", content: "The user's name is Alex.", conversation_id: null, created_at: new Date(Date.now() - 86400e3 * 2).toISOString() },
  { id: "m2", content: "The user works on the Payments team.", conversation_id: null, created_at: new Date(Date.now() - 86400e3 * 4).toISOString() },
  { id: "m3", content: "The user prefers concise answers with bullet points.", conversation_id: null, created_at: new Date(Date.now() - 86400e3 * 6).toISOString() },
];

export function MemoryView() {
  const mounted = useMounted();
  const demo = !isBackendConfigured;
  const token = useSessionStore((s) => s.token);
  const [memories, setMemories] = useState<ApiMemory[] | null>(
    demo ? DEMO_MEMORIES : null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (demo || !token) return;
    const t = setTimeout(async () => {
      try {
        setMemories(await api.listMemories(token));
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Failed to load memories.");
      }
    }, 0);
    return () => clearTimeout(t);
  }, [demo, token]);

  const remove = async (m: ApiMemory) => {
    if (demo || !token) {
      toast("Demo mode", "Forgetting works once your workspace is live.");
      return;
    }
    try {
      await api.deleteMemory(token, m.id);
      setMemories((prev) => (prev ?? []).filter((x) => x.id !== m.id));
      toast("Forgotten", "That memory (and its embedding) is gone.");
    } catch (e) {
      toast(
        "Couldn't delete",
        e instanceof ApiError ? e.message : "Try again.",
        "error",
      );
    }
  };

  if (!mounted)
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        icon={Brain}
        title="Memory"
        description="Durable facts you've told the assistant — extracted automatically, recalled when relevant, yours to delete."
        badge={demo ? <Badge variant="neutral">Sample data</Badge> : undefined}
      />

      <Card className="bg-canvas">
        <p className="text-xs leading-6 text-muted">
          <span className="font-semibold text-primary">How memory works:</span>{" "}
          short-term memory is the conversation itself — a sliding window of
          recent turns plus an automatic summary of everything older. Long-term
          memory is this list: after each answer, an extractor pulls durable
          facts <em>you</em> stated (most exchanges contain none). Relevant
          facts are quietly added to the assistant&apos;s context on your next
          question — in any conversation.
        </p>
      </Card>

      {memories === null && !error ? (
        <Skeleton className="h-48 w-full rounded-2xl" />
      ) : error ? (
        <Card className="bg-canvas text-sm text-muted">{error}</Card>
      ) : (memories ?? []).length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="Nothing remembered yet"
          description="Tell the assistant something about yourself in a conversation — “I'm Alex, I run the Bangalore office” — and it will show up here."
        />
      ) : (
        <ul className="space-y-2.5">
          {(memories ?? []).map((m) => (
            <li key={m.id}>
              <Card className="flex items-center justify-between gap-4 py-3.5">
                <div className="min-w-0">
                  <p className="text-sm leading-6 text-primary">{m.content}</p>
                  <p className="mt-0.5 text-xs text-subtle">
                    learned {timeAgo(m.created_at)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void remove(m)}
                  aria-label="Forget this memory"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
