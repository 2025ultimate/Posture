import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePostureMonitor } from "./usePostureMonitor";
import { useHabitReminders } from "./useHabitReminders";
import { useAudioCues } from "./useAudioCues";
import { useSittingCoach } from "./useSittingCoach";
import { usePersistedState } from "./usePersistedState";
import {
  addCompletion,
  computeAdherence,
  loadCompletions,
  loadProgramState,
  saveProgramState,
} from "./apt/program";
import type { LevelId, ProgramLevel, ProgramState } from "./apt/program";
import { TodayView } from "./views/TodayView";
import { CheckView } from "./views/CheckView";
import { DeskView } from "./views/DeskView";
import { ProgressView } from "./views/ProgressView";
import { LearnView } from "./views/LearnView";
import { RoutinePlayer } from "./views/RoutinePlayer";
import type { RoutineOutcome } from "./views/RoutinePlayer";
import { TABS, TAB_LABELS } from "./views/tabs";
import type { Tab } from "./views/tabs";
import {
  IconCheck,
  IconDesk,
  IconLearn,
  IconProgress,
  IconToday,
} from "./views/Icons";
import "./App.css";

type Theme = "light" | "dark";

const TAB_ICONS: Record<Tab, (p: { size?: number }) => React.ReactElement> = {
  today: IconToday,
  check: IconCheck,
  desk: IconDesk,
  progress: IconProgress,
  learn: IconLearn,
};

function readHashTab(): Tab {
  if (typeof window === "undefined") return "today";
  const h = window.location.hash.replace("#", "");
  return (TABS as string[]).includes(h) ? (h as Tab) : "today";
}

export default function App() {
  // Shared audio + the desk monitor live at the app root so monitoring
  // keeps running while the user browses other tabs.
  const audio = useAudioCues();
  const monitor = usePostureMonitor(audio.playAlert);
  const habits = useHabitReminders(
    audio.playAlert,
    audio.speak,
    monitor.state === "running" && !monitor.alertsPaused
  );
  const sittingCoach = useSittingCoach({
    monitorRunning: monitor.state === "running",
    activity: monitor.result?.activity ?? null,
    alertsPaused: monitor.alertsPaused,
    playAlert: audio.playAlert,
    speak: audio.speak,
  });

  const [theme, setTheme] = usePersistedState<Theme>("postureguard.theme", "dark");
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    // Keep the Android status bar / task-switcher color in sync with the
    // in-app theme when running as an installed PWA.
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#0f172a" : "#f6f8fb");
  }, [theme]);
  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  // Voice coach preference is shared by the routine player and the Today
  // settings card, so it lives here.
  const [voiceOn, setVoiceOnState] = usePersistedState<boolean>(
    "postureguard.apt.voiceCoach",
    true
  );
  const setVoiceOn = useCallback(
    (on: boolean) => setVoiceOnState(on),
    [setVoiceOnState]
  );

  // Tab navigation via the URL hash, tuned for the Android back button in
  // an installed PWA: switching tabs REPLACES the history entry (no long
  // back-chain of tab flips), except leaving Today pushes exactly one
  // entry — so from any tab, back returns to Today, and back from Today
  // exits the app, which is what Android users expect.
  const [tab, setTabState] = useState<Tab>(readHashTab);
  const tabRef = useRef(tab);
  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);

  const setTab = useCallback((t: Tab) => {
    const prev = tabRef.current;
    if (prev === t) return;
    if (prev === "today" && t !== "today") {
      window.history.pushState({ tab: t }, "", `#${t}`);
    } else {
      window.history.replaceState({ tab: t }, "", `#${t}`);
    }
    setTabState(t);
  }, []);

  useEffect(() => {
    // Manual URL edits still work (replace/pushState don't fire this).
    const onHash = () => setTabState(readHashTab());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Program state + change counters that tell views to re-read storage.
  const [programState, setProgramState] = useState<ProgramState>(loadProgramState);
  const [programVersion, setProgramVersion] = useState(0);
  const [assessVersion, setAssessVersion] = useState(0);

  const changeLevel = useCallback((id: LevelId) => {
    const next: ProgramState = { level: id, levelStartedAt: Date.now() };
    saveProgramState(next);
    setProgramState(next);
  }, []);

  const adherence = useMemo(
    () => computeAdherence(loadCompletions(), programState),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [programVersion, programState]
  );

  const bumpProgram = useCallback(() => setProgramVersion((v) => v + 1), []);
  const bumpAssess = useCallback(() => setAssessVersion((v) => v + 1), []);

  const [playerLevel, setPlayerLevel] = useState<ProgramLevel | null>(null);
  const playerLevelRef = useRef<ProgramLevel | null>(null);
  useEffect(() => {
    playerLevelRef.current = playerLevel;
  }, [playerLevel]);
  // History bookkeeping so the Android back button closes the routine
  // player (with a confirm) instead of exiting the app mid-routine.
  const playerPushedRef = useRef(false);
  const ignorePopRef = useRef(false);

  const openRoutine = useCallback((level: ProgramLevel) => {
    setPlayerLevel(level);
    window.history.pushState({ overlay: "player" }, "");
    playerPushedRef.current = true;
  }, []);

  const handlePlayerExit = useCallback(
    (outcome: RoutineOutcome | null) => {
      if (outcome && playerLevel) {
        addCompletion({
          levelId: playerLevel.id,
          minutes: outcome.minutes,
          completedSteps: outcome.completedSteps,
          totalSteps: outcome.totalSteps,
        });
        setProgramVersion((v) => v + 1);
      }
      setPlayerLevel(null);
      // Consume the history entry the player pushed, without treating the
      // resulting popstate as a back-press.
      if (playerPushedRef.current) {
        playerPushedRef.current = false;
        ignorePopRef.current = true;
        window.history.back();
      }
    },
    [playerLevel]
  );

  useEffect(() => {
    const onPop = () => {
      if (ignorePopRef.current) {
        ignorePopRef.current = false;
        return;
      }
      if (playerLevelRef.current) {
        // System back while the routine player is open: its entry has
        // already been popped. Confirm, and re-push to stay if declined.
        playerPushedRef.current = false;
        if (window.confirm("Leave the routine? Progress today won't be saved.")) {
          setPlayerLevel(null);
        } else {
          window.history.pushState({ overlay: "player" }, "");
          playerPushedRef.current = true;
        }
        return;
      }
      setTabState(readHashTab());
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const monitoringLive = monitor.state === "running";

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <button className="logo logo-btn" onClick={() => setTab("today")}>
            <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="7" r="4" fill="currentColor" className="logo-accent" />
              <path d="M14 11 L14 20" stroke="currentColor" className="logo-accent" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M8 14 L14 12 L20 14" stroke="currentColor" className="logo-accent" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14 20 L10 26" stroke="currentColor" className="logo-accent" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M14 20 L18 26" stroke="currentColor" className="logo-accent" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <div className="logo-text">
              <span className="logo-name">PostureGuard</span>
              <span className="logo-tagline">pelvic tilt coach</span>
            </div>
          </button>

          <nav className="nav-desktop" aria-label="Sections">
            {TABS.map((t) => {
              const Icon = TAB_ICONS[t];
              return (
                <button
                  key={t}
                  className={`nav-desktop-item ${tab === t ? "nav-item-active" : ""}`}
                  onClick={() => setTab(t)}
                >
                  <Icon size={17} />
                  {TAB_LABELS[t]}
                </button>
              );
            })}
          </nav>

          <div className="header-right">
            {monitoringLive && tab !== "desk" && (
              <button
                className={`live-badge live-badge-btn ${monitor.alertsPaused ? "live-badge-muted" : ""}`}
                onClick={() => setTab("desk")}
                title="Desk monitoring is running — open Desk"
              >
                <span className="live-dot" />
                {monitor.alertsPaused ? "MUTED" : "LIVE"}
              </button>
            )}
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            >
              {theme === "dark" ? (
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
          </div>
        </div>
      </header>

      <main className="main">
        {/* All views stay mounted so the desk monitor keeps streaming and
            timers keep ticking while the user browses other tabs. */}
        <div className="view-slot" hidden={tab !== "today"}>
          <TodayView
            programState={programState}
            adherence={adherence}
            assessVersion={assessVersion}
            onChangeLevel={changeLevel}
            onStartRoutine={openRoutine}
            goTo={setTab}
            audio={audio}
            voiceOn={voiceOn}
            setVoiceOn={setVoiceOn}
          />
        </div>
        <div className="view-slot" hidden={tab !== "check"}>
          <CheckView
            active={tab === "check"}
            audio={audio}
            assessVersion={assessVersion}
            onSaved={bumpAssess}
          />
        </div>
        <div className="view-slot" hidden={tab !== "desk"}>
          <DeskView
            monitor={monitor}
            habits={habits}
            sittingCoach={sittingCoach}
            audio={audio}
          />
        </div>
        <div className="view-slot" hidden={tab !== "progress"}>
          <ProgressView
            adherence={adherence}
            programState={programState}
            sessionsVersion={monitor.sessionsVersion}
            assessVersion={assessVersion}
            onProgramCleared={bumpProgram}
            onAssessCleared={bumpAssess}
          />
        </div>
        <div className="view-slot" hidden={tab !== "learn"}>
          <LearnView />
        </div>
      </main>

      <nav className="tabbar" aria-label="Sections">
        {TABS.map((t) => {
          const Icon = TAB_ICONS[t];
          return (
            <button
              key={t}
              className={`tabbar-item ${tab === t ? "nav-item-active" : ""}`}
              onClick={() => setTab(t)}
            >
              <span className="tabbar-icon">
                <Icon />
                {t === "desk" && monitoringLive && <span className="tabbar-live-dot" />}
              </span>
              {TAB_LABELS[t]}
            </button>
          );
        })}
      </nav>

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
          <span className="footer-dot">·</span>
          <span>not medical advice</span>
        </div>
      </footer>

      {playerLevel && (
        <RoutinePlayer
          level={playerLevel}
          audio={audio}
          streakDays={
            adherence.completedToday
              ? adherence.currentStreak
              : adherence.currentStreak + 1
          }
          voiceOn={voiceOn}
          setVoiceOn={setVoiceOn}
          onExit={handlePlayerExit}
        />
      )}
    </div>
  );
}
