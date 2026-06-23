#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC =
  "C:/Users/rubih/.cursor/projects/c-Users-rubih-tasufull-article/assets/c__Users_rubih_AppData_Roaming_Cursor_User_workspaceStorage_244d71ec4e9fe743268f830b7ab81a32_images_ChatGPT_Image_2026_6_20__02_18_55-a8f9029b-5b97-4c60-bf9a-eba45032f1ef.png";
const OUT = path.join(ROOT, "iwasho/images/partner/cta-handshake.png");

const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

for (let i = 0; i < data.length; i += 4) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  if (r < 48 && g < 48 && b < 48) {
    data[i + 3] = 0;
  }
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
const meta = await sharp(data, {
  raw: { width: info.width, height: info.height, channels: 4 },
})
  .trim()
  .png()
  .toFile(OUT);

console.log(JSON.stringify({ out: OUT, ...meta }));
