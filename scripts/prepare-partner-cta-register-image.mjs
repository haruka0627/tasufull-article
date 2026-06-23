#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC =
  "C:/Users/rubih/.cursor/projects/c-Users-rubih-tasufull-article/assets/c__Users_rubih_AppData_Roaming_Cursor_User_workspaceStorage_244d71ec4e9fe743268f830b7ab81a32_images_ChatGPT_Image_2026_6_20__04_01_24-932f7c76-19ae-41e8-8ec2-e77d587d413f.png";
const OUT = path.join(ROOT, "iwasho/images/partner/cta-register.jpg");

const meta = await sharp(SRC)
  .resize(1400, 900, {
    fit: "cover",
    position: "attention",
  })
  .jpeg({ quality: 92 })
  .toFile(OUT);

console.log(JSON.stringify({ src: SRC, out: OUT, ...meta }));
