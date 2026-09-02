import { useMemo } from "react";
import { POSES, poseToSvg } from "../apt/exercisePoses";
import { useReducedMotion } from "../useReducedMotion";

// Renders the reference diagram for an exercise or self-test — animated
// (start → active → start loop) unless the user prefers reduced motion.
// The SVG string comes from our own static pose data (no user input), so
// injecting it directly is safe.

export function ExerciseFigure({
  id,
  label,
  size = 160,
}: {
  id: string;
  label?: string;
  size?: number;
}) {
  const reducedMotion = useReducedMotion();
  const pose = POSES[id];
  const svg = useMemo(
    () => (pose ? poseToSvg(pose, { animate: !reducedMotion }) : null),
    [pose, reducedMotion]
  );
  if (!svg) return null;
  return (
    <div
      className="ex-figure"
      style={{ width: size }}
      role="img"
      aria-label={label ? `${label} — reference diagram` : "Exercise reference diagram"}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
