#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const file = "detail-product.html";
let html = fs.readFileSync(path.join(ROOT, "backups", "_phase2d-extract", file), "utf8");

if (!html.includes("listing-ai-badge.css")) {
  html = html.replace(
    /(<link rel="stylesheet" href="listing-detail-page.css">)\s*\n/,
    `$1\n  <link rel="stylesheet" href="listing-ai-badge.css">\n`
  );
}

const banner = `  <div class="tasu-banner">
    <div class="tasu-text">
      🚀 <span class="logo">TASFUL</span>プラットフォームへようこそ　
      <a href="/post" class="link">今月システム利用料5％！</a>　
      ｜　
      <a href="listing-management.html" class="link accent">掲載管理</a>　
      ｜　
      <span style="color: #94a3b8;"></span>
    </div>
  </div>`;

html = html.replace(
  /<div class="tasu-banner">[\s\S]*?<\/div>\s*\n\s*<nav class="section-nav"/,
  `${banner}\n\n  <nav class="section-nav"`
);

for (const key of [
  "description",
  "category",
  "condition",
  "price-note",
  "stock",
  "specs",
  "shipping",
]) {
  html = html.replace(
    new RegExp(`" data-listing-product-${key.replace("-", "\\-")}-block"`, "g"),
    '"'
  );
}

fs.writeFileSync(path.join(ROOT, file), html, "utf8");
console.log("detail-product.html: restored from backup + patches");
