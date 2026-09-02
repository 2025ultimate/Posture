import { useCallback, useEffect, useRef, useState } from "react";
import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import { createPoseLandmarker } from "./poseAssets";
import { drawCameraFrame } from "./cameraDraw";
import { analyzeSideView } from "./apt/sideView";
import type { SideViewMetrics } from "./apt/sideView";
import { medianMetrics } from "./apt/sideView";
import { createCoachSession } from "./apt/liveCoach";
import type { CoachUi } from "./apt/liveCoach";
import type { AudioCues } from "./useAudioCues";
import type { Facing } from "./useSnapshotCamera";

// Camera + evaluation loop for the live standing-posture coach. Detection
// runs ~8 fps; metrics are medianed over a rolling ~2s window and handed
// to the coaching engine twice a second. All speech respects the global
// voice-coach toggle at call time.

export type LiveCoachState = "idle" | "starting" | "live" | "error";

const LOOP_MS = 130;
const UI_TICK_MS = 500;
const WINDOW_MS = 2200;
const MIN_WINDOW_FRAMES = 6;

export function useLiveCoach(audio: AudioCues, voiceOn: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loopRef = useRef<() => void>(() => {});
  const stateRef = useRef<LiveCoachState>("idle");
  const facingRef = useRef<Facing>("user");
  const sessionRef = useRef<ReturnType<typeof createCoachSession> | null>(null);
  const windowRef = useRef<{ t: number; m: SideViewMetrics }[]>([]);
  const lastUiTickRef = useRef(0);
  const voiceOnRef = useRef(voiceOn);
  const audioRef = useRef(audio);

  const [state, setState] = useState<LiveCoachState>("idle");
  const [facing, setFacing] = useState<Facing>("user");
  const [ui, setUi] = useState<CoachUi | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    voiceOnRef.current = voiceOn;
  }, [voiceOn]);
  useEffect(() => {
    audioRef.current = audio;
  }, [audio]);

  const setPhase = useCallback((s: LiveCoachState) => {
    stateRef.current = s;
    setState(s);
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const loop = useCallback(() => {
    const video = videoRef.current;
    const canvas = overlayRef.current;
    const landmarker = landmarkerRef.current;
    if (stateRef.current !== "live" || !video || !canvas || !landmarker) return;

    if (video.readyState >= 2) {
      const detection = landmarker.detectForVideo(video, performance.now());
      const landmarks = detection.landmarks?.[0] ?? null;
      drawCameraFrame(video, canvas, landmarks, facingRef.current === "user", false);

      const now = Date.now();
      const analysis = landmarks
        ? analyzeSideView(landmarks)
        : ({ ok: false, issue: "no_person" } as const);

      const win = windowRef.current;
      if (analysis.ok) win.push({ t: now, m: analysis.metrics });
      while (win.length > 0 && now - win[0].t > WINDOW_MS) win.shift();

      if (now - lastUiTickRef.current >= UI_TICK_MS && sessionRef.current) {
        lastUiTickRef.current = now;
        const metrics =
          win.length >= MIN_WINDOW_FRAMES
            ? medianMetrics(win.map((w) => w.m))
            : null;
        const nextUi = sessionRef.current.tick({
          now,
          framing: analysis.ok ? "ok" : analysis.issue,
          metrics,
        });
        setUi(nextUi);
      }
    }

    timerRef.current = setTimeout(() => loopRef.current(), LOOP_MS);
  }, []);

  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);

  const start = useCallback(
    async (nextFacing?: Facing) => {
      const face = nextFacing ?? facingRef.current;
      facingRef.current = face;
      setFacing(face);
      setError("");
      setUi(null);
      windowRef.current = [];
      lastUiTickRef.current = 0;
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
        // Fresh coaching session per start; voice checked at speak time so
        // the toggle applies instantly mid-session.
        sessionRef.current = createCoachSession({
          speak: (line) => {
            if (voiceOnRef.current) audioRef.current.speak(line);
          },
          celebrate: () => audioRef.current.playSuccess(),
        });
        setPhase("live");
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => loopRef.current(), LOOP_MS);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
        setPhase("error");
      }
    },
    [setPhase, stopStream]
  );

  const flip = useCallback(() => {
    void start(facingRef.current === "user" ? "environment" : "user");
  }, [start]);

  const stop = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    stopStream();
    sessionRef.current = null;
    windowRef.current = [];
    audioRef.current.stopSpeaking();
    setUi(null);
    setPhase("idle");
  }, [setPhase, stopStream]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      stopStream();
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    },
    [stopStream]
  );

  return { videoRef, overlayRef, state, facing, ui, error, start, stop, flip };
}
