#!/usr/bin/env node
/**
 * HP-MIGRATION-6F — Wix ADVANTAGE direct port 検証
 *   node scripts/capture-iwasho-advantage-6f.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/hp-migration-6f-advantage-direct-port");

const VIEWPORTS = [
  { id: "390", width: 390, height: 844 },
  { id: "768", width: 768, height: 1024 },
  { id: "1280", width: 1280, height: 900 },
];

const base = await findDevServerBaseUrl({ probePath: "iwasho/index.html" });
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
      await page.goto(`${base}/iwasho/`, { waitUntil: "domcontentloaded", timeout: 60000 });

      await page.evaluate(() => {
        const section = document.querySelector(".advantage-section");
        if (section) section.scrollIntoView({ block: "start" });
      });
      await page.waitForTimeout(400);

      const shot = path.join(OUT, `advantage-${vp.id}.png`);
      await page.screenshot({ path: shot, fullPage: false });

      const audit = await page.evaluate((vpId) => {
        const doc = document.documentElement;
        const section = document.querySelector(".advantage-section");
        const grid = document.querySelector(".advantage-grid");
        const cards = document.querySelectorAll(".advantage-section .glass-card");
        const gridStyle = grid ? getComputedStyle(grid) : null;
        const cardRects = [...cards].map((c) => c.getBoundingClientRect());

        let layout = "unknown";
        if (cards.length === 3 && cardRects.length === 3) {
          const sameRow =
            Math.abs(cardRects[0].top - cardRects[1].top) < 8 &&
            Math.abs(cardRects[1].top - cardRects[2].top) < 8;
          const stacked =
            cardRects[1].top > cardRects[0].bottom - 8 &&
            cardRects[2].top > cardRects[1].bottom - 8;
          if (sameRow) layout = "row";
          else if (stacked) layout = "column";
        }

        const hero = document.querySelector(".top-hero");
        const heroBottom = hero ? hero.getBoundingClientRect().bottom : null;
        const sectionTop = section ? section.getBoundingClientRect().top : null;

        return {
          overflowX: doc.scrollWidth > doc.clientWidth + 1,
          bodyOverflow: getComputedStyle(document.body).overflow,
          htmlOverflow: getComputedStyle(document.documentElement).overflow,
          hasAdvantageSection: !!section,
          hasParticlesBg: !!document.querySelector(".advantage-section .particles-bg"),
          glassCardCount: cards.length,
          emblemIconCount: document.querySelectorAll(".advantage-section .emblem-icon").length,
          gridFlexDirection: gridStyle?.flexDirection ?? null,
          layout,
          mainTitleText: document.querySelector(".advantage-section .main-title")?.textContent?.trim(),
          cardMinHeight1280:
            vpId === "1280" && cards[0] ? getComputedStyle(cards[0]).minHeight : null,
          heroToAdvantageGap: heroBottom != null && sectionTop != null ? sectionTop - heroBottom : null,
          oldAdvantageRemoved: document.querySelectorAll(".iwasho-home-advantage").length === 0,
        };
      }, vp.id);

      results.push({
        viewport: vp.id,
        consoleErrors,
        audit,
        screenshot: path.relative(ROOT, shot).replace(/\\/g, "/"),
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
    report.issues.push(`${r.viewport}: console errors — ${r.consoleErrors.join("; ")}`);
  }
  if (r.audit.bodyOverflow === "hidden" || r.audit.htmlOverflow === "hidden") {
    report.pass = false;
    report.issues.push(`${r.viewport}: body/html overflow hidden`);
  }
  if (!r.audit.hasAdvantageSection || !r.audit.oldAdvantageRemoved) {
    report.pass = false;
    report.issues.push(`${r.viewport}: advantage section not direct port`);
  }
  if (r.audit.glassCardCount !== 3 || r.audit.emblemIconCount !== 3) {
    report.pass = false;
    report.issues.push(`${r.viewport}: expected 3 glass cards with emblem SVGs`);
  }
  if (r.viewport === "1280" && r.audit.layout !== "row") {
    report.pass = false;
    report.issues.push(`${r.viewport}: expected 3 cards in a row at 1280px`);
  }
  if (r.viewport === "390" && r.audit.layout !== "column") {
    report.pass = false;
    report.issues.push(`${r.viewport}: expected 1 column at 390px`);
  }
}

fs.writeFileSync(path.join(OUT, "audit.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.pass ? 0 : 1);
