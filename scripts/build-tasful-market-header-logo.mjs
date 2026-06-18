/**
 * TASFUL市場 PCヘッダー用ロゴ（Tマーク + TASFUL市場 を1画像に合成）
 */
import sharp from "sharp";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "images", "tasful-market-header-logo.png");

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80" viewBox="0 0 240 80">
  <defs>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#e8c96a"/>
      <stop offset="55%" stop-color="#f5c542"/>
      <stop offset="100%" stop-color="#9a7b2e"/>
    </linearGradient>
  </defs>
  <rect x="0" y="12" width="52" height="52" rx="9" fill="url(#gold)"/>
  <text x="26" y="47" text-anchor="middle" font-family="'Noto Sans JP', Arial, sans-serif" font-weight="900" font-size="28" fill="#1a2533">T</text>
  <text x="66" y="49" font-family="'Noto Sans JP', Arial, sans-serif" font-weight="800" font-size="26" fill="#ffffff">TASFUL</text>
  <text x="178" y="49" font-family="'Noto Sans JP', Arial, sans-serif" font-weight="700" font-size="22" fill="#ffffff">市場</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(output);
const meta = await sharp(output).metadata();
console.log("wrote", output, `${meta.width}x${meta.height}`);
