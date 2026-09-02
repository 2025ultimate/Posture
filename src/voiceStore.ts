import { useSyncExternalStore } from "react";

// Speech-synthesis voices as a render-pure external store. Browsers load
// the voice list asynchronously (Chrome fires `voiceschanged`), so the
// list is cached here and components subscribe to updates.

const listeners = new Set<() => void>();
let cachedVoices: SpeechSynthesisVoice[] = [];
let wired = false;

function refresh(): void {
  cachedVoices = window.speechSynthesis.getVoices();
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!wired && typeof window !== "undefined" && "speechSynthesis" in window) {
    wired = true;
    cachedVoices = window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener("voiceschanged", refresh);
  }
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): SpeechSynthesisVoice[] {
  return cachedVoices;
}

export function useVoices(): SpeechSynthesisVoice[] {
  return useSyncExternalStore(subscribe, getSnapshot);
}

// Platform voices vary wildly in quality. The names below reliably mark
// the modern neural/natural voices (Google on Android/Chrome, Siri and
// "Enhanced/Premium" on Apple platforms, "Natural" on Windows 11) — pick
// one of those by default instead of the often-robotic first entry.
const QUALITY_HINT =
  /natural|neural|premium|enhanced|siri|google (us|uk|australian|indian) english|aria|jenny|libby|sonia/i;

export function defaultVoice(
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  const english = voices.filter((v) => v.lang?.toLowerCase().startsWith("en"));
  return (
    english.find((v) => QUALITY_HINT.test(v.name)) ??
    english.find((v) => v.default) ??
    english[0] ??
    voices[0] ??
    null
  );
}

export function resolveVoice(
  voices: SpeechSynthesisVoice[],
  storedURI: string | null
): SpeechSynthesisVoice | null {
  if (storedURI) {
    const match = voices.find((v) => v.voiceURI === storedURI);
    if (match) return match;
  }
  return defaultVoice(voices);
}

export const VOICE_URI_KEY = "postureguard.voice.uri";
export const VOICE_RATE_KEY = "postureguard.voice.rate";

export interface VoicePrefs {
  uri: string | null;
  rate: number;
}

/** Read the persisted voice preferences (safe against bad storage). */
export function readVoicePrefs(): VoicePrefs {
  let uri: string | null = null;
  let rate = 0.95;
  if (typeof window !== "undefined") {
    try {
      const rawUri = window.localStorage.getItem(VOICE_URI_KEY);
      if (rawUri) uri = JSON.parse(rawUri) as string;
      const rawRate = window.localStorage.getItem(VOICE_RATE_KEY);
      if (rawRate) rate = Number(JSON.parse(rawRate)) || 0.95;
    } catch {
      // Defaults are fine.
    }
  }
  return { uri, rate: Math.min(1.3, Math.max(0.7, rate)) };
}
