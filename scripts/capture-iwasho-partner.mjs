#!/usr/bin/env node
/**
 * IWASHO Wix partner + gallery section captures
 *   node scripts/capture-iwasho-partner.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/iwasho-partner-wix");

const VIEWPORTS = [
  { id: "390", width: 390, height: 844 },
  { id: "768", width: 768, height: 1024 },
  { id: "1280", width: 1280, height: 900 },
  { id: "1440", width: 1440, height: 900 },
  { id: "1920", width: 1920, height: 900 },
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
      await page.goto(`${base}/iwasho/`, { waitUntil: "networkidle", timeout: 60000 });
      await page.locator(".section-container").scrollIntoViewIfNeeded();
      await page.waitForTimeout(600);

      const audit = await page.evaluate(() => {
        const section = document.querySelector(".iwasho-home-page .section-container");
        const leftCard = document.querySelector(".iwasho-home-page .card-left-bg");
        const rightCard = document.querySelector(".iwasho-home-page .card-right-bg");
        const navyBtn = document.querySelector(".iwasho-home-page .btn-navy");
        const twinCols = document.querySelector(".iwasho-home-page .info-twin-cols");
        const galleryGrid = document.querySelector(".iwasho-home-page .gallery-grid");
        const galleryItems = document.querySelectorAll(".iwasho-home-page .gallery-item");
        const footer = document.querySelector(".iwasho-home-page .footer-wrapper");

        const leftStyle = leftCard ? getComputedStyle(leftCard) : null;
        const rightStyle = rightCard ? getComputedStyle(rightCard) : null;
        const btnStyle = navyBtn ? getComputedStyle(navyBtn) : null;
        const btnText = navyBtn?.textContent?.replace(/\s+/g, " ").trim();
        const btnColor = btnStyle?.color;
        const btnVisible = btnStyle && btnStyle.visibility !== "hidden" && btnStyle.opacity !== "0";

        const sectionRect = section?.getBoundingClientRect();
        const footerRect = footer?.getBoundingClientRect();
        const gapToFooter = sectionRect && footerRect ? Math.round(footerRect.top - sectionRect.bottom) : null;

        return {
          hasSectionContainer: !!section,
          oldDualRemoved: document.querySelectorAll(".iw-dual, .iw-gallery").length === 0,
          twinCols: twinCols ? getComputedStyle(twinCols).gridTemplateColumns : null,
          leftBgPosition: leftStyle?.backgroundPosition,
          rightBgPosition: rightStyle?.backgroundPosition,
          leftBgHasWix: leftStyle?.backgroundImage?.includes("wixstatic"),
          rightBgHasWix: rightStyle?.backgroundImage?.includes("wixstatic"),
          btnHeight: navyBtn ? Math.round(navyBtn.getBoundingClientRect().height) : null,
          btnText,
          btnColor,
          btnVisible,
          galleryCount: galleryItems.length,
          galleryItemHeight: galleryItems[0] ? Math.round(galleryItems[0].getBoundingClientRect().height) : null,
          galleryGap: galleryGrid ? getComputedStyle(galleryGrid).gap : null,
          galleryColumns: galleryGrid ? getComputedStyle(galleryGrid).gridTemplateColumns : null,
          gapToFooter,
          overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        };
      });

      const box = await page.locator(".section-container").boundingBox();
      const shot = path.join(OUT, `page-partner-${vp.id}.png`);
      if (box) {
        await page.screenshot({
          path: shot,
          fullPage: false,
          clip: {
            x: 0,
            y: Math.max(0, Math.floor(box.y)),
            width: vp.width,
            height: Math.ceil(box.height),
          },
        });
      }

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
  if (r.consoleErrors.length) {
    report.pass = false;
    report.issues.push(`${r.viewport}: console errors`);
  }
  if (r.audit.overflowX) {
    report.pass = false;
    report.issues.push(`${r.viewport}: horizontal overflow`);
  }
  if (!r.audit.hasSectionContainer || !r.audit.oldDualRemoved) {
    report.pass = false;
    report.issues.push(`${r.viewport}: not Wix partner section`);
  }
  if (!r.audit.btnText?.includes("パートナー登録はこちら") || !r.audit.btnVisible) {
    report.pass = false;
    report.issues.push(`${r.viewport}: navy CTA not visible`);
  }
  if (!r.audit.leftBgHasWix || !r.audit.rightBgHasWix) {
    report.pass = false;
    report.issues.push(`${r.viewport}: card backgrounds not Wix URLs`);
  }
  if (r.audit.galleryCount !== 5 || r.audit.galleryItemHeight !== 175) {
    report.pass = false;
    report.issues.push(`${r.viewport}: gallery size mismatch`);
  }
  if (["1280", "1440", "1920"].includes(r.viewport) && !r.audit.twinCols?.includes(" ")) {
    report.pass = false;
    report.issues.push(`${r.viewport}: expected 2-column twin cards`);
  }
}

fs.writeFileSync(path.join(OUT, "audit.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.pass ? 0 : 1);
