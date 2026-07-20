"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Plus } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { EASE } from "@/components/marketing/motion";

export function FaqAccordion({
  items,
}: {
  items: { q: string; a: string }[];
}) {
  const [open, setOpen] = useState<number | null>(0);
  const reduced = useReducedMotion();

  return (
    <div className="space-y-3">
      {items.map((faq, i) => {
        const isOpen = open === i;
        return (
          <motion.div
            key={faq.q}
            initial={reduced ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.5, delay: i * 0.06, ease: EASE }}
            className={cn(
              "overflow-hidden rounded-2xl border bg-surface shadow-xs transition-colors",
              isOpen ? "border-accent-200 shadow-md" : "border-border",
            )}
          >
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold text-primary"
            >
              {faq.q}
              <motion.span
                animate={reduced ? undefined : { rotate: isOpen ? 45 : 0 }}
                transition={{ duration: 0.25, ease: EASE }}
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                  isOpen
                    ? "bg-accent text-on-accent"
                    : "bg-surface-raised text-subtle",
                )}
              >
                <Plus className="h-3.5 w-3.5" />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={reduced ? false : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={
                    reduced ? undefined : { height: 0, opacity: 0 }
                  }
                  transition={{ duration: 0.35, ease: EASE }}
                >
                  <p className="px-5 pb-5 text-sm leading-7 text-muted">
                    {faq.a}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}
