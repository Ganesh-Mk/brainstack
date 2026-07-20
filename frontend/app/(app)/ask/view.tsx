"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  ExternalLink,
  FileText,
  Globe,
  MessageSquare,
  MessagesSquare,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  api,
  ApiError,
  type ApiConversation,
  type ApiMessage,
  type ApiSource,
  isBackendConfigured,
  streamAsk,
} from "@/lib/api";
import { cn } from "@/lib/cn";
import { MessageContent } from "@/components/ask/MessageContent";
import { PdfViewer } from "@/components/ask/PdfViewer";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSessionStore } from "@/stores/session";
import { toast } from "@/stores/toast";

// ── Demo content (deployed site before the backend existed for it) ─────────

const DEMO_SOURCES: ApiSource[] = [
  {
    n: 1,
    document_id: "demo",
    title: "policies-2026",
    page: 12,
    text: "Clients may send back any deliverable within 30 days of final handover if it does not match the agreed specification. The studio issues the money back in full within 10 business days.",
    score: 0.62,
  },
  {
    n: 2,
    document_id: "demo",
    title: "policies-2026",
    page: 13,
    text: "After 30 days we offer studio credit rather than money back. Credit does not expire and may be applied to any future engagement.",
    score: 0.54,
  },
];

const DEMO_MESSAGES: ApiMessage[] = [
  {
    id: "demo-q",
    role: "user",
    content: "What changed in the refund policy?",
    sources: null,
    created_at: new Date(Date.now() - 60e3).toISOString(),
  },
  {
    id: "demo-a",
    role: "assistant",
    content:
      "Refunds are issued in full within **10 business days** for work sent back inside 30 days of handover [1]. After 30 days, clients receive **studio credit** instead — it never expires [2].",
    sources: DEMO_SOURCES,
    created_at: new Date(Date.now() - 55e3).toISOString(),
  },
];

// ── The view ────────────────────────────────────────────────────────────────

export function AskView() {
  const demo = !isBackendConfigured;
  const token = useSessionStore((s) => s.token);

  const [conversations, setConversations] = useState<ApiConversation[] | null>(
    demo ? [] : null,
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ApiMessage[]>(demo ? DEMO_MESSAGES : []);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [liveText, setLiveText] = useState("");
  const [liveSources, setLiveSources] = useState<ApiSource[] | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);

  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(
    demo ? "demo-a" : null,
  );
  const [activeCitation, setActiveCitation] = useState<number | null>(null);
  const [pdf, setPdf] = useState<{ id: string; page: number; title: string } | null>(
    null,
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── data loading ─────────────────────────────────────────────────────────

  const loadConversations = useCallback(async () => {
    if (demo || !token) return;
    try {
      setConversations(await api.listConversations(token));
    } catch {
      setConversations([]);
    }
  }, [demo, token]);

  useEffect(() => {
    const t = setTimeout(() => void loadConversations(), 0);
    return () => clearTimeout(t);
  }, [loadConversations]);

  const openConversation = useCallback(
    async (id: string) => {
      if (!token) return;
      setActiveId(id);
      setLoadingMessages(true);
      setActiveCitation(null);
      try {
        const detail = await api.getConversation(token, id);
        setMessages(detail.messages);
        const lastAssistant = [...detail.messages]
          .reverse()
          .find((m) => m.role === "assistant" && m.sources?.length);
        setSelectedMessageId(lastAssistant?.id ?? null);
      } catch {
        toast("Couldn't open conversation", undefined, "error");
      } finally {
        setLoadingMessages(false);
      }
    },
    [token],
  );

  const newConversation = async () => {
    if (demo) {
      toast("Demo mode", "Real conversations start once your workspace is live.");
      return;
    }
    if (!token) return;
    const convo = await api.createConversation(token);
    setConversations((prev) => [convo, ...(prev ?? [])]);
    setActiveId(convo.id);
    setMessages([]);
    setSelectedMessageId(null);
    inputRef.current?.focus();
  };

  const removeConversation = async (id: string) => {
    if (!token) return;
    try {
      await api.deleteConversation(token, id);
      setConversations((prev) => (prev ?? []).filter((c) => c.id !== id));
      if (activeId === id) {
        setActiveId(null);
        setMessages([]);
        setSelectedMessageId(null);
      }
    } catch (e) {
      toast(
        "Couldn't delete",
        e instanceof ApiError ? e.message : undefined,
        "error",
      );
    }
  };

  // ── asking ───────────────────────────────────────────────────────────────

  const send = async () => {
    const question = input.trim();
    if (!question || streaming) return;
    if (demo) {
      toast("Demo mode", "Sign in on a live workspace to ask real questions.");
      return;
    }
    if (!token) return;

    let convoId = activeId;
    if (!convoId) {
      const convo = await api.createConversation(token);
      setConversations((prev) => [convo, ...(prev ?? [])]);
      setActiveId(convo.id);
      convoId = convo.id;
    }

    setInput("");
    setPendingQuestion(question);
    setStreaming(true);
    setLiveText("");
    setLiveSources(null);
    setActiveCitation(null);

    await streamAsk(token, convoId, question, {
      onSources: (sources) => setLiveSources(sources),
      onDelta: (text) => setLiveText((prev) => prev + text),
      onDone: () => {
        setStreaming(false);
        setPendingQuestion(null);
        setLiveText("");
        setLiveSources(null);
        void openConversation(convoId);
        void loadConversations();
      },
      onError: (message) => {
        setStreaming(false);
        setPendingQuestion(null);
        setLiveText("");
        setLiveSources(null);
        setInput(question); // give the question back — nothing was saved
        toast("Answer failed", message, "error");
      },
    });
  };

  // Auto-scroll as tokens arrive.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, liveText, pendingQuestion]);

  // ── sources panel data ──────────────────────────────────────────────────

  const selectedMessage =
    messages.find((m) => m.id === selectedMessageId) ?? null;
  const panelSources: ApiSource[] | null = streaming
    ? liveSources
    : (selectedMessage?.sources ?? null);

  const onCitation = (messageId: string) => (n: number) => {
    setSelectedMessageId(messageId);
    setActiveCitation(n);
  };

  const activeConvo = conversations?.find((c) => c.id === activeId);

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-4 md:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)_19rem]">
      {/* ── Conversations pane ─────────────────────────────────────────── */}
      <aside className="hidden min-h-0 flex-col rounded-2xl border border-border bg-surface shadow-xs md:flex">
        <div className="flex items-center justify-between border-b border-border px-3.5 py-3">
          <p className="text-xs font-semibold tracking-wide text-subtle uppercase">
            Conversations
          </p>
          <button
            type="button"
            onClick={() => void newConversation()}
            aria-label="New conversation"
            className="rounded-md p-1 text-subtle transition hover:bg-surface-raised hover:text-primary"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-1.5">
          {demo ? (
            <div className="group flex items-center rounded-lg bg-surface-raised px-2.5 py-2">
              <MessageSquare className="mr-2 h-3.5 w-3.5 shrink-0 text-subtle" />
              <span className="truncate text-xs font-medium text-primary">
                What changed in the refund policy?
              </span>
            </div>
          ) : conversations === null ? (
            [0, 1, 2].map((i) => <Skeleton key={i} className="h-8 rounded-lg" />)
          ) : conversations.length === 0 ? (
            <p className="px-2.5 py-6 text-center text-xs leading-5 text-subtle">
              No conversations yet.
              <br />
              Ask your first question →
            </p>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                className={cn(
                  "group flex cursor-pointer items-center rounded-lg px-2.5 py-2 transition",
                  c.id === activeId
                    ? "bg-surface-raised"
                    : "hover:bg-surface-raised/60",
                )}
                onClick={() => void openConversation(c.id)}
              >
                <MessageSquare className="mr-2 h-3.5 w-3.5 shrink-0 text-subtle" />
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-xs",
                    c.id === activeId
                      ? "font-medium text-primary"
                      : "text-muted",
                  )}
                >
                  {c.title}
                </span>
                <button
                  type="button"
                  aria-label={`Delete ${c.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    void removeConversation(c.id);
                  }}
                  className="ml-1 rounded p-0.5 text-subtle opacity-0 transition group-hover:opacity-100 hover:text-danger"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* ── Chat pane ──────────────────────────────────────────────────── */}
      <section className="flex min-h-0 flex-col rounded-2xl border border-border bg-surface shadow-xs">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-on-primary">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <p className="truncate text-sm font-semibold text-primary">
              {demo
                ? "Ask BrainStack"
                : (activeConvo?.title ?? "Ask BrainStack")}
            </p>
          </div>
          {demo && <Badge variant="neutral">Sample data</Badge>}
        </div>

        {/* messages */}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
          {loadingMessages ? (
            <div className="space-y-4">
              <Skeleton className="ml-auto h-9 w-2/5 rounded-xl" />
              <Skeleton className="h-24 w-4/5 rounded-xl" />
            </div>
          ) : messages.length === 0 && !pendingQuestion ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-canvas text-accent shadow-xs">
                <MessagesSquare className="h-5.5 w-5.5" />
              </span>
              <p className="mt-4 text-sm font-semibold text-primary">
                Ask anything about this workspace&apos;s knowledge
              </p>
              <p className="mt-1.5 max-w-sm text-xs leading-5 text-muted">
                Answers are built only from your indexed documents, with
                citations you can open at the exact page.
              </p>
              {!demo && (
                <ButtonLink
                  href="/knowledge"
                  variant="outline"
                  size="sm"
                  className="mt-4"
                >
                  <FileText className="h-3.5 w-3.5" />
                  See what&apos;s indexed
                </ButtonLink>
              )}
            </div>
          ) : (
            <div className="mx-auto max-w-2xl space-y-5">
              {messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm leading-6 text-on-primary">
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="flex">
                    <div
                      className={cn(
                        "max-w-[92%] rounded-2xl rounded-bl-md border px-4 py-3 transition",
                        m.id === selectedMessageId
                          ? "border-accent-200 bg-accent-soft/40"
                          : "border-border bg-canvas",
                      )}
                    >
                      <MessageContent
                        content={m.content}
                        onCitation={onCitation(m.id)}
                        activeCitation={
                          m.id === selectedMessageId ? activeCitation : null
                        }
                      />
                    </div>
                  </div>
                ),
              )}

              {pendingQuestion && (
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm leading-6 text-on-primary">
                    {pendingQuestion}
                  </div>
                </div>
              )}
              {streaming && (
                <div className="flex">
                  <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-border bg-canvas px-4 py-3">
                    {liveText ? (
                      <>
                        <MessageContent content={liveText} />
                        <span className="mt-1 inline-block h-3.5 w-0.5 animate-pulse bg-accent align-middle" />
                      </>
                    ) : (
                      <span className="flex items-center gap-1.5 py-0.5">
                        {[0, 150, 300].map((delay) => (
                          <span
                            key={delay}
                            className="h-1.5 w-1.5 animate-bounce rounded-full bg-border-strong"
                            style={{ animationDelay: `${delay}ms` }}
                          />
                        ))}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* composer */}
        <div className="border-t border-border p-3">
          <div className="mx-auto flex max-w-2xl items-end gap-2 rounded-xl border border-border-strong bg-canvas p-2 focus-within:border-accent">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder={
                demo
                  ? "Demo mode — sign in on a live workspace to ask"
                  : "Ask about your company's knowledge…"
              }
              disabled={streaming}
              className="max-h-30 min-h-6 flex-1 resize-none bg-transparent px-2 py-1 text-sm leading-6 text-primary outline-none placeholder:text-subtle disabled:opacity-60"
            />
            <Button
              size="sm"
              variant="accent"
              onClick={() => void send()}
              disabled={streaming || !input.trim()}
              aria-label="Send"
              className="h-8 w-8 shrink-0 rounded-lg p-0"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          </div>
          <p className="mx-auto mt-1.5 max-w-2xl px-1 text-[11px] text-subtle">
            Answers come only from indexed sources — when it isn&apos;t there,
            BrainStack says so.
          </p>
        </div>
      </section>

      {/* ── Sources pane ───────────────────────────────────────────────── */}
      <aside className="hidden min-h-0 flex-col rounded-2xl border border-border bg-surface shadow-xs xl:flex">
        <div className="border-b border-border px-3.5 py-3">
          <p className="text-xs font-semibold tracking-wide text-subtle uppercase">
            Sources
          </p>
        </div>
        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3">
          {!panelSources || panelSources.length === 0 ? (
            <p className="px-2 py-8 text-center text-xs leading-5 text-subtle">
              {streaming
                ? "Retrieving passages…"
                : "Ask a question, or click a citation, and the passages behind the answer appear here."}
            </p>
          ) : (
            panelSources.map((s) => (
              <div
                key={s.n}
                className={cn(
                  "rounded-xl border p-3 transition",
                  activeCitation === s.n
                    ? "border-accent bg-accent-soft/50"
                    : "border-border bg-canvas",
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex h-4.5 min-w-4.5 items-center justify-center rounded-md px-1 font-mono text-[10px] font-semibold",
                      activeCitation === s.n
                        ? "bg-accent text-on-accent"
                        : "bg-accent-soft text-accent-700",
                    )}
                  >
                    {s.n}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-primary">
                    {s.title}
                  </span>
                  {s.document_id !== "demo" && (
                    <button
                      type="button"
                      onClick={() =>
                        setPdf({ id: s.document_id, page: s.page, title: s.title })
                      }
                      className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-accent transition hover:bg-accent-soft"
                    >
                      p.{s.page}
                      <ExternalLink className="h-2.5 w-2.5" />
                    </button>
                  )}
                  {s.document_id === "demo" && (
                    <span className="text-[10px] text-subtle">p.{s.page}</span>
                  )}
                </div>
                <p className="mt-2 line-clamp-5 text-xs leading-5 text-muted">
                  {s.text}
                </p>
                <p className="mt-1.5 font-mono text-[10px] text-subtle">
                  relevance {s.score.toFixed(2)}
                </p>
              </div>
            ))
          )}
        </div>
        {panelSources && panelSources.length > 0 && (
          <p className="border-t border-border px-3.5 py-2.5 text-[11px] leading-4 text-subtle">
            <Globe className="mr-1 inline h-3 w-3 align-[-1px]" />
            Retrieved from this workspace&apos;s private index only.
          </p>
        )}
      </aside>

      <PdfViewer
        documentId={pdf?.id ?? null}
        page={pdf?.page ?? 1}
        title={pdf?.title ?? ""}
        onClose={() => setPdf(null)}
      />
    </div>
  );
}
