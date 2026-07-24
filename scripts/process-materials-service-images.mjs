#!/usr/bin/env node
/**
 * Materials おすすめサービス画像 — 背景色を透過（角サンプル + 距離フェザー）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "materials", "images");

function colorDist(r1, g1, b1, r2, g2, b2) {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function sampleCornerRgb(data, width, height) {
  const i = 0;
  return { r: data[i], g: data[i + 1], b: data[i + 2] };
}

async function keyOutBackground(inputPath, outputBase, opts = {}) {
  const threshold = opts.threshold ?? 48;
  const feather = opts.feather ?? 36;
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const bg = sampleCornerRgb(data, info.width, info.height);
  for (let i = 0; i < data.length; i += 4) {
    const dist = colorDist(data[i], data[i + 1], data[i + 2], bg.r, bg.g, bg.b);
    if (dist <= threshold) {
      data[i + 3] = 0;
    } else if (dist <= threshold + feather) {
      const t = (dist - threshold) / feather;
      data[i + 3] = Math.min(255, Math.round(t * 255));
    }
  }

  const pngPath = `${outputBase}-processed.png`;
  const webpPath = `${outputBase}-processed.webp`;
  const base = sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  });

  await base.clone().png().toFile(pngPath);
  await base.clone().webp({ lossless: true }).toFile(webpPath);
  return { pngPath, webpPath, bg };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const aiSrc = path.join(OUT_DIR, "service-tasful-ai.png");
  const platSrc = path.join(OUT_DIR, "service-tasful-platform.png");
  if (!fs.existsSync(aiSrc) || !fs.existsSync(platSrc)) {
    console.error("Source images missing in materials/images/");
    process.exit(1);
  }

  const ai = await keyOutBackground(aiSrc, path.join(OUT_DIR, "service-tasful-ai"), {
    threshold: 42,
    feather: 40,
  });
  const plat = await keyOutBackground(platSrc, path.join(OUT_DIR, "service-tasful-platform"), {
    threshold: 38,
    feather: 44,
  });

  // 透過版を別名で保存（Windows 上書きロック回避）
  fs.copyFileSync(ai.pngPath, path.join(OUT_DIR, "service-tasful-ai-transparent.png"));
  fs.copyFileSync(ai.webpPath, path.join(OUT_DIR, "service-tasful-ai-transparent.webp"));
  fs.copyFileSync(plat.pngPath, path.join(OUT_DIR, "service-tasful-platform-transparent.png"));
  fs.copyFileSync(plat.webpPath, path.join(OUT_DIR, "service-tasful-platform-transparent.webp"));

  console.log("AI bg sample:", ai.bg);
  console.log("Platform bg sample:", plat.bg);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
