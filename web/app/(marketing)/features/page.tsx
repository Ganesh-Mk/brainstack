import type { Metadata } from "next";
import {
  Activity,
  Brain,
  Building2,
  Cable,
  ChartLine,
  ClipboardCheck,
  FileText,
  MessageSquare,
  Quote,
  ShieldCheck,
  Sparkles,
  Upload,
  Zap,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Everything inside BrainStack — grounded Q&A, live agent trace, citations, ingestion, role-based actions, analytics and evaluation.",
};

const SECTIONS = [
  {
    eyebrow: "Knowledge",
    title: "Turn documents into a knowledge base that answers back",
    features: [
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
    ],
  },
  {
    eyebrow: "Intelligence",
    title: "An agent that decides, not a script that runs",
    features: [
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
    ],
  },
  {
    eyebrow: "Actions",
    title: "From answers to actions in your own systems",
    features: [
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
    ],
  },
  {
    eyebrow: "Trust & operations",
    title: "The parts that make it a platform, not a demo",
    features: [
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
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold tracking-widest text-accent uppercase">
          Features
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-primary lg:text-5xl">
          Everything a second brain needs
        </h1>
        <p className="mt-4 text-lg leading-8 text-muted">
          Knowledge in, grounded answers out, real actions when you&apos;re
          allowed — and the transparency to trust all of it.
        </p>
      </div>

      <div className="mt-16 space-y-16">
        {SECTIONS.map((section) => (
          <section key={section.eyebrow}>
            <p className="text-xs font-semibold tracking-widest text-accent uppercase">
              {section.eyebrow}
            </p>
            <h2 className="mt-2 max-w-2xl text-2xl font-semibold tracking-tight text-primary">
              {section.title}
            </h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {section.features.map((f) => (
                <Card key={f.title} className="p-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                    <f.icon className="h-4.5 w-4.5" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-primary">
                    {f.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-6 text-muted">
                    {f.text}
                  </p>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-16 rounded-3xl border border-border bg-canvas p-10 text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-primary">
          See it for yourself
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
          The full product surface is live today — walk through every screen
          and watch the rollout on the roadmap.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <ButtonLink href="/signup" variant="accent">
            Start free
          </ButtonLink>
          <ButtonLink href="/roadmap" variant="outline">
            View the roadmap
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
