import type { Metadata } from "next";
import {
  Activity,
  ArrowRight,
  Brain,
  Building2,
  Cable,
  ChartLine,
  FileText,
  Lock,
  MessageSquare,
  Search,
  ShieldCheck,
  Sparkles,
  Ticket,
  Upload,
  Zap,
} from "lucide-react";
import { Hero } from "@/components/marketing/Hero";
import { StackMarquee } from "@/components/marketing/StackMarquee";
import { PipelineAnimation } from "@/components/marketing/PipelineAnimation";
import { AgentGraph } from "@/components/marketing/AgentGraph";
import { RetrievalVisual } from "@/components/marketing/RetrievalVisual";
import { EvalNumbers } from "@/components/marketing/EvalNumbers";
import { MemorySection } from "@/components/marketing/MemorySection";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import {
  Reveal,
  Stagger,
  StaggerItem,
  TextReveal,
  TiltCard,
} from "@/components/marketing/motion";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "BrainStack — Your company's second brain, fully stacked",
};

/* ── Section heading helper ──────────────────────────────────────────── */
function SectionHeading({
  eyebrow,
  title,
  accent = [],
  sub,
}: {
  eyebrow: string;
  title: string;
  accent?: string[];
  sub?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <Reveal>
        <p className="text-xs font-semibold tracking-widest text-accent uppercase">
          {eyebrow}
        </p>
      </Reveal>
      <TextReveal
        as="h2"
        text={title}
        accent={accent}
        delay={0.08}
        className="mt-3 text-3xl font-semibold tracking-tight text-primary lg:text-4xl"
      />
      {sub && (
        <Reveal delay={0.2}>
          <p className="mt-4 text-base leading-7 text-muted">{sub}</p>
        </Reveal>
      )}
    </div>
  );
}

/* ── How it works ────────────────────────────────────────────────────── */
function HowItWorks() {
  const steps = [
    {
      icon: Upload,
      step: "01",
      title: "Ingest",
      text: "Upload PDFs, docs and links. BrainStack reads, chunks and indexes everything into your company's private knowledge base — watch it happen live.",
    },
    {
      icon: MessageSquare,
      step: "02",
      title: "Ask",
      text: "Anyone on the team asks in plain language. The agent searches your knowledge (and the web when useful) and streams back a cited, grounded answer.",
    },
    {
      icon: Zap,
      step: "03",
      title: "Act",
      text: "Managers go further: “assign this ticket to Priya” hits your real systems through a standard protocol — with permissions enforced by design.",
    },
  ];
  return (
    <section className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
      <SectionHeading
        eyebrow="How it works"
        title="From documents to decisions in three steps"
        accent={["three"]}
      />
      <Stagger className="mt-12 grid gap-5 md:grid-cols-3">
        {steps.map((s) => (
          <StaggerItem key={s.title}>
            <TiltCard className="relative h-full overflow-hidden rounded-2xl border border-border bg-surface p-6 shadow-xs">
              <span className="absolute top-4 right-5 text-4xl font-semibold text-surface-raised select-none">
                {s.step}
              </span>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-on-primary shadow-xs">
                <s.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-primary">
                {s.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted">{s.text}</p>
            </TiltCard>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}

/* ── Ingestion pipeline ──────────────────────────────────────────────── */
function PipelineSection() {
  return (
    <section className="border-t border-border bg-canvas">
      <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
        <SectionHeading
          eyebrow="Knowledge ingestion"
          title="Watch documents become searchable meaning"
          accent={["searchable", "meaning"]}
          sub="Every upload runs a live pipeline — extracted, chunked, embedded and indexed into your company's own private namespace. No black box, no waiting and wondering."
        />
        <Reveal delay={0.25} className="mt-14">
          <PipelineAnimation />
        </Reveal>
      </div>
    </section>
  );
}

/* ── The core idea: know vs do ───────────────────────────────────────── */
function KnowDoSplit() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
      <Reveal y={32}>
        <div className="overflow-hidden rounded-3xl border border-border bg-primary text-on-primary shadow-xl">
          <div className="grid md:grid-cols-2">
            <div className="border-b border-white/10 p-8 md:border-r md:border-b-0 lg:p-12">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                <Search className="h-4.5 w-4.5" />
              </span>
              <h3 className="mt-5 text-2xl font-semibold tracking-tight">
                Retrieval lets it <span className="text-accent-300">know</span>.
              </h3>
              <p className="mt-3 text-sm leading-7 text-white/70">
                Your documents become searchable meaning. Every answer is built
                strictly from what your company actually knows — and every fact
                links back to its source page.
              </p>
              <p className="mt-4 font-mono text-xs text-white/50">
                RAG · embeddings · semantic search · citations
              </p>
            </div>
            <div className="p-8 lg:p-12">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                <Cable className="h-4.5 w-4.5" />
              </span>
              <h3 className="mt-5 text-2xl font-semibold tracking-tight">
                Connections let it <span className="text-accent-300">do</span>.
              </h3>
              <p className="mt-3 text-sm leading-7 text-white/70">
                Your ticketing, HR and analytics systems plug in over MCP — an
                open standard. The agent takes real actions in your tools, gated
                by each person&apos;s role.
              </p>
              <p className="mt-4 font-mono text-xs text-white/50">
                MCP · tool discovery · role-based access
              </p>
            </div>
          </div>
          <div className="border-t border-white/10 bg-white/5 px-8 py-4 text-center">
            <p className="text-sm text-white/60">
              The brain is one agent. The knowledge and the hands are yours.
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ── Agent anatomy ───────────────────────────────────────────────────── */
function AgentSection() {
  return (
    <section className="border-t border-border bg-canvas">
      <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
        <SectionHeading
          eyebrow="No black box"
          title="Watch it think."
          accent={["think."]}
          sub="Every answer is a visible plan, not a mystery. The agent decides what it needs, picks its tools, grounds the draft in real sources, and double-checks itself before a single token reaches your screen."
        />
        <Reveal delay={0.25} className="mt-14">
          <AgentGraph />
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mt-8 text-center text-sm text-muted">
            This exact trace streams live in the product while the agent works —
            planning, searching, acting, drafting.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Hybrid retrieval ────────────────────────────────────────────────── */
function RetrievalSection() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
      <SectionHeading
        eyebrow="Advanced retrieval"
        title="Finds what pure vector search misses"
        accent={["misses"]}
        sub="Meaning-based search is brilliant until someone asks about an exact error code or SKU. BrainStack runs dense and keyword retrieval side by side and fuses the rankings — so both kinds of questions land."
      />
      <Reveal delay={0.25} className="mt-14">
        <RetrievalVisual />
      </Reveal>
    </section>
  );
}

/* ── Feature grid ────────────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: MessageSquare,
    category: "Intelligence",
    title: "Grounded Q&A",
    text: "Answers built only from your own knowledge — with “I don't know” instead of made-up facts.",
  },
  {
    icon: Sparkles,
    category: "Intelligence",
    title: "Live agent trace",
    text: "Watch every reasoning step in real time: planning, searching, acting, drafting.",
  },
  {
    icon: FileText,
    category: "Trust",
    title: "Inline citations",
    text: "Click any [1] to open the source at the exact page, with the grounding passage beside it.",
  },
  {
    icon: Upload,
    category: "Knowledge",
    title: "Multi-source ingestion",
    text: "PDFs, Word docs, URLs — parsed, chunked and indexed with live progress.",
  },
  {
    icon: Ticket,
    category: "Actions",
    title: "Role-based actions",
    text: "Managers assign tickets and pull analytics from chat. Employees can't — by construction.",
  },
  {
    icon: ChartLine,
    category: "Insights",
    title: "Quality you can measure",
    text: "Faithfulness scores, latency, cost per answer — a dashboard, not a demo.",
  },
  {
    icon: Building2,
    category: "Platform",
    title: "True multi-tenancy",
    text: "Every company's knowledge lives in its own isolated namespace. Always.",
  },
  {
    icon: Activity,
    category: "Platform",
    title: "Full observability",
    text: "Per-request traces of what was retrieved, which tools ran, and what it cost.",
  },
];

function FeatureGrid() {
  return (
    <section className="border-t border-border bg-canvas">
      <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
        <SectionHeading
          eyebrow="The platform"
          title="An AI workspace, not a chat box"
          accent={["workspace,"]}
          sub="The chat is just the entry point. Everything around it — the library, the trace, the citations, the analytics — is what makes it a product your company can trust."
        />
        <Stagger className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <StaggerItem key={f.title}>
              <TiltCard className="h-full rounded-2xl border border-border bg-surface p-5 shadow-xs transition-shadow hover:shadow-lg">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <f.icon className="h-4.5 w-4.5" />
                </span>
                <p className="mt-4 text-xs font-semibold tracking-wide text-accent-700 uppercase">
                  {f.category}
                </p>
                <h3 className="mt-1 text-base font-semibold text-primary">
                  {f.title}
                </h3>
                <p className="mt-1.5 text-sm leading-6 text-muted">{f.text}</p>
              </TiltCard>
            </StaggerItem>
          ))}
        </Stagger>
        <Reveal delay={0.15}>
          <div className="mt-10 text-center">
            <ButtonLink href="/features" variant="outline">
              Explore every feature
              <ArrowRight className="h-4 w-4" />
            </ButtonLink>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Security band ───────────────────────────────────────────────────── */
function SecurityBand() {
  const points = [
    {
      icon: Building2,
      title: "Isolated per tenant",
      text: "Each company's vectors live in their own namespace — cross-company leaks are impossible by construction.",
    },
    {
      icon: Lock,
      title: "Permissions at the protocol",
      text: "An employee's agent never even discovers manager tools. Capability-based, not prompt-based.",
    },
    {
      icon: ShieldCheck,
      title: "Your data stays yours",
      text: "Documents ground answers for your workspace only. Nothing you upload trains a model.",
    },
  ];
  return (
    <section className="border-t border-border bg-surface">
      <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
        <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <Reveal>
              <p className="text-xs font-semibold tracking-widest text-accent uppercase">
                Security &amp; trust
              </p>
            </Reveal>
            <TextReveal
              as="h2"
              text="Built for companies that can't afford leaks"
              accent={["leaks"]}
              delay={0.08}
              className="mt-3 text-3xl font-semibold tracking-tight text-primary"
            />
            <Reveal delay={0.2}>
              <p className="mt-4 text-base leading-7 text-muted">
                Multi-tenant AI has a scary failure mode: someone else&apos;s
                confidential data paraphrased into a fluent answer. BrainStack
                is architected so that can&apos;t happen.
              </p>
            </Reveal>
            <Reveal delay={0.3}>
              <ButtonLink href="/security" variant="outline" className="mt-6">
                Read the security overview
                <ArrowRight className="h-4 w-4" />
              </ButtonLink>
            </Reveal>
          </div>
          <Stagger className="space-y-4">
            {points.map((p) => (
              <StaggerItem
                key={p.title}
                className="flex items-start gap-4 rounded-2xl border border-border bg-canvas p-5 shadow-xs"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary">
                  <p.icon className="h-4.5 w-4.5" />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-primary">
                    {p.title}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-muted">{p.text}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </div>
    </section>
  );
}

/* ── FAQ ─────────────────────────────────────────────────────────────── */
const FAQS = [
  {
    q: "Is my company's data isolated?",
    a: "Completely. Every workspace's knowledge lives in its own namespace, keyed to your company — a query from one tenant physically cannot reach another tenant's data. It's the first invariant the platform was designed around.",
  },
  {
    q: "Do you train AI models on my documents?",
    a: "No. Your documents are retrieved to ground answers for your workspace, and that's all. Nothing you upload is used to train or fine-tune any model.",
  },
  {
    q: "What can managers do that employees can't?",
    a: "Employees ask questions. Managers can also act — assign tickets, pull workforce analytics — through your company's connected systems. The distinction is enforced at connection time: an employee's assistant never even discovers the action tools.",
  },
  {
    q: "What is MCP?",
    a: "The Model Context Protocol — an open standard for connecting AI to external tools, think “USB for AI”. Your company exposes its systems once via an MCP server, and BrainStack's agent can discover and use them. Swapping Jira for Linear is a URL change, not an integration project.",
  },
  {
    q: "How do you prevent made-up answers?",
    a: "Layered defenses: answers are grounded strictly in retrieved context, the assistant says “I don't know” when the context doesn't contain the answer, every fact carries a clickable citation, and an automated judge continuously scores answers for faithfulness.",
  },
];

function FAQ() {
  return (
    <section className="border-t border-border bg-surface">
      <div className="mx-auto max-w-3xl px-6 py-20 lg:py-24">
        <SectionHeading
          eyebrow="FAQ"
          title="Questions companies actually ask"
        />
        <div className="mt-10">
          <FaqAccordion items={FAQS} />
        </div>
      </div>
    </section>
  );
}

/* ── Final CTA ───────────────────────────────────────────────────────── */
function CtaBand() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
      <Reveal y={36}>
        <div className="bs-gradient-pan relative overflow-hidden rounded-3xl bg-gradient-to-tr from-accent-700 via-accent-600 to-accent-400 px-8 py-14 text-center shadow-xl lg:py-16">
          <div className="bs-dotgrid absolute inset-0 opacity-20" />
          <div className="relative">
            <span className="bs-float inline-block">
              <Brain className="mx-auto h-9 w-9 text-white/85" />
            </span>
            <TextReveal
              as="h2"
              text="Give your company a second brain"
              delay={0.1}
              className="mt-4 text-3xl font-semibold tracking-tight text-white lg:text-4xl"
            />
            <Reveal delay={0.3}>
              <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-white/80">
                Set up a workspace in minutes. Upload knowledge, invite the
                team, and start asking.
              </p>
            </Reveal>
            <Reveal delay={0.42}>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                <ButtonLink
                  href="/signup"
                  size="lg"
                  className="bg-white text-accent-700 hover:bg-white/90"
                >
                  Start free
                </ButtonLink>
                <ButtonLink
                  href="/contact"
                  size="lg"
                  className="border border-white/40 bg-transparent text-white hover:bg-white/10"
                >
                  Book a demo
                </ButtonLink>
              </div>
            </Reveal>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

export default function LandingPage() {
  return (
    <>
      <Hero />
      <StackMarquee />
      <HowItWorks />
      <PipelineSection />
      <KnowDoSplit />
      <AgentSection />
      <RetrievalSection />
      <EvalNumbers />
      <FeatureGrid />
      <MemorySection />
      <SecurityBand />
      <FAQ />
      <CtaBand />
    </>
  );
}
