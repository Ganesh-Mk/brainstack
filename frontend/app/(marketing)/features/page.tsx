import type { Metadata } from "next";
import {
  Activity,
  Brain,
  Building2,
  Cable,
  ChartLine,
  CircleCheck,
  ClipboardCheck,
  FileText,
  Lock,
  MessageSquare,
  Quote,
  ShieldCheck,
  Sparkles,
  Upload,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { HeroDemo } from "@/components/marketing/HeroDemo";
import { PipelineAnimation } from "@/components/marketing/PipelineAnimation";
import {
  CountUp,
  Reveal,
  Stagger,
  StaggerItem,
  TextReveal,
  TiltCard,
} from "@/components/marketing/motion";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Everything inside BrainStack — grounded Q&A, live agent trace, citations, ingestion, role-based actions, analytics and evaluation.",
};

/* ── Pillar data (copy unchanged — it's accurate to the product) ─────── */

type Feature = { icon: LucideIcon; title: string; text: string };

const KNOWLEDGE: Feature[] = [
  {
    icon: Upload,
    title: "Multi-source ingestion",
    text: "Upload PDFs and Word docs or paste URLs. Everything is parsed, split into meaningful passages and indexed automatically.",
  },
  {
    icon: Activity,
    title: "Live ingestion pipeline",
    text: "Watch every document move through extract → chunk → embed → index with real progress — not a spinner.",
  },
  {
    icon: FileText,
    title: "Document library",
    text: "One searchable place for every source, with status, chunk counts and previews of what the assistant sees.",
  },
];

const INTELLIGENCE: Feature[] = [
  {
    icon: MessageSquare,
    title: "Grounded Q&A",
    text: "Answers are built strictly from retrieved passages of your own knowledge. If it isn't there, you get “I don't know” — not fiction.",
  },
  {
    icon: Sparkles,
    title: "Agentic reasoning",
    text: "The agent plans: search internal docs? check the web? take an action? answer directly? You watch it choose in the live trace.",
  },
  {
    icon: Brain,
    title: "Memory",
    text: "Follow-ups resolve naturally within a conversation, and durable facts carry across sessions — visible and deletable.",
  },
  {
    icon: Quote,
    title: "Citations you can open",
    text: "Every fact carries a numbered citation. Click it: the source opens at the exact page, with the grounding passage in a side panel.",
  },
];

const ACTIONS: Feature[] = [
  {
    icon: Cable,
    title: "Pluggable connections (MCP)",
    text: "Your ticketing, HR and analytics systems connect over the open Model Context Protocol. New integration = new server URL, not new code.",
  },
  {
    icon: Zap,
    title: "Role-based actions",
    text: "“Assign the login-bug to Priya and show her workload” — done, if you're a manager. Employees never even see those capabilities.",
  },
];

const TRUST: Feature[] = [
  {
    icon: Building2,
    title: "Multi-tenancy",
    text: "Companies are isolated at the storage layer — each workspace's knowledge lives in its own namespace, always.",
  },
  {
    icon: ShieldCheck,
    title: "Guardrails",
    text: "Grounding rules, role limits, token ceilings and rate limits — constraints that hold by construction.",
  },
  {
    icon: ClipboardCheck,
    title: "Evaluation",
    text: "A golden dataset and automated judges score faithfulness and retrieval quality on every change.",
  },
  {
    icon: ChartLine,
    title: "Analytics & observability",
    text: "Cost, latency, token usage, quality trends and per-request traces — the numbers behind every answer.",
  },
];

/* ── Shared bits ─────────────────────────────────────────────────────── */

function PillarHeader({
  eyebrow,
  title,
  accent = [],
}: {
  eyebrow: string;
  title: string;
  accent?: string[];
}) {
  return (
    <div>
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
        className="mt-2 max-w-2xl text-2xl font-semibold tracking-tight text-primary lg:text-3xl"
      />
    </div>
  );
}

function FeatureCards({
  features,
  cols = "sm:grid-cols-2 lg:grid-cols-3",
}: {
  features: Feature[];
  cols?: string;
}) {
  return (
    <Stagger className={`mt-8 grid gap-5 ${cols}`}>
      {features.map((f) => (
        <StaggerItem key={f.title} className="h-full">
          <TiltCard className="h-full rounded-2xl border border-border bg-surface p-5 shadow-xs">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <f.icon className="h-4.5 w-4.5" />
            </span>
            <h3 className="mt-4 text-base font-semibold text-primary">
              {f.title}
            </h3>
            <p className="mt-1.5 text-sm leading-6 text-muted">{f.text}</p>
          </TiltCard>
        </StaggerItem>
      ))}
    </Stagger>
  );
}

/* ── Exhibit: role-gated tool discovery (Actions pillar) ─────────────── */

function RoleGatingVisual() {
  const employeeTools = ["search_knowledge", "web_search"];
  const managerTools = [
    { name: "search_knowledge" },
    { name: "web_search" },
    { name: "assign_ticket", mcp: true },
    { name: "list_tickets", mcp: true },
    { name: "get_analytics", mcp: true },
  ];
  return (
    <Stagger className="grid gap-5 md:grid-cols-2">
      <StaggerItem>
        <div className="h-full rounded-2xl border border-border bg-surface p-5 shadow-xs">
          <p className="flex items-center justify-between text-sm font-semibold text-primary">
            Employee session
            <span className="rounded-full bg-surface-raised px-2 py-0.5 text-[10px] font-semibold text-muted">
              ask &amp; draft
            </span>
          </p>
          <p className="mt-1 font-mono text-[10px] text-subtle">
            tools discovered at session start
          </p>
          <ul className="mt-3 space-y-1.5">
            {employeeTools.map((t) => (
              <li
                key={t}
                className="flex items-center gap-2 rounded-lg border border-border bg-canvas px-3 py-1.5 font-mono text-[11px] text-muted"
              >
                <CircleCheck className="h-3 w-3 text-success" /> {t}
              </li>
            ))}
            <li className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-1.5 font-mono text-[11px] text-subtle opacity-70">
              <Lock className="h-3 w-3" /> action tools — never connected, so
              never visible
            </li>
          </ul>
        </div>
      </StaggerItem>
      <StaggerItem>
        <div className="h-full rounded-2xl border border-accent-200 bg-surface p-5 shadow-md">
          <p className="flex items-center justify-between text-sm font-semibold text-primary">
            Manager session
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent-700">
              ask, draft &amp; act
            </span>
          </p>
          <p className="mt-1 font-mono text-[10px] text-subtle">
            + Company MCP Server connected for this role
          </p>
          <ul className="mt-3 space-y-1.5">
            {managerTools.map((t) => (
              <li
                key={t.name}
                className="flex items-center gap-2 rounded-lg border border-border bg-canvas px-3 py-1.5 font-mono text-[11px] text-muted"
              >
                <CircleCheck className="h-3 w-3 text-success" /> {t.name}
                {t.mcp && (
                  <span className="ml-auto rounded bg-accent-soft px-1.5 py-0.5 text-[9px] font-semibold text-accent-700">
                    via MCP
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </StaggerItem>
    </Stagger>
  );
}

/* ── Exhibit: measured quality (Trust pillar) ────────────────────────── */

function QualityStrip() {
  const stats = [
    { value: 0.977, decimals: 3, label: "faithfulness" },
    { value: 0.955, decimals: 3, label: "answer relevance" },
    { value: 1.0, decimals: 3, label: "retrieval hit-rate" },
    { value: 22, decimals: 0, label: "golden questions" },
  ];
  return (
    <Reveal y={26}>
      <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-surface p-5 text-center">
            <p className="text-2xl font-semibold tracking-tight text-primary tabular-nums">
              <CountUp value={s.value} decimals={s.decimals} />
            </p>
            <p className="mt-1 font-mono text-[10px] text-subtle">{s.label}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-subtle">
        Latest production evaluation run — browsable in the product, not a
        marketing statistic.
      </p>
    </Reveal>
  );
}

/* ── Page ────────────────────────────────────────────────────────────── */

export default function FeaturesPage() {
  return (
    <div className="overflow-hidden">
      {/* hero */}
      <div className="relative">
        <div className="bs-dotgrid absolute inset-0 opacity-50" />
        <div className="relative mx-auto max-w-2xl px-6 pt-16 pb-4 text-center lg:pt-20">
          <Reveal>
            <p className="text-xs font-semibold tracking-widest text-accent uppercase">
              Features
            </p>
          </Reveal>
          <TextReveal
            as="h1"
            text="Everything a second brain needs"
            accent={["everything"]}
            delay={0.08}
            className="mt-3 text-4xl font-semibold tracking-tight text-primary lg:text-5xl"
          />
          <Reveal delay={0.25}>
            <p className="mt-4 text-lg leading-8 text-muted">
              Knowledge in, grounded answers out, real actions when you&apos;re
              allowed — and the transparency to trust all of it.
            </p>
          </Reveal>
        </div>
      </div>

      {/* Knowledge */}
      <section className="mx-auto max-w-6xl px-6 py-14 lg:py-16">
        <PillarHeader
          eyebrow="Knowledge"
          title="Turn documents into a knowledge base that answers back"
          accent={["answers"]}
        />
        <FeatureCards features={KNOWLEDGE} />
        <Reveal delay={0.15} className="mt-10 rounded-3xl border border-border bg-canvas p-6 lg:p-10">
          <PipelineAnimation />
        </Reveal>
      </section>

      {/* Intelligence */}
      <section className="border-t border-border bg-canvas">
        <div className="mx-auto max-w-6xl px-6 py-14 lg:py-16">
          <PillarHeader
            eyebrow="Intelligence"
            title="An agent that decides, not a script that runs"
            accent={["decides,"]}
          />
          <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_1.1fr]">
            {/* Compact rows, not tiles — uniform height, aligned with the
                demo beside them. */}
            <Stagger className="space-y-3">
              {INTELLIGENCE.map((f) => (
                <StaggerItem key={f.title}>
                  <div className="flex gap-3.5 rounded-2xl border border-border bg-surface p-4 shadow-xs">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                      <f.icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-primary">
                        {f.title}
                      </h3>
                      <p className="mt-0.5 text-[13px] leading-5 text-muted">
                        {f.text}
                      </p>
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
            <Reveal delay={0.2} y={30} className="lg:sticky lg:top-24">
              <HeroDemo />
            </Reveal>
          </div>
        </div>
      </section>

      {/* Actions */}
      <section className="mx-auto max-w-6xl px-6 py-14 lg:py-16">
        <PillarHeader
          eyebrow="Actions"
          title="From answers to actions in your own systems"
          accent={["actions"]}
        />
        <FeatureCards features={ACTIONS} cols="sm:grid-cols-2" />
        <div className="mt-10">
          <RoleGatingVisual />
          <Reveal delay={0.2}>
            <p className="mt-4 text-center text-xs text-subtle">
              Same agent, same code — the role decides whether the Company MCP
              Server is even connected. Absent by construction, not blocked by
              a prompt.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Trust & operations */}
      <section className="border-t border-border bg-canvas">
        <div className="mx-auto max-w-6xl px-6 py-14 lg:py-16">
          <PillarHeader
            eyebrow="Trust & operations"
            title="The parts that make it a platform, not a demo"
            accent={["platform,"]}
          />
          <FeatureCards features={TRUST} cols="sm:grid-cols-2 lg:grid-cols-4" />
          <div className="mt-10">
            <QualityStrip />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 py-14 lg:py-16">
        <Reveal y={30}>
          <div className="rounded-3xl border border-border bg-canvas p-10 text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-primary">
              See it for yourself
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
              The full product surface is live today — walk through every
              screen and see how your company&apos;s knowledge becomes answers.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <ButtonLink href="/signup" variant="accent">
                Start free
              </ButtonLink>
              <ButtonLink href="/security" variant="outline">
                How we protect your data
              </ButtonLink>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
