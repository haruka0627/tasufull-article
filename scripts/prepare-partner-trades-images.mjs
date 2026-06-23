#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REF =
  "C:/Users/rubih/.cursor/projects/c-Users-rubih-tasufull-article/assets/c__Users_rubih_AppData_Roaming_Cursor_User_workspaceStorage_244d71ec4e9fe743268f830b7ab81a32_images_ChatGPT_Image_2026_6_20__03_21_15-089ebb07-ec35-49b5-afd0-b917d05c6cf3.png";
const OUT_DIR = path.join(ROOT, "iwasho/images/partner");
const TARGET_W = 640;
const TARGET_H = 480;

const CROPS = [
  { out: "trades-cleaning.jpg", left: 500, top: 198, width: 214, height: 132 },
  { out: "trades-other.jpg", left: 724, top: 198, width: 214, height: 132 },
  { out: "trades-consult.jpg", left: 700, top: 468, width: 280, height: 190 },
];

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const crop of CROPS) {
  const outPath = path.join(OUT_DIR, crop.out);
  await sharp(REF)
    .extract({
      left: crop.left,
      top: crop.top,
      width: crop.width,
      height: crop.height,
    })
    .resize(TARGET_W, TARGET_H, { fit: "cover", position: "centre" })
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(outPath);
  console.log("wrote", outPath);
}
