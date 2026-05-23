import { useEffect, useMemo, useState } from "react";
import { usePostureMonitor, ALERT_TONE_LABELS } from "./usePostureMonitor";
import type { AlertTone } from "./usePostureMonitor";
import { useHabitReminders, HABIT_INFO } from "./useHabitReminders";
import type { HabitKey } from "./useHabitReminders";
import { loadHistory, computeInsights, clearHistory } from "./sessionHistory";
import type { Insights } from "./sessionHistory";
import "./App.css";

export default function App() {
  const {
    videoRef, canvasRef, state, result, error, badDuration,
    cameraPhase, dutyCycle, alertTone, setAlertTone, playAlert, speak,
    sessionsVersion, startMonitoring, stopMonitoring,
    startDutyCycle, stopDutyCycle,
  } = usePostureMonitor();

  const { habits, setEnabled, setHabitInterval, snooze } = useHabitReminders(playAlert, speak);

  const [onMin, setOnMin] = useState(0.5);
  const [offMin, setOffMin] = useState(1);
  const [showSettings, setShowSettings] = useState(false);

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
              <circle cx="14" cy="7" r="4" fill="#3b82f6" />
              <path d="M14 11 L14 20" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M8 14 L14 12 L20 14" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14 20 L10 26" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M14 20 L18 26" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <span>PostureGuard</span>
          </div>
          <div className="header-right">
            {state === "running" && (
              <>
                <div className="live-badge">
                  <span className="live-dot" />
                  {cameraPhase === "off" ? "PAUSED" : "LIVE"}
                </div>
                {dutyCycle.enabled && (
                  <div className="duty-badge">
                    Camera {cameraPhase === "off" ? "OFF" : "ON"}
                  </div>
                )}
              </>
            )}
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
                    <rect width="64" height="64" rx="32" fill="#1e293b" />
                    <path d="M20 24a4 4 0 014-4h16a4 4 0 014 4v18a4 4 0 01-4 4H24a4 4 0 01-4-4V24z" stroke="#475569" strokeWidth="2" />
                    <circle cx="32" cy="33" r="6" stroke="#475569" strokeWidth="2" />
                    <circle cx="40" cy="26" r="2" fill="#475569" />
                  </svg>
                  <p>{state === "loading" ? "Initializing camera & AI model..." : "Camera feed will appear here"}</p>
                </div>
              )}
              {state === "running" && cameraPhase === "off" && (
                <div className="camera-placeholder camera-off-placeholder">
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                    <circle cx="24" cy="24" r="24" fill="#1e293b" />
                    <path d="M14 14l20 20M16 20a4 4 0 014-4h12l-20 20v-12a4 4 0 014-4z" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
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
                <button className="btn btn-danger" onClick={stopMonitoring}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <rect x="2" y="2" width="14" height="14" rx="2" fill="currentColor" />
                  </svg>
                  Stop Monitoring
                </button>
              )}
            </div>

            {error && <div className="error-msg">{error}</div>}
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
                  <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                    <circle cx="28" cy="28" r="28" fill="#1e293b" />
                    <circle cx="28" cy="28" r="10" stroke="#475569" strokeWidth="2" strokeDasharray="5 3" />
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
