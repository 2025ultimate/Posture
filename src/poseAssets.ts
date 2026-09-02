import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

// Shared MediaPipe asset resolution for the desk monitor and the posture
// check camera. In a packaged Electron app the page is loaded via file://
// — prefer the locally bundled WASM + model so the app works offline.
// In dev/web fall back to the CDN. These are the only two external URLs
// in the whole app.

const WASM_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_CDN =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";
const WASM_LOCAL = "./wasm";
const MODEL_LOCAL = "./models/pose_landmarker_lite.task";

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.electronAPI?.isElectron) return true;
  return window.location.protocol === "file:";
}

export async function createPoseLandmarker(): Promise<PoseLandmarker> {
  const standalone = isStandalone();
  const vision = await FilesetResolver.forVisionTasks(
    standalone ? WASM_LOCAL : WASM_CDN
  );
  return PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: standalone ? MODEL_LOCAL : MODEL_CDN,
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numPoses: 1,
  });
}
