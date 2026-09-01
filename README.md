# PostureGuard — Your Anterior Pelvic Tilt Companion

**A free, privacy-first coach for fixing anterior pelvic tilt (APT): a daily guided corrective routine, camera posture check-ins, and a desk companion that breaks up the sitting that caused the problem. Runs on your phone and your computer, entirely on-device.**

**Live app: [https://nopain.gonav.tech](https://nopain.gonav.tech)**

A [Govind Kedia](https://www.gonav.tech) / [GoNav Tech](https://www.gonav.tech) product.

---

## What is PostureGuard?

PostureGuard is a companion app for people with anterior pelvic tilt — the forward-tipped pelvis, arched lower back and pushed-out belly that a sitting job quietly builds over years. It's designed around the one thing that actually corrects APT: **a short corrective routine done nearly every day for 8–12 weeks, plus fewer unbroken hours in a chair.**

The app has five parts:

- **Today** — your daily 10–15 minute routine with a guided player: timers, step-by-step cues, optional voice coaching, streaks, and a three-level program that progresses as you do (Reset → Build → Strengthen). Exercises follow the standard lower-crossed-syndrome approach: stretch the tight hip flexors and lower back, strengthen the weak glutes, abs and hamstrings, and re-learn where neutral pelvis is.
- **Check** — measurable check-ins. A guided **side-view camera check** (prop your phone, stand sideways, auto-capture) estimates the alignment pattern that travels with APT — hips pushed forward over the ankles, ribcage behind the pelvis, forward head, locked knees — and tracks it over weeks. Plus the two classic at-home self-tests, guided step by step: the **wall test** (lumbar gap) and the **Thomas test** (hip flexor length).
- **Desk** — the live webcam posture monitor for work hours, now with a **sitting-break coach**: because the camera can tell whether you're actually at the desk, it counts *continuous* seated time, nudges you up before your hip flexors set, logs the break automatically when you actually stand up, and hands you a 30-second APT micro-break to do.
- **Progress** — routine streaks and a 4-week calendar, camera check-in trends, self-test history, sitting-break stats, and your desk-session insights.
- **Learn** — plain-language education: what APT is (and how much tilt is normal), why sitting feeds it, what fixes it, what cameras can and can't measure, and when to see a professional.

Install it on your phone (it's a PWA — "Add to Home Screen"), keep it open at your desk, or build the Electron desktop app.

## Being honest about what the cameras measure

Most "posture apps" oversell their cameras. Here's the truth this app is built on:

- A pose model estimates joint centers, not the bony pelvic landmarks a clinician uses to measure true pelvic tilt. So the side-view check reports **alignment proxies** (as % of body height) and treats the **trend across weeks** as the signal — it is not a medical measurement.
- A desk webcam sees your upper body from the front. It can never see your pelvis while you sit. Its honest jobs are neck/shoulder posture and *presence detection* — which is exactly what makes the sitting-break coach work.
- For the pelvis itself, the low-tech wall test and Thomas test tell you more than any camera. That's why they're first-class citizens in the app.

## Privacy first — nothing leaves your device

**PostureGuard is built so that you can trust it with your camera.**

### What we *don't* do

- **We don't see your video.** Camera streams are processed entirely inside your browser. The side-view check saves only the measured angles — never a photo.
- **We don't have a server.** PostureGuard is a static web page. There is no backend that could receive your data even if it tried.
- **No accounts, no signups, no cookies, no tracking pixels, no analytics.**
- **We don't sell or share data.** There is nothing to sell.
- **No third-party scripts** at runtime.

### How it actually works (the technical bit)

PostureGuard uses [Google MediaPipe](https://developers.google.com/mediapipe) — the same on-device computer-vision toolkit that ships inside Android and Chrome — compiled to WebAssembly and run by your browser:

1. On first use, your browser downloads two static files: the MediaPipe runtime (a small WebAssembly binary) and the pose model (~6 MB `.task` file), both from Google's public CDN. The service worker caches them, so afterwards the app works offline.
2. Camera frames are fed *only* into the local model inside your browser tab. It returns coordinates (where your shoulders, hips, ears are), which are analyzed by the JavaScript you already loaded.
3. **No frame, no coordinate, no result is ever transmitted out of your device.** After the initial model load, the app makes zero outbound network requests.

Verify it yourself: open DevTools → Network, use the app, and watch the silence.

### Your data stays local

Routines completed, streaks, check-in results, self-tests, sitting breaks, desk-session history, and settings all live in your browser's `localStorage` (every key is prefixed `postureguard.`). Clearing browser data wipes it. Nothing syncs anywhere.

## The program (what you'll actually do)

| Level | Focus | Sample day |
|---|---|---|
| **1 · Reset** | Find neutral pelvis, wake up glutes + deep core | 90/90 breathing · lying pelvic tilts · glute bridges · dead bugs · half-kneeling hip flexor stretch · child's pose |
| **2 · Build** | Neutral pelvis while standing, single-leg glute work | wall tilts · single-leg bridges · reverse crunches · hard-style plank · couch stretch |
| **3 · Strengthen** | Real load — the level you keep | hip thrusts · hamstring walkouts · hollow holds · couch stretch · wall tilts |

The app suggests moving up after ~2 weeks and 10 completed days on a level. Every stretch is cued with the detail that matters most for APT (*tuck the pelvis first*), and every core exercise with the giveaway to avoid (*the low back never leaves the floor*).

Two things make the routines easy to follow:

- **Reference diagrams for every exercise** (and both self-tests) — side-view figures with the target muscle highlighted and the key motion arrowed. They're drawn in code, not AI-generated or stock photos, so every joint angle is deliberate and the form shown is the form meant.
- **A voice coach with real encouragement** — spoken setup cues, halfway and final-stretch motivation on longer holds, praise between steps, and a streak-aware send-off. On the Today tab you can pick any voice installed on your device (phones usually ship excellent neural voices), set the speaking pace, and preview it. All of it runs on-device via the Web Speech API — free, offline, nothing sent anywhere.

At the desk, the sitting coach defaults to a nudge every 40 minutes of continuous sitting, and the micro-break library (standing hip flexor opener, wall tilts, glute resets, a two-minute walk) undoes the position between routines.

## Desk features carried forward

The original PostureGuard desk monitor is all still here: real-time neck/shoulder/head tracking, activity awareness (it stays quiet when you're on a call, on your phone, talking to someone, or away), one alert per episode with a 12-minute quiet window, five chime tones, voice reminders, water/stretch/eye-break habit timers, camera-saver duty cycling, background-tab operation, and light/dark themes.

## Try it now

Open **[https://nopain.gonav.tech](https://nopain.gonav.tech)** in any modern browser.

- **On your phone:** use the browser menu → *Add to Home Screen* to install it as an app. Do the daily routine and the side-view checks here.
- **At your desk:** keep it open in a tab (or build the desktop app) and start Desk guard when you sit down.

## Not medical advice

PostureGuard is an educational and habit tool. Some anterior tilt is normal anatomy; the app coaches toward comfort and control, not a perfect number. If you have radiating pain, numbness or tingling, night pain, pain after trauma, or no change after 8–12 weeks of consistent work — see a physiotherapist or physician. If a professional's guidance conflicts with this app, follow the professional.

## For developers — local setup

Source-available under the PolyForm Noncommercial License 1.0.0 — free for personal, educational, research, and other non-commercial use.

```bash
# Requirements: Node.js 18+
npm install
npm run dev
```

The dev server runs at `http://localhost:5173`.

### Production build

```bash
npm run build       # outputs to dist/ (static site + PWA service worker)
npm run preview     # serve the production build locally
```

The `dist/` folder is a fully static site — host it on any CDN or static server. Camera access requires HTTPS in production (or localhost in dev).

### Desktop app (Electron)

```bash
npm run package         # current OS
npm run package:mac     # macOS .dmg
npm run package:win     # Windows installer
npm run package:linux   # Linux AppImage
```

The desktop build bundles the MediaPipe model locally, so it runs fully offline. See [BUILDING.md](BUILDING.md) and [DEPLOYING.md](DEPLOYING.md).

### Regenerating the PWA icons

```bash
npm run icons   # dependency-free PNG generator → public/*.png
```

## Tech stack

- **React 19** + **TypeScript**, **Vite**
- **MediaPipe Tasks Vision** for on-device pose landmarks
- **PWA** (manifest + service worker) for the installable mobile app
- **Electron** for the desktop app
- **Web Audio API** chimes · **Web Speech API** voice coaching
- No backend, no database, no analytics — by design

## License

Licensed under the **[PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/)**. See [LICENSE](LICENSE) and [NOTICE](NOTICE).

```
Copyright 2026 Govind Kedia / GoNav Tech (https://www.gonav.tech)
```

- **Free** for personal use, study, research, hobby projects, education, and charitable / public-interest organizations.
- **Not** free for commercial use — running PostureGuard as part of a paid product or service requires a separate license.
- **Modifications welcome** for any permitted (non-commercial) purpose, shared under the same terms.

**Commercial licensing inquiries:** [contact@analystology.com](mailto:contact@analystology.com)

## Credits

- Created by **[Govind Kedia](https://www.gonav.tech)**, brought to you by **[GoNav Tech](https://www.gonav.tech)**
- Pose detection powered by [Google MediaPipe](https://developers.google.com/mediapipe)

If PostureGuard helps your back feel better, share it with someone else whose chair is winning.

## Keywords

anterior pelvic tilt fix, APT exercises, pelvic tilt correction app, lower crossed syndrome, hip flexor stretch reminder, posture corrector, ai posture monitor, webcam posture tracker, sitting break timer, desk posture, tech neck, forward head posture, ergonomic monitor, slouch detector, remote work health, posture self-assessment, wall test, Thomas test, glute bridge routine, on-device pose detection, privacy-first health app.
