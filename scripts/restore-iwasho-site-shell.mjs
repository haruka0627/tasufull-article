#!/usr/bin/env node
/**
 * Restore completed IWASHO header (.iw-site-header) and footer (.footer-wrapper).
 */
import fs from "node:fs";
import path from "node:path";
import { PAGE_ACTIVE, renderIwashoFooter, renderIwashoHeader } from "./lib/iwasho-site-shell.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

const FOOTER_BLOCK_RE = /<div class="footer-wrapper">[\s\S]*?<div class="copyright">[\s\S]*?<\/div>\s*<\/div>/;
const HEADER_RE = /<header class="(?:iw-header|iw-site-header|custom-header)">[\s\S]*?<\/header>\s*/;

function stripOldChrome(html) {
  return html
    .replace(/\s*<link rel="stylesheet" href="\/iwasho-site-chrome\.css" \/?>\s*/g, "\n")
    .replace(/\s*<script src="\/iwasho-site-chrome\.js" defer><\/script>\s*/g, "\n")
    .replace(/\s*<script src="\/-chrome\.js" defer><\/script>\s*/g, "\n")
    .replace(/\s*<script src="\/iwasho\/iwasho-home\.js"><\/script>\s*/g, "\n")
    .replace(/\s*<script src="\/iwasho\/iwasho-home\.js" defer><\/script>\s*/g, "\n")
    .replace(/\s*<script src="\/tas-hp-header-menu\.js" defer><\/script>\s*/g, "\n")
    .replace(FOOTER_BLOCK_RE, "")
    .replace(/<footer class="(?:iw-footer|modern-footer|corp-footer)">[\s\S]*?<\/footer>\s*/g, "")
    .replace(HEADER_RE, "");
}

function ensureStyles(html) {
  let next = html;
  if (!next.includes('href="/corp-biz-home.css"')) {
    next = next.replace(
      /(<link rel="stylesheet" href="\/corp-layout\.css" \/>)/,
      '$1\n  <link rel="stylesheet" href="/corp-biz-home.css" />'
    );
  }
  return next;
}

function ensureHomeWrapper(html) {
  if (html.includes('class="iwasho-home-page')) return html;
  return html
    .replace(/(<body[^>]*>\s*)(<main class="corp-main">)/, '$1<div class="iwasho-home-page iwasho-privacy-page">\n$2')
    .replace(/(<\/main>\s*)(<\/body>)/, "$1</div>\n$2");
}

function insertShell(html, header, footerInner) {
  let next = html;
  if (!next.includes('<div class="iwasho-home-page')) {
    next = ensureHomeWrapper(next);
  }

  next = next.replace(/(<div class="iwasho-home-page[^"]*">)\s*/i, `$1\n${header}\n`);

  if (/<\/main>\s*<\/div>\s*<\/body>/i.test(next)) {
    next = next.replace(
      /<\/main>\s*<\/div>\s*(<\/body>)/i,
      `</main>\n${footerInner}\n<script src="/iwasho/iwasho-home.js" defer></script>\n</div>\n$1`
    );
  } else {
    next = next.replace(/(\s*<\/body>)/, `\n${footerInner}\n<script src="/iwasho/iwasho-home.js" defer></script>\n</div>\n$1`);
  }

  return next;
}

function patchFile(filePath) {
  const base = path.basename(filePath);
  const activeId = PAGE_ACTIVE[base] ?? null;
  let html = fs.readFileSync(filePath, "utf8");

  html = stripOldChrome(html);
  html = ensureStyles(html);
  html = html.replace(/\s*corp-body--tasful-hp/g, "");
  html = html.replace(/\s*iwasho-site\b/g, "");

  const header = renderIwashoHeader(activeId);
  const footerInner = renderIwashoFooter().replace(/\s*<script src="\/iwasho\/iwasho-home\.js" defer><\/script>\s*$/, "");

  html = insertShell(html, header, footerInner);
  fs.writeFileSync(filePath, html, "utf8");
  return base;
}

const targets = [
  ...fs.readdirSync(path.join(ROOT, "iwasho")).filter((f) => f.endsWith(".html")).map((f) => path.join(ROOT, "iwasho", f)),
  ...fs
    .readdirSync(path.join(ROOT, "deploy/cloudflare/dist/iwasho"))
    .filter((f) => f.endsWith(".html"))
    .map((f) => path.join(ROOT, "deploy/cloudflare/dist/iwasho", f)),
];

const updated = targets.map(patchFile);
console.log(`Restored ${updated.length} pages: ${[...new Set(updated)].join(", ")}`);
