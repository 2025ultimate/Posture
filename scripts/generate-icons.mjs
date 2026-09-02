// Generates the PWA / touch icons as PNGs with zero dependencies:
// the PostureGuard figure drawn via signed-distance functions into an
// RGBA buffer, then encoded as PNG by hand (zlib is in node core).
//
//   node scripts/generate-icons.mjs
//
// Outputs (committed to the repo so builds don't need to re-run this):
//   public/pwa-192.png            regular icon
//   public/pwa-512.png            regular icon
//   public/pwa-maskable-512.png   maskable (figure inside the safe zone)
//   public/apple-touch-icon.png   180px, opaque

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public");

// ---- PNG encoding --------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(rgba, width, height) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // compression 0, filter 0, interlace 0 (already zeroed)
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- SDF drawing ---------------------------------------------------------

const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

function sdSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / (abx * abx + aby * aby || 1)));
  return dist(px, py, ax + abx * t, ay + aby * t);
}

function sdRoundRect(px, py, cx, cy, hw, hh, r) {
  const dx = Math.abs(px - cx) - (hw - r);
  const dy = Math.abs(py - cy) - (hh - r);
  const ox = Math.max(dx, 0);
  const oy = Math.max(dy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(dx, dy), 0) - r;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// coverage from a signed distance, ~1px anti-aliasing band
function cov(d) {
  return Math.max(0, Math.min(1, 0.5 - d));
}

/**
 * Render one icon.
 * @param size    output pixel size
 * @param opts    { maskable: fill whole square + shrink glyph;
 *                  opaque: no transparent corners (apple touch icon) }
 */
function renderIcon(size, { maskable = false, opaque = false } = {}) {
  const rgba = Buffer.alloc(size * size * 4);

  // Figure geometry in the 28-unit logo viewBox, drawn as capsules.
  const STROKE = 2.5 / 2; // stroke radius in logo units
  const HEAD = { x: 14, y: 7, r: 4 };
  const SEGMENTS = [
    [14, 11, 14, 20], // spine
    [8, 14, 14, 12], // left arm
    [14, 12, 20, 14], // right arm
    [14, 20, 10, 26], // left leg
    [14, 20, 18, 26], // right leg
  ];

  // Scale glyph into the icon. Maskable icons must keep everything inside
  // the central 80% safe zone, so shrink further.
  const glyphFrac = maskable ? 0.52 : 0.62;
  const scale = (size * glyphFrac) / 28;
  const ox = (size - 28 * scale) / 2;
  const oy = (size - 28 * scale) / 2 - (maskable ? 0 : size * 0.008);

  const cornerR = maskable || opaque ? 0 : size * 0.22;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5;
      const py = y + 0.5;

      // Background: rounded square (or full square for maskable/opaque)
      // with a vertical blue gradient.
      let bgA;
      if (cornerR > 0) {
        const d = sdRoundRect(px, py, size / 2, size / 2, size / 2, size / 2, cornerR);
        bgA = cov(d);
      } else {
        bgA = 1;
      }

      const t = py / size;
      // #1e40af → #3b82f6 vertical gradient with a slight radial lift
      const cx = (px - size / 2) / size;
      const lift = Math.max(0, 0.18 - (cx * cx + (t - 0.32) ** 2) * 0.55);
      let r = lerp(0x1e, 0x3b, t) + lift * 40;
      let g = lerp(0x40, 0x82, t) + lift * 40;
      let b = lerp(0xaf, 0xf6, t) + lift * 30;

      // Figure in near-white.
      const lx = (px - ox) / scale;
      const ly = (py - oy) / scale;
      let dFig = dist(lx, ly, HEAD.x, HEAD.y) - HEAD.r;
      for (const [ax, ay, bx, by] of SEGMENTS) {
        dFig = Math.min(dFig, sdSegment(lx, ly, ax, ay, bx, by) - STROKE);
      }
      const figA = cov(dFig * scale); // convert to pixel distance

      r = lerp(r, 0xf8, figA);
      g = lerp(g, 0xfa, figA);
      b = lerp(b, 0xff, figA);

      const i = (y * size + x) * 4;
      const alpha = opaque ? 1 : bgA;
      rgba[i] = Math.round(Math.max(0, Math.min(255, r)));
      rgba[i + 1] = Math.round(Math.max(0, Math.min(255, g)));
      rgba[i + 2] = Math.round(Math.max(0, Math.min(255, b)));
      rgba[i + 3] = Math.round(alpha * 255);
    }
  }

  return encodePng(rgba, size, size);
}

mkdirSync(OUT_DIR, { recursive: true });

const outputs = [
  ["pwa-192.png", renderIcon(192)],
  ["pwa-512.png", renderIcon(512)],
  ["pwa-maskable-512.png", renderIcon(512, { maskable: true })],
  ["apple-touch-icon.png", renderIcon(180, { opaque: true })],
];

for (const [name, buf] of outputs) {
  const path = join(OUT_DIR, name);
  writeFileSync(path, buf);
  console.log(`wrote ${path} (${buf.length} bytes)`);
}
