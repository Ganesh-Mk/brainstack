"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "motion/react";
import { BrandMark } from "@/components/brand/BrandMark";
import { ButtonLink } from "@/components/ui/Button";
import { MARKETING_LINKS } from "@/lib/nav";
import { cn } from "@/lib/cn";
import { EASE } from "@/components/marketing/motion";

export function MarketingNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b backdrop-blur transition-all duration-300",
        scrolled
          ? "border-border bg-surface/85 shadow-sm"
          : "border-transparent bg-surface/60",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
        <BrandMark />

        <nav className="hidden items-center gap-1 md:flex">
          {MARKETING_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:text-primary"
            >
              {link.label}
              {link.soon && (
                <span className="rounded-full bg-surface-raised px-1.5 py-0.5 text-[10px] font-semibold text-subtle">
                  soon
                </span>
              )}
              <span className="absolute inset-x-3 -bottom-px h-px origin-left scale-x-0 bg-accent transition-transform duration-300 group-hover:scale-x-100" />
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
          aria-expanded={open}
          className="rounded-lg p-2 text-muted transition hover:bg-surface-raised hover:text-primary md:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile sheet */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={reduced ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduced ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: EASE }}
            className="overflow-hidden border-t border-border bg-surface md:hidden"
          >
            <nav className="space-y-1 px-6 py-4">
              {MARKETING_LINKS.map((link, i) => (
                <motion.div
                  key={link.href}
                  initial={reduced ? false : { opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.3,
                    delay: 0.05 + i * 0.05,
                    ease: EASE,
                  }}
                >
                  <Link
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
                </motion.div>
              ))}
              <motion.div
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.25, ease: EASE }}
                className="flex gap-2 pt-3"
              >
                <ButtonLink href="/login" variant="outline" className="flex-1">
                  Log in
                </ButtonLink>
                <ButtonLink href="/signup" variant="accent" className="flex-1">
                  Get started
                </ButtonLink>
              </motion.div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
