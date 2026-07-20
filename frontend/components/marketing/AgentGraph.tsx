"use client";

/**
 * Animated anatomy of the answering pipeline — the REAL LangGraph shape
 * from the backend (planner → router → native tools / role-gated MCP →
 * synthesize → reflect with a hard 2-retry cap → stream).
 *
 * Desktop renders a live node graph (SVG); mobile renders the same
 * sequence as a vertical animated flow.
 */

import { motion, useInView, useReducedMotion } from "motion/react";
import {
  Brain,
  FileSearch,
  MessageSquare,
  PenLine,
  ShieldCheck,
  Waypoints,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/* ── Graph data ──────────────────────────────────────────────────────── */

type NodeId =
  | "q"
  | "planner"
  | "router"
  | "knowledge"
  | "web"
  | "mcp"
  | "synthesize"
  | "reflect"
  | "answer";

type GNode = {
  id: NodeId;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub: string;
  badge?: string;
};

const NODES: GNode[] = [
  { id: "q", x: 10, y: 183, w: 130, h: 54, title: "Question", sub: "from anyone on the team" },
  { id: "planner", x: 190, y: 183, w: 120, h: 54, title: "Planner", sub: "decides what's needed" },
  { id: "router", x: 360, y: 183, w: 110, h: 54, title: "Router", sub: "picks the tools" },
  { id: "knowledge", x: 530, y: 60, w: 170, h: 54, title: "Knowledge search", sub: "native RAG · your docs" },
  { id: "web", x: 530, y: 183, w: 170, h: 54, title: "Web search", sub: "native · when useful" },
  { id: "mcp", x: 530, y: 306, w: 170, h: 54, title: "Company MCP", sub: "tickets · analytics", badge: "manager-only" },
  { id: "synthesize", x: 760, y: 183, w: 150, h: 54, title: "Synthesize", sub: "grounded + cited" },
  { id: "reflect", x: 968, y: 183, w: 160, h: 54, title: "Reflect", sub: "grounding critic" },
  { id: "answer", x: 968, y: 306, w: 160, h: 54, title: "Streamed answer", sub: "token by token" },
];

type Edge = { id: string; d: string };

const EDGES: Edge[] = [
  { id: "q-planner", d: "M140,210 L190,210" },
  { id: "planner-router", d: "M310,210 L360,210" },
  { id: "router-knowledge", d: "M470,197 C505,190 495,87 530,87" },
  { id: "router-web", d: "M470,210 L530,210" },
  { id: "router-mcp", d: "M470,223 C505,230 495,333 530,333" },
  { id: "knowledge-synthesize", d: "M700,87 C735,87 725,203 760,203" },
  { id: "web-synthesize", d: "M700,210 L760,210" },
  { id: "mcp-synthesize", d: "M700,333 C735,333 725,217 760,217" },
  { id: "synthesize-reflect", d: "M910,210 L968,210" },
  { id: "reflect-answer", d: "M1048,237 L1048,306" },
];

const LOOP_EDGE = "M1048,183 C1048,40 415,40 415,183";

/** Which nodes/edges light up at each beat of the loop. */
const SEQUENCE: { nodes: NodeId[]; edges: string[] }[] = [
  { nodes: ["q"], edges: [] },
  { nodes: ["planner"], edges: ["q-planner"] },
  { nodes: ["router"], edges: ["planner-router"] },
  {
    nodes: ["knowledge", "web", "mcp"],
    edges: ["router-knowledge", "router-web", "router-mcp"],
  },
  {
    nodes: ["synthesize"],
    edges: ["knowledge-synthesize", "web-synthesize", "mcp-synthesize"],
  },
  { nodes: ["reflect"], edges: ["synthesize-reflect"] },
  { nodes: ["answer"], edges: ["reflect-answer"] },
];

const BEAT_MS = 1050;
const HOLD_MS = 2200;

function useSequence(enabled: boolean) {
  const reduced = useReducedMotion();
  const [beat, setBeat] = useState(reduced ? SEQUENCE.length - 1 : -1);

  useEffect(() => {
    if (reduced || !enabled) return;
    let alive = true;
    let i = -1;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (!alive) return;
      i = i >= SEQUENCE.length - 1 ? 0 : i + 1;
      setBeat(i);
      timer = setTimeout(tick, i === SEQUENCE.length - 1 ? HOLD_MS : BEAT_MS);
    };
    timer = setTimeout(tick, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [reduced, enabled]);

  const current = beat >= 0 ? SEQUENCE[beat] : { nodes: [], edges: [] };
  const litNodes = new Set<NodeId>(
    reduced ? NODES.map((n) => n.id) : current.nodes,
  );
  const litEdges = new Set(reduced ? EDGES.map((e) => e.id) : current.edges);
  const passed = new Set<NodeId>();
  if (!reduced && beat >= 0)
    for (let b = 0; b < beat; b++) SEQUENCE[b].nodes.forEach((n) => passed.add(n));
  return { litNodes, litEdges, passed };
}

/* ── Desktop SVG graph ───────────────────────────────────────────────── */

function DesktopGraph() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-80px" });
  const { litNodes, litEdges, passed } = useSequence(inView);

  return (
    <div ref={ref} className="hidden md:block">
      <svg
        viewBox="0 0 1140 400"
        className="w-full"
        role="img"
        aria-label="Diagram: a question flows through the planner and router to native knowledge and web search plus the role-gated Company MCP server, then synthesize and reflect (max 2 retries) stream the answer."
      >
        {/* self-correction loop (static, labeled) */}
        <path
          d={LOOP_EDGE}
          fill="none"
          stroke="var(--line-strong)"
          strokeWidth="1.5"
          strokeDasharray="4 6"
          opacity="0.8"
        />
        <text
          x="716"
          y="32"
          textAnchor="middle"
          style={{ fill: "var(--ink-400)" }}
          fontSize="12"
          fontFamily="var(--font-mono)"
        >
          ⟳ self-corrects · hard cap of 2 attempts
        </text>

        {EDGES.map((e) => {
          const lit = litEdges.has(e.id);
          return (
            <path
              key={e.id}
              d={e.d}
              fill="none"
              className={lit ? "bs-beam-dash" : undefined}
              stroke={lit ? "var(--accent-500)" : "var(--line-strong)"}
              strokeWidth={lit ? 2.25 : 1.5}
              opacity={lit ? 1 : 0.7}
            />
          );
        })}

        {NODES.map((n) => {
          const lit = litNodes.has(n.id);
          const done = passed.has(n.id);
          return (
            <g key={n.id}>
              <motion.rect
                x={n.x}
                y={n.y}
                width={n.w}
                height={n.h}
                rx={14}
                animate={{
                  fill: lit
                    ? "var(--accent-50)"
                    : done
                      ? "var(--tone-raised)"
                      : "var(--tone-surface)",
                  stroke: lit ? "var(--accent-500)" : "var(--line-soft)",
                }}
                strokeWidth={lit ? 2 : 1.25}
                style={{
                  filter: lit
                    ? "drop-shadow(0 6px 16px rgb(79 70 229 / 0.22))"
                    : "drop-shadow(0 1px 2px rgb(27 27 26 / 0.06))",
                }}
              />
              <text
                x={n.x + n.w / 2}
                y={n.y + 23}
                textAnchor="middle"
                fontSize="14.5"
                fontWeight={600}
                style={{ fill: lit ? "var(--accent-700)" : "var(--ink-900)" }}
              >
                {n.title}
              </text>
              <text
                x={n.x + n.w / 2}
                y={n.y + 41}
                textAnchor="middle"
                fontSize="10.5"
                fontFamily="var(--font-mono)"
                style={{ fill: "var(--ink-400)" }}
              >
                {n.sub}
              </text>
              {n.badge && (
                <g>
                  <rect
                    x={n.x + n.w / 2 - 42}
                    y={n.y - 12}
                    width={84}
                    height={18}
                    rx={9}
                    fill="var(--accent-600)"
                  />
                  <text
                    x={n.x + n.w / 2}
                    y={n.y + 0.5}
                    textAnchor="middle"
                    fontSize="9.5"
                    fontWeight={600}
                    fill="#ffffff"
                  >
                    {n.badge}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ── Mobile vertical flow ────────────────────────────────────────────── */

const MOBILE_STEPS: {
  icon: LucideIcon;
  title: string;
  sub: string;
  badge?: string;
}[] = [
  { icon: MessageSquare, title: "Question", sub: "from anyone on the team" },
  { icon: Brain, title: "Planner", sub: "decides what's needed" },
  { icon: Waypoints, title: "Router", sub: "picks the tools" },
  {
    icon: FileSearch,
    title: "Knowledge · Web · Company MCP",
    sub: "native RAG + web, MCP only for managers",
    badge: "role-gated",
  },
  { icon: PenLine, title: "Synthesize", sub: "grounded answer + citations" },
  {
    icon: ShieldCheck,
    title: "Reflect",
    sub: "grounding critic · max 2 attempts",
  },
  { icon: Zap, title: "Streamed answer", sub: "token by token, live trace" },
];

function MobileGraph() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-60px" });
  const reduced = useReducedMotion();
  const [active, setActive] = useState(reduced ? MOBILE_STEPS.length - 1 : -1);

  useEffect(() => {
    if (reduced || !inView) return;
    let alive = true;
    let i = -1;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (!alive) return;
      i = i >= MOBILE_STEPS.length - 1 ? 0 : i + 1;
      setActive(i);
      timer = setTimeout(
        tick,
        i === MOBILE_STEPS.length - 1 ? HOLD_MS : BEAT_MS,
      );
    };
    timer = setTimeout(tick, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [inView, reduced]);

  return (
    <div ref={ref} className="md:hidden">
      <ol className="relative space-y-3">
        <div
          aria-hidden
          className="absolute top-2 bottom-2 left-[21px] w-px bg-border"
        />
        {MOBILE_STEPS.map((step, i) => {
          const lit = i === active || reduced;
          const done = !reduced && active > i;
          return (
            <li key={step.title} className="relative flex items-start gap-3.5">
              <span
                className={cn(
                  "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-all duration-300",
                  lit
                    ? "border-accent bg-accent text-on-accent shadow-md"
                    : done
                      ? "border-accent-200 bg-accent-soft text-accent"
                      : "border-border bg-surface text-subtle",
                )}
              >
                <step.icon className="h-4.5 w-4.5" />
              </span>
              <div
                className={cn(
                  "flex-1 rounded-xl border px-3.5 py-2.5 transition-all duration-300",
                  lit
                    ? "border-accent-200 bg-accent-soft/60"
                    : "border-border bg-surface",
                )}
              >
                <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-primary">
                  {step.title}
                  {step.badge && (
                    <span className="rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-semibold text-on-accent">
                      {step.badge}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 font-mono text-[10px] text-subtle">
                  {step.sub}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-4 text-center font-mono text-[10px] text-subtle">
        ⟳ self-corrects before answering · hard cap of 2 attempts
      </p>
    </div>
  );
}

export function AgentGraph() {
  return (
    <div>
      <DesktopGraph />
      <MobileGraph />
    </div>
  );
}
