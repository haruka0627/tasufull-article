#!/usr/bin/env node
/**
 * IWASHO header upgrade — 390 / 768 / 1280 スクショ
 *   node scripts/capture-iwasho-header-upgrade.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/iwasho-header-upgrade");

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
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
    page.on("pageerror", (e) => consoleErrors.push(String(e.message || e)));

    try {
      await page.goto(`${base}/iwasho/`, { waitUntil: "networkidle", timeout: 60000 });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(300);

      if (vp.id !== "1280") {
        await page.click("[data-iw-menu-toggle]");
        await page.waitForTimeout(200);
      }

      const audit = await page.evaluate(() => {
        const header = document.querySelector(".iw-site-header");
        const brand = document.querySelector(".iw-site-header__brand");
        const nav = document.querySelector(".iw-site-header__nav");
        const actions = document.querySelector(".iw-site-header__actions");
        const inner = document.querySelector(".iw-site-header__inner");
        const tagline = document.querySelector(".iw-site-header__tagline");
        const primary = document.querySelector(".iw-site-header__btn--primary");
        const ctaLabel = document.querySelector(".iw-site-header__cta-label");
        const btnArrow = document.querySelector(".iw-site-header__btn-arrow");
        const navRect = nav?.getBoundingClientRect();
        const navCenterX = navRect ? navRect.left + navRect.width / 2 : null;
        const viewportCenterX = window.innerWidth / 2;
        const brandRect = brand?.getBoundingClientRect();
        return {
          headerHeight: header ? Math.round(header.getBoundingClientRect().height) : null,
          innerPaddingLeft: inner ? getComputedStyle(inner).paddingLeft : null,
          brandLeft: brandRect ? Math.round(brandRect.left) : null,
          navCenterX: navCenterX ? Math.round(navCenterX) : null,
          viewportCenterX: Math.round(viewportCenterX),
          navCenterOffset: navCenterX != null ? Math.round(Math.abs(navCenterX - viewportCenterX)) : null,
          actionsRight: actions ? Math.round(actions.getBoundingClientRect().right) : null,
          taglineText: tagline?.textContent?.trim(),
          ctaLabelText: ctaLabel?.textContent?.trim() || null,
          btnText: primary?.textContent?.replace(/\s+/g, " ").trim(),
          primaryWidth: primary ? Math.round(primary.getBoundingClientRect().width) : null,
          primaryHeight: primary ? Math.round(primary.getBoundingClientRect().height) : null,
          primaryFontSize: primary ? getComputedStyle(primary).fontSize : null,
          primaryFontWeight: primary ? getComputedStyle(primary).fontWeight : null,
          primaryBg: primary ? getComputedStyle(primary).backgroundColor : null,
          primaryRadius: primary ? getComputedStyle(primary).borderRadius : null,
          hasUserIcon: false,
          hasArrow: !!btnArrow,
          hasPartnerLabel: !!ctaLabel,
          navGap: nav ? getComputedStyle(nav).gap : null,
        };
      });

      const topShot = path.join(OUT, `header-cta-${vp.id}.png`);
      if (vp.id === "1280") {
        await page.screenshot({
          path: topShot,
          fullPage: false,
          clip: { x: 0, y: 0, width: vp.width, height: 80 },
        });
      } else {
        await page.locator(".iw-site-header__btn--primary").screenshot({ path: topShot });
      }

      results.push({
        viewport: vp.id,
        consoleErrors,
        audit,
        screenshot: path.relative(ROOT, topShot).replace(/\\/g, "/"),
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
  if (r.consoleErrors.length) {
    report.pass = false;
    report.issues.push(`${r.viewport}: console errors`);
  }
  if (r.viewport === "1280") {
    if (r.audit.primaryWidth !== 200 || r.audit.primaryHeight !== 48) {
      report.pass = false;
      report.issues.push(`${r.viewport}: btn size mismatch (${r.audit.primaryWidth}x${r.audit.primaryHeight})`);
    }
  } else if (r.audit.primaryHeight !== 48) {
    report.pass = false;
    report.issues.push(`${r.viewport}: btn height mismatch (${r.audit.primaryHeight})`);
  }
  if (r.audit.hasPartnerLabel) {
    report.pass = false;
    report.issues.push(`${r.viewport}: PARTNER label still present`);
  }
  if (!r.audit.hasArrow || !r.audit.btnText?.includes("協力パートナー募集")) {
    report.pass = false;
    report.issues.push(`${r.viewport}: btn text mismatch`);
  }
  if (r.viewport === "1280") {
    if (r.audit.headerHeight !== 80) {
      report.pass = false;
      report.issues.push(`${r.viewport}: header height ${r.audit.headerHeight}`);
    }
    if (r.audit.navCenterOffset > 4) {
      report.pass = false;
      report.issues.push(`${r.viewport}: nav off center by ${r.audit.navCenterOffset}px`);
    }
    if (!r.audit.taglineText?.includes("現場をつなぐ")) {
      report.pass = false;
      report.issues.push(`${r.viewport}: tagline text mismatch`);
    }
  }
}

fs.writeFileSync(path.join(OUT, "audit.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.pass ? 0 : 1);
