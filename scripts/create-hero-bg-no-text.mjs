#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "images/tasful/top/hero-main.png");
const OUT = path.join(ROOT, "images/tasful/top/hero-bg-no-text.png");
const OUT_DIST = path.join(ROOT, "deploy/cloudflare/dist/images/tasful/top/hero-bg-no-text.png");

const meta = await sharp(SRC).metadata();
const W = meta.width;
const H = meta.height;

const blurred = await sharp(SRC).blur(8).modulate({ brightness: 0.78, saturation: 1.08 }).toBuffer();

const maskSvg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="g" cx="50%" cy="46%" rx="13%" ry="7%">
      <stop offset="0%" stop-color="white" stop-opacity="0.32"/>
      <stop offset="62%" stop-color="white" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="white" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
</svg>`;

const mask = await sharp(Buffer.from(maskSvg)).png().toBuffer();

const maskedBlur = await sharp(blurred)
  .composite([{ input: mask, blend: "dest-in" }])
  .png()
  .toBuffer();

await sharp(SRC)
  .composite([{ input: maskedBlur, blend: "over" }])
  .png()
  .toFile(OUT);

fs.mkdirSync(path.dirname(OUT_DIST), { recursive: true });
fs.copyFileSync(OUT, OUT_DIST);
console.log("created:", OUT);
