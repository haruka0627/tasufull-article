#!/usr/bin/env node
/** Sync footer SNS icons to Font Awesome across IWASHO HTML files */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FOOTER_SNS_GROUP_HTML } from "./lib/iwasho-footer-sns.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SNS_OLD =
  /<div class="sns-group">[\s\S]*?<a href="#" class="sns-link" aria-label="X">[\s\S]*?<\/a>\s*<\/div>/g;

const FILES = [
  ...readdirSync(path.join(ROOT, "iwasho"))
    .filter((f) => f.endsWith(".html"))
    .map((f) => path.join("iwasho", f)),
  "source/wix/iwasho-footer.embed.html",
];

let updated = 0;
for (const rel of FILES) {
  const file = path.join(ROOT, rel);
  let text = readFileSync(file, "utf8");
  if (!text.includes('class="sns-group"')) continue;
  const next = text.replace(SNS_OLD, FOOTER_SNS_GROUP_HTML.trim());
  if (next !== text) {
    writeFileSync(file, next, "utf8");
    updated += 1;
    console.log("updated", rel);
  }
}
console.log(`done: ${updated} files`);
