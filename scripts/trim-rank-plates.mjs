/**
 * ランクプレート PNG を透過＋余白トリムして WebP/PNG を再生成
 * 黒背景（キャンバス余白）を除去し、プレート本体のみ残す
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RANK_DIR = path.join(__dirname, "..", "images", "rank");
const RANKS = [
  "new",
  "iron",
  "bronze",
  "silver",
  "gold",
  "platinum",
  "diamond",
  "legend",
];

/** 白〜明灰キャンバスを透過 */
async function flattenWhiteToAlpha(inputBuffer) {
  const { data, info } = await sharp(inputBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const out = Buffer.from(data);
  const hardWhite = 248;
  const softWhite = 232;

  for (let i = 0; i < width * height; i += 1) {
    const o = i * channels;
    const r = out[o];
    const g = out[o + 1];
    const b = out[o + 2];
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const c = Math.max(r, g, b) - Math.min(r, g, b);

    if (r >= hardWhite && g >= hardWhite && b >= hardWhite) {
      out[o + 3] = 0;
      continue;
    }

    if (y >= softWhite && c <= 18) {
      const t = (y - softWhite) / (hardWhite - softWhite);
      out[o + 3] = Math.round(Math.max(0, 255 * (1 - Math.min(1, t))));
      continue;
    }

    out[o + 3] = 255;
  }

  return sharp(out, { raw: { width, height, channels } }).png().toBuffer();
}

/** @deprecated 旧黒背景マスター向け — 互換のため残置 */
async function flattenBlackToAlpha(inputBuffer) {
  const { data, info } = await sharp(inputBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const out = Buffer.from(data);
  const threshold = 28;

  for (let i = 0; i < width * height; i += 1) {
    const o = i * channels;
    const r = out[o];
    const g = out[o + 1];
    const b = out[o + 2];
    if (r <= threshold && g <= threshold && b <= threshold) {
      out[o + 3] = 0;
    }
  }

  return sharp(out, { raw: { width, height, channels } }).png().toBuffer();
}

async function processRank(rank) {
  const srcPng = path.join(RANK_DIR, `${rank}.png`);
  if (!fs.existsSync(srcPng)) {
    console.warn(`skip (no png): ${rank}`);
    return;
  }

  const raw = fs.readFileSync(srcPng);
  const transparent = await flattenWhiteToAlpha(raw);

  const trimmed = await sharp(transparent)
    .trim({ threshold: 12 })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();

  const meta = await sharp(trimmed).metadata();
  const outPng = path.join(RANK_DIR, `${rank}.png`);
  const outWebp = path.join(RANK_DIR, `${rank}.webp`);

  await sharp(trimmed).png().toFile(outPng);
  await sharp(trimmed)
    .webp({ quality: 92, alphaQuality: 100, effort: 6 })
    .toFile(outWebp);

  console.log(
    `${rank}: ${meta.width}x${meta.height} -> ${outPng}, ${outWebp}`
  );
}

async function main() {
  for (const rank of RANKS) {
    await processRank(rank);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
