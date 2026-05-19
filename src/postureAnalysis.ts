import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export type PostureStatus = "good" | "bad" | "unknown";

export interface PostureResult {
  status: PostureStatus;
  issues: string[];
  scores: {
    neckTilt: number;
    shoulderLevel: number;
    forwardHead: number;
    eyeLevel: number;
  };
}

const NOSE = 0;
const LEFT_EYE = 2;
const RIGHT_EYE = 5;
const LEFT_EAR = 7;
const RIGHT_EAR = 8;
const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;

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
    return { status: "unknown", issues: ["Not fully visible"], scores: emptyScores };
  }

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
  };
}
