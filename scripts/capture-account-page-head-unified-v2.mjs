/**
 * アカウント系・安否系・Connect系 — PCレイアウト統一確認（v2）
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "screenshots", "account-page-head-unified-v2");
const PORTS = [5173, 5176, 5174, 5199, 5200, 5188, 5502, 5500];

const PAGES = [
  { file: "profile-settings.html", title: "マイページ" },
  { file: "payment-settings.html", title: "支払い方法・口座管理", compare: true },
  { file: "notification-settings.html", title: "通知設定" },
  { file: "anpi-register.html", title: "安否サービス登録", compare: true },
  { file: "anpi-dashboard.html", title: "安否ダッシュボード" },
  { file: "anpi-notifications.html", title: "安否通知センター" },
  { file: "sales-fees.html", title: "売上・手数料管理" },
  { file: "listing-management.html", title: "掲載管理" },
];

const VIEWPORTS = [
  { key: "1280", width: 1280, height: 900 },
  { key: "1024", width: 1024, height: 900 },
  { key: "390", width: 390, height: 844 },
];

async function findBaseUrl() {
  for (const port of PORTS) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/payment-settings.html`, { method: "HEAD" });
      if (res.ok) return `http://127.0.0.1:${port}`;
    } catch {
      /* next */
    }
  }
  throw new Error("No dev server found");
}

function fixCssMime(page) {
  return page.route("**/*.css*", async (route) => {
    const response = await route.fetch();
    const headers = { ...response.headers(), "content-type": "text/css; charset=utf-8" };
    await route.fulfill({ response, headers, body: await response.body() });
  });
}

async function auditPage(base, { file, title }, viewport) {
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
  await fixCssMime(page);
  await page.goto(`${base}/${file}?v=${Date.now()}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);

  const metrics = await page.evaluate((expectedTitle) => {
    const headerTitle = document.querySelector(".dash-header__title");
    const headerHeading = document.querySelector(".dash-header__heading");
    const pageHead = document.querySelector(".dash-member-page-head");
    const pageTitle = document.querySelector(".dash-member-page-head__title");
    const pageSub = document.querySelector(".dash-member-page-head__sub");
    const content = [...document.querySelectorAll(
      ".dash-card, .anpi-register-form, .anpi-notifications-summary, .anpi-dash-register-banner, .tasu-pc-profile-form, .sf-stats, .lm-stats"
    )].find((el) => !el.hidden && el.getBoundingClientRect().height > 0);
    const titleCs = pageTitle ? getComputedStyle(pageTitle) : null;
    const subCs = pageSub ? getComputedStyle(pageSub) : null;
    const contentCs = content ? getComputedStyle(content) : null;
    const mainEl =
      document.querySelector(".anpi-register-main") ||
      document.querySelector(".anpi-notifications-main") ||
      document.querySelector("main.dash-content");
    const mainCs = mainEl ? getComputedStyle(mainEl) : null;
    const ar = (el) => el?.getBoundingClientRect();
    const headR = ar(pageHead);
    const subR = ar(pageSub);
    const titleR = ar(pageTitle);
    const contentR = ar(content);
    return {
      headerHasTitle: Boolean(headerTitle?.textContent?.trim()),
      headerHasHeading: Boolean(headerHeading),
      pageHeadTag: pageHead?.tagName?.toLowerCase() || null,
      pageTitleText: pageTitle?.textContent?.trim() || "",
      hasPageSub: Boolean(pageSub?.textContent?.trim()),
      titleFontSize: titleCs ? parseFloat(titleCs.fontSize) : null,
      titleFontWeight: titleCs ? parseInt(titleCs.fontWeight, 10) : null,
      titleToSubGap: titleR && subR ? subR.top - titleR.bottom : null,
      subFontSize: subCs ? parseFloat(subCs.fontSize) : null,
      subLineHeight: subCs ? parseFloat(subCs.lineHeight) : null,
      subMarginBottom: subCs ? parseFloat(subCs.marginBottom) : null,
      subBorderBottom: subCs ? subCs.borderBottomWidth : null,
      headToContentGap:
        headR && contentR && contentR.top >= headR.bottom ? contentR.top - headR.bottom : null,
      contentMaxWidth: contentCs ? parseFloat(contentCs.maxWidth) : null,
      mainMaxWidth: mainCs ? parseFloat(mainCs.maxWidth) : null,
      expectedTitle,
    };
  }, title);

  const slug = file.replace(".html", "");
  await page.screenshot({
    path: path.join(OUT_DIR, `${slug}-${viewport.key}.png`),
    fullPage: false,
  });
    });
  return metrics;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = await findBaseUrl();

const results = {};
for (const p of PAGES) {
  results[p.file] = {};
  for (const vp of VIEWPORTS) {
    results[p.file][vp.key] = await auditPage(base, p, vp);
  }
}

const CONTENT_WIDTH_PAGES = new Set([
  "profile-settings.html",
  "payment-settings.html",
  "notification-settings.html",
  "anpi-register.html",
  "anpi-notifications.html",
]);

function contentWidthOk(file, r) {
  if (!CONTENT_WIDTH_PAGES.has(file)) return true;
  const w = r.contentMaxWidth || r.mainMaxWidth;
  if (w == null || w === 0) return false;
  return w >= 1080 && w <= 1120;
}

const checks = {};
for (const p of PAGES) {
  const r1280 = results[p.file]["1280"];
  const r1024 = results[p.file]["1024"];
  const r390 = results[p.file]["390"];
  checks[p.file] = {
    noHeaderTitle: !r1280.headerHasTitle && !r1280.headerHasHeading,
    pageHeadSection: r1280.pageHeadTag === "section",
    bodyTitle: r1280.pageTitleText === p.title,
    pcTitle42: r1280.titleFontSize >= 40 && r1280.titleFontSize <= 44,
    pcTitleWeight: r1280.titleFontWeight >= 800,
    pcSub15: r1280.subFontSize >= 14.5 && r1280.subFontSize <= 16,
    pcTitleSubGap: r1280.titleToSubGap >= 10 && r1280.titleToSubGap <= 14,
    pcSubContentGap: r1280.subMarginBottom >= 36 && r1280.subMarginBottom <= 44,
    pcHasDivider: parseFloat(r1280.subBorderBottom || 0) >= 1,
    tabletUnchanged: r1024.titleFontSize >= 28 && r1024.titleFontSize <= 32,
    spUnchanged: r390.titleFontSize >= 22 && r390.titleFontSize <= 26,
    pcContent1100: contentWidthOk(p.file, r1280),
  };
}

const payment = results["payment-settings.html"]["1280"];
const anpiReg = results["anpi-register.html"]["1280"];
const comparison = {
  titleFontSizeDelta: Math.abs((payment.titleFontSize || 0) - (anpiReg.titleFontSize || 0)),
  subFontSizeDelta: Math.abs((payment.subFontSize || 0) - (anpiReg.subFontSize || 0)),
  titleSubGapDelta: Math.abs((payment.titleToSubGap || 0) - (anpiReg.titleToSubGap || 0)),
  subMarginDelta: Math.abs((payment.subMarginBottom || 0) - (anpiReg.subMarginBottom || 0)),
  headGapDelta: Math.abs((payment.headToContentGap || 0) - (anpiReg.headToContentGap || 0)),
};

const report = {
  base,
  capturedAt: new Date().toISOString(),
  viewports: VIEWPORTS.map((v) => v.key),
  results,
  checks,
  comparison,
  comparisonPass:
    comparison.titleFontSizeDelta <= 1 &&
    comparison.subFontSizeDelta <= 1 &&
    comparison.titleSubGapDelta <= 2 &&
    comparison.subMarginDelta <= 2 &&
    comparison.headGapDelta <= 4,
};

fs.writeFileSync(path.join(OUT_DIR, "unified-report.json"), JSON.stringify(report, null, 2));

const md = [
  "# Account page head unified v2",
  "",
  `Captured: ${report.capturedAt}`,
  "",
  "## Payment vs Anpi-register (1280px)",
  "",
  "| Metric | payment-settings | anpi-register |",
  "|--------|------------------|---------------|",
  `| Title size | ${payment.titleFontSize}px | ${anpiReg.titleFontSize}px |`,
  `| Sub size | ${payment.subFontSize}px | ${anpiReg.subFontSize}px |`,
  `| Title→Sub gap | ${payment.titleToSubGap}px | ${anpiReg.titleToSubGap}px |`,
  `| Sub margin | ${payment.subMarginBottom}px | ${anpiReg.subMarginBottom}px |`,
  `| Head→Content | ${payment.headToContentGap}px | ${anpiReg.headToContentGap}px |`,
  "",
  `Comparison: ${report.comparisonPass ? "PASS" : "FAIL"}`,
  "",
].join("\n");
fs.writeFileSync(path.join(OUT_DIR, "unified-report.md"), md);

console.log(JSON.stringify(report, null, 2));

const failed = Object.entries(checks).flatMap(([file, c]) =>
  Object.entries(c)
    .filter(([, ok]) => !ok)
    .map(([k]) => `${file}:${k}`)
);
if (!report.comparisonPass) failed.push("comparison:payment-vs-anpi-register");
if (failed.length) {
  console.error("FAIL:", [...new Set(failed)].join(", "));
  await closeAllBrowsers();
  process.exit(1);
}
console.log("PASS: account page heads unified v2");
