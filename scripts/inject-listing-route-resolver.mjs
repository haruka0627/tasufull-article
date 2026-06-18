#!/usr/bin/env node
/**
 * listing-route-resolver.js を listing-demo-catalog.js より前に挿入
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const RESOLVER = '  <script src="listing-route-resolver.js"></script>\n';
const TARGETS = [
  "dashboard.html",
  "talk-home.html",
  "detail-job.html",
  "detail-product.html",
  "detail-skill.html",
  "detail-worker.html",
  "detail-shop.html",
  "detail-business-service.html",
  "detail-general.html",
  "detail-business.html",
];

let updated = 0;
for (const rel of TARGETS) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) {
    console.warn(`skip: ${rel}`);
    continue;
  }
  let html = fs.readFileSync(file, "utf8");
  if (html.includes("listing-route-resolver.js")) {
    console.log(`ok: ${rel}`);
    continue;
  }
  if (html.includes("listing-demo-catalog.js")) {
    html = html.replace(
      /(\s*)<script src="listing-demo-catalog\.js"><\/script>/i,
      `$1${RESOLVER.trim()}\n$1<script src="listing-demo-catalog.js"></script>`
    );
  } else if (rel === "talk-home.html" && html.includes("talk-home-data.js")) {
    html = html.replace(
      /(\s*)<script src="talk-home-data\.js"><\/script>/i,
      `$1${RESOLVER.trim()}\n$1<script src="talk-home-data.js"></script>`
    );
  } else if (/<script src="listings-db\.js"><\/script>/i.test(html)) {
    html = html.replace(
      /(\s*)<script src="listings-db\.js"><\/script>/i,
      `$1${RESOLVER.trim()}\n$1<script src="listings-db.js"></script>`
    );
  } else {
    html = html.replace(/\s*<\/head>/i, `\n${RESOLVER}</head>`);
  }
  fs.writeFileSync(file, html, "utf8");
  updated += 1;
  console.log(`updated: ${rel}`);
}
console.log(`\nDone. ${updated} file(s) changed.`);
