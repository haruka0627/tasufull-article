#!/usr/bin/env node
/**
 * Remove outer light background from phone mockup PNGs (transparent PNG output).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILES = [
  "iwasho/images/about/cta-builder-phone.png",
  "iwasho/images/about/cta-tasful-ai-phone.png",
];

const SECTION_BG = { r: 243, g: 247, b: 255 };
const COLOR_DIST = 24;
const ERODE_PASSES = 16;

function colorDist(r, g, b) {
  const dr = r - SECTION_BG.r;
  const dg = g - SECTION_BG.g;
  const db = b - SECTION_BG.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function isBackgroundLike(data, i) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  if (colorDist(r, g, b) <= COLOR_DIST) return true;
  if (r >= 246 && g >= 246 && b >= 246) return true;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max - min < 16 && min >= 215;
}

function isErodableLight(data, i) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  if (r < 70 && g < 70 && b < 70) return false;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 24 && min >= 175) return true;
  return isBackgroundLike(data, i);
}

function floodClearBackground(mask, data, width, height, channels) {
  const queue = [];
  for (let x = 0; x < width; x++) {
    queue.push([x, 0], [x, height - 1]);
  }
  for (let y = 0; y < height; y++) {
    queue.push([0, y], [width - 1, y]);
  }

  while (queue.length) {
    const [x, y] = queue.pop();
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    const pi = y * width + x;
    if (mask[pi]) continue;
    const i = pi * channels;
    if (!isBackgroundLike(data, i)) continue;
    mask[pi] = 1;
    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
}

function erodeLightHalo(mask, data, width, height, channels) {
  for (let pass = 0; pass < ERODE_PASSES; pass++) {
    const add = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pi = y * width + x;
        if (mask[pi]) continue;
        const i = pi * channels;
        if (!isErodableLight(data, i)) continue;
        const neighbors = [
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1],
        ];
        if (neighbors.some(([nx, ny]) => {
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) return true;
          return mask[ny * width + nx] === 1;
        })) {
          add.push(pi);
        }
      }
    }
    for (const pi of add) mask[pi] = 1;
  }
}

function applyMaskTransparent(data, mask) {
  for (let pi = 0; pi < mask.length; pi++) {
    if (!mask[pi]) continue;
    data[pi * 4 + 3] = 0;
  }
}

async function processImage(relPath) {
  const input = path.join(ROOT, relPath);
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = Buffer.from(data);
  const mask = new Uint8Array(info.width * info.height);
  floodClearBackground(mask, pixels, info.width, info.height, info.channels);
  erodeLightHalo(mask, pixels, info.width, info.height, info.channels);
  applyMaskTransparent(pixels, mask);

  const outBuf = await sharp(pixels, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  })
    .png({ compressionLevel: 9 })
    .toBuffer();

  const tmp = `${input}.tmp.png`;
  fs.writeFileSync(tmp, outBuf);
  fs.renameSync(tmp, input);

  const dist = path.join(ROOT, "deploy/cloudflare/dist", relPath);
  fs.mkdirSync(path.dirname(dist), { recursive: true });
  fs.writeFileSync(dist, outBuf);

  let transparent = 0;
  const total = info.width * info.height;
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] === 0) transparent++;
  }
  console.log(
    `processed ${relPath} (${info.width}x${info.height}) transparent=${Math.round((100 * transparent) / total)}%`,
  );
}

for (const file of FILES) {
  await processImage(file);
}
