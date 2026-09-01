// The corrective program engine: three progressive daily routines, a
// completion log, streaks and level-up suggestions. What actually changes
// anterior pelvic tilt is doing a short routine most days for 8–12 weeks —
// this module is the spine of the app.

import { getExercise, setSeconds } from "./exercises";
import type { Exercise } from "./exercises";
import {
  appendToList,
  clearKey,
  dayKey,
  lastNDayKeys,
  loadList,
} from "./storage";

export type LevelId = "reset" | "build" | "strengthen";

export interface RoutineItem {
  exerciseId: string;
  /** Override the exercise's default set count for this level. */
  sets?: number;
  /** Override seconds per set for timed exercises. */
  seconds?: number;
}

export interface ProgramLevel {
  id: LevelId;
  name: string;
  blurb: string;
  items: RoutineItem[];
}

export const LEVELS: ProgramLevel[] = [
  {
    id: "reset",
    name: "Level 1 · Reset",
    blurb:
      "Learn where neutral pelvis is and wake up the glutes and deep core. Do this daily for the first 2–3 weeks.",
    items: [
      { exerciseId: "breathing9090" },
      { exerciseId: "pelvicTiltSupine" },
      { exerciseId: "gluteBridge" },
      { exerciseId: "deadBug" },
      { exerciseId: "hipFlexorStretch" },
      { exerciseId: "childsPose" },
    ],
  },
  {
    id: "build",
    name: "Level 2 · Build",
    blurb:
      "Carry the pelvic tuck into standing, load the glutes one leg at a time, and open the quads properly.",
    items: [
      { exerciseId: "wallTilt" },
      { exerciseId: "singleLegBridge" },
      { exerciseId: "reverseCrunch" },
      { exerciseId: "rkcPlank" },
      { exerciseId: "couchStretch" },
      { exerciseId: "childsPose", seconds: 45 },
    ],
  },
  {
    id: "strengthen",
    name: "Level 3 · Strengthen",
    blurb:
      "Real load for the glutes and hamstrings plus harder anti-extension core. This is the level you can stay on.",
    items: [
      { exerciseId: "breathing9090", seconds: 60 },
      { exerciseId: "hipThrust" },
      { exerciseId: "hamWalkout" },
      { exerciseId: "hollowHold" },
      { exerciseId: "couchStretch", seconds: 60 },
      { exerciseId: "wallTilt" },
    ],
  },
];

export function getLevel(id: LevelId): ProgramLevel {
  return LEVELS.find((l) => l.id === id) ?? LEVELS[0];
}

export function nextLevelId(id: LevelId): LevelId | null {
  const i = LEVELS.findIndex((l) => l.id === id);
  return i >= 0 && i < LEVELS.length - 1 ? LEVELS[i + 1].id : null;
}

// ---- Routine steps (flattened for the player) ---------------------------

export interface RoutineStep {
  exercise: Exercise;
  /** 1-based set number and total sets for this exercise. */
  set: number;
  totalSets: number;
  side: "left" | "right" | null;
  /** Working seconds for this step (estimate for rep-based exercises). */
  workSeconds: number;
  /** True when the timer is an estimate and the user works at their own pace. */
  estimated: boolean;
}

export function buildSteps(level: ProgramLevel): RoutineStep[] {
  const steps: RoutineStep[] = [];
  for (const item of level.items) {
    const ex = getExercise(item.exerciseId);
    const scheme = ex.scheme;
    const totalSets = item.sets ?? scheme.sets ?? 1;
    const baseSeconds =
      scheme.kind === "time" && item.seconds ? item.seconds : setSeconds(scheme);
    const sides: ("left" | "right" | null)[] = scheme.perSide
      ? ["left", "right"]
      : [null];
    for (let s = 1; s <= totalSets; s++) {
      for (const side of sides) {
        steps.push({
          exercise: ex,
          set: s,
          totalSets,
          side,
          workSeconds: baseSeconds,
          estimated: scheme.kind === "reps",
        });
      }
    }
  }
  return steps;
}

/** Prep lead-in shown before each step's work timer. */
export const STEP_PREP_SECONDS = 5;

export function routineMinutes(level: ProgramLevel): number {
  const total = buildSteps(level).reduce(
    (sum, s) => sum + s.workSeconds + STEP_PREP_SECONDS,
    0
  );
  return Math.max(1, Math.round(total / 60));
}

// ---- Program state + completion log -------------------------------------

const STATE_KEY = "postureguard.apt.program";
const COMPLETIONS_KEY = "postureguard.apt.completions";
const MAX_COMPLETIONS = 400;

export interface ProgramState {
  level: LevelId;
  /** When the user started (or switched to) the current level. */
  levelStartedAt: number;
}

export function loadProgramState(): ProgramState {
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(STATE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ProgramState;
        if (parsed && LEVELS.some((l) => l.id === parsed.level)) return parsed;
      }
    } catch {
      // fall through to default
    }
  }
  return { level: "reset", levelStartedAt: Date.now() };
}

export function saveProgramState(state: ProgramState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export interface CompletionRecord {
  ts: number;
  day: string; // dayKey
  levelId: LevelId;
  minutes: number;
  completedSteps: number;
  totalSteps: number;
}

export function loadCompletions(): CompletionRecord[] {
  return loadList<CompletionRecord>(COMPLETIONS_KEY);
}

export function addCompletion(
  rec: Omit<CompletionRecord, "ts" | "day">
): CompletionRecord {
  const full: CompletionRecord = { ...rec, ts: Date.now(), day: dayKey() };
  appendToList(COMPLETIONS_KEY, full, MAX_COMPLETIONS);
  return full;
}

export function clearProgramData(): void {
  clearKey(COMPLETIONS_KEY);
  clearKey(STATE_KEY);
}

// ---- Streaks & adherence -------------------------------------------------

export interface Adherence {
  completedToday: boolean;
  currentStreak: number;
  bestStreak: number;
  /** Days in the last 7 (oldest→today) with at least one completed routine. */
  last7: { day: string; done: boolean }[];
  /** Same for the last 28 days (progress calendar). */
  last28: { day: string; done: boolean }[];
  totalSessions: number;
  totalMinutes: number;
  /** Distinct days completed on the current level. */
  daysOnCurrentLevel: number;
}

export function computeAdherence(
  completions: CompletionRecord[],
  state: ProgramState
): Adherence {
  const daySet = new Set(completions.map((c) => c.day));
  const today = dayKey();

  // Current streak: walk back from today (or yesterday, if today isn't done
  // yet — an unfinished today shouldn't read as a broken streak).
  let currentStreak = 0;
  {
    const start = new Date();
    if (!daySet.has(today)) start.setDate(start.getDate() - 1);
    const cursor = start;
    while (daySet.has(dayKey(cursor.getTime()))) {
      currentStreak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
  }

  // Best streak across all recorded days.
  let bestStreak = 0;
  {
    const days = [...daySet].sort();
    let run = 0;
    let prev: string | null = null;
    for (const d of days) {
      if (prev !== null) {
        const prevDate = new Date(`${prev}T12:00:00`);
        prevDate.setDate(prevDate.getDate() + 1);
        run = dayKey(prevDate.getTime()) === d ? run + 1 : 1;
      } else {
        run = 1;
      }
      bestStreak = Math.max(bestStreak, run);
      prev = d;
    }
  }

  const levelDays = new Set(
    completions
      .filter((c) => c.levelId === state.level && c.ts >= state.levelStartedAt)
      .map((c) => c.day)
  );

  return {
    completedToday: daySet.has(today),
    currentStreak,
    bestStreak,
    last7: lastNDayKeys(7).map((day) => ({ day, done: daySet.has(day) })),
    last28: lastNDayKeys(28).map((day) => ({ day, done: daySet.has(day) })),
    totalSessions: completions.length,
    totalMinutes: completions.reduce((s, c) => s + c.minutes, 0),
    daysOnCurrentLevel: levelDays.size,
  };
}

/**
 * Suggest moving up a level after ~2 weeks on the level with at least 10
 * completed days. Deliberately conservative — progressing too fast is the
 * usual way people abandon corrective work.
 */
export function levelUpSuggestion(
  state: ProgramState,
  adherence: Adherence
): LevelId | null {
  const next = nextLevelId(state.level);
  if (!next) return null;
  const daysOnLevel = (Date.now() - state.levelStartedAt) / 86400000;
  if (daysOnLevel >= 14 && adherence.daysOnCurrentLevel >= 10) return next;
  return null;
}

// ---- Daily coach tips ----------------------------------------------------

const TIPS: string[] = [
  "The stretch cue that matters most: tuck the pelvis BEFORE you lunge. Without the tuck, the hip flexor stretch just yanks on your low back.",
  "Some anterior tilt is completely normal — the goal is control and comfort, not a perfectly level pelvis.",
  "Your glutes are the strongest posterior-tilters you own. Squeeze them any time you stand up and the pelvis follows.",
  "Sitting doesn't damage you — unbroken hours of it do. The break timer on the Desk tab is doing more for your tilt than you'd think.",
  "In every core exercise today, keep the low back pressed down. The moment it arches, the hip flexors have taken over.",
  "Standing at your desk with an arched back is not better than sitting. Wall-tilt first, then stand tall on soft knees.",
  "Progress photos beat mirror checks — redo the side-view posture check every 2–4 weeks, same spot, same clothes.",
  "Hamstrings pull the pelvis toward neutral from below. That's why they're trained here, not stretched.",
  "Consistency math: 12 minutes × 6 days beats 90 minutes on Sunday. Streak over intensity.",
  "If a rep hurts (sharp pain, tingling, numbness) stop and get assessed by a professional. Muscles working hard should burn, not sting.",
  "Belt trick for desk hours: sit with hips slightly higher than knees and both feet planted — it keeps the pelvis from locking into one extreme.",
  "Exhale fully on the hard part of every rep. A long exhale drops the ribs and switches the abs on automatically.",
];

export function tipOfTheDay(): string {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  return TIPS[dayOfYear % TIPS.length];
}
