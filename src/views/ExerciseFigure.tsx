import { useMemo } from "react";
import { POSES, poseToSvg } from "../apt/exercisePoses";

// Renders the reference diagram for an exercise or self-test. The SVG
// string comes from our own static pose data (no user input), so
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
  const pose = POSES[id];
  const svg = useMemo(() => (pose ? poseToSvg(pose) : null), [pose]);
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
