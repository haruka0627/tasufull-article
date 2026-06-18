/**
 * 透過PNG化 → images/signup-character.png（ページ表示用）
 * 元画像差し替え時: node scripts/process-signup-character.mjs [input.png]
 */
import sharp from "sharp";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const input =
  process.argv[2] ||
  join(root, "images", "signup-ai-character-source.png");
const output = join(root, "images", "signup-character.png");

if (!existsSync(input)) {
  console.error(`Input not found: ${input}`);
  process.exit(1);
}

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
  .toFile(output);

const meta = await sharp(output).metadata();
console.log(`Wrote ${output} (${meta.width}x${meta.height}, alpha=${meta.hasAlpha})`);
