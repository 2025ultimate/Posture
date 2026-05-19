# PostureGuard

Real-time posture monitoring web application that uses your webcam and AI-powered pose detection to continuously analyze your posture and alert you when corrections are needed.

## Features

- Real-time pose detection using MediaPipe Pose Landmarker
- 5 posture metrics: Neck Tilt, Shoulder Level, Head Position, Eye Level, Slouch Guard
- Audio beep alerts when poor posture is detected (every 5 seconds)
- Voice announcement ("Please correct your posture") after 15 seconds of continued non-compliance
- Live skeleton overlay on mirrored camera feed
- Color-coded status indicators (green = good, red = bad)
- Smoothed results to prevent false alarms

## Requirements

- Node.js 18 or higher
- A modern browser with camera support (Chrome, Edge, Firefox)
- Webcam access

## Local Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`.

## Production Build

```bash
# Build for production
npm run build

# Preview the production build locally
npm run preview
```

The production build outputs to the `dist/` folder and can be served by any static file server.

## Hosting Locally with a Static Server

After building, you can serve the `dist` folder with any static HTTP server:

```bash
# Option 1: Using Node's built-in serve (npx)
npx serve dist

# Option 2: Using Python
python3 -m http.server 8080 --directory dist

# Option 3: Using the Vite preview command
npm run preview
```

Note: The app requires HTTPS or localhost to access the camera. If hosting on a LAN, use a tool like `mkcert` to generate local certificates, or access via `localhost`.

## How It Works

1. Click "Start Monitoring" to initialize the AI model and camera
2. Sit in front of your webcam as you normally work
3. The app continuously tracks your pose landmarks (shoulders, ears, eyes, hips)
4. When posture degrades beyond thresholds, you get:
   - Immediate visual feedback (red border, warning overlay)
   - Audio beep alerts every 5 seconds
   - Voice announcement after 15 seconds of non-compliance
5. Once you correct your posture, the status returns to green

## Tech Stack

- React 19 + TypeScript
- Vite (build tool)
- MediaPipe Tasks Vision (pose detection)
- Web Audio API (beep alerts)
- Web Speech API (voice announcements)
