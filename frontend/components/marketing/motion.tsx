"use client";

/**
 * Marketing motion primitives — the shared animation vocabulary for
 * brainstack.space. Every marketing section composes these instead of
 * hand-rolling framer-motion props, so easing/durations stay consistent
 * and reduced-motion is respected in one place.
 */

import {
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  animate,
  type Variants,
} from "motion/react";
import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";

/** The house easing — a soft overshoot-free ease-out. */
export const EASE = [0.22, 1, 0.36, 1] as const;

/* ── Reveal ──────────────────────────────────────────────────────────────
   Fade-up on scroll into view. The workhorse. */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  once = true,
  className,
  ...props
}: ComponentProps<typeof motion.div> & {
  delay?: number;
  y?: number;
  once?: boolean;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: EASE }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/* ── Stagger group ───────────────────────────────────────────────────────
   Parent orchestrates; children use <StaggerItem>. */
const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

const staggerChild: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.65, ease: EASE } },
};

export function Stagger({
  children,
  className,
  once = true,
  ...props
}: ComponentProps<typeof motion.div> & { once?: boolean }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      variants={reduced ? undefined : staggerParent}
      initial={reduced ? false : "hidden"}
      whileInView="show"
      viewport={{ once, margin: "-60px" }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  ...props
}: ComponentProps<typeof motion.div>) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      variants={reduced ? undefined : staggerChild}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/* ── Word-by-word headline reveal ────────────────────────────────────────
   Splits text into words; accent styling via `accents` (exact word match,
   punctuation-insensitive prefix). */
export function TextReveal({
  text,
  accent = [],
  className,
  as: Tag = "h1",
  delay = 0,
}: {
  text: string;
  /** Words (lowercased, punctuation stripped) to paint text-accent. */
  accent?: string[];
  className?: string;
  as?: "h1" | "h2" | "h3" | "p" | "span";
  delay?: number;
}) {
  const reduced = useReducedMotion();
  const words = text.split(" ");
  const MotionTag = motion.create(Tag);
  return (
    <MotionTag
      className={className}
      initial={reduced ? false : "hidden"}
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      variants={{
        hidden: {},
        show: {
          transition: { staggerChildren: 0.055, delayChildren: delay },
        },
      }}
      aria-label={text}
    >
      {words.map((word, i) => {
        const bare = word.toLowerCase().replace(/[^a-z'-]/g, "");
        const isAccent = accent.includes(bare);
        return (
          <motion.span
            key={`${word}-${i}`}
            aria-hidden
            className={cn(
              "inline-block whitespace-pre",
              isAccent && "text-accent",
            )}
            variants={
              reduced
                ? undefined
                : {
                    hidden: {
                      opacity: 0,
                      y: 18,
                      filter: "blur(6px)",
                    },
                    show: {
                      opacity: 1,
                      y: 0,
                      filter: "blur(0px)",
                      transition: { duration: 0.55, ease: EASE },
                    },
                  }
            }
          >
            {word}
            {i < words.length - 1 ? " " : ""}
          </motion.span>
        );
      })}
    </MotionTag>
  );
}

/* ── CountUp ─────────────────────────────────────────────────────────────
   Animates a number from 0 when scrolled into view. Handles decimals. */
export function CountUp({
  value,
  decimals = 0,
  duration = 1.6,
  prefix = "",
  suffix = "",
  className,
}: {
  value: number;
  decimals?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(
    reduced ? value.toFixed(decimals) : (0).toFixed(decimals),
  );

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      setDisplay(value.toFixed(decimals));
      return;
    }
    const controls = animate(0, value, {
      duration,
      ease: EASE,
      onUpdate: (v) => setDisplay(v.toFixed(decimals)),
    });
    return () => controls.stop();
  }, [inView, value, decimals, duration, reduced]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}

/* ── Tilt card ───────────────────────────────────────────────────────────
   Subtle 3D tilt following the pointer + glow position for .bs-glow-card. */
export function TiltCard({
  children,
  className,
  maxTilt = 6,
  ...props
}: ComponentProps<typeof motion.div> & { maxTilt?: number }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 260, damping: 24 });
  const sry = useSpring(ry, { stiffness: 260, damping: 24 });
  const transform = useTransform(
    [srx, sry],
    ([a, b]) => `perspective(900px) rotateX(${a}deg) rotateY(${b}deg)`,
  );

  return (
    <motion.div
      ref={ref}
      className={cn("bs-glow-card", className)}
      style={reduced ? undefined : { transform }}
      onPointerMove={(e) => {
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width;
        const py = (e.clientY - rect.top) / rect.height;
        el.style.setProperty("--glow-x", `${px * 100}%`);
        el.style.setProperty("--glow-y", `${py * 100}%`);
        if (!reduced) {
          rx.set((0.5 - py) * maxTilt);
          ry.set((px - 0.5) * maxTilt);
        }
      }}
      onPointerLeave={() => {
        rx.set(0);
        ry.set(0);
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/* ── Marquee ─────────────────────────────────────────────────────────────
   Infinite horizontal loop; content duplicated for the seamless wrap. */
export function Marquee({
  children,
  duration = 36,
  className,
}: {
  children: ReactNode;
  duration?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden",
        "[mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]",
        className,
      )}
    >
      <div
        className="bs-marquee flex w-max items-center gap-10 group-hover:[animation-play-state:paused]"
        style={
          { "--bs-marquee-duration": `${duration}s` } as React.CSSProperties
        }
      >
        <div className="flex shrink-0 items-center gap-10">{children}</div>
        <div className="flex shrink-0 items-center gap-10" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ── Typewriter ──────────────────────────────────────────────────────────
   Types `text` character-by-character once in view. onDone fires after a
   short settle. Reduced motion renders instantly. */
export function useTypewriter(
  text: string,
  {
    speed = 28,
    startDelay = 0,
    enabled = true,
  }: { speed?: number; startDelay?: number; enabled?: boolean } = {},
) {
  const reduced = useReducedMotion();
  const [count, setCount] = useState(reduced ? text.length : 0);
  const [done, setDone] = useState(!!reduced);

  useEffect(() => {
    if (!enabled) return;
    if (reduced) {
      setCount(text.length);
      setDone(true);
      return;
    }
    setCount(0);
    setDone(false);
    let i = 0;
    let interval: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      interval = setInterval(() => {
        i += 1;
        setCount(i);
        if (i >= text.length) {
          if (interval) clearInterval(interval);
          setDone(true);
        }
      }, speed);
    }, startDelay);
    return () => {
      clearTimeout(start);
      if (interval) clearInterval(interval);
    };
  }, [text, speed, startDelay, enabled, reduced]);

  return { visible: text.slice(0, count), done };
}
