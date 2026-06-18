/**
 * アカウント系ページ — 統一ページ見出し確認
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "account-page-head-unified");
const PORTS = [5173, 5176, 5174, 5199, 5200, 5188, 5502, 5500];

const PAGES = [
  { file: "profile-settings.html", title: "マイページ" },
  { file: "payment-settings.html", title: "支払い方法・口座管理" },
  { file: "notification-settings.html", title: "通知設定" },
  { file: "anpi-register.html", title: "安否サービス登録" },
  { file: "anpi-dashboard.html", title: "安否ダッシュボード" },
  { file: "anpi-notifications.html", title: "安否通知センター" },
];

async function findBaseUrl() {
  for (const port of PORTS) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/profile-settings.html`, { method: "HEAD" });
      if (res.ok) return `http://127.0.0.1:${port}`;
    } catch {
      /* next */
    }
  }
  throw new Error("No dev server found");
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = await findBaseUrl();

async function auditPage({ file, title }, viewport) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport });
  await page.goto(`${base}/${file}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);

  const metrics = await page.evaluate((expectedTitle) => {
    const headerTitle = document.querySelector(".dash-header__title");
    const pageTitle = document.querySelector(".dash-member-page-head__title");
    const pageSub = document.querySelector(".dash-member-page-head__sub");
    const content = [...document.querySelectorAll(
      ".dash-card, .anpi-register-form, .anpi-notifications-summary, .anpi-dash-register-banner, .tasu-pc-profile-form"
    )].find((el) => !el.hidden && el.getBoundingClientRect().height > 0);
    const pageHead = document.querySelector(".dash-member-page-head");
    const titleCs = pageTitle ? getComputedStyle(pageTitle) : null;
    const subCs = pageSub ? getComputedStyle(pageSub) : null;
    const ar = (el) => el?.getBoundingClientRect();
    const headR = ar(pageHead);
    const contentR = ar(content);
    return {
      headerHasTitle: Boolean(headerTitle?.textContent?.trim()),
      pageTitleText: pageTitle?.textContent?.trim() || "",
      hasPageSub: Boolean(pageSub?.textContent?.trim()),
      titleFontSize: titleCs ? parseFloat(titleCs.fontSize) : null,
      titleFontWeight: titleCs ? parseInt(titleCs.fontWeight, 10) : null,
      subFontSize: subCs ? parseFloat(subCs.fontSize) : null,
      subMarginBottom: subCs ? parseFloat(subCs.marginBottom) : null,
      headToContentGap:
        headR && contentR && contentR.top >= headR.bottom ? contentR.top - headR.bottom : null,
      expectedTitle,
    };
  }, title);

  const slug = file.replace(".html", "");
  await page.screenshot({
    path: path.join(OUT_DIR, `${slug}-${viewport.width}.png`),
    fullPage: false,
  });
  await browser.close();
  return metrics;
}

const results = {};
for (const p of PAGES) {
  results[p.file] = {
    m1280: await auditPage(p, { width: 1280, height: 900 }),
    m390: await auditPage(p, { width: 390, height: 844 }),
  };
}

const checks = {};
for (const p of PAGES) {
  const r = results[p.file].m1280;
  const key = p.file;
  checks[key] = {
    noHeaderTitle: !r.headerHasTitle,
    bodyTitle: r.pageTitleText === p.title,
    titleSize: r.titleFontSize >= 28 && r.titleFontSize <= 33,
    titleWeight: r.titleFontWeight >= 700,
    subSize: r.subFontSize >= 14 && r.subFontSize <= 16,
    subMargin: r.subMarginBottom >= 28 && r.subMarginBottom <= 38,
    headGap: r.headToContentGap != null && r.headToContentGap >= 0 && r.headToContentGap <= 24,
  };
}

const report = { base, capturedAt: new Date().toISOString(), results, checks };
fs.writeFileSync(path.join(OUT_DIR, "unified-report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

const failed = Object.entries(checks).flatMap(([file, c]) =>
  Object.entries(c)
    .filter(([, ok]) => !ok)
    .map(([k]) => `${file}:${k}`)
);
if (failed.length) {
  console.error("FAIL:", failed.join(", "));
  process.exit(1);
}
console.log("PASS: account page heads unified");
