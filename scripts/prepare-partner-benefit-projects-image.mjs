#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS_DIR =
  "C:/Users/rubih/.cursor/projects/c-Users-rubih-tasufull-article/assets";
const OUT = path.join(ROOT, "iwasho/images/partner/benefit-projects.jpg");
const TARGET_W = 960;
const TARGET_H = 680;

const assetName = fs
  .readdirSync(ASSETS_DIR)
  .find((name) => name.includes("04_55_49_upscayl"));
if (!assetName) {
  throw new Error("benefit-projects source asset (04_55_49_upscayl) not found");
}

const srcPath = path.join(ASSETS_DIR, assetName);
const srcBuf = fs.readFileSync(srcPath);

const meta = await sharp(srcBuf)
  .resize(TARGET_W, TARGET_H, { fit: "cover", position: "centre" })
  .jpeg({ quality: 95, mozjpeg: true, chromaSubsampling: "4:4:4" })
  .toFile(OUT);

console.log(JSON.stringify({ srcPath, out: OUT, ...meta }));
