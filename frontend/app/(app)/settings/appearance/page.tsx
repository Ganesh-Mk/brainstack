"use client";

import { Check, Palette, RotateCcw, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { useMounted } from "@/hooks/useMounted";
import { cn } from "@/lib/cn";
import {
  ACCENTS,
  DEFAULT_ACCENT,
  DEFAULT_TONE,
  TONES,
  type AccentId,
  type ToneId,
} from "@/lib/theme";
import { useThemeStore } from "@/stores/theme";
import { toast } from "@/stores/toast";

/**
 * ⭐ LIVE in Phase 1. This page is the proof of the global design system:
 * picking an accent or canvas rewrites the primitive tokens on :root and the
 * ENTIRE product — marketing site included — restyles instantly. Nothing
 * else changes; components only ever knew semantic token names.
 */
export default function AppearancePage() {
  const mounted = useMounted();
  const accentId = useThemeStore((s) => s.accentId);
  const toneId = useThemeStore((s) => s.toneId);
  const setAccent = useThemeStore((s) => s.setAccent);
  const setTone = useThemeStore((s) => s.setTone);
  const reset = useThemeStore((s) => s.reset);

  const activeAccent: AccentId = mounted ? accentId : DEFAULT_ACCENT;
  const activeTone: ToneId = mounted ? toneId : DEFAULT_TONE;

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-4.5 w-4.5 text-accent" />
              Appearance
            </CardTitle>
            <CardDescription>
              One token system drives every surface. Change it here and the
              whole product follows — instantly, everywhere.
            </CardDescription>
          </div>
          <Badge variant="success">Live in Phase 1</Badge>
        </div>

        {/* Accent picker */}
        <p className="mt-6 text-xs font-semibold tracking-wide text-subtle uppercase">
          Accent
        </p>
        <div className="mt-2.5 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {(Object.keys(ACCENTS) as AccentId[]).map((id) => {
            const accent = ACCENTS[id];
            const active = id === activeAccent;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setAccent(id);
                  toast(
                    `Accent: ${accent.label}`,
                    "Every button, link and badge just followed.",
                    "success",
                  );
                }}
                className={cn(
                  "rounded-xl border p-3 text-left transition",
                  active
                    ? "border-accent shadow-md"
                    : "border-border hover:border-border-strong hover:shadow-xs",
                )}
              >
                <span className="flex items-center justify-between">
                  <span
                    className="h-7 w-7 rounded-lg shadow-xs"
                    style={{ backgroundColor: accent.ramp[600] }}
                  />
                  {active && <Check className="h-4 w-4 text-accent" />}
                </span>
                <span className="mt-2 block text-sm font-medium text-primary">
                  {accent.label}
                </span>
                <span className="mt-1.5 flex gap-1">
                  {[300, 500, 700].map((step) => (
                    <span
                      key={step}
                      className="h-1.5 flex-1 rounded-full"
                      style={{
                        backgroundColor:
                          accent.ramp[step as keyof typeof accent.ramp],
                      }}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>

        {/* Canvas tone picker */}
        <p className="mt-7 text-xs font-semibold tracking-wide text-subtle uppercase">
          Canvas
        </p>
        <div className="mt-2.5 grid grid-cols-3 gap-3">
          {(Object.keys(TONES) as ToneId[]).map((id) => {
            const tone = TONES[id];
            const active = id === activeTone;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setTone(id);
                  toast(
                    `Canvas: ${tone.label}`,
                    "Backgrounds, borders and raised surfaces updated.",
                    "success",
                  );
                }}
                className={cn(
                  "overflow-hidden rounded-xl border text-left transition",
                  active
                    ? "border-accent shadow-md"
                    : "border-border hover:border-border-strong hover:shadow-xs",
                )}
              >
                <span
                  className="block h-12 border-b"
                  style={{
                    backgroundColor: tone.canvas,
                    borderColor: tone.lineSoft,
                  }}
                >
                  <span
                    className="mt-3 ml-3 block h-5 w-16 rounded-md border bg-white shadow-xs"
                    style={{ borderColor: tone.lineSoft }}
                  />
                </span>
                <span className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm font-medium text-primary">
                    {tone.label}
                  </span>
                  {active && <Check className="h-4 w-4 text-accent" />}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-7 flex items-center justify-between border-t border-border pt-5">
          <p className="text-xs leading-5 text-subtle">
            Stored on this device for now — becomes a per-workspace setting
            with the backend.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              reset();
              toast("Back to defaults", "Indigo accent on the warm canvas.");
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
        </div>
      </Card>

      {/* Live sample so the effect is visible right where you click */}
      <Card>
        <p className="text-xs font-semibold tracking-wide text-subtle uppercase">
          Live sample
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button>Primary action</Button>
          <Button variant="accent">
            <Sparkles className="h-4 w-4" />
            Accent action
          </Button>
          <Button variant="outline">Outline</Button>
          <Badge variant="accent">Accent badge</Badge>
          <Badge variant="success">Ready</Badge>
        </div>
        <div className="mt-4 rounded-xl border border-border bg-canvas p-4">
          <p className="text-sm text-primary">
            A canvas surface with a{" "}
            <a href="#" className="font-medium text-accent underline">
              tokenized link
            </a>{" "}
            and muted{" "}
            <span className="text-muted">secondary text</span> — everything you
            see obeys the tokens you just picked.
          </p>
        </div>
      </Card>
    </div>
  );
}
