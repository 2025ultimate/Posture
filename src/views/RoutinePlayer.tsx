import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ProgramLevel, RoutineStep } from "../apt/program";
import { buildSteps, STEP_PREP_SECONDS } from "../apt/program";
import { CATEGORY_LABELS, schemeLabel } from "../apt/exercises";
import {
  completeLine,
  finalPushLine,
  halfwayLine,
  praiseLine,
  startLine,
} from "../apt/motivation";
import type { AudioCues } from "../useAudioCues";
import { ExerciseFigure } from "./ExerciseFigure";
import { IconPause, IconPlay } from "./Icons";

// Full-screen guided routine player: prep countdown → work timer for each
// step, chimes on transitions, optional voice coaching, and a wake lock so
// a phone on the floor next to you doesn't sleep mid-set.

export interface RoutineOutcome {
  completedSteps: number;
  totalSteps: number;
  minutes: number;
}

interface RoutinePlayerProps {
  level: ProgramLevel;
  audio: AudioCues;
  /** The streak count today's completion will produce (for the send-off). */
  streakDays: number;
  voiceOn: boolean;
  setVoiceOn: (on: boolean) => void;
  onExit: (outcome: RoutineOutcome | null) => void;
}

type Phase = "prep" | "work" | "finished";

function RoutinePlayerInner({
  level,
  audio,
  streakDays,
  voiceOn,
  setVoiceOn,
  onExit,
}: RoutinePlayerProps) {
  const steps = useMemo(() => buildSteps(level), [level]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("prep");
  const [secondsLeft, setSecondsLeft] = useState(STEP_PREP_SECONDS);
  const [paused, setPaused] = useState(false);
  const [skipped, setSkipped] = useState(0);
  const [finishedMinutes, setFinishedMinutes] = useState(1);
  const startedAtRef = useRef(0);
  const announcedRef = useRef(-1);
  // Set when a step was completed (not skipped) so the next announcement
  // opens with a word of praise.
  const praiseNextRef = useRef(false);

  useEffect(() => {
    startedAtRef.current = Date.now();
  }, []);

  const step: RoutineStep | undefined = steps[index];
  const total = steps.length;

  // Keep the screen awake while the routine runs (phone on the floor).
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        const nav = navigator as Navigator & {
          wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> };
        };
        if (nav.wakeLock) {
          lock = await nav.wakeLock.request("screen");
          if (cancelled) void lock.release();
        }
      } catch {
        // Not available or denied — fine.
      }
    };
    void request();
    const onVis = () => {
      if (!document.hidden) void request();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      if (lock) void lock.release();
    };
  }, []);

  // Announce the step once, at the start of its prep phase — with a warm
  // opener on the first step and a word of praise after a completed one.
  useEffect(() => {
    if (!step || phase !== "prep" || announcedRef.current === index) return;
    announcedRef.current = index;
    if (voiceOn) {
      const opener =
        index === 0 ? `${startLine()} ` : praiseNextRef.current ? `${praiseLine()} ` : "";
      praiseNextRef.current = false;
      const sideText = step.side ? `, ${step.side} side` : "";
      const setText =
        step.totalSets > 1 ? `, set ${step.set} of ${step.totalSets}` : "";
      audio.speak(
        `${opener}${step.exercise.name}${sideText}${setText}. ${step.exercise.cues[0]}`
      );
    } else {
      praiseNextRef.current = false;
    }
  }, [step, phase, index, voiceOn, audio]);

  const advance = useCallback(
    (wasSkipped: boolean) => {
      audio.stopSpeaking();
      if (wasSkipped) setSkipped((s) => s + 1);
      else praiseNextRef.current = true;
      if (index + 1 >= total) {
        setFinishedMinutes(
          Math.max(1, Math.round((Date.now() - startedAtRef.current) / 60000))
        );
        setPhase("finished");
        audio.playSuccess();
        if (voiceOn) audio.speak(completeLine(streakDays));
        return;
      }
      setIndex(index + 1);
      setPhase("prep");
      setSecondsLeft(STEP_PREP_SECONDS);
    },
    [audio, index, total, voiceOn, streakDays]
  );

  // Core ticker — with mid-hold encouragement on longer steps.
  useEffect(() => {
    if (paused || phase === "finished" || !step) return;
    const id = setTimeout(() => {
      if (secondsLeft > 1) {
        const next = secondsLeft - 1;
        if (phase === "work" && voiceOn) {
          if (step.workSeconds >= 45 && next === Math.ceil(step.workSeconds / 2)) {
            audio.speak(halfwayLine());
          } else if (step.workSeconds >= 25 && next === 7) {
            audio.speak(finalPushLine());
          }
        }
        if (phase === "work" && secondsLeft <= 4) audio.playTick();
        setSecondsLeft(next);
        return;
      }
      if (phase === "prep") {
        audio.playStep();
        setPhase("work");
        setSecondsLeft(step.workSeconds);
      } else {
        advance(false);
      }
    }, 1000);
    return () => clearTimeout(id);
  }, [paused, phase, secondsLeft, step, advance, audio, voiceOn]);

  const goBack = () => {
    audio.stopSpeaking();
    if (phase === "work") {
      setPhase("prep");
      setSecondsLeft(STEP_PREP_SECONDS);
      announcedRef.current = -1;
      return;
    }
    if (index > 0) {
      setIndex(index - 1);
      setPhase("prep");
      setSecondsLeft(STEP_PREP_SECONDS);
      announcedRef.current = -1;
    }
  };

  const quit = () => {
    audio.stopSpeaking();
    const progressed = index > 0 || phase === "work";
    if (
      progressed &&
      phase !== "finished" &&
      !window.confirm("Leave the routine? Progress today won't be saved.")
    ) {
      return;
    }
    onExit(null);
  };

  const finish = () => {
    onExit({
      completedSteps: total - skipped,
      totalSteps: total,
      minutes: finishedMinutes,
    });
  };

  if (phase === "finished") {
    return (
      <div className="player">
        <div className="player-finished">
          <div className="player-finished-icon" aria-hidden="true">
            <svg width="72" height="72" viewBox="0 0 56 56" fill="none">
              <circle cx="28" cy="28" r="28" fill="#16a34a22" />
              <path
                d="M16 28l9 9 15-18"
                stroke="#22c55e"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2>Routine complete</h2>
          <p className="player-finished-sub">
            {total - skipped} of {total} steps · about {finishedMinutes} min ·{" "}
            {level.name}
          </p>
          <p className="player-finished-note">
            The change comes from showing up again tomorrow — same time works
            best.
          </p>
          <button className="btn btn-primary player-finish-btn" onClick={finish}>
            Save &amp; finish
          </button>
        </div>
      </div>
    );
  }

  if (!step) return null;

  const workTotal = phase === "work" ? step.workSeconds : STEP_PREP_SECONDS;
  const progressPct = ((workTotal - secondsLeft) / workTotal) * 100;
  const next = steps[index + 1];

  return (
    <div className="player">
      <div className="player-top">
        <button className="player-close" onClick={quit} aria-label="Exit routine">
          ✕
        </button>
        <div className="player-progress">
          <div className="player-progress-label">
            Step {index + 1} / {total} · {level.name}
          </div>
          <div className="player-progress-track">
            <div
              className="player-progress-fill"
              style={{ width: `${((index + (phase === "work" ? 0.5 : 0)) / total) * 100}%` }}
            />
          </div>
        </div>
        <button
          className={`player-voice ${voiceOn ? "player-voice-on" : ""}`}
          onClick={() => {
            if (voiceOn) audio.stopSpeaking();
            setVoiceOn(!voiceOn);
          }}
          title={voiceOn ? "Voice coach on" : "Voice coach off"}
        >
          {voiceOn ? "Voice on" : "Voice off"}
        </button>
      </div>

      <div className="player-body">
        <span className={`player-cat player-cat-${step.exercise.category}`}>
          {CATEGORY_LABELS[step.exercise.category]}
        </span>
        <h2 className="player-exercise">
          {step.exercise.name}
          {step.side && <span className="player-side"> · {step.side} side</span>}
        </h2>
        <p className="player-scheme">
          {schemeLabel(step.exercise.scheme)}
          {step.totalSets > 1 && ` — set ${step.set} of ${step.totalSets}`}
        </p>

        <ExerciseFigure id={step.exercise.id} size={190} />

        <div className={`player-timer ${phase === "prep" ? "player-timer-prep" : ""}`}>
          <div className="player-timer-ring">
            <svg viewBox="0 0 120 120" width="200" height="200" aria-hidden="true">
              <circle cx="60" cy="60" r="52" fill="none" stroke="var(--track-bg)" strokeWidth="8" />
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke={phase === "prep" ? "#f59e0b" : "#22c55e"}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${(progressPct / 100) * 326.7} 326.7`}
                transform="rotate(-90 60 60)"
                style={{ transition: "stroke-dasharray 1s linear" }}
              />
            </svg>
            <div className="player-timer-num">
              <span className="player-timer-value">{secondsLeft}</span>
              <span className="player-timer-phase">
                {phase === "prep" ? "get ready" : step.estimated ? "≈ own pace" : "seconds"}
              </span>
            </div>
          </div>
        </div>

        <ul className="player-cues">
          {step.exercise.cues.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
          {step.exercise.mistake && (
            <li className="player-mistake">Avoid: {step.exercise.mistake}</li>
          )}
        </ul>

        {next ? (
          <p className="player-next">
            Next: {next.exercise.name}
            {next.side ? ` (${next.side})` : ""}
            {next.totalSets > 1 ? ` — set ${next.set}` : ""}
          </p>
        ) : (
          <p className="player-next">Last step — finish strong.</p>
        )}
      </div>

      <div className="player-controls">
        <button className="btn btn-secondary" onClick={goBack}>
          Back
        </button>
        <button
          className="btn btn-primary player-pause"
          onClick={() => setPaused(!paused)}
        >
          {paused ? <IconPlay /> : <IconPause />}
          {paused ? "Resume" : "Pause"}
        </button>
        <button className="btn btn-secondary" onClick={() => advance(true)}>
          Skip
        </button>
      </div>
    </div>
  );
}

// Memoized: the app root re-renders ~10×/s while desk monitoring runs.
export const RoutinePlayer = memo(RoutinePlayerInner);
