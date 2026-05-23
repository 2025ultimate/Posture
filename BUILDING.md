# Building PostureGuard

This document covers how to build PostureGuard as a desktop app for
macOS, Windows, and Linux.

## Prerequisites

- Node.js **18 or newer** (built-in `fetch` is used by the asset download
  script).
- ~600 MB free disk space for `node_modules` + build outputs.
- On macOS, building a signed/notarized DMG additionally requires Xcode
  command-line tools and an Apple Developer ID certificate.
- On Windows, building a signed installer requires a valid code-signing
  certificate; unsigned installers will work but will show a SmartScreen
  warning on first launch.

## Layout

```
electron/         # Main-process source (TypeScript, compiled to dist-electron/)
src/              # Renderer (React app)
public/           # Static assets bundled into dist/
scripts/          # Build-time helpers (asset copy, model download)
build/            # electron-builder resources (entitlements, icons)
dist/             # Vite renderer output (generated)
dist-electron/    # Electron main output (generated)
release/          # Packaged installers (generated)
```

## Quick start (development)

```bash
npm install
npm run dev           # browser-only dev server on http://localhost:5173
npm run dev:electron  # opens the desktop window pointed at the dev server
```

In `dev:electron`, edits to `src/` hot-reload. Edits to `electron/` require
a restart (the main process is loaded once).

## Producing a desktop installer

```bash
npm install
npm run bundle-assets      # copies MediaPipe WASM + downloads the model (~5.5 MB)
npm run package            # builds renderer, builds main, packages installer
```

The installer ends up under `release/`:

- macOS: `release/PostureGuard-<version>-arm64.dmg` and `-x64.dmg`
- Windows: `release/PostureGuard Setup <version>.exe`
- Linux: `release/PostureGuard-<version>.AppImage`

Platform-specific shortcuts: `npm run package:mac`, `package:win`,
`package:linux`. You can only cross-build between platforms with extra
setup; for production use, build each on its native OS (or via CI runners).

## Self-contained / offline builds

`npm run bundle-assets` does two things:

1. **`scripts/copy-wasm.mjs`** — copies the MediaPipe WASM runtime from
   `node_modules/@mediapipe/tasks-vision/wasm/` into `public/wasm/`.
2. **`scripts/download-model.mjs`** — fetches the pose-landmarker model
   (~5.5 MB) into `public/models/pose_landmarker_lite.task`. It is
   idempotent; re-runs are no-ops if the file already exists.

When the renderer runs under `file://` (i.e., a packaged Electron app),
it loads these local copies instead of the CDN — so the installed app
needs no network at runtime.

`npm run dev` (browser-only) continues to load from the CDN because the
`./wasm` path won't resolve outside Electron unless you also serve the
files. Run `npm run bundle-assets` once if you want the browser dev
server to serve them too — Vite will pick them up from `public/`.

## Icons

electron-builder looks for icons under `build/`:

- `build/icon.icns` (macOS — 1024×1024)
- `build/icon.ico` (Windows — 256×256 with multiple resolutions)
- `build/icon.png` (Linux — 512×512 or 1024×1024)

If only `build/icon.png` is present, electron-builder will auto-generate
`.icns` and `.ico` from it on the corresponding platforms. Provide a
single 1024×1024 PNG to cover all three.

A placeholder is **not** included in the repo. Until you add one,
electron-builder uses Electron's default icon.

## Code signing

### macOS

To produce a notarized DMG that opens without Gatekeeper warnings:

1. Place your Developer ID certificate in the keychain.
2. Set the following environment variables before running `npm run package:mac`:

   ```bash
   export CSC_LINK=/path/to/cert.p12      # or already-in-keychain identity name
   export CSC_KEY_PASSWORD=...
   export APPLE_ID=you@example.com
   export APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
   export APPLE_TEAM_ID=ABCD123456
   ```

3. electron-builder reads these and runs `notarytool` automatically.

The entitlements at `build/entitlements.mac.plist` grant camera access
and JIT (needed by MediaPipe's WASM). Don't strip them.

### Windows

Set `CSC_LINK` and `CSC_KEY_PASSWORD` to a `.pfx` and its password, then
run `npm run package:win`. Without these the installer is unsigned and
SmartScreen will warn on first launch.

## Troubleshooting

- **"Camera permission denied" in Electron** — the main process already
  grants camera permission in `electron/main.ts`. If the prompt loops,
  reset macOS camera permissions for the app:
  `tccutil reset Camera com.postguard.postureguard`.
- **"Cannot find module" loading WASM** — `npm run bundle-assets` was
  skipped. Re-run it.
- **DMG build fails on Linux/Windows** — DMG can only be built on macOS.
  Build per-OS or use a CI matrix.
- **Model download stalls behind a proxy** — set `HTTPS_PROXY` for the
  shell that runs `npm run bundle-assets`.
