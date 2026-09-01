// Tiny localStorage list helpers shared by the APT program, assessments
// and sitting-coach stores. Everything stays on-device, matching the
// app's privacy stance — keys are all prefixed "postureguard.".

export function loadList<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function saveList<T>(key: string, list: T[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // Storage full or unavailable — drop silently, same as sessionHistory.
  }
}

export function appendToList<T>(key: string, item: T, cap: number): T[] {
  const updated = [...loadList<T>(key), item].slice(-cap);
  saveList(key, updated);
  return updated;
}

export function clearKey(key: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
}

/** Local calendar day key, e.g. "2026-09-01". */
export function dayKey(ts: number = Date.now()): string {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Day keys for the last `n` days, oldest first, ending today. */
export function lastNDayKeys(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    out.push(dayKey(d.getTime()));
  }
  return out;
}
