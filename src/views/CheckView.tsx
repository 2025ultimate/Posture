import { memo, useEffect, useMemo, useState } from "react";
import { useSnapshotCamera } from "../useSnapshotCamera";
import type { AudioCues } from "../useAudioCues";
import { FRAMING_MESSAGES } from "../apt/sideView";
import {
  addPhotoCheck,
  addSelfTest,
  latestSelfTest,
  loadPhotoChecks,
  loadSelfTests,
  optionForResult,
  SELF_TESTS,
} from "../apt/assessments";
import type { SelfTestDef } from "../apt/assessments";
import { DemoLink } from "./DemoLink";
import { ExerciseFigure } from "./ExerciseFigure";
import { IconFlip } from "./Icons";

// The posture check: a guided side-view camera capture (alignment proxy
// metrics, tracked over time) plus the two manual self-tests that gauge
// the pelvis directly. Honesty note shown in the UI: a pose model can't
// measure clinical pelvic tilt angles; trends are the signal.

interface CheckViewProps {
  active: boolean;
  audio: AudioCues;
  onSaved: () => void;
  assessVersion: number;
}

function CheckViewInner({ active, audio, onSaved, assessVersion }: CheckViewProps) {
  const {
    videoRef,
    overlayRef,
    state: camState,
    guidance,
    countdown,
    result,
    error: camError,
    start,
    stop,
    flip,
    beginCapture,
    cancelCapture,
    retake,
  } = useSnapshotCamera(audio);
  const [saved, setSaved] = useState(false);
  const [mode, setMode] = useState<"camera" | "tests">("camera");

  // Leaving the tab (or switching to self-tests) releases the camera.
  // Deferred a tick so the state updates land outside the effect body.
  useEffect(() => {
    if ((!active || mode !== "camera") && camState !== "idle") {
      const id = setTimeout(stop, 0);
      return () => clearTimeout(id);
    }
  }, [active, mode, camState, stop]);

  const lastCheck = useMemo(() => {
    void assessVersion;
    const checks = loadPhotoChecks();
    return checks.length ? checks[checks.length - 1] : null;
  }, [assessVersion]);

  const cameraActive =
    camState === "live" || camState === "counting" || camState === "capturing";

  return (
    <div className="view check-view">
      <div className="view-head">
        <h1 className="view-title">Posture check</h1>
        <p className="view-sub">
          Measure the pattern, then track it. Repeat every 2–4 weeks — same
          spot, same clothes, relaxed stance.
        </p>
      </div>

      <div className="seg">
        <button
          className={`seg-btn ${mode === "camera" ? "seg-btn-active" : ""}`}
          onClick={() => setMode("camera")}
        >
          Camera check
        </button>
        <button
          className={`seg-btn ${mode === "tests" ? "seg-btn-active" : ""}`}
          onClick={() => setMode("tests")}
        >
          Self-tests
        </button>
      </div>

      {mode === "camera" && (
        <>
          {camState === "idle" || camState === "error" ? (
            <div className="check-intro">
              <div className="check-setup-card">
                <h3 className="metrics-title">Set up (1 minute)</h3>
                <ol className="check-steps">
                  <li>Prop your phone upright at hip height, 2–3 m (7–10 ft) away — or hand it to someone.</li>
                  <li>Wear fitted clothes so your hips are visible.</li>
                  <li>Stand <strong>sideways</strong> to the camera, whole body in frame.</li>
                  <li>March in place for 3 steps, then stand how you naturally stand. Look straight ahead.</li>
                </ol>
                {camError && <div className="error-msg">{camError}</div>}
                <button className="btn btn-primary" onClick={() => void start()}>
                  Start camera
                </button>
                <p className="privacy-line">
                  Analysis runs on your device. No photo is stored or uploaded —
                  only the measured angles are saved.
                </p>
              </div>
              {lastCheck && (
                <p className="last-check-line">
                  Last check: score {lastCheck.score} ·{" "}
                  {new Date(lastCheck.ts).toLocaleDateString()}
                </p>
              )}
            </div>
          ) : (
            <div className="check-camera">
              <div className="check-camera-wrap">
                <video ref={videoRef} className="video-hidden" playsInline muted />
                <canvas ref={overlayRef} className="check-canvas" />
                {camState === "starting" && (
                  <div className="check-overlay-msg">
                    <span className="spinner" /> Starting camera…
                  </div>
                )}
                {cameraActive && camState !== "capturing" && (
                  <div
                    className={`check-guidance ${guidance === "ok" ? "check-guidance-ok" : ""}`}
                  >
                    {guidance === "ok"
                      ? "Framing looks good — hold your natural stance"
                      : FRAMING_MESSAGES[guidance]}
                  </div>
                )}
                {camState === "counting" && countdown !== null && (
                  <div className="check-countdown">{countdown}</div>
                )}
                {camState === "capturing" && (
                  <div className="check-guidance check-guidance-ok">
                    Hold still — measuring…
                  </div>
                )}
              </div>

              {camState === "done" && result ? (
                <div className="check-result">
                  <div className="check-score-row">
                    <div className="check-score">
                      <span className="check-score-num">{result.score}</span>
                      <span className="check-score-label">alignment score</span>
                    </div>
                    <p className="check-summary">{result.summary}</p>
                  </div>
                  <div className="check-findings">
                    {result.findings.map((f) => (
                      <div key={f.id} className={`finding finding-${f.severity}`}>
                        <div className="finding-head">
                          <span className="finding-label">{f.label}</span>
                          <span className="finding-value">{f.value}</span>
                        </div>
                        <p className="finding-detail">{f.detail}</p>
                      </div>
                    ))}
                  </div>
                  <p className="check-honesty">
                    These are alignment estimates from pose landmarks — not a
                    clinical pelvic-tilt measurement. Compare against your own
                    previous checks, not absolute norms.
                  </p>
                  <div className="check-result-actions">
                    {saved ? (
                      <span className="routine-done-badge">✓ Saved to progress</span>
                    ) : (
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          addPhotoCheck({
                            ts: Date.now(),
                            metrics: result.metrics,
                            score: result.score,
                          });
                          setSaved(true);
                          onSaved();
                        }}
                      >
                        Save result
                      </button>
                    )}
                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        setSaved(false);
                        retake();
                      }}
                    >
                      Re-take
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        setSaved(false);
                        stop();
                      }}
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                <div className="check-controls">
                  {camState === "counting" || camState === "capturing" ? (
                    <button className="btn btn-danger" onClick={cancelCapture}>
                      Cancel
                    </button>
                  ) : (
                    <>
                      <button
                        className="btn btn-primary"
                        disabled={camState !== "live"}
                        onClick={() => beginCapture(5)}
                      >
                        Capture in 5s
                      </button>
                      <button
                        className="btn btn-secondary"
                        disabled={camState !== "live"}
                        onClick={() => beginCapture(10)}
                      >
                        10s
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={flip}
                        title="Flip camera"
                      >
                        <IconFlip />
                      </button>
                      <button className="btn btn-secondary" onClick={stop}>
                        Stop
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {mode === "tests" && (
        <div className="selftests">
          <p className="selftests-intro">
            Two one-minute tests physios use. For the pelvis itself these tell
            you more than any camera — log them monthly.
          </p>
          {SELF_TESTS.map((def) => (
            <SelfTestCard key={def.id} def={def} onSaved={onSaved} assessVersion={assessVersion} />
          ))}
        </div>
      )}
    </div>
  );
}

function SelfTestCard({
  def,
  onSaved,
  assessVersion,
}: {
  def: SelfTestDef;
  onSaved: () => void;
  assessVersion: number;
}) {
  const [open, setOpen] = useState(false);
  const [leftChoice, setLeftChoice] = useState<string | null>(null);
  const [rightChoice, setRightChoice] = useState<string | null>(null);
  const [singleChoice, setSingleChoice] = useState<string | null>(null);

  const latest = useMemo(() => {
    void assessVersion;
    return latestSelfTest(loadSelfTests(), def.id);
  }, [def.id, assessVersion]);

  const latestLabel = useMemo(() => {
    if (!latest) return null;
    const when = new Date(latest.ts).toLocaleDateString();
    if (typeof latest.result === "string") {
      const opt = optionForResult(def, latest.result);
      return opt ? { text: `${opt.label} — ${opt.meaning}`, severity: opt.severity, when } : null;
    }
    const l = optionForResult(def, latest.result.left);
    const r = optionForResult(def, latest.result.right);
    if (!l || !r) return null;
    const worst = [l, r].some((o) => o.severity === "high")
      ? "high"
      : [l, r].some((o) => o.severity === "watch")
        ? "watch"
        : "ok";
    return {
      text: `Left: ${l.label} · Right: ${r.label}`,
      severity: worst as "ok" | "watch" | "high",
      when,
    };
  }, [latest, def]);

  const canSave = def.perSide ? leftChoice && rightChoice : singleChoice;

  const save = () => {
    addSelfTest({
      ts: Date.now(),
      testId: def.id,
      result: def.perSide
        ? { left: leftChoice!, right: rightChoice! }
        : singleChoice!,
    });
    setOpen(false);
    setLeftChoice(null);
    setRightChoice(null);
    setSingleChoice(null);
    onSaved();
  };

  return (
    <div className="selftest-card">
      <div className="selftest-head">
        <div>
          <h3 className="metrics-title">{def.name}</h3>
          <p className="selftest-what">{def.what}</p>
        </div>
        <button className="btn btn-secondary" onClick={() => setOpen(!open)}>
          {open ? "Close" : latest ? "Re-test" : "Take test"}
        </button>
      </div>

      {latestLabel && !open && (
        <div className={`selftest-latest finding-${latestLabel.severity}`}>
          <span>{latestLabel.text}</span>
          <span className="selftest-when">{latestLabel.when}</span>
        </div>
      )}

      {open && (
        <div className="selftest-body">
          <div className="selftest-guide">
            <ExerciseFigure id={def.id} label={def.name} size={165} />
            <div>
              <ol className="check-steps">
                {def.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
              <DemoLink query={def.videoQuery} />
            </div>
          </div>
          <p className="selftest-question">{def.question}</p>
          {def.perSide ? (
            <>
              {(["left", "right"] as const).map((side) => (
                <div key={side} className="selftest-side">
                  <span className="selftest-side-label">{side}</span>
                  <div className="selftest-options">
                    {def.options.map((o) => {
                      const chosen = side === "left" ? leftChoice : rightChoice;
                      return (
                        <button
                          key={o.id}
                          className={`selftest-option ${chosen === o.id ? "selftest-option-active" : ""}`}
                          onClick={() =>
                            side === "left" ? setLeftChoice(o.id) : setRightChoice(o.id)
                          }
                        >
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div className="selftest-options">
              {def.options.map((o) => (
                <button
                  key={o.id}
                  className={`selftest-option ${singleChoice === o.id ? "selftest-option-active" : ""}`}
                  onClick={() => setSingleChoice(o.id)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
          {canSave && (
            <div className="selftest-meaning">
              {def.perSide ? (
                <>
                  <p>{optionForResult(def, leftChoice!)?.meaning}</p>
                  {rightChoice !== leftChoice && <p>{optionForResult(def, rightChoice!)?.meaning}</p>}
                </>
              ) : (
                <p>{optionForResult(def, singleChoice!)?.meaning}</p>
              )}
            </div>
          )}
          <button className="btn btn-primary" disabled={!canSave} onClick={save}>
            Save result
          </button>
        </div>
      )}
    </div>
  );
}

// Memoized: the app root re-renders ~10×/s while desk monitoring runs.
export const CheckView = memo(CheckViewInner);
