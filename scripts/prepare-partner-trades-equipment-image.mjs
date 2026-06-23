#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC_EQUIP = path.join(ROOT, "iwasho/images/about/service-equip.png");
const SRC_ELECTRIC = path.join(ROOT, "iwasho/images/about/service-electric.png");
const OUT = path.join(ROOT, "iwasho/images/partner/trades-equipment.jpg");
const TARGET_W = 640;
const TARGET_H = 480;
const HALF_W = TARGET_W / 2;

const left = await sharp(SRC_EQUIP)
  .resize(HALF_W, TARGET_H, { fit: "cover", position: "centre" })
  .toBuffer();

const right = await sharp(SRC_ELECTRIC)
  .resize(HALF_W, TARGET_H, { fit: "cover", position: "centre" })
  .toBuffer();

const meta = await sharp({
  create: {
    width: TARGET_W,
    height: TARGET_H,
    channels: 3,
    background: "#ffffff",
  },
})
  .composite([
    { input: left, left: 0, top: 0 },
    { input: right, left: HALF_W, top: 0 },
  ])
  .jpeg({ quality: 97, mozjpeg: true, chromaSubsampling: "4:4:4" })
  .toFile(OUT);

console.log(
  JSON.stringify({
    srcEquip: SRC_EQUIP,
    srcElectric: SRC_ELECTRIC,
    out: OUT,
    ...meta,
  }),
);
