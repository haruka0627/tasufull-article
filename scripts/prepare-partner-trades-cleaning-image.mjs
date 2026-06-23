#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC =
  "C:/Users/rubih/.cursor/projects/c-Users-rubih-tasufull-article/assets/c__Users_rubih_AppData_Roaming_Cursor_User_workspaceStorage_244d71ec4e9fe743268f830b7ab81a32_images_ChatGPT_Image_2026_6_20__03_24_39-1c5ac3a7-d239-49ed-ad02-b3c7dc5f004a.png";
const OUT = path.join(ROOT, "iwasho/images/partner/trades-cleaning.jpg");
const TARGET_W = 856;
const TARGET_H = 642;

const meta = await sharp(SRC)
  .resize(TARGET_W, TARGET_H, {
    fit: "cover",
    position: "centre",
  })
  .jpeg({ quality: 92, mozjpeg: true })
  .toFile(OUT);

console.log(JSON.stringify({ out: OUT, ...meta }));
