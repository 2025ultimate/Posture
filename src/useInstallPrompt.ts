import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

// Install-to-home-screen support. On Android/Chrome the browser fires
// `beforeinstallprompt`; we stash it and trigger the native install sheet
// from our own button. On iOS Safari there is no prompt API, so we show
// short instructions instead. Once the app runs standalone (installed),
// none of it shows.

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// ---- standalone display-mode as a render-pure external store -------------

let standaloneMql: MediaQueryList | null = null;
let standaloneCached = false;
const standaloneListeners = new Set<() => void>();

function standaloneSubscribe(listener: () => void): () => void {
  standaloneListeners.add(listener);
  if (!standaloneMql && typeof window !== "undefined" && "matchMedia" in window) {
    standaloneMql = window.matchMedia("(display-mode: standalone)");
    const nav = window.navigator as Navigator & { standalone?: boolean };
    standaloneCached = standaloneMql.matches || nav.standalone === true;
    standaloneMql.addEventListener("change", (e) => {
      standaloneCached = e.matches;
      standaloneListeners.forEach((l) => l());
    });
  }
  return () => {
    standaloneListeners.delete(listener);
  };
}

export function useStandalone(): boolean {
  return useSyncExternalStore(standaloneSubscribe, () => standaloneCached);
}

// ---- dismissal persistence ------------------------------------------------

const DISMISS_KEY = "postureguard.installDismissedAt";
const DISMISS_FOR_MS = 30 * 24 * 60 * 60 * 1000;

export function isInstallDismissed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < DISMISS_FOR_MS;
  } catch {
    return false;
  }
}

export function dismissInstall(): void {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

// ---- the hook -------------------------------------------------------------

export function useInstallPrompt() {
  const standalone = useStandalone();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferred(null);
  }, [deferred]);

  return {
    /** The native install sheet can be shown right now (Android/Chrome). */
    canPrompt: deferred !== null && !standalone && !installed,
    /** Running as an installed app already. */
    standalone: standalone || installed,
    install,
  };
}
