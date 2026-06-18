/**
 * TOP ヒーロー用 AI相談バナー（1400×180）を生成・書き出し
 * 元画像: assets/banner-ai-1400x180.png または引数で指定
 */
import sharp from "sharp";
import { mkdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const defaultSrc = join(root, "images", "banners", "banner-ai-source.png");
const src = process.argv[2] || defaultSrc;
const out = join(root, "images", "banners", "banner-ai-campaign.png");
const W = 1400;
const H = 180;

await mkdir(dirname(out), { recursive: true });

const meta = await sharp(src).metadata();
console.log("source:", src, meta.width, "x", meta.height);

await sharp(src)
  .resize(W, H, { fit: "cover", position: "centre" })
  .png({ compressionLevel: 9 })
  .toFile(out);

const outMeta = await sharp(out).metadata();
console.log("written:", out, outMeta.width, "x", outMeta.height);
