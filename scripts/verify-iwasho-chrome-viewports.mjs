#!/usr/bin/env node
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "deploy/cloudflare/dist");
const VIEWPORTS = [
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1280", width: 1280, height: 800 },
];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      let filePath = path.join(DIST, urlPath === "/" ? "index.html" : urlPath);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, "index.html");
      }
      if (!filePath.startsWith(DIST) || !fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      fs.createReadStream(filePath).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function checkPage(page, url, expectations) {
  const errors = [];
  page.on("pageerror", (err) => errors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.goto(url, { waitUntil: "domcontentloaded" });

  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    hasIwSiteHeader: !!document.querySelector(".iw-site-header"),
    hasIwHeader: !!document.querySelector(".iw-header"),
    hasFooterWrapper: !!document.querySelector(".iwasho-home-page .footer-wrapper"),
    hasModernFooter: !!document.querySelector(".modern-footer"),
    hasIwFooter: !!document.querySelector(".iw-footer"),
    tagline: document.querySelector(".iw-site-header__tagline")?.textContent?.trim() || null,
    footerInsideHome: !!document.querySelector(".iwasho-home-page .footer-wrapper"),
  }));

  const issues = [];
  if (metrics.scrollWidth > metrics.clientWidth + 1) {
    issues.push(`horizontal scroll (${metrics.scrollWidth}px > ${metrics.clientWidth}px)`);
  }
  for (const [key, expected] of Object.entries(expectations)) {
    if (metrics[key] !== expected) issues.push(`${key} expected ${expected}, got ${metrics[key]}`);
  }
  if (errors.length) issues.push(`console: ${errors.join(" | ")}`);

  return { issues, metrics, errors };
}

const server = await startServer();
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

const browser = await chromium.launch();
const results = [];

try {
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();

    const iw = await checkPage(page, `${base}/iwasho/index.html`, {
      hasIwSiteHeader: true,
      hasIwHeader: false,
      hasFooterWrapper: true,
      hasModernFooter: false,
      hasIwFooter: false,
      footerInsideHome: true,
      tagline: "現場をつなぐ、未来をつくる",
    });
    results.push({ page: "iwasho/index", viewport: vp.name, ...iw });

    const company = await checkPage(page, `${base}/company/index.html`, {
      hasIwSiteHeader: false,
      hasIwHeader: false,
      hasFooterWrapper: false,
      hasModernFooter: true,
      hasIwFooter: false,
      footerInsideHome: false,
      tagline: null,
    });
    results.push({ page: "company/index", viewport: vp.name, ...company });

    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

let failed = 0;
for (const r of results) {
  const status = r.issues.length ? "FAIL" : "PASS";
  if (r.issues.length) failed += 1;
  console.log(`[${status}] ${r.page} @ ${r.viewport}px`);
  if (r.issues.length) r.issues.forEach((i) => console.log(`  - ${i}`));
}

process.exit(failed ? 1 : 0);
