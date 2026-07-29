"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  ChevronRight,
  FileText,
  MessageSquare,
  MessagesSquare,
  PanelLeft,
  Plus,
  Trash2,
  Workflow,
  X,
} from "lucide-react";
import {
  api,
  ApiError,
  type ApiConversation,
  type ApiMessage,
  type ApiSource,
  type ApiTraceStep,
  isBackendConfigured,
  streamAsk,
} from "@/lib/api";
import { cn } from "@/lib/cn";
import { MessageContent } from "@/components/ask/MessageContent";
import { PdfViewer } from "@/components/ask/PdfViewer";
import { ModelPicker } from "@/components/ask/ModelPicker";
import { TraceSteps, traceDuration } from "@/components/ask/TraceSteps";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tooltip } from "@/components/ui/Tooltip";
import { useAskModelStore } from "@/stores/askModel";
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

const DEMO_TRACE: ApiTraceStep[] = [
  { n: 1, kind: "planning", label: "Planning" },
  { n: 2, kind: "knowledge", label: "Searching knowledge", detail: "refund policy changes", ms: 480 },
  { n: 3, kind: "drafting", label: "Drafting the answer", ms: 2100 },
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
    trace: DEMO_TRACE,
    created_at: new Date(Date.now() - 55e3).toISOString(),
  },
];

// ── Small pieces ────────────────────────────────────────────────────────────

/** "How the agent worked" — the trace lives INSIDE the chat, as a
 * collapsible disclosure on each answered message. */
function InlineTrace({ steps }: { steps: ApiTraceStep[] }) {
  const [open, setOpen] = useState(false);
  if (steps.length === 0) return null;
  const duration = traceDuration(steps);
  return (
    <div className="mb-2.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-[11px] font-medium text-subtle transition hover:bg-surface-raised hover:text-primary"
      >
        <ChevronRight
          className={cn("h-3 w-3 transition-transform", open && "rotate-90")}
        />
        <Workflow className="h-3 w-3 text-accent" />
        How the agent worked
        <span className="font-mono text-[10px]">
          · {steps.length} {steps.length === 1 ? "step" : "steps"}
          {duration ? ` · ${duration}` : ""}
        </span>
      </button>
      {open && (
        <div className="mt-2 rounded-xl border border-border bg-surface p-3">
          <TraceSteps steps={steps} />
        </div>
      )}
    </div>
  );
}

// ── The view ────────────────────────────────────────────────────────────────

export function AskView() {
  const demo = !isBackendConfigured;
  const token = useSessionStore((s) => s.token);

  const [historyOpen, setHistoryOpen] = useState(true); // desktop pane
  const [mobileHistory, setMobileHistory] = useState(false); // phone drawer
  const [conversations, setConversations] = useState<ApiConversation[] | null>(
    demo ? [] : null,
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ApiMessage[]>(demo ? DEMO_MESSAGES : []);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // null = send no `model` field, letting the server use its default.
  const model = useAskModelStore((s) => s.model);
  const setModel = useAskModelStore((s) => s.setModel);

  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [liveText, setLiveText] = useState("");
  const [liveSources, setLiveSources] = useState<ApiSource[] | null>(null);
  const [liveTrace, setLiveTrace] = useState<ApiTraceStep[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);

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
      try {
        const detail = await api.getConversation(token, id);
        setMessages(detail.messages);
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
      }
    } catch (e) {
      toast(
        "Couldn't delete",
        e instanceof ApiError ? e.message : undefined,
        "error",
      );
    }
  };

  // ── sources ──────────────────────────────────────────────────────────────

  const openSource = (s: ApiSource) => {
    if (s.document_id === "demo") {
      toast("Demo mode", "Source files open once your workspace is live.");
      return;
    }
    if (s.source_type === "url" && s.source_url) {
      window.open(s.source_url, "_blank", "noreferrer");
      return;
    }
    // A remembered fact has no document behind it — opening a PDF viewer on an
    // empty id would show a broken frame. Send them to Memory instead.
    if (s.source_type === "text" || !s.document_id) {
      toast("From your memory", "Manage remembered facts on the Memory page.");
      return;
    }
    setPdf({ id: s.document_id, page: s.page, title: s.title });
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
    setLiveTrace([]);

    await streamAsk(token, convoId, question, {
      onSources: (sources) => setLiveSources(sources),
      onTrace: (step) => setLiveTrace((prev) => [...prev, step]),
      onReset: () => setLiveText(""), // reflection rejected the draft
      onDelta: (text) => setLiveText((prev) => prev + text),
      onDone: () => {
        // Swap the streamed bubble for the persisted message in ONE render:
        // fetch the saved conversation silently (no loading skeleton), then
        // set messages and clear the live state together — React batches
        // them, so the answer never flickers or reloads.
        void (async () => {
          try {
            const detail = await api.getConversation(token, convoId);
            setMessages(detail.messages);
            setStreaming(false);
            setPendingQuestion(null);
            setLiveText("");
            setLiveSources(null);
            setLiveTrace([]);
          } catch {
            // Couldn't refetch — keep the streamed question + answer on
            // screen rather than flashing them away.
            setStreaming(false);
          }
          void loadConversations();
        })();
      },
      onError: (message) => {
        setStreaming(false);
        setPendingQuestion(null);
        setLiveText("");
        setLiveSources(null);
        setLiveTrace([]);
        setInput(question); // give the question back — nothing was saved
        toast("Answer failed", message, "error");
      },
    },
    // null = don't send `model` at all, so the server picks its own default.
    model ?? undefined);
  };

  // Auto-scroll as tokens arrive.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, liveText, liveTrace, pendingQuestion]);

  const activeConvo = conversations?.find((c) => c.id === activeId);

  // ── conversation history (shared by desktop pane and phone drawer) ──────

  const historyPane = (onClose: () => void) => (
    <div className="flex h-full w-64 flex-col border-r border-border bg-canvas">
      {/* h-12: identical to the chat header so the two borders align */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border pr-2 pl-3.5">
        <p className="text-xs font-semibold tracking-wide text-subtle uppercase">
          Conversations
        </p>
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => void newConversation()}
            aria-label="New conversation"
            className="rounded-md p-1.5 text-subtle transition hover:bg-surface-raised hover:text-primary"
          >
            <Plus className="h-4 w-4" />
          </button>
          <Tooltip label="Hide history">
            <button
              type="button"
              onClick={onClose}
              aria-label="Hide conversation history"
              className="rounded-md p-1.5 text-subtle transition hover:bg-surface-raised hover:text-primary"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>
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
              onClick={() => {
                setMobileHistory(false);
                void openConversation(c.id);
              }}
            >
              <MessageSquare className="mr-2 h-3.5 w-3.5 shrink-0 text-subtle" />
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-xs",
                  c.id === activeId ? "font-medium text-primary" : "text-muted",
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
    </div>
  );

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <div className="h-full min-h-0">
      {/* ONE card: conversation history (collapsible, animated) + chat. */}
      <section className="relative flex h-full min-h-0 overflow-hidden rounded-2xl border border-border bg-surface shadow-xs">
        {/* ── History · desktop pane, animated width ───────────────────── */}
        <div
          className={cn(
            "hidden shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out md:block",
            historyOpen ? "w-64" : "w-0",
          )}
        >
          {historyPane(() => setHistoryOpen(false))}
        </div>

        {/* ── History · phone drawer ───────────────────────────────────── */}
        {mobileHistory && (
          <div className="absolute inset-0 z-20 md:hidden">
            <div
              className="bs-fade-in absolute inset-0 bg-primary/30 backdrop-blur-sm"
              onClick={() => setMobileHistory(false)}
            />
            <div className="bs-scale-in absolute inset-y-0 left-0 w-64 bg-canvas shadow-xl">
              {historyPane(() => setMobileHistory(false))}
              <button
                type="button"
                onClick={() => setMobileHistory(false)}
                aria-label="Close history"
                className="absolute top-2.5 right-[-38px] rounded-md bg-surface p-1.5 text-subtle shadow-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Chat ─────────────────────────────────────────────────────── */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* h-12: identical to the conversations header — borders align */}
          <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border px-3 sm:px-4">
            <div className="flex min-w-0 items-center gap-2">
              {/* history toggle appears here ONLY when the pane is hidden */}
              {!historyOpen && (
                <Tooltip label="Show history">
                  <button
                    type="button"
                    onClick={() => setHistoryOpen(true)}
                    aria-label="Show conversation history"
                    className="hidden rounded-lg p-1.5 text-muted transition hover:bg-surface-raised hover:text-primary md:block"
                  >
                    <PanelLeft className="h-4 w-4" />
                  </button>
                </Tooltip>
              )}
              <button
                type="button"
                onClick={() => setMobileHistory(true)}
                aria-label="Show conversation history"
                className="rounded-lg p-1.5 text-muted transition hover:bg-surface-raised hover:text-primary md:hidden"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
              <p className="truncate text-sm font-semibold text-primary">
                {demo
                  ? "Ask BrainStack"
                  : (activeConvo?.title ?? "Ask BrainStack")}
              </p>
              {demo && <Badge variant="neutral">Sample data</Badge>}
            </div>
            {!demo && (
              <ModelPicker
                token={token}
                value={model}
                onChange={setModel}
                disabled={streaming}
              />
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void newConversation()}
              className="h-8 shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">New chat</span>
            </Button>
          </div>

          {/* messages */}
          <div
            ref={scrollRef}
            className="min-h-0 flex-1 overflow-y-auto px-3 py-5 sm:px-4"
          >
            {loadingMessages ? (
              <div className="mx-auto max-w-3xl space-y-4">
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
                  citations — hover one for the passage, click to open it.
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
              <div className="mx-auto max-w-3xl space-y-5">
                {messages.map((m) =>
                  m.role === "user" ? (
                    <div key={m.id} className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm leading-6 text-on-primary">
                        {m.content}
                      </div>
                    </div>
                  ) : (
                    <div key={m.id} className="flex">
                      <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-border bg-canvas px-4 py-3">
                        {m.trace && m.trace.length > 0 && (
                          <InlineTrace steps={m.trace} />
                        )}
                        <MessageContent
                          content={m.content}
                          sources={m.sources}
                          onOpenSource={openSource}
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
                {(streaming || liveText.length > 0) && (
                  <div className="flex">
                    <div className="w-full max-w-[92%] rounded-2xl rounded-bl-md border border-border bg-canvas px-4 py-3">
                      {/* The agent's thinking, live, right in the chat. */}
                      <TraceSteps
                        steps={liveTrace}
                        live={streaming}
                        drafting={streaming && liveText.length > 0}
                        className="mb-1"
                      />
                      {liveText && (
                        <div className="mt-2 border-t border-border pt-2.5">
                          <MessageContent
                            content={liveText}
                            sources={liveSources}
                            onOpenSource={openSource}
                          />
                          {streaming && (
                            <span className="mt-1 inline-block h-3.5 w-0.5 animate-pulse bg-accent align-middle" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* composer */}
          <div className="border-t border-border p-3">
            <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-xl border border-border-strong bg-canvas p-2 focus-within:border-accent">
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
            <p className="mx-auto mt-1.5 max-w-3xl px-1 text-[11px] text-subtle">
              Answers come only from indexed sources — when it isn&apos;t
              there, BrainStack says so.
            </p>
          </div>
        </div>
      </section>

      <PdfViewer
        documentId={pdf?.id ?? null}
        page={pdf?.page ?? 1}
        title={pdf?.title ?? ""}
        onClose={() => setPdf(null)}
      />
    </div>
  );
}
