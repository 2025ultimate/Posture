import { useEffect, useRef } from "react";
import { usePersistedState } from "./usePersistedState";

export type HabitKey = "water" | "stretch" | "eyes";

export interface HabitSetting {
  enabled: boolean;
  intervalMin: number;
  nextFireAt: number | null;
}

export const HABIT_INFO: Record<
  HabitKey,
  { title: string; voice: string; description: string; defaultMin: number }
> = {
  water: {
    title: "Water",
    voice: "Time to drink some water.",
    description: "Hydration reminder",
    defaultMin: 45,
  },
  stretch: {
    title: "Stand & stretch",
    voice: "Stand up and stretch for a moment.",
    description: "Movement break",
    defaultMin: 60,
  },
  eyes: {
    title: "Eye break",
    voice: "Look at something twenty feet away for twenty seconds.",
    description: "20-20-20 rule",
    defaultMin: 20,
  },
};

const DEFAULTS: Record<HabitKey, HabitSetting> = {
  water: { enabled: false, intervalMin: HABIT_INFO.water.defaultMin, nextFireAt: null },
  stretch: { enabled: false, intervalMin: HABIT_INFO.stretch.defaultMin, nextFireAt: null },
  eyes: { enabled: false, intervalMin: HABIT_INFO.eyes.defaultMin, nextFireAt: null },
};

const TICK_INTERVAL_MS = 30 * 1000;

function showNotification(body: string): void {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification("PostureGuard", { body, silent: true });
  } catch {
    // Some browsers require ServiceWorkerRegistration.showNotification instead.
  }
}

export function useHabitReminders(
  playAlert: () => void,
  speak: (text: string) => void,
  remindersEnabled: boolean = true
) {
  const [habits, setHabits] = usePersistedState<Record<HabitKey, HabitSetting>>(
    "postureguard.habits",
    DEFAULTS
  );

  const habitsRef = useRef(habits);
  const playAlertRef = useRef(playAlert);
  const speakRef = useRef(speak);
  const enabledRef = useRef(remindersEnabled);

  useEffect(() => {
    habitsRef.current = habits;
  }, [habits]);
  useEffect(() => {
    playAlertRef.current = playAlert;
  }, [playAlert]);
  useEffect(() => {
    speakRef.current = speak;
  }, [speak]);
  useEffect(() => {
    enabledRef.current = remindersEnabled;
  }, [remindersEnabled]);

  useEffect(() => {
    const tick = () => {
      // When the user has paused alerts globally, skip firing entirely.
      // The nextFireAt values stay put, so any reminders that came due
      // during the pause will fire on the next tick after they unpause.
      if (!enabledRef.current) return;

      const now = Date.now();
      const due: HabitKey[] = [];
      (Object.keys(habitsRef.current) as HabitKey[]).forEach((k) => {
        const h = habitsRef.current[k];
        if (!h.enabled || h.nextFireAt === null) return;
        if (now >= h.nextFireAt) due.push(k);
      });

      if (due.length === 0) return;

      // Fire each reminder, staggered so the audio doesn't pile up.
      due.forEach((k, i) => {
        setTimeout(() => {
          playAlertRef.current();
          setTimeout(() => speakRef.current(HABIT_INFO[k].voice), 400);
          showNotification(HABIT_INFO[k].voice);
        }, i * 2500);
      });

      setHabits((prev) => {
        const next = { ...prev };
        due.forEach((k) => {
          next[k] = { ...next[k], nextFireAt: now + next[k].intervalMin * 60 * 1000 };
        });
        return next;
      });
    };

    const id = setInterval(tick, TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [setHabits]);

  const setEnabled = (key: HabitKey, enabled: boolean) => {
    setHabits((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        enabled,
        nextFireAt: enabled ? Date.now() + prev[key].intervalMin * 60 * 1000 : null,
      },
    }));
    if (enabled && typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  };

  const setHabitInterval = (key: HabitKey, intervalMin: number) => {
    setHabits((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        intervalMin,
        nextFireAt: prev[key].enabled ? Date.now() + intervalMin * 60 * 1000 : null,
      },
    }));
  };

  const snooze = (key: HabitKey) => {
    setHabits((prev) => ({
      ...prev,
      [key]: { ...prev[key], nextFireAt: Date.now() + prev[key].intervalMin * 60 * 1000 },
    }));
  };

  return { habits, setEnabled, setHabitInterval, snooze };
}
