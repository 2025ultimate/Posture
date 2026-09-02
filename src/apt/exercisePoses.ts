// Reference diagrams for every exercise and self-test, as data.
//
// Each pose is a small side-view figure: body polylines, a head, optional
// props (wall / chair / bench / door frame), a highlight glow on the
// muscle or region the user should feel (green = squeeze/engage,
// purple = stretch/feel it lengthen), and a green motion arrow for the
// key movement. Drawn by poseToSvg() into a plain SVG string — no
// dependencies, tiny, theme-aware (body uses currentColor), and — unlike
// AI-generated or stock photos — every joint angle here is deliberate,
// so the pictures teach the *right* form.
//
// Coordinate space: 120 × 100, x → right, y → down. Ground line at y=90.

export interface Pt {
  x: number;
  y: number;
}

/**
 * Animation keyframe: the START position of the movement. The base pose is
 * the ACTIVE position (top of the bridge, tucked pelvis, extended dead-bug
 * limb), and the figure loops start → active (hold) → start with an ease.
 * `chains` is sparse — only the chain indices that move, and each entry
 * must have the same number of points as the base chain.
 */
export interface PoseAnim {
  chains?: Record<number, Pt[]>;
  head?: { x: number; y: number };
  durMs?: number;
}

export interface Pose {
  /** Filled prop blocks (chair, bench, table). */
  rects?: { x: number; y: number; w: number; h: number }[];
  /** Prop lines (wall, door frame). */
  propLines?: Pt[][];
  /** Dashed hint lines (an alternate position). */
  dashed?: Pt[][];
  /** Dashed hint circles (e.g. the target head position for chin tucks). */
  dashedCircles?: { x: number; y: number; r: number }[];
  ground?: boolean;
  head: { x: number; y: number; r?: number };
  /** Body polylines, stroke-drawn with round caps. */
  chains: Pt[][];
  glow?: { x: number; y: number; r: number; kind: "stretch" | "strength" };
  /** Motion arrows: 2 points = straight, 3 points = curved (quadratic). */
  arrows?: Pt[][];
  anim?: PoseAnim;
  /** Isometric holds: no position change, just pulse the glow. */
  pulse?: boolean;
}

const STRETCH_COLOR = "#a855f7";
const STRENGTH_COLOR = "#22c55e";
const ARROW_COLOR = "#22c55e";

export const POSES: Record<string, Pose> = {
  // ---- Control ----------------------------------------------------------
  breathing9090: {
    ground: true,
    rects: [{ x: 66, y: 58, w: 26, h: 30 }],
    head: { x: 16, y: 80 },
    chains: [
      [{ x: 24, y: 81 }, { x: 52, y: 81 }],
      [{ x: 32, y: 80 }, { x: 42, y: 73 }],
      [{ x: 52, y: 81 }, { x: 54, y: 54 }],
      [{ x: 54, y: 54 }, { x: 78, y: 54 }],
    ],
    glow: { x: 42, y: 74, r: 6, kind: "strength" },
    arrows: [[{ x: 36, y: 60 }, { x: 36, y: 72 }]],
    // Slow breath: the hand on the belly rises and settles.
    anim: { chains: { 1: [{ x: 32, y: 80 }, { x: 42, y: 76 }] }, durMs: 3400 },
  },
  pelvicTiltSupine: {
    ground: true,
    head: { x: 16, y: 80 },
    chains: [
      [{ x: 24, y: 81 }, { x: 50, y: 80 }],
      [{ x: 32, y: 80 }, { x: 48, y: 74 }],
      [{ x: 50, y: 80 }, { x: 62, y: 60 }],
      [{ x: 62, y: 60 }, { x: 74, y: 82 }],
      [{ x: 74, y: 82 }, { x: 80, y: 82 }],
    ],
    glow: { x: 44, y: 78, r: 6, kind: "strength" },
    arrows: [[{ x: 56, y: 68 }, { x: 50, y: 62 }, { x: 43, y: 66 }]],
    // Arched start → low back pressed flat into the floor.
    anim: {
      chains: {
        0: [{ x: 24, y: 81 }, { x: 50, y: 77 }],
        1: [{ x: 32, y: 80 }, { x: 48, y: 71 }],
        2: [{ x: 50, y: 77 }, { x: 62, y: 60 }],
      },
    },
  },
  wallTilt: {
    ground: true,
    propLines: [[{ x: 88, y: 10 }, { x: 88, y: 88 }]],
    head: { x: 76, y: 18 },
    chains: [
      [{ x: 76, y: 25 }, { x: 73, y: 38 }, { x: 76, y: 52 }],
      [{ x: 75, y: 30 }, { x: 71, y: 46 }],
      [{ x: 76, y: 52 }, { x: 74, y: 70 }, { x: 73, y: 88 }],
      [{ x: 76, y: 52 }, { x: 79, y: 70 }, { x: 77, y: 88 }],
    ],
    glow: { x: 77, y: 44, r: 5, kind: "strength" },
    arrows: [[{ x: 62, y: 44 }, { x: 73, y: 44 }]],
    // Arched-off-the-wall start → lumbar pressed toward the wall.
    anim: {
      chains: {
        0: [{ x: 76, y: 25 }, { x: 70, y: 38 }, { x: 76, y: 52 }],
        1: [{ x: 75, y: 30 }, { x: 69, y: 46 }],
      },
    },
  },
  gluteSqueeze: {
    ground: true,
    head: { x: 58, y: 17 },
    chains: [
      [{ x: 58, y: 24 }, { x: 58, y: 52 }],
      [{ x: 58, y: 30 }, { x: 55, y: 48 }],
      [{ x: 58, y: 52 }, { x: 56, y: 70 }, { x: 57, y: 88 }],
      [{ x: 58, y: 52 }, { x: 61, y: 70 }, { x: 60, y: 88 }],
    ],
    glow: { x: 52, y: 54, r: 6, kind: "strength" },
    arrows: [[{ x: 47, y: 62 }, { x: 44, y: 55 }, { x: 48, y: 49 }]],
    // Relaxed stance → pelvis tucks slightly under on the squeeze.
    anim: {
      chains: {
        0: [{ x: 58, y: 24 }, { x: 56, y: 52 }],
        2: [{ x: 56, y: 52 }, { x: 56, y: 70 }, { x: 57, y: 88 }],
        3: [{ x: 56, y: 52 }, { x: 61, y: 70 }, { x: 60, y: 88 }],
      },
    },
  },

  // ---- Strength ---------------------------------------------------------
  gluteBridge: {
    ground: true,
    head: { x: 14, y: 82 },
    chains: [
      [{ x: 22, y: 82 }, { x: 48, y: 66 }, { x: 58, y: 62 }],
      [{ x: 58, y: 62 }, { x: 66, y: 84 }],
      [{ x: 28, y: 85 }, { x: 44, y: 85 }],
    ],
    glow: { x: 46, y: 71, r: 6.5, kind: "strength" },
    arrows: [[{ x: 48, y: 58 }, { x: 48, y: 44 }]],
    // Hips on the floor → driven up to the straight-line top.
    anim: { chains: { 0: [{ x: 22, y: 82 }, { x: 46, y: 79 }, { x: 58, y: 62 }] } },
  },
  singleLegBridge: {
    ground: true,
    head: { x: 14, y: 82 },
    chains: [
      [{ x: 22, y: 82 }, { x: 48, y: 66 }, { x: 58, y: 62 }],
      [{ x: 58, y: 62 }, { x: 66, y: 84 }],
      [{ x: 48, y: 66 }, { x: 78, y: 58 }],
      [{ x: 28, y: 85 }, { x: 44, y: 85 }],
    ],
    glow: { x: 46, y: 71, r: 6.5, kind: "strength" },
    arrows: [[{ x: 48, y: 58 }, { x: 48, y: 44 }]],
    // Hips down → up, the free leg riding level with the pelvis.
    anim: {
      chains: {
        0: [{ x: 22, y: 82 }, { x: 46, y: 79 }, { x: 58, y: 62 }],
        2: [{ x: 46, y: 79 }, { x: 76, y: 70 }],
      },
    },
  },
  hipThrust: {
    ground: true,
    rects: [{ x: 4, y: 64, w: 24, h: 24 }],
    head: { x: 10, y: 56 },
    chains: [
      [{ x: 18, y: 60 }, { x: 50, y: 62 }],
      [{ x: 26, y: 62 }, { x: 36, y: 70 }],
      [{ x: 50, y: 62 }, { x: 64, y: 62 }],
      [{ x: 64, y: 62 }, { x: 68, y: 86 }],
    ],
    glow: { x: 48, y: 68, r: 6.5, kind: "strength" },
    arrows: [[{ x: 50, y: 54 }, { x: 50, y: 40 }]],
    // Hips dipped → driven to the straight line.
    anim: {
      chains: {
        0: [{ x: 18, y: 60 }, { x: 48, y: 72 }],
        2: [{ x: 48, y: 72 }, { x: 64, y: 62 }],
      },
    },
  },
  deadBug: {
    ground: true,
    head: { x: 16, y: 82 },
    chains: [
      [{ x: 24, y: 82 }, { x: 52, y: 82 }],
      [{ x: 30, y: 81 }, { x: 30, y: 58 }],
      [{ x: 52, y: 82 }, { x: 54, y: 60 }],
      [{ x: 54, y: 60 }, { x: 68, y: 60 }],
      [{ x: 52, y: 82 }, { x: 84, y: 74 }],
    ],
    glow: { x: 44, y: 80, r: 6, kind: "strength" },
    arrows: [[{ x: 44, y: 68 }, { x: 44, y: 76 }]],
    // The free leg reaches from raised to long-and-low, back stays glued.
    anim: {
      chains: { 4: [{ x: 52, y: 82 }, { x: 60, y: 63 }] },
      durMs: 3000,
    },
  },
  reverseCrunch: {
    ground: true,
    head: { x: 16, y: 82 },
    chains: [
      [{ x: 24, y: 82 }, { x: 46, y: 80 }],
      [{ x: 30, y: 84 }, { x: 46, y: 86 }],
      [{ x: 46, y: 80 }, { x: 40, y: 60 }],
      [{ x: 40, y: 60 }, { x: 54, y: 54 }],
    ],
    glow: { x: 42, y: 74, r: 5.5, kind: "strength" },
    arrows: [[{ x: 62, y: 70 }, { x: 56, y: 54 }, { x: 44, y: 46 }]],
    // Knees curl from neutral toward the chest.
    anim: {
      chains: {
        2: [{ x: 46, y: 80 }, { x: 48, y: 62 }],
        3: [{ x: 48, y: 62 }, { x: 62, y: 60 }],
      },
    },
  },
  rkcPlank: {
    ground: true,
    head: { x: 15, y: 61 },
    chains: [
      [{ x: 24, y: 66 }, { x: 84, y: 82 }],
      [{ x: 24, y: 66 }, { x: 22, y: 84 }],
      [{ x: 22, y: 84 }, { x: 38, y: 84 }],
      [{ x: 84, y: 82 }, { x: 88, y: 88 }],
    ],
    glow: { x: 54, y: 74, r: 7, kind: "strength" },
    arrows: [[{ x: 60, y: 62 }, { x: 66, y: 68 }, { x: 61, y: 74 }]],
    pulse: true,
  },
  hollowHold: {
    ground: true,
    head: { x: 18, y: 70 },
    chains: [
      [
        { x: 24, y: 74 },
        { x: 36, y: 82 },
        { x: 46, y: 84 },
        { x: 60, y: 76 },
        { x: 80, y: 64 },
      ],
      [{ x: 26, y: 73 }, { x: 8, y: 62 }],
    ],
    glow: { x: 46, y: 82, r: 5.5, kind: "strength" },
    pulse: true,
  },
  hamWalkout: {
    ground: true,
    head: { x: 14, y: 82 },
    chains: [
      [{ x: 22, y: 82 }, { x: 44, y: 70 }, { x: 56, y: 68 }],
      [{ x: 56, y: 68 }, { x: 64, y: 86 }],
      [{ x: 26, y: 85 }, { x: 40, y: 85 }],
    ],
    dashed: [[{ x: 64, y: 86 }, { x: 82, y: 88 }]],
    glow: { x: 52, y: 74, r: 6, kind: "strength" },
    arrows: [[{ x: 68, y: 76 }, { x: 84, y: 78 }]],
    // Feet walk out and back while the hips stay up.
    anim: {
      chains: {
        0: [{ x: 22, y: 82 }, { x: 45, y: 72 }, { x: 58, y: 71 }],
        1: [{ x: 58, y: 71 }, { x: 80, y: 87 }],
      },
      durMs: 3000,
    },
  },

  // ---- Stretch ----------------------------------------------------------
  hipFlexorStretch: {
    ground: true,
    head: { x: 50, y: 25 },
    chains: [
      [{ x: 44, y: 86 }, { x: 28, y: 88 }],
      [{ x: 44, y: 86 }, { x: 52, y: 64 }],
      [{ x: 52, y: 64 }, { x: 50, y: 32 }],
      [{ x: 51, y: 36 }, { x: 57, y: 14 }],
      [{ x: 52, y: 64 }, { x: 68, y: 66 }],
      [{ x: 68, y: 66 }, { x: 68, y: 88 }],
    ],
    glow: { x: 56, y: 62, r: 6, kind: "stretch" },
    arrows: [[{ x: 44, y: 68 }, { x: 41, y: 60 }, { x: 45, y: 54 }]],
    // The "shift forward an inch" — hips glide forward, torso stays tall.
    anim: {
      chains: {
        1: [{ x: 44, y: 86 }, { x: 49, y: 64 }],
        2: [{ x: 49, y: 64 }, { x: 47, y: 32 }],
        3: [{ x: 48, y: 36 }, { x: 54, y: 14 }],
        4: [{ x: 49, y: 64 }, { x: 68, y: 66 }],
      },
      head: { x: 47, y: 25 },
      durMs: 3000,
    },
  },
  couchStretch: {
    ground: true,
    propLines: [[{ x: 98, y: 26 }, { x: 98, y: 88 }]],
    head: { x: 59, y: 29 },
    chains: [
      [{ x: 86, y: 86 }, { x: 95, y: 60 }],
      [{ x: 86, y: 86 }, { x: 66, y: 66 }],
      [{ x: 66, y: 66 }, { x: 60, y: 36 }],
      [{ x: 62, y: 44 }, { x: 48, y: 60 }],
      [{ x: 66, y: 66 }, { x: 46, y: 68 }],
      [{ x: 46, y: 68 }, { x: 46, y: 88 }],
    ],
    glow: { x: 74, y: 74, r: 7, kind: "stretch" },
    // Torso rises from flexed to tall — only as far as the tuck holds.
    anim: {
      chains: {
        2: [{ x: 66, y: 66 }, { x: 52, y: 42 }],
        3: [{ x: 56, y: 48 }, { x: 46, y: 62 }],
      },
      head: { x: 51, y: 35 },
      durMs: 3000,
    },
  },
  quadStretch: {
    ground: true,
    propLines: [[{ x: 18, y: 14 }, { x: 18, y: 88 }]],
    head: { x: 42, y: 17 },
    chains: [
      [{ x: 42, y: 24 }, { x: 44, y: 52 }],
      [{ x: 42, y: 30 }, { x: 20, y: 32 }],
      [{ x: 44, y: 52 }, { x: 42, y: 70 }, { x: 43, y: 88 }],
      [{ x: 44, y: 52 }, { x: 47, y: 68 }],
      [{ x: 47, y: 68 }, { x: 53, y: 57 }],
      [{ x: 43, y: 30 }, { x: 53, y: 57 }],
    ],
    glow: { x: 48, y: 61, r: 5.5, kind: "stretch" },
    pulse: true,
  },
  childsPose: {
    ground: true,
    head: { x: 56, y: 78, r: 5.5 },
    chains: [
      [{ x: 16, y: 86 }, { x: 32, y: 86 }],
      [{ x: 34, y: 86 }, { x: 22, y: 70 }],
      [{ x: 22, y: 70 }, { x: 38, y: 73 }, { x: 50, y: 77 }],
      [{ x: 48, y: 80 }, { x: 76, y: 87 }],
    ],
    glow: { x: 32, y: 70, r: 6.5, kind: "stretch" },
    // Gentle breathing reach — hands walk a little further each exhale.
    anim: {
      chains: { 3: [{ x: 48, y: 80 }, { x: 70, y: 86 }] },
      durMs: 3200,
    },
  },
  kneesToChest: {
    ground: true,
    head: { x: 16, y: 82 },
    chains: [
      [{ x: 24, y: 82 }, { x: 42, y: 79 }],
      [{ x: 42, y: 79 }, { x: 38, y: 60 }],
      [{ x: 38, y: 60 }, { x: 26, y: 60 }],
      [{ x: 28, y: 78 }, { x: 36, y: 63 }],
    ],
    glow: { x: 40, y: 77, r: 5.5, kind: "stretch" },
    // Gentle rock: knees hug closer, then ease off.
    anim: {
      chains: {
        1: [{ x: 42, y: 79 }, { x: 42, y: 64 }],
        2: [{ x: 42, y: 64 }, { x: 30, y: 64 }],
        3: [{ x: 28, y: 78 }, { x: 38, y: 66 }],
      },
      durMs: 2800,
    },
  },

  // ---- Desk micro-breaks -------------------------------------------------
  microHipFlexor: {
    ground: true,
    head: { x: 54, y: 16 },
    chains: [
      [{ x: 54, y: 23 }, { x: 52, y: 50 }],
      [{ x: 53, y: 30 }, { x: 50, y: 46 }],
      [{ x: 52, y: 50 }, { x: 64, y: 64 }],
      [{ x: 64, y: 64 }, { x: 64, y: 88 }],
      [{ x: 52, y: 50 }, { x: 40, y: 68 }],
      [{ x: 40, y: 68 }, { x: 34, y: 88 }],
    ],
    glow: { x: 49, y: 55, r: 6, kind: "stretch" },
    arrows: [[{ x: 43, y: 60 }, { x: 40, y: 53 }, { x: 44, y: 47 }]],
    // Whole upper body glides forward over planted feet.
    anim: {
      chains: {
        0: [{ x: 51, y: 23 }, { x: 49, y: 50 }],
        1: [{ x: 50, y: 30 }, { x: 47, y: 46 }],
        2: [{ x: 49, y: 50 }, { x: 62, y: 64 }],
        4: [{ x: 49, y: 50 }, { x: 38, y: 68 }],
      },
      head: { x: 51, y: 16 },
    },
  },
  microWalk: {
    ground: true,
    head: { x: 56, y: 15 },
    chains: [
      [{ x: 56, y: 22 }, { x: 55, y: 50 }],
      [{ x: 55, y: 29 }, { x: 63, y: 42 }],
      [{ x: 55, y: 29 }, { x: 47, y: 42 }],
      [{ x: 55, y: 50 }, { x: 66, y: 66 }, { x: 70, y: 88 }],
      [{ x: 55, y: 50 }, { x: 46, y: 68 }, { x: 38, y: 86 }],
    ],
    arrows: [[{ x: 78, y: 40 }, { x: 94, y: 40 }]],
    // Two-frame march: legs and arms swap.
    anim: {
      chains: {
        1: [{ x: 55, y: 29 }, { x: 47, y: 42 }],
        2: [{ x: 55, y: 29 }, { x: 63, y: 42 }],
        3: [{ x: 55, y: 50 }, { x: 46, y: 68 }, { x: 38, y: 86 }],
        4: [{ x: 55, y: 50 }, { x: 66, y: 66 }, { x: 70, y: 88 }],
      },
      durMs: 1500,
    },
  },
  microChest: {
    ground: true,
    propLines: [
      [{ x: 44, y: 8 }, { x: 44, y: 72 }],
      [{ x: 78, y: 8 }, { x: 78, y: 72 }],
    ],
    head: { x: 60, y: 16 },
    chains: [
      [{ x: 60, y: 23 }, { x: 60, y: 50 }],
      [{ x: 60, y: 28 }, { x: 48, y: 24 }, { x: 46, y: 12 }],
      [{ x: 60, y: 28 }, { x: 72, y: 24 }, { x: 74, y: 12 }],
      [{ x: 60, y: 50 }, { x: 68, y: 68 }, { x: 70, y: 88 }],
      [{ x: 60, y: 50 }, { x: 54, y: 68 }, { x: 52, y: 88 }],
    ],
    glow: { x: 60, y: 30, r: 6, kind: "stretch" },
    // Chest presses gently forward through the frame.
    anim: {
      chains: {
        0: [{ x: 57, y: 23 }, { x: 58, y: 50 }],
        1: [{ x: 57, y: 28 }, { x: 48, y: 24 }, { x: 46, y: 12 }],
        2: [{ x: 57, y: 28 }, { x: 72, y: 24 }, { x: 74, y: 12 }],
      },
      head: { x: 57, y: 16 },
      durMs: 2800,
    },
  },
  microChinTuck: {
    // Base pose = the tucked (target) position; the animation glides the
    // head back into it from the forward start, and the static image shows
    // the forward position as a dashed ghost instead.
    head: { x: 57, y: 33, r: 8.5 },
    dashedCircles: [{ x: 66, y: 35, r: 8.5 }],
    chains: [
      [{ x: 58, y: 88 }, { x: 58, y: 52 }],
      [{ x: 44, y: 60 }, { x: 58, y: 56 }],
      [{ x: 58, y: 52 }, { x: 59, y: 44 }],
    ],
    glow: { x: 59, y: 47, r: 5, kind: "strength" },
    arrows: [[{ x: 80, y: 34 }, { x: 70, y: 34 }]],
    anim: {
      chains: { 2: [{ x: 58, y: 52 }, { x: 63, y: 45 }] },
      head: { x: 66, y: 35 },
      durMs: 2400,
    },
  },

  microSeatedTilt: {
    ground: true,
    rects: [{ x: 26, y: 60, w: 32, h: 5 }],
    propLines: [
      [{ x: 30, y: 65 }, { x: 30, y: 88 }],
      [{ x: 54, y: 65 }, { x: 54, y: 88 }],
      [{ x: 27, y: 58 }, { x: 23, y: 30 }],
    ],
    head: { x: 49, y: 21 },
    chains: [
      [{ x: 44, y: 56 }, { x: 44, y: 42 }, { x: 48, y: 28 }],
      [{ x: 47, y: 34 }, { x: 57, y: 48 }],
      [{ x: 44, y: 56 }, { x: 64, y: 57 }],
      [{ x: 64, y: 57 }, { x: 64, y: 88 }],
    ],
    glow: { x: 42, y: 52, r: 5.5, kind: "strength" },
    arrows: [[{ x: 34, y: 50 }, { x: 31, y: 44 }, { x: 35, y: 38 }]],
    // Rocks between a slight arch (start) and the gentle tuck (active).
    anim: {
      chains: { 0: [{ x: 44, y: 56 }, { x: 50, y: 42 }, { x: 46, y: 28 }] },
      head: { x: 47, y: 21 },
      durMs: 2800,
    },
  },
  microSeatedGlutes: {
    ground: true,
    rects: [{ x: 26, y: 60, w: 32, h: 5 }],
    propLines: [
      [{ x: 30, y: 65 }, { x: 30, y: 88 }],
      [{ x: 54, y: 65 }, { x: 54, y: 88 }],
      [{ x: 27, y: 58 }, { x: 23, y: 30 }],
    ],
    head: { x: 48, y: 19 },
    chains: [
      [{ x: 44, y: 54 }, { x: 47, y: 26 }],
      [{ x: 46, y: 32 }, { x: 56, y: 46 }],
      [{ x: 44, y: 54 }, { x: 64, y: 57 }],
      [{ x: 64, y: 57 }, { x: 64, y: 88 }],
    ],
    glow: { x: 40, y: 56, r: 6, kind: "strength" },
    arrows: [[{ x: 35, y: 62 }, { x: 32, y: 55 }, { x: 36, y: 49 }]],
    // The squeeze lifts you a few millimetres — sit taller at the hold.
    anim: {
      chains: {
        0: [{ x: 44, y: 56 }, { x: 47, y: 28 }],
        2: [{ x: 44, y: 56 }, { x: 64, y: 58 }],
      },
      head: { x: 48, y: 21 },
      durMs: 2400,
    },
  },

  // ---- Self-tests --------------------------------------------------------
  wall: {
    ground: true,
    propLines: [[{ x: 86, y: 8 }, { x: 86, y: 88 }]],
    head: { x: 77, y: 17 },
    chains: [
      [{ x: 77, y: 24 }, { x: 70, y: 40 }, { x: 78, y: 54 }],
      [{ x: 76, y: 29 }, { x: 68, y: 38 }, { x: 80, y: 44 }],
      [{ x: 78, y: 54 }, { x: 75, y: 72 }, { x: 74, y: 88 }],
      [{ x: 78, y: 54 }, { x: 80, y: 72 }, { x: 78, y: 88 }],
    ],
    glow: { x: 82, y: 42, r: 4.5, kind: "stretch" },
    pulse: true,
  },
  thomas: {
    ground: true,
    rects: [{ x: 6, y: 62, w: 58, h: 26 }],
    head: { x: 14, y: 56, r: 6 },
    chains: [
      [{ x: 22, y: 58 }, { x: 58, y: 58 }],
      [{ x: 60, y: 58 }, { x: 58, y: 38 }],
      [{ x: 58, y: 38 }, { x: 46, y: 34 }],
      [{ x: 32, y: 54 }, { x: 56, y: 40 }],
      [{ x: 60, y: 58 }, { x: 78, y: 68 }],
      [{ x: 78, y: 68 }, { x: 76, y: 88 }],
    ],
    dashed: [[{ x: 60, y: 58 }, { x: 80, y: 56 }]],
    glow: { x: 66, y: 60, r: 5.5, kind: "stretch" },
    // Shows the positive-test sign: the hanging thigh floating up from
    // the resting position, then settling back down.
    anim: {
      chains: {
        4: [{ x: 60, y: 58 }, { x: 80, y: 58 }],
        5: [{ x: 80, y: 58 }, { x: 80, y: 78 }],
      },
      durMs: 3000,
    },
  },
};

// Micro-breaks that reuse an existing drawing.
POSES.microStand = POSES.gluteSqueeze;
POSES.microWallTilt = POSES.wallTilt;

// ---- Renderer ------------------------------------------------------------

function pts(list: Pt[]): string {
  return list.map((p) => `${p.x},${p.y}`).join(" ");
}

function arrowPaths(arrow: Pt[]): { body: string; head: string } {
  const end = arrow[arrow.length - 1];
  const prev = arrow[arrow.length - 2];
  const dx = end.x - prev.x;
  const dy = end.y - prev.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const headLen = 6;
  const headW = 3.4;
  const bx = end.x - ux * headLen;
  const by = end.y - uy * headLen;
  const px = -uy;
  const py = ux;
  const head = `M ${end.x} ${end.y} L ${bx + px * headW} ${by + py * headW} L ${
    bx - px * headW
  } ${by - py * headW} Z`;
  let body: string;
  if (arrow.length >= 3) {
    const [p0, p1] = arrow;
    body = `M ${p0.x} ${p0.y} Q ${p1.x} ${p1.y} ${bx} ${by}`;
  } else {
    body = `M ${arrow[0].x} ${arrow[0].y} L ${bx} ${by}`;
  }
  return { body, head };
}

// The movement loop: start → active (hold at the squeeze/stretch) → start,
// with a brief settle at the start position. SMIL keeps the animation
// inside the SVG itself — no JS ticking, works offline, pauses with the
// page.
const KEYTIMES = "0;0.4;0.6;0.95;1";
const SPLINES = "0.45 0 0.25 1;0 0 1 1;0.45 0 0.25 1;0 0 1 1";
const DEFAULT_DUR_MS = 2600;

function loopAnim(
  attr: string,
  start: string,
  active: string,
  durMs: number
): string {
  return `<animate attributeName="${attr}" values="${start};${active};${active};${start};${start}" keyTimes="${KEYTIMES}" calcMode="spline" keySplines="${SPLINES}" dur="${durMs}ms" repeatCount="indefinite"/>`;
}

function pulseAnim(attr: string, lo: string, hi: string, durMs: number): string {
  return `<animate attributeName="${attr}" values="${lo};${hi};${lo}" keyTimes="0;0.5;1" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" dur="${durMs}ms" repeatCount="indefinite"/>`;
}

export interface PoseSvgOptions {
  /** Set false to render a static figure (e.g. prefers-reduced-motion). */
  animate?: boolean;
}

export function poseToSvg(pose: Pose, opts: PoseSvgOptions = {}): string {
  const animate = opts.animate ?? true;
  const moving = animate && !!pose.anim;
  const pulsing = animate && (moving || !!pose.pulse);
  const dur = pose.anim?.durMs ?? DEFAULT_DUR_MS;
  const parts: string[] = [];

  for (const r of pose.rects ?? []) {
    parts.push(
      `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="2" fill="currentColor" opacity="0.12"/>`
    );
  }
  for (const line of pose.propLines ?? []) {
    parts.push(
      `<polyline points="${pts(line)}" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" opacity="0.35"/>`
    );
  }
  if (pose.ground) {
    parts.push(
      `<line x1="6" y1="90" x2="114" y2="90" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity="0.22"/>`
    );
  }
  if (pose.glow) {
    const color = pose.glow.kind === "stretch" ? STRETCH_COLOR : STRENGTH_COLOR;
    const outerPulse = moving
      ? loopAnim("opacity", "0.10", "0.26", dur)
      : pulsing
        ? pulseAnim("opacity", "0.10", "0.26", 2400)
        : "";
    const innerPulse = moving
      ? loopAnim("opacity", "0.16", "0.42", dur)
      : pulsing
        ? pulseAnim("opacity", "0.16", "0.42", 2400)
        : "";
    parts.push(
      `<circle cx="${pose.glow.x}" cy="${pose.glow.y}" r="${pose.glow.r + 3.5}" fill="${color}" opacity="0.16">${outerPulse}</circle>`,
      `<circle cx="${pose.glow.x}" cy="${pose.glow.y}" r="${pose.glow.r}" fill="${color}" opacity="0.3">${innerPulse}</circle>`
    );
  }
  for (const dash of pose.dashed ?? []) {
    parts.push(
      `<polyline points="${pts(dash)}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-dasharray="4 5" opacity="0.35"/>`
    );
  }
  // Dashed target-position hints are for the static image only — during
  // animation the figure itself shows the target.
  if (!moving) {
    for (const dc of pose.dashedCircles ?? []) {
      parts.push(
        `<circle cx="${dc.x}" cy="${dc.y}" r="${dc.r}" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="4 4" opacity="0.4"/>`
      );
    }
  }
  pose.chains.forEach((chain, i) => {
    const startFrame = moving ? pose.anim?.chains?.[i] : undefined;
    const anim =
      startFrame && startFrame.length === chain.length
        ? loopAnim("points", pts(startFrame), pts(chain), dur)
        : "";
    parts.push(
      `<polyline points="${pts(chain)}" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">${anim}</polyline>`
    );
  });
  const head = pose.head;
  const headAnim =
    moving && pose.anim?.head
      ? loopAnim("cx", String(pose.anim.head.x), String(head.x), dur) +
        loopAnim("cy", String(pose.anim.head.y), String(head.y), dur)
      : "";
  parts.push(
    `<circle cx="${head.x}" cy="${head.y}" r="${head.r ?? 6.5}" fill="currentColor">${headAnim}</circle>`
  );
  for (const arrow of pose.arrows ?? []) {
    const { body, head: headPath } = arrowPaths(arrow);
    parts.push(
      `<path d="${body}" fill="none" stroke="${ARROW_COLOR}" stroke-width="3" stroke-linecap="round"/>`,
      `<path d="${headPath}" fill="${ARROW_COLOR}"/>`
    );
  }

  return `<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">${parts.join(
    ""
  )}</svg>`;
}
