/**
 * Runtime theme engine.
 *
 * The design system is two-layered: primitives on `:root` (accent ramp +
 * canvas tones, defined in globals.css) feed semantic tokens in `@theme`.
 * This module overrides the PRIMITIVES on `document.documentElement` at
 * runtime — every semantic token, and therefore every component, follows.
 *
 * Adding a new accent or tone here is all it takes for it to appear in
 * Settings → Appearance.
 */

export type AccentId = "indigo" | "teal" | "blue" | "amber" | "rose";
export type ToneId = "warm" | "cool" | "pure";

type Ramp = {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
};

export const ACCENTS: Record<AccentId, { label: string; ramp: Ramp }> = {
  indigo: {
    label: "Indigo",
    ramp: {
      50: "#eef0ff",
      100: "#e0e3ff",
      200: "#c6ccff",
      300: "#a3abff",
      400: "#7f86f8",
      500: "#5b60e8",
      600: "#4f46e5",
      700: "#4338ca",
      800: "#3730a3",
      900: "#312e81",
    },
  },
  teal: {
    label: "Teal",
    ramp: {
      50: "#f0fdfa",
      100: "#ccfbf1",
      200: "#99f6e4",
      300: "#5eead4",
      400: "#2dd4bf",
      500: "#14b8a6",
      600: "#0d9488",
      700: "#0f766e",
      800: "#115e59",
      900: "#134e4a",
    },
  },
  blue: {
    label: "Blue",
    ramp: {
      50: "#eff6ff",
      100: "#dbeafe",
      200: "#bfdbfe",
      300: "#93c5fd",
      400: "#60a5fa",
      500: "#3b82f6",
      600: "#2563eb",
      700: "#1d4ed8",
      800: "#1e40af",
      900: "#1e3a8a",
    },
  },
  amber: {
    label: "Amber",
    ramp: {
      50: "#fffbeb",
      100: "#fef3c7",
      200: "#fde68a",
      300: "#fcd34d",
      400: "#fbbf24",
      500: "#f59e0b",
      600: "#d97706",
      700: "#b45309",
      800: "#92400e",
      900: "#78350f",
    },
  },
  rose: {
    label: "Rose",
    ramp: {
      50: "#fff1f2",
      100: "#ffe4e6",
      200: "#fecdd3",
      300: "#fda4af",
      400: "#fb7185",
      500: "#f43f5e",
      600: "#e11d48",
      700: "#be123c",
      800: "#9f1239",
      900: "#881337",
    },
  },
};

export const TONES: Record<
  ToneId,
  {
    label: string;
    canvas: string;
    raised: string;
    lineSoft: string;
    lineStrong: string;
  }
> = {
  warm: {
    label: "Warm",
    canvas: "#faf9f7",
    raised: "#f4f2ee",
    lineSoft: "#e6e2d9",
    lineStrong: "#d3cec2",
  },
  cool: {
    label: "Cool",
    canvas: "#f8f9fb",
    raised: "#eef1f5",
    lineSoft: "#e2e6ec",
    lineStrong: "#cdd3dc",
  },
  pure: {
    label: "Pure",
    canvas: "#fafafa",
    raised: "#f4f4f5",
    lineSoft: "#e7e7e7",
    lineStrong: "#d6d6d6",
  },
};

export const DEFAULT_ACCENT: AccentId = "indigo";
export const DEFAULT_TONE: ToneId = "warm";

/** Compute the primitive CSS variables for an accent + tone combination. */
export function buildThemeVars(
  accentId: AccentId,
  toneId: ToneId,
): Record<string, string> {
  const ramp = ACCENTS[accentId].ramp;
  const tone = TONES[toneId];
  return {
    "--accent-50": ramp[50],
    "--accent-100": ramp[100],
    "--accent-200": ramp[200],
    "--accent-300": ramp[300],
    "--accent-400": ramp[400],
    "--accent-500": ramp[500],
    "--accent-600": ramp[600],
    "--accent-700": ramp[700],
    "--accent-800": ramp[800],
    "--accent-900": ramp[900],
    "--tone-canvas": tone.canvas,
    "--tone-raised": tone.raised,
    "--line-soft": tone.lineSoft,
    "--line-strong": tone.lineStrong,
  };
}

/** Apply primitive overrides to :root — the whole product restyles. */
export function applyThemeVars(vars: Record<string, string>): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}

/** Remove overrides so the stylesheet defaults (globals.css) win again. */
export function clearThemeVars(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const key of Object.keys(buildThemeVars(DEFAULT_ACCENT, DEFAULT_TONE))) {
    root.style.removeProperty(key);
  }
}
