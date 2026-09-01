import { memo, useMemo, useState } from "react";
import type { Adherence, LevelId, ProgramLevel, ProgramState } from "../apt/program";
import {
  getLevel,
  LEVELS,
  levelUpSuggestion,
  routineMinutes,
  tipOfTheDay,
} from "../apt/program";
import { getExercise } from "../apt/exercises";
import {
  getSelfTest,
  latestSelfTest,
  loadPhotoChecks,
  loadSelfTests,
  optionForResult,
} from "../apt/assessments";
import { dayKey } from "../apt/storage";
import { previewLine } from "../apt/motivation";
import {
  dismissInstall,
  isInstallDismissed,
  isIOS,
  useInstallPrompt,
} from "../useInstallPrompt";
import { useNow } from "../useNow";
import { usePersistedState } from "../usePersistedState";
import type { AudioCues } from "../useAudioCues";
import {
  resolveVoice,
  useVoices,
  VOICE_RATE_KEY,
  VOICE_URI_KEY,
} from "../voiceStore";
import { IconCheck, IconDesk, IconFlame, IconLearn, IconPlay } from "./Icons";
import type { Tab } from "./tabs";

interface TodayViewProps {
  programState: ProgramState;
  adherence: Adherence;
  assessVersion: number;
  onChangeLevel: (id: LevelId) => void;
  onStartRoutine: (level: ProgramLevel) => void;
  goTo: (tab: Tab) => void;
  audio: AudioCues;
  voiceOn: boolean;
  setVoiceOn: (on: boolean) => void;
}

const LEVEL_DISMISS_KEY = "postureguard.apt.levelUpDismissed";

// Memoized: the app root re-renders ~10×/s while desk monitoring runs,
// and this view's props only change on program/assessment updates.
export const TodayView = memo(function TodayView({
  programState,
  adherence,
  assessVersion,
  onChangeLevel,
  onStartRoutine,
  goTo,
  audio,
  voiceOn,
  setVoiceOn,
}: TodayViewProps) {
  const level = getLevel(programState.level);
  const [dismissBump, setDismissBump] = useState(0);
  // Minute-resolution clock keeps render pure (no Date.now in render).
  const now = useNow(60000);

  const suggestion = useMemo(() => {
    void dismissBump;
    const next = levelUpSuggestion(programState, adherence);
    if (!next) return null;
    try {
      if (window.localStorage.getItem(LEVEL_DISMISS_KEY) === dayKey()) return null;
    } catch {
      // ignore
    }
    return next;
  }, [programState, adherence, dismissBump]);

  const dismissSuggestion = () => {
    try {
      window.localStorage.setItem(LEVEL_DISMISS_KEY, dayKey());
    } catch {
      // ignore
    }
    setDismissBump((b) => b + 1);
  };

  const assessmentNudge = useMemo(() => {
    void assessVersion;
    const photos = loadPhotoChecks();
    const tests = loadSelfTests();
    if (photos.length === 0 && tests.length === 0) {
      return {
        text: "Start with a baseline: take the side-view posture check and the two 1-minute self-tests. Everything after gets measured against today.",
        cta: "Do the first check",
      };
    }
    const lastTs = Math.max(
      photos.length ? photos[photos.length - 1].ts : 0,
      tests.length ? tests[tests.length - 1].ts : 0
    );
    const daysAgo = Math.floor((now - lastTs) / 86400000);
    if (daysAgo >= 21) {
      return {
        text: `Your last check-in was ${daysAgo} days ago. Re-measure so the work shows up in numbers.`,
        cta: "Re-check now",
      };
    }
    return null;
  }, [assessVersion, now]);

  const latestFindings = useMemo(() => {
    void assessVersion;
    const tests = loadSelfTests();
    const out: string[] = [];
    const wall = latestSelfTest(tests, "wall");
    if (wall && typeof wall.result === "string") {
      const opt = optionForResult(getSelfTest("wall"), wall.result);
      if (opt && opt.severity !== "ok") {
        out.push("Wall test showed a pronounced lumbar arch — the pelvic tilt drills and hip flexor stretch are your priority.");
      }
    }
    const thomas = latestSelfTest(tests, "thomas");
    if (thomas && typeof thomas.result === "object") {
      const def = getSelfTest("thomas");
      const l = optionForResult(def, thomas.result.left);
      const r = optionForResult(def, thomas.result.right);
      const tightSides = [l?.severity !== "ok" ? "left" : null, r?.severity !== "ok" ? "right" : null].filter(Boolean);
      if (tightSides.length > 0) {
        out.push(
          `Thomas test flagged tight hip flexors (${tightSides.join(" & ")}) — hold today's stretches the full time, no rushing.`
        );
      }
    }
    return out;
  }, [assessVersion]);

  const hour = new Date(now).getHours();
  const greeting = hour < 5 ? "Late night" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const dateLabel = new Date(now).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const minutes = routineMinutes(level);

  return (
    <div className="view today-view">
      <div className="today-hero">
        <div>
          <p className="today-date">{dateLabel}</p>
          <h1 className="today-greeting">{greeting}</h1>
          <p className="today-sub">
            Anterior pelvic tilt gives in to consistency — one short routine a
            day plus fewer unbroken sitting hours.
          </p>
        </div>
        <div className={`streak-chip ${adherence.currentStreak > 0 ? "streak-chip-hot" : ""}`}>
          <IconFlame size={18} />
          <span className="streak-num">{adherence.currentStreak}</span>
          <span className="streak-label">day streak</span>
        </div>
      </div>

      {suggestion && (
        <div className="levelup-banner">
          <div>
            <strong>Ready to level up?</strong>
            <p>
              You've completed {adherence.daysOnCurrentLevel} days on{" "}
              {level.name}. {getLevel(suggestion).name} adds load — that's where
              lasting change comes from.
            </p>
          </div>
          <div className="levelup-actions">
            <button className="btn btn-primary" onClick={() => onChangeLevel(suggestion)}>
              Move up
            </button>
            <button className="btn btn-secondary" onClick={dismissSuggestion}>
              Not yet
            </button>
          </div>
        </div>
      )}

      <div className="routine-card">
        <div className="routine-card-head">
          <div>
            <h3 className="metrics-title">Today's routine</h3>
            <p className="routine-level-name">{level.name}</p>
          </div>
          <span className="routine-minutes">~{minutes} min</span>
        </div>
        <p className="routine-blurb">{level.blurb}</p>
        <div className="routine-exercises">
          {level.items.map((item) => {
            const ex = getExercise(item.exerciseId);
            return (
              <span key={item.exerciseId} className={`routine-ex routine-ex-${ex.category}`}>
                {ex.name}
              </span>
            );
          })}
        </div>
        {adherence.completedToday ? (
          <div className="routine-done-row">
            <span className="routine-done-badge">✓ Done today</span>
            <button className="btn btn-secondary" onClick={() => onStartRoutine(level)}>
              <IconPlay size={14} />
              Repeat
            </button>
          </div>
        ) : (
          <button className="btn btn-primary routine-start" onClick={() => onStartRoutine(level)}>
            <IconPlay size={16} />
            Start routine
          </button>
        )}
        <div className="week-dots" aria-label="Last 7 days">
          {adherence.last7.map((d) => (
            <div key={d.day} className="week-dot-wrap">
              <span className={`week-dot ${d.done ? "week-dot-done" : ""}`} />
              <span className="week-dot-day">
                {new Date(`${d.day}T12:00:00`).toLocaleDateString(undefined, { weekday: "narrow" })}
              </span>
            </div>
          ))}
        </div>
      </div>

      <InstallCard />

      {(assessmentNudge || latestFindings.length > 0) && (
        <div className="coach-card">
          <h3 className="metrics-title">From your check-ins</h3>
          {latestFindings.map((f, i) => (
            <p key={i} className="coach-line">
              {f}
            </p>
          ))}
          {assessmentNudge && (
            <>
              <p className="coach-line">{assessmentNudge.text}</p>
              <button className="btn btn-secondary" onClick={() => goTo("check")}>
                {assessmentNudge.cta}
              </button>
            </>
          )}
        </div>
      )}

      <div className="tip-card">
        <span className="tip-label">Coach note</span>
        <p>{tipOfTheDay()}</p>
      </div>

      <VoiceCoachCard audio={audio} voiceOn={voiceOn} setVoiceOn={setVoiceOn} />

      <div className="quick-grid">
        <button className="quick-tile" onClick={() => goTo("check")}>
          <IconCheck />
          <span className="quick-tile-title">Posture check</span>
          <span className="quick-tile-sub">Side-view camera + self-tests</span>
        </button>
        <button className="quick-tile" onClick={() => goTo("desk")}>
          <IconDesk />
          <span className="quick-tile-title">Desk guard</span>
          <span className="quick-tile-sub">Sitting breaks + live posture</span>
        </button>
        <button className="quick-tile" onClick={() => goTo("learn")}>
          <IconLearn />
          <span className="quick-tile-title">Understand APT</span>
          <span className="quick-tile-sub">What it is, what fixes it</span>
        </button>
      </div>

      <div className="level-picker">
        <h3 className="metrics-title">Program level</h3>
        <div className="level-options">
          {LEVELS.map((l) => (
            <button
              key={l.id}
              className={`level-option ${l.id === programState.level ? "level-option-active" : ""}`}
              onClick={() => {
                if (l.id === programState.level) return;
                if (
                  window.confirm(
                    `Switch to ${l.name}? Your level timer restarts, completed days are kept.`
                  )
                ) {
                  onChangeLevel(l.id);
                }
              }}
            >
              <span className="level-option-name">{l.name}</span>
              <span className="level-option-blurb">{l.blurb}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});

// ---- Voice coach settings ------------------------------------------------

function VoiceCoachCard({
  audio,
  voiceOn,
  setVoiceOn,
}: {
  audio: AudioCues;
  voiceOn: boolean;
  setVoiceOn: (on: boolean) => void;
}) {
  const voices = useVoices();
  const [uri, setUri] = usePersistedState<string | null>(VOICE_URI_KEY, null);
  const [rate, setRate] = usePersistedState<number>(VOICE_RATE_KEY, 0.95);

  const englishVoices = useMemo(() => {
    const en = voices.filter((v) => v.lang?.toLowerCase().startsWith("en"));
    const list = en.length > 0 ? en : voices;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [voices]);

  const autoVoice = useMemo(() => resolveVoice(voices, null), [voices]);
  const supported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  return (
    <div className="voice-card">
      <div className="sitting-head">
        <div>
          <h3 className="metrics-title">Voice coach</h3>
          <p className="exercises-sub">
            Spoken cues and encouragement during routines — on-device, works
            offline. Phone voices are usually the most natural.
          </p>
        </div>
        <label className="habit-toggle" title="Enable voice coach">
          <input
            type="checkbox"
            checked={voiceOn}
            onChange={(e) => setVoiceOn(e.target.checked)}
          />
          <span className="habit-toggle-slider" />
        </label>
      </div>

      {!supported && (
        <p className="sitting-idle-note">
          This browser doesn't support speech synthesis.
        </p>
      )}

      {supported && voiceOn && (
        <div className="voice-controls">
          <label className="settings-label voice-select-label">
            Voice
            <select
              className="voice-select"
              value={uri ?? ""}
              onChange={(e) => setUri(e.target.value === "" ? null : e.target.value)}
            >
              <option value="">
                Auto{autoVoice ? ` — ${autoVoice.name}` : ""}
              </option>
              {englishVoices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </label>
          <label className="settings-label voice-rate-label">
            Speed · {rate.toFixed(2)}×
            <input
              type="range"
              min={0.75}
              max={1.25}
              step={0.05}
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              className="voice-rate"
            />
          </label>
          <button
            className="btn btn-secondary voice-preview"
            onClick={() => audio.speak(previewLine())}
          >
            Hear a sample
          </button>
        </div>
      )}
    </div>
  );
}

// ---- Install-to-home-screen card -----------------------------------------

function InstallCard() {
  const { canPrompt, standalone, install } = useInstallPrompt();
  const [dismissBump, setDismissBump] = useState(0);

  const dismissed = useMemo(() => {
    void dismissBump;
    return isInstallDismissed();
  }, [dismissBump]);

  const showIOSHint = !canPrompt && isIOS();
  if (standalone || dismissed || (!canPrompt && !showIOSHint)) return null;

  return (
    <div className="install-card">
      <div className="install-card-body">
        <strong>Put PostureGuard on your home screen</strong>
        <p>
          Full-screen app, works offline, opens in one tap — routines and
          check-ins feel like a native app.
        </p>
        {showIOSHint && (
          <p className="install-ios-hint">
            In Safari: tap <strong>Share</strong> → <strong>Add to Home
            Screen</strong>.
          </p>
        )}
      </div>
      <div className="install-card-actions">
        {canPrompt && (
          <button className="btn btn-primary" onClick={() => void install()}>
            Install app
          </button>
        )}
        <button
          className="install-dismiss"
          onClick={() => {
            dismissInstall();
            setDismissBump((b) => b + 1);
          }}
          aria-label="Dismiss install suggestion"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
