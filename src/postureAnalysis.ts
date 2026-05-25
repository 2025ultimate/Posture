import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export type PostureStatus = "good" | "bad" | "unknown";
export type ActivityContext =
  | "working"
  | "phone_call"
  | "phone_browsing"
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
const LEFT_ELBOW = 13;
const RIGHT_ELBOW = 14;
const LEFT_WRIST = 15;
const RIGHT_WRIST = 16;
// Hand-tip landmarks — closer to the ear than the wrist when holding a phone.
const LEFT_PINKY = 17;
const RIGHT_PINKY = 18;
const LEFT_INDEX = 19;
const RIGHT_INDEX = 20;
const LEFT_THUMB = 21;
const RIGHT_THUMB = 22;

const LEFT_HAND_POINTS = [LEFT_WRIST, LEFT_PINKY, LEFT_INDEX, LEFT_THUMB];
const RIGHT_HAND_POINTS = [RIGHT_WRIST, RIGHT_PINKY, RIGHT_INDEX, RIGHT_THUMB];

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

function visible(lm: NormalizedLandmark | undefined, threshold = 0.4): boolean {
  return !!lm && (lm.visibility === undefined || lm.visibility >= threshold);
}

// Returns the minimum distance from any visible hand landmark to the target,
// or Infinity if nothing visible enough is found.
function minHandDistance(
  landmarks: NormalizedLandmark[],
  handIndices: number[],
  target: NormalizedLandmark
): number {
  let min = Infinity;
  for (const i of handIndices) {
    const lm = landmarks[i];
    // Hand landmarks are often partially occluded by the phone/face when
    // someone is on a call. Use a lower visibility threshold so we don't
    // miss the gesture.
    if (visible(lm, 0.2)) {
      const d = distance(lm, target);
      if (d < min) min = d;
    }
  }
  return min;
}

function detectActivity(landmarks: NormalizedLandmark[]): ActivityContext {
  const nose = landmarks[NOSE];
  const leftEye = landmarks[LEFT_EYE];
  const rightEye = landmarks[RIGHT_EYE];
  const leftEar = landmarks[LEFT_EAR];
  const rightEar = landmarks[RIGHT_EAR];
  const leftShoulder = landmarks[LEFT_SHOULDER];
  const rightShoulder = landmarks[RIGHT_SHOULDER];
  const leftElbow = landmarks[LEFT_ELBOW];
  const rightElbow = landmarks[RIGHT_ELBOW];

  // Phone call: a hand is up near the head OR an elbow is raised near
  // shoulder level (the classic "phone at ear" elbow lift).
  if (visible(leftEar) && visible(rightEar) && visible(leftShoulder) && visible(rightShoulder)) {
    const headSize = distance(leftEar, rightEar);
    const shoulderMid = midpoint(leftShoulder, rightShoulder);
    if (headSize > 0) {
      // Generous radius: a hand within ~1.6 head-widths of either ear counts.
      // Using all hand landmarks (wrist + pinky + index + thumb) so we catch
      // the case where the wrist is obscured but a finger is visible.
      const phoneRadius = headSize * 1.6;
      const leftHandNearLeftEar = minHandDistance(landmarks, LEFT_HAND_POINTS, leftEar);
      const leftHandNearRightEar = minHandDistance(landmarks, LEFT_HAND_POINTS, rightEar);
      const rightHandNearLeftEar = minHandDistance(landmarks, RIGHT_HAND_POINTS, leftEar);
      const rightHandNearRightEar = minHandDistance(landmarks, RIGHT_HAND_POINTS, rightEar);

      if (
        leftHandNearLeftEar < phoneRadius ||
        leftHandNearRightEar < phoneRadius ||
        rightHandNearLeftEar < phoneRadius ||
        rightHandNearRightEar < phoneRadius
      ) {
        return "phone_call";
      }

      // Secondary: an elbow lifted to shoulder-height or above strongly
      // suggests the hand is up at the ear, even if the hand landmarks
      // are completely hidden by the phone or face.
      const shoulderWidth = distance(leftShoulder, rightShoulder);
      const elbowLiftThreshold = shoulderMid.y + shoulderWidth * 0.1;
      if (
        (visible(leftElbow, 0.3) && leftElbow.y < elbowLiftThreshold) ||
        (visible(rightElbow, 0.3) && rightElbow.y < elbowLiftThreshold)
      ) {
        return "phone_call";
      }
    }
  }

  // Head-down activities (phone browsing or writing): compute the neck
  // angle (shoulder-mid → ear-mid vector) vs vertical. Normal upright
  // posture sits at ~0°; bending forward to look at a phone or desk
  // tips this past ~20° even when the ears are still above the shoulder
  // line. Differentiator between the two: phone browsing has a hand
  // raised at chest/face level holding the device, writing does not.
  if (
    visible(nose) &&
    visible(leftShoulder) &&
    visible(rightShoulder) &&
    visible(leftEar) &&
    visible(rightEar)
  ) {
    const shoulderMid = midpoint(leftShoulder, rightShoulder);
    const earMid = midpoint(leftEar, rightEar);
    const dx = earMid.x - shoulderMid.x;
    const dy = shoulderMid.y - earMid.y; // positive = ear above shoulder
    const shoulderWidth = distance(leftShoulder, rightShoulder);
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
      const neckFromVertical =
        dy <= 0 ? 90 : (Math.atan2(Math.abs(dx), dy) * 180) / Math.PI;

      let nosBelowEyes = false;
      if (visible(leftEye) && visible(rightEye)) {
        const eyeMidY = (leftEye.y + rightEye.y) / 2;
        const eyeDist = distance(leftEye, rightEye);
        nosBelowEyes = eyeDist > 0 && nose.y - eyeMidY > eyeDist * 0.55;
      }

      const headBentForward =
        (neckFromVertical > 20 && nosBelowEyes) || neckFromVertical > 35;

      if (headBentForward) {
        // Hand-raised check: any hand landmark sitting in the "phone
        // holding" zone (between roughly face level and just below the
        // shoulder line, anywhere across the torso horizontally). The
        // hand is often partially occluded by the phone itself, so use
        // a low visibility floor and scan all hand-tip landmarks.
        const handZoneTop = nose.y - shoulderWidth * 0.5;
        const handZoneBottom = shoulderMid.y + shoulderWidth * 0.6;
        const handLeftBound = Math.min(leftShoulder.x, rightShoulder.x) - shoulderWidth * 0.5;
        const handRightBound = Math.max(leftShoulder.x, rightShoulder.x) + shoulderWidth * 0.5;

        const handLandmarks = [
          ...LEFT_HAND_POINTS,
          ...RIGHT_HAND_POINTS,
        ];
        let handInPhoneZone = false;
        for (const i of handLandmarks) {
          const h = landmarks[i];
          if (!visible(h, 0.2)) continue;
          if (
            h.y > handZoneTop &&
            h.y < handZoneBottom &&
            h.x > handLeftBound &&
            h.x < handRightBound
          ) {
            handInPhoneZone = true;
            break;
          }
        }

        if (handInPhoneZone) {
          return "phone_browsing";
        }

        // No hand visible in the phone zone — assume head-down desk work.
        // Keep stricter thresholds for writing so we don't classify every
        // forward lean as bad-posture writing.
        if ((neckFromVertical > 28 && nosBelowEyes) || neckFromVertical > 45) {
          return "writing";
        }
      }
    }
  }

  // Talking to someone: head turned far enough sideways that one ear is
  // much more visible than the other AND the nose drifts toward the
  // visible-ear side relative to the shoulders.
  if (visible(nose) && visible(leftShoulder) && visible(rightShoulder)) {
    const leftEarVis = leftEar?.visibility ?? 0;
    const rightEarVis = rightEar?.visibility ?? 0;
    const earVisRatio =
      Math.max(leftEarVis, rightEarVis) /
      Math.max(0.01, Math.min(leftEarVis, rightEarVis));
    const shoulderMid = midpoint(leftShoulder, rightShoulder);
    const shoulderWidth = distance(leftShoulder, rightShoulder);
    const noseOffset = Math.abs(nose.x - shoulderMid.x);

    // Either: clearly asymmetric ear visibility, OR a strong nose drift,
    // OR one eye becoming nearly invisible while the other is clear.
    let eyeAsymmetric = false;
    if (leftEye && rightEye) {
      const lv = leftEye.visibility ?? 0;
      const rv = rightEye.visibility ?? 0;
      eyeAsymmetric = Math.abs(lv - rv) > 0.4 || Math.min(lv, rv) < 0.2;
    }

    if (
      shoulderWidth > 0 &&
      ((earVisRatio > 2.2 && noseOffset > shoulderWidth * 0.22) ||
        noseOffset > shoulderWidth * 0.45 ||
        (eyeAsymmetric && noseOffset > shoulderWidth * 0.25))
    ) {
      return "talking_to_someone";
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

  const coreVisible = [nose, leftShoulder, rightShoulder, leftEar, rightEar].every((l) =>
    visible(l)
  );
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
