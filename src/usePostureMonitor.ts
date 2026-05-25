import { useRef, useState, useCallback, useEffect } from "react";
import { PoseLandmarker, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision";
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
export type AlertTone = "beep" | "ding" | "chime" | "chirp" | "buzz";

export const ALERT_TONE_LABELS: Record<AlertTone, string> = {
  beep: "Beep",
  ding: "Ding",
  chime: "Chime",
  chirp: "Chirp",
  buzz: "Buzz",
};

export interface DutyCycleSettings {
  enabled: boolean;
  onDuration: number;
  offDuration: number;
}

const BAD_POSTURE_BEEP_INTERVAL_MS = 5000;
const VOICE_ANNOUNCE_THRESHOLD_MS = 15000;
const VOICE_ANNOUNCE_INTERVAL_MS = 20000;
const SMOOTHING_FRAMES = 8;
// Detection runs ~10 fps in foreground, ~2 fps when tab/window is hidden.
// Posture changes slowly; >10 fps wastes CPU/GPU without changing UX.
const FOREGROUND_DETECT_INTERVAL_MS = 100;
const BACKGROUND_DETECT_INTERVAL_MS = 500;
const ALERT_TONE_STORAGE_KEY = "postureguard.alertTone";

// In a packaged Electron app the page is loaded via file:// — in that case
// prefer the locally bundled WASM + model so the app works offline.
// In dev/web fall back to the CDN.
const WASM_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_CDN =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";
const WASM_LOCAL = "./wasm";
const MODEL_LOCAL = "./models/pose_landmarker_lite.task";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.electronAPI?.isElectron) return true;
  return window.location.protocol === "file:";
}

function loadStoredTone(): AlertTone {
  if (typeof window === "undefined") return "beep";
  const stored = window.localStorage.getItem(ALERT_TONE_STORAGE_KEY);
  if (stored && stored in ALERT_TONE_LABELS) return stored as AlertTone;
  return "beep";
}

export function usePostureMonitor() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const detectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastBeepRef = useRef<number>(0);
  const lastVoiceRef = useRef<number>(0);
  const resultsBufferRef = useRef<PostureResult[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const dutyCycleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = useRef(false);
  const detectFnRef = useRef<(() => void) | null>(null);
  const alertToneRef = useRef<AlertTone>(loadStoredTone());
  const drawingUtilsRef = useRef<DrawingUtils | null>(null);
  const sessionStatsRef = useRef<SessionStats | null>(null);
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
  const [alertTone, setAlertTone] = useState<AlertTone>(loadStoredTone);
  const [alertsPaused, setAlertsPaused] = useState(false);
  const alertsPausedRef = useRef(false);
  const badStartRef = useRef<number | null>(null);

  useEffect(() => {
    alertsPausedRef.current = alertsPaused;
  }, [alertsPaused]);

  const toggleAlertsPaused = useCallback(() => {
    setAlertsPaused((p) => !p);
  }, []);

  useEffect(() => {
    alertToneRef.current = alertTone;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ALERT_TONE_STORAGE_KEY, alertTone);
    }
  }, [alertTone]);

  const ensureAudioContext = useCallback((): AudioContext => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === "suspended") {
      void audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  const playAlert = useCallback(() => {
    const ctx = ensureAudioContext();

    const tone = (freq: number, dur: number, vol: number, type: OscillatorType = "sine", startOffset = 0) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startOffset);
      gain.gain.setValueAtTime(vol, ctx.currentTime + startOffset);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startOffset + dur);
      osc.start(ctx.currentTime + startOffset);
      osc.stop(ctx.currentTime + startOffset + dur + 0.01);
    };

    switch (alertToneRef.current) {
      case "beep":
        tone(880, 0.25, 0.5);
        tone(660, 0.25, 0.4, "sine", 0.3);
        break;
      case "ding":
        tone(1047, 0.9, 0.6);
        tone(2093, 0.5, 0.15, "sine", 0.01);
        break;
      case "chime":
        tone(523, 0.35, 0.5);
        tone(659, 0.35, 0.45, "sine", 0.2);
        tone(784, 0.55, 0.4, "sine", 0.4);
        break;
      case "chirp": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.18);
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.23);
        break;
      }
      case "buzz":
        tone(300, 0.08, 0.45, "square");
        tone(300, 0.08, 0.45, "square", 0.15);
        tone(300, 0.08, 0.45, "square", 0.3);
        break;
    }
  }, [ensureAudioContext]);

  const speak = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, []);

  const fireAlerts = useCallback((elapsed: number, now: number) => {
    if (now - lastBeepRef.current > BAD_POSTURE_BEEP_INTERVAL_MS) {
      lastBeepRef.current = now;
      playAlert();
    }
    if (elapsed > VOICE_ANNOUNCE_THRESHOLD_MS && now - lastVoiceRef.current > VOICE_ANNOUNCE_INTERVAL_MS) {
      lastVoiceRef.current = now;
      speak("Please correct your posture.");
    }
  }, [playAlert, speak]);

  const smoothedResult = useCallback((newResult: PostureResult): PostureResult => {
    const buf = resultsBufferRef.current;
    buf.push(newResult);
    if (buf.length > SMOOTHING_FRAMES) buf.shift();
    const badCount = buf.filter((r) => r.status === "bad").length;
    const goodCount = buf.filter((r) => r.status === "good").length;

    // Pick the most-common activity over the buffer so single-frame
    // misdetections (a wrist briefly near an ear, head turning) don't
    // toggle the UI badge or suppress alerts unexpectedly.
    const activityCounts: Record<string, number> = {};
    buf.forEach((r) => {
      activityCounts[r.activity] = (activityCounts[r.activity] ?? 0) + 1;
    });
    const dominantActivity = (Object.entries(activityCounts).reduce(
      (best, cur) => (cur[1] > best[1] ? cur : best),
      ["working", 0]
    )[0]) as PostureResult["activity"];

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
      const standalone = isStandalone();
      const vision = await FilesetResolver.forVisionTasks(standalone ? WASM_LOCAL : WASM_CDN);
      landmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: standalone ? MODEL_LOCAL : MODEL_CDN,
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
      });

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
            const raw = analyzePosture(detection.landmarks[0]);
            const smoothed = smoothedResult(raw);
            setResult(smoothed);

            const now = Date.now();
            const stats = sessionStatsRef.current;
            if (stats) {
              const dt = now - stats.lastTickAt;
              stats.lastTickAt = now;
              // Don't accumulate time the user spent away from the desk —
              // it would inflate the session length and skew the bad-%
              // calculations in insights.
              if (smoothed.activity !== "away") {
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
            // someone, or away from the desk — but still track bad posture
            // duration so insights stay accurate.
            const suppressAlerts =
              alertsPausedRef.current ||
              smoothed.activity === "phone_call" ||
              smoothed.activity === "talking_to_someone" ||
              smoothed.activity === "away";

            if (smoothed.status === "bad") {
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

    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      void audioCtxRef.current.close();
    }
    audioCtxRef.current = null;
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
    alertTone,
    setAlertTone,
    alertsPaused,
    toggleAlertsPaused,
    playAlert,
    speak,
    sessionsVersion,
    startMonitoring,
    stopMonitoring,
    startDutyCycle,
    stopDutyCycle,
  };
}
