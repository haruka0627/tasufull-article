#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS =
  "C:/Users/rubih/.cursor/projects/c-Users-rubih-tasufull-article/assets";
const OUT_DIR = path.join(ROOT, "iwasho/images/partner");

const STEPS = [
  {
    out: "flow-01-entry.png",
    src: `${ASSETS}/c__Users_rubih_AppData_Roaming_Cursor_User_workspaceStorage_244d71ec4e9fe743268f830b7ab81a32_images_ChatGPT_Image_2026_6_20__02_46_31-7831c97c-a454-489c-b24f-b6256e73fc9a.png`,
  },
  {
    out: "flow-02-review.png",
    src: `${ASSETS}/c__Users_rubih_AppData_Roaming_Cursor_User_workspaceStorage_244d71ec4e9fe743268f830b7ab81a32_images_ChatGPT_Image_2026_6_20__02_47_52-aefb2a9c-e140-4894-8811-a42595dceafc.png`,
  },
  {
    out: "flow-03-contract.png",
    src: `${ASSETS}/c__Users_rubih_AppData_Roaming_Cursor_User_workspaceStorage_244d71ec4e9fe743268f830b7ab81a32_images_ChatGPT_Image_2026_6_20__02_49_06-187ac190-f006-4d0c-96f0-bac8f56e5548.png`,
  },
  {
    out: "flow-04-complete.png",
    src: `${ASSETS}/c__Users_rubih_AppData_Roaming_Cursor_User_workspaceStorage_244d71ec4e9fe743268f830b7ab81a32_images_ChatGPT_Image_2026_6_20__02_50_33-3989ca63-29ac-4449-8867-bac3ddd605b8.png`,
  },
  {
    out: "flow-05-intro.png",
    src: `${ASSETS}/c__Users_rubih_AppData_Roaming_Cursor_User_workspaceStorage_244d71ec4e9fe743268f830b7ab81a32_images_ChatGPT_Image_2026_6_20__02_51_58-fad06981-c0e2-4a4f-994e-d5982a48fa05.png`,
  },
];

function isBackgroundPixel(r, g, b) {
  if (r < 48 && g < 48 && b < 48) return true;
  if (r > 238 && g > 238 && b > 238) return true;
  return false;
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const results = [];

for (const step of STEPS) {
  const { data, info } = await sharp(step.src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (isBackgroundPixel(r, g, b)) {
      data[i + 3] = 0;
    }
  }

  const outPath = path.join(OUT_DIR, step.out);
  const meta = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .trim()
    .png()
    .toFile(outPath);

  results.push({ step: step.out, out: outPath, ...meta });
}

console.log(JSON.stringify(results, null, 2));
