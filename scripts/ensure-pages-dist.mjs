#!/usr/bin/env node
/**
 * dev / verify 起動前に deploy/cloudflare/dist を確認
 * robots.txt · _headers が無い場合は deploy/cloudflare/ から同期
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CF_DIR = path.join(ROOT, "deploy/cloudflare");
const DIST = path.join(CF_DIR, "dist");
const marker = path.join(DIST, "index.html");

const CF_META = ["robots.txt", "_headers", "_redirects"];
const LIVE_SRC = path.join(ROOT, "live");
const LIVE_DEST = path.join(DIST, "live");

function copyFileIfChanged(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (!fs.existsSync(dest)) {
    fs.copyFileSync(src, dest);
    return true;
  }
  const srcStat = fs.statSync(src);
  const destStat = fs.statSync(dest);
  if (srcStat.mtimeMs > destStat.mtimeMs || srcStat.size !== destStat.size) {
    fs.copyFileSync(src, dest);
    return true;
  }
  const srcBuf = fs.readFileSync(src);
  const destBuf = fs.readFileSync(dest);
  if (!srcBuf.equals(destBuf)) {
    fs.copyFileSync(src, dest);
    return true;
  }
  return false;
}

function syncLiveDir() {
  if (!fs.existsSync(LIVE_SRC)) return 0;
  let synced = 0;
  const walk = (rel = "") => {
    const srcDir = rel ? path.join(LIVE_SRC, rel) : LIVE_SRC;
    for (const name of fs.readdirSync(srcDir)) {
      const relPath = rel ? `${rel}/${name}` : name;
      const src = path.join(LIVE_SRC, relPath);
      const dest = path.join(LIVE_DEST, relPath);
      if (fs.statSync(src).isDirectory()) {
        walk(relPath);
      } else if (copyFileIfChanged(src, dest)) {
        synced += 1;
      }
    }
  };
  walk();
  return synced;
}

function syncCfMeta() {
  let synced = 0;
  for (const name of CF_META) {
    const src = path.join(CF_DIR, name);
    const dest = path.join(DIST, name);
    if (!fs.existsSync(src)) continue;
    const needsCopy = !fs.existsSync(dest) || fs.readFileSync(src, "utf8") !== fs.readFileSync(dest, "utf8");
    if (needsCopy) {
      fs.copyFileSync(src, dest);
      synced += 1;
      console.log(`[ensure-pages-dist] synced ${name} → dist/${name}`);
    }
  }
  return synced;
}

if (!fs.existsSync(marker)) {
  console.error("[ensure-pages-dist] deploy/cloudflare/dist が見つかりません。");
  console.error("  npm run build:pages");
  console.error("  npm run dev");
  process.exit(1);
}

const missingRequired = ["robots.txt", "_headers"].filter((n) => !fs.existsSync(path.join(DIST, n)));
if (missingRequired.length) {
  console.warn(`[ensure-pages-dist] missing in dist: ${missingRequired.join(", ")} — syncing from deploy/cloudflare/`);
  syncCfMeta();
}

const stillMissing = ["robots.txt", "_headers"].filter((n) => !fs.existsSync(path.join(DIST, n)));
if (stillMissing.length) {
  console.error(`[ensure-pages-dist] required files still missing: ${stillMissing.join(", ")}`);
  console.error("  npm run build:pages");
  process.exit(1);
}

const liveSynced = syncLiveDir();
if (liveSynced > 0) {
  console.log(`[ensure-pages-dist] synced live/ → dist/live/ (${liveSynced} file(s))`);
}
