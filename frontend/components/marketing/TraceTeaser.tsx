import {
  Brain,
  Cable,
  ChartColumn,
  CircleCheck,
  PenLine,
  Search,
} from "lucide-react";

const STEPS = [
  {
    icon: Brain,
    title: "Planning",
    detail: "“Needs internal docs + an action in the ticket system”",
  },
  {
    icon: Search,
    title: "Searching knowledge",
    detail: "5 relevant passages from your own documents",
  },
  {
    icon: Cable,
    title: "Company system (MCP)",
    detail: "assign_ticket → “login-bug” assigned to Priya",
  },
  {
    icon: ChartColumn,
    title: "Pulling analytics",
    detail: "get_analytics → Priya's workload this week",
  },
  {
    icon: PenLine,
    title: "Answering",
    detail: "Grounded summary, streamed word by word, with citations",
  },
];

/** The "wow" surface as marketing: watch the agent think, step by step. */
export function TraceTeaser() {
  return (
    <section className="border-y border-border bg-canvas">
      <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold tracking-widest text-accent uppercase">
            No black box
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-primary lg:text-4xl">
            Watch it think.
          </h2>
          <p className="mt-4 text-base leading-7 text-muted">
            Every answer comes with a live trace of the agent&apos;s reasoning
            — what it searched, what it found, what it did, and what it cost.
            Trust comes from transparency, not promises.
          </p>
        </div>
        <div className="mx-auto mt-12 max-w-2xl">
          <ol className="relative space-y-6 border-l border-border-strong pl-8">
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                className="bs-fade-up relative"
                style={{ animationDelay: `${i * 120}ms` }}
              >
                <span className="absolute top-0.5 -left-[45px] flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface text-accent shadow-xs">
                  <step.icon className="h-3.5 w-3.5" />
                </span>
                <div className="rounded-xl border border-border bg-surface p-4 shadow-xs">
                  <p className="flex items-center gap-2 text-sm font-semibold text-primary">
                    {step.title}
                    <CircleCheck className="h-3.5 w-3.5 text-success" />
                  </p>
                  <p className="mt-1 font-mono text-xs text-muted">
                    {step.detail}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
