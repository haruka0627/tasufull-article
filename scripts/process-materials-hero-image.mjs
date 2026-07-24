#!/usr/bin/env node
/**
 * Materials ヒーロー — 参考イラストから背景除去 → Object 透過PNG/WebP 化
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "materials", "images");
const SRC = path.join(OUT_DIR, "hero-illustration-reference.png");
const OUT_BASE = path.join(OUT_DIR, "hero-illustration");

function colorDist(r1, g1, b1, r2, g2, b2) {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function sampleEdgeBackground(data, width, height) {
  const coords = [];
  for (let x = 0; x < width; x += Math.max(1, Math.floor(width / 24))) {
    coords.push([x, 0], [x, height - 1]);
  }
  for (let y = 0; y < height; y += Math.max(1, Math.floor(height / 24))) {
    coords.push([0, y], [width - 1, y]);
  }
  const samples = coords.map(([x, y]) => {
    const i = (y * width + x) * 4;
    return { r: data[i], g: data[i + 1], b: data[i + 2] };
  });
  return {
    r: Math.round(samples.reduce((s, c) => s + c.r, 0) / samples.length),
    g: Math.round(samples.reduce((s, c) => s + c.g, 0) / samples.length),
    b: Math.round(samples.reduce((s, c) => s + c.b, 0) / samples.length),
  };
}

function isHeroBgPixel(r, g, b, bg) {
  const dist = colorDist(r, g, b, bg.r, bg.g, bg.b);
  if (dist <= 36) return true;
  if (r >= 215 && g >= 225 && b >= 240 && b >= g - 6 && g >= r - 16) {
    return dist <= 58;
  }
  return false;
}

async function keyOutAndTrim(inputPath, outputBase, opts = {}) {
  const threshold = opts.threshold ?? 36;
  const feather = opts.feather ?? 32;
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const bg = sampleEdgeBackground(data, info.width, info.height);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const dist = colorDist(r, g, b, bg.r, bg.g, bg.b);
    const bgLike = isHeroBgPixel(r, g, b, bg);

    if (bgLike) {
      let alpha = 255;
      if (dist <= threshold) {
        alpha = 0;
      } else if (dist <= threshold + feather) {
        alpha = Math.round(((dist - threshold) / feather) * 255);
      } else if (dist <= 58) {
        alpha = Math.round(((dist - (threshold + feather)) / (58 - threshold - feather)) * 255);
        alpha = Math.max(0, Math.min(255, alpha));
      }
      data[i + 3] = Math.min(data[i + 3], alpha);
    }
  }

  const keyed = sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  });

  const pngPath = `${outputBase}-transparent.png`;
  const webpPath = `${outputBase}-transparent.webp`;

  const trimmedBuf = await keyed.clone().trim({ threshold: 10 }).png().toBuffer();
  const trimmedMeta = await sharp(trimmedBuf).metadata();

  const pad = opts.pad ?? { top: 12, bottom: 12, left: 12, right: 20 };
  const paddedBuf = await sharp(trimmedBuf)
    .extend({ ...pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const paddedMeta = await sharp(paddedBuf).metadata();

  await sharp(paddedBuf).png().toFile(pngPath);
  await sharp(paddedBuf).webp({ lossless: true }).toFile(webpPath);

  return {
    pngPath,
    webpPath,
    bg,
    width: paddedMeta.width,
    height: paddedMeta.height,
  };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  if (!fs.existsSync(SRC)) {
    console.error("Missing:", SRC);
    process.exit(1);
  }

  const result = await keyOutAndTrim(SRC, OUT_BASE, {
    threshold: 34,
    feather: 34,
  });

  console.log("bg sample:", result.bg);
  console.log("output:", result.width, "x", result.height);
  console.log("files:", result.pngPath, result.webpPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
