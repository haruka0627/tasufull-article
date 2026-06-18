/**
 * LEGEND プレート — 白系カード背景 (#f8f6f1) 統合版 PNG/WebP を生成
 * 黒キャンバス・黒グローを除去し、不透明な白系グラデーション上に合成
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const rankDir = path.join(root, "images", "rank");

/** 出品者カード背景に近いオフホワイト */
const CARD_BG = "#f8f6f1";
const CARD_BG_RGB = { r: 248, g: 246, b: 241 };

const TARGET_WIDTH = 1400;
const TARGET_MIN_HEIGHT = 900;

/** 純黒〜暗灰キャンバス除去 */
const BLACK_LUMA_MAX = 42;
/** 黒グロー（低輝度・低彩度）除去 */
const GLOW_LUMA_MAX = 92;
const GLOW_CHROMA_MAX = 48;

const ASSETS_DIR = path.join(
  root,
  "..",
  ".cursor",
  "projects",
  "c-Users-rubih-tasufull-article",
  "assets"
);

function findSourcePng() {
  const explicit = process.argv[2];
  if (explicit && fs.existsSync(explicit)) return explicit;

  const candidates = [];

  if (fs.existsSync(ASSETS_DIR)) {
    const preferLarge = fs
      .readdirSync(ASSETS_DIR)
      .filter((name) => /LEGEND/i.test(name) && name.endsWith(".png"))
      .map((name) => path.join(ASSETS_DIR, name))
      .sort((a, b) => fs.statSync(b).size - fs.statSync(a).size);

    candidates.push(...preferLarge);
  }

  const localMaster = path.join(rankDir, "legend-source-master.png");
  if (fs.existsSync(localMaster)) candidates.push(localMaster);

  const canvas = path.join(rankDir, "source-master", "legend-canvas.png");
  if (fs.existsSync(canvas)) candidates.push(canvas);

  if (!candidates.length) {
    throw new Error("LEGEND source PNG not found");
  }

  return candidates[0];
}

function luma(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function chroma(r, g, b) {
  return Math.max(r, g, b) - Math.min(r, g, b);
}

function isBackgroundPixel(r, g, b) {
  const y = luma(r, g, b);
  const c = chroma(r, g, b);

  if (y <= BLACK_LUMA_MAX) return true;
  if (y <= GLOW_LUMA_MAX && c <= GLOW_CHROMA_MAX) return true;

  return false;
}

function alphaForPixel(r, g, b) {
  if (isBackgroundPixel(r, g, b)) return 0;

  const y = luma(r, g, b);
  if (y <= GLOW_LUMA_MAX + 24) {
    const t = (y - BLACK_LUMA_MAX) / (GLOW_LUMA_MAX + 24 - BLACK_LUMA_MAX);
    return Math.round(Math.min(255, Math.max(0, t * 255)));
  }

  return 255;
}

/** 暗い縁取りを白背景向けに軽く持ち上げ */
function liftDarkFringe(r, g, b, a) {
  if (a === 0) return { r, g, b, a };

  const y = luma(r, g, b);
  if (y >= 110) return { r, g, b, a };

  const lift = (110 - y) * 0.55;
  return {
    r: Math.round(Math.min(255, r + lift)),
    g: Math.round(Math.min(255, g + lift)),
    b: Math.round(Math.min(255, b + lift)),
    a,
  };
}

async function createLightBackground(width, height) {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="base" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="42%" stop-color="${CARD_BG}"/>
      <stop offset="100%" stop-color="#f3efe6"/>
    </linearGradient>
    <radialGradient id="auroraL" cx="20%" cy="44%" r="58%">
      <stop offset="0%" stop-color="#ead4ff" stop-opacity="0.22"/>
      <stop offset="60%" stop-color="#e8dcf8" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="${CARD_BG}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="auroraR" cx="80%" cy="56%" r="54%">
      <stop offset="0%" stop-color="#c8eaff" stop-opacity="0.2"/>
      <stop offset="60%" stop-color="#d8efff" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="${CARD_BG}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="softCenter" cx="50%" cy="50%" r="68%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${CARD_BG}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#base)"/>
  <rect width="100%" height="100%" fill="url(#auroraL)"/>
  <rect width="100%" height="100%" fill="url(#auroraR)"/>
  <rect width="100%" height="100%" fill="url(#softCenter)"/>
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function plateWithAlphaFromBlack(inputBuffer) {
  const { data, info } = await sharp(inputBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const out = Buffer.from(data);

  for (let i = 0; i < width * height; i += 1) {
    const o = i * channels;
    let r = out[o];
    let g = out[o + 1];
    let b = out[o + 2];
    let a = alphaForPixel(r, g, b);

    if (a > 0) {
      const lifted = liftDarkFringe(r, g, b, a);
      r = lifted.r;
      g = lifted.g;
      b = lifted.b;
      a = lifted.a;
    }

    out[o] = r;
    out[o + 1] = g;
    out[o + 2] = b;
    out[o + 3] = a;
  }

  return sharp(out, { raw: { width, height, channels } })
    .png()
    .blur(0.35)
    .toBuffer();
}

/** 四隅がカード背景と一致するよう不透明化 */
async function flattenToCardBackground(compositedBuffer, width, height) {
  const { data, info } = await sharp(compositedBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { channels } = info;
  const out = Buffer.from(data);

  for (let i = 0; i < width * height; i += 1) {
    const o = i * channels;
    const a = out[o + 3] / 255;
    const inv = 1 - a;

    out[o] = Math.round(out[o] * a + CARD_BG_RGB.r * inv);
    out[o + 1] = Math.round(out[o + 1] * a + CARD_BG_RGB.g * inv);
    out[o + 2] = Math.round(out[o + 2] * a + CARD_BG_RGB.b * inv);
    out[o + 3] = 255;
  }

  return sharp(out, { raw: { width, height, channels } }).png().toBuffer();
}

async function main() {
  const src = findSourcePng();
  const plateSized = await sharp(src)
    .resize(TARGET_WIDTH, null, { fit: "inside", withoutEnlargement: false })
    .toBuffer();

  const plateMeta = await sharp(plateSized).metadata();
  const plateW = plateMeta.width;
  const plateH = plateMeta.height;
  const canvasW = TARGET_WIDTH;
  const canvasH = Math.max(TARGET_MIN_HEIGHT, plateH + 80);
  const offsetY = Math.round((canvasH - plateH) / 2);
  const offsetX = Math.round((canvasW - plateW) / 2);

  const plateAlpha = await plateWithAlphaFromBlack(plateSized);
  const background = await createLightBackground(canvasW, canvasH);

  const composited = await sharp(background)
    .composite([
      {
        input: plateAlpha,
        top: offsetY,
        left: offsetX,
        blend: "over",
      },
    ])
    .png()
    .toBuffer();

  const flattened = await flattenToCardBackground(composited, canvasW, canvasH);

  const outPng = path.join(rankDir, "legend.png");
  const outWebp = path.join(rankDir, "legend.webp");

  await sharp(flattened)
    .png({ compressionLevel: 9 })
    .toFile(outPng);

  await sharp(outPng)
    .webp({ quality: 92, effort: 6 })
    .toFile(outWebp);

  const final = await sharp(outPng).metadata();
  console.log(`Built ${outPng} (${final.width}x${final.height}) from ${path.basename(src)}`);
  console.log(`Built ${outWebp}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});