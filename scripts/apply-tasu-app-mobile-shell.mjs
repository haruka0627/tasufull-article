#!/usr/bin/env node
/**
 * 主要HTMLへ tasful-app-mobile.js を追加
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

const TARGETS = [
  "anpi-dashboard.html",
  "anpi-notifications.html",
  "demo-progress.html",
  "detail-job.html",
  "detail-general.html",
  "detail-business.html",
  "detail-shop.html",
  "detail-shop-product.html",
  "detail-skill.html",
  "detail-product.html",
  "detail-worker.html",
  "detail-business-service.html",
  "my-listings.html",
  "post.html",
  "checkout.html",
  "order-complete.html",
  "talk-ops-room.html",
  "demo-progress.html",
];

const SCRIPT_TAGS = [
  '  <script src="tasful-app-mobile.js" defer></script>\n',
  '  <script src="tasful-mobile-detail-template.js" defer></script>\n',
];
const CSS_LINKS = [
  '  <link rel="stylesheet" href="tasful-app-mobile.css">\n',
  '  <link rel="stylesheet" href="tasful-app-mobile-detail.css">\n',
  '  <link rel="stylesheet" href="tasful-mobile-detail-template.css">\n',
];
const VIEWPORT_COVER =
  '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">';

let updated = 0;

for (const rel of TARGETS) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) {
    console.warn(`skip (missing): ${rel}`);
    continue;
  }
  let html = fs.readFileSync(file, "utf8");
  let changed = false;

  SCRIPT_TAGS.forEach((tag) => {
    const src = tag.match(/src="([^"]+)"/)?.[1];
    if (src && !html.includes(src)) {
      html = html.replace(/\s*<\/body>/i, `\n${tag}</body>`);
      changed = true;
    }
  });

  CSS_LINKS.forEach((link) => {
    if (!html.includes(link.trim())) {
      html = html.replace(/<\/head>/i, `\n${link}</head>`);
      changed = true;
    }
  });

  if (html.includes('name="viewport"') && !html.includes("viewport-fit=cover")) {
    html = html.replace(
      /<meta\s+name="viewport"\s+content="[^"]*"\s*\/?>/i,
      VIEWPORT_COVER
    );
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, html, "utf8");
    updated += 1;
    console.log(`updated: ${rel}`);
  } else {
    console.log(`ok: ${rel}`);
  }
}

console.log(`\nDone. ${updated} file(s) changed.`);
