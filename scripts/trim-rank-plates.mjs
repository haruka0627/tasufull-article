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
const RANKS = ["new", "bronze", "silver", "gold", "platinum", "legend"];

/** 黒に近いピクセルを透過（トリム前の均一な余白除去） */
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
  const transparent = await flattenBlackToAlpha(raw);

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
