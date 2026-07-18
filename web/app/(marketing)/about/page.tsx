import type { Metadata } from "next";
import { Brain, Layers, Search, ShieldCheck } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "About",
  description:
    "Why BrainStack exists: companies drown in their own knowledge. We built the second brain that answers, cites and acts.",
};

const BELIEFS = [
  {
    icon: Search,
    title: "Answers should come with receipts",
    text: "An AI that can't show its sources is a liability. Every BrainStack answer is grounded in your documents and cites the exact page it came from.",
  },
  {
    icon: Brain,
    title: "Transparency beats magic",
    text: "We show the agent's reasoning live — what it searched, what it found, what it did. You shouldn't have to trust a black box with your company's knowledge.",
  },
  {
    icon: ShieldCheck,
    title: "Permissions are architecture",
    text: "Who can do what shouldn't depend on a prompt behaving. In BrainStack, capabilities a role doesn't have simply don't exist in that person's session.",
  },
  {
    icon: Layers,
    title: "Standards over lock-in",
    text: "Company systems connect over MCP, an open protocol. Your integrations belong to you — swapping tools is a configuration change, not a migration.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16 lg:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold tracking-widest text-accent uppercase">
          About
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-primary lg:text-5xl">
          Companies drown in their own knowledge
        </h1>
        <p className="mt-5 text-lg leading-8 text-muted">
          The answer to almost every question your team asks already exists —
          in a PDF, a wiki page, a policy doc, a system of record. The problem
          was never knowledge. It was retrieval. BrainStack is the second brain
          that finds it, proves it, and — when you&apos;re allowed — acts on
          it.
        </p>
      </div>

      <div className="mt-14 grid gap-5 sm:grid-cols-2">
        {BELIEFS.map((b) => (
          <Card key={b.title}>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <b.icon className="h-4.5 w-4.5" />
            </span>
            <h2 className="mt-4 text-base font-semibold text-primary">
              {b.title}
            </h2>
            <p className="mt-1.5 text-sm leading-6 text-muted">{b.text}</p>
          </Card>
        ))}
      </div>

      <div className="mt-14 rounded-3xl border border-border bg-canvas p-10 text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-primary">
          Built in the open
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-7 text-muted">
          BrainStack ships in deliberate, public stages — every feature has a
          place in the product from day one and switches on as its
          infrastructure lands. You can watch it happen on the roadmap.
        </p>
        <ButtonLink href="/roadmap" variant="accent" className="mt-6">
          See the roadmap
        </ButtonLink>
      </div>
    </div>
  );
}
