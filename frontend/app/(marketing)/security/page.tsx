import type { Metadata } from "next";
import {
  Building2,
  Eye,
  FileText,
  Fingerprint,
  Lock,
  Quote,
  ShieldCheck,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import {
  Reveal,
  Stagger,
  StaggerItem,
  TextReveal,
  TiltCard,
} from "@/components/marketing/motion";

export const metadata: Metadata = {
  title: "Security",
  description:
    "How BrainStack isolates every company's data, gates actions by role, and keeps AI answers grounded and verifiable.",
};

const PILLARS = [
  {
    icon: Building2,
    title: "Tenant isolation at the storage layer",
    text: "Every workspace's knowledge lives in its own namespace, derived from the authenticated session — never from anything a client sends. A query from one company physically cannot touch another company's vectors. This is architecture, not policy.",
  },
  {
    icon: Fingerprint,
    title: "Capability-based permissions",
    text: "Roles don't just hide buttons. An employee's agent session never connects to the systems that expose manager actions — the capabilities are absent from the session itself, not blocked by a prompt that could be talked around.",
  },
  {
    icon: Quote,
    title: "Grounded, verifiable answers",
    text: "Answers are constructed only from retrieved passages of your own documents, every fact carries a citation you can open at the source page, and the assistant says “I don't know” rather than inventing. Automated faithfulness scoring watches for drift.",
  },
  {
    icon: Eye,
    title: "Full auditability",
    text: "Every question leaves a trace: what was retrieved, which tools were called, by whom, at what cost. When you need to know why the AI said something, the answer is a click away.",
  },
  {
    icon: Lock,
    title: "Your data is never training data",
    text: "Documents you upload ground answers for your workspace, and that is all they do. Nothing is used to train or fine-tune models — ours or anyone else's.",
  },
  {
    icon: FileText,
    title: "Defense in depth for actions",
    text: "External actions are validated twice: the agent only exposes tools your role permits, and the connected system independently verifies the caller's identity, role and workspace before executing anything.",
  },
];

export default function SecurityPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-16 lg:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <Reveal>
          <p className="text-xs font-semibold tracking-widest text-accent uppercase">
            Security &amp; trust
          </p>
        </Reveal>
        <TextReveal
          text="Safe by architecture"
          accent={["architecture"]}
          className="mt-3 text-4xl font-semibold tracking-tight text-primary lg:text-5xl"
        />
        <Reveal delay={0.2}>
          <p className="mt-4 text-lg leading-8 text-muted">
            The scariest failure of multi-tenant AI is silent: another
            company&apos;s data paraphrased into a fluent, confident answer.
            BrainStack is designed so that failure can&apos;t happen.
          </p>
        </Reveal>
      </div>

      <Stagger className="mt-14 grid gap-5 md:grid-cols-2">
        {PILLARS.map((p) => (
          <StaggerItem key={p.title}>
            <TiltCard className="h-full rounded-2xl border border-border bg-surface p-6 shadow-xs">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-on-primary">
                <p.icon className="h-4.5 w-4.5" />
              </span>
              <h2 className="mt-4 text-lg font-semibold text-primary">
                {p.title}
              </h2>
              <p className="mt-2 text-sm leading-7 text-muted">{p.text}</p>
            </TiltCard>
          </StaggerItem>
        ))}
      </Stagger>

      <Reveal className="mt-14 rounded-3xl border border-border bg-canvas p-10 text-center">
        <ShieldCheck className="mx-auto h-8 w-8 text-accent" />
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-primary">
          Have a security question we didn&apos;t answer?
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
          We&apos;d rather over-explain than under-deliver. Ask us anything
          about isolation, retention or permissions.
        </p>
        <ButtonLink href="/contact" variant="accent" className="mt-6">
          Contact us
        </ButtonLink>
      </Reveal>
    </div>
  );
}
