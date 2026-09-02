import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { analyzeSideView } from "./apt/sideView";

// Shared camera-frame rendering for the snapshot check and the live coach:
// the mirrored video frame, the ear→shoulder→hip→knee→ankle chain of the
// visible side, and the plumb line rising from the ankle — the reference
// the body should stack over.

// Landmark chain drawn on the frame, per visible side.
export const SIDE_CHAIN = {
  left: [7, 11, 23, 25, 27],
  right: [8, 12, 24, 26, 28],
};

export function drawCameraFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  landmarks: NormalizedLandmark[] | null,
  mirror: boolean,
  emphasize: boolean
): void {
  if (video.videoWidth === 0) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  ctx.save();
  if (mirror) {
    ctx.scale(-1, 1);
    ctx.translate(-canvas.width, 0);
  }
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  ctx.restore();

  if (!landmarks) return;
  const pts = landmarks.map((lm) => ({
    x: (mirror ? 1 - lm.x : lm.x) * canvas.width,
    y: lm.y * canvas.height,
  }));

  const analysis = analyzeSideView(landmarks);
  const side = analysis.ok ? analysis.metrics.side : null;
  const chain = side ? SIDE_CHAIN[side] : null;
  if (!chain) return;

  const ankle = pts[chain[4]];
  ctx.strokeStyle = emphasize ? "rgba(148, 197, 255, 0.9)" : "rgba(148, 197, 255, 0.45)";
  ctx.setLineDash([8, 8]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ankle.x, canvas.height * 0.03);
  ctx.lineTo(ankle.x, ankle.y + 14);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = emphasize ? "#22d3ee" : "rgba(34, 211, 238, 0.75)";
  ctx.lineWidth = emphasize ? 4 : 3;
  ctx.beginPath();
  chain.forEach((idx, i) => {
    const p = pts[idx];
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.stroke();

  for (const idx of chain) {
    const p = pts[idx];
    ctx.fillStyle = "#f472b6";
    ctx.beginPath();
    ctx.arc(p.x, p.y, emphasize ? 7 : 5, 0, Math.PI * 2);
    ctx.fill();
  }
}
