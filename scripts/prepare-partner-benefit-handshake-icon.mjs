#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC =
  "C:/Users/rubih/.cursor/projects/c-Users-rubih-tasufull-article/assets/c__Users_rubih_AppData_Roaming_Cursor_User_workspaceStorage_244d71ec4e9fe743268f830b7ab81a32_images_ChatGPT_Image_2026_6_20__02_49_06-4ccf2943-4bfe-46c7-b115-b95b522eba0e.png";
const OUT = path.join(ROOT, "iwasho/images/partner/benefit-handshake-icon.png");

function isBackgroundPixel(r, g, b) {
  if (r < 48 && g < 48 && b < 48) return true;
  if (r > 238 && g > 238 && b > 238) return true;
  return false;
}

const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

for (let i = 0; i < data.length; i += 4) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  if (isBackgroundPixel(r, g, b)) {
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
