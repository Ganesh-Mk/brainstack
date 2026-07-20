"use client";

/**
 * Looping replay of the ingestion pipeline (Upload → Parse → Chunk → Embed
 * → Index) — the exact stages of backend Pipeline 1, ending in the live
 * "312/312 indexed" moment from the product's ingestion progress view.
 */

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Boxes,
  CircleCheck,
  Database,
  FileText,
  LoaderCircle,
  ScanText,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

type Stage = {
  icon: LucideIcon;
  title: string;
  detail: string;
  mono: string;
  ms: number;
};

const STAGES: Stage[] = [
  {
    icon: Upload,
    title: "Upload",
    detail: "PDFs, Word docs, URLs",
    mono: "handbook.pdf · 4 pages",
    ms: 1100,
  },
  {
    icon: ScanText,
    title: "Extract",
    detail: "Text + metadata per page",
    mono: "pages → text · tenant tagged",
    ms: 1100,
  },
  {
    icon: FileText,
    title: "Chunk",
    detail: "Overlapping passages",
    mono: "~800 tokens · overlap kept",
    ms: 1100,
  },
  {
    icon: Boxes,
    title: "Embed",
    detail: "Text becomes vectors",
    mono: "chunks → embeddings, in parallel",
    ms: 1300,
  },
  {
    icon: Database,
    title: "Index",
    detail: "Into your private namespace",
    mono: "Pinecone · your tenant only",
    ms: 1400,
  },
];

const COUNT_TARGET = 312;
const HOLD_MS = 2800;

export function PipelineAnimation() {
  const reduced = useReducedMotion();
  const [active, setActive] = useState(reduced ? STAGES.length : 0); // index of running stage; STAGES.length = all done
  const [count, setCount] = useState(reduced ? COUNT_TARGET : 0);
  const [ready, setReady] = useState(!!reduced);
  const [cycle, setCycle] = useState(0);
  const cancelled = useRef(false);

  useEffect(() => {
    if (reduced) return;
    cancelled.current = false;
    const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

    async function run() {
      setActive(0);
      setCount(0);
      setReady(false);
      for (let i = 0; i < STAGES.length; i++) {
        if (cancelled.current) return;
        setActive(i);
        if (i === STAGES.length - 1) {
          // count chunks while indexing
          const step = STAGES[i].ms / COUNT_TARGET;
          for (let c = 0; c <= COUNT_TARGET; c += 6) {
            if (cancelled.current) return;
            setCount(Math.min(c, COUNT_TARGET));
            await sleep(step * 6);
          }
          setCount(COUNT_TARGET);
        } else {
          await sleep(STAGES[i].ms);
        }
      }
      if (cancelled.current) return;
      setActive(STAGES.length);
      setReady(true);
      await sleep(HOLD_MS);
      if (cancelled.current) return;
      setCycle((c) => c + 1);
    }

    run();
    return () => {
      cancelled.current = true;
    };
  }, [cycle, reduced]);

  return (
    <div className="relative">
      {/* Desktop: horizontal rail · Mobile: vertical rail */}
      <ol className="relative grid gap-6 md:grid-cols-5 md:gap-4">
        {/* connector — behind the icon tiles */}
        <div
          aria-hidden
          className="absolute top-0 bottom-0 left-[23px] w-px bg-border md:top-[23px] md:right-10 md:bottom-auto md:left-10 md:h-px md:w-auto"
        />

        {STAGES.map((stage, i) => {
          const state = i < active ? 2 : i === active ? 1 : 0;
          return (
            <li key={stage.title} className="relative flex gap-4 md:flex-col md:gap-0">
              <div className="relative shrink-0">
                <motion.span
                  animate={
                    reduced
                      ? undefined
                      : {
                          scale: state === 1 ? 1.08 : 1,
                          boxShadow:
                            state === 1
                              ? "0 8px 24px rgb(79 70 229 / 0.25)"
                              : "0 1px 2px rgb(27 27 26 / 0.05)",
                        }
                  }
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-xl border transition-colors",
                    state === 1
                      ? "border-accent bg-accent text-on-accent"
                      : state === 2
                        ? "border-accent-200 bg-accent-soft text-accent"
                        : "border-border bg-surface text-subtle",
                  )}
                >
                  <stage.icon className="h-5 w-5" />
                </motion.span>
                {state === 2 && (
                  <motion.span
                    initial={reduced ? false : { scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-success text-white"
                  >
                    <CircleCheck className="h-3 w-3" />
                  </motion.span>
                )}
              </div>

              <div className="pb-2 md:mt-4 md:pb-0">
                <h3
                  className={cn(
                    "flex items-center gap-1.5 text-sm font-semibold transition-colors",
                    state === 1 ? "text-accent" : "text-primary",
                  )}
                >
                  {stage.title}
                  {state === 1 && (
                    <LoaderCircle className="h-3 w-3 animate-spin text-accent" />
                  )}
                </h3>
                <p className="mt-0.5 text-xs leading-5 text-muted">
                  {stage.detail}
                </p>
                <p
                  className={cn(
                    "mt-1.5 font-mono text-[10px] transition-opacity",
                    state > 0 ? "text-subtle opacity-100" : "opacity-0",
                  )}
                >
                  {stage.mono}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      {/* progress footer */}
      <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-border bg-surface px-5 py-3.5 shadow-xs">
        <span className="font-mono text-xs text-muted tabular-nums">
          {count}/{COUNT_TARGET} chunks indexed
        </span>
        <div className="h-1.5 min-w-24 flex-1 overflow-hidden rounded-full bg-surface-raised">
          <motion.div
            className="h-full rounded-full bg-accent"
            animate={{ width: `${(count / COUNT_TARGET) * 100}%` }}
            transition={{ duration: 0.2, ease: "linear" }}
          />
        </div>
        <AnimatePresence>
          {ready && (
            <motion.span
              initial={reduced ? false : { opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success"
            >
              <CircleCheck className="h-3.5 w-3.5" /> Ready to answer
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
