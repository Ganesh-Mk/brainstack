import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Getting started",
  description:
    "Create a workspace, add your first sources, ask a grounded question, and invite the team — BrainStack in about five minutes.",
};

const STEPS: { title: string; body: React.ReactNode }[] = [
  {
    title: "Create your workspace",
    body: (
      <>
        Sign up at{" "}
        <a
          href="https://app.brainstack.space/signup"
          className="font-medium text-accent hover:underline"
        >
          app.brainstack.space/signup
        </a>{" "}
        with your company name. The first account in a workspace is its{" "}
        <strong className="text-primary">admin</strong>. Everything a workspace
        holds — documents, conversations, memory, analytics — is isolated to
        it: your knowledge lives in its own private index namespace, always.
      </>
    ),
  },
  {
    title: "Add your first sources",
    body: (
      <>
        Head to <strong className="text-primary">Add Sources</strong>. Drop in
        PDFs (up to 15 MB each) or paste a public web page URL. Each source
        runs a live pipeline — extract → chunk → embed → index — right on the
        same page, and the moment it reads{" "}
        <strong className="text-primary">Ready</strong>, the assistant can
        answer from it. Details in{" "}
        <Link
          href="/docs/knowledge"
          className="font-medium text-accent hover:underline"
        >
          Knowledge &amp; ingestion
        </Link>
        .
      </>
    ),
  },
  {
    title: "Ask a grounded question",
    body: (
      <>
        Open <strong className="text-primary">Ask BrainStack</strong> and ask
        anything about what you indexed. Answers are built strictly from
        retrieved passages of your own knowledge, with numbered citations —
        hover one for the exact passage, click it to open the source at the
        exact page. If the answer isn&apos;t in your knowledge, BrainStack says
        so instead of inventing one. Expand{" "}
        <em>&quot;How the agent worked&quot;</em> on any answer to see the
        plan, tool calls and timing behind it.
      </>
    ),
  },
  {
    title: "Invite the team, choose roles",
    body: (
      <>
        In <strong className="text-primary">Team &amp; Roles</strong>, create
        an invite link per teammate.{" "}
        <strong className="text-primary">Employees</strong> ask and draft.{" "}
        <strong className="text-primary">Managers</strong> also act in
        connected company systems (assign tickets, pull workload analytics).{" "}
        <strong className="text-primary">Admins</strong> additionally manage
        sources, members, analytics and settings. Role changes apply to a
        member&apos;s very next question.
      </>
    ),
  },
  {
    title: "Grow from there",
    body: (
      <>
        Connect your own systems over MCP (
        <Link
          href="/docs/mcp"
          className="font-medium text-accent hover:underline"
        >
          Connecting your systems
        </Link>
        ), automate with the{" "}
        <Link
          href="/docs/api"
          className="font-medium text-accent hover:underline"
        >
          API
        </Link>
        , or create more workspaces from the workspace menu in the top bar —
        each with its own knowledge, memory and team.
      </>
    ),
  },
];

export default function GettingStartedPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 lg:py-20">
      <Link
        href="/docs"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Docs
      </Link>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-primary">
        Getting started
      </h1>
      <p className="mt-4 text-base leading-7 text-muted">
        From zero to a workspace that answers with citations — about five
        minutes, no configuration.
      </p>

      <ol className="mt-10 space-y-6">
        {STEPS.map((step, i) => (
          <li key={step.title}>
            <Card className="p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-on-accent">
                  {i + 1}
                </span>
                <h2 className="text-lg font-semibold text-primary">
                  {step.title}
                </h2>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted">{step.body}</p>
            </Card>
          </li>
        ))}
      </ol>

      <Card className="mt-10 bg-canvas p-6">
        <p className="text-sm leading-6 text-muted">
          <strong className="text-primary">Free-tier honesty:</strong> the demo
          deployment runs on free infrastructure that naps when idle. The first
          question or connection after a quiet spell can take up to a minute
          while services wake — everything after is fast.
        </p>
      </Card>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/docs/knowledge"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
        >
          Next: Knowledge &amp; ingestion <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
