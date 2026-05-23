export interface SessionRecord {
  startedAt: number;
  endedAt: number;
  durationMs: number;
  badDurationMs: number;
  issueCounts: Record<string, number>;
  avgScores: {
    neckTilt: number;
    shoulderLevel: number;
    forwardHead: number;
    eyeLevel: number;
  };
  sampleCount: number;
}

interface HistoryStore {
  version: 1;
  sessions: SessionRecord[];
}

const HISTORY_KEY = "postureguard.history";
const MAX_SESSIONS = 200;
// Sessions shorter than this aren't worth analyzing.
const MIN_SAMPLE_COUNT = 30;

export function loadHistory(): SessionRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryStore;
    return Array.isArray(parsed.sessions) ? parsed.sessions : [];
  } catch {
    return [];
  }
}

export function appendSession(s: SessionRecord): void {
  if (typeof window === "undefined") return;
  if (s.sampleCount < MIN_SAMPLE_COUNT) return;
  const existing = loadHistory();
  const updated = [...existing, s].slice(-MAX_SESSIONS);
  try {
    const store: HistoryStore = { version: 1, sessions: updated };
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(store));
  } catch {
    // Storage full or unavailable.
  }
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(HISTORY_KEY);
}

export type MetricKey = keyof SessionRecord["avgScores"];

export const METRIC_LABELS: Record<MetricKey, string> = {
  neckTilt: "Neck tilt",
  shoulderLevel: "Shoulder level",
  forwardHead: "Head position",
  eyeLevel: "Eye level",
};

const METRIC_TIPS: Record<MetricKey, string> = {
  neckTilt:
    "Center your monitor and align your ears with your shoulders. A persistent tilt strains the cervical spine.",
  shoulderLevel:
    "Watch for one-sided slumping. Check armrest height and try not to lean on your mouse hand.",
  forwardHead:
    "Pull your chin back and raise the screen closer to eye level to reduce 'tech-neck' load.",
  eyeLevel:
    "Make sure the screen isn't tilted and your head stays level — small lean adds up over a day.",
};

export interface Insights {
  totalSessions: number;
  totalMinutes: number;
  averageBadPercent: number;
  topIssues: { issue: string; count: number }[];
  weakestArea: { metric: MetricKey; score: number } | null;
  timeOfDayBuckets: { label: string; avgBadPercent: number; sessions: number }[];
  recommendations: string[];
}

const BUCKETS: { label: string; from: number; to: number }[] = [
  { label: "Late night", from: 0, to: 6 },
  { label: "Morning", from: 6, to: 12 },
  { label: "Afternoon", from: 12, to: 18 },
  { label: "Evening", from: 18, to: 24 },
];

export function computeInsights(sessions: SessionRecord[]): Insights {
  if (sessions.length === 0) {
    return {
      totalSessions: 0,
      totalMinutes: 0,
      averageBadPercent: 0,
      topIssues: [],
      weakestArea: null,
      timeOfDayBuckets: [],
      recommendations: [],
    };
  }

  const totalMs = sessions.reduce((sum, s) => sum + s.durationMs, 0);
  const badMs = sessions.reduce((sum, s) => sum + s.badDurationMs, 0);

  const issueCounts: Record<string, number> = {};
  sessions.forEach((s) => {
    Object.entries(s.issueCounts).forEach(([k, v]) => {
      issueCounts[k] = (issueCounts[k] ?? 0) + v;
    });
  });
  const topIssues = Object.entries(issueCounts)
    .map(([issue, count]) => ({ issue, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  const metrics: MetricKey[] = ["neckTilt", "shoulderLevel", "forwardHead", "eyeLevel"];
  const metricAvgs = metrics.map((m) => ({
    metric: m,
    score: sessions.reduce((sum, s) => sum + s.avgScores[m], 0) / sessions.length,
  }));
  // Highest average score = worst posture, since scores grow with deviation.
  const worstMetric = metricAvgs.reduce((a, b) => (a.score > b.score ? a : b));
  const weakestArea = worstMetric.score > 25 ? worstMetric : null;

  const bucketAcc = BUCKETS.map((b) => ({ ...b, badMs: 0, durMs: 0, sessions: 0 }));
  sessions.forEach((s) => {
    const hour = new Date(s.startedAt).getHours();
    const bucket = bucketAcc.find((b) => hour >= b.from && hour < b.to);
    if (!bucket) return;
    bucket.badMs += s.badDurationMs;
    bucket.durMs += s.durationMs;
    bucket.sessions += 1;
  });
  const timeOfDayBuckets = bucketAcc
    .filter((b) => b.sessions > 0)
    .map((b) => ({
      label: b.label,
      sessions: b.sessions,
      avgBadPercent: b.durMs > 0 ? (b.badMs / b.durMs) * 100 : 0,
    }));

  const recommendations: string[] = [];
  if (weakestArea) {
    recommendations.push(
      `${METRIC_LABELS[weakestArea.metric]} is your weakest area. ${METRIC_TIPS[weakestArea.metric]}`
    );
  }
  if (timeOfDayBuckets.length > 1) {
    const worstBucket = timeOfDayBuckets.reduce((a, b) =>
      a.avgBadPercent > b.avgBadPercent ? a : b
    );
    if (worstBucket.avgBadPercent > 30 && worstBucket.sessions >= 2) {
      recommendations.push(
        `Posture is worst in the ${worstBucket.label.toLowerCase()} (${Math.round(
          worstBucket.avgBadPercent
        )}% of that time). Consider a short stretch before sitting down then.`
      );
    }
  }
  if (topIssues.length > 0 && topIssues[0].count >= 10) {
    recommendations.push(
      `"${topIssues[0].issue}" is your most frequent issue (${topIssues[0].count} occurrences) — focus there first.`
    );
  }
  if (sessions.length >= 5) {
    const recent5 = sessions.slice(-5);
    const recentBadPct =
      (recent5.reduce((s, x) => s + x.badDurationMs, 0) /
        Math.max(1, recent5.reduce((s, x) => s + x.durationMs, 0))) *
      100;
    const overallBadPct = totalMs > 0 ? (badMs / totalMs) * 100 : 0;
    if (overallBadPct > 0 && recentBadPct < overallBadPct - 10) {
      recommendations.push(
        `Your last 5 sessions are improving — ${Math.round(recentBadPct)}% bad vs ${Math.round(
          overallBadPct
        )}% all-time. Keep it up.`
      );
    } else if (recentBadPct > overallBadPct + 10) {
      recommendations.push(
        `Your last 5 sessions are trending worse (${Math.round(
          recentBadPct
        )}% vs ${Math.round(overallBadPct)}% all-time). Check ergonomics — chair height, screen distance.`
      );
    }
  }

  return {
    totalSessions: sessions.length,
    totalMinutes: Math.round(totalMs / 60000),
    averageBadPercent: totalMs > 0 ? (badMs / totalMs) * 100 : 0,
    topIssues,
    weakestArea,
    timeOfDayBuckets,
    recommendations,
  };
}
