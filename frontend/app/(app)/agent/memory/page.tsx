import type { Metadata } from "next";
import { Brain, Clock, MessageSquare } from "lucide-react";
import { ComingSoon } from "@/components/patterns/ComingSoon";
import { PreviewCard } from "@/components/patterns/preview";
import { Badge } from "@/components/ui/Badge";

export const metadata: Metadata = { title: "Memory" };

const FACTS = [
  { fact: "Prefers concise answers with bullet points", learned: "Jul 14" },
  { fact: "Works on the Payments team", learned: "Jul 12" },
  { fact: "Reports go to Priya every Friday", learned: "Jul 09" },
  { fact: "Time zone: IST (UTC+5:30)", learned: "Jul 02" },
];

function MemoryPreview() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <PreviewCard>
        <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-subtle uppercase">
          <MessageSquare className="h-3.5 w-3.5" /> Short-term · this
          conversation
        </p>
        <div className="mt-3 space-y-2.5 text-xs leading-5">
          <div className="rounded-lg bg-surface-raised p-2.5 text-primary">
            <span className="font-semibold">You:</span> What&apos;s our refund
            policy?
          </div>
          <div className="rounded-lg bg-canvas p-2.5 text-primary">
            <span className="font-semibold">BrainStack:</span> 30 days from
            purchase [1]…
          </div>
          <div className="rounded-lg bg-surface-raised p-2.5 text-primary">
            <span className="font-semibold">You:</span> what about for
            enterprise?
            <span className="ml-2 text-subtle">
              ← resolved via conversation context
            </span>
          </div>
        </div>
        <p className="mt-3 text-[10px] text-subtle">
          Sliding window + summarization keeps long chats within budget.
        </p>
      </PreviewCard>
      <PreviewCard>
        <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-subtle uppercase">
          <Brain className="h-3.5 w-3.5" /> Long-term · durable facts
        </p>
        <ul className="mt-3 space-y-2.5">
          {FACTS.map((f) => (
            <li
              key={f.fact}
              className="flex items-start justify-between gap-3 rounded-lg border border-border p-2.5"
            >
              <p className="text-xs leading-5 text-primary">{f.fact}</p>
              <Badge variant="neutral" className="shrink-0">
                <Clock className="h-3 w-3" />
                {f.learned}
              </Badge>
            </li>
          ))}
        </ul>
      </PreviewCard>
    </div>
  );
}

export default function MemoryPage() {
  return (
    <ComingSoon
      href="/agent/memory"
      bullets={[
        "Follow-ups that just work — the conversation is remembered",
        "Durable facts extracted at session end, recalled next session",
        "See and delete anything the assistant has remembered about you",
        "Tightly scoped: explicit facts only, never a transcript dump",
      ]}
      preview={<MemoryPreview />}
    />
  );
}
