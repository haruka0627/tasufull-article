/**
 * TOP 広告バナー wide 版（白余白トリム → 1400px 幅 PNG）
 * 元: images/banners/banner-ai-campaign-wide-source.png または第1引数
 */
import sharp from "sharp";
import { mkdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const defaultSrc = join(root, "images", "banners", "banner-ai-campaign-wide-source.png");
const src = process.argv[2] || defaultSrc;
const out = join(root, "images", "banners", "banner-ai-campaign-wide.png");

await mkdir(dirname(out), { recursive: true });

const trimmed = sharp(src).trim({ threshold: 12 });
const meta = await trimmed.metadata();
console.log("trimmed:", meta.width, "x", meta.height);

await trimmed
  .resize({ width: 1400, withoutEnlargement: false })
  .png({ compressionLevel: 9 })
  .toFile(out);

const outMeta = await sharp(out).metadata();
console.log("written:", out, outMeta.width, "x", outMeta.height);
