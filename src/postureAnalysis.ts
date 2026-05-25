import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export type PostureStatus = "good" | "bad" | "unknown";
export type ActivityContext =
  | "working"
  | "phone_call"
  | "writing"
  | "talking_to_someone"
  | "away";

export interface PostureResult {
  status: PostureStatus;
  issues: string[];
  scores: {
    neckTilt: number;
    shoulderLevel: number;
    forwardHead: number;
    eyeLevel: number;
  };
  activity: ActivityContext;
}

const NOSE = 0;
const LEFT_EYE = 2;
const RIGHT_EYE = 5;
const LEFT_EAR = 7;
const RIGHT_EAR = 8;
const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
const LEFT_WRIST = 15;
const RIGHT_WRIST = 16;

function angle(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI);
}

function distance(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function midpoint(a: NormalizedLandmark, b: NormalizedLandmark): NormalizedLandmark {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2,
    visibility: Math.min(a.visibility ?? 1, b.visibility ?? 1),
  };
}

function visible(lm: NormalizedLandmark | undefined): boolean {
  return !!lm && (lm.visibility === undefined || lm.visibility >= 0.4);
}

function detectActivity(landmarks: NormalizedLandmark[]): ActivityContext {
  const nose = landmarks[NOSE];
  const leftEar = landmarks[LEFT_EAR];
  const rightEar = landmarks[RIGHT_EAR];
  const leftShoulder = landmarks[LEFT_SHOULDER];
  const rightShoulder = landmarks[RIGHT_SHOULDER];
  const leftWrist = landmarks[LEFT_WRIST];
  const rightWrist = landmarks[RIGHT_WRIST];

  // Phone call: wrist near either ear
  if (visible(leftEar) && visible(rightEar)) {
    const headSize = distance(leftEar, rightEar);
    if (headSize > 0) {
      const phoneThreshold = headSize * 1.2;
      if (visible(leftWrist)) {
        if (
          distance(leftWrist, leftEar) < phoneThreshold ||
          distance(leftWrist, rightEar) < phoneThreshold
        ) {
          return "phone_call";
        }
      }
      if (visible(rightWrist)) {
        if (
          distance(rightWrist, rightEar) < phoneThreshold ||
          distance(rightWrist, leftEar) < phoneThreshold
        ) {
          return "phone_call";
        }
      }
    }
  }

  // Talking to someone: head turned significantly sideways
  // When facing camera, both ears have similar visibility AND nose sits between them horizontally.
  // When turned sideways, one ear is much more visible than the other and nose drifts toward that side.
  if (visible(nose) && visible(leftShoulder) && visible(rightShoulder)) {
    const leftEarVis = leftEar?.visibility ?? 0;
    const rightEarVis = rightEar?.visibility ?? 0;
    const earVisDiff = Math.abs(leftEarVis - rightEarVis);
    const shoulderMid = midpoint(leftShoulder, rightShoulder);
    const shoulderWidth = distance(leftShoulder, rightShoulder);
    const noseOffset = Math.abs(nose.x - shoulderMid.x);
    if (
      shoulderWidth > 0 &&
      earVisDiff > 0.35 &&
      noseOffset > shoulderWidth * 0.3
    ) {
      return "talking_to_someone";
    }
  }

  // Writing on desk: head significantly below shoulder line (looking way down)
  if (
    visible(nose) &&
    visible(leftShoulder) &&
    visible(rightShoulder) &&
    visible(leftEar) &&
    visible(rightEar)
  ) {
    const shoulderMid = midpoint(leftShoulder, rightShoulder);
    const earMid = midpoint(leftEar, rightEar);
    const shoulderWidth = distance(leftShoulder, rightShoulder);
    // ears below or very close to shoulders -> head bent forward strongly
    if (
      shoulderWidth > 0 &&
      earMid.y > shoulderMid.y - shoulderWidth * 0.15 &&
      nose.y > shoulderMid.y - shoulderWidth * 0.4
    ) {
      return "writing";
    }
  }

  return "working";
}

export function analyzePosture(landmarks: NormalizedLandmark[]): PostureResult {
  const issues: string[] = [];
  const emptyScores = { neckTilt: 0, shoulderLevel: 0, forwardHead: 0, eyeLevel: 0 };

  const nose = landmarks[NOSE];
  const leftEye = landmarks[LEFT_EYE];
  const rightEye = landmarks[RIGHT_EYE];
  const leftShoulder = landmarks[LEFT_SHOULDER];
  const rightShoulder = landmarks[RIGHT_SHOULDER];
  const leftEar = landmarks[LEFT_EAR];
  const rightEar = landmarks[RIGHT_EAR];

  const coreVisible = [nose, leftShoulder, rightShoulder, leftEar, rightEar].every(visible);
  if (!coreVisible) {
    return {
      status: "unknown",
      issues: ["Not fully visible"],
      scores: emptyScores,
      activity: "away",
    };
  }

  const activity = detectActivity(landmarks);

  const shoulderMid = midpoint(leftShoulder, rightShoulder);
  const earMid = midpoint(leftEar, rightEar);
  const shoulderWidth = distance(leftShoulder, rightShoulder);

  // 1. Shoulder level
  const shoulderLevelDiff = Math.abs(leftShoulder.y - rightShoulder.y);
  const shoulderLevelScore = Math.min(100, (shoulderLevelDiff / (shoulderWidth * 0.15)) * 100);

  // 2. Neck tilt (ear midpoint vs shoulder midpoint angle from vertical)
  const neckAngle = Math.abs(angle(shoulderMid, earMid) + 90);
  const neckTiltScore = Math.min(100, (neckAngle / 15) * 100);

  // 3. Forward head (horizontal displacement of ears vs shoulders)
  const horizontalOffset = Math.abs(earMid.x - shoulderMid.x);
  const forwardHeadScore = Math.min(100, (horizontalOffset / (shoulderWidth * 0.2)) * 100);

  // 4. Eye level (tilt between left and right eyes)
  let eyeLevelScore = 0;
  if (visible(leftEye) && visible(rightEye)) {
    const eyeDiff = Math.abs(leftEye.y - rightEye.y);
    const eyeDist = distance(leftEye, rightEye);
    eyeLevelScore = Math.min(100, (eyeDiff / (eyeDist * 0.25)) * 100);
  }

  if (shoulderLevelScore > 60) issues.push("Uneven shoulders");
  if (neckTiltScore > 60) issues.push("Neck tilted");
  if (forwardHeadScore > 60) issues.push("Head too far forward");
  if (eyeLevelScore > 60) issues.push("Eyes not level");

  const status: PostureStatus = issues.length === 0 ? "good" : "bad";

  return {
    status,
    issues,
    scores: {
      neckTilt: Math.round(neckTiltScore),
      shoulderLevel: Math.round(shoulderLevelScore),
      forwardHead: Math.round(forwardHeadScore),
      eyeLevel: Math.round(eyeLevelScore),
    },
    activity,
  };
}
