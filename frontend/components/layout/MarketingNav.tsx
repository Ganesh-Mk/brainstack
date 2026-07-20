"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";
import { ButtonLink } from "@/components/ui/Button";
import { MARKETING_LINKS } from "@/lib/nav";
import { cn } from "@/lib/cn";

export function MarketingNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
        <BrandMark />

        <nav className="hidden items-center gap-1 md:flex">
          {MARKETING_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:bg-surface-raised hover:text-primary"
            >
              {link.label}
              {link.soon && (
                <span className="rounded-full bg-surface-raised px-1.5 py-0.5 text-[10px] font-semibold text-subtle">
                  soon
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ButtonLink href="/login" variant="ghost">
            Log in
          </ButtonLink>
          <ButtonLink href="/signup" variant="accent">
            Get started
          </ButtonLink>
        </div>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close menu" : "Open menu"}
          className="rounded-lg p-2 text-muted transition hover:bg-surface-raised hover:text-primary md:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile sheet */}
      <div
        className={cn(
          "border-t border-border bg-surface md:hidden",
          open ? "block" : "hidden",
        )}
      >
        <nav className="space-y-1 px-6 py-4">
          {MARKETING_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-primary transition hover:bg-surface-raised"
            >
              {link.label}
              {link.soon && (
                <span className="rounded-full bg-surface-raised px-1.5 py-0.5 text-[10px] font-semibold text-subtle">
                  soon
                </span>
              )}
            </Link>
          ))}
          <div className="flex gap-2 pt-3">
            <ButtonLink href="/login" variant="outline" className="flex-1">
              Log in
            </ButtonLink>
            <ButtonLink href="/signup" variant="accent" className="flex-1">
              Get started
            </ButtonLink>
          </div>
        </nav>
      </div>
    </header>
  );
}
