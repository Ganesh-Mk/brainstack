import {
  Brain,
  CircleCheck,
  Globe,
  LoaderCircle,
  Search,
  Sparkles,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";

/** Stylized product mock: a grounded answer streaming beside its live trace. */
function HeroMock() {
  return (
    <div className="bs-float relative">
      {/* soft accent glow behind the mock */}
      <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-tr from-accent-100 via-transparent to-accent-soft blur-2xl" />
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface shadow-xl">
        {/* window chrome */}
        <div className="flex items-center gap-1.5 border-b border-border bg-canvas px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
          <span className="ml-3 rounded-md bg-surface px-2 py-0.5 font-mono text-[10px] text-subtle">
            app.brainstack.space
          </span>
        </div>
        <div className="grid sm:grid-cols-[1.5fr_1fr]">
          {/* chat side */}
          <div className="space-y-3 p-4">
            <div className="ml-auto w-fit max-w-[90%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-xs text-on-primary">
              What changed in our Q3 refund policy?
            </div>
            <div className="max-w-[95%] rounded-2xl rounded-bl-md border border-border bg-canvas px-3.5 py-2.5 text-xs leading-5 text-primary">
              The Q3 update shortens the refund window from 45 to 30 days{" "}
              <span className="rounded bg-accent-soft px-1 font-medium text-accent-700">
                [1]
              </span>{" "}
              and adds an exception for enterprise plans{" "}
              <span className="rounded bg-accent-soft px-1 font-medium text-accent-700">
                [2]
              </span>
              …
              <span className="ml-0.5 inline-block h-3 w-1 animate-pulse rounded-sm bg-accent align-middle" />
            </div>
            <div className="rounded-lg border-l-2 border-accent bg-accent-soft/60 px-3 py-2 text-[10px] leading-4 text-muted">
              <span className="font-semibold text-primary">[1]</span>{" "}
              policies-2026.pdf · page 7 — “refunds accepted within 30 days of
              purchase…”
            </div>
          </div>
          {/* trace side */}
          <div className="border-t border-border bg-canvas p-4 sm:border-t-0 sm:border-l">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-widest text-subtle uppercase">
              <Sparkles className="h-3 w-3" /> Agent trace
            </p>
            <ul className="mt-3 space-y-2.5 text-[11px]">
              <li className="flex items-center gap-1.5 text-primary">
                <CircleCheck className="h-3 w-3 text-success" />
                <Brain className="h-3 w-3 text-subtle" /> Planning
              </li>
              <li className="flex items-center gap-1.5 text-primary">
                <CircleCheck className="h-3 w-3 text-success" />
                <Search className="h-3 w-3 text-subtle" /> Knowledge search
              </li>
              <li className="flex items-center gap-1.5 text-primary">
                <CircleCheck className="h-3 w-3 text-success" />
                <Globe className="h-3 w-3 text-subtle" /> Web search
              </li>
              <li className="flex items-center gap-1.5 font-medium text-accent">
                <LoaderCircle className="h-3 w-3 animate-spin" /> Drafting…
              </li>
            </ul>
            <div className="mt-4 rounded-lg border border-border bg-surface p-2.5">
              <p className="font-mono text-[9px] text-subtle">
                5 chunks · 0.89 similarity
                <br />
                grounded · 2 citations
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="bs-dotgrid absolute inset-0 opacity-60" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-6 py-20 lg:grid-cols-2 lg:py-28">
        <div>
          <span
            className="bs-fade-up inline-flex items-center gap-2 rounded-full border border-accent-200 bg-accent-soft px-3 py-1 text-xs font-medium text-accent-700"
            style={{ animationDelay: "0ms" }}
          >
            <Sparkles className="h-3 w-3" />
            The AI knowledge platform for your organization
          </span>
          <h1
            className="bs-fade-up mt-5 text-5xl leading-[1.08] font-semibold tracking-tight text-primary lg:text-6xl"
            style={{ animationDelay: "80ms" }}
          >
            Your company&apos;s second brain —{" "}
            <span className="text-accent">fully stacked.</span>
          </h1>
          <p
            className="bs-fade-up mt-5 max-w-xl text-lg leading-8 text-muted"
            style={{ animationDelay: "160ms" }}
          >
            BrainStack turns your documents and systems into an intelligent
            assistant your whole team can talk to. Grounded answers with
            citations. A live view of the AI&apos;s reasoning. Real actions in
            your own tools.
          </p>
          <div
            className="bs-fade-up mt-8 flex flex-wrap items-center gap-3"
            style={{ animationDelay: "240ms" }}
          >
            <ButtonLink href="/signup" variant="accent" size="lg">
              Start free
            </ButtonLink>
            <ButtonLink href="/contact" variant="outline" size="lg">
              Book a demo
            </ButtonLink>
          </div>
          <p
            className="bs-fade-up mt-5 text-xs text-subtle"
            style={{ animationDelay: "300ms" }}
          >
            No credit card · Isolated per company · Your data never trains a
            model
          </p>
        </div>
        <div className="bs-fade-up" style={{ animationDelay: "200ms" }}>
          <HeroMock />
        </div>
      </div>
    </section>
  );
}
