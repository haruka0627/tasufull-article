#!/usr/bin/env node
/** Re-apply favorite script tags after Phase 2-D restore (UTF-8). */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const block = `  <script src="listing-local-store.js"></script>
  <script src="favorite-store.js"></script>
  <script src="favorite-actions.js"></script>
`;

function merge(rel, text) {
  if (text.includes("favorite-store.js")) return text;
  if (rel === "detail-shop.html") {
    const re =
      /(\s*<script src="detail-shop-store\.js"><\/script>[\r\n]+)(\s*<script src="detail-shop-store-bottom\.js"><\/script>)/;
    return text.replace(re, `$1${block}$2`);
  }
  if (rel === "detail-business-service.html") {
    const re =
      /(\s*<script src="\.\/detail-business-service-sticky-nav\.js"><\/script>[\r\n]+)(\s*<script src="\.\/detail-business-service-loader\.js"><\/script>)/;
    return text.replace(re, `$1${block}$2`);
  }
  return text;
}

for (const rel of ["detail-shop.html", "detail-business-service.html"]) {
  const abs = path.join(ROOT, rel);
  const before = fs.readFileSync(abs, "utf8");
  const after = merge(rel, before);
  if (after === before) {
    console.error(`SKIP (no match): ${rel}`);
    process.exit(1);
  }
  fs.writeFileSync(abs, after, "utf8");
  console.log(`OK ${rel} — favorite scripts merged`);
}
