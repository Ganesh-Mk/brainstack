"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Cross-cutting UI state for the app shell. */

export const SIDEBAR_MIN = 190;
export const SIDEBAR_MAX = 340;
export const SIDEBAR_DEFAULT = 240;

type UiState = {
  /** Desktop sidebar width in px — user-draggable, clamped to min/max. */
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarWidth: SIDEBAR_DEFAULT,
      setSidebarWidth: (width) =>
        set({
          sidebarWidth: Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, width)),
        }),
      mobileNavOpen: false,
      setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
      paletteOpen: false,
      setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
    }),
    {
      name: "brainstack-ui",
      // Only the sidebar preference is worth persisting.
      partialize: (s) => ({ sidebarWidth: s.sidebarWidth }),
    },
  ),
);
