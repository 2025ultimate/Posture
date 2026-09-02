import { useCallback, useEffect, useRef, useState } from "react";
import type { PoseLandmarker, NormalizedLandmark } from "@mediapipe/tasks-vision";
import { createPoseLandmarker } from "./poseAssets";
import { drawCameraFrame } from "./cameraDraw";
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
      if (!video || !canvas) return;
      drawCameraFrame(video, canvas, landmarks, facingRef.current === "user", final);
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
