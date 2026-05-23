import { useRef, useState, useCallback, useEffect } from "react";
import { PoseLandmarker, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision";
import { analyzePosture } from "./postureAnalysis";
import type { PostureResult } from "./postureAnalysis";

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
const BACKGROUND_DETECT_INTERVAL_MS = 500;

export function usePostureMonitor() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const animFrameRef = useRef<number>(0);
  const backgroundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastBeepRef = useRef<number>(0);
  const lastVoiceRef = useRef<number>(0);
  const resultsBufferRef = useRef<PostureResult[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const dutyCycleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = useRef(false);
  const detectFnRef = useRef<(() => void) | null>(null);
  const alertToneRef = useRef<AlertTone>("beep");

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
  const [alertTone, setAlertTone] = useState<AlertTone>("beep");
  const badStartRef = useRef<number | null>(null);

  useEffect(() => {
    alertToneRef.current = alertTone;
  }, [alertTone]);

  const playAlert = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    const ctx = audioCtxRef.current;

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
        // Bell-like: pure sine, long slow decay
        tone(1047, 0.9, 0.6);
        tone(2093, 0.5, 0.15, "sine", 0.01);
        break;
      case "chime":
        // C-E-G ascending musical chime
        tone(523, 0.35, 0.5);
        tone(659, 0.35, 0.45, "sine", 0.2);
        tone(784, 0.55, 0.4, "sine", 0.4);
        break;
      case "chirp": {
        // Ascending frequency sweep
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
        // Three short square-wave pulses
        tone(300, 0.08, 0.45, "square");
        tone(300, 0.08, 0.45, "square", 0.15);
        tone(300, 0.08, 0.45, "square", 0.3);
        break;
    }
  }, []);

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
    if (buf.length < SMOOTHING_FRAMES / 2) return newResult;
    if (badCount > goodCount) return newResult;
    return { ...newResult, status: "good", issues: [] };
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
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm"
      );
      landmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
      });

      await startCamera();

      setState("running");
      runningRef.current = true;

      let lastTime = -1;

      const detect = () => {
        if (!runningRef.current || !landmarkerRef.current || !videoRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (video.readyState >= 2 && video.currentTime !== lastTime) {
          lastTime = video.currentTime;

          if (canvas) {
            const ctx = canvas.getContext("2d")!;
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;

            ctx.save();
            ctx.scale(-1, 1);
            ctx.translate(-canvas.width, 0);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            ctx.restore();

            const timestamp = performance.now();
            const detection = landmarkerRef.current!.detectForVideo(video, timestamp);

            if (detection.landmarks && detection.landmarks.length > 0) {
              const landmarks = detection.landmarks[0];
              const mirroredLandmarks = landmarks.map((lm) => ({ ...lm, x: 1 - lm.x }));

              const drawingUtils = new DrawingUtils(ctx);
              drawingUtils.drawConnectors(mirroredLandmarks, PoseLandmarker.POSE_CONNECTIONS, {
                color: "#00e5ff",
                lineWidth: 2,
              });
              drawingUtils.drawLandmarks(mirroredLandmarks, {
                color: "#ff4081",
                radius: 4,
              });

              const raw = analyzePosture(landmarks);
              const smoothed = smoothedResult(raw);
              setResult(smoothed);

              const now = Date.now();
              if (smoothed.status === "bad") {
                if (badStartRef.current === null) badStartRef.current = now;
                const elapsed = now - badStartRef.current;
                setBadDuration(Math.floor(elapsed / 1000));
                fireAlerts(elapsed, now);
              } else if (smoothed.status === "good") {
                if (badStartRef.current !== null) {
                  badStartRef.current = null;
                  setBadDuration(0);
                }
              }
            } else {
              setResult({
                status: "unknown",
                issues: ["No person detected"],
                scores: { neckTilt: 0, shoulderLevel: 0, forwardHead: 0, eyeLevel: 0 },
              });
            }
          } else {
            // Background mode: no canvas, just detect and alert
            const timestamp = performance.now();
            const detection = landmarkerRef.current!.detectForVideo(video, timestamp);
            if (detection.landmarks && detection.landmarks.length > 0) {
              const raw = analyzePosture(detection.landmarks[0]);
              const smoothed = smoothedResult(raw);
              setResult(smoothed);

              const now = Date.now();
              if (smoothed.status === "bad") {
                if (badStartRef.current === null) badStartRef.current = now;
                const elapsed = now - badStartRef.current;
                setBadDuration(Math.floor(elapsed / 1000));
                fireAlerts(elapsed, now);
              } else if (smoothed.status === "good") {
                if (badStartRef.current !== null) {
                  badStartRef.current = null;
                  setBadDuration(0);
                }
              }
            }
          }
        }

        scheduleNext();
      };

      const scheduleNext = () => {
        if (!runningRef.current) return;
        if (document.hidden) {
          backgroundTimerRef.current = setTimeout(detect, BACKGROUND_DETECT_INTERVAL_MS);
        } else {
          animFrameRef.current = requestAnimationFrame(detect);
        }
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
    cancelAnimationFrame(animFrameRef.current);
    if (backgroundTimerRef.current) clearTimeout(backgroundTimerRef.current);
    if (dutyCycleTimerRef.current) clearTimeout(dutyCycleTimerRef.current);
    stopCamera();
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
    resultsBufferRef.current = [];
    badStartRef.current = null;
    detectFnRef.current = null;
    setBadDuration(0);
    setResult(null);
    setCameraPhase("always");
    setState("idle");
  }, [stopCamera]);

  // Handle visibility change: switch between rAF and setTimeout
  useEffect(() => {
    const handleVisibility = () => {
      if (!runningRef.current || !detectFnRef.current) return;
      if (document.hidden) {
        cancelAnimationFrame(animFrameRef.current);
        backgroundTimerRef.current = setTimeout(detectFnRef.current, BACKGROUND_DETECT_INTERVAL_MS);
      } else {
        if (backgroundTimerRef.current) clearTimeout(backgroundTimerRef.current);
        animFrameRef.current = requestAnimationFrame(detectFnRef.current);
      }
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
    playAlert,
    startMonitoring,
    stopMonitoring,
    startDutyCycle,
    stopDutyCycle,
  };
}
