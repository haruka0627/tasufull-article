#!/usr/bin/env node
/**
 * TASFUL AI 公式アイコン — 白背景除去 → 透過 PNG
 * Source: images/help/tasful-ai-icon-source.png（または .jpg）
 * Output: images/help/tasful-ai-icon.png
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CANDIDATES = [
  path.join(ROOT, "images", "help", "tasful-ai-icon-source.png"),
  path.join(ROOT, "images", "help", "tasful-ai-icon-source.jpg"),
  path.join(ROOT, "images", "help", "tasful-ai-icon.png"),
];
const OUT = path.join(ROOT, "images", "help", "tasful-ai-icon.png");
const OUT_TMP = path.join(ROOT, "images", "help", "tasful-ai-icon.transparent.tmp.png");

const WHITE_MIN = 232;
const WHITE_CHROMA_MAX = 18;
const EDGE_SOFTEN = 24;

function isWhiteBackground(r, g, b) {
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);
  return min >= WHITE_MIN && max - min <= WHITE_CHROMA_MAX;
}

function floodFillWhiteBackground(data, width, height, channels) {
  const total = width * height;
  const visited = new Uint8Array(total);
  const queue = [];

  function pushIfBg(x, y) {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (visited[idx]) return;
    const i = idx * channels;
    if (!isWhiteBackground(data[i], data[i + 1], data[i + 2])) return;
    visited[idx] = 1;
    queue.push(idx);
  }

  for (let x = 0; x < width; x++) {
    pushIfBg(x, 0);
    pushIfBg(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    pushIfBg(0, y);
    pushIfBg(width - 1, y);
  }

  while (queue.length) {
    const idx = queue.pop();
    const x = idx % width;
    const y = (idx - x) / width;
    pushIfBg(x - 1, y);
    pushIfBg(x + 1, y);
    pushIfBg(x, y - 1);
    pushIfBg(x, y + 1);
  }

  let removed = 0;
  for (let idx = 0; idx < total; idx++) {
    if (!visited[idx]) continue;
    const i = idx * channels;
    data[i + 3] = 0;
    removed += 1;
  }
  return removed;
}

function softenEdges(data, width, height, channels) {
  const total = width * height;
  for (let idx = 0; idx < total; idx++) {
    const i = idx * channels;
    if (data[i + 3] === 0) continue;
    const x = idx % width;
    const y = (idx - x) / width;
    let touchesTransparent = false;
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
        touchesTransparent = true;
        break;
      }
      const ni = (ny * width + nx) * channels;
      if (data[ni + 3] === 0) {
        touchesTransparent = true;
        break;
      }
    }
    if (!touchesTransparent) continue;
    const min = Math.min(data[i], data[i + 1], data[i + 2]);
    if (min >= WHITE_MIN - EDGE_SOFTEN) {
      const t = Math.max(0, Math.min(1, (WHITE_MIN - min) / EDGE_SOFTEN));
      data[i + 3] = Math.round(data[i + 3] * (1 - t * 0.9));
    }
  }
}

async function main() {
  const CANDIDATES_NO_OUT = CANDIDATES.filter((p) => path.resolve(p) !== path.resolve(OUT));
  const SRC = CANDIDATES_NO_OUT.find((p) => fs.existsSync(p)) || CANDIDATES.find((p) => fs.existsSync(p));
  if (!SRC) {
    console.error("[make-tasful-ai-icon-transparent] missing source under images/help/");
    process.exit(1);
  }

  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const removed = floodFillWhiteBackground(data, width, height, channels);
  softenEdges(data, width, height, channels);

  const meta = await sharp(data, { raw: { width, height, channels } })
    .png({ compressionLevel: 9 })
    .trim({ threshold: 12 })
    .toFile(OUT_TMP);

  fs.renameSync(OUT_TMP, OUT);

  console.log(
    `[make-tasful-ai-icon-transparent] ${SRC} → ${OUT} (${meta.width}x${meta.height}, removed=${removed})`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
