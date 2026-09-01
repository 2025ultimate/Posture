import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Shared audio for the whole app: posture alerts, habit pings, routine
// player cues and voice coaching. Extracted from usePostureMonitor so the
// Today/Check views can make sound without the desk camera running.

export type AlertTone = "beep" | "ding" | "chime" | "chirp" | "buzz";

export const ALERT_TONE_LABELS: Record<AlertTone, string> = {
  beep: "Beep",
  ding: "Ding",
  chime: "Chime",
  chirp: "Chirp",
  buzz: "Buzz",
};

const ALERT_TONE_STORAGE_KEY = "postureguard.alertTone";

function loadStoredTone(): AlertTone {
  if (typeof window === "undefined") return "beep";
  const stored = window.localStorage.getItem(ALERT_TONE_STORAGE_KEY);
  if (stored && stored in ALERT_TONE_LABELS) return stored as AlertTone;
  return "beep";
}

export interface AudioCues {
  alertTone: AlertTone;
  setAlertTone: (tone: AlertTone) => void;
  /** The user's chosen alert chime (posture alerts, habit reminders). */
  playAlert: () => void;
  /** Short soft tick — countdown seconds. */
  playTick: () => void;
  /** Neutral transition blip — next exercise step. */
  playStep: () => void;
  /** Rising three-note finish cue. */
  playSuccess: () => void;
  speak: (text: string) => void;
  stopSpeaking: () => void;
}

export function useAudioCues(): AudioCues {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const alertToneRef = useRef<AlertTone>(loadStoredTone());
  const [alertTone, setAlertTone] = useState<AlertTone>(loadStoredTone);

  useEffect(() => {
    alertToneRef.current = alertTone;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ALERT_TONE_STORAGE_KEY, alertTone);
    }
  }, [alertTone]);

  const ensureCtx = useCallback((): AudioContext => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === "suspended") {
      void audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  useEffect(
    () => () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        void audioCtxRef.current.close();
      }
      audioCtxRef.current = null;
    },
    []
  );

  const tone = useCallback(
    (
      ctx: AudioContext,
      freq: number,
      dur: number,
      vol: number,
      type: OscillatorType = "sine",
      startOffset = 0
    ) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startOffset);
      gain.gain.setValueAtTime(vol, ctx.currentTime + startOffset);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + startOffset + dur
      );
      osc.start(ctx.currentTime + startOffset);
      osc.stop(ctx.currentTime + startOffset + dur + 0.01);
    },
    []
  );

  const playAlert = useCallback(() => {
    const ctx = ensureCtx();
    switch (alertToneRef.current) {
      case "beep":
        tone(ctx, 880, 0.25, 0.5);
        tone(ctx, 660, 0.25, 0.4, "sine", 0.3);
        break;
      case "ding":
        tone(ctx, 1047, 0.9, 0.6);
        tone(ctx, 2093, 0.5, 0.15, "sine", 0.01);
        break;
      case "chime":
        tone(ctx, 523, 0.35, 0.5);
        tone(ctx, 659, 0.35, 0.45, "sine", 0.2);
        tone(ctx, 784, 0.55, 0.4, "sine", 0.4);
        break;
      case "chirp": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.18);
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.23);
        break;
      }
      case "buzz":
        tone(ctx, 300, 0.08, 0.45, "square");
        tone(ctx, 300, 0.08, 0.45, "square", 0.15);
        tone(ctx, 300, 0.08, 0.45, "square", 0.3);
        break;
    }
  }, [ensureCtx, tone]);

  const playTick = useCallback(() => {
    const ctx = ensureCtx();
    tone(ctx, 1200, 0.06, 0.18);
  }, [ensureCtx, tone]);

  const playStep = useCallback(() => {
    const ctx = ensureCtx();
    tone(ctx, 660, 0.14, 0.35);
    tone(ctx, 880, 0.2, 0.3, "sine", 0.12);
  }, [ensureCtx, tone]);

  const playSuccess = useCallback(() => {
    const ctx = ensureCtx();
    tone(ctx, 523, 0.18, 0.4);
    tone(ctx, 659, 0.18, 0.4, "sine", 0.16);
    tone(ctx, 784, 0.3, 0.45, "sine", 0.32);
    tone(ctx, 1047, 0.5, 0.35, "sine", 0.48);
  }, [ensureCtx, tone]);

  const speak = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, []);

  const stopSpeaking = useCallback(() => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  // Stable object identity (changes only with the tone choice) so
  // memoized views that receive `audio` as a prop don't re-render on
  // every monitor frame.
  return useMemo(
    () => ({
      alertTone,
      setAlertTone,
      playAlert,
      playTick,
      playStep,
      playSuccess,
      speak,
      stopSpeaking,
    }),
    [alertTone, playAlert, playTick, playStep, playSuccess, speak, stopSpeaking]
  );
}
