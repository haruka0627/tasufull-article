#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REF =
  "C:/Users/rubih/.cursor/projects/c-Users-rubih-tasufull-article/assets/c__Users_rubih_AppData_Roaming_Cursor_User_workspaceStorage_244d71ec4e9fe743268f830b7ab81a32_images_ChatGPT_Image_2026_6_20__04_48_33-294bf574-8ec7-4161-a2eb-2e3c53f15547.png";
const OUT_DIR = path.join(ROOT, "iwasho/images/partner");
const TARGET_W = 960;
const TARGET_H = 680;

const crops = [
  { name: "benefit-fair-trade.jpg", left: 522, top: 78, width: 238, height: 178 },
  { name: "benefit-growth.jpg", left: 774, top: 78, width: 238, height: 178 },
];

const defaultJpeg = { quality: 92, mozjpeg: true };

for (const crop of crops) {
  const out = path.join(OUT_DIR, crop.name);
  const meta = await sharp(REF)
    .extract({
      left: crop.left,
      top: crop.top,
      width: crop.width,
      height: crop.height,
    })
    .resize(TARGET_W, TARGET_H, { fit: "cover", position: "centre" })
    .jpeg({ ...defaultJpeg, ...crop.jpeg })
    .toFile(out);
  console.log(JSON.stringify({ out, ...meta }));
}
