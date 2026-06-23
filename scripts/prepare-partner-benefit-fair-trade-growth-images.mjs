#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS_DIR =
  "C:/Users/rubih/.cursor/projects/c-Users-rubih-tasufull-article/assets";
const TARGET_W = 960;
const TARGET_H = 680;

const jobs = [
  { assetKey: "04_56_24_upscayl", out: "benefit-fair-trade.jpg" },
  { assetKey: "04_57_23_upscayl", out: "benefit-growth.jpg" },
];

for (const job of jobs) {
  const assetName = fs.readdirSync(ASSETS_DIR).find((name) => name.includes(job.assetKey));
  if (!assetName) throw new Error(`asset not found: ${job.assetKey}`);
  const srcBuf = fs.readFileSync(path.join(ASSETS_DIR, assetName));
  const out = path.join(ROOT, "iwasho/images/partner", job.out);
  const meta = await sharp(srcBuf)
    .resize(TARGET_W, TARGET_H, { fit: "cover", position: "centre" })
    .jpeg({ quality: 95, mozjpeg: true, chromaSubsampling: "4:4:4" })
    .toFile(out);
  console.log(JSON.stringify({ out, assetName, ...meta }));
}
