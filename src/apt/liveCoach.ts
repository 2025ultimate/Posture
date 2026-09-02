// The live standing-posture coach: watches side-view metrics and talks the
// user into a neutral stack, one correction at a time.
//
// Coaching model (standard physio cueing): fix the stack bottom-up —
// knees → pelvis → ribcage → head — because each level rests on the one
// below. One issue at a time, a specific verbal cue, praise when it
// improves, a re-cue if it drifts back, and an "anchor" line when the
// whole stack is neutral so the user can memorize the feeling.
//
// The engine is a pure-ish state machine driven by tick(); all speech
// goes through the injected voice callbacks, rate-limited so it coaches
// rather than nags.

import type { FramingIssue, SideViewMetrics } from "./sideView";
import { interpretMetrics } from "./sideView";
import type { AlignmentFinding } from "./sideView";

export type CoachPhase = "framing" | "coaching" | "neutral";

export interface CoachInput {
  now: number;
  framing: FramingIssue | "ok";
  /** Median metrics over the recent window; null until enough clean frames. */
  metrics: SideViewMetrics | null;
}

export interface CoachUi {
  phase: CoachPhase;
  headline: string;
  detail: string;
  focusId: IssueId | null;
  findings: AlignmentFinding[];
  metrics: SideViewMetrics | null;
  score: number | null;
  /** Neutral was reached at least once this session. */
  neutralAchieved: boolean;
}

export interface CoachVoice {
  speak: (line: string) => void;
  celebrate: () => void;
}

type IssueId = "knee" | "hipShift" | "trunk" | "forwardHead";

// Bottom-up correction order.
const PRIORITY: IssueId[] = ["knee", "hipShift", "trunk", "forwardHead"];

interface IssueContent {
  headline: string;
  detail: string;
  cues: string[];
  praise: string;
  drift: string;
}

const ISSUES: Record<IssueId, IssueContent> = {
  knee: {
    headline: "Soften the knees",
    detail: "Locked-back knees push the whole pelvis forward.",
    cues: [
      "Unlock your knees — soften them just a touch.",
      "Micro-bend the knees. Strong legs, not locked legs.",
      "Un-snap the knees and let your weight settle into the mid-foot.",
    ],
    praise: "Good — knees are soft.",
    drift: "Knees locked again — soften them.",
  },
  hipShift: {
    headline: "Hips back over ankles",
    detail: "The sway pattern parks the pelvis ahead of the feet.",
    cues: [
      "Shift your hips back until they stack over your ankles — think tail gently tucked.",
      "Send the hips back an inch and let the weight move into your heels.",
      "Lightly squeeze the glutes and draw the hips back over the ankles.",
    ],
    praise: "Better — hips are stacked over your ankles.",
    drift: "Hips crept forward again — draw them back.",
  },
  trunk: {
    headline: "Ribs over pelvis",
    detail: "Stack the ribcage on the pelvis — no flare, no slump.",
    cues: [
      "Exhale fully and let the ribs come down — stack the ribcage over the pelvis.",
      "Ribs down. Gently close the space between your ribs and hips in front.",
      "Bring your chest a touch forward so it sits right over your hips.",
    ],
    praise: "Nice — ribs are stacked.",
    drift: "Ribs flared again — exhale them down.",
  },
  forwardHead: {
    headline: "Head back over shoulders",
    detail: "Ears stack over the shoulders, eyes on the horizon.",
    cues: [
      "Glide your chin straight back — ears over shoulders.",
      "Grow tall through the back of your neck and slide the head back.",
      "Chin level, head back an inch. Keep the eyes on the horizon.",
    ],
    praise: "Good — head's in line.",
    drift: "Head drifted forward again — glide it back.",
  },
};

// Forward trunk lean is a different fault than rib flare (sway) — swap cues.
const LEAN_FORWARD_CUES = [
  "Stand tall — bring your shoulders back over your hips.",
  "Rise through the crown of your head and let the chest lift.",
];

const FRAMING_LINES: Record<FramingIssue, string> = {
  no_person: "Step into view, standing sideways to the camera.",
  not_full_body: "Step back until I can see you from head to ankles.",
  not_side_on: "Turn to stand fully sideways to the camera.",
  too_far: "Come a little closer to the camera.",
};

const FRAMING_HEADLINES: Record<FramingIssue, string> = {
  no_person: "Step into view",
  not_full_body: "Step back — full body in frame",
  not_side_on: "Turn sideways",
  too_far: "Come a little closer",
};

const NEUTRAL_LINE =
  "That's it — this is your neutral stack. Soft knees, hips over ankles, ribs over hips, ears over shoulders. Take three slow breaths and memorize how this feels.";

const REINFORCE_LINES = [
  "Still stacked — notice how little effort it takes.",
  "Holding well. This is the position to find when you stand at your desk.",
  "Beautiful. Breathe — the stack should feel almost restful.",
];

const WELCOME_LINE =
  "Stand sideways to the camera, whole body in view, and stand how you normally stand. I'll guide you from there.";

const SPEAK_GAP_MS = 4500;
const FRAMING_GAP_MS = 9000;
const RECUE_AFTER_MS = 7000;
const NEUTRAL_STABLE_MS = 2500;
const REINFORCE_EVERY_MS = 22000;

export function createCoachSession(voice: CoachVoice) {
  let lastSpokeAt = 0;
  let lastFramingSpokeAt = 0;
  let lastFramingIssue: FramingIssue | null = null;
  let welcomed = false;

  let activeIssue: IssueId | null = null;
  let cueIndex = 0;
  let cueSpokeAt = 0;
  let okSince: number | null = null;
  let neutralAchieved = false;
  let inNeutral = false;
  let lastReinforceAt = 0;
  let reinforceIndex = 0;

  const say = (now: number, line: string, minGap = SPEAK_GAP_MS): boolean => {
    if (now - lastSpokeAt < minGap) return false;
    lastSpokeAt = now;
    voice.speak(line);
    return true;
  };

  const severityOf = (findings: AlignmentFinding[], id: IssueId) =>
    findings.find((f) => f.id === id)?.severity ?? "ok";

  const tick = (input: CoachInput): CoachUi => {
    const { now, framing, metrics } = input;

    if (!welcomed) {
      welcomed = true;
      say(now, WELCOME_LINE, 0);
    }

    // ---- Framing phase --------------------------------------------------
    if (framing !== "ok" || !metrics) {
      okSince = null;
      const issue = framing !== "ok" ? framing : null;
      if (issue) {
        const changed = issue !== lastFramingIssue;
        if (changed || now - lastFramingSpokeAt > FRAMING_GAP_MS) {
          if (say(now, FRAMING_LINES[issue])) {
            lastFramingSpokeAt = now;
            lastFramingIssue = issue;
          }
        }
      }
      return {
        phase: "framing",
        headline: issue ? FRAMING_HEADLINES[issue] : "Reading your posture…",
        detail: issue
          ? "Prop the phone at hip height, 2–3 m away."
          : "Hold still for a moment.",
        focusId: null,
        findings: [],
        metrics: null,
        score: null,
        neutralAchieved,
      };
    }

    lastFramingIssue = null;
    const { findings, score } = interpretMetrics(metrics);

    // First fault in bottom-up order that isn't ok.
    const fault = PRIORITY.find((id) => severityOf(findings, id) !== "ok") ?? null;

    // ---- All clear ------------------------------------------------------
    if (!fault) {
      // Praise the fix that just landed before settling in.
      if (activeIssue) {
        say(now, ISSUES[activeIssue].praise, 1500);
        activeIssue = null;
      }
      if (okSince === null) okSince = now;
      const stable = now - okSince >= NEUTRAL_STABLE_MS;
      if (stable && !inNeutral) {
        inNeutral = true;
        lastReinforceAt = now;
        if (!neutralAchieved) {
          neutralAchieved = true;
          voice.celebrate();
          say(now, NEUTRAL_LINE, 0);
        } else {
          say(now, "Re-stacked. Hold it.", 2000);
        }
      } else if (inNeutral && now - lastReinforceAt > REINFORCE_EVERY_MS) {
        lastReinforceAt = now;
        say(now, REINFORCE_LINES[reinforceIndex % REINFORCE_LINES.length]);
        reinforceIndex += 1;
      }
      return {
        phase: inNeutral ? "neutral" : "coaching",
        headline: inNeutral ? "Neutral — hold and breathe" : "Almost there — hold it",
        detail: inNeutral
          ? "Memorize this. It's the stance for your desk, the kitchen, the queue."
          : "Stay still a moment while I confirm the stack.",
        focusId: null,
        findings,
        metrics,
        score,
        neutralAchieved,
      };
    }

    // ---- Coaching one fault ---------------------------------------------
    okSince = null;
    const wasNeutral = inNeutral;
    inNeutral = false;
    const content = ISSUES[fault];

    if (fault !== activeIssue) {
      // Praise the previous fix on the way to the next fault.
      const praise =
        activeIssue && severityOf(findings, activeIssue) === "ok"
          ? `${ISSUES[activeIssue].praise} `
          : "";
      activeIssue = fault;
      cueIndex = 0;
      const line = wasNeutral
        ? content.drift
        : `${praise}${pickCue(fault, metrics, 0)}`;
      if (say(now, line, wasNeutral ? 2500 : 1500)) cueSpokeAt = now;
    } else if (now - cueSpokeAt > RECUE_AFTER_MS) {
      // Same fault persists — try the next phrasing.
      cueIndex += 1;
      if (say(now, pickCue(fault, metrics, cueIndex))) cueSpokeAt = now;
    }

    return {
      phase: "coaching",
      headline: content.headline,
      detail: content.detail,
      focusId: fault,
      findings,
      metrics,
      score,
      neutralAchieved,
    };
  };

  return { tick };
}

function pickCue(id: IssueId, metrics: SideViewMetrics, index: number): string {
  if (id === "trunk" && metrics.trunkLeanPct > 0) {
    return LEAN_FORWARD_CUES[index % LEAN_FORWARD_CUES.length];
  }
  const cues = ISSUES[id].cues;
  return cues[index % cues.length];
}

/** Display order for the live chips: the stack, bottom-up. */
export const CHIP_ORDER: { id: IssueId; label: string }[] = [
  { id: "knee", label: "Knees" },
  { id: "hipShift", label: "Hips" },
  { id: "trunk", label: "Ribs" },
  { id: "forwardHead", label: "Head" },
];
