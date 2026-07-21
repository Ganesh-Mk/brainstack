import { Sparkles } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { HeroDemo } from "@/components/marketing/HeroDemo";
import { Reveal, TextReveal } from "@/components/marketing/motion";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* ambient backdrop: dot grid + two slow aurora blobs */}
      <div className="bs-dotgrid absolute inset-0 opacity-60" />
      <div
        className="bs-aurora absolute -top-32 -left-24 h-96 w-96 rounded-full bg-accent-100 opacity-50 blur-3xl"
        aria-hidden
      />
      <div
        className="bs-aurora absolute top-1/3 -right-32 h-[28rem] w-[28rem] rounded-full bg-accent-50 opacity-70 blur-3xl [animation-delay:-9s]"
        aria-hidden
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-6 py-20 lg:grid-cols-2 lg:py-28">
        <div>
          <Reveal delay={0} y={14}>
            <span className="inline-flex items-center gap-2 rounded-full border border-accent-200 bg-accent-soft px-3 py-1 text-xs font-medium text-accent-700">
              <Sparkles className="h-3 w-3" />
              The AI knowledge platform for your organization
            </span>
          </Reveal>

          <TextReveal
            as="h1"
            text="Your company's second brain."
            accent={["second", "brain."]}
            delay={0.12}
            className="mt-5 text-[2.6rem] leading-[1.08] font-semibold tracking-tight text-primary sm:text-5xl lg:text-6xl"
          />

          <Reveal delay={0.35} y={18}>
            <p className="mt-5 max-w-xl text-lg leading-8 text-muted">
              Ask in plain language, get answers grounded in your own documents
              — cited, transparent, and able to act in your tools.
            </p>
          </Reveal>

          <Reveal delay={0.48} y={18}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <ButtonLink href="/signup" variant="accent" size="lg">
                Start free
              </ButtonLink>
              <ButtonLink href="/contact" variant="outline" size="lg">
                Book a demo
              </ButtonLink>
            </div>
          </Reveal>

          <Reveal delay={0.58} y={12}>
            <p className="mt-5 text-xs text-subtle">
              No credit card · Isolated per company · Your data never trains a
              model
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.3} y={28}>
          <HeroDemo />
        </Reveal>
      </div>
    </section>
  );
}
