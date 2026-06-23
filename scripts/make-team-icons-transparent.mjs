/**
 * Remove white square + pale blue circle from team initiative icons.
 * Keeps dark navy artwork only for CSS circle backgrounds.
 */
import sharp from "sharp";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "iwasho", "images", "team");
const distDir = join(root, "deploy", "cloudflare", "dist", "iwasho", "images", "team");

const pairs = [
  ["handshake.png", "handshake-transparent.png"],
  ["payment.png", "payment-transparent.png"],
  ["growth.png", "growth-transparent.png"],
  ["partnership.png", "partnership-transparent.png"],
];

function idx(x, y, w) {
  return y * w + x;
}

function sampleBgColor(data, w, h, ch) {
  const pts = [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
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

function isEdgeBg(r, g, b, ref, tol) {
  const dist = Math.hypot(r - ref[0], g - ref[1], b - ref[2]);
  if (dist <= tol) return true;
  return r > 232 && g > 232 && b > 232;
}

function isPaleBlue(r, g, b) {
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  if (lum < 150) return false;
  if (b >= r - 8 && g >= r - 10 && lum > 165) return true;
  return r > 210 && g > 225 && b > 235;
}

function isIconPixel(r, g, b) {
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  if (lum > 130) return false;
  if (b >= r - 20 && lum < 120) return true;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max - min < 55 && lum < 110;
}

async function removeBackground(inputPath, outputPath) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: w, height: h, channels: ch } = info;
  const ref = sampleBgColor(data, w, h, ch);
  const tol = 36;
  const edgeBg = new Uint8Array(w * h);
  const q = [];

  function tryPush(x, y) {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = idx(x, y, w);
    if (edgeBg[i]) return;
    const o = i * ch;
    if (!isEdgeBg(data[o], data[o + 1], data[o + 2], ref, tol)) return;
    edgeBg[i] = 1;
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
    const o = i * ch;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];

    if (edgeBg[i] || isPaleBlue(r, g, b)) {
      data[o + 3] = 0;
      continue;
    }

    if (!isIconPixel(r, g, b)) {
      data[o + 3] = 0;
    }
  }

  await sharp(data, { raw: { width: w, height: h, channels: ch } })
    .png()
    .toFile(outputPath);
}

for (const [src, dest] of pairs) {
  const inFile = join(dir, src);
  const outFile = join(dir, dest);
  const distFile = join(distDir, dest);
  await removeBackground(inFile, outFile);
  await removeBackground(inFile, distFile);
  console.log("wrote", dest);
}
