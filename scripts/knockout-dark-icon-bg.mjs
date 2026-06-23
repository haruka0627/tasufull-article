#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIRS = [
  "images/tasful/icons",
  "images/tasful/reasons",
  "images/tasful/can-do",
];

async function knockoutDarkBg(filePath) {
  const img = sharp(filePath).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);

    if (max < 48) {
      data[i + 3] = 0;
      continue;
    }

    if (max < 72 && max - min < 18) {
      data[i + 3] = Math.min(data[i + 3], Math.round((max - 48) * 6));
    }
  }

  const out = `${filePath}.tmp.png`;
  await sharp(data, { raw: { width, height, channels } }).png().toFile(out);
  fs.renameSync(out, filePath);
}

function knockoutWhiteMatteFromEdges(data, width, height, channels) {
  const isMatteWhite = (i) => {
    const a = data[i + 3];
    if (a < 200) return false;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    return r > 245 && g > 245 && b > 245;
  };

  const seen = new Uint8Array(width * height);
  const queue = [];

  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (seen[idx]) return;
    const i = idx * channels;
    if (!isMatteWhite(i)) return;
    seen[idx] = 1;
    queue.push(idx);
  };

  for (let x = 0; x < width; x += 1) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    push(0, y);
    push(width - 1, y);
  }

  while (queue.length) {
    const idx = queue.pop();
    const x = idx % width;
    const y = (idx - x) / width;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  for (let idx = 0; idx < seen.length; idx += 1) {
    if (!seen[idx]) continue;
    data[idx * channels + 3] = 0;
  }
}

async function knockoutWhiteMatteBg(filePath) {
  const img = sharp(filePath).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  knockoutWhiteMatteFromEdges(data, width, height, channels);

  const out = `${filePath}.tmp.png`;
  await sharp(data, { raw: { width, height, channels } }).png().toFile(out);
  fs.renameSync(out, filePath);
}

for (const dir of DIRS) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) continue;
  for (const name of fs.readdirSync(abs)) {
    if (!/\.png$/i.test(name)) continue;
    const filePath = path.join(abs, name);
    await knockoutDarkBg(filePath);
    await knockoutWhiteMatteBg(filePath);
    console.log("processed:", filePath);
  }
}

const distDirs = DIRS.map((d) => path.join(ROOT, "deploy/cloudflare/dist", d));
for (const dir of DIRS) {
  const src = path.join(ROOT, dir);
  const dist = path.join(ROOT, "deploy/cloudflare/dist", dir);
  if (!fs.existsSync(src)) continue;
  fs.mkdirSync(dist, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    if (!/\.png$/i.test(name)) continue;
    fs.copyFileSync(path.join(src, name), path.join(dist, name));
  }
}
