#!/usr/bin/env node
/**
 * HP-MIGRATION-6E — Wix hero direct port 検証
 *   node scripts/capture-iwasho-hero-6e.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/hp-migration-6e-hero-direct-port");

const VIEWPORTS = [
  { id: "390", width: 390, height: 844 },
  { id: "768", width: 768, height: 1024 },
  { id: "1280", width: 1280, height: 900 },
];

const TIMELINE_MS = [0, 5000, 10000, 15000];

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

      const timelineShots = [];
      let prev = 0;
      for (const ms of TIMELINE_MS) {
        if (ms > prev) await page.waitForTimeout(ms - prev);
        prev = ms;
        const shot = path.join(OUT, `hero-${vp.id}-t${String(ms / 1000).padStart(2, "0")}s.png`);
        await page.screenshot({ path: shot, fullPage: false });
        timelineShots.push(path.relative(ROOT, shot).replace(/\\/g, "/"));
      }

      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);
      const scrollShot = path.join(OUT, `hero-${vp.id}-advantage-scroll.png`);
      await page.screenshot({ path: scrollShot, fullPage: false });

      const audit = await page.evaluate(() => {
        const doc = document.documentElement;
        const hero = document.querySelector(".top-hero");
        const advantage = document.querySelector(".iwasho-home-advantage");
        const videoBg = document.querySelector(".video-background");
        const logoStage = document.querySelector(".logo-stage");
        const ultimateLogo = document.querySelector(".ultimate-logo");
        const m1 = document.querySelector(".hero-msg.m-1");
        return {
          overflowX: doc.scrollWidth > doc.clientWidth + 1,
          bodyOverflow: getComputedStyle(document.body).overflow,
          htmlOverflow: getComputedStyle(document.documentElement).overflow,
          scrollHeight: doc.scrollHeight,
          scrollable: doc.scrollHeight > doc.clientHeight + 10,
          heroHeight: hero ? getComputedStyle(hero).height : null,
          heroOverflow: hero ? getComputedStyle(hero).overflow : null,
          hasTxtBlueGlow: document.querySelectorAll(".txt-blue-glow").length === 2,
          hasUltimateLogoText: !!ultimateLogo?.querySelector(".txt-x"),
          noHeroImages: document.querySelectorAll(".top-hero img").length === 0,
          videoDelay: videoBg ? getComputedStyle(videoBg).animationDelay : null,
          m1Delay: m1 ? getComputedStyle(m1).animationDelay : null,
          logoDelay: logoStage ? getComputedStyle(logoStage).animationDelay : null,
          advantageReachable: advantage ? advantage.getBoundingClientRect().top < window.innerHeight : false,
          footerVisible: document.querySelector(".iwasho-home-footer")?.getBoundingClientRect().top < window.innerHeight,
        };
      });

      results.push({
        viewport: vp.id,
        consoleErrors,
        audit,
        timelineShots,
        scrollShot: path.relative(ROOT, scrollShot).replace(/\\/g, "/"),
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
    report.issues.push(`${r.viewport}: console errors`);
  }
  if (r.audit.bodyOverflow === "hidden" || r.audit.htmlOverflow === "hidden") {
    report.pass = false;
    report.issues.push(`${r.viewport}: body/html overflow hidden`);
  }
  if (!r.audit.scrollable || !r.audit.footerVisible) {
    report.pass = false;
    report.issues.push(`${r.viewport}: scroll to footer failed`);
  }
  if (!r.audit.hasTxtBlueGlow || r.audit.noHeroImages === false) {
    report.pass = false;
    report.issues.push(`${r.viewport}: hero structure not direct port`);
  }
}

fs.writeFileSync(path.join(OUT, "audit.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.pass ? 0 : 1);
