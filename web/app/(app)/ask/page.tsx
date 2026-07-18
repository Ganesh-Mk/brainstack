import type { Metadata } from "next";
import {
  Brain,
  CircleCheck,
  FileText,
  Globe,
  LoaderCircle,
  Search,
  Send,
  Sparkles,
} from "lucide-react";
import { ComingSoon } from "@/components/patterns/ComingSoon";
import { Ph, PreviewCard } from "@/components/patterns/preview";

export const metadata: Metadata = { title: "Ask BrainStack" };

/** Dimmed mock of the eventual three-pane Ask workspace. */
function AskPreview() {
  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr_280px]">
      {/* Conversations */}
      <PreviewCard className="hidden space-y-3 lg:block">
        <p className="text-xs font-semibold tracking-wide text-subtle uppercase">
          Conversations
        </p>
        <div className="rounded-lg bg-surface-raised p-2.5">
          <p className="truncate text-xs font-medium text-primary">
            Q3 refund policy vs competitors
          </p>
          <p className="mt-0.5 text-[10px] text-subtle">2m ago</p>
        </div>
        {["Onboarding checklist", "Security review notes", "Pricing FAQ"].map(
          (t) => (
            <div key={t} className="p-2.5">
              <p className="truncate text-xs text-muted">{t}</p>
            </div>
          ),
        )}
      </PreviewCard>

      {/* Chat */}
      <PreviewCard className="flex min-h-96 flex-col">
        <div className="flex-1 space-y-4">
          <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-on-primary">
            Compare our Q3 refund policy with competitors, and draft an email
            summarizing it.
          </div>
          <div className="max-w-[90%] space-y-2 rounded-2xl rounded-bl-md border border-border bg-canvas px-4 py-3 text-sm leading-6 text-primary">
            <p>
              Your Q3 policy allows returns within 30 days of purchase{" "}
              <span className="rounded bg-accent-soft px-1 font-medium text-accent-700">
                [1]
              </span>{" "}
              — stricter than Competitor A&apos;s 45-day window{" "}
              <span className="rounded bg-accent-soft px-1 font-medium text-accent-700">
                [2]
              </span>
              , but with fewer exclusions…
            </p>
            <span className="inline-block h-4 w-1.5 animate-pulse rounded-sm bg-accent align-middle" />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-border-strong bg-surface px-3.5 py-2.5">
          <p className="flex-1 text-sm text-subtle">Ask anything…</p>
          <Send className="h-4 w-4 text-accent" />
        </div>
      </PreviewCard>

      {/* Trace + citation panel */}
      <div className="space-y-4">
        <PreviewCard>
          <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-subtle uppercase">
            <Sparkles className="h-3.5 w-3.5" /> Agent trace
          </p>
          <ul className="mt-3 space-y-2.5 text-xs">
            <li className="flex items-center gap-2 text-primary">
              <CircleCheck className="h-3.5 w-3.5 text-success" />
              <Brain className="h-3.5 w-3.5 text-subtle" /> Planning
            </li>
            <li className="flex items-center gap-2 text-primary">
              <CircleCheck className="h-3.5 w-3.5 text-success" />
              <Search className="h-3.5 w-3.5 text-subtle" /> Knowledge search
              (native)
            </li>
            <li className="flex items-center gap-2 text-primary">
              <CircleCheck className="h-3.5 w-3.5 text-success" />
              <Globe className="h-3.5 w-3.5 text-subtle" /> Web search (native)
            </li>
            <li className="flex items-center gap-2 font-medium text-accent">
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Drafting
              email…
            </li>
          </ul>
        </PreviewCard>
        <PreviewCard>
          <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-subtle uppercase">
            <FileText className="h-3.5 w-3.5" /> Citation [1]
          </p>
          <p className="mt-2 text-xs font-medium text-primary">
            policies-2026.pdf · page 7
          </p>
          <div className="mt-2 rounded-lg border-l-2 border-accent bg-accent-soft/60 p-2.5 text-xs leading-5 text-primary">
            “Our refund policy allows returns within 30 days of purchase,
            provided the product is…”
          </div>
          <Ph className="mt-3 h-24 w-full" />
        </PreviewCard>
      </div>
    </div>
  );
}

export default function AskPage() {
  return (
    <ComingSoon
      href="/ask"
      bullets={[
        "Token-by-token streaming answers",
        "Inline citations — click through to the exact source page",
        "Live Agent Trace panel showing every reasoning step",
        "Retrieved-passage side panel next to the opened document",
        "Follow-ups that remember the conversation",
        "Drafting: emails, summaries and comparisons on demand",
      ]}
      preview={<AskPreview />}
    />
  );
}
