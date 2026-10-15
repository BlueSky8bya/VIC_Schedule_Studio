"use client";

import { useSyncExternalStore } from "react";
import { POSTER_AGENDA_QUERY } from "../breakpoints";

// One device capability across viewer, studio and preview. Studio's grid can
// begin at1000px, but its pet must follow the public surface's1040px boundary
// so changing role/preview cannot re-enable a removed mobile feature.
export const COMPANION_MOBILE_QUERY = POSTER_AGENDA_QUERY;
type Media = Pick<MediaQueryList, "matches" | "addEventListener" | "removeEventListener">;

/** One shared live query; no preferences, storage writes or animation work. */
export function createCompanionCapabilityStore(readMedia: () => Media | undefined) {
  let media: Media | undefined;
  const listeners = new Set<() => void>();
  const query = () => {
    if (media) return media;
    try { return (media = readMedia()); } catch { return undefined; }
  };
  const changed = () => { for (const listener of listeners) listener(); };
  return {
    getSnapshot: () => !(query()?.matches ?? true),
    getServerSnapshot: () => false,
    subscribe(listener: () => void) {
      const current = query();
      if (!current) return () => {};
      listeners.add(listener);
      if (listeners.size === 1) current.addEventListener("change", changed);
      return () => {
        listeners.delete(listener);
        if (!listeners.size) current.removeEventListener("change", changed);
      };
    },
  };
}

const store = createCompanionCapabilityStore(() => typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(COMPANION_MOBILE_QUERY) : undefined);

/** SSR/unknown devices fail closed, including the first hydration frame. */
export function useCompanionDesktop() {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}
