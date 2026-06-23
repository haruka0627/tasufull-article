#!/usr/bin/env node
/**
 * dev 起動前に deploy/cloudflare/dist が存在するか確認
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const marker = path.join(ROOT, "deploy/cloudflare/dist/index.html");

if (!fs.existsSync(marker)) {
  console.error("[ensure-pages-dist] deploy/cloudflare/dist が見つかりません。");
  console.error("  npm run build:pages");
  console.error("  npm run dev");
  process.exit(1);
}
