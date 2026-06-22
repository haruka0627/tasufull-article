#!/usr/bin/env node
/**
 * Build IWASHO legal pages (terms / partner-terms / privacy) from shared layout.
 */
import fs from "node:fs";
import path from "node:path";
import { LEGAL_PAGES } from "./lib/iwasho-legal-content.mjs";
import { renderIwashoLegalPage } from "./lib/iwasho-legal-shell.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

const OUTPUT_DIRS = [
  path.join(ROOT, "iwasho"),
  path.join(ROOT, "deploy/cloudflare/dist/iwasho"),
];

const CSS_TARGETS = [
  path.join(ROOT, "corp-biz-legal.css"),
  path.join(ROOT, "deploy/cloudflare/dist/corp-biz-legal.css"),
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyCss() {
  const src = path.join(ROOT, "corp-biz-legal.css");
  for (const dest of CSS_TARGETS) {
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
  }
}

function buildPages() {
  const pages = Object.values(LEGAL_PAGES);
  for (const dir of OUTPUT_DIRS) {
    ensureDir(dir);
    for (const page of pages) {
      const html = renderIwashoLegalPage(page);
      fs.writeFileSync(path.join(dir, page.file), html, "utf8");
    }
  }
  return pages.map((p) => p.file);
}

copyCss();
const built = buildPages();
console.log(`Built ${built.length} legal pages × ${OUTPUT_DIRS.length} dirs: ${built.join(", ")}`);
