import { Database } from "lucide-react";
import {
  siClaude,
  siDocker,
  siFastapi,
  siLanggraph,
  siModelcontextprotocol,
  siNextdotjs,
  siPostgresql,
  siRedis,
  siSupabase,
  siTailwindcss,
  siVercel,
} from "simple-icons";
import { Marquee } from "@/components/marketing/motion";

/** The real production stack — no logo-wall of fake customers, just what
 *  actually runs the platform, with each technology's actual mark. */

type SimpleIcon = { title: string; path: string };

const STACK: { label: string; icon?: SimpleIcon }[] = [
  { label: "LangGraph agent", icon: siLanggraph },
  { label: "Claude", icon: siClaude },
  { label: "Pinecone" }, // no official mark in simple-icons — generic glyph
  { label: "FastAPI", icon: siFastapi },
  { label: "PostgreSQL", icon: siPostgresql },
  { label: "Supabase", icon: siSupabase },
  { label: "Redis", icon: siRedis },
  { label: "MCP protocol", icon: siModelcontextprotocol },
  { label: "Next.js", icon: siNextdotjs },
  { label: "Tailwind CSS", icon: siTailwindcss },
  { label: "Vercel", icon: siVercel },
  { label: "Docker", icon: siDocker },
];

function TechIcon({ icon }: { icon?: SimpleIcon }) {
  if (!icon) return <Database className="h-4 w-4" aria-hidden />;
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
      <path d={icon.path} />
    </svg>
  );
}

export function StackMarquee() {
  return (
    <section className="border-y border-border bg-canvas py-6">
      <p className="mb-4 text-center text-[11px] font-semibold tracking-widest text-subtle uppercase">
        Running on a real production stack
      </p>
      <Marquee duration={40}>
        {STACK.map((item) => (
          <span
            key={item.label}
            className="flex shrink-0 items-center gap-2 font-mono text-sm text-muted"
          >
            <TechIcon icon={item.icon} />
            {item.label}
          </span>
        ))}
      </Marquee>
    </section>
  );
}
