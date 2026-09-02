// Side-view standing alignment analysis for the posture check.
//
// Honest framing: a pose model gives joint-center estimates, not the bony
// pelvic landmarks (ASIS/PSIS) a clinician would palpate to measure true
// pelvic tilt. What a side-view photo CAN measure reliably is the
// alignment pattern that travels with anterior pelvic tilt — hips pushed
// forward over the ankles, ribcage drifting behind the pelvis (sway),
// forward head, hyperextended knees. We report those as percentages of
// body height so they're comparable across check-ins, and we treat the
// trend over weeks as the signal, not any single absolute number.

import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

const NOSE = 0;
const EAR = { left: 7, right: 8 };
const SHOULDER = { left: 11, right: 12 };
const HIP = { left: 23, right: 24 };
const KNEE = { left: 25, right: 26 };
const ANKLE = { left: 27, right: 28 };

export type BodySide = "left" | "right";

export interface SideViewMetrics {
  side: BodySide;
  /** Ear ahead of shoulder, % of body height. + = forward head. */
  forwardHeadPct: number;
  /** Shoulder relative to hip, % of body height. − = ribcage behind pelvis (sway). */
  trunkLeanPct: number;
  /** Hip relative to ankle, % of body height. + = hips pushed forward. */
  hipShiftPct: number;
  /** Degrees past straight at the knee. + = hyperextended, − = soft/flexed. */
  kneeDevDeg: number;
}

export type FramingIssue =
  | "no_person"
  | "not_full_body"
  | "not_side_on"
  | "too_far";

export const FRAMING_MESSAGES: Record<FramingIssue, string> = {
  no_person: "No one in frame yet",
  not_full_body: "Step back — head to ankles must be visible",
  not_side_on: "Turn to stand fully sideways to the camera",
  too_far: "Come a little closer — you're too small in frame",
};

export type SideViewAnalysis =
  | { ok: true; metrics: SideViewMetrics }
  | { ok: false; issue: FramingIssue };

function vis(lm: NormalizedLandmark | undefined): number {
  return lm ? lm.visibility ?? 1 : 0;
}

export function analyzeSideView(
  landmarks: NormalizedLandmark[]
): SideViewAnalysis {
  if (!landmarks || landmarks.length < 33) return { ok: false, issue: "no_person" };

  // Pick the side facing the camera by summed landmark confidence.
  const sideScore = (s: BodySide) =>
    vis(landmarks[EAR[s]]) +
    vis(landmarks[SHOULDER[s]]) +
    vis(landmarks[HIP[s]]) +
    vis(landmarks[KNEE[s]]) +
    vis(landmarks[ANKLE[s]]);
  const side: BodySide = sideScore("left") >= sideScore("right") ? "left" : "right";

  const ear = landmarks[EAR[side]];
  const shoulder = landmarks[SHOULDER[side]];
  const hip = landmarks[HIP[side]];
  const knee = landmarks[KNEE[side]];
  const ankle = landmarks[ANKLE[side]];
  const nose = landmarks[NOSE];

  const required = [ear, shoulder, hip, knee, ankle];
  if (required.some((lm) => vis(lm) < 0.5)) {
    return { ok: false, issue: "not_full_body" };
  }
  // Head or feet cropped out of frame also means unusable.
  if (required.some((lm) => lm.y < 0.01 || lm.y > 0.99)) {
    return { ok: false, issue: "not_full_body" };
  }

  const bodyHeight = Math.abs(ankle.y - ear.y);
  if (bodyHeight < 0.45) return { ok: false, issue: "too_far" };

  // Side-on check: seen edge-on, the two shoulders / hips overlap in x.
  // Facing the camera, they're ~25% of body height apart.
  const shoulderSep = Math.abs(
    landmarks[SHOULDER.left].x - landmarks[SHOULDER.right].x
  );
  const hipSep = Math.abs(landmarks[HIP.left].x - landmarks[HIP.right].x);
  if (shoulderSep / bodyHeight > 0.14 || hipSep / bodyHeight > 0.13) {
    return { ok: false, issue: "not_side_on" };
  }

  // Which way is "forward"? The nose sits ahead of the ear.
  const facing = nose.x - ear.x >= 0 ? 1 : -1;
  const pct = (dx: number) => (facing * dx * 100) / bodyHeight;

  const forwardHeadPct = pct(ear.x - shoulder.x);
  const trunkLeanPct = pct(shoulder.x - hip.x);
  const hipShiftPct = pct(hip.x - ankle.x);

  // Knee: angle between knee→hip and knee→ankle. 180° = straight. The sign
  // comes from which side of the hip–ankle line the knee sits on: behind
  // it (posterior) = hyperextension.
  const v1 = { x: hip.x - knee.x, y: hip.y - knee.y };
  const v2 = { x: ankle.x - knee.x, y: ankle.y - knee.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
  const kneeAngle = mag > 0 ? (Math.acos(Math.min(1, Math.max(-1, dot / mag))) * 180) / Math.PI : 180;
  const chord = { x: ankle.x - hip.x, y: ankle.y - hip.y };
  const chordLen = Math.hypot(chord.x, chord.y) || 1;
  const t =
    ((knee.x - hip.x) * chord.x + (knee.y - hip.y) * chord.y) /
    (chordLen * chordLen);
  const perpX = knee.x - (hip.x + chord.x * t);
  const kneeAnterior = facing * perpX; // + = knee ahead of the chord (flexed)
  const kneeDevDeg = (180 - kneeAngle) * (kneeAnterior >= 0 ? -1 : 1);

  return {
    ok: true,
    metrics: {
      side,
      forwardHeadPct: round1(forwardHeadPct),
      trunkLeanPct: round1(trunkLeanPct),
      hipShiftPct: round1(hipShiftPct),
      kneeDevDeg: round1(kneeDevDeg),
    },
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Median of several frames' metrics — robust to landmark jitter. */
export function medianMetrics(list: SideViewMetrics[]): SideViewMetrics {
  const med = (vals: number[]) => {
    const s = [...vals].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : round1((s[mid - 1] + s[mid]) / 2);
  };
  const leftCount = list.filter((m) => m.side === "left").length;
  return {
    side: leftCount * 2 >= list.length ? "left" : "right",
    forwardHeadPct: med(list.map((m) => m.forwardHeadPct)),
    trunkLeanPct: med(list.map((m) => m.trunkLeanPct)),
    hipShiftPct: med(list.map((m) => m.hipShiftPct)),
    kneeDevDeg: med(list.map((m) => m.kneeDevDeg)),
  };
}

// ---- Interpretation ------------------------------------------------------

export type Severity = "ok" | "watch" | "high";

export interface AlignmentFinding {
  id: string;
  label: string;
  severity: Severity;
  value: string;
  detail: string;
}

function band(value: number, watch: number, high: number): Severity {
  if (value >= high) return "high";
  if (value >= watch) return "watch";
  return "ok";
}

export function interpretMetrics(m: SideViewMetrics): {
  findings: AlignmentFinding[];
  score: number;
  summary: string;
} {
  const findings: AlignmentFinding[] = [];

  findings.push({
    id: "hipShift",
    label: "Hips over ankles",
    severity: band(m.hipShiftPct, 2.5, 4.5),
    value: `${m.hipShiftPct > 0 ? "+" : ""}${m.hipShiftPct}%`,
    detail:
      m.hipShiftPct >= 2.5
        ? "Hips are pushed forward of the ankles — the sway pattern that usually travels with anterior tilt. The wall-tilt and glute-squeeze drills target exactly this."
        : "Hips stack close to the ankles. Good base.",
  });

  const sway = -m.trunkLeanPct; // + = ribcage behind pelvis
  findings.push({
    id: "trunk",
    label: "Ribcage over pelvis",
    severity:
      m.trunkLeanPct > 4.5
        ? "watch"
        : band(sway, 2.5, 4.5),
    value: `${m.trunkLeanPct > 0 ? "+" : ""}${m.trunkLeanPct}%`,
    detail:
      sway >= 2.5
        ? "The ribcage sits behind the pelvis (sway-back lean). Stack ribs over pelvis: exhale, ribs down, gentle tuck."
        : m.trunkLeanPct > 4.5
          ? "Torso leans forward of the hips — often just stance, but re-take the check standing relaxed."
          : "Ribcage stacks well over the pelvis.",
  });

  findings.push({
    id: "forwardHead",
    label: "Head over shoulders",
    severity: band(m.forwardHeadPct, 2.5, 4.5),
    value: `${m.forwardHeadPct > 0 ? "+" : ""}${m.forwardHeadPct}%`,
    detail:
      m.forwardHeadPct >= 2.5
        ? "Ear rides ahead of the shoulder — forward-head carriage. Chin tucks and a raised screen help."
        : "Ear stacks nicely over the shoulder.",
  });

  findings.push({
    id: "knee",
    label: "Knee position",
    severity: band(m.kneeDevDeg, 4, 8),
    value: `${m.kneeDevDeg > 0 ? "+" : ""}${m.kneeDevDeg}°`,
    detail:
      m.kneeDevDeg >= 4
        ? "Knees locked back (hyperextended) — a common partner of the sway pattern. Stand on soft knees."
        : "Knees are close to neutral.",
  });

  let score = 100;
  for (const f of findings) {
    if (f.severity === "watch") score -= 9;
    if (f.severity === "high") score -= 18;
  }
  score = Math.max(20, score);

  const concerns = findings.filter((f) => f.severity !== "ok");
  const summary =
    concerns.length === 0
      ? "Standing alignment looks well stacked today. Re-check in 2–4 weeks to confirm the trend."
      : `Main thing to work on: ${concerns[0].label.toLowerCase()} (${concerns[0].value}). ${
          concerns.length > 1
            ? `Also worth watching: ${concerns
                .slice(1)
                .map((f) => f.label.toLowerCase())
                .join(", ")}.`
            : ""
        }`;

  return { findings, score, summary: summary.trim() };
}
