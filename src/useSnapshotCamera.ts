import { useCallback, useEffect, useRef, useState } from "react";
import type { PoseLandmarker, NormalizedLandmark } from "@mediapipe/tasks-vision";
import { createPoseLandmarker } from "./poseAssets";
import {
  analyzeSideView,
  interpretMetrics,
  medianMetrics,
} from "./apt/sideView";
import type {
  AlignmentFinding,
  FramingIssue,
  SideViewMetrics,
} from "./apt/sideView";

// Camera flow for the side-view posture check: live preview with framing
// guidance → countdown (so the user can prop the phone and step back) →
// a ~2-second burst of frames → median metrics. Only numbers are kept;
// no image is ever stored.

export type SnapshotState =
  | "idle"
  | "starting"
  | "live"
  | "counting"
  | "capturing"
  | "done"
  | "error";

export type Facing = "user" | "environment";

export interface SnapshotResult {
  metrics: SideViewMetrics;
  findings: AlignmentFinding[];
  score: number;
  summary: string;
  frames: number;
}

const LIVE_INTERVAL_MS = 120;
const CAPTURE_TARGET_FRAMES = 12;
const CAPTURE_MIN_FRAMES = 6;
const CAPTURE_TIMEOUT_MS = 4000;

// Landmark chain drawn on the final frame: ear→shoulder→hip→knee→ankle.
const CHAIN = {
  left: [7, 11, 23, 25, 27],
  right: [8, 12, 24, 26, 28],
};

interface SnapshotAudio {
  playTick: () => void;
  playStep: () => void;
  playSuccess: () => void;
}

export function useSnapshotCamera(audio: SnapshotAudio) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The detection loop re-schedules itself through this ref so the
  // callback can be recreated without self-referencing its own binding.
  const loopRef = useRef<() => void>(() => {});
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef<SnapshotState>("idle");
  const facingRef = useRef<Facing>("user");
  const captureBufferRef = useRef<SideViewMetrics[]>([]);
  const captureStartedAtRef = useRef(0);
  const lastLandmarksRef = useRef<NormalizedLandmark[] | null>(null);
  const audioRef = useRef(audio);

  const [state, setState] = useState<SnapshotState>("idle");
  const [facing, setFacing] = useState<Facing>("user");
  const [guidance, setGuidance] = useState<FramingIssue | "ok">("no_person");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [result, setResult] = useState<SnapshotResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    audioRef.current = audio;
  }, [audio]);

  const setPhase = useCallback((s: SnapshotState) => {
    phaseRef.current = s;
    setState(s);
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const stopLoop = useCallback(() => {
    if (loopTimerRef.current) clearTimeout(loopTimerRef.current);
    loopTimerRef.current = null;
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = null;
  }, []);

  const drawFrame = useCallback(
    (landmarks: NormalizedLandmark[] | null, final: boolean) => {
      const video = videoRef.current;
      const canvas = overlayRef.current;
      if (!video || !canvas || video.videoWidth === 0) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const mirror = facingRef.current === "user";

      ctx.save();
      if (mirror) {
        ctx.scale(-1, 1);
        ctx.translate(-canvas.width, 0);
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      if (!landmarks) return;
      const pts = landmarks.map((lm) => ({
        x: (mirror ? 1 - lm.x : lm.x) * canvas.width,
        y: lm.y * canvas.height,
        v: lm.visibility ?? 1,
      }));

      const analysis = analyzeSideView(landmarks);
      const side = analysis.ok ? analysis.metrics.side : null;
      const chain = side ? CHAIN[side] : null;

      if (chain) {
        // Plumb line up from the ankle — the reference the body should stack over.
        const ankle = pts[chain[4]];
        ctx.strokeStyle = final ? "rgba(148, 197, 255, 0.9)" : "rgba(148, 197, 255, 0.45)";
        ctx.setLineDash([8, 8]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ankle.x, canvas.height * 0.03);
        ctx.lineTo(ankle.x, ankle.y + 14);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.strokeStyle = final ? "#22d3ee" : "rgba(34, 211, 238, 0.75)";
        ctx.lineWidth = final ? 4 : 3;
        ctx.beginPath();
        chain.forEach((idx, i) => {
          const p = pts[idx];
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();

        for (const idx of chain) {
          const p = pts[idx];
          ctx.fillStyle = "#f472b6";
          ctx.beginPath();
          ctx.arc(p.x, p.y, final ? 7 : 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
    []
  );

  const finishCapture = useCallback(() => {
    stopLoop();
    const frames = captureBufferRef.current;
    if (frames.length < CAPTURE_MIN_FRAMES) {
      // Not enough clean frames — back to live so the user can adjust.
      captureBufferRef.current = [];
      setError(
        "Couldn't get a stable reading — check the framing and try again."
      );
      setPhase("live");
      return;
    }
    const metrics = medianMetrics(frames);
    const interpreted = interpretMetrics(metrics);
    // Freeze the last analyzed frame with a bold overlay, then release
    // the camera. The pixels never leave this canvas.
    drawFrame(lastLandmarksRef.current, true);
    stopStream();
    setResult({ metrics, ...interpreted, frames: frames.length });
    audioRef.current.playSuccess();
    setPhase("done");
  }, [drawFrame, setPhase, stopLoop, stopStream]);

  const loop = useCallback(() => {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    const phase = phaseRef.current;
    if (!video || !landmarker) return;
    if (phase !== "live" && phase !== "counting" && phase !== "capturing") return;

    if (video.readyState >= 2) {
      const detection = landmarker.detectForVideo(video, performance.now());
      const landmarks = detection.landmarks?.[0] ?? null;
      lastLandmarksRef.current = landmarks;
      drawFrame(landmarks, false);

      const analysis = landmarks
        ? analyzeSideView(landmarks)
        : ({ ok: false, issue: "no_person" } as const);
      setGuidance(analysis.ok ? "ok" : analysis.issue);

      if (phase === "capturing") {
        if (analysis.ok) captureBufferRef.current.push(analysis.metrics);
        const enough =
          captureBufferRef.current.length >= CAPTURE_TARGET_FRAMES;
        const timedOut =
          Date.now() - captureStartedAtRef.current > CAPTURE_TIMEOUT_MS;
        if (enough || timedOut) {
          finishCapture();
          return;
        }
      }
    }

    loopTimerRef.current = setTimeout(() => loopRef.current(), LIVE_INTERVAL_MS);
  }, [drawFrame, finishCapture]);

  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);

  const start = useCallback(
    async (nextFacing?: Facing) => {
      const face = nextFacing ?? facingRef.current;
      facingRef.current = face;
      setFacing(face);
      setError("");
      setResult(null);
      captureBufferRef.current = [];
      setPhase("starting");
      try {
        if (!landmarkerRef.current) {
          landmarkerRef.current = await createPoseLandmarker();
        }
        stopStream();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 720 },
            height: { ideal: 1280 },
            facingMode: { ideal: face },
          },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setPhase("live");
        stopLoop();
        loopTimerRef.current = setTimeout(() => loopRef.current(), LIVE_INTERVAL_MS);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
        setPhase("error");
      }
    },
    [setPhase, stopLoop, stopStream]
  );

  const flip = useCallback(() => {
    void start(facingRef.current === "user" ? "environment" : "user");
  }, [start]);

  const beginCapture = useCallback(
    (delaySec: number) => {
      if (phaseRef.current !== "live") return;
      setError("");
      captureBufferRef.current = [];
      setPhase("counting");
      let remaining = delaySec;
      setCountdown(remaining);
      audioRef.current.playTick();
      countdownTimerRef.current = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
          setCountdown(null);
          audioRef.current.playStep();
          captureStartedAtRef.current = Date.now();
          setPhase("capturing");
        } else {
          setCountdown(remaining);
          audioRef.current.playTick();
        }
      }, 1000);
    },
    [setPhase]
  );

  const cancelCapture = useCallback(() => {
    if (phaseRef.current !== "counting" && phaseRef.current !== "capturing") return;
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = null;
    setCountdown(null);
    captureBufferRef.current = [];
    setPhase("live");
  }, [setPhase]);

  const stop = useCallback(() => {
    stopLoop();
    stopStream();
    setCountdown(null);
    captureBufferRef.current = [];
    setPhase("idle");
  }, [setPhase, stopLoop, stopStream]);

  /** After "done": discard the result and go live again for a re-take. */
  const retake = useCallback(() => {
    setResult(null);
    void start();
  }, [start]);

  useEffect(
    () => () => {
      stopLoop();
      stopStream();
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    },
    [stopLoop, stopStream]
  );

  return {
    videoRef,
    overlayRef,
    state,
    facing,
    guidance,
    countdown,
    result,
    error,
    start,
    stop,
    flip,
    beginCapture,
    cancelCapture,
    retake,
  };
}
