/**
 * 安否サービス登録 — ヘッダー構成・レイアウト確認（1280 / 390）
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "anpi-register-header-layout");
const PORTS = [5173, 5176, 5174, 5199, 5200, 5188, 5502, 5500];

async function findBaseUrl() {
  for (const port of PORTS) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/anpi-register.html`, { method: "HEAD" });
      if (res.ok) return `http://127.0.0.1:${port}`;
    } catch {
      /* next */
    }
  }
  throw new Error("No dev server found");
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = await findBaseUrl();

async function capture(name, viewport) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport });
  await page.goto(`${base}/anpi-register.html`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);

  const metrics = await page.evaluate(() => {
    const header = document.querySelector(".dash-header");
    const headerTitle = document.querySelector(".dash-header__title");
    const pageHead = document.querySelector(".dash-member-page-head");
    const pageTitle = document.querySelector(".dash-member-page-head__title");
    const eyebrow = document.querySelector(".dash-member-page-head__eyebrow");
    const sub = document.querySelector(".dash-member-page-head__sub");
    const firstCard = document.querySelector(".register-card-container");
    const ar = (el) => el?.getBoundingClientRect();
    const subR = ar(sub);
    const cardR = ar(firstCard);
    const titleCs = pageTitle ? getComputedStyle(pageTitle) : null;
    const gap =
      subR && cardR && cardR.top >= subR.bottom
        ? cardR.top - subR.bottom
        : null;
    return {
      vw: window.innerWidth,
      headerHasPageTitle: Boolean(headerTitle?.textContent?.trim()),
      pageTitleText: pageTitle?.textContent?.trim() || "",
      hasEyebrow: Boolean(eyebrow?.textContent?.trim()),
      hasHeaderActions: Boolean(document.querySelector(".dash-header__actions")),
      hasPageHead: Boolean(pageHead),
      titleFontSize: titleCs ? parseFloat(titleCs.fontSize) : null,
      titleFontWeight: titleCs ? parseInt(titleCs.fontWeight, 10) : null,
      subFontSize: sub ? parseFloat(getComputedStyle(sub).fontSize) : null,
      titleToCardGap: gap,
    };
  });

  await page.screenshot({ path: path.join(OUT_DIR, name), fullPage: false });
  await browser.close();
  return metrics;
}

const m1280 = await capture("anpi-register-header-1280.png", { width: 1280, height: 900 });
const m390 = await capture("anpi-register-header-390.png", { width: 390, height: 844 });

const report = {
  base,
  capturedAt: new Date().toISOString(),
  viewports: { m1280, m390 },
  checks: {
    noTitleInHeader1280: !m1280.headerHasPageTitle,
    noTitleInHeader390: !m390.headerHasPageTitle,
    titleInBody1280: m1280.pageTitleText === "安否サービス登録",
    titleInBody390: m390.pageTitleText === "安否サービス登録",
    hasActions1280: m1280.hasHeaderActions,
    hasActions390: m390.hasHeaderActions,
    hasEyebrow1280: m1280.hasEyebrow,
    hasEyebrow390: m390.hasEyebrow,
    titleSize1280: m1280.titleFontSize != null && m1280.titleFontSize >= 28 && m1280.titleFontSize <= 33,
    titleSize390: m390.titleFontSize != null && m390.titleFontSize >= 22 && m390.titleFontSize <= 25,
    titleWeight1280: m1280.titleFontWeight === 800,
    subSize1280: m1280.subFontSize != null && m1280.subFontSize >= 14 && m1280.subFontSize <= 16,
    spacing1280: m1280.titleToCardGap != null && m1280.titleToCardGap >= 28 && m1280.titleToCardGap <= 44,
    spacing390: m390.titleToCardGap != null && m390.titleToCardGap >= 26 && m390.titleToCardGap <= 40,
  },
};

fs.writeFileSync(path.join(OUT_DIR, "layout-report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

const failed = Object.entries(report.checks).filter(([, ok]) => !ok);
if (failed.length) {
  console.error("FAIL:", failed.map(([k]) => k).join(", "));
  process.exit(1);
}
console.log("PASS: anpi-register header layout");
