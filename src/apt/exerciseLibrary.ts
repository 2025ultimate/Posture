// The browsable exercise library, powered by the Free Exercise DB —
// https://github.com/yuhonas/free-exercise-db, released into the public
// domain (Unlicense), 876 exercises. The stripped JSON is code-split and
// loaded only when the library is opened; exercise photos stay in the
// upstream repository and load on demand (cached by the service worker
// once viewed).
//
// This is the legal route to a big exercise catalogue: public-domain
// data we may embed in any project, versus GPL-family apps or
// proprietary GIF datasets whose content can't be copied here.

export interface LibraryExercise {
  id: string;
  name: string;
  level: "beginner" | "intermediate" | "expert" | null;
  category: string | null;
  equipment: string | null;
  mechanic: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  images: string[];
}

const IMAGE_BASE =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";

export function libraryImageUrl(path: string): string {
  return IMAGE_BASE + path;
}

let cache: LibraryExercise[] | null = null;

/** Loads the dataset chunk on first use (lazy — ~200 KB gzipped). */
export async function loadLibrary(): Promise<LibraryExercise[]> {
  if (!cache) {
    const mod = await import("./exerciseDb.json");
    cache = mod.default as LibraryExercise[];
  }
  return cache;
}

// The muscles that matter most for anterior pelvic tilt: the weak side
// to strengthen plus the tight side to stretch.
export const APT_MUSCLES = new Set([
  "glutes",
  "hamstrings",
  "abdominals",
  "quadriceps",
  "lower back",
]);

export interface LibraryFilters {
  query: string;
  muscle: string | null;
  level: string | null;
  aptOnly: boolean;
}

export function filterLibrary(
  all: LibraryExercise[],
  f: LibraryFilters
): LibraryExercise[] {
  const q = f.query.trim().toLowerCase();
  return all.filter((e) => {
    if (f.aptOnly && !e.primaryMuscles.some((m) => APT_MUSCLES.has(m))) {
      return false;
    }
    if (f.muscle && !e.primaryMuscles.includes(f.muscle)) return false;
    if (f.level && e.level !== f.level) return false;
    if (q && !e.name.toLowerCase().includes(q)) return false;
    return true;
  });
}

export const LIBRARY_MUSCLES = [
  "glutes",
  "hamstrings",
  "abdominals",
  "quadriceps",
  "lower back",
  "calves",
  "chest",
  "shoulders",
  "middle back",
  "lats",
  "biceps",
  "triceps",
  "forearms",
  "traps",
  "abductors",
  "adductors",
  "neck",
];
