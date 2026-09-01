// Captures the manifest screenshots (public/screens/*) that Android/Chrome
// shows in the rich install sheet. Run with the dev server already up:
//
//   npm run dev            # in another terminal
//   node scripts/capture-screenshots.mjs
//
// Requires Playwright. If it isn't installed locally, point PLAYWRIGHT at
// a module path, e.g.:
//   PLAYWRIGHT=/opt/node22/lib/node_modules/playwright/index.mjs \
//     node scripts/capture-screenshots.mjs

import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const { chromium } = await import(process.env.PLAYWRIGHT ?? "playwright");

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public", "screens");
mkdirSync(OUT, { recursive: true });

const BASE = process.env.BASE_URL ?? "http://localhost:5173";

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? undefined,
  args: ["--no-sandbox"],
});

// Phone captures (390×844 = manifest "narrow").
const phone = await (
  await browser.newContext({ viewport: { width: 390, height: 844 } })
).newPage();

await phone.goto(`${BASE}/#today`);
await phone.waitForTimeout(1200);
await phone.screenshot({ path: join(OUT, "phone-today.png") });

const start = phone.locator("button.routine-start");
if (await start.count()) {
  await start.click();
  await phone.waitForTimeout(1500);
  await phone.screenshot({ path: join(OUT, "phone-player.png") });
  phone.once("dialog", (d) => d.accept());
  await phone.locator("button.player-close").click();
  await phone.waitForTimeout(400);
}

await phone.goto(`${BASE}/#check`);
await phone.waitForTimeout(600);
await phone.screenshot({ path: join(OUT, "phone-check.png") });

await phone.goto(`${BASE}/#desk`);
await phone.waitForTimeout(600);
await phone.screenshot({ path: join(OUT, "phone-desk.png") });

// Desktop capture (1280×800 = manifest "wide").
const desktop = await (
  await browser.newContext({ viewport: { width: 1280, height: 800 } })
).newPage();
await desktop.goto(`${BASE}/#today`);
await desktop.waitForTimeout(1000);
await desktop.screenshot({ path: join(OUT, "desktop-today.png") });

await browser.close();
console.log(`wrote manifest screenshots to ${OUT}`);
