import { useEffect, useMemo, useState } from "react";
import {
  filterLibrary,
  libraryImageUrl,
  LIBRARY_MUSCLES,
  loadLibrary,
} from "../apt/exerciseLibrary";
import type { LibraryExercise } from "../apt/exerciseLibrary";
import { youtubeSearchUrl } from "../apt/exercises";

// Browsable catalogue of 876 public-domain exercises (Free Exercise DB).
// The data chunk loads on first open; photos load per-exercise on demand
// and are then cached offline by the service worker.

const PAGE = 40;

export function LibraryPanel() {
  const [all, setAll] = useState<LibraryExercise[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState<string | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [aptOnly, setAptOnly] = useState(true);
  const [limit, setLimit] = useState(PAGE);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadLibrary()
      .then((db) => {
        if (!cancelled) setAll(db);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const results = useMemo(() => {
    if (!all) return [];
    return filterLibrary(all, { query, muscle, level, aptOnly });
  }, [all, query, muscle, level, aptOnly]);

  const shown = results.slice(0, limit);

  if (failed) {
    return <p className="progress-empty">Couldn't load the exercise library.</p>;
  }
  if (!all) {
    return (
      <p className="progress-empty">
        <span className="spinner" /> Loading the library…
      </p>
    );
  }

  return (
    <div className="library">
      <p className="library-intro">
        {all.length} exercises from the public-domain{" "}
        <a
          className="footer-link"
          href="https://github.com/yuhonas/free-exercise-db"
          target="_blank"
          rel="noopener noreferrer"
        >
          Free Exercise DB
        </a>
        . Your daily routine stays the curated APT program — use this to swap
        in variety or explore. Photos load on first view and then work
        offline.
      </p>

      <input
        type="search"
        className="library-search"
        placeholder="Search exercises…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setLimit(PAGE);
        }}
      />

      <div className="library-filters">
        <button
          className={`selftest-option ${aptOnly ? "selftest-option-active" : ""}`}
          onClick={() => {
            setAptOnly(!aptOnly);
            setLimit(PAGE);
          }}
        >
          APT-relevant
        </button>
        <select
          className="voice-select library-select"
          value={muscle ?? ""}
          onChange={(e) => {
            setMuscle(e.target.value || null);
            setLimit(PAGE);
          }}
        >
          <option value="">Any muscle</option>
          {LIBRARY_MUSCLES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select
          className="voice-select library-select"
          value={level ?? ""}
          onChange={(e) => {
            setLevel(e.target.value || null);
            setLimit(PAGE);
          }}
        >
          <option value="">Any level</option>
          <option value="beginner">beginner</option>
          <option value="intermediate">intermediate</option>
          <option value="expert">expert</option>
        </select>
        <span className="library-count">{results.length} found</span>
      </div>

      <div className="library-list">
        {shown.map((e) => (
          <LibraryRow
            key={e.id}
            exercise={e}
            open={openId === e.id}
            onToggle={() => setOpenId(openId === e.id ? null : e.id)}
          />
        ))}
      </div>

      {results.length > limit && (
        <button
          className="btn btn-secondary library-more"
          onClick={() => setLimit(limit + PAGE)}
        >
          Show {Math.min(PAGE, results.length - limit)} more
        </button>
      )}
    </div>
  );
}

function LibraryRow({
  exercise,
  open,
  onToggle,
}: {
  exercise: LibraryExercise;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`library-row ${open ? "library-row-open" : ""}`}>
      <button className="library-row-head" onClick={onToggle}>
        <div className="library-row-title">
          <span className="library-row-name">{exercise.name}</span>
          <span className="library-row-meta">
            {exercise.primaryMuscles.join(", ")}
            {exercise.level ? ` · ${exercise.level}` : ""}
            {exercise.equipment && exercise.equipment !== "body only"
              ? ` · ${exercise.equipment}`
              : ""}
          </span>
        </div>
        <span className="library-row-chev">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="library-row-body">
          {exercise.images.length > 0 && (
            <div className="library-images">
              {exercise.images.slice(0, 2).map((img) => (
                <img
                  key={img}
                  src={libraryImageUrl(img)}
                  alt={`${exercise.name} demonstration`}
                  loading="lazy"
                  onError={(ev) => {
                    (ev.target as HTMLImageElement).hidden = true;
                  }}
                />
              ))}
            </div>
          )}
          <ol className="check-steps">
            {exercise.instructions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          <a
            className="demo-link"
            href={youtubeSearchUrl(`${exercise.name} exercise form`)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Watch a real demo on YouTube <span className="demo-link-ext">↗</span>
          </a>
        </div>
      )}
    </div>
  );
}
