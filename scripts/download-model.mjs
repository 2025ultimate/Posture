#!/usr/bin/env node
// Downloads the pose-landmarker model once into public/models/ so the
// packaged Electron app can load it offline.
import { mkdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";
const OUT_DIR = path.join("public", "models");
const OUT_FILE = path.join(OUT_DIR, "pose_landmarker_lite.task");
// Real model is ~5.5 MB; anything much smaller is a failed/truncated download.
const MIN_SIZE = 1_000_000;

try {
  const s = await stat(OUT_FILE);
  if (s.size >= MIN_SIZE) {
    const mb = (s.size / 1024 / 1024).toFixed(1);
    console.log(`Model already present at ${OUT_FILE} (${mb} MB) — skipping.`);
    process.exit(0);
  }
} catch {
  // Doesn't exist yet.
}

await mkdir(OUT_DIR, { recursive: true });

console.log(`Downloading pose-landmarker model...`);
console.log(`  ${MODEL_URL}`);
const res = await fetch(MODEL_URL);
if (!res.ok) {
  console.error(`Download failed: HTTP ${res.status} ${res.statusText}`);
  process.exit(1);
}
const buf = Buffer.from(await res.arrayBuffer());
await writeFile(OUT_FILE, buf);
const mb = (buf.byteLength / 1024 / 1024).toFixed(1);
console.log(`Saved ${mb} MB to ${OUT_FILE}`);
