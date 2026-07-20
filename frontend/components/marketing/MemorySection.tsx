import { Database, History, MessageSquarePlus } from "lucide-react";
import { Reveal, TextReveal } from "@/components/marketing/motion";

/**
 * The memory story — built around the REAL cross-conversation demo from
 * docs/PHASE_8_COMPLETE.md ("I'm Alex, I run the Bangalore office" →
 * recalled in a brand-new conversation).
 */
export function MemorySection() {
  return (
    <section className="border-t border-border bg-canvas">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-2 lg:py-24">
        {/* copy */}
        <div>
          <Reveal>
            <p className="text-xs font-semibold tracking-widest text-accent uppercase">
              Memory
            </p>
          </Reveal>
          <TextReveal
            as="h2"
            text="It remembers, so your team doesn't repeat themselves."
            accent={["remembers,"]}
            className="mt-3 text-3xl font-semibold tracking-tight text-primary lg:text-4xl"
          />
          <Reveal delay={0.15}>
            <p className="mt-4 text-base leading-7 text-muted">
              Long conversations compress into summaries instead of falling off
              a cliff, and durable facts you share are kept as long-term memory
              — recalled in any future conversation. You stay in control:
              every remembered fact is visible on the Memory page, and
              forgetting one is a single click.
            </p>
          </Reveal>
          <Reveal delay={0.25}>
            <ul className="mt-6 space-y-3.5">
              {[
                {
                  icon: History,
                  title: "Short-term",
                  text: "A sliding window of recent turns, with older context summarized automatically — follow-ups just work.",
                },
                {
                  icon: Database,
                  title: "Long-term",
                  text: "Facts you state are embedded and stored per user, recalled only when they're actually relevant.",
                },
              ].map((item) => (
                <li key={item.title} className="flex items-start gap-3.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                    <item.icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-primary">
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-sm leading-6 text-muted">
                      {item.text}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        {/* the two-conversation demo */}
        <Reveal delay={0.2} y={30}>
          <div className="space-y-4">
            {/* conversation 1 */}
            <div className="rounded-2xl border border-border bg-surface p-4 shadow-xs">
              <p className="font-mono text-[10px] text-subtle">
                Tuesday · conversation #1
              </p>
              <div className="mt-2.5 ml-auto w-fit max-w-[90%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-xs leading-5 text-on-primary">
                I&apos;m Alex — I run the Bangalore office. What&apos;s our
                refund policy?
              </div>
              <p className="mt-2.5 flex items-center gap-1.5 font-mono text-[10px] text-subtle">
                <Database className="h-3 w-3 text-accent" />
                2 facts saved to long-term memory
              </p>
            </div>

            {/* connector */}
            <div className="flex items-center justify-center gap-2 text-subtle">
              <span className="h-px w-10 bg-border-strong" />
              <MessageSquarePlus className="h-3.5 w-3.5" />
              <span className="font-mono text-[10px]">
                days later · a brand-new conversation
              </span>
              <span className="h-px w-10 bg-border-strong" />
            </div>

            {/* conversation 2 */}
            <div className="rounded-2xl border border-accent-200 bg-surface p-4 shadow-md">
              <p className="font-mono text-[10px] text-subtle">
                Friday · conversation #2
              </p>
              <div className="mt-2.5 ml-auto w-fit max-w-[90%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-xs leading-5 text-on-primary">
                What&apos;s my name?
              </div>
              <div className="mt-2.5 w-fit max-w-[92%] rounded-2xl rounded-bl-md border border-border bg-canvas px-3.5 py-2 text-xs leading-5 text-primary">
                You&apos;re{" "}
                <span className="font-semibold text-accent-700">Alex</span> —
                and you run the{" "}
                <span className="font-semibold text-accent-700">
                  Bangalore office
                </span>
                .
              </div>
              <p className="mt-2.5 font-mono text-[10px] text-subtle">
                recalled from memory · verified live in production
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
