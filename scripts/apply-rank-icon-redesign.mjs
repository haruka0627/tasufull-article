/**
 * 新ランクアイコン（透過PNG/WebP）を images/rank/ へ適用
 * 白背景除去 · 既存ファイル名維持（new/bronze/silver/gold/platinum/legend + iron/diamond）
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const rankDir = path.join(root, "images", "rank");
const backupDir = path.join(rankDir, "_backup-20260701");
const assetsDir = path.join(
  root,
  "..",
  ".cursor",
  "projects",
  "c-Users-rubih-tasufull-article",
  "assets"
);

/** 添付順: ROOKIE → MASTER */
const SOURCE_SUFFIXES = [
  "14_03_58-72d85d38-d0cd-4314-b039-88b826339bf3.png",
  "13_57_51-c850701d-d1f0-43cb-853a-99ae0e506210.png",
  "13_56_51-e2dc5c8b-574a-4454-863e-dcb5796da2fa.png",
  "13_58_39-3ff175cc-0865-47a3-b381-3a2ddcbed251.png",
  "13_59_30-70f73df5-4cb5-429f-945e-6b6b0df55801.png",
  "14_02_12-9c17cae8-1c9a-41c5-80ff-a09bf2555050.png",
  "14_08_53-23a68880-e529-4abe-927b-7a687af96f3d.png",
  "13_53_47_upscayl_2x_digital-art-4x-c23915b5-e550-422d-b908-9a2eaade041c.png",
];

/** 出力ファイル名（rankPlateImageUrl 互換 + iron/diamond） */
const OUTPUT_NAMES = [
  "new",
  "iron",
  "bronze",
  "silver",
  "gold",
  "platinum",
  "diamond",
  "legend",
];

const CANVAS = {
  standard: { width: 1024, height: 256 },
  legend: { width: 1024, height: 517 },
};

function findSourcePath(suffix) {
  if (!fs.existsSync(assetsDir)) return null;
  const hit = fs
    .readdirSync(assetsDir)
    .find((name) => name.endsWith(suffix) || name.includes(suffix));
  return hit ? path.join(assetsDir, hit) : null;
}

function luma(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** 白〜明灰キャンバスを透過（影・縁取りは維持） */
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
    const y = luma(r, g, b);
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

async function fitOnCanvas(trimmedBuffer, canvas) {
  const meta = await sharp(trimmedBuffer).metadata();
  const scale = Math.min(
    (canvas.width * 0.92) / meta.width,
    (canvas.height * 0.92) / meta.height,
    1
  );
  const w = Math.max(1, Math.round(meta.width * scale));
  const h = Math.max(1, Math.round(meta.height * scale));
  const resized = await sharp(trimmedBuffer)
    .resize(w, h, { fit: "inside" })
    .png()
    .toBuffer();

  const left = Math.round((canvas.width - w) / 2);
  const top = Math.round((canvas.height - h) / 2);

  return sharp({
    create: {
      width: canvas.width,
      height: canvas.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, top, left }])
    .png()
    .toBuffer();
}

async function processOne(sourcePath, outputName) {
  const raw = fs.readFileSync(sourcePath);
  const transparent = await flattenWhiteToAlpha(raw);
  const trimmed = await sharp(transparent)
    .trim({ threshold: 8 })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();

  const canvas =
    outputName === "legend" ? CANVAS.legend : CANVAS.standard;
  const finalPng = await fitOnCanvas(trimmed, canvas);

  const outPng = path.join(rankDir, `${outputName}.png`);
  const outWebp = path.join(rankDir, `${outputName}.webp`);

  await sharp(finalPng).png().toFile(outPng);
  await sharp(finalPng)
    .webp({ quality: 92, alphaQuality: 100, effort: 6 })
    .toFile(outWebp);

  const meta = await sharp(outPng).metadata();
  const corners = await sampleCornerAlpha(outPng);
  return { outputName, width: meta.width, height: meta.height, corners };
}

async function sampleCornerAlpha(pngPath) {
  const { data, info } = await sharp(pngPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const pts = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];
  return pts.map(([x, y]) => {
    const o = (y * width + x) * channels;
    return data[o + 3];
  });
}

function backupExisting() {
  fs.mkdirSync(backupDir, { recursive: true });
  for (const name of fs.readdirSync(rankDir)) {
    if (name === "_backup-20260701" || name === "source-master" || name === "README.md") {
      continue;
    }
    const src = path.join(rankDir, name);
    if (!fs.statSync(src).isFile()) continue;
    const dest = path.join(backupDir, name);
    if (!fs.existsSync(dest)) fs.copyFileSync(src, dest);
  }
}

async function main() {
  backupExisting();

  const results = [];
  for (let i = 0; i < OUTPUT_NAMES.length; i += 1) {
    const outputName = OUTPUT_NAMES[i];
    const suffix = SOURCE_SUFFIXES[i];
    const sourcePath = findSourcePath(suffix);
    if (!sourcePath) {
      throw new Error(`Source not found for ${outputName}: ${suffix}`);
    }
    const result = await processOne(sourcePath, outputName);
    results.push(result);
    console.log(
      `${outputName}: ${path.basename(sourcePath)} -> ${result.width}x${result.height} cornersAlpha=${result.corners.join(",")}`
    );
  }

  console.log(`\nBackup: ${backupDir}`);
  console.log(`Processed ${results.length} rank icons`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
