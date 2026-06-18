#!/usr/bin/env node
/**
 * Git c9f47df の旧 shop-store.html を shop-vendors.html として復元
 */
import { execSync, spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "shop-vendors.html");

let html = execSync("git show c9f47df:shop-store.html").toString("utf8");

html = html.replace(
  "<title>店舗・販売（専門店）一覧 | TASFUL</title>",
  "<title>店舗・販売（専門店）一覧 | TASFUL</title>\n  <!-- 旧店舗一覧TOP — shop-vendors.html（市場TOP shop-store.html は別URL） -->"
);

// このページ内の検索・ナビは自URLへ（shop-store.html は変更しない）
html = html.replaceAll('action="shop-store.html"', 'action="shop-vendors.html"');
html = html.replaceAll('href="shop-store.html#shop-store-area"', 'href="shop-vendors.html#shop-store-area"');
html = html.replace(
  'href="shop-store.html" class="shop-market-header__nav-link">カテゴリから探す',
  'href="shop-vendors.html" class="shop-market-header__nav-link">カテゴリから探す'
);

if (!html.includes("shop-store-page.js")) {
  console.error("shop-store-page.js script missing in restored HTML");
  process.exit(1);
}

if (!html.includes('data-page="shop_store_list"')) {
  console.error('data-page="shop_store_list" missing');
  process.exit(1);
}

fs.writeFileSync(out, html, "utf8");
console.log("Wrote", out, html.length, "chars");

spawnSync(process.execPath, ["scripts/patch-shop-vendors-brand.mjs"], {
  cwd: root,
  stdio: "inherit",
});
