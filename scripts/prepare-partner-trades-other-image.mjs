#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC =
  "C:/Users/rubih/.cursor/projects/c-Users-rubih-tasufull-article/assets/c__Users_rubih_AppData_Roaming_Cursor_User_workspaceStorage_244d71ec4e9fe743268f830b7ab81a32_images_ChatGPT_Image_2026_6_20__04_04_29-4a3477be-0d45-48d5-932b-6477a4d99a8b.png";
const OUT_OTHER = path.join(ROOT, "iwasho/images/partner/trades-other.jpg");
const OUT_CONSULT = path.join(ROOT, "iwasho/images/partner/trades-consult.jpg");
const OTHER_W = 856;
const OTHER_H = 642;
const CONSULT_W = 640;
const CONSULT_H = 480;

const tone = (img) =>
  img.modulate({ brightness: 0.95, saturation: 1.08 }).linear(1.05, -(128 * 0.05));

const otherMeta = await tone(
  sharp(SRC).resize(OTHER_W, OTHER_H, {
    fit: "cover",
    position: "centre",
  }),
)
  .jpeg({ quality: 92, mozjpeg: true })
  .toFile(OUT_OTHER);

const consultMeta = await tone(
  sharp(SRC).resize(CONSULT_W, CONSULT_H, {
    fit: "cover",
    position: "centre",
  }),
)
  .jpeg({ quality: 92, mozjpeg: true })
  .toFile(OUT_CONSULT);

console.log(JSON.stringify({ other: { out: OUT_OTHER, ...otherMeta }, consult: { out: OUT_CONSULT, ...consultMeta } }));
