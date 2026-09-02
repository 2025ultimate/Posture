// The positive-motivation engine: short spoken lines for the routine
// player and the sitting coach. Tone rules: warm, specific, never
// guilt-based — the enemy is the chair, never the user. Lines are picked
// randomly without immediate repeats.
//
// Purity note: pick() uses Math.random, so call it from event handlers,
// timers or effects — never during render.

const lastPick = new Map<string, number>();

function pick(poolId: string, pool: string[]): string {
  if (pool.length === 1) return pool[0];
  let idx = Math.floor(Math.random() * pool.length);
  if (idx === lastPick.get(poolId)) idx = (idx + 1) % pool.length;
  lastPick.set(poolId, idx);
  return pool[idx];
}

const START = [
  "Let's give your back the ten minutes it keeps asking for.",
  "Showing up was the hard part. You're already here.",
  "Every session tips the pelvis a little closer to neutral. Let's begin.",
  "Your chair had you all day. This time is yours.",
  "Nice and easy — quality reps, calm breathing.",
];

const HALFWAY = [
  "Halfway there. Keep breathing.",
  "Half done — smooth and steady.",
  "Halfway. Check the form: ribs down, no arch.",
  "Middle of the hold. Stay long, stay relaxed.",
];

const FINAL_PUSH = [
  "Last few seconds. Strong finish.",
  "Almost there — don't let the form slip now.",
  "Final stretch. Finish it clean.",
  "Nearly done. Hold the position, hold the breath rhythm.",
];

const PRAISE = [
  "Nice work.",
  "Good. That's exactly it.",
  "Well done.",
  "Clean set.",
  "That's the one.",
  "Strong.",
];

const COMPLETE = [
  "Routine complete. Your future back says thank you.",
  "Done. That's how tilts get fixed — one quiet session at a time.",
  "Finished. Nothing dramatic today, and that's exactly the point.",
  "That's a wrap. Consistency is doing its slow, boring magic.",
];

const SITTING_NUDGE = [
  "Stand up for two minutes and open those hip flexors.",
  "Time to unglue the hips. A short walk resets everything.",
  "Stand tall, squeeze the glutes, take five slow breaths.",
  "Two minutes on your feet buys your back the next hour.",
];

const BREAK_PRAISE = [
  "Good break. Your hip flexors got their length back.",
  "Nice — that's one more crack in the sitting habit.",
  "Well done. Back to it, sitting tall.",
];

export function startLine(): string {
  return pick("start", START);
}

export function halfwayLine(): string {
  return pick("halfway", HALFWAY);
}

export function finalPushLine(): string {
  return pick("push", FINAL_PUSH);
}

export function praiseLine(): string {
  return pick("praise", PRAISE);
}

export function completeLine(streakDays: number): string {
  const base = pick("complete", COMPLETE);
  if (streakDays >= 2) {
    return `${base} That's ${streakDays} days in a row.`;
  }
  return `${base} Day one is the one that matters.`;
}

export function sittingNudgeLine(minutes: number): string {
  return `You've been sitting for ${minutes} minutes. ${pick("sitting", SITTING_NUDGE)}`;
}

export function breakPraiseLine(): string {
  return pick("breakPraise", BREAK_PRAISE);
}

/** Sample line for the voice-settings preview button. */
export function previewLine(): string {
  return `Hi! This is your posture coach. ${pick("start", START)}`;
}
