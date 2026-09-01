import { useCallback, useSyncExternalStore } from "react";

// A render-pure "current time" hook. Components must not call Date.now()
// during render (react-hooks/purity), so time flows from a tiny external
// store: one shared interval per tick rate, snapshot cached between ticks.

interface ClockStore {
  now: number;
  timer: ReturnType<typeof setInterval> | null;
  listeners: Set<() => void>;
}

const stores = new Map<number, ClockStore>();
// Fallback snapshot for the first render, before any subscription exists.
const bootNow = Date.now();

function getStore(intervalMs: number): ClockStore {
  let store = stores.get(intervalMs);
  if (!store) {
    store = { now: bootNow, timer: null, listeners: new Set() };
    stores.set(intervalMs, store);
  }
  return store;
}

function subscribeTo(intervalMs: number, listener: () => void): () => void {
  const store = getStore(intervalMs);
  store.listeners.add(listener);
  if (store.timer === null) {
    store.now = Date.now();
    store.timer = setInterval(() => {
      store.now = Date.now();
      store.listeners.forEach((l) => l());
    }, intervalMs);
  }
  return () => {
    store.listeners.delete(listener);
    if (store.listeners.size === 0 && store.timer !== null) {
      clearInterval(store.timer);
      store.timer = null;
    }
  };
}

/** Current epoch ms, updating every `intervalMs` (default 1s). */
export function useNow(intervalMs = 1000): number {
  const subscribe = useCallback(
    (listener: () => void) => subscribeTo(intervalMs, listener),
    [intervalMs]
  );
  const getSnapshot = useCallback(() => getStore(intervalMs).now, [intervalMs]);
  return useSyncExternalStore(subscribe, getSnapshot);
}
