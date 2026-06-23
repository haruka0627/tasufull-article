#!/usr/bin/env node
/**
 * HP-MIGRATION-6G — Wix INFO section direct port 検証
 *   node scripts/capture-iwasho-info-6g.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/hp-migration-6g-info-section-direct-port");

const VIEWPORTS = [
  { id: "390", width: 390, height: 844 },
  { id: "768", width: 768, height: 1024 },
  { id: "1280", width: 1280, height: 900 },
];

const EXPECTED_LINKS = [
  "/iwasho/services.html",
  "/iwasho/team.html",
  "/iwasho/partners.html",
  "/iwasho/partners.html#partner",
  "/iwasho/about.html",
  "/iwasho/contact.html",
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
        const section = document.querySelector(".info-section");
        if (section) section.scrollIntoView({ block: "start" });
      });
      await page.waitForTimeout(400);

      const shot = path.join(OUT, `info-${vp.id}.png`);
      await page.screenshot({ path: shot, fullPage: false });

      const audit = await page.evaluate((expectedLinks) => {
        const doc = document.documentElement;
        const section = document.querySelector(".info-section");
        const list = document.querySelector(".info-section .info-list");
        const items = document.querySelectorAll(".info-section .info-item");
        const buttons = document.querySelectorAll(".info-section .btn-detail");
        const listStyle = list ? getComputedStyle(list) : null;

        const buttonOverflow = [...buttons].some((btn) => {
          const r = btn.getBoundingClientRect();
          return r.right > doc.clientWidth + 1 || r.left < -1;
        });

        const itemOverflow = [...items].some((item) => {
          const r = item.getBoundingClientRect();
          return r.right > doc.clientWidth + 1 || r.left < -1;
        });

        const hrefs = [...buttons].map((a) => a.getAttribute("href"));

        let verticalStack = false;
        if (items.length >= 2) {
          const rects = [...items].map((el) => el.getBoundingClientRect());
          verticalStack =
            rects[1].top > rects[0].bottom - 8 &&
            rects[items.length - 1].top > rects[items.length - 2].bottom - 8;
        }

        return {
          overflowX: doc.scrollWidth > doc.clientWidth + 1,
          bodyOverflow: getComputedStyle(document.body).overflow,
          htmlOverflow: getComputedStyle(document.documentElement).overflow,
          hasInfoSection: !!section,
          oldInfoRemoved: document.querySelectorAll(".iwasho-home-info").length === 0,
          infoItemCount: items.length,
          simpleItemCount: document.querySelectorAll(".info-section .simple-item").length,
          buttonCount: buttons.length,
          listFlexDirection: listStyle?.flexDirection ?? null,
          verticalStack,
          buttonOverflow,
          itemOverflow,
          hrefs,
          hrefsMatch: JSON.stringify(hrefs) === JSON.stringify(expectedLinks),
          buttonWidth: buttons[0] ? getComputedStyle(buttons[0].parentElement).width : null,
        };
      }, EXPECTED_LINKS);

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
  if (!r.audit.hasInfoSection || !r.audit.oldInfoRemoved) {
    report.pass = false;
    report.issues.push(`${r.viewport}: info section not direct port`);
  }
  if (r.audit.infoItemCount !== 6 || r.audit.simpleItemCount !== 2) {
    report.pass = false;
    report.issues.push(`${r.viewport}: expected 6 info items (2 simple)`);
  }
  if (r.viewport === "1280" && (!r.audit.verticalStack || r.audit.listFlexDirection !== "column")) {
    report.pass = false;
    report.issues.push(`${r.viewport}: expected vertical card stack at 1280px`);
  }
  if (r.viewport === "390" && (r.audit.buttonOverflow || r.audit.itemOverflow)) {
    report.pass = false;
    report.issues.push(`${r.viewport}: buttons/cards overflow viewport`);
  }
  if (!r.audit.hrefsMatch) {
    report.pass = false;
    report.issues.push(`${r.viewport}: link href mismatch — ${JSON.stringify(r.audit.hrefs)}`);
  }
}

fs.writeFileSync(path.join(OUT, "audit.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.pass ? 0 : 1);
