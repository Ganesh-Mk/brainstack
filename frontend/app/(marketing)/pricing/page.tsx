import type { Metadata } from "next";
import { CircleCheck, Minus } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import {
  Reveal,
  Stagger,
  StaggerItem,
  TextReveal,
  TiltCard,
} from "@/components/marketing/motion";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "BrainStack pricing — start free, scale when it sticks. Launch pricing for Starter, Team and Enterprise workspaces.",
};

const TIERS = [
  {
    name: "Starter",
    price: "Free",
    per: "",
    tagline: "Try BrainStack with your team",
    cta: { label: "Get started", href: "/signup", variant: "outline" as const },
    featured: false,
  },
  {
    name: "Team",
    price: "$49",
    per: "/mo per workspace",
    tagline: "For teams that run on their knowledge",
    cta: { label: "Get started", href: "/signup", variant: "accent" as const },
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    per: "",
    tagline: "Scale, SSO and guarantees",
    cta: { label: "Contact us", href: "/contact", variant: "outline" as const },
    featured: false,
  },
];

const MATRIX: { feature: string; tiers: [boolean | string, boolean | string, boolean | string] }[] = [
  { feature: "Documents", tiers: ["50", "Unlimited", "Unlimited"] },
  { feature: "Members", tiers: ["5", "Unlimited", "Unlimited"] },
  { feature: "Grounded Q&A with citations", tiers: [true, true, true] },
  { feature: "Live agent trace", tiers: [true, true, true] },
  { feature: "Web search", tiers: [true, true, true] },
  { feature: "Role-based actions (MCP)", tiers: [false, true, true] },
  { feature: "Analytics & evaluation", tiers: [false, true, true] },
  { feature: "Long-term memory", tiers: [false, true, true] },
  { feature: "SSO & audit logs", tiers: [false, false, true] },
  { feature: "Custom MCP integrations", tiers: [false, false, true] },
  { feature: "SLA & dedicated support", tiers: [false, false, true] },
];

function Cell({ value }: { value: boolean | string }) {
  if (value === true)
    return <CircleCheck className="mx-auto h-4 w-4 text-accent" />;
  if (value === false)
    return <Minus className="mx-auto h-4 w-4 text-border-strong" />;
  return <span className="text-sm text-primary">{value}</span>;
}

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-16 lg:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <Reveal>
          <p className="text-xs font-semibold tracking-widest text-accent uppercase">
            Pricing
          </p>
        </Reveal>
        <TextReveal
          text="Simple, honest, per-workspace"
          accent={["honest"]}
          className="mt-3 text-4xl font-semibold tracking-tight text-primary lg:text-5xl"
        />
        <Reveal delay={0.2}>
          <p className="mt-4 text-lg leading-8 text-muted">
            Launch pricing while BrainStack rolls out — lock it in early.
          </p>
        </Reveal>
      </div>

      <Stagger className="mt-12 grid gap-5 md:grid-cols-3">
        {TIERS.map((tier) => (
          <StaggerItem key={tier.name}>
            <TiltCard
              className={
                tier.featured
                  ? "relative h-full rounded-2xl border border-accent bg-surface p-6 shadow-lg"
                  : "h-full rounded-2xl border border-border bg-surface p-6 shadow-xs"
              }
            >
              {tier.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-0.5 text-xs font-semibold text-on-accent">
                  Most popular
                </span>
              )}
              <h2 className="text-base font-semibold text-primary">
                {tier.name}
              </h2>
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
              <ButtonLink
                href={tier.cta.href}
                variant={tier.cta.variant}
                className="mt-6 w-full"
              >
                {tier.cta.label}
              </ButtonLink>
            </TiltCard>
          </StaggerItem>
        ))}
      </Stagger>

      {/* Comparison matrix */}
      <Reveal
        delay={0.15}
        className="mt-14 overflow-x-auto rounded-2xl border border-border bg-surface shadow-xs"
      >
        <table className="w-full min-w-[560px] text-sm">
          <thead className="border-b border-border bg-canvas">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide text-muted uppercase">
                What you get
              </th>
              {TIERS.map((tier) => (
                <th
                  key={tier.name}
                  className="w-32 px-4 py-3 text-center text-xs font-semibold tracking-wide text-primary uppercase"
                >
                  {tier.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MATRIX.map((row) => (
              <tr
                key={row.feature}
                className="border-b border-border last:border-0"
              >
                <td className="px-5 py-3 text-primary">{row.feature}</td>
                {row.tiers.map((value, i) => (
                  <td key={i} className="px-4 py-3 text-center">
                    <Cell value={value} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Reveal>

      <Reveal>
        <p className="mt-8 text-center text-sm text-muted">
          Questions about pricing?{" "}
          <a href="/contact" className="font-medium text-accent">
            Talk to us
          </a>
          . Launch pricing is subject to change before general availability.
        </p>
      </Reveal>
    </div>
  );
}
