import { useEffect, useMemo, useState } from "react";
import { usePostureMonitor, ALERT_TONE_LABELS } from "./usePostureMonitor";
import type { AlertTone } from "./usePostureMonitor";
import { useHabitReminders, HABIT_INFO } from "./useHabitReminders";
import type { HabitKey } from "./useHabitReminders";
import { loadHistory, computeInsights, clearHistory } from "./sessionHistory";
import type { Insights } from "./sessionHistory";
import { usePersistedState } from "./usePersistedState";
import "./App.css";

type Theme = "light" | "dark";

const ACTIVITY_LABELS: Record<string, { label: string; desc: string }> = {
  working: { label: "Working", desc: "Monitoring posture" },
  phone_call: { label: "On a call", desc: "Alerts paused while on phone" },
  writing: { label: "Writing", desc: "Head-down work detected" },
  talking_to_someone: { label: "Talking", desc: "Alerts paused while talking" },
  away: { label: "Away", desc: "Not in front of screen" },
};

interface Exercise {
  title: string;
  seconds: number;
  steps: string;
}

const EXERCISES: Exercise[] = [
  { title: "Neck rolls", seconds: 30, steps: "Slowly roll your head in a circle. Reverse direction halfway through." },
  { title: "Shoulder shrugs", seconds: 20, steps: "Raise shoulders to ears, hold 3 seconds, release. Repeat 8 times." },
  { title: "Chin tucks", seconds: 30, steps: "Pull chin straight back creating a double chin. Hold 5s. Repeat 5x." },
  { title: "Doorway chest stretch", seconds: 45, steps: "Stand in doorway, place forearms on frame, step forward gently." },
  { title: "Seated spinal twist", seconds: 30, steps: "Sit tall, rotate torso to one side using chair back. Hold 15s each side." },
  { title: "Wrist flexor stretch", seconds: 30, steps: "Extend arm, pull fingers back gently with opposite hand. Switch sides." },
  { title: "Eye palming", seconds: 60, steps: "Rub palms warm, cup over closed eyes. Relax and breathe deeply." },
  { title: "Upper back stretch", seconds: 30, steps: "Interlace fingers, push palms forward, round upper back outward." },
];

export default function App() {
  const {
    videoRef, canvasRef, state, result, error, badDuration,
    cameraPhase, dutyCycle, alertTone, setAlertTone,
    alertsPaused, toggleAlertsPaused,
    playAlert, speak,
    sessionsVersion, startMonitoring, stopMonitoring,
    startDutyCycle, stopDutyCycle,
  } = usePostureMonitor();

  const { habits, setEnabled, setHabitInterval, snooze } = useHabitReminders(playAlert, speak);

  const [theme, setTheme] = usePersistedState<Theme>("postureguard.theme", "dark");
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  const [onMin, setOnMin] = useState(0.5);
  const [offMin, setOffMin] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [exerciseSecondsLeft, setExerciseSecondsLeft] = useState<number | null>(null);
  const currentExercise = EXERCISES[exerciseIndex % EXERCISES.length];
  const nextExercise = () => {
    setExerciseSecondsLeft(null);
    setExerciseIndex((i) => (i + 1) % EXERCISES.length);
  };
  const selectExercise = (i: number) => {
    setExerciseSecondsLeft(null);
    setExerciseIndex(i);
  };
  const startExerciseTimer = () => setExerciseSecondsLeft(currentExercise.seconds);
  const stopExerciseTimer = () => setExerciseSecondsLeft(null);

  useEffect(() => {
    if (exerciseSecondsLeft === null) return;
    const id = setTimeout(() => {
      setExerciseSecondsLeft((s) => {
        if (s === null) return null;
        if (s <= 1) {
          // Done — chime once.
          playAlert();
          return null;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearTimeout(id);
  }, [exerciseSecondsLeft, playAlert]);

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

  const [historyBump, setHistoryBump] = useState(0);
  const insights = useMemo<Insights>(
    () => computeInsights(loadHistory()),
    // sessionsVersion bumps when a new session is saved; historyBump
    // bumps when the user clears history. Either causes a recompute.
    [sessionsVersion, historyBump]
  );

  const handleClearHistory = () => {
    if (window.confirm("Clear all session history? This cannot be undone.")) {
      clearHistory();
      setHistoryBump((b) => b + 1);
    }
  };

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
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="7" r="4" fill="currentColor" className="logo-accent" />
              <path d="M14 11 L14 20" stroke="currentColor" className="logo-accent" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M8 14 L14 12 L20 14" stroke="currentColor" className="logo-accent" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14 20 L10 26" stroke="currentColor" className="logo-accent" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M14 20 L18 26" stroke="currentColor" className="logo-accent" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <div className="logo-text">
              <span className="logo-name">PostureGuard</span>
              <a
                className="logo-brand"
                href="https://www.gonav.tech"
                target="_blank"
                rel="noopener noreferrer"
              >
                by GoNav Tech
              </a>
            </div>
          </div>
          <div className="header-right">
            {state === "running" && (
              <>
                <div className={`live-badge ${alertsPaused ? "live-badge-muted" : ""}`}>
                  <span className="live-dot" />
                  {alertsPaused ? "MUTED" : cameraPhase === "off" ? "PAUSED" : "LIVE"}
                </div>
                {dutyCycle.enabled && (
                  <div className="duty-badge">
                    Camera {cameraPhase === "off" ? "OFF" : "ON"}
                  </div>
                )}
              </>
            )}
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            >
              {theme === "dark" ? (
                // Sun icon — click to switch TO light
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
                  <path
                    d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                // Moon icon — click to switch TO dark
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
            {state === "running" && (
              <button className="settings-btn" onClick={() => setShowSettings(!showSettings)} title="Settings">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M16.2 12.8a1.4 1.4 0 00.3 1.5l.05.05a1.7 1.7 0 11-2.4 2.4l-.05-.05a1.4 1.4 0 00-1.5-.3 1.4 1.4 0 00-.85 1.28v.15a1.7 1.7 0 01-3.4 0v-.08a1.4 1.4 0 00-.92-1.28 1.4 1.4 0 00-1.5.3l-.05.05a1.7 1.7 0 11-2.4-2.4l.05-.05a1.4 1.4 0 00.3-1.5 1.4 1.4 0 00-1.28-.85h-.15a1.7 1.7 0 010-3.4h.08a1.4 1.4 0 001.28-.92 1.4 1.4 0 00-.3-1.5l-.05-.05a1.7 1.7 0 112.4-2.4l.05.05a1.4 1.4 0 001.5.3h.07a1.4 1.4 0 00.85-1.28v-.15a1.7 1.7 0 013.4 0v.08a1.4 1.4 0 00.85 1.28 1.4 1.4 0 001.5-.3l.05-.05a1.7 1.7 0 112.4 2.4l-.05.05a1.4 1.4 0 00-.3 1.5v.07a1.4 1.4 0 001.28.85h.15a1.7 1.7 0 010 3.4h-.08a1.4 1.4 0 00-1.28.85z" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="main">
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
                    title={
                      alertsPaused
                        ? "Resume alerts (Space)"
                        : "Pause alerts (Space)"
                    }
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
                <span className="activity-banner-icon" aria-hidden="true">
                  {activity === "phone_call" && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.8a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.35 1.84.59 2.8.72A2 2 0 0 1 22 16.92z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                  {activity === "writing" && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 19l7-7 3 3-7 7-3-3zM18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5zM2 2l7.586 7.586M11 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                  {activity === "talking_to_someone" && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                  {activity === "away" && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
                      <path
                        d="M4 21c0-4 4-7 8-7s8 3 8 7"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                      <path d="M2 2l20 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  )}
                </span>
                <div className="activity-banner-text">
                  <strong>{activityInfo.label}</strong>
                  <span>{activityInfo.desc}</span>
                </div>
              </div>
            )}

            {state === "running" && alertsPaused && (
              <div className="paused-banner">
                <span className="paused-dot" />
                Alerts paused — posture is still being tracked
              </div>
            )}

            {error && <div className="error-msg">{error}</div>}

            <div className="exercises-card">
              <div className="exercises-header">
                <div>
                  <h3 className="metrics-title">Exercise Break</h3>
                  <p className="exercises-sub">
                    Quick desk-friendly exercises to keep you mobile.
                  </p>
                </div>
                <button className="exercise-shuffle" onClick={nextExercise} title="Next exercise">
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
                  <span className="exercise-current-title">{currentExercise.title}</span>
                  <span className="exercise-current-duration">
                    {exerciseSecondsLeft !== null
                      ? `${exerciseSecondsLeft}s left`
                      : `${currentExercise.seconds}s`}
                  </span>
                </div>
                <p className="exercise-current-steps">{currentExercise.steps}</p>
                {exerciseSecondsLeft !== null && (
                  <div className="exercise-progress-bar">
                    <div
                      className="exercise-progress-fill"
                      style={{
                        width: `${
                          ((currentExercise.seconds - exerciseSecondsLeft) /
                            currentExercise.seconds) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                )}
                <button
                  className={`btn exercise-start ${
                    exerciseSecondsLeft !== null ? "btn-danger" : "btn-secondary"
                  }`}
                  onClick={
                    exerciseSecondsLeft !== null ? stopExerciseTimer : startExerciseTimer
                  }
                >
                  {exerciseSecondsLeft !== null ? "Stop timer" : "Start timer"}
                </button>
              </div>
              <div className="exercises-grid">
                {EXERCISES.map((ex, i) => (
                  <button
                    key={ex.title}
                    className={`exercise-chip ${i === exerciseIndex ? "exercise-chip-active" : ""}`}
                    onClick={() => selectExercise(i)}
                  >
                    {ex.title}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="status-panel">
            {/* Settings panel */}
            {showSettings && state === "running" && (
              <div className="settings-card">
                <h3 className="settings-title">Alert Tone</h3>
                <p className="settings-desc">
                  Choose the sound played when poor posture is detected.
                </p>
                <div className="tone-selector">
                  {(Object.keys(ALERT_TONE_LABELS) as AlertTone[]).map((tone) => (
                    <button
                      key={tone}
                      className={`tone-btn ${alertTone === tone ? "tone-btn-active" : ""}`}
                      onClick={() => setAlertTone(tone)}
                    >
                      {ALERT_TONE_LABELS[tone]}
                    </button>
                  ))}
                </div>
                <button className="btn btn-secondary tone-preview-btn" onClick={playAlert}>
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
              habits={habits}
              setEnabled={setEnabled}
              setHabitInterval={setHabitInterval}
              snooze={snooze}
            />

            {insights.totalSessions > 0 && (
              <InsightsCard insights={insights} onClear={handleClearHistory} />
            )}

            <div className="tips-card">
              <h3 className="tips-title">Quick Tips</h3>
              <ul className="tips-list">
                <li>Ears aligned with your shoulders</li>
                <li>Back straight and supported</li>
                <li>Shoulders relaxed and level</li>
                <li>Screen at eye level</li>
                <li>Break every 30 minutes</li>
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
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <span className="footer-product">PostureGuard</span>
          <span className="footer-dot">·</span>
          <span>
            built by{" "}
            <a
              className="footer-link"
              href="https://www.gonav.tech"
              target="_blank"
              rel="noopener noreferrer"
            >
              GoNav Tech
            </a>
          </span>
          <span className="footer-dot">·</span>
          <span>created by Govind Kedia</span>
        </div>
      </footer>
    </div>
  );
}

interface HabitsCardProps {
  habits: ReturnType<typeof useHabitReminders>["habits"];
  setEnabled: (key: HabitKey, enabled: boolean) => void;
  setHabitInterval: (key: HabitKey, intervalMin: number) => void;
  snooze: (key: HabitKey) => void;
}

function HabitsCard({ habits, setEnabled, setHabitInterval, snooze }: HabitsCardProps) {
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
                  <button className="habit-snooze" onClick={() => snooze(key)}>
                    Reset
                  </button>
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
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const remainingMs = Math.max(0, nextFireAt - Date.now());
  const totalSec = Math.round(remainingMs / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return (
    <span className="habit-next">
      Next in {min > 0 ? `${min}m ${sec}s` : `${sec}s`}
    </span>
  );
}

function InsightsCard({
  insights,
  onClear,
}: {
  insights: Insights;
  onClear: () => void;
}) {
  return (
    <div className="insights-card">
      <div className="insights-header">
        <h3 className="metrics-title">Your Insights</h3>
        <button className="insights-clear" onClick={onClear} title="Clear history">
          Clear
        </button>
      </div>

      <div className="insights-stats">
        <Stat value={String(insights.totalSessions)} label="Sessions" />
        <Stat value={`${insights.totalMinutes}m`} label="Tracked" />
        <Stat
          value={`${Math.round(insights.averageBadPercent)}%`}
          label="Poor posture"
          tone={insights.averageBadPercent > 40 ? "bad" : insights.averageBadPercent > 20 ? "warn" : "good"}
        />
      </div>

      {insights.topIssues.length > 0 && (
        <div className="insights-section">
          <div className="insights-subtitle">Most frequent issues</div>
          <div className="insights-issues">
            {insights.topIssues.map((i) => (
              <div key={i.issue} className="insights-issue">
                <span>{i.issue}</span>
                <span className="insights-issue-count">{i.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {insights.timeOfDayBuckets.length > 0 && (
        <div className="insights-section">
          <div className="insights-subtitle">Posture by time of day</div>
          <div className="insights-buckets">
            {insights.timeOfDayBuckets.map((b) => {
              const pct = Math.min(100, Math.round(b.avgBadPercent));
              return (
                <div key={b.label} className="insights-bucket">
                  <div className="insights-bucket-head">
                    <span>{b.label}</span>
                    <span className="insights-bucket-pct">{pct}% bad</span>
                  </div>
                  <div className="insights-bucket-bar">
                    <div
                      className="insights-bucket-fill"
                      style={{
                        width: `${pct}%`,
                        background: pct > 50 ? "#ef4444" : pct > 25 ? "#f59e0b" : "#22c55e",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {insights.recommendations.length > 0 && (
        <div className="insights-section">
          <div className="insights-subtitle">Things to watch</div>
          <div className="insights-recs">
            {insights.recommendations.map((r, i) => (
              <div key={i} className="insights-rec">
                <span className="insights-rec-bar" />
                <span>{r}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ value, label, tone }: { value: string; label: string; tone?: "good" | "warn" | "bad" }) {
  const color = tone === "bad" ? "#ef4444" : tone === "warn" ? "#f59e0b" : tone === "good" ? "#22c55e" : "var(--text)";
  return (
    <div className="insights-stat">
      <div className="insights-stat-value" style={{ color }}>
        {value}
      </div>
      <div className="insights-stat-label">{label}</div>
    </div>
  );
}

function Metric({ label, value, active }: { label: string; value: number; active: boolean }) {
  const color = value < 40 ? "#22c55e" : value < 70 ? "#f59e0b" : "#ef4444";
  const displayValue = active ? value : 0;
  const rating = active ? (value < 40 ? "Good" : value < 70 ? "Fair" : "Poor") : "\u2014";
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
