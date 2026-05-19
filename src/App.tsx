import { useState } from "react";
import { usePostureMonitor } from "./usePostureMonitor";
import "./App.css";

export default function App() {
  const {
    videoRef, canvasRef, state, result, error, badDuration,
    cameraPhase, dutyCycle, startMonitoring, stopMonitoring,
    startDutyCycle, stopDutyCycle,
  } = usePostureMonitor();

  const [onMin, setOnMin] = useState(0.5);
  const [offMin, setOffMin] = useState(1);
  const [showSettings, setShowSettings] = useState(false);

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
