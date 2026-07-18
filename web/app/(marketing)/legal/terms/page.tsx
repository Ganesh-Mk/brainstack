import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 lg:py-20">
      <p className="text-xs font-semibold tracking-widest text-accent uppercase">
        Legal
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-primary">
        Terms of Service
      </h1>
      <p className="mt-2 text-sm text-subtle">Last updated: July 2026</p>

      <div className="mt-10 space-y-8 text-sm leading-7 text-muted [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-primary">
        <section>
          <h2>The service</h2>
          <p className="mt-2">
            BrainStack provides an AI knowledge workspace: your company uploads
            content, members ask questions and receive grounded, cited answers,
            and authorized roles may trigger actions in systems your company
            connects.
          </p>
        </section>
        <section>
          <h2>Your content</h2>
          <p className="mt-2">
            You retain all rights to content you upload. You grant us the
            limited license needed to store, index and retrieve it solely to
            provide the service to your workspace. You are responsible for
            having the rights to the content you upload.
          </p>
        </section>
        <section>
          <h2>AI-generated answers</h2>
          <p className="mt-2">
            Answers are generated from your content and cited so they can be
            verified. They may still contain errors — always verify important
            decisions against the cited sources. BrainStack is a tool, not
            professional advice.
          </p>
        </section>
        <section>
          <h2>Acceptable use</h2>
          <p className="mt-2">
            No attempts to access other companies&apos; workspaces, probe the
            isolation model, resell the service, or use it for unlawful
            purposes. Actions in connected systems are your company&apos;s
            responsibility.
          </p>
        </section>
        <section>
          <h2>Availability</h2>
          <p className="mt-2">
            The platform is rolling out in stages; some capabilities are marked
            &ldquo;Coming Soon.&rdquo; We may modify features during the
            rollout and will communicate material changes.
          </p>
        </section>
        <section>
          <h2>Contact</h2>
          <p className="mt-2">
            Questions about these terms? Write to legal@brainstack.space.
          </p>
        </section>
        <p className="rounded-xl border border-border bg-canvas p-4 text-xs leading-6">
          This document describes intended terms for the BrainStack platform
          while it is in staged rollout, and will be finalized with counsel
          before general availability.
        </p>
      </div>
    </div>
  );
}
