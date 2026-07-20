"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  type AccentId,
  type ToneId,
  DEFAULT_ACCENT,
  DEFAULT_TONE,
  applyThemeVars,
  buildThemeVars,
  clearThemeVars,
} from "@/lib/theme";

/**
 * Persisted theme state. `vars` is the *computed* primitive overrides so the
 * pre-paint inline script in the root layout can re-apply them from
 * localStorage without knowing anything about presets (no FOUC).
 */
type ThemeState = {
  accentId: AccentId;
  toneId: ToneId;
  vars: Record<string, string>;
  setAccent: (accentId: AccentId) => void;
  setTone: (toneId: ToneId) => void;
  reset: () => void;
};

export const THEME_STORAGE_KEY = "brainstack-theme";

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      accentId: DEFAULT_ACCENT,
      toneId: DEFAULT_TONE,
      vars: {},
      setAccent: (accentId) => {
        const vars = buildThemeVars(accentId, get().toneId);
        applyThemeVars(vars);
        set({ accentId, vars });
      },
      setTone: (toneId) => {
        const vars = buildThemeVars(get().accentId, toneId);
        applyThemeVars(vars);
        set({ toneId, vars });
      },
      reset: () => {
        clearThemeVars();
        set({ accentId: DEFAULT_ACCENT, toneId: DEFAULT_TONE, vars: {} });
      },
    }),
    { name: THEME_STORAGE_KEY },
  ),
);
