import { useSyncExternalStore } from "react";

// prefers-reduced-motion as a render-pure external store (same pattern as
// useNow/voiceStore): snapshot cached, updated from the media-query event.

const QUERY = "(prefers-reduced-motion: reduce)";

let mql: MediaQueryList | null = null;
let cached = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!mql && typeof window !== "undefined" && "matchMedia" in window) {
    mql = window.matchMedia(QUERY);
    cached = mql.matches;
    mql.addEventListener("change", (e) => {
      cached = e.matches;
      listeners.forEach((l) => l());
    });
  }
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): boolean {
  return cached;
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot);
}
