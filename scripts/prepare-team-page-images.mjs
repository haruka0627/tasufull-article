#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REF =
  "C:/Users/rubih/.cursor/projects/c-Users-rubih-tasufull-article/assets/c__Users_rubih_AppData_Roaming_Cursor_User_workspaceStorage_244d71ec4e9fe743268f830b7ab81a32_images_image-ab831572-2aa3-4232-8d39-ced2af22f333.png";
const OUT = path.join(ROOT, "iwasho/images/team");

const iwashoY = 305;
const tasfulY = 525;
const size = 108;
const centers = [93, 217, 341, 465, 589];

function portraitCrop(centerX, top) {
  return {
    left: centerX - Math.round(size / 2),
    top,
    width: size,
    height: size,
    resize: [220, 220],
  };
}

const crops = [
  { out: "hero-group.png", left: 350, top: 88, width: 310, height: 130, resize: [560, 235] },
  { out: "cta-group.png", left: 350, top: 830, width: 310, height: 130, resize: [560, 235] },
  ...["iwasho-representative", "iwasho-construction", "iwasho-quality", "iwasho-partner", "iwasho-admin"].map(
    (name, i) => ({ out: `${name}.png`, ...portraitCrop(centers[i], iwashoY) }),
  ),
  ...["tasful-representative", "tasful-dx", "tasful-ai", "tasful-system", "tasful-customer"].map(
    (name, i) => ({ out: `${name}.png`, ...portraitCrop(centers[i], tasfulY) }),
  ),
];

fs.mkdirSync(OUT, { recursive: true });
const refBuf = fs.readFileSync(REF);

for (const crop of crops) {
  let img = sharp(refBuf).extract({
    left: crop.left,
    top: crop.top,
    width: crop.width,
    height: crop.height,
  });
  if (crop.resize) {
    img = img.resize(crop.resize[0], crop.resize[1], { fit: "cover", position: "centre" });
  }
  const outPath = path.join(OUT, crop.out);
  await img.png().toFile(outPath);
  console.log("wrote", outPath);
}
