"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ApiProviderId } from "@/lib/api";

/**
 * Which model answers the next question, remembered across reloads.
 *
 * A store rather than `useState` + a localStorage effect: zustand's `persist`
 * handles the SSR/hydration dance, so no component has to read localStorage
 * during render or set state inside an effect.
 *
 * `null` means "send no model field at all" — the server then uses its own
 * configured default, which is exactly what every client did before the
 * picker existed. That is the value a fresh browser starts with.
 */
type AskModelState = {
  model: ApiProviderId | null;
  setModel: (id: ApiProviderId) => void;
};

export const useAskModelStore = create<AskModelState>()(
  persist(
    (set) => ({
      model: null,
      setModel: (model) => set({ model }),
    }),
    { name: "bs.askModel" },
  ),
);
