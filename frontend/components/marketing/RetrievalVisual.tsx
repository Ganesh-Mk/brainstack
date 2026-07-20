"use client";

/**
 * The hybrid retrieval story, animated. This dramatizes a REAL, unit-tested
 * behavior (docs/PHASE_8_COMPLETE.md): dense retrieval can miss an exact
 * token like "ERR_4021"; BM25 catches it; Reciprocal Rank Fusion merges
 * both rankings so the right passage still reaches the answer.
 */

import { motion, useReducedMotion } from "motion/react";
import { ArrowDown, ArrowRight, Merge, Sparkle, Star } from "lucide-react";
import { cn } from "@/lib/cn";
import { EASE } from "@/components/marketing/motion";

type Row = {
  label: string;
  score?: string;
  width: number; // relative bar width, 0–100
  hot?: boolean; // the ERR_4021 chunk
  missed?: boolean; // dense failed to surface it
};

const DENSE: Row[] = [
  { label: "returns & refunds policy", score: "0.89", width: 92 },
  { label: "expense approval limits", score: "0.71", width: 74 },
  { label: "client dispute handling", score: "0.63", width: 60 },
  { label: "ERR_4021 troubleshooting", missed: true, width: 0, hot: true },
];

const BM25: Row[] = [
  { label: "ERR_4021 troubleshooting", score: "match", width: 96, hot: true },
  { label: "error code reference", score: "match", width: 68 },
  { label: "returns & refunds policy", score: "match", width: 55 },
  { label: "on-call escalation", score: "match", width: 41 },
];

const MERGED: Row[] = [
  { label: "ERR_4021 troubleshooting", score: "#1", width: 100, hot: true },
  { label: "returns & refunds policy", score: "#2", width: 88 },
  { label: "error code reference", score: "#3", width: 72 },
  { label: "expense approval limits", score: "#4", width: 61 },
  { label: "client dispute handling", score: "#5", width: 52 },
  { label: "on-call escalation", score: "#6", width: 45 },
];

function Column({
  title,
  mono,
  rows,
  delayBase,
  accented,
}: {
  title: string;
  mono: string;
  rows: Row[];
  delayBase: number;
  accented?: boolean;
}) {
  const reduced = useReducedMotion();
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 shadow-xs",
        accented
          ? "border-accent-200 bg-accent-soft/40"
          : "border-border bg-surface",
      )}
    >
      <p className="text-sm font-semibold text-primary">{title}</p>
      <p className="mt-0.5 font-mono text-[10px] text-subtle">{mono}</p>
      <ul className="mt-3.5 space-y-2">
        {rows.map((row, i) => (
          <motion.li
            key={row.label + i}
            initial={reduced ? false : { opacity: 0, x: -14 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{
              duration: 0.5,
              delay: delayBase + i * 0.1,
              ease: EASE,
            }}
            className={cn(
              "rounded-lg border px-2.5 py-1.5",
              row.missed
                ? "border-dashed border-border bg-canvas opacity-60"
                : row.hot
                  ? "border-accent-300 bg-accent-soft"
                  : "border-border bg-canvas",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  "flex items-center gap-1 truncate font-mono text-[10.5px]",
                  row.hot && !row.missed
                    ? "font-semibold text-accent-700"
                    : "text-muted",
                )}
              >
                {row.hot && !row.missed && (
                  <Star className="h-2.5 w-2.5 shrink-0 fill-current" />
                )}
                {row.label}
              </span>
              <span className="shrink-0 font-mono text-[9.5px] text-subtle">
                {row.missed ? "not in top-25" : row.score}
              </span>
            </div>
            {!row.missed && (
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-raised">
                <motion.div
                  initial={reduced ? { width: `${row.width}%` } : { width: 0 }}
                  whileInView={{ width: `${row.width}%` }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{
                    duration: 0.7,
                    delay: delayBase + 0.15 + i * 0.1,
                    ease: EASE,
                  }}
                  className={cn(
                    "h-full rounded-full",
                    row.hot ? "bg-accent" : "bg-border-strong",
                  )}
                />
              </div>
            )}
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

export function RetrievalVisual() {
  const reduced = useReducedMotion();
  return (
    <div>
      <div className="grid items-stretch gap-4 lg:grid-cols-[1fr_auto_1fr_auto_1.1fr]">
        {/* two retrievers, stacked on mobile */}
        <div className="space-y-4 lg:contents">
          <Column
            title="Dense retrieval"
            mono="Pinecone · top-25 by meaning"
            rows={DENSE}
            delayBase={0}
          />
          <div className="hidden items-center justify-center lg:flex">
            <ArrowRight className="h-5 w-5 text-subtle" />
          </div>
          <Column
            title="BM25 keyword"
            mono="Postgres chunks · top-25 by exact tokens"
            rows={BM25}
            delayBase={0.25}
          />
        </div>

        <div className="flex items-center justify-center py-1 lg:hidden">
          <ArrowDown className="h-5 w-5 text-subtle" />
        </div>
        <div className="hidden items-center justify-center lg:flex">
          <motion.span
            initial={reduced ? false : { opacity: 0, scale: 0.7 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.55, duration: 0.4, ease: EASE }}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-accent-200 bg-accent-soft text-accent"
          >
            <Merge className="h-4.5 w-4.5" />
          </motion.span>
        </div>

        <Column
          title="Fused result"
          mono="RRF merge → rerank* → top-6 to the agent"
          rows={MERGED}
          delayBase={0.6}
          accented
        />
      </div>

      <motion.p
        initial={reduced ? false : { opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 1.1, duration: 0.5, ease: EASE }}
        className="mt-5 flex flex-wrap items-center justify-center gap-1.5 text-center text-xs text-muted"
      >
        <Sparkle className="h-3.5 w-3.5 text-accent" />
        Meaning-based search missed the exact code
        <span className="rounded bg-accent-soft px-1.5 py-0.5 font-mono text-[10px] font-semibold text-accent-700">
          ERR_4021
        </span>
        — keyword search caught it, and rank fusion put it first. Every answer
        gets both.
      </motion.p>
    </div>
  );
}
