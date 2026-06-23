#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS =
  "C:/Users/rubih/.cursor/projects/c-Users-rubih-tasufull-article/assets";
const OUT = path.join(ROOT, "iwasho/images/company");

const jobs = [
  {
    src: `${ASSETS}/c__Users_rubih_AppData_Roaming_Cursor_User_workspaceStorage_244d71ec4e9fe743268f830b7ab81a32_images_ChatGPT_Image_2026_6_20__09_05_04_upscayl_2x_digital-art-4x-a743baa3-2abe-48a1-8d0b-a843008ed81f.png`,
    out: "hero-company.png",
    width: 560,
    height: 262,
  },
  {
    src: `${ASSETS}/c__Users_rubih_AppData_Roaming_Cursor_User_workspaceStorage_244d71ec4e9fe743268f830b7ab81a32_images_ChatGPT_Image_2026_6_20__09_05_44_upscayl_2x_digital-art-4x-ad9e5ecb-2155-4ed9-9ad3-f679cd1fce21.png`,
    out: "history-company.png",
    width: 520,
    height: 330,
  },
  {
    src: `${ASSETS}/c__Users_rubih_AppData_Roaming_Cursor_User_workspaceStorage_244d71ec4e9fe743268f830b7ab81a32_images_ChatGPT_Image_2026_6_20__09_07_04_upscayl_2x_digital-art-4x-f76fc14a-dc31-4706-a4ad-fd8247fce5e0.png`,
    out: "cta-company.png",
    width: 560,
    height: 235,
  },
];

fs.mkdirSync(OUT, { recursive: true });

for (const job of jobs) {
  const buf = fs.readFileSync(job.src);
  await sharp(buf)
    .resize(job.width, job.height, { fit: "cover", position: "centre" })
    .png()
    .toFile(path.join(OUT, job.out));
  console.log("wrote", job.out, `${job.width}x${job.height}`);
}
