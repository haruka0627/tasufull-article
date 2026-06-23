#!/usr/bin/env node
/**
 * IWASHO Wix footer direct port 検証
 *   node scripts/capture-iwasho-footer-wix.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/iwasho-footer-wix");

const VIEWPORTS = [
  { id: "390", width: 390, height: 844 },
  { id: "768", width: 768, height: 1024 },
  { id: "1280", width: 1280, height: 900 },
  { id: "1440", width: 1440, height: 900 },
  { id: "1920", width: 1920, height: 900 },
];

const EXPECTED_COLS = ["IWASHO合同会社", "事業内容", "対応業務", "パートナー募集", "お問い合わせ"];

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
        const footer = document.querySelector(".footer-wrapper");
        if (footer) footer.scrollIntoView({ block: "end" });
      });
      await page.waitForTimeout(400);

      const shot = path.join(OUT, `footer-${vp.id}.png`);
      await page.screenshot({ path: shot, fullPage: false });

      const audit = await page.evaluate((expectedCols) => {
        const doc = document.documentElement;
        const wrapper = document.querySelector(".iwasho-home-page .footer-wrapper");
        const inner = document.querySelector(".iwasho-home-page .footer-wrapper .footer-inner");
        const innerStyle = inner ? getComputedStyle(inner) : null;
        const cols = [...document.querySelectorAll(".iwasho-home-page .footer-wrapper .footer-col")];
        const titles = cols.map((c) => c.querySelector(".footer-col-title")?.textContent?.trim());
        const snsCount = document.querySelectorAll(".iwasho-home-page .footer-wrapper .sns-link").length;
        const contactBtn = document.querySelector(".iwasho-home-page .footer-wrapper .contact-btn");
        const copyright = document.querySelector(".iwasho-home-page .footer-wrapper .copyright")?.textContent?.trim();

        const wrapperRect = wrapper?.getBoundingClientRect();
        const footerOverflow =
          wrapperRect && (wrapperRect.right > doc.clientWidth + 1 || wrapperRect.left < -1);

        const bg = wrapper ? getComputedStyle(wrapper).backgroundImage : null;

        let fiveColumn = false;
        if (cols.length === 5 && innerStyle?.flexDirection === "row" && cols[0] && cols[4]) {
          const r0 = cols[0].getBoundingClientRect();
          const r4 = cols[4].getBoundingClientRect();
          fiveColumn = r4.left > r0.right - 40;
        }

        return {
          overflowX: doc.scrollWidth > doc.clientWidth + 1,
          hasFooterWrapper: !!wrapper,
          modernFooterRemoved: document.querySelectorAll(".modern-footer, .iw-site-footer").length === 0,
          colCount: cols.length,
          titles,
          titlesMatch: JSON.stringify(titles) === JSON.stringify(expectedCols),
          snsCount,
          hasContactBtn: !!contactBtn,
          contactBtnText: contactBtn?.textContent?.replace(/\s+/g, " ").trim(),
          copyright,
          innerFlexDirection: innerStyle?.flexDirection ?? null,
          fiveColumn,
          footerOverflow,
          hasGradientBg: bg?.includes("linear-gradient"),
        };
      }, EXPECTED_COLS);

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
  if (!r.audit.hasFooterWrapper || !r.audit.modernFooterRemoved) {
    report.pass = false;
    report.issues.push(`${r.viewport}: footer not Wix direct port`);
  }
  if (r.audit.colCount !== 5 || !r.audit.titlesMatch) {
    report.pass = false;
    report.issues.push(`${r.viewport}: column mismatch — ${JSON.stringify(r.audit.titles)}`);
  }
  if (r.audit.snsCount !== 3 || !r.audit.hasContactBtn) {
    report.pass = false;
    report.issues.push(`${r.viewport}: SNS/contact missing`);
  }
  if (!r.audit.copyright?.includes("2025 IWASHO LLC")) {
    report.pass = false;
    report.issues.push(`${r.viewport}: copyright mismatch`);
  }
  if (["1280", "1440", "1920"].includes(r.viewport) && (!r.audit.fiveColumn || r.audit.innerFlexDirection !== "row")) {
    report.pass = false;
    report.issues.push(`${r.viewport}: expected 5-column PC layout`);
  }
  if (["390", "768"].includes(r.viewport) && r.audit.innerFlexDirection !== "column") {
    report.pass = false;
    report.issues.push(`${r.viewport}: expected stacked layout`);
  }
}

fs.writeFileSync(path.join(OUT, "audit.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.pass ? 0 : 1);
