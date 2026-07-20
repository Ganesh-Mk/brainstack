import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 lg:py-20">
      <p className="text-xs font-semibold tracking-widest text-accent uppercase">
        Legal
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-primary">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-subtle">Last updated: July 2026</p>

      <div className="mt-10 space-y-8 text-sm leading-7 text-muted [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-primary">
        <section>
          <h2>The short version</h2>
          <p className="mt-2">
            Your documents are yours. We store them to power your workspace,
            retrieve from them to ground answers for your team, and nothing
            else. We never sell data and never use your content to train AI
            models.
          </p>
        </section>
        <section>
          <h2>What we collect</h2>
          <p className="mt-2">
            Account details (name, email, company), the content you upload or
            connect, your questions and the assistant&apos;s answers, and
            operational metadata (usage, cost, latency, quality scores) needed
            to run and improve your workspace.
          </p>
        </section>
        <section>
          <h2>How your content is used</h2>
          <p className="mt-2">
            Uploaded content is parsed and indexed inside your company&apos;s
            isolated namespace. It is retrieved only to answer questions asked
            within your workspace. It is never shared across companies and
            never used for model training.
          </p>
        </section>
        <section>
          <h2>Isolation</h2>
          <p className="mt-2">
            Workspaces are isolated at the storage layer. Access to answers and
            actions is governed by each member&apos;s role, and external
            systems you connect independently verify identity before executing
            anything.
          </p>
        </section>
        <section>
          <h2>Deletion</h2>
          <p className="mt-2">
            Delete a document and its derived knowledge is removed from your
            workspace&apos;s index. Delete your workspace and all associated
            content and metadata are removed from our systems within 30 days.
          </p>
        </section>
        <section>
          <h2>Contact</h2>
          <p className="mt-2">
            Questions about privacy? Write to privacy@brainstack.space.
          </p>
        </section>
        <p className="rounded-xl border border-border bg-canvas p-4 text-xs leading-6">
          This document describes intended practices for the BrainStack
          platform while it is in staged rollout, and will be finalized with
          counsel before general availability.
        </p>
      </div>
    </div>
  );
}
