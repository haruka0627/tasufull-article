import sharp from "sharp";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { renameSync } from "node:fs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const input = join(root, "images", "tasful-ai-globe.png");
const output = join(root, "images", "tasful-ai-globe.png");
const tmp = join(root, "images", "tasful-ai-globe.tmp.png");

const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

for (let i = 0; i < data.length; i += 4) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);

  // 黒〜近黒背景を透過（グラデーション線は保持）
  if (max < 42 || (max < 72 && max - min < 18)) {
    data[i + 3] = 0;
  }
}

const trimmed = await sharp(data, {
  raw: { width: info.width, height: info.height, channels: 4 },
})
  .trim({ threshold: 8 })
  .png()
  .toBuffer({ resolveWithObject: true });

await sharp(trimmed.data).png().toFile(tmp);
renameSync(tmp, output);

console.log(
  "Processed",
  output,
  `${info.width}x${info.height} -> ${trimmed.info.width}x${trimmed.info.height}`,
);
