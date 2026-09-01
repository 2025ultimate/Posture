// Exercise library for anterior pelvic tilt (APT) correction.
//
// APT is the classic "lower crossed syndrome" pattern: tight hip flexors and
// lumbar erectors crossed with under-active glutes, abdominals and
// hamstrings. The library is organized around what each movement does for
// that pattern:
//   - "stretch"  → lengthen the tight side (hip flexors, rectus femoris,
//                  lumbar erectors)
//   - "strength" → load the weak side (glutes, abs, hamstrings)
//   - "control"  → re-learn where neutral pelvis is (tilts, breathing)
//   - "micro"    → 30-second desk breaks that undo a block of sitting
//
// Note: none of this is medical advice. Cues follow widely used physio /
// S&C conventions (posterior-tilt bias, glute-first hip extension).

export type ExerciseCategory = "stretch" | "strength" | "control" | "micro";

export type Scheme =
  | { kind: "time"; seconds: number; sets?: number; perSide?: boolean }
  | {
      kind: "reps";
      reps: number;
      sets?: number;
      perSide?: boolean;
      holdSeconds?: number;
    };

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  targets: string;
  cues: string[];
  mistake?: string;
  scheme: Scheme;
  /**
   * YouTube search query for a real-person demo. Defaults to the exercise
   * name; null disables the link (e.g. walking needs no demo). We link to
   * a search rather than embedding or hardcoding a video: no third-party
   * scripts in the app, no dead links, and results stay current.
   */
  videoQuery?: string | null;
}

export function exerciseVideoQuery(ex: Exercise): string | null {
  if (ex.videoQuery === null) return null;
  return ex.videoQuery ?? `${ex.name} exercise form`;
}

export function youtubeSearchUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

export const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  stretch: "Stretch",
  strength: "Strengthen",
  control: "Control",
  micro: "Desk break",
};

/** Estimated working seconds for one set (used by the routine player). */
export function setSeconds(scheme: Scheme): number {
  if (scheme.kind === "time") return scheme.seconds;
  // ~3s per rep plus any hold, with a small setup allowance.
  return Math.round(scheme.reps * (3 + (scheme.holdSeconds ?? 0)) + 4);
}

export function schemeLabel(scheme: Scheme): string {
  const side = scheme.perSide ? " / side" : "";
  const sets = (scheme.sets ?? 1) > 1 ? `${scheme.sets} × ` : "";
  if (scheme.kind === "time") return `${sets}${scheme.seconds}s${side}`;
  const hold = scheme.holdSeconds ? ` (${scheme.holdSeconds}s hold)` : "";
  return `${sets}${scheme.reps} reps${hold}${side}`;
}

const EX = (e: Exercise) => e;

export const EXERCISES: Record<string, Exercise> = Object.fromEntries(
  [
    // ---- Control / awareness -------------------------------------------
    EX({
      id: "breathing9090",
      videoQuery: "90 90 breathing exercise",
      name: "90/90 breathing",
      category: "control",
      targets: "Deep core · rib position",
      scheme: { kind: "time", seconds: 90 },
      cues: [
        "Lie on your back, calves resting on a chair or couch — hips and knees at 90°.",
        "Long exhale through the mouth. Feel the ribs come down and the low back settle into the floor.",
        "Pause 2–3 seconds, then inhale quietly through the nose into the sides of the ribs.",
        "Keep the low back gently in contact with the floor the whole time.",
      ],
      mistake: "Arching the low back off the floor on the inhale.",
    }),
    EX({
      id: "pelvicTiltSupine",
      videoQuery: "posterior pelvic tilt exercise lying down",
      name: "Pelvic tilt (lying)",
      category: "control",
      targets: "Pelvis awareness · lower abs",
      scheme: { kind: "reps", reps: 10, sets: 2, holdSeconds: 5 },
      cues: [
        "Lie down, knees bent, feet flat on the floor.",
        "Roll the pelvis back so the low back flattens into the floor — think “tuck the tailbone”.",
        "Hold 5 seconds while breathing, then release halfway. Don't release into a big arch.",
        "This tuck is the exact movement that counters anterior tilt — learn to own it.",
      ],
      mistake: "Pushing through the legs instead of rolling the pelvis.",
    }),
    EX({
      id: "wallTilt",
      videoQuery: "standing posterior pelvic tilt against wall",
      name: "Standing wall tilt",
      category: "control",
      targets: "Neutral pelvis while standing",
      scheme: { kind: "reps", reps: 8, sets: 2, holdSeconds: 5 },
      cues: [
        "Stand with your back to a wall, heels one hand-width away.",
        "Press the low back toward the wall by tucking the pelvis — ribs stay down.",
        "Hold 5 seconds, keep breathing, release slowly.",
        "Memorize this position — it's how you want to stand at your desk.",
      ],
      mistake: "Shrugging the shoulders or holding your breath.",
    }),
    EX({
      id: "gluteSqueeze",
      videoQuery: "standing glute squeeze posture exercise",
      name: "Standing glute squeeze",
      category: "control",
      targets: "Glute activation · pelvis position",
      scheme: { kind: "reps", reps: 10, holdSeconds: 5 },
      cues: [
        "Stand tall, feet under your hips.",
        "Squeeze both glutes hard — feel the pelvis tuck slightly under you.",
        "Hold 5 seconds. Shoulders, jaw and hands stay relaxed.",
      ],
    }),

    // ---- Strength -------------------------------------------------------
    EX({
      id: "gluteBridge",
      name: "Glute bridge",
      category: "strength",
      targets: "Glutes · hamstrings",
      scheme: { kind: "reps", reps: 12, sets: 2, holdSeconds: 2 },
      cues: [
        "On your back, knees bent, heels close to your hips.",
        "Tuck the pelvis first, then push through the heels and lift the hips.",
        "Squeeze the glutes 2 seconds at the top. Height comes from the glutes, not the low back.",
        "Lower with control.",
      ],
      mistake: "Arching the lumbar spine to get higher — stop at a straight line.",
    }),
    EX({
      id: "singleLegBridge",
      name: "Single-leg glute bridge",
      category: "strength",
      targets: "Glutes · pelvic stability",
      scheme: { kind: "reps", reps: 8, sets: 2, perSide: true },
      cues: [
        "From bridge position, extend one leg so the knees stay level.",
        "Push through the grounded heel and lift — keep both hip bones level.",
        "Squeeze at the top, lower slowly. Swap sides after the set.",
      ],
      mistake: "Letting the free-leg hip drop or twist.",
    }),
    EX({
      id: "hipThrust",
      videoQuery: "hip thrust shoulders on bench form",
      name: "Hip thrust (shoulders elevated)",
      category: "strength",
      targets: "Glutes",
      scheme: { kind: "reps", reps: 12, sets: 3, holdSeconds: 2 },
      cues: [
        "Upper back on the edge of a couch or bench, feet flat.",
        "Chin tucked, ribs down. Drive through the heels until the body forms a straight line.",
        "Hard 2-second glute squeeze at the top — no lumbar arch to go higher.",
        "Add a loaded backpack on the hips when 3×12 feels easy.",
      ],
    }),
    EX({
      id: "deadBug",
      name: "Dead bug",
      category: "strength",
      targets: "Abs · anti-extension core",
      scheme: { kind: "reps", reps: 8, sets: 2, perSide: true },
      cues: [
        "On your back, arms to the ceiling, knees stacked over hips at 90°.",
        "Press the low back into the floor — it stays glued down the entire set.",
        "Slowly lower the opposite arm and leg toward the floor, exhaling as you reach.",
        "Return, then switch. Slow beats far.",
      ],
      mistake: "The low back popping off the floor — shorten the range instead.",
    }),
    EX({
      id: "reverseCrunch",
      name: "Reverse crunch",
      category: "strength",
      targets: "Lower abs · posterior tilt strength",
      scheme: { kind: "reps", reps: 10, sets: 2 },
      cues: [
        "Lie down, knees bent to 90°, arms by your sides.",
        "Exhale and curl the pelvis and knees toward your chest — this is a loaded pelvic tilt.",
        "Lower slowly without letting the low back arch off the floor.",
      ],
      mistake: "Swinging the legs for momentum.",
    }),
    EX({
      id: "rkcPlank",
      videoQuery: "RKC hard style plank form",
      name: "Hard-style plank",
      category: "strength",
      targets: "Abs · glutes together",
      scheme: { kind: "time", seconds: 25, sets: 3 },
      cues: [
        "Forearm plank, elbows under shoulders.",
        "Tuck the pelvis under hard and squeeze the glutes — feel the abs switch on.",
        "Brace like you're about to take a light punch. Keep breathing.",
        "Short and intense beats a long, saggy hold.",
      ],
      mistake: "Sagging hips — that's the exact arch we're training away.",
    }),
    EX({
      id: "hollowHold",
      name: "Hollow-body hold",
      category: "strength",
      targets: "Abs · anti-extension",
      scheme: { kind: "time", seconds: 20, sets: 3 },
      cues: [
        "On your back, press the low back into the floor.",
        "Reach arms and legs long — only as low as the low back stays glued down.",
        "Bend the knees or raise the arms to make it easier.",
      ],
    }),
    EX({
      id: "hamWalkout",
      videoQuery: "hamstring walkouts glute bridge",
      name: "Hamstring walkouts",
      category: "strength",
      targets: "Hamstrings · glutes",
      scheme: { kind: "reps", reps: 8, sets: 2 },
      cues: [
        "Set up a glute bridge, hips high.",
        "Walk the feet away one small step at a time, keeping the hips up.",
        "Walk back in. Hamstrings pull the pelvis toward neutral from below — train them.",
      ],
    }),

    // ---- Stretch --------------------------------------------------------
    EX({
      id: "hipFlexorStretch",
      videoQuery: "half kneeling hip flexor stretch pelvic tuck",
      name: "Half-kneeling hip flexor stretch",
      category: "stretch",
      targets: "Hip flexors (psoas)",
      scheme: { kind: "time", seconds: 40, perSide: true },
      cues: [
        "Half-kneel with the rear knee on a cushion.",
        "FIRST tuck the pelvis and squeeze the rear-leg glute.",
        "Then shift forward just an inch. Feel it in the front of the rear hip — not the low back.",
        "Reach the same-side arm overhead to deepen it.",
      ],
      mistake:
        "Lunging far forward with an arched back — the pelvic tuck IS the stretch.",
    }),
    EX({
      id: "couchStretch",
      videoQuery: "couch stretch hip flexor",
      name: "Couch stretch",
      category: "stretch",
      targets: "Rectus femoris · hip flexors",
      scheme: { kind: "time", seconds: 45, perSide: true },
      cues: [
        "Rear shin up against a couch or wall, front foot flat.",
        "Tuck the pelvis and squeeze the rear glute before raising the torso.",
        "Come up only as tall as you can keep the tuck.",
        "Slow breaths. Intensity around 6/10 — never through pain.",
      ],
    }),
    EX({
      id: "quadStretch",
      name: "Standing quad stretch",
      category: "stretch",
      targets: "Quads · rectus femoris",
      scheme: { kind: "time", seconds: 30, perSide: true },
      cues: [
        "Hold a wall, grab your ankle behind you.",
        "Knees together, pelvis tucked — feel the front of the thigh, not the low back.",
      ],
    }),
    EX({
      id: "childsPose",
      name: "Child's pose + reach",
      category: "stretch",
      targets: "Lumbar erectors · lats",
      scheme: { kind: "time", seconds: 60 },
      cues: [
        "Knees wide, sit the hips back toward the heels, arms long.",
        "Let the low back round gently — the exact opposite of your arch.",
        "Long slow exhales. Walk the hands to each side to reach the lats.",
      ],
    }),
    EX({
      id: "kneesToChest",
      name: "Knees to chest",
      category: "stretch",
      targets: "Lower back release",
      scheme: { kind: "time", seconds: 40 },
      cues: [
        "Lie on your back and hug both knees in.",
        "Rock gently side to side and breathe out slowly.",
      ],
    }),

    // ---- Desk micro-breaks ---------------------------------------------
    EX({
      id: "microStand",
      videoQuery: "standing posture reset glute squeeze",
      name: "Stand + glute reset",
      category: "micro",
      targets: "Undo the sitting position",
      scheme: { kind: "time", seconds: 30 },
      cues: [
        "Stand up tall. Ribs down, pelvis gently tucked.",
        "Squeeze the glutes 5 seconds, relax, repeat 3 times.",
        "That's the standing position to keep when you return.",
      ],
    }),
    EX({
      id: "microHipFlexor",
      videoQuery: "standing hip flexor stretch",
      name: "Standing hip flexor opener",
      category: "micro",
      targets: "Hip flexors after sitting",
      scheme: { kind: "time", seconds: 30, perSide: true },
      cues: [
        "Step one foot back into a short lunge stance.",
        "Tuck the pelvis, squeeze the rear glute, shift forward slightly.",
        "Feel the front of the rear hip open after all that sitting.",
      ],
    }),
    EX({
      id: "microWallTilt",
      videoQuery: "standing posterior pelvic tilt against wall",
      name: "Wall tilts ×8",
      category: "micro",
      targets: "Neutral pelvis reset",
      scheme: { kind: "reps", reps: 8, holdSeconds: 3 },
      cues: [
        "Back against a wall, heels a hand-width out.",
        "Press the low back toward the wall by tucking the pelvis. Hold 3s, release.",
      ],
    }),
    EX({
      id: "microWalk",
      videoQuery: null,
      name: "Two-minute walk",
      category: "micro",
      targets: "Hip extension · circulation",
      scheme: { kind: "time", seconds: 120 },
      cues: [
        "Walk anywhere — hallway, stairs, around the room.",
        "Every stride extends the hip and gives the hip flexors their length back.",
      ],
    }),
    EX({
      id: "microChest",
      videoQuery: "doorway chest stretch",
      name: "Doorway chest stretch",
      category: "micro",
      targets: "Chest · shoulders",
      scheme: { kind: "time", seconds: 40 },
      cues: [
        "Forearms on a door frame, step forward gently.",
        "Ribs stay down — no low-back arch to fake the stretch.",
      ],
    }),
    EX({
      id: "microChinTuck",
      videoQuery: "chin tuck exercise",
      name: "Chin tucks",
      category: "micro",
      targets: "Neck · head position",
      scheme: { kind: "reps", reps: 5, holdSeconds: 5 },
      cues: [
        "Pull the chin straight back to make a double chin. Hold 5s.",
        "Eyes level — this is a glide back, not a nod down.",
      ],
    }),
  ].map((e) => [e.id, e])
);

export function getExercise(id: string): Exercise {
  const e = EXERCISES[id];
  if (!e) throw new Error(`Unknown exercise: ${id}`);
  return e;
}

/** Micro-break rotation used by the desk sitting coach. */
export const MICRO_BREAK_IDS = [
  "microStand",
  "microHipFlexor",
  "microWallTilt",
  "microWalk",
  "microChest",
  "microChinTuck",
];
