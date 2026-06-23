#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS =
  "C:/Users/rubih/.cursor/projects/c-Users-rubih-tasufull-article/assets";
const SRC = path.join(
  ASSETS,
  "c__Users_rubih_AppData_Roaming_Cursor_User_workspaceStorage_244d71ec4e9fe743268f830b7ab81a32_images_ChatGPT_Image_2026_6_20__03_26_09_upscayl_2x_digital-art-4x-11c28328-aa4e-4a9d-8c9b-f8bc57072378.png",
);
const OUT = path.join(ROOT, "iwasho/images/partner/trades-consult-meeting.jpg");
const TARGET_W = 640;
const TARGET_H = 480;

const meta = await sharp(fs.readFileSync(SRC))
  .resize(TARGET_W, TARGET_H, {
    fit: "cover",
    position: "centre",
  })
  .jpeg({ quality: 97, mozjpeg: true, chromaSubsampling: "4:4:4" })
  .toFile(OUT);

console.log(JSON.stringify({ src: SRC, out: OUT, ...meta }));
