import { Marquee } from "@/components/marketing/motion";

/** The real production stack — no logo-wall of fake customers, just what
 *  actually runs the platform. */
const STACK = [
  "LangGraph agent",
  "Claude",
  "Pinecone",
  "FastAPI",
  "PostgreSQL",
  "Redis",
  "MCP protocol",
  "hybrid BM25 + dense retrieval",
  "SSE streaming",
  "LLM-as-judge evals",
  "Next.js",
  "namespace-per-tenant isolation",
];

export function StackMarquee() {
  return (
    <section className="border-y border-border bg-canvas py-6">
      <p className="mb-4 text-center text-[11px] font-semibold tracking-widest text-subtle uppercase">
        Running on a real production stack
      </p>
      <Marquee duration={40}>
        {STACK.map((item) => (
          <span
            key={item}
            className="flex shrink-0 items-center gap-2.5 font-mono text-sm text-muted"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-accent-300" />
            {item}
          </span>
        ))}
      </Marquee>
    </section>
  );
}
