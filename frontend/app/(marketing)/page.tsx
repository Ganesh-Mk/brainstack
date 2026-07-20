import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Brain,
  Building2,
  Cable,
  ChartLine,
  CircleCheck,
  FileText,
  Lock,
  MessageSquare,
  Quote,
  Search,
  ShieldCheck,
  Sparkles,
  Ticket,
  Upload,
  Zap,
} from "lucide-react";
import { Hero } from "@/components/marketing/Hero";
import { TraceTeaser } from "@/components/marketing/TraceTeaser";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "BrainStack — Your company's second brain, fully stacked",
};

/* ── Trust strip ─────────────────────────────────────────────────────── */
function TrustStrip() {
  const items = [
    { icon: Building2, label: "Isolated per company" },
    { icon: Quote, label: "Grounded & cited answers" },
    { icon: ShieldCheck, label: "Role-based actions" },
  ];
  return (
    <section className="border-y border-border bg-canvas">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-6 py-6">
        {items.map((item) => (
          <span
            key={item.label}
            className="flex items-center gap-2 text-sm font-medium text-muted"
          >
            <item.icon className="h-4 w-4 text-accent" />
            {item.label}
          </span>
        ))}
      </div>
    </section>
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
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold tracking-widest text-accent uppercase">
          How it works
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-primary lg:text-4xl">
          From documents to decisions in three steps
        </h2>
      </div>
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {steps.map((s) => (
          <Card key={s.title} className="relative overflow-hidden">
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
          </Card>
        ))}
      </div>
    </section>
  );
}

/* ── The core idea: know vs do ───────────────────────────────────────── */
function KnowDoSplit() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-20 lg:pb-24">
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
    <section className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold tracking-widest text-accent uppercase">
          The platform
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-primary lg:text-4xl">
          An AI workspace, not a chat box
        </h2>
        <p className="mt-4 text-base leading-7 text-muted">
          The chat is just the entry point. Everything around it — the library,
          the trace, the citations, the analytics — is what makes it a product
          your company can trust.
        </p>
      </div>
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <Card key={f.title} interactive className="p-5">
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
          </Card>
        ))}
      </div>
      <div className="mt-10 text-center">
        <ButtonLink href="/features" variant="outline">
          Explore every feature
          <ArrowRight className="h-4 w-4" />
        </ButtonLink>
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
    <section className="border-y border-border bg-canvas">
      <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
        <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="text-xs font-semibold tracking-widest text-accent uppercase">
              Security &amp; trust
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-primary">
              Built for companies that can&apos;t afford leaks
            </h2>
            <p className="mt-4 text-base leading-7 text-muted">
              Multi-tenant AI has a scary failure mode: someone else&apos;s
              confidential data paraphrased into a fluent answer. BrainStack is
              architected so that can&apos;t happen.
            </p>
            <ButtonLink href="/security" variant="outline" className="mt-6">
              Read the security overview
              <ArrowRight className="h-4 w-4" />
            </ButtonLink>
          </div>
          <div className="space-y-4">
            {points.map((p) => (
              <div
                key={p.title}
                className="flex items-start gap-4 rounded-2xl border border-border bg-surface p-5 shadow-xs"
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
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Pricing preview ─────────────────────────────────────────────────── */
const TIERS = [
  {
    name: "Starter",
    price: "Free",
    tagline: "For trying it with your team",
    features: ["1 workspace", "50 documents", "Community support"],
    featured: false,
  },
  {
    name: "Team",
    price: "$49",
    per: "/mo per workspace",
    tagline: "For teams that run on their knowledge",
    features: [
      "Unlimited documents",
      "Role-based actions (MCP)",
      "Analytics & evaluation",
      "Priority support",
    ],
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    tagline: "For scale, SSO and guarantees",
    features: [
      "SSO & audit logs",
      "Custom MCP integrations",
      "SLA & dedicated support",
    ],
    featured: false,
  },
];

function PricingPreview() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold tracking-widest text-accent uppercase">
          Pricing
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-primary lg:text-4xl">
          Start free. Scale when it sticks.
        </h2>
      </div>
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {TIERS.map((tier) => (
          <Card
            key={tier.name}
            className={
              tier.featured
                ? "relative border-accent shadow-lg"
                : "relative"
            }
          >
            {tier.featured && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-0.5 text-xs font-semibold text-on-accent">
                Most popular
              </span>
            )}
            <h3 className="text-base font-semibold text-primary">
              {tier.name}
            </h3>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-primary">
              {tier.price}
              {tier.per && (
                <span className="text-sm font-normal text-subtle">
                  {" "}
                  {tier.per}
                </span>
              )}
            </p>
            <p className="mt-1 text-sm text-muted">{tier.tagline}</p>
            <ul className="mt-5 space-y-2.5">
              {tier.features.map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2 text-sm text-primary"
                >
                  <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  {f}
                </li>
              ))}
            </ul>
            <ButtonLink
              href={tier.name === "Enterprise" ? "/contact" : "/signup"}
              variant={tier.featured ? "accent" : "outline"}
              className="mt-6 w-full"
            >
              {tier.name === "Enterprise" ? "Contact us" : "Get started"}
            </ButtonLink>
          </Card>
        ))}
      </div>
      <p className="mt-8 text-center text-xs text-subtle">
        Launch pricing — subject to change before general availability.{" "}
        <Link href="/pricing" className="font-medium text-accent">
          Full details →
        </Link>
      </p>
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
    <section className="border-t border-border bg-canvas">
      <div className="mx-auto max-w-3xl px-6 py-20 lg:py-24">
        <div className="text-center">
          <p className="text-xs font-semibold tracking-widest text-accent uppercase">
            FAQ
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-primary">
            Questions companies actually ask
          </h2>
        </div>
        <div className="mt-10 space-y-3">
          {FAQS.map((faq) => (
            <details
              key={faq.q}
              className="group rounded-2xl border border-border bg-surface px-5 shadow-xs open:shadow-md"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-semibold text-primary [&::-webkit-details-marker]:hidden">
                {faq.q}
                <span className="text-subtle transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="pb-5 text-sm leading-7 text-muted">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Final CTA ───────────────────────────────────────────────────────── */
function CtaBand() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-tr from-accent-700 via-accent-600 to-accent-500 px-8 py-14 text-center shadow-xl lg:py-16">
        <div className="bs-dotgrid absolute inset-0 opacity-20" />
        <div className="relative">
          <Brain className="mx-auto h-8 w-8 text-white/80" />
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white lg:text-4xl">
            Give your company a second brain
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-white/80">
            Set up a workspace in minutes. Upload knowledge, invite the team,
            and start asking.
          </p>
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
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <>
      <Hero />
      <TrustStrip />
      <HowItWorks />
      <KnowDoSplit />
      <FeatureGrid />
      <TraceTeaser />
      <SecurityBand />
      <PricingPreview />
      <FAQ />
      <CtaBand />
    </>
  );
}
