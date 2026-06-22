#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const FOOTER_RE = /<div class="footer-wrapper">[\s\S]*?<div class="copyright">[\s\S]*?<\/div>\s*<\/div>/;

function fixHtml(html) {
  const footerMatch = html.match(FOOTER_RE);
  if (!footerMatch) return html;

  let next = html.replace(FOOTER_RE, "");
  next = next.replace(/\s*<script src="\/-chrome\.js" defer><\/script>\s*/g, "\n");
  next = next.replace(/\s*<script src="\/iwasho-site-chrome\.js" defer><\/script>\s*/g, "\n");

  const footer = footerMatch[0];

  if (/<\/main>[\s\S]*?<\/div>[\s\S]*?<\/body>/i.test(next) && !next.includes(`${footer}\n<script src="/iwasho/iwasho-home.js"`)) {
    next = next.replace(
      /<\/main>\s*(?:<script src="\/iwasho\/iwasho-home\.js" defer><\/script>\s*)?<\/div>\s*(?:<script src="\/iwasho\/iwasho-home\.js" defer><\/script>\s*)?(?=<\/body>)/i,
      `</main>\n${footer}\n<script src="/iwasho/iwasho-home.js" defer></script>\n</div>\n`
    );
  }

  next = next.replace(
    /(<\/main>\s*)<\/div>\s*<div class="footer-wrapper">/i,
    `$1${footer}\n<script src="/iwasho/iwasho-home.js" defer></script>\n</div>\n<!-- removed orphan footer -->`
  );

  if (next.includes("<!-- removed orphan footer -->")) {
    next = next.replace(/<!-- removed orphan footer -->[\s\S]*?<\/div>\s*(?=<script src="\/iwasho\/iwasho-home\.js")/, "");
  }

  next = next.replace(
    /(<script src="\/iwasho\/iwasho-home\.js" defer><\/script>\s*){2,}/g,
    '<script src="/iwasho/iwasho-home.js" defer></script>\n'
  );

  if (!next.match(FOOTER_RE)) {
    next = next.replace(
      /<\/main>\s*(?=<script src="\/iwasho\/iwasho-home\.js" defer><\/script>\s*<\/div>)/i,
      `</main>\n${footer}\n`
    );
  }

  return next;
}

for (const dir of [path.join(ROOT, "iwasho"), path.join(ROOT, "deploy/cloudflare/dist/iwasho")]) {
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".html"))) {
    const filePath = path.join(dir, file);
    const html = fs.readFileSync(filePath, "utf8");
    const fixed = fixHtml(html);
    if (fixed !== html) {
      fs.writeFileSync(filePath, fixed, "utf8");
      console.log("fixed:", path.relative(ROOT, filePath));
    }
  }
}
