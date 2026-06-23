#!/usr/bin/env node
/**
 * HP-MIGRATION-6B — IWASHO TOP hero 検証キャプチャ
 *   node scripts/capture-iwasho-hero-6b.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/hp-migration-6b-iwasho-hero");

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
      for (const ms of TIMELINE_MS) {
        if (ms > 0) await page.waitForTimeout(ms - (timelineShots.length ? TIMELINE_MS[timelineShots.length - 1] : 0));
        const shot = path.join(OUT, `hero-${vp.id}-t${String(ms / 1000).padStart(2, "0")}s.png`);
        await page.screenshot({ path: shot, fullPage: false });
        timelineShots.push(path.relative(ROOT, shot).replace(/\\/g, "/"));
      }

      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(400);
      const footShot = path.join(OUT, `hero-${vp.id}-footer-scroll.png`);
      await page.screenshot({ path: footShot, fullPage: false });

      const audit = await page.evaluate(() => {
        const doc = document.documentElement;
        const hero = document.querySelector(".top-hero");
        const header = document.querySelector(".custom-header");
        const advantage = document.querySelector(".iwasho-home-advantage");
        const videoBg = document.querySelector(".top-hero .video-background");
        const logoStage = document.querySelector(".top-hero .logo-stage");
        const msgs = [...document.querySelectorAll(".top-hero .hero-msg")];
        return {
          overflowX: doc.scrollWidth > doc.clientWidth + 1,
          scrollHeight: doc.scrollHeight,
          scrollable: doc.scrollHeight > doc.clientHeight + 10,
          bodyOverflow: getComputedStyle(document.body).overflow,
          htmlOverflow: getComputedStyle(document.documentElement).overflow,
          headerFixed: header ? getComputedStyle(header).position === "fixed" : false,
          headerHeight: header?.getBoundingClientRect().height ?? null,
          heroOverflow: hero ? getComputedStyle(hero).overflow : null,
          heroMinHeight: hero ? getComputedStyle(hero).minHeight : null,
          hasTopHero: !!hero,
          hasVideoBg: !!videoBg,
          hasStars: !!document.querySelector(".top-hero .stars"),
          hasNebula: !!document.querySelector(".top-hero .nebula"),
          hasViewport: !!document.querySelector(".top-hero .viewport"),
          hasTextStage: !!document.querySelector(".top-hero .text-stage"),
          msgCount: msgs.length,
          hasLogoStage: !!logoStage,
          hasUltimateLogo: !!document.querySelector(".top-hero .ultimate-logo"),
          hasFlare: !!document.querySelector(".top-hero .flare"),
          videoBgVisible: videoBg?.classList.contains("is-visible") ?? false,
          logoVisible: logoStage?.classList.contains("is-visible") ?? false,
          visibleMsgCount: msgs.filter((m) => m.classList.contains("is-visible")).length,
          advantageTop: advantage?.getBoundingClientRect().top ?? null,
          footerVisibleAfterScroll: !!document.querySelector(".iwasho-home-footer")?.getBoundingClientRect().top &&
            document.querySelector(".iwasho-home-footer").getBoundingClientRect().top < window.innerHeight,
        };
      });

      results.push({
        viewport: vp.id,
        consoleErrors,
        audit,
        timelineShots,
        footerShot: path.relative(ROOT, footShot).replace(/\\/g, "/"),
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
  if (r.audit.bodyOverflow === "hidden" || r.audit.htmlOverflow === "hidden") {
    report.pass = false;
    report.issues.push(`${r.viewport}: body/html overflow hidden`);
  }
  if (!r.audit.hasTopHero || r.audit.msgCount !== 3) {
    report.pass = false;
    report.issues.push(`${r.viewport}: top-hero structure incomplete`);
  }
  if (!r.audit.videoBgVisible || !r.audit.logoVisible) {
    report.pass = false;
    report.issues.push(`${r.viewport}: video/logo not visible at 15s`);
  }
  if (!r.audit.scrollable || !r.audit.footerVisibleAfterScroll) {
    report.pass = false;
    report.issues.push(`${r.viewport}: scroll to footer failed`);
  }
  if (r.audit.heroOverflow !== "hidden") {
    report.issues.push(`${r.viewport}: hero overflow not hidden (warn)`);
  }
}

fs.writeFileSync(path.join(OUT, "audit.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.pass ? 0 : 1);
