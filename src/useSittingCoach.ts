import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePersistedState } from "./usePersistedState";
import { addBreak, loadBreaks } from "./apt/assessments";
import { sittingNudgeLine } from "./apt/motivation";
import { dayKey } from "./apt/storage";
import type { ActivityContext } from "./postureAnalysis";

// The sitting coach — for anterior pelvic tilt this is the desk feature
// that matters most. A front-facing webcam can never see the pelvis, but
// it CAN see whether you're at the desk, which makes the timer honest:
// continuous seated time only accrues while you're actually there, and
// standing up for a couple of minutes resets it (and quietly logs the
// break you just took).

export type SittingCoachMode = "ping" | "voice";

export interface SittingCoachConfig {
  enabled: boolean;
  intervalMin: number;
  mode: SittingCoachMode;
}

const CONFIG_KEY = "postureguard.apt.sittingCoach";
const DEFAULT_CONFIG: SittingCoachConfig = {
  enabled: true,
  intervalMin: 40,
  mode: "voice",
};

// Standing/away for this long counts as a real break and resets the clock.
const AWAY_RESET_MS = 2 * 60 * 1000;
// Only log an auto-break if the user had actually been seated a while.
const MIN_SEATED_FOR_LOG_MS = 10 * 60 * 1000;

function showNotification(body: string): void {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification("PostureGuard", { body, silent: true });
  } catch {
    // Some browsers require ServiceWorkerRegistration.showNotification.
  }
}

interface SittingCoachInputs {
  monitorRunning: boolean;
  activity: ActivityContext | null;
  alertsPaused: boolean;
  playAlert: () => void;
  speak: (text: string) => void;
}

export function useSittingCoach(inputs: SittingCoachInputs) {
  const [config, setConfig] = usePersistedState<SittingCoachConfig>(
    CONFIG_KEY,
    DEFAULT_CONFIG
  );

  const [seatedMs, setSeatedMs] = useState(0);
  const [breakDue, setBreakDue] = useState(false);
  const [breaksVersion, setBreaksVersion] = useState(0);

  const seatedMsRef = useRef(0);
  const awayMsRef = useRef(0);
  const lastAlertSeatedMsRef = useRef(0);
  const inputsRef = useRef(inputs);
  const configRef = useRef(config);

  useEffect(() => {
    inputsRef.current = inputs;
  }, [inputs]);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const resetClock = useCallback(() => {
    seatedMsRef.current = 0;
    awayMsRef.current = 0;
    lastAlertSeatedMsRef.current = 0;
    setSeatedMs(0);
    setBreakDue(false);
  }, []);

  const logBreak = useCallback(
    (seatedBeforeMs: number) => {
      addBreak({
        ts: Date.now(),
        day: dayKey(),
        seatedMin: Math.round(seatedBeforeMs / 60000),
      });
      setBreaksVersion((v) => v + 1);
    },
    []
  );

  /** User taps "I took a break" (or completes a micro-break). */
  const takeBreak = useCallback(() => {
    if (seatedMsRef.current >= 60 * 1000) logBreak(seatedMsRef.current);
    resetClock();
  }, [logBreak, resetClock]);

  useEffect(() => {
    const id = setInterval(() => {
      const { monitorRunning, activity, alertsPaused, playAlert, speak } =
        inputsRef.current;
      const cfg = configRef.current;
      if (!monitorRunning) {
        // Session over — clear the clock (checked here rather than in a
        // state-setting effect to avoid cascading renders).
        if (seatedMsRef.current !== 0 || awayMsRef.current !== 0) resetClock();
        return;
      }
      if (!cfg.enabled) return;
      // No result yet (model warming up) — don't count.
      if (activity === null) return;

      if (activity === "away") {
        awayMsRef.current += 1000;
        if (awayMsRef.current >= AWAY_RESET_MS) {
          // They actually stood up — count it as a taken break.
          if (seatedMsRef.current >= MIN_SEATED_FOR_LOG_MS) {
            logBreak(seatedMsRef.current);
          }
          resetClock();
        }
        return;
      }

      awayMsRef.current = 0;
      seatedMsRef.current += 1000;
      setSeatedMs(seatedMsRef.current);

      const intervalMs = Math.max(5, cfg.intervalMin) * 60 * 1000;
      const sinceAlert = seatedMsRef.current - lastAlertSeatedMsRef.current;
      if (seatedMsRef.current >= intervalMs && sinceAlert >= intervalMs) {
        lastAlertSeatedMsRef.current = seatedMsRef.current;
        setBreakDue(true);
        if (!alertsPaused) {
          const minutes = Math.round(seatedMsRef.current / 60000);
          playAlert();
          const line = sittingNudgeLine(minutes);
          if (cfg.mode === "voice") {
            setTimeout(() => speak(line), 400);
          }
          showNotification(line);
        }
      }
    }, 1000);
    return () => clearInterval(id);
  }, [logBreak, resetClock]);

  const breaksToday = useMemo(() => {
    // breaksVersion re-reads the store after a new break is logged.
    void breaksVersion;
    const today = dayKey();
    return loadBreaks().filter((b) => b.day === today).length;
  }, [breaksVersion]);

  return {
    config,
    setConfig,
    seatedMs,
    seatedMin: Math.floor(seatedMs / 60000),
    breakDue,
    takeBreak,
    breaksToday,
    breaksVersion,
  };
}
