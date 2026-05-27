# PostureGuard — AI Posture Corrector for Your Computer

**A free, privacy-first posture correction tool that uses your webcam and on-device AI to help you sit better, work healthier, and prevent neck and back pain — at your desk, at home, or in the office.**

**Live demo: [https://nopain.gonav.tech](https://nopain.gonav.tech)**

A [Govind Kedia](https://www.gonav.tech) / [GoNav Tech](https://www.gonav.tech) product.

---

## What is PostureGuard?

PostureGuard is a real-time posture monitor that runs entirely in your browser. Point your webcam at yourself while you work, and it quietly watches your neck, shoulders, and head position. The moment you slip into a slouch or "tech neck," it pings you with a gentle reminder. Nothing fancy to install, no account to create, no video ever leaves your computer.

It's built for anyone who spends long hours in front of a screen — software developers, designers, students, gamers, writers, traders, remote workers, and anyone who's noticed their neck or back hurting at the end of the day.

## Try it now

Open the demo in any modern browser (Chrome, Edge, Firefox, or Safari) and click Start Monitoring:

**[https://nopain.gonav.tech](https://nopain.gonav.tech)**

The first time you start it, your browser will ask permission to use the camera. That permission is local-only — the video stream is processed on your machine and never uploaded anywhere.

## Features

### Smart posture analysis

- Tracks four real-time signals every second: neck tilt, shoulder level, head-forward position, and eye level
- AI-powered pose detection (Google MediaPipe) running fully on-device
- Smoothed scoring so a one-frame glitch doesn't trigger a false alarm

### Knows when not to nag

PostureGuard recognizes when you're doing something other than focused desk work and stays quiet:

- **On a phone call** — detects your hand at your ear
- **Looking at your phone** — detects head bent forward with phone in hand
- **Talking to someone** — detects head turned to the side
- **Away from the desk** — detects when no one is in the frame
- **Moving around** — gesturing, stretching, drinking water — alerts pause automatically for a few seconds after you settle

### Respectful alerts

- One alert per bad-posture episode, then a **12-minute quiet window** — no constant pinging
- Pick from five chime tones (Beep, Ding, Chime, Chirp, Buzz)
- **Pause Alerts** button with a **Spacebar shortcut** when you need full silence

### Healthy habit reminders

Built-in 20-20-20 eye-care, hydration, and stand-and-stretch reminders. Each one is independently configurable:

- Choose the interval (Water default 45 min, Stretch 60 min, Eye break 20 min)
- Pick **Ping** for a short chime, or **Voice** for a spoken reminder
- Reminders automatically pause when you Pause Alerts or Stop Monitoring

### Exercise break library

Eight desk-friendly exercises with timed countdowns — neck rolls, shoulder shrugs, chin tucks, doorway chest stretch, seated spinal twist, wrist flexor stretch, eye palming, and upper back stretch. One-tap shuffle and built-in 20-to-60-second timer.

### Insights from your sessions

- See your total tracked time, average bad-posture percentage, and top recurring issues
- Posture quality broken down by time of day (Morning / Afternoon / Evening / Late night)
- Personalized recommendations as the data builds up

### Built for long sessions

- **Camera saver** mode cycles the camera on and off to reduce CPU and battery use during multi-hour sessions
- **Background mode** — alerts keep firing even when the tab isn't focused
- **Dark and light themes** — switches automatically with your OS, or pick one manually

### Privacy first

- 100% on-device processing — your video never leaves your computer
- No tracking, no accounts, no server
- Works offline as a desktop app (macOS, Windows, Linux via Electron)

## Who is this for?

- Software engineers, designers, and PMs spending 8+ hours on a laptop
- Students and researchers in long study sessions
- Remote and work-from-home professionals
- Gamers and streamers concerned about long-term posture
- Writers, traders, accountants, and anyone with a desk job
- Physical therapists looking for a simple home-use tool for their patients

## Why PostureGuard?

Most posture correction tools either need a hardware wearable, send your video to the cloud, or nag you constantly. PostureGuard solves all three:

- **No hardware** — just your webcam
- **No cloud** — pose analysis runs locally with MediaPipe
- **No nagging** — the 12-minute alert cooldown and the activity detection (phone, talking, writing) mean you only hear from it when it matters

It's the same kind of AI pose detection used by professional fitness and rehab apps, repurposed for posture correction at your desk and made free for anyone to use.

## How it works

1. Open the [demo](https://nopain.gonav.tech) in your browser
2. Click **Start Monitoring** and allow camera access
3. Sit normally and work as you usually do
4. When your posture starts to slip:
   - The status badge turns red and shows specifically what's off (neck tilted, head too far forward, etc.)
   - After about 8 seconds of sustained bad posture, a gentle chime plays
   - You then get a 12-minute quiet period — no further beeps until you've had time to correct or relax
5. Click **Stop Monitoring** when you're done. The session is saved locally for your Insights.

## For developers — local setup

PostureGuard is source-available under the PolyForm Noncommercial License 1.0.0 — free for personal, educational, research, and other non-commercial use. To run it locally:

```bash
# Requirements: Node.js 18+
npm install
npm run dev
```

The dev server runs at `http://localhost:5173`.

### Production build

```bash
npm run build       # outputs to dist/
npm run preview     # serve the production build locally
```

The `dist/` folder is a fully static site — host it on any CDN, static server, or S3 bucket. Camera access requires HTTPS in production (or localhost for development).

### Build the desktop app (Electron)

```bash
npm run package         # current OS
npm run package:mac     # macOS .dmg
npm run package:win     # Windows installer
npm run package:linux   # Linux AppImage
```

See [BUILDING.md](BUILDING.md) for details and [DEPLOYING.md](DEPLOYING.md) for self-hosting notes.

## Tech stack

- **React 19** + **TypeScript** for the UI
- **Vite** for the build pipeline
- **MediaPipe Tasks Vision** for on-device pose landmark detection
- **Electron** for the optional desktop app
- **Web Audio API** for chime synthesis
- **Web Speech API** for the optional voice reminders

## License

Licensed under the **[PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/)**. See the [LICENSE](LICENSE) file for the full text and [NOTICE](NOTICE) for third-party attributions.

```
Copyright 2026 Govind Kedia / GoNav Tech (https://www.gonav.tech)

Licensed under the PolyForm Noncommercial License 1.0.0.
```

In short:

- **Free** for personal use, study, research, hobby projects, education, and use by charitable / public-interest organizations.
- **Not** free for commercial use — running PostureGuard as part of a paid product, paid service, or any commercial offering requires a separate license.
- **Modifications are welcome** for any permitted (non-commercial) purpose; you may share your changes under the same terms.

**Commercial licensing inquiries:** [hello@gonav.tech](mailto:hello@gonav.tech)

## Credits

- Created by **[Govind Kedia](https://www.gonav.tech)**
- Brought to you by **[GoNav Tech](https://www.gonav.tech)**
- Pose detection powered by [Google MediaPipe](https://developers.google.com/mediapipe)

If PostureGuard helps you sit a little straighter, share it with someone else who could use a small nudge.

## Keywords

posture corrector, ai posture monitor, webcam posture tracker, posture correction software, free posture app, desk posture, tech neck, forward head posture, ergonomic monitor, slouch detector, remote work health, work from home posture, real-time posture analysis, browser-based posture tool, mediapipe pose detection, computer vision posture, healthy desk habits, 20-20-20 eye rule, sit straight reminder, neck pain prevention.
