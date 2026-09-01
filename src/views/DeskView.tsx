import { useEffect, useState } from "react";
import { useNow } from "../useNow";
import type { usePostureMonitor } from "../usePostureMonitor";
import type { useHabitReminders } from "../useHabitReminders";
import type { useSittingCoach } from "../useSittingCoach";
import { HABIT_INFO } from "../useHabitReminders";
import type { HabitKey, HabitMode } from "../useHabitReminders";
import type { AudioCues } from "../useAudioCues";
import { ALERT_TONE_LABELS } from "../useAudioCues";
import type { AlertTone } from "../useAudioCues";
import { EXERCISES, exerciseVideoQuery, MICRO_BREAK_IDS, setSeconds } from "../apt/exercises";
import { breakPraiseLine } from "../apt/motivation";
import { DemoLink } from "./DemoLink";
import { ExerciseFigure } from "./ExerciseFigure";

// The desk companion. Honest scope for APT: a front-facing webcam can't
// see your pelvis while you sit — what it CAN do is (1) watch the
// upper-body posture it does see, and (2) know whether you're at the desk,
// which powers the part that actually moves the needle for anterior tilt:
// breaking up continuous sitting before the hip flexors set.

const ACTIVITY_LABELS: Record<string, { label: string; desc: string }> = {
  working: { label: "Working", desc: "Monitoring posture" },
  phone_call: { label: "On a call", desc: "Alerts paused while on phone" },
  phone_browsing: { label: "On phone", desc: "Alerts paused — looking at phone" },
  writing: { label: "Writing", desc: "Head-down work detected" },
  talking_to_someone: { label: "Talking", desc: "Alerts paused while talking" },
  away: { label: "Away", desc: "Not in front of screen" },
};

interface DeskViewProps {
  monitor: ReturnType<typeof usePostureMonitor>;
  habits: ReturnType<typeof useHabitReminders>;
  sittingCoach: ReturnType<typeof useSittingCoach>;
  audio: AudioCues;
}

export function DeskView({ monitor, habits, sittingCoach, audio }: DeskViewProps) {
  const {
    videoRef, canvasRef, state, result, error, badDuration,
    cameraPhase, dutyCycle, alertsPaused, toggleAlertsPaused,
    isMoving, alertCooldownUntil,
    startMonitoring, stopMonitoring, startDutyCycle, stopDutyCycle,
  } = monitor;

  const [onMin, setOnMin] = useState(0.5);
  const [offMin, setOffMin] = useState(1);
  const [showSettings, setShowSettings] = useState(false);

  const activity = result?.activity ?? "working";
  const activityInfo = ACTIVITY_LABELS[activity];
  const showActivityBadge =
    state === "running" && activity !== "working" && cameraPhase !== "off";

  // Spacebar toggles pause when monitoring is active so users can react
  // instantly to a meeting starting without aiming for the button.
  useEffect(() => {
    if (state !== "running") return;
    const handler = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      e.preventDefault();
      toggleAlertsPaused();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [state, toggleAlertsPaused]);

  const statusLabel = result?.status === "good" ? "Good Posture" : result?.status === "bad" ? "Poor Posture" : "Analyzing...";
  const statusColor = result?.status === "good" ? "#22c55e" : result?.status === "bad" ? "#ef4444" : "#64748b";
  const scores = result?.scores;

  const handleToggleDutyCycle = () => {
    if (dutyCycle.enabled) {
      stopDutyCycle();
    } else {
      startDutyCycle(Math.max(5, onMin * 60), Math.max(5, offMin * 60));
    }
  };

  return (
    <div className="view desk-view">
      <div className="view-head desk-head">
        <div>
          <h1 className="view-title">Desk guard</h1>
          <p className="view-sub">
            Live upper-body posture plus the sitting-break coach — the desk
            half of fixing a tilt.
          </p>
        </div>
        {state === "running" && (
          <div className="desk-head-badges">
            <div className={`live-badge ${alertsPaused ? "live-badge-muted" : ""}`}>
              <span className="live-dot" />
              {alertsPaused ? "MUTED" : cameraPhase === "off" ? "PAUSED" : "LIVE"}
            </div>
            {dutyCycle.enabled && (
              <div className="duty-badge">Camera {cameraPhase === "off" ? "OFF" : "ON"}</div>
            )}
            <button className="settings-btn" onClick={() => setShowSettings(!showSettings)} title="Settings">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" stroke="currentColor" strokeWidth="1.5" />
                <path d="M16.2 12.8a1.4 1.4 0 00.3 1.5l.05.05a1.7 1.7 0 11-2.4 2.4l-.05-.05a1.4 1.4 0 00-1.5-.3 1.4 1.4 0 00-.85 1.28v.15a1.7 1.7 0 01-3.4 0v-.08a1.4 1.4 0 00-.92-1.28 1.4 1.4 0 00-1.5.3l-.05.05a1.7 1.7 0 11-2.4-2.4l.05-.05a1.4 1.4 0 00.3-1.5 1.4 1.4 0 00-1.28-.85h-.15a1.7 1.7 0 010-3.4h.08a1.4 1.4 0 001.28-.92 1.4 1.4 0 00-.3-1.5l-.05-.05a1.7 1.7 0 112.4-2.4l.05.05a1.4 1.4 0 001.5.3h.07a1.4 1.4 0 00.85-1.28v-.15a1.7 1.7 0 013.4 0v.08a1.4 1.4 0 00.85 1.28 1.4 1.4 0 001.5-.3l.05-.05a1.7 1.7 0 112.4 2.4l-.05.05a1.4 1.4 0 00-.3 1.5v.07a1.4 1.4 0 001.28.85h.15a1.7 1.7 0 010 3.4h-.08a1.4 1.4 0 00-1.28.85z" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <div className="layout">
        <div className="camera-panel">
          <div className="camera-wrapper" data-status={result?.status ?? "unknown"}>
            <video ref={videoRef} className="video-hidden" playsInline muted />
            <canvas ref={canvasRef} className="camera-canvas" />
            {state !== "running" && (
              <div className="camera-placeholder">
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                  <rect width="64" height="64" rx="32" fill="currentColor" fillOpacity="0.12" />
                  <path d="M20 24a4 4 0 014-4h16a4 4 0 014 4v18a4 4 0 01-4 4H24a4 4 0 01-4-4V24z" stroke="currentColor" strokeWidth="2" />
                  <circle cx="32" cy="33" r="6" stroke="currentColor" strokeWidth="2" />
                  <circle cx="40" cy="26" r="2" fill="currentColor" />
                </svg>
                <p>{state === "loading" ? "Initializing camera & AI model..." : "Camera feed will appear here"}</p>
              </div>
            )}
            {state === "running" && cameraPhase === "off" && (
              <div className="camera-placeholder camera-off-placeholder">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <circle cx="24" cy="24" r="24" fill="currentColor" fillOpacity="0.12" />
                  <path d="M14 14l20 20M16 20a4 4 0 014-4h12l-20 20v-12a4 4 0 014-4z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <p>Camera paused to save power</p>
                <p className="camera-off-sub">Monitoring resumes in next cycle</p>
              </div>
            )}
            {result?.status === "bad" && cameraPhase !== "off" && (
              <div className="bad-overlay">
                <span>Fix Your Posture</span>
              </div>
            )}
          </div>

          <div className="camera-controls">
            {state === "idle" || state === "error" ? (
              <button className="btn btn-primary" onClick={startMonitoring}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <circle cx="9" cy="9" r="8" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="9" cy="9" r="3" fill="currentColor" />
                </svg>
                Start Monitoring
              </button>
            ) : state === "loading" ? (
              <button className="btn btn-disabled" disabled>
                <span className="spinner" />
                Loading AI Model...
              </button>
            ) : (
              <>
                <button
                  className={`btn ${alertsPaused ? "btn-primary" : "btn-secondary"}`}
                  onClick={toggleAlertsPaused}
                  title={alertsPaused ? "Resume alerts (Space)" : "Pause alerts (Space)"}
                >
                  {alertsPaused ? (
                    <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                      <polygon points="4,2 16,9 4,16" fill="currentColor" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                      <rect x="4" y="2" width="3.5" height="14" rx="1" fill="currentColor" />
                      <rect x="10.5" y="2" width="3.5" height="14" rx="1" fill="currentColor" />
                    </svg>
                  )}
                  {alertsPaused ? "Resume Alerts" : "Pause Alerts"}
                  <kbd className="btn-kbd">Space</kbd>
                </button>
                <button className="btn btn-danger" onClick={stopMonitoring}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <rect x="2" y="2" width="14" height="14" rx="2" fill="currentColor" />
                  </svg>
                  Stop Monitoring
                </button>
              </>
            )}
          </div>

          {showActivityBadge && activityInfo && (
            <div className={`activity-banner activity-${activity}`}>
              <div className="activity-banner-text">
                <strong>{activityInfo.label}</strong>
                <span>{activityInfo.desc}</span>
              </div>
            </div>
          )}

          {state === "running" && alertsPaused && (
            <div className="paused-banner">
              <span className="paused-dot" />
              All alerts paused (posture + reminders) — tracking continues
            </div>
          )}

          {state === "running" && !alertsPaused && isMoving && (
            <div className="motion-banner">
              <span className="motion-dot" />
              Movement detected — pausing alerts until you settle
            </div>
          )}

          {state === "running" && !alertsPaused && !isMoving && alertCooldownUntil > 0 && (
            <AlertCooldownBanner until={alertCooldownUntil} />
          )}

          {error && <div className="error-msg">{error}</div>}

          <SittingCoachCard sittingCoach={sittingCoach} monitorRunning={state === "running"} />

          <MicroBreakCard
            audio={audio}
            onBreakDone={sittingCoach.takeBreak}
            monitorRunning={state === "running"}
            voicePraise={sittingCoach.config.mode === "voice"}
          />
        </div>

        <div className="status-panel">
          {showSettings && state === "running" && (
            <div className="settings-card">
              <h3 className="settings-title">Alert Tone</h3>
              <p className="settings-desc">Choose the sound played when poor posture is detected.</p>
              <div className="tone-selector">
                {(Object.keys(ALERT_TONE_LABELS) as AlertTone[]).map((tone) => (
                  <button
                    key={tone}
                    className={`tone-btn ${audio.alertTone === tone ? "tone-btn-active" : ""}`}
                    onClick={() => audio.setAlertTone(tone)}
                  >
                    {ALERT_TONE_LABELS[tone]}
                  </button>
                ))}
              </div>
              <button className="btn btn-secondary tone-preview-btn" onClick={audio.playAlert}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <polygon points="2,1 13,7 2,13" fill="currentColor" />
                </svg>
                Preview
              </button>

              <div className="settings-divider" />

              <h3 className="settings-title">Camera Saver</h3>
              <p className="settings-desc">
                Periodically turns the camera on and off to reduce power consumption during long sessions.
                Alerts still work when the camera cycles back on.
              </p>
              <div className="settings-row">
                <label className="settings-label">
                  On duration
                  <div className="settings-input-wrap">
                    <input
                      type="number"
                      min={0.1}
                      step={0.1}
                      value={onMin}
                      onChange={(e) => setOnMin(Number(e.target.value))}
                      className="settings-input"
                      disabled={dutyCycle.enabled}
                    />
                    <span className="settings-unit">min</span>
                  </div>
                </label>
                <label className="settings-label">
                  Off duration
                  <div className="settings-input-wrap">
                    <input
                      type="number"
                      min={0.1}
                      step={0.1}
                      value={offMin}
                      onChange={(e) => setOffMin(Number(e.target.value))}
                      className="settings-input"
                      disabled={dutyCycle.enabled}
                    />
                    <span className="settings-unit">min</span>
                  </div>
                </label>
              </div>
              <button
                className={`btn ${dutyCycle.enabled ? "btn-danger" : "btn-secondary"}`}
                onClick={handleToggleDutyCycle}
              >
                {dutyCycle.enabled ? "Disable Camera Saver" : "Enable Camera Saver"}
              </button>
            </div>
          )}

          <div className="status-card" style={{ "--status-color": statusColor } as React.CSSProperties}>
            <div className="status-icon-wrap">
              {result?.status === "good" && (
                <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                  <circle cx="28" cy="28" r="28" fill="#16a34a22" />
                  <path d="M16 28l9 9 15-18" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              {result?.status === "bad" && (
                <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                  <circle cx="28" cy="28" r="28" fill="#dc262622" />
                  <path d="M28 18v14" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
                  <circle cx="28" cy="38" r="2.5" fill="#ef4444" />
                </svg>
              )}
              {(!result || result.status === "unknown") && (
                <svg width="56" height="56" viewBox="0 0 56 56" fill="none" className="status-unknown-icon">
                  <circle cx="28" cy="28" r="28" fill="currentColor" fillOpacity="0.12" />
                  <circle cx="28" cy="28" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="5 3" />
                </svg>
              )}
            </div>
            <h2 className="status-label" style={{ color: statusColor }}>
              {state === "idle" ? "Not Running" : state === "loading" ? "Loading..." : statusLabel}
            </h2>
            {result?.status === "bad" && badDuration > 0 && (
              <p className="bad-duration">Poor posture detected for {badDuration}s</p>
            )}
            {result?.issues && result.issues.length > 0 && (
              <ul className="issues-list">
                {result.issues.map((issue) => (
                  <li key={issue} className="issue-item">
                    <span className="issue-dot" />
                    {issue}
                  </li>
                ))}
              </ul>
            )}
            {result?.status === "good" && (
              <p className="good-msg">Keep it up! Your posture looks great.</p>
            )}
          </div>

          <div className="metrics-card">
            <h3 className="metrics-title">Posture Metrics</h3>
            <div className="metrics-list">
              <Metric label="Neck Tilt" value={scores?.neckTilt ?? 0} active={state === "running"} />
              <Metric label="Shoulder Level" value={scores?.shoulderLevel ?? 0} active={state === "running"} />
              <Metric label="Head Position" value={scores?.forwardHead ?? 0} active={state === "running"} />
              <Metric label="Eye Level" value={scores?.eyeLevel ?? 0} active={state === "running"} />
            </div>
          </div>

          <HabitsCard
            habits={habits.habits}
            setEnabled={habits.setEnabled}
            setHabitInterval={habits.setHabitInterval}
            snooze={habits.snooze}
            setHabitMode={habits.setHabitMode}
          />

          <div className="tips-card">
            <h3 className="tips-title">Sitting for a tilt-prone back</h3>
            <ul className="tips-list">
              <li>Hips slightly higher than knees, both feet planted</li>
              <li>Sit on the sit bones — not perched on an arched back</li>
              <li>Ears over shoulders, screen at eye level</li>
              <li>The best position is the next one — shift often</li>
              <li>Stand up every 30–45 minutes (the coach above will nudge you)</li>
            </ul>
          </div>

          <div className="bg-info-card">
            <h3 className="tips-title">Background Mode</h3>
            <p className="bg-info-text">
              This app continues monitoring even when the tab is not active.
              Alerts (beep and voice) will still fire in the background.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Sitting coach card --------------------------------------------------

function SittingCoachCard({
  sittingCoach,
  monitorRunning,
}: {
  sittingCoach: ReturnType<typeof useSittingCoach>;
  monitorRunning: boolean;
}) {
  const { config, setConfig, seatedMs, breakDue, takeBreak, breaksToday } = sittingCoach;
  const totalSec = Math.floor(seatedMs / 1000);
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  const pct = Math.min(100, (seatedMs / (config.intervalMin * 60 * 1000)) * 100);

  return (
    <div className={`sitting-card ${breakDue ? "sitting-card-due" : ""}`}>
      <div className="sitting-head">
        <div>
          <h3 className="metrics-title">Sitting-break coach</h3>
          <p className="exercises-sub">
            Hip flexors adapt to whatever length you keep them at. This clock
            only runs while you're actually at the desk.
          </p>
        </div>
        <label className="habit-toggle" title="Enable sitting-break coach">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => setConfig((c) => ({ ...c, enabled: e.target.checked }))}
          />
          <span className="habit-toggle-slider" />
        </label>
      </div>

      {config.enabled && (
        <>
          <div className="sitting-timer-row">
            <div className="sitting-timer">
              <span className="sitting-timer-num">
                {monitorRunning ? `${mm}:${String(ss).padStart(2, "0")}` : "—:—"}
              </span>
              <span className="sitting-timer-label">seated</span>
            </div>
            <div className="sitting-timer-bar">
              <div
                className="sitting-timer-fill"
                style={{
                  width: `${monitorRunning ? pct : 0}%`,
                  background: pct >= 100 ? "#ef4444" : pct > 70 ? "#f59e0b" : "#22c55e",
                }}
              />
            </div>
            <span className="sitting-breaks-today">{breaksToday} breaks today</span>
          </div>

          {breakDue && (
            <div className="sitting-due-banner">
              Time to stand — do a micro-break below, or just walk for two
              minutes.
            </div>
          )}

          <div className="sitting-config-row">
            <label className="settings-label">
              Remind after
              <div className="settings-input-wrap">
                <input
                  type="number"
                  min={10}
                  max={120}
                  step={5}
                  value={config.intervalMin}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      intervalMin: Math.max(10, Number(e.target.value) || 40),
                    }))
                  }
                  className="settings-input"
                />
                <span className="settings-unit">min</span>
              </div>
            </label>
            <div className="habit-mode" role="group" aria-label="Reminder style">
              <button
                type="button"
                className={`habit-mode-btn ${config.mode === "ping" ? "habit-mode-btn-active" : ""}`}
                onClick={() => setConfig((c) => ({ ...c, mode: "ping" }))}
              >
                Ping
              </button>
              <button
                type="button"
                className={`habit-mode-btn ${config.mode === "voice" ? "habit-mode-btn-active" : ""}`}
                onClick={() => setConfig((c) => ({ ...c, mode: "voice" }))}
              >
                Voice
              </button>
            </div>
            <button className="habit-snooze" onClick={takeBreak} disabled={!monitorRunning}>
              I took a break
            </button>
          </div>
          {!monitorRunning && (
            <p className="sitting-idle-note">
              Start monitoring above and the seated clock runs automatically —
              standing up for 2 minutes resets it and logs the break.
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ---- Micro-break card ----------------------------------------------------

function MicroBreakCard({
  audio,
  onBreakDone,
  monitorRunning,
  voicePraise,
}: {
  audio: AudioCues;
  onBreakDone: () => void;
  monitorRunning: boolean;
  voicePraise: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const id = MICRO_BREAK_IDS[index % MICRO_BREAK_IDS.length];
  const exercise = EXERCISES[id];
  const perSide = "perSide" in exercise.scheme && exercise.scheme.perSide;
  const totalSeconds = setSeconds(exercise.scheme) * (perSide ? 2 : 1);

  useEffect(() => {
    if (secondsLeft === null) return;
    const t = setTimeout(() => {
      setSecondsLeft((s) => {
        if (s === null) return null;
        if (s <= 1) {
          audio.playStep();
          if (voicePraise) audio.speak(breakPraiseLine());
          // A finished micro-break counts as the sitting break.
          if (monitorRunning) onBreakDone();
          return null;
        }
        if (perSide && s - 1 === Math.floor(totalSeconds / 2)) {
          audio.playTick();
        }
        return s - 1;
      });
    }, 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, audio, onBreakDone, monitorRunning, perSide, totalSeconds, voicePraise]);

  const next = () => {
    setSecondsLeft(null);
    setIndex((i) => (i + 1) % MICRO_BREAK_IDS.length);
  };

  return (
    <div className="exercises-card">
      <div className="exercises-header">
        <div>
          <h3 className="metrics-title">Micro-break</h3>
          <p className="exercises-sub">
            30–120 second resets that reverse the sitting position — built for
            anterior tilt.
          </p>
        </div>
        <button className="exercise-shuffle" onClick={next} title="Next micro-break">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Shuffle
        </button>
      </div>
      <div className="exercise-current">
        <div className="exercise-current-top">
          <span className="exercise-current-title">{exercise.name}</span>
          <span className="exercise-current-duration">
            {secondsLeft !== null ? `${secondsLeft}s left` : `${totalSeconds}s`}
          </span>
        </div>
        <div className="micro-body">
          <ExerciseFigure id={id} size={130} />
          <div className="micro-body-text">
            <ul className="exercise-cues">
              {exercise.cues.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
              {perSide && <li>Switch sides at the halfway tick.</li>}
            </ul>
            <DemoLink query={exerciseVideoQuery(exercise)} />
          </div>
        </div>
        {secondsLeft !== null && (
          <div className="exercise-progress-bar">
            <div
              className="exercise-progress-fill"
              style={{ width: `${((totalSeconds - secondsLeft) / totalSeconds) * 100}%` }}
            />
          </div>
        )}
        <button
          className={`btn exercise-start ${secondsLeft !== null ? "btn-danger" : "btn-secondary"}`}
          onClick={() => setSecondsLeft(secondsLeft !== null ? null : totalSeconds)}
        >
          {secondsLeft !== null ? "Stop timer" : "Start timer"}
        </button>
      </div>
      <div className="exercises-grid">
        {MICRO_BREAK_IDS.map((mid, i) => (
          <button
            key={mid}
            className={`exercise-chip ${i === index % MICRO_BREAK_IDS.length ? "exercise-chip-active" : ""}`}
            onClick={() => {
              setSecondsLeft(null);
              setIndex(i);
            }}
          >
            {EXERCISES[mid].name}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---- Habits card (unchanged behavior, moved from the old App) ------------

interface HabitsCardProps {
  habits: ReturnType<typeof useHabitReminders>["habits"];
  setEnabled: (key: HabitKey, enabled: boolean) => void;
  setHabitInterval: (key: HabitKey, intervalMin: number) => void;
  snooze: (key: HabitKey) => void;
  setHabitMode: (key: HabitKey, mode: HabitMode) => void;
}

function HabitsCard({ habits, setEnabled, setHabitInterval, snooze, setHabitMode }: HabitsCardProps) {
  const keys = Object.keys(HABIT_INFO) as HabitKey[];
  return (
    <div className="habits-card">
      <h3 className="metrics-title">Habits &amp; Reminders</h3>
      <div className="habits-list">
        {keys.map((key) => {
          const h = habits[key];
          const info = HABIT_INFO[key];
          return (
            <div key={key} className={`habit-row ${h.enabled ? "habit-row-on" : ""}`}>
              <div className="habit-row-top">
                <label className="habit-toggle">
                  <input
                    type="checkbox"
                    checked={h.enabled}
                    onChange={(e) => setEnabled(key, e.target.checked)}
                  />
                  <span className="habit-toggle-slider" />
                </label>
                <div className="habit-info">
                  <span className="habit-title">{info.title}</span>
                  <span className="habit-desc">{info.description}</span>
                </div>
                <div className="habit-interval">
                  <input
                    type="number"
                    min={1}
                    max={240}
                    step={1}
                    value={h.intervalMin}
                    onChange={(e) => setHabitInterval(key, Math.max(1, Number(e.target.value) || 1))}
                    className="habit-interval-input"
                    aria-label={`${info.title} interval in minutes`}
                  />
                  <span className="habit-interval-unit">min</span>
                </div>
              </div>
              {h.enabled && h.nextFireAt !== null && (
                <div className="habit-row-bottom">
                  <NextDueLabel nextFireAt={h.nextFireAt} />
                  <div className="habit-row-actions">
                    <div
                      className="habit-mode"
                      role="group"
                      aria-label={`${info.title} reminder style`}
                    >
                      <button
                        type="button"
                        className={`habit-mode-btn ${(h.mode ?? "ping") === "ping" ? "habit-mode-btn-active" : ""}`}
                        onClick={() => setHabitMode(key, "ping")}
                        title="Short ping only"
                      >
                        Ping
                      </button>
                      <button
                        type="button"
                        className={`habit-mode-btn ${h.mode === "voice" ? "habit-mode-btn-active" : ""}`}
                        onClick={() => setHabitMode(key, "voice")}
                        title="Spoken announcement"
                      >
                        Voice
                      </button>
                    </div>
                    <button className="habit-snooze" onClick={() => snooze(key)}>
                      Reset
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NextDueLabel({ nextFireAt }: { nextFireAt: number }) {
  const now = useNow();
  const remainingMs = Math.max(0, nextFireAt - now);
  const totalSec = Math.round(remainingMs / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return (
    <span className="habit-next">
      Next in {min > 0 ? `${min}m ${sec}s` : `${sec}s`}
    </span>
  );
}

function AlertCooldownBanner({ until }: { until: number }) {
  const now = useNow();
  const remainingMs = Math.max(0, until - now);
  if (remainingMs <= 0) return null;
  const totalSec = Math.round(remainingMs / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  const label = min > 0 ? `${min}m ${sec}s` : `${sec}s`;
  return (
    <div className="cooldown-banner">
      <span className="cooldown-dot" />
      Quiet mode — next posture alert in {label}
    </div>
  );
}

function Metric({ label, value, active }: { label: string; value: number; active: boolean }) {
  const color = value < 40 ? "#22c55e" : value < 70 ? "#f59e0b" : "#ef4444";
  const displayValue = active ? value : 0;
  const rating = active ? (value < 40 ? "Good" : value < 70 ? "Fair" : "Poor") : "—";
  return (
    <div className="metric">
      <div className="metric-header">
        <span className="metric-label">{label}</span>
        <span className="metric-value" style={{ color: active ? color : "#475569" }}>
          {rating}
        </span>
      </div>
      <div className="metric-bar-bg">
        <div
          className="metric-bar-fill"
          style={{ width: `${displayValue}%`, backgroundColor: color, transition: "width 0.4s ease, background-color 0.4s ease" }}
        />
      </div>
    </div>
  );
}
