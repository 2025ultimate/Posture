// Guided self-assessments + on-device record stores for the Check and
// Progress views. The two manual tests here (lumbar gap "wall test" and
// the Thomas test) are the standard at-home ways to gauge APT-related
// tightness — for the pelvis itself they tell you more than any camera.

import type { SideViewMetrics } from "./sideView";
import { appendToList, clearKey, loadList } from "./storage";

// ---- Camera check records ------------------------------------------------

export interface PhotoCheckRecord {
  ts: number;
  metrics: SideViewMetrics;
  score: number;
}

const PHOTO_KEY = "postureguard.apt.photoChecks";

export function loadPhotoChecks(): PhotoCheckRecord[] {
  return loadList<PhotoCheckRecord>(PHOTO_KEY);
}

export function addPhotoCheck(rec: PhotoCheckRecord): void {
  appendToList(PHOTO_KEY, rec, 200);
}

// ---- Self-tests ----------------------------------------------------------

export type SelfTestId = "wall" | "thomas";

export interface SelfTestOption {
  id: string;
  label: string;
  /** What this answer suggests. */
  meaning: string;
  severity: "ok" | "watch" | "high";
}

export interface SelfTestDef {
  id: SelfTestId;
  name: string;
  what: string;
  steps: string[];
  question: string;
  perSide: boolean;
  options: SelfTestOption[];
  /** YouTube search query for a demonstration of the test. */
  videoQuery: string;
}

export const SELF_TESTS: SelfTestDef[] = [
  {
    id: "wall",
    name: "Wall test — lumbar gap",
    videoQuery: "wall test posture lumbar gap assessment",
    what: "How much your lower back arches when you stand naturally.",
    steps: [
      "Stand with your back against a wall: heels one hand-width out, bottom, upper back and head touching the wall.",
      "Stand as you normally do — don't fix anything.",
      "Slide one hand palm-down into the gap behind your lower back.",
    ],
    question: "How big is the gap behind your lower back?",
    perSide: false,
    options: [
      {
        id: "flat",
        label: "Fingers barely fit",
        meaning:
          "Little to no lumbar arch. Anterior tilt is unlikely to be your pattern — recheck what's driving your symptoms.",
        severity: "ok",
      },
      {
        id: "palm",
        label: "About one flat palm",
        meaning: "A normal lumbar curve. Nothing alarming here.",
        severity: "ok",
      },
      {
        id: "hand",
        label: "Whole hand slides freely",
        meaning:
          "A larger-than-typical arch — consistent with anterior pelvic tilt. Worth tracking monthly as you train.",
        severity: "watch",
      },
      {
        id: "space",
        label: "Hand + extra space",
        meaning:
          "A pronounced arch — the classic APT presentation. The daily routine plus sitting breaks is exactly the right medicine.",
        severity: "high",
      },
    ],
  },
  {
    id: "thomas",
    name: "Thomas test — hip flexor length",
    videoQuery: "thomas test hip flexor tightness how to",
    what: "Whether your hip flexors have shortened from sitting.",
    steps: [
      "Sit on the very edge of a bed or sturdy table.",
      "Hug one knee to your chest and roll back to lie down, letting the other leg hang off the edge.",
      "Look at the hanging thigh: does it rest down level with the table, or float up in the air?",
      "Test both sides.",
    ],
    question: "Does the hanging thigh rest down flat?",
    perSide: true,
    options: [
      {
        id: "down",
        label: "Rests down flat",
        meaning: "Good hip flexor length on this side.",
        severity: "ok",
      },
      {
        id: "slight",
        label: "Slightly lifted",
        meaning:
          "Mild tightness — the half-kneeling hip flexor stretch will handle it.",
        severity: "watch",
      },
      {
        id: "lifted",
        label: "Clearly floats up",
        meaning:
          "Tight hip flexors on this side — prioritize the hip flexor and couch stretches daily.",
        severity: "high",
      },
    ],
  },
];

export function getSelfTest(id: SelfTestId): SelfTestDef {
  const t = SELF_TESTS.find((t) => t.id === id);
  if (!t) throw new Error(`Unknown self-test: ${id}`);
  return t;
}

export interface SelfTestRecord {
  ts: number;
  testId: SelfTestId;
  /** Option id, or per-side option ids. */
  result: string | { left: string; right: string };
}

const SELFTEST_KEY = "postureguard.apt.selfTests";

export function loadSelfTests(): SelfTestRecord[] {
  return loadList<SelfTestRecord>(SELFTEST_KEY);
}

export function addSelfTest(rec: SelfTestRecord): void {
  appendToList(SELFTEST_KEY, rec, 200);
}

export function latestSelfTest(
  records: SelfTestRecord[],
  id: SelfTestId
): SelfTestRecord | null {
  for (let i = records.length - 1; i >= 0; i--) {
    if (records[i].testId === id) return records[i];
  }
  return null;
}

export function optionForResult(
  def: SelfTestDef,
  optionId: string
): SelfTestOption | null {
  return def.options.find((o) => o.id === optionId) ?? null;
}

// ---- Sitting-break log ---------------------------------------------------

export interface BreakRecord {
  ts: number;
  day: string;
  /** Minutes of continuous sitting before the break. */
  seatedMin: number;
}

const BREAKS_KEY = "postureguard.apt.breaks";

export function loadBreaks(): BreakRecord[] {
  return loadList<BreakRecord>(BREAKS_KEY);
}

export function addBreak(rec: BreakRecord): void {
  appendToList(BREAKS_KEY, rec, 500);
}

export function clearAssessmentData(): void {
  clearKey(PHOTO_KEY);
  clearKey(SELFTEST_KEY);
  clearKey(BREAKS_KEY);
}
