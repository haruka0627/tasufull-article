/**
 * 市場検索 SP CTA 検証（390px / 1280px）
 * node scripts/verify-market-search-sp-cta.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import { finalizeScreenshotRun } from "./lib/finalize-screenshot-run.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const FOLDER_ID = "market-search-sp-cta";
const OUT_DIR = path.join(ROOT, "screenshots", FOLDER_ID);

const VIEWPORTS = [
  { id: "390", width: 390, height: 844, sp: true },
  { id: "1280", width: 1280, height: 900, sp: false },
];

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = await findDevServerBaseUrl({ probePath: "shop-search.html" });
const url = buildLocalPageUrl(base, "shop-search.html", "?keyword=パン");
const browser = await chromium.launch({ headless: true });
const report = { capturedAt: new Date().toISOString(), url, viewports: {}, overall: "PASS" };

for (const vp of VIEWPORTS) {
  const page = await browser.newPage();
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector(".tasful-market-search-card__cart", { timeout: 25000 });

  const metrics = await page.evaluate(() => {
    const card = document.querySelector(".tasful-market-search-card");
    const buttons = [...document.querySelectorAll(".tasful-market-search-card__cart")].filter((btn) => {
      const r = btn.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    const btn = buttons[0];
    const btnInfo = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        h: Math.round(r.height),
        w: Math.round(r.width),
        fontSize: cs.fontSize,
        minH: cs.minHeight,
        whiteSpace: cs.whiteSpace,
        text: el.textContent.trim(),
        singleLine: el.scrollHeight <= el.clientHeight + 2,
      };
    };
    const img = card?.querySelector(".tasful-market-search-card__img img");
    const priceEls = card ? [...card.querySelectorAll(".tasful-market-search-card__price")] : [];
    const priceVisible = priceEls.some((el) => el.getBoundingClientRect().height > 0);
    const title = card?.querySelector(".tasful-market-search-card__title");
    return {
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      ctaCount: buttons.length,
      cta: btnInfo(btn),
      allCtaHeights: buttons.map((b) => Math.round(b.getBoundingClientRect().height)),
      img: img
        ? { w: Math.round(img.getBoundingClientRect().width), h: Math.round(img.getBoundingClientRect().height) }
        : null,
      priceVisible,
      titleVisible: title ? title.getBoundingClientRect().height > 0 : false,
    };
  });

  const checks = [];
  const minH = vp.sp ? 44 : 40;
  checks.push({
    level: metrics.cta && metrics.cta.h >= minH ? "PASS" : "FAIL",
    item: "CTA高さ",
    detail: metrics.cta ? `${metrics.cta.h}px (min ${minH}px)` : "未検出",
  });
  if (vp.sp) {
    checks.push({
      level: metrics.allCtaHeights.every((h) => h >= 44) ? "PASS" : "FAIL",
      item: "全CTA 44px+",
      detail: metrics.allCtaHeights.join(", "),
    });
    checks.push({
      level: metrics.cta?.fontSize === "14px" ? "PASS" : "WARNING",
      item: "font-size",
      detail: metrics.cta?.fontSize,
    });
    checks.push({
      level: metrics.cta?.singleLine ? "PASS" : "FAIL",
      item: "ラベル折れ",
      detail: metrics.cta?.singleLine ? "1行" : "複数行",
    });
  }
  checks.push({
    level: metrics.scrollW <= metrics.innerW ? "PASS" : "FAIL",
    item: "横スクロール",
    detail: `${metrics.scrollW}/${metrics.innerW}`,
  });
  checks.push({
    level: metrics.img && metrics.img.w > 0 && metrics.img.h > 0 ? "PASS" : "FAIL",
    item: "商品画像",
    detail: metrics.img ? `${metrics.img.w}×${metrics.img.h}` : "なし",
  });
  checks.push({
    level: metrics.priceVisible && metrics.titleVisible ? "PASS" : "FAIL",
    item: "価格・タイトル",
    detail: `price=${metrics.priceVisible} title=${metrics.titleVisible}`,
  });

  const grade = checks.some((c) => c.level === "FAIL") ? "FAIL" : "PASS";
  if (grade === "FAIL") report.overall = "FAIL";

  await page.screenshot({ path: path.join(OUT_DIR, `search-${vp.id}.png`), fullPage: true });
  report.viewports[vp.id] = { metrics, checks, grade };
  await page.close();
}

const md = `# 市場検索 CTA 検証

生成: ${report.capturedAt}
総合: **${report.overall}**

${VIEWPORTS.map((vp) => {
  const v = report.viewports[vp.id];
  return `## ${vp.id}px — ${v.grade}\n\n${v.checks.map((c) => `- ${c.level === "PASS" ? "✅" : "❌"} ${c.item}: ${c.detail}`).join("\n")}\n`;
}).join("\n")}
`;

fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(OUT_DIR, "report.md"), md);

await finalizeScreenshotRun(ROOT, FOLDER_ID, {
  title: "市場検索 SP CTA 検証",
  report: {
    capturedAt: report.capturedAt,
    url: report.url,
    overall: report.overall,
    pages: [{ id: "search", label: "検索", verdict: report.overall }],
    cases: Object.entries(report.viewports).flatMap(([vpId, v]) =>
      v.checks.map((c) => ({
        id: `${vpId}-${c.item}`,
        pass: c.level === "PASS",
        label: `${vpId}px ${c.item}`,
        actual: c.detail,
      }))
    ),
  },
  targetPage: "shop-search.html",
  viewports: ["390", "1280"],
  overall: report.overall,
  screenshotCatalog: VIEWPORTS.map((vp) => ({
    file: `search-${vp.id}.png`,
    label: `検索 ${vp.id}px`,
    url: "shop-search.html?keyword=パン",
    viewport: vp.id,
  })),
});

await browser.close();
console.log("OVERALL:", report.overall);
console.log(md);
process.exit(report.overall === "PASS" ? 0 : 1);
