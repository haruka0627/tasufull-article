#!/usr/bin/env node
/**
 * HP-MIGRATION-6H — Wix FOOTER direct port 検証
 *   node scripts/capture-iwasho-footer-6h.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/hp-migration-6h-footer-direct-port");

const VIEWPORTS = [
  { id: "390", width: 390, height: 844 },
  { id: "768", width: 768, height: 1024 },
  { id: "1280", width: 1280, height: 900 },
  { id: "1440", width: 1440, height: 900 },
  { id: "1920", width: 1920, height: 900 },
];

const EXPECTED_LINKS = [
  "/iwasho/",
  "/iwasho/about.html",
  "/iwasho/team.html",
  "/iwasho/services.html",
  "/iwasho/partners.html",
  "/iwasho/contact.html",
  "/iwasho/terms.html",
  "/iwasho/privacy.html",
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
        const footer = document.querySelector(".modern-footer");
        if (footer) footer.scrollIntoView({ block: "end" });
      });
      await page.waitForTimeout(400);

      const shot = path.join(OUT, `footer-${vp.id}.png`);
      await page.screenshot({ path: shot, fullPage: false });

      const audit = await page.evaluate((expectedLinks) => {
        const doc = document.documentElement;
        const footer = document.querySelector(".modern-footer");
        const main = document.querySelector(".modern-footer .footer-main");
        const mainStyle = main ? getComputedStyle(main) : null;
        const links = document.querySelectorAll(".modern-footer .link-list a");
        const hrefs = [...links].map((a) => a.getAttribute("href"));

        const footerRect = footer?.getBoundingClientRect();
        const footerOverflow =
          footerRect && (footerRect.right > doc.clientWidth + 1 || footerRect.left < -1);

        const brand = document.querySelector(".modern-footer .footer-brand");
        const nav = document.querySelector(".modern-footer .footer-nav");
        const brandRect = brand?.getBoundingClientRect();
        const navRect = nav?.getBoundingClientRect();

        let twoColumn = false;
        if (brandRect && navRect && mainStyle?.flexDirection === "row") {
          twoColumn = navRect.left >= brandRect.right - 20;
        }

        return {
          overflowX: doc.scrollWidth > doc.clientWidth + 1,
          bodyOverflow: getComputedStyle(document.body).overflow,
          htmlOverflow: getComputedStyle(document.documentElement).overflow,
          hasModernFooter: !!footer,
          oldFooterRemoved:
            document.querySelectorAll(".iw-site-footer, .iwasho-home-footer").length === 0,
          hasFooterInner: !!document.querySelector(".modern-footer .footer-inner"),
          hasFooterBottom: !!document.querySelector(".modern-footer .footer-bottom"),
          linkCount: links.length,
          hrefs,
          hrefsMatch: JSON.stringify(hrefs) === JSON.stringify(expectedLinks),
          companyName: document.querySelector(".modern-footer .name")?.textContent?.trim(),
          footerMainFlexDirection: mainStyle?.flexDirection ?? null,
          twoColumn,
          footerOverflow,
          logoText: document.querySelector(".modern-footer .footer-logo")?.textContent?.replace(/\s+/g, " ").trim(),
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
  if (r.audit.overflowX || r.audit.footerOverflow) {
    report.pass = false;
    report.issues.push(`${r.viewport}: horizontal overflow`);
  }
  if (r.consoleErrors.length) {
    report.pass = false;
    report.issues.push(`${r.viewport}: console errors — ${r.consoleErrors.join("; ")}`);
  }
  if (!r.audit.hasModernFooter || !r.audit.oldFooterRemoved) {
    report.pass = false;
    report.issues.push(`${r.viewport}: footer not direct port`);
  }
  if (r.audit.linkCount !== 8 || !r.audit.hrefsMatch) {
    report.pass = false;
    report.issues.push(`${r.viewport}: link href mismatch — ${JSON.stringify(r.audit.hrefs)}`);
  }
  if (r.audit.companyName !== "IWASHO合同会社") {
    report.pass = false;
    report.issues.push(`${r.viewport}: company info text mismatch`);
  }
  if (["1280", "1440", "1920"].includes(r.viewport) && (!r.audit.twoColumn || r.audit.footerMainFlexDirection !== "row")) {
    report.pass = false;
    report.issues.push(`${r.viewport}: expected 2-column PC layout`);
  }
  if (r.viewport === "390" && r.audit.footerMainFlexDirection !== "column") {
    report.pass = false;
    report.issues.push(`${r.viewport}: expected stacked SP layout`);
  }
}

fs.writeFileSync(path.join(OUT, "audit.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.pass ? 0 : 1);
