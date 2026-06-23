#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REF =
  "C:/Users/rubih/.cursor/projects/c-Users-rubih-tasufull-article/assets/c__Users_rubih_AppData_Roaming_Cursor_User_workspaceStorage_244d71ec4e9fe743268f830b7ab81a32_images_image-0640c2d4-cf51-454c-9024-0a9f7f74013a.png";
const OUT = path.join(ROOT, "iwasho/images/company");

const crops = [
  { out: "hero-company.png", left: 330, top: 78, width: 330, height: 155, resize: [560, 262] },
  { out: "history-company.png", left: 330, top: 535, width: 330, height: 210, resize: [520, 330] },
];

fs.mkdirSync(OUT, { recursive: true });
const refBuf = fs.readFileSync(REF);

for (const crop of crops) {
  await sharp(refBuf)
    .extract({ left: crop.left, top: crop.top, width: crop.width, height: crop.height })
    .resize(crop.resize[0], crop.resize[1], { fit: "cover", position: "centre" })
    .png()
    .toFile(path.join(OUT, crop.out));
  console.log("wrote", crop.out);
}
