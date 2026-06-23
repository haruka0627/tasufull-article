#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "iwasho/images/categories/thumb-exterior.png");
const OUT = path.join(ROOT, "iwasho/images/partner/trades-construction.jpg");
const TARGET_W = 640;
const TARGET_H = 480;

const meta = await sharp(SRC)
  .resize(TARGET_W, TARGET_H, {
    fit: "cover",
    position: "centre",
  })
  .jpeg({ quality: 97, mozjpeg: true, chromaSubsampling: "4:4:4" })
  .toFile(OUT);

console.log(JSON.stringify({ src: SRC, out: OUT, ...meta }));
