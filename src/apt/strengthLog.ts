// Local strength log for the program's loaded exercises: weight × reps
// per set, so Level-3 work actually progresses instead of repeating.
// Stays in localStorage like everything else.

import { appendToList, dayKey, loadList } from "./storage";

export interface SetLogEntry {
  ts: number;
  day: string;
  exerciseId: string;
  /** null = bodyweight / not recorded. */
  weightKg: number | null;
  reps: number;
}

const KEY = "postureguard.apt.setLog";
const CAP = 1000;

export function loadSetLog(): SetLogEntry[] {
  return loadList<SetLogEntry>(KEY);
}

export function logSet(entry: Omit<SetLogEntry, "ts" | "day">): SetLogEntry {
  const full: SetLogEntry = { ...entry, ts: Date.now(), day: dayKey() };
  appendToList(KEY, full, CAP);
  return full;
}

export function lastSetFor(
  log: SetLogEntry[],
  exerciseId: string
): SetLogEntry | null {
  for (let i = log.length - 1; i >= 0; i--) {
    if (log[i].exerciseId === exerciseId) return log[i];
  }
  return null;
}

export interface ExerciseProgress {
  exerciseId: string;
  sets: number;
  last: SetLogEntry;
  bestWeightKg: number | null;
  bestReps: number;
}

/** Per-exercise summary, most recently trained first. */
export function summarizeLog(log: SetLogEntry[]): ExerciseProgress[] {
  const byId = new Map<string, SetLogEntry[]>();
  for (const e of log) {
    const list = byId.get(e.exerciseId) ?? [];
    list.push(e);
    byId.set(e.exerciseId, list);
  }
  const out: ExerciseProgress[] = [];
  for (const [exerciseId, entries] of byId) {
    const last = entries[entries.length - 1];
    let bestWeightKg: number | null = null;
    let bestReps = 0;
    for (const e of entries) {
      if (e.weightKg !== null && (bestWeightKg === null || e.weightKg > bestWeightKg)) {
        bestWeightKg = e.weightKg;
      }
      if (e.reps > bestReps) bestReps = e.reps;
    }
    out.push({ exerciseId, sets: entries.length, last, bestWeightKg, bestReps });
  }
  return out.sort((a, b) => b.last.ts - a.last.ts);
}
