#!/usr/bin/env node
// Copies MediaPipe WASM files from node_modules to public/wasm/
// so the packaged app can load them locally (no CDN needed at runtime).
import { cp, mkdir, stat } from "node:fs/promises";
import path from "node:path";

const SRC = path.join("node_modules", "@mediapipe", "tasks-vision", "wasm");
const DEST = path.join("public", "wasm");

try {
  await stat(SRC);
} catch {
  console.error(`Source not found: ${SRC}`);
  console.error("Run `npm install` first.");
  process.exit(1);
}

await mkdir("public", { recursive: true });
await cp(SRC, DEST, { recursive: true });
console.log(`Copied MediaPipe WASM to ${DEST}/`);
