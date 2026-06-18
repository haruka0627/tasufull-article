import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { removeBackground } from "@imgly/background-removal-node";
import { Jimp, ResizeStrategy } from "jimp";

const require = createRequire(import.meta.url);
const webp = require("webp-wasm");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const ASSET_NAME =
  "c__Users_rubih_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_ChatGPT_Image_2026_5_22__04_19_05_upscayl_2x_digital-art-4x-bb7100d9-a93e-4cc3-9e07-7c1189678b6b.png";

const SOURCE = path.join(
  process.env.USERPROFILE || "C:\\Users\\rubih",
  ".cursor",
  "projects",
  "c-Users-rubih-tasufull-article",
  "assets",
  ASSET_NAME
);

const OUT = path.join(root, "images", "ai-character.webp");
const TARGET_WIDTH = 900;
const CROP_LEFT_RATIO = 0.36;
const CROP_TOP_RATIO = 0.06;
const ALPHA_CUTOFF = 10;
const PADDING_PX = 6;
const WEBP_QUALITY = 98;

function getAlphaBounds(image) {
  const { width, height, data } = image.bitmap;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > ALPHA_CUTOFF) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    throw new Error("No opaque pixels found after background removal.");
  }

  return { minX, minY, maxX, maxY };
}

function dilateAlpha(alpha, width, height, radius) {
  const out = new Uint8Array(alpha);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      if (alpha[i] > 220) continue;
      let peak = alpha[i];
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          peak = Math.max(peak, alpha[ny * width + nx]);
        }
      }
      if (peak > 160) {
        out[i] = Math.max(out[i], Math.min(255, Math.round(peak * 0.96)));
      }
    }
  }
  return out;
}

function boxBlurAlpha(alpha, width, height, radius) {
  const out = new Uint8Array(alpha.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          sum += alpha[ny * width + nx];
          count += 1;
        }
      }
      out[y * width + x] = Math.round(sum / count);
    }
  }
  return out;
}

function refineAlpha(image) {
  const { width, height, data } = image.bitmap;
  let alpha = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    alpha[i] = data[i * 4 + 3];
  }

  alpha = dilateAlpha(alpha, width, height, 2);
  alpha = boxBlurAlpha(alpha, width, height, 2);
  alpha = boxBlurAlpha(alpha, width, height, 1);

  for (let i = 0; i < width * height; i += 1) {
    const a = alpha[i];
    const idx = i * 4;
    if (a < 6) {
      data[idx] = 0;
      data[idx + 1] = 0;
      data[idx + 2] = 0;
      data[idx + 3] = 0;
      continue;
    }
    data[idx + 3] = a;
    if (a < 255) {
      const bleed = (255 - a) / 255;
      data[idx] = Math.round(data[idx] * (1 - bleed * 0.35));
      data[idx + 1] = Math.round(data[idx + 1] * (1 - bleed * 0.35));
      data[idx + 2] = Math.round(data[idx + 2] * (1 - bleed * 0.35));
    }
  }
}

async function main() {
  const sourcePath = (await fs.stat(SOURCE).catch(() => null))
    ? SOURCE
    : process.argv[2];

  if (!sourcePath || !(await fs.stat(sourcePath).catch(() => null))) {
    throw new Error(`Source image not found: ${sourcePath || SOURCE}`);
  }

  const source = await Jimp.read(sourcePath);
  const cropLeft = Math.floor(source.bitmap.width * CROP_LEFT_RATIO);
  const cropTop = Math.floor(source.bitmap.height * CROP_TOP_RATIO);
  source.crop({
    x: cropLeft,
    y: cropTop,
    w: source.bitmap.width - cropLeft,
    h: source.bitmap.height - cropTop,
  });

  const croppedPng = await source.getBuffer("image/png");
  const cutoutBlob = await removeBackground(
    new Blob([croppedPng], { type: "image/png" }),
    {
      model: "medium",
      output: { format: "image/png", quality: 1 },
    }
  );

  let cutout = await Jimp.read(Buffer.from(await cutoutBlob.arrayBuffer()));
  refineAlpha(cutout);

  const bounds = getAlphaBounds(cutout);
  const x0 = Math.max(0, bounds.minX - PADDING_PX);
  const y0 = Math.max(0, bounds.minY - PADDING_PX);
  const x1 = Math.min(cutout.bitmap.width - 1, bounds.maxX + PADDING_PX);
  const y1 = Math.min(cutout.bitmap.height - 1, bounds.maxY + PADDING_PX);
  cutout.crop({
    x: x0,
    y: y0,
    w: x1 - x0 + 1,
    h: y1 - y0 + 1,
  });

  const targetH = Math.max(
    1,
    Math.round((cutout.bitmap.height / cutout.bitmap.width) * TARGET_WIDTH)
  );
  cutout.resize({
    w: TARGET_WIDTH,
    h: targetH,
    mode: ResizeStrategy.HERMITE,
  });

  await webp.load();

  const { width, height, data } = cutout.bitmap;
  const imageData = new globalThis.ImageData(
    new Uint8ClampedArray(data),
    width,
    height
  );
  const webpBuffer = await webp.encode(imageData, {
    quality: WEBP_QUALITY,
    alpha_quality: 100,
    method: 6,
    exact: 1,
    filter_strength: 0,
    autofilter: 0,
  });

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, webpBuffer);

  console.log(
    JSON.stringify({
      source: sourcePath,
      output: OUT,
      width,
      height,
      quality: WEBP_QUALITY,
      format: "webp",
      bytes: webpBuffer.length,
    })
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
