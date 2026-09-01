// Builds src/apt/exerciseDb.json from the Free Exercise DB dataset.
//
// Source: https://github.com/yuhonas/free-exercise-db (Unlicense — public
// domain), dist/exercises.json. We strip each record to the fields the
// Library view uses; images stay in the upstream repo and load on demand
// (see exerciseLibrary.ts).
//
//   curl -sL https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json -o /tmp/exercises-raw.json
//   node scripts/build-exercise-db.mjs /tmp/exercises-raw.json

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const src = process.argv[2];
if (!src) {
  console.error("usage: node scripts/build-exercise-db.mjs <exercises-raw.json>");
  process.exit(1);
}

const raw = JSON.parse(readFileSync(src, "utf8"));

const stripped = raw.map((e) => ({
  id: e.id ?? e.name.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
  name: e.name,
  level: e.level ?? null,
  category: e.category ?? null,
  equipment: e.equipment || null,
  mechanic: e.mechanic ?? null,
  primaryMuscles: e.primaryMuscles ?? [],
  secondaryMuscles: e.secondaryMuscles ?? [],
  instructions: e.instructions ?? [],
  images: e.images ?? [],
}));

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = join(__dirname, "..", "src", "apt", "exerciseDb.json");
writeFileSync(out, JSON.stringify(stripped));
console.log(`wrote ${out}: ${stripped.length} exercises, ${(JSON.stringify(stripped).length / 1024).toFixed(0)} KB`);
