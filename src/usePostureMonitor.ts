import { useRef, useState, useCallback, useEffect } from "react";
import { PoseLandmarker, DrawingUtils } from "@mediapipe/tasks-vision";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { createPoseLandmarker } from "./poseAssets";
import { analyzePosture } from "./postureAnalysis";
import type { PostureResult } from "./postureAnalysis";
import { appendSession } from "./sessionHistory";
import type { SessionRecord } from "./sessionHistory";

interface SessionStats {
  startedAt: number;
  lastTickAt: number;
  totalMs: number;
  badMs: number;
  issueCounts: Record<string, number>;
  scoreSums: { neckTilt: number; shoulderLevel: number; forwardHead: number; eyeLevel: number };
  sampleCount: number;
}

export type MonitorState = "idle" | "loading" | "running" | "error";
export type CameraPhase = "on" | "off" | "always";

export interface DutyCycleSettings {
  enabled: boolean;
  onDuration: number;
  offDuration: number;
}

const BAD_POSTURE_GRACE_MS = 8000;
const POSTURE_ALERT_COOLDOWN_MS = 12 * 60 * 1000;
const SMOOTHING_FRAMES = 8;
// Motion gate: two parallel signals, either one trips it.
//   - Body motion (nose/ears/shoulders) catches head turns, leaning,
//     relocating the laptop, walking away.
//   - Hand motion (wrists) catches gesturing, eating, drinking,
//     stretching, picking things up — i.e. "not engaged with keyboard
//     and mouse." When typing/mousing the wrist landmark itself is
//     steady (fingers move, the wrist as a point doesn't), so this
//     cleanly separates working from interacting with the room.
const MOTION_BUFFER_SIZE = 5;
const BODY_MOTION_THRESHOLD = 0.022;
const HAND_MOTION_THRESHOLD = 0.028;
// Keep the "moving" state for this long after the last high-motion
// frame so brief lulls in the middle of a gesture don't toggle alerts.
const MOTION_COOLDOWN_MS = 3500;
const BODY_MOTION_INDICES = [0, 7, 8, 11, 12]; // nose, ears, shoulders
const HAND_MOTION_INDICES = [15, 16]; // wrists only — finger landmarks
                                       // are too noisy and would fire on
                                       // any hand activity at all.
// Detection runs ~10 fps in foreground, ~2 fps when tab/window is hidden.
// Posture changes slowly; >10 fps wastes CPU/GPU without changing UX.
const FOREGROUND_DETECT_INTERVAL_MS = 100;
const BACKGROUND_DETECT_INTERVAL_MS = 500;

function frameDisplacement(
  curr: NormalizedLandmark[],
  prev: NormalizedLandmark[],
  indices: number[]
): number {
  let total = 0;
  let count = 0;
  for (const i of indices) {
    const c = curr[i];
    const p = prev[i];
    if (!c || !p) continue;
    if ((c.visibility ?? 1) < 0.3 || (p.visibility ?? 1) < 0.3) continue;
    const dx = c.x - p.x;
    const dy = c.y - p.y;
    total += Math.sqrt(dx * dx + dy * dy);
    count += 1;
  }
  return count > 0 ? total / count : 0;
}

// The caller supplies the alert sound (see useAudioCues) so all app audio
// comes from one place.
export function usePostureMonitor(playAlert: () => void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const detectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastBeepRef = useRef<number>(0);
  const [alertCooldownUntil, setAlertCooldownUntil] = useState<number>(0);
  const resultsBufferRef = useRef<PostureResult[]>([]);
  const dutyCycleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = useRef(false);
  const detectFnRef = useRef<(() => void) | null>(null);
  const playAlertRef = useRef(playAlert);
  const drawingUtilsRef = useRef<DrawingUtils | null>(null);
  const sessionStatsRef = useRef<SessionStats | null>(null);
  const prevLandmarksRef = useRef<NormalizedLandmark[] | null>(null);
  const motionBufferRef = useRef<number[]>([]);
  const handMotionBufferRef = useRef<number[]>([]);
  const motionUntilRef = useRef<number>(0);
  const isMovingRef = useRef<boolean>(false);
  const [isMoving, setIsMoving] = useState(false);
  const [sessionsVersion, setSessionsVersion] = useState(0);

  const [state, setState] = useState<MonitorState>("idle");
  const [result, setResult] = useState<PostureResult | null>(null);
  const [error, setError] = useState<string>("");
  const [badDuration, setBadDuration] = useState(0);
  const [cameraPhase, setCameraPhase] = useState<CameraPhase>("always");
  const [dutyCycle, setDutyCycle] = useState<DutyCycleSettings>({
    enabled: false,
    onDuration: 30,
    offDuration: 60,
  });
  const [alertsPaused, setAlertsPaused] = useState(false);
  const alertsPausedRef = useRef(false);
  const badStartRef = useRef<number | null>(null);

  useEffect(() => {
    alertsPausedRef.current = alertsPaused;
  }, [alertsPaused]);

  useEffect(() => {
    playAlertRef.current = playAlert;
  }, [playAlert]);

  const toggleAlertsPaused = useCallback(() => {
    setAlertsPaused((p) => !p);
  }, []);

  const fireAlerts = useCallback((elapsed: number, now: number) => {
    // Grace window: don't ping for transient bad posture (reaching for
    // water, glancing at a phone). The user has to be in bad posture
    // continuously for this long before any alert fires.
    if (elapsed < BAD_POSTURE_GRACE_MS) return;
    // Cooldown window: once we've alerted, leave the user alone for a
    // good while. Repeated pings while they're still off-task are
    // annoying and counterproductive — the user has acknowledged the
    // posture issue by hearing the first alert.
    if (now - lastBeepRef.current < POSTURE_ALERT_COOLDOWN_MS) return;

    lastBeepRef.current = now;
    setAlertCooldownUntil(now + POSTURE_ALERT_COOLDOWN_MS);
    playAlertRef.current();
  }, []);

  const smoothedResult = useCallback((newResult: PostureResult): PostureResult => {
    const buf = resultsBufferRef.current;
    buf.push(newResult);
    if (buf.length > SMOOTHING_FRAMES) buf.shift();
    const badCount = buf.filter((r) => r.status === "bad").length;
    const goodCount = buf.filter((r) => r.status === "good").length;

    // Activity selection biased toward suppression-worthy contexts: false
    // negatives (nagging someone mid-call) are far worse than false
    // positives (briefly showing a "phone" badge). If the user has been
    // detected as on a call / talking / away in ANY of the recent frames,
    // honor that and keep the badge sticky.
    const activityCounts: Record<string, number> = {};
    buf.forEach((r) => {
      activityCounts[r.activity] = (activityCounts[r.activity] ?? 0) + 1;
    });
    const stickyThreshold = Math.max(1, Math.floor(SMOOTHING_FRAMES / 4));
    let dominantActivity: PostureResult["activity"] = "working";
    if ((activityCounts.phone_call ?? 0) >= stickyThreshold) {
      dominantActivity = "phone_call";
    } else if ((activityCounts.phone_browsing ?? 0) >= stickyThreshold) {
      dominantActivity = "phone_browsing";
    } else if ((activityCounts.talking_to_someone ?? 0) >= stickyThreshold) {
      dominantActivity = "talking_to_someone";
    } else if ((activityCounts.away ?? 0) >= stickyThreshold) {
      dominantActivity = "away";
    } else if ((activityCounts.writing ?? 0) >= stickyThreshold) {
      dominantActivity = "writing";
    }

    if (buf.length < SMOOTHING_FRAMES / 2) return newResult;
    if (badCount > goodCount) return { ...newResult, activity: dominantActivity };
    return { ...newResult, status: "good", issues: [], activity: dominantActivity };
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    if (streamRef.current) return;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: "user" },
    });
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }
  }, []);

  const startMonitoring = useCallback(async () => {
    setState("loading");
    setError("");
    try {
      landmarkerRef.current = await createPoseLandmarker();

      await startCamera();

      setState("running");
      runningRef.current = true;
      sessionStatsRef.current = {
        startedAt: Date.now(),
        lastTickAt: Date.now(),
        totalMs: 0,
        badMs: 0,
        issueCounts: {},
        scoreSums: { neckTilt: 0, shoulderLevel: 0, forwardHead: 0, eyeLevel: 0 },
        sampleCount: 0,
      };

      let lastTime = -1;

      const detect = () => {
        if (!runningRef.current || !landmarkerRef.current || !videoRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (video.readyState >= 2 && video.currentTime !== lastTime) {
          lastTime = video.currentTime;

          const timestamp = performance.now();
          const detection = landmarkerRef.current.detectForVideo(video, timestamp);
          const visible = !document.hidden && canvas !== null;

          if (visible && canvas) {
            const ctx = canvas.getContext("2d")!;
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;

            ctx.save();
            ctx.scale(-1, 1);
            ctx.translate(-canvas.width, 0);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            ctx.restore();

            if (detection.landmarks && detection.landmarks.length > 0) {
              const mirrored = detection.landmarks[0].map((lm) => ({ ...lm, x: 1 - lm.x }));
              if (!drawingUtilsRef.current) {
                drawingUtilsRef.current = new DrawingUtils(ctx);
              }
              drawingUtilsRef.current.drawConnectors(mirrored, PoseLandmarker.POSE_CONNECTIONS, {
                color: "#00e5ff",
                lineWidth: 2,
              });
              drawingUtilsRef.current.drawLandmarks(mirrored, {
                color: "#ff4081",
                radius: 4,
              });
            }
          }

          if (detection.landmarks && detection.landmarks.length > 0) {
            const currentLandmarks = detection.landmarks[0];

            // Motion gate: two parallel signals. Body motion (head /
            // shoulders) catches leaning, head turns, walking away. Hand
            // motion (wrists) catches gesturing, eating, picking things
            // up — i.e. "not engaged with keyboard and mouse," since when
            // typing the wrist landmark itself is steady even though
            // fingers fly around. Either signal above its threshold
            // counts as moving.
            const nowForMotion = Date.now();
            if (prevLandmarksRef.current) {
              const bodyM = frameDisplacement(
                currentLandmarks,
                prevLandmarksRef.current,
                BODY_MOTION_INDICES
              );
              const handM = frameDisplacement(
                currentLandmarks,
                prevLandmarksRef.current,
                HAND_MOTION_INDICES
              );

              const bodyBuf = motionBufferRef.current;
              bodyBuf.push(bodyM);
              if (bodyBuf.length > MOTION_BUFFER_SIZE) bodyBuf.shift();
              const bodyRecent = bodyBuf.reduce((s, v) => s + v, 0) / bodyBuf.length;

              const handBuf = handMotionBufferRef.current;
              handBuf.push(handM);
              if (handBuf.length > MOTION_BUFFER_SIZE) handBuf.shift();
              const handRecent = handBuf.reduce((s, v) => s + v, 0) / handBuf.length;

              if (
                bodyRecent > BODY_MOTION_THRESHOLD ||
                handRecent > HAND_MOTION_THRESHOLD
              ) {
                motionUntilRef.current = nowForMotion + MOTION_COOLDOWN_MS;
              }
            }
            prevLandmarksRef.current = currentLandmarks;
            const moving = nowForMotion < motionUntilRef.current;
            if (moving !== isMovingRef.current) {
              isMovingRef.current = moving;
              setIsMoving(moving);
            }

            const raw = analyzePosture(currentLandmarks);
            const smoothed = smoothedResult(raw);
            setResult(smoothed);

            const now = Date.now();
            const stats = sessionStatsRef.current;
            if (stats) {
              const dt = now - stats.lastTickAt;
              stats.lastTickAt = now;
              // Don't accumulate time the user spent away from the desk
              // or moving around — the readings during those windows
              // aren't representative of their working posture and would
              // skew the bad-% in insights.
              if (smoothed.activity !== "away" && !moving) {
                stats.totalMs += dt;
                if (smoothed.status === "bad") {
                  stats.badMs += dt;
                  smoothed.issues.forEach((issue) => {
                    stats.issueCounts[issue] = (stats.issueCounts[issue] ?? 0) + 1;
                  });
                }
                stats.scoreSums.neckTilt += smoothed.scores.neckTilt;
                stats.scoreSums.shoulderLevel += smoothed.scores.shoulderLevel;
                stats.scoreSums.forwardHead += smoothed.scores.forwardHead;
                stats.scoreSums.eyeLevel += smoothed.scores.eyeLevel;
                stats.sampleCount += 1;
              }
            }

            // Suppress alerts when the user is on a phone call, talking to
            // someone, away from the desk, or moving rapidly — but still
            // track posture in the result so the UI reflects reality.
            const suppressAlerts =
              alertsPausedRef.current ||
              moving ||
              smoothed.activity === "phone_call" ||
              smoothed.activity === "phone_browsing" ||
              smoothed.activity === "talking_to_someone" ||
              smoothed.activity === "away";

            if (moving) {
              // Treat motion as a fresh start: don't carry a bad-posture
              // duration through the move, so resuming doesn't fire
              // immediately.
              if (badStartRef.current !== null) {
                badStartRef.current = null;
                setBadDuration(0);
              }
            } else if (smoothed.status === "bad") {
              if (badStartRef.current === null) badStartRef.current = now;
              const elapsed = now - badStartRef.current;
              setBadDuration(Math.floor(elapsed / 1000));
              if (!suppressAlerts) {
                fireAlerts(elapsed, now);
              }
            } else if (smoothed.status === "good") {
              if (badStartRef.current !== null) {
                badStartRef.current = null;
                setBadDuration(0);
              }
            }
          } else if (visible) {
            setResult({
              status: "unknown",
              issues: ["No person detected"],
              scores: { neckTilt: 0, shoulderLevel: 0, forwardHead: 0, eyeLevel: 0 },
              activity: "away",
            });
            // Also reset bad-posture timer so no stale alert fires when the
            // user returns.
            if (badStartRef.current !== null) {
              badStartRef.current = null;
              setBadDuration(0);
            }
            // Advance lastTickAt so the time the user is away isn't billed
            // to whatever activity they resume with.
            const stats = sessionStatsRef.current;
            if (stats) stats.lastTickAt = Date.now();
            // Clear motion tracking — there's no person to track motion
            // for, and we don't want a stale frame compared against the
            // first frame after they return.
            prevLandmarksRef.current = null;
            motionBufferRef.current = [];
            handMotionBufferRef.current = [];
          }
        }

        scheduleNext();
      };

      const scheduleNext = () => {
        if (!runningRef.current) return;
        const interval = document.hidden ? BACKGROUND_DETECT_INTERVAL_MS : FOREGROUND_DETECT_INTERVAL_MS;
        detectTimerRef.current = setTimeout(detect, interval);
      };

      detectFnRef.current = detect;
      scheduleNext();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setState("error");
    }
  }, [fireAlerts, smoothedResult, startCamera]);

  const stopMonitoring = useCallback(() => {
    runningRef.current = false;
    if (detectTimerRef.current) clearTimeout(detectTimerRef.current);
    if (dutyCycleTimerRef.current) clearTimeout(dutyCycleTimerRef.current);
    stopCamera();
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
    drawingUtilsRef.current = null;
    resultsBufferRef.current = [];
    badStartRef.current = null;
    detectFnRef.current = null;

    const stats = sessionStatsRef.current;
    if (stats && stats.sampleCount > 0) {
      const record: SessionRecord = {
        startedAt: stats.startedAt,
        endedAt: Date.now(),
        durationMs: stats.totalMs,
        badDurationMs: stats.badMs,
        issueCounts: stats.issueCounts,
        avgScores: {
          neckTilt: stats.scoreSums.neckTilt / stats.sampleCount,
          shoulderLevel: stats.scoreSums.shoulderLevel / stats.sampleCount,
          forwardHead: stats.scoreSums.forwardHead / stats.sampleCount,
          eyeLevel: stats.scoreSums.eyeLevel / stats.sampleCount,
        },
        sampleCount: stats.sampleCount,
      };
      appendSession(record);
      setSessionsVersion((v) => v + 1);
    }
    sessionStatsRef.current = null;

    prevLandmarksRef.current = null;
    motionBufferRef.current = [];
    handMotionBufferRef.current = [];
    motionUntilRef.current = 0;
    isMovingRef.current = false;
    setIsMoving(false);
    lastBeepRef.current = 0;
    setAlertCooldownUntil(0);
    setBadDuration(0);
    setResult(null);
    setCameraPhase("always");
    setAlertsPaused(false);
    setState("idle");
  }, [stopCamera]);

  // Reschedule detect timer when visibility flips so interval adapts immediately
  useEffect(() => {
    const handleVisibility = () => {
      if (!runningRef.current || !detectFnRef.current) return;
      if (detectTimerRef.current) clearTimeout(detectTimerRef.current);
      const interval = document.hidden ? BACKGROUND_DETECT_INTERVAL_MS : FOREGROUND_DETECT_INTERVAL_MS;
      detectTimerRef.current = setTimeout(detectFnRef.current, interval);
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // Duty cycle: toggle camera on/off on a schedule
  const startDutyCycle = useCallback((onSec: number, offSec: number) => {
    setDutyCycle({ enabled: true, onDuration: onSec, offDuration: offSec });
  }, []);

  const stopDutyCycle = useCallback(() => {
    if (dutyCycleTimerRef.current) clearTimeout(dutyCycleTimerRef.current);
    setDutyCycle((prev) => ({ ...prev, enabled: false }));
    setCameraPhase("always");
    if (runningRef.current && !streamRef.current) {
      startCamera();
    }
  }, [startCamera]);

  useEffect(() => {
    if (!dutyCycle.enabled || state !== "running") {
      if (dutyCycleTimerRef.current) clearTimeout(dutyCycleTimerRef.current);
      return;
    }

    let cancelled = false;

    const cycle = async (phase: "on" | "off") => {
      if (cancelled || !runningRef.current) return;
      if (phase === "on") {
        setCameraPhase("on");
        await startCamera();
        dutyCycleTimerRef.current = setTimeout(() => cycle("off"), dutyCycle.onDuration * 1000);
      } else {
        setCameraPhase("off");
        stopCamera();
        dutyCycleTimerRef.current = setTimeout(() => cycle("on"), dutyCycle.offDuration * 1000);
      }
    };

    cycle("on");

    return () => {
      cancelled = true;
      if (dutyCycleTimerRef.current) clearTimeout(dutyCycleTimerRef.current);
    };
  }, [dutyCycle.enabled, dutyCycle.onDuration, dutyCycle.offDuration, state, startCamera, stopCamera]);

  useEffect(() => () => stopMonitoring(), [stopMonitoring]);

  return {
    videoRef,
    canvasRef,
    state,
    result,
    error,
    badDuration,
    cameraPhase,
    dutyCycle,
    alertsPaused,
    toggleAlertsPaused,
    isMoving,
    alertCooldownUntil,
    sessionsVersion,
    startMonitoring,
    stopMonitoring,
    startDutyCycle,
    stopDutyCycle,
  };
}
