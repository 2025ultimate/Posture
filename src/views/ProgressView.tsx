import { memo, useMemo, useState } from "react";
import type { Adherence, ProgramState } from "../apt/program";
import { clearProgramData, getLevel } from "../apt/program";
import {
  clearAssessmentData,
  getSelfTest,
  latestSelfTest,
  loadBreaks,
  loadPhotoChecks,
  loadSelfTests,
  optionForResult,
} from "../apt/assessments";
import { computeInsights, loadHistory, clearHistory } from "../sessionHistory";
import type { Insights } from "../sessionHistory";
import { lastNDayKeys } from "../apt/storage";
import { EXERCISES } from "../apt/exercises";
import { loadSetLog, summarizeLog } from "../apt/strengthLog";
import { IconFlame } from "./Icons";

interface ProgressViewProps {
  adherence: Adherence;
  programState: ProgramState;
  sessionsVersion: number;
  assessVersion: number;
  onProgramCleared: () => void;
  onAssessCleared: () => void;
}

function ProgressViewInner({
  adherence,
  programState,
  sessionsVersion,
  assessVersion,
  onProgramCleared,
  onAssessCleared,
}: ProgressViewProps) {
  const [historyBump, setHistoryBump] = useState(0);

  const insights = useMemo<Insights>(
    () => computeInsights(loadHistory()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionsVersion, historyBump]
  );

  const photoChecks = useMemo(() => {
    void assessVersion;
    return loadPhotoChecks();
  }, [assessVersion]);

  const selfTests = useMemo(() => {
    void assessVersion;
    return loadSelfTests();
  }, [assessVersion]);

  const strength = useMemo(() => {
    // Refreshes when a routine completes (adherence recomputes).
    void adherence;
    return summarizeLog(loadSetLog());
  }, [adherence]);

  const breakStats = useMemo(() => {
    void assessVersion;
    const breaks = loadBreaks();
    const week = new Set(lastNDayKeys(7));
    const thisWeek = breaks.filter((b) => week.has(b.day));
    const avgSeated =
      thisWeek.length > 0
        ? Math.round(thisWeek.reduce((s, b) => s + b.seatedMin, 0) / thisWeek.length)
        : 0;
    return { total: breaks.length, thisWeek: thisWeek.length, avgSeated };
  }, [assessVersion]);

  const handleClearDesk = () => {
    if (window.confirm("Clear all desk session history? This cannot be undone.")) {
      clearHistory();
      setHistoryBump((b) => b + 1);
    }
  };

  const handleClearProgram = () => {
    if (
      window.confirm(
        "Clear routine history, check-ins and self-tests? This cannot be undone."
      )
    ) {
      clearProgramData();
      clearAssessmentData();
      onProgramCleared();
      onAssessCleared();
    }
  };

  return (
    <div className="view progress-view">
      <div className="view-head">
        <h1 className="view-title">Progress</h1>
        <p className="view-sub">
          Tilt correction is slow and boring — which is why seeing the trend
          matters. Everything here stays on this device.
        </p>
      </div>

      <div className="progress-streak-card">
        <div className="progress-streak-row">
          <div className="insights-stat">
            <div className="insights-stat-value streak-value">
              <IconFlame size={20} />
              {adherence.currentStreak}
            </div>
            <div className="insights-stat-label">Current streak</div>
          </div>
          <div className="insights-stat">
            <div className="insights-stat-value">{adherence.bestStreak}</div>
            <div className="insights-stat-label">Best streak</div>
          </div>
          <div className="insights-stat">
            <div className="insights-stat-value">{adherence.totalSessions}</div>
            <div className="insights-stat-label">Routines</div>
          </div>
          <div className="insights-stat">
            <div className="insights-stat-value">{adherence.totalMinutes}m</div>
            <div className="insights-stat-label">Trained</div>
          </div>
        </div>
        <div className="progress-cal" aria-label="Last 4 weeks of routines">
          {adherence.last28.map((d) => (
            <span
              key={d.day}
              className={`progress-cal-cell ${d.done ? "progress-cal-done" : ""}`}
              title={`${d.day}${d.done ? " — routine done" : ""}`}
            />
          ))}
        </div>
        <p className="progress-cal-caption">
          Last 4 weeks · currently on {getLevel(programState.level).name}
        </p>
      </div>

      <div className="progress-section-card">
        <h3 className="metrics-title">Posture checks</h3>
        {photoChecks.length === 0 ? (
          <p className="progress-empty">
            No camera check-ins yet. Take one on the Check tab to set your
            baseline — future checks land here as a trend.
          </p>
        ) : (
          <div className="photo-trend">
            {photoChecks.slice(-8).map((c, i, arr) => {
              const prev = i > 0 ? arr[i - 1] : null;
              const delta = prev ? c.score - prev.score : 0;
              return (
                <div key={c.ts} className="photo-trend-row">
                  <span className="photo-trend-date">
                    {new Date(c.ts).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <div className="photo-trend-bar">
                    <div
                      className="photo-trend-fill"
                      style={{
                        width: `${c.score}%`,
                        background:
                          c.score >= 80 ? "#22c55e" : c.score >= 60 ? "#f59e0b" : "#ef4444",
                      }}
                    />
                  </div>
                  <span className="photo-trend-score">{c.score}</span>
                  {prev && delta !== 0 && (
                    <span
                      className={`photo-trend-delta ${delta > 0 ? "delta-up" : "delta-down"}`}
                    >
                      {delta > 0 ? `▲${delta}` : `▼${-delta}`}
                    </span>
                  )}
                  <span className="photo-trend-metrics">
                    hips {fmtPct(c.metrics.hipShiftPct)} · head{" "}
                    {fmtPct(c.metrics.forwardHeadPct)} · lean{" "}
                    {fmtPct(c.metrics.trunkLeanPct)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="progress-section-card">
        <h3 className="metrics-title">Self-tests</h3>
        {(["wall", "thomas"] as const).map((id) => {
          const def = getSelfTest(id);
          const latest = latestSelfTest(selfTests, id);
          if (!latest) {
            return (
              <p key={id} className="progress-empty">
                {def.name}: not taken yet.
              </p>
            );
          }
          let text: string;
          let severity: "ok" | "watch" | "high";
          if (typeof latest.result === "string") {
            const opt = optionForResult(def, latest.result);
            text = opt?.label ?? latest.result;
            severity = opt?.severity ?? "ok";
          } else {
            const l = optionForResult(def, latest.result.left);
            const r = optionForResult(def, latest.result.right);
            text = `Left: ${l?.label ?? "—"} · Right: ${r?.label ?? "—"}`;
            severity = [l, r].some((o) => o?.severity === "high")
              ? "high"
              : [l, r].some((o) => o?.severity === "watch")
                ? "watch"
                : "ok";
          }
          return (
            <div key={id} className={`selftest-latest finding-${severity}`}>
              <span>
                <strong>{def.name.split(" — ")[0]}:</strong> {text}
              </span>
              <span className="selftest-when">
                {new Date(latest.ts).toLocaleDateString()}
              </span>
            </div>
          );
        })}
      </div>

      <div className="progress-section-card">
        <h3 className="metrics-title">Sitting breaks</h3>
        <div className="insights-stats">
          <Stat value={String(breakStats.thisWeek)} label="Breaks this week" />
          <Stat
            value={breakStats.avgSeated > 0 ? `${breakStats.avgSeated}m` : "—"}
            label="Avg sit before break"
            tone={
              breakStats.avgSeated === 0
                ? undefined
                : breakStats.avgSeated <= 45
                  ? "good"
                  : breakStats.avgSeated <= 60
                    ? "warn"
                    : "bad"
            }
          />
          <Stat value={String(breakStats.total)} label="All time" />
        </div>
        <p className="progress-empty">
          Logged automatically when you stand up for 2+ minutes while Desk
          guard is running.
        </p>
      </div>

      {strength.length > 0 && (
        <div className="progress-section-card">
          <h3 className="metrics-title">Strength log</h3>
          {strength.slice(0, 6).map((p) => {
            const name = EXERCISES[p.exerciseId]?.name ?? p.exerciseId;
            const lastLabel = `${p.last.weightKg != null ? `${p.last.weightKg} kg × ` : ""}${p.last.reps}`;
            const bestLabel =
              p.bestWeightKg != null ? `${p.bestWeightKg} kg` : `${p.bestReps} reps`;
            return (
              <div key={p.exerciseId} className="strength-row">
                <span className="strength-name">{name}</span>
                <span className="strength-meta">
                  last {lastLabel} ·{" "}
                  {new Date(p.last.ts).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span className="strength-best">best {bestLabel}</span>
              </div>
            );
          })}
          <p className="progress-empty">
            Logged from the routine player on loaded strength exercises. Add
            weight when 3 sets feel easy.
          </p>
        </div>
      )}

      {insights.totalSessions > 0 && (
        <InsightsCard insights={insights} onClear={handleClearDesk} />
      )}

      <div className="progress-danger">
        <button className="insights-clear" onClick={handleClearProgram}>
          Clear routine &amp; check-in history
        </button>
      </div>
    </div>
  );
}

function fmtPct(v: number): string {
  return `${v > 0 ? "+" : ""}${v}%`;
}

// ---- Desk insights (moved from the old single-page App) ------------------

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
        <h3 className="metrics-title">Desk sessions</h3>
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

// Memoized: the app root re-renders ~10×/s while desk monitoring runs.
export const ProgressView = memo(ProgressViewInner);
