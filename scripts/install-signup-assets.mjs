/**
 * 会員登録ページ用アセットを images/ に配置
 *
 * signup-visual-bg.png  … 波形＋ドットのみ（08_24 背景）
 * signup-ai-character.png … 銀髪AIキャラのみ（08_23 キャラ、透過処理）
 *
 * ※ 08_13 のページ全体モック（スクリーンショット）は使用しない
 */
import sharp from "sharp";
import { copyFileSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const assetsDir =
  process.env.SIGNUP_ASSETS_DIR ||
  "C:/Users/rubih/.cursor/projects/c-Users-rubih-tasufull-article/assets";

if (!existsSync(assetsDir)) {
  console.error(`Assets dir not found: ${assetsDir}`);
  console.error("Set SIGNUP_ASSETS_DIR or place source PNGs in images/ manually.");
  process.exit(1);
}

const files = readdirSync(assetsDir);
const bgName = files.find((n) => n.includes("08_24") && n.includes("c938fd01"));
const charName =
  files.find((n) => n.includes("08_23") && n.includes("d98adf78")) ||
  files.find((n) => n.includes("08_23") && n.includes("95064a40"));

if (!bgName || !charName) {
  console.error("Required source files not found in assets dir.");
  process.exit(1);
}

const bgSrc = join(assetsDir, bgName);
const charSrc = join(assetsDir, charName);
const bgOut = join(root, "images", "signup-visual-bg.png");
const charSourceOut = join(root, "images", "signup-ai-character-source.png");
const charOut = join(root, "images", "signup-ai-character.png");

copyFileSync(bgSrc, bgOut);
copyFileSync(charSrc, charSourceOut);

const input = readFileSync(charSrc);
const { data, info } = await sharp(input)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

for (let i = 0; i < data.length; i += 4) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lum = (r + g + b) / 3;
  if (lum >= 252 && max - min < 12) {
    data[i + 3] = 0;
    continue;
  }
  if (lum >= 238 && max - min < 18) {
    const t = (252 - lum) / 14;
    data[i + 3] = Math.min(data[i + 3], Math.round(Math.max(0, Math.min(1, t)) * 255));
  }
}

await sharp(data, {
  raw: { width: info.width, height: info.height, channels: 4 },
})
  .png({ compressionLevel: 9 })
  .toFile(charOut);

const bgMeta = await sharp(bgOut).metadata();
const charMeta = await sharp(charOut).metadata();
console.log(`Wrote ${bgOut} (${bgMeta.width}x${bgMeta.height})`);
console.log(`Wrote ${charOut} (${charMeta.width}x${charMeta.height}, alpha=${charMeta.hasAlpha})`);
