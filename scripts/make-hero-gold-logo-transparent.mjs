/**
 * Remove edge-connected white background from hero TASFUL gold logo.
 * Input: images/tasful-gold-logo-hd.png
 * Output: images/tasful-gold-logo-transparent.png
 */
import sharp from "sharp";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const input = join(root, "images", "tasful-gold-logo-hd.png");
const output = join(root, "images", "tasful-gold-logo-transparent.png");

function idx(x, y, w) {
  return y * w + x;
}

function sampleBgColor(data, w, h, ch) {
  const pts = [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
    [Math.floor(w / 2), 0],
    [Math.floor(w / 2), h - 1],
    [0, Math.floor(h / 2)],
    [w - 1, Math.floor(h / 2)],
  ];
  let r = 0;
  let g = 0;
  let b = 0;
  for (const [x, y] of pts) {
    const o = idx(x, y, w) * ch;
    r += data[o];
    g += data[o + 1];
    b += data[o + 2];
  }
  const n = pts.length;
  return [r / n, g / n, b / n];
}

function isBgPixel(r, g, b, ref, tol) {
  const dr = r - ref[0];
  const dg = g - ref[1];
  const db = b - ref[2];
  if (Math.hypot(dr, dg, db) <= tol) return true;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  if (lum >= 248) return true;
  if (lum >= 235 && r > 200 && g > 200 && b > 200) return true;
  return false;
}

const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: w, height: h, channels: ch } = info;
const ref = sampleBgColor(data, w, h, ch);
const tol = 48;
const bg = new Uint8Array(w * h);
const q = [];

function tryPush(x, y) {
  if (x < 0 || y < 0 || x >= w || y >= h) return;
  const i = idx(x, y, w);
  if (bg[i]) return;
  const o = i * ch;
  if (!isBgPixel(data[o], data[o + 1], data[o + 2], ref, tol)) return;
  bg[i] = 1;
  q.push(i);
}

for (let x = 0; x < w; x++) {
  tryPush(x, 0);
  tryPush(x, h - 1);
}
for (let y = 0; y < h; y++) {
  tryPush(0, y);
  tryPush(w - 1, y);
}

while (q.length) {
  const i = q.pop();
  const x = i % w;
  const y = (i - x) / w;
  tryPush(x - 1, y);
  tryPush(x + 1, y);
  tryPush(x, y - 1);
  tryPush(x, y + 1);
}

for (let i = 0; i < w * h; i++) {
  if (!bg[i]) continue;
  data[i * ch + 3] = 0;
}

await sharp(data, { raw: { width: w, height: h, channels: ch } })
  .trim()
  .png()
  .toFile(output);
const meta = await sharp(output).metadata();
console.log("wrote", output, `${meta.width}x${meta.height}`);
