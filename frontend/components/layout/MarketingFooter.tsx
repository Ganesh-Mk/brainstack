import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";

const COLUMNS: {
  title: string;
  links: { label: string; href: string; soon?: boolean }[];
}[] = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/features" },
      { label: "Pricing", href: "/pricing" },
      { label: "Security", href: "/security" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Docs", href: "/docs", soon: true },
      { label: "Blog", href: "/blog", soon: true },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/legal/privacy" },
      { label: "Terms", href: "/legal/terms" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-canvas">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <BrandMark />
            <p className="mt-3 max-w-xs text-sm leading-6 text-muted">
              Your company&apos;s second brain — grounded answers from your own
              knowledge, real actions in your own systems.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="text-xs font-semibold tracking-wide text-subtle uppercase">
                {col.title}
              </p>
              <ul className="mt-3 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-primary"
                    >
                      {link.label}
                      {link.soon && (
                        <span className="rounded-full bg-surface-raised px-1.5 py-0.5 text-[10px] font-semibold text-subtle">
                          soon
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 sm:flex-row sm:items-center">
          <p className="text-xs text-subtle">
            © {new Date().getFullYear()} BrainStack. All rights reserved.
          </p>
          <p className="text-xs text-subtle">
            Multi-tenant · Grounded &amp; cited · Role-based actions
          </p>
        </div>
      </div>
    </footer>
  );
}
