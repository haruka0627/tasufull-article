#!/usr/bin/env node
/**
 * HP-MIGRATION-5 — IWASHO TOP 検証キャプチャ
 *   node scripts/capture-iwasho-home-top.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/hp-migration-5-iwasho-top");

const VIEWPORTS = [
  { id: "390", width: 390, height: 844 },
  { id: "768", width: 768, height: 1024 },
  { id: "1280", width: 1280, height: 900 },
];

async function findBase() {
  for (const port of [8788, 5173]) {
    const base = `http://127.0.0.1:${port}`;
    try {
      const res = await fetch(`${base}/iwasho/`, { method: "GET" });
      if (res.ok) return base;
    } catch {
      /* next */
    }
  }
  throw new Error("Serve dist: npx --yes serve deploy/cloudflare/dist -p 8788");
}

const base = await findBase();
fs.mkdirSync(OUT, { recursive: true });

const results = [];

await withPlaywrightBrowser(async (browser) => {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(String(err.message || err)));

    try {
      await page.goto(`${base}/iwasho/`, { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForTimeout(500);

      const topShot = path.join(OUT, `iwasho-top-${vp.id}-hero.png`);
      await page.screenshot({ path: topShot, fullPage: false });

      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(400);
      const footShot = path.join(OUT, `iwasho-top-${vp.id}-footer.png`);
      await page.screenshot({ path: footShot, fullPage: false });

      const audit = await page.evaluate(() => {
        const doc = document.documentElement;
        const header = document.querySelector(".custom-header");
        const hero = document.querySelector(".iwasho-home-hero");
        const footer = document.querySelector(".iwasho-home-footer");
        const headerRect = header?.getBoundingClientRect();
        const heroRect = hero?.getBoundingClientRect();
        const footerRect = footer?.getBoundingClientRect();
        const bodyOverflow = getComputedStyle(document.body).overflow;
        const htmlOverflow = getComputedStyle(document.documentElement).overflow;
        return {
          overflowX: doc.scrollWidth > doc.clientWidth + 1,
          scrollHeight: doc.scrollHeight,
          clientHeight: doc.clientHeight,
          scrollable: doc.scrollHeight > doc.clientHeight + 10,
          headerFixed: header ? getComputedStyle(header).position === "fixed" : false,
          headerHeight: headerRect?.height ?? null,
          heroTop: heroRect?.top ?? null,
          heroMinHeight: hero ? getComputedStyle(hero).minHeight : null,
          footerVisibleAfterScroll: footerRect ? footerRect.top < window.innerHeight : false,
          bodyOverflow,
          htmlOverflow,
          hasVideo: !!document.querySelector(".iwasho-home-hero__video"),
          videoMuted: document.querySelector(".iwasho-home-hero__video")?.muted ?? null,
        };
      });

      results.push({
        viewport: vp.id,
        consoleErrors,
        audit,
        shots: [
          path.relative(ROOT, topShot).replace(/\\/g, "/"),
          path.relative(ROOT, footShot).replace(/\\/g, "/"),
        ],
      });
    } finally {
      await page.close().catch(() => null);
      await ctx.close().catch(() => null);
    }
  }
});

await closeAllBrowsers();

const report = { base, results, pass: true, issues: [] };
for (const r of results) {
  if (r.audit.overflowX) {
    report.pass = false;
    report.issues.push(`${r.viewport}: horizontal overflow`);
  }
  if (r.consoleErrors.length) {
    report.pass = false;
    report.issues.push(`${r.viewport}: console errors: ${r.consoleErrors.join("; ")}`);
  }
  if (!r.audit.scrollable) {
    report.issues.push(`${r.viewport}: page may not scroll (warn)`);
  }
  if (r.audit.bodyOverflow === "hidden" || r.audit.htmlOverflow === "hidden") {
    report.pass = false;
    report.issues.push(`${r.viewport}: body/html overflow hidden`);
  }
  if (!r.audit.headerFixed) {
    report.pass = false;
    report.issues.push(`${r.viewport}: header not fixed`);
  }
  if (!r.audit.footerVisibleAfterScroll) {
    report.pass = false;
    report.issues.push(`${r.viewport}: footer not visible after scroll`);
  }
}

fs.writeFileSync(path.join(OUT, "audit.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await closeAllBrowsers();
process.exit(report.pass ? 0 : 1);
