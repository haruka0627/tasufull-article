#!/usr/bin/env node
import fs from "node:fs";
import { parse } from "parse5";
import { createServer } from "vite";

const file = "detail-business-service.html";
const html = fs.readFileSync(file, "utf8");
const ufffd = (html.match(/\uFFFD/g) || []).length;

parse(html);

const brokenAria = [];
for (const [i, line] of html.split(/\r?\n/).entries()) {
  if (/aria-label="[^"]+\s+hidden/.test(line)) {
    brokenAria.push({ line: i + 1, text: line.trim() });
  }
  if (/aria-label="[^"]*$/.test(line.trim()) && !line.includes('aria-label=""')) {
    brokenAria.push({ line: i + 1, text: line.trim(), reason: "unclosed quote" });
  }
}

const server = await createServer();
try {
  await server.transformIndexHtml(`/${file}`, html);
} finally {
  await server.close();
}

const galleryOk =
  html.includes('aria-label="前の画像"') &&
  html.includes('aria-label="次の画像"') &&
  html.includes("biz-detail-gallery-nav--prev") &&
  html.includes("biz-detail-gallery-nav--next");

const pass = ufffd === 0 && brokenAria.length === 0 && galleryOk;
console.log(
  JSON.stringify({ ufffd, parse5: "ok", viteTransform: "ok", brokenAria, galleryOk }, null, 2),
);
console.log(pass ? "PASS detail-business-service html syntax" : "FAIL");
process.exitCode = pass ? 0 : 1;
