#!/usr/bin/env node
/**
 * shop-products.html 情報設計（サービス→口コミ→おすすめ→商品一覧）検証 + スクショ
 *   node scripts/capture-shop-products-ia-reorder.mjs [--phase=before|after]
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const phaseArg = process.argv.find((a) => a.startsWith("--phase="));
const phase = phaseArg?.split("=")[1] || "after";
const OUT = path.join(root, "screenshots", "shop-products-ia-reorder", phase);
fs.mkdirSync(OUT, { recursive: true });

const SHOP_ID = "demo-shop-haru-cafe";
const VIEWPORTS = [
  { label: "390", width: 390, height: 844 },
  { label: "1280", width: 1280, height: 900 },
];

const EXPECTED_ORDER = [
  "[data-shop-products-hero]",
  "[data-shop-products-services]",
  "[data-shop-products-reviews]",
  "[data-shop-products-recommended]",
  "[data-shop-products-title]",
  "[data-shop-products-grid]",
  "[data-shop-products-more]",
];

const base = await findDevServerBaseUrl({ probePath: "shop-products.html" });
const url = buildLocalPageUrl(base, `shop-products.html?id=${encodeURIComponent(SHOP_ID)}`);

await withPlaywrightBrowser(async (browser) => {const report = {
  generatedAt: new Date().toISOString(),
  phase,
  url,
  overall: "PASS",
  viewports: [],
};

for (const vp of VIEWPORTS) {
  const vpReport = { label: vp.label, verdict: "PASS", issues: [], order: [], shots: [], ctas: {} };
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(2500);

    const audit = await page.evaluate((selectors) => {
      const doc = document.documentElement;
      const body = document.body;
      const order = selectors
        .map((sel) => {
          const el = document.querySelector(sel);
          if (!el) return { sel, top: null, visible: false };
          const r = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          return {
            sel,
            top: Math.round(r.top + window.scrollY),
            visible: r.height > 0 && style.display !== "none" && style.visibility !== "hidden",
          };
        })
        .filter((x) => x.visible && x.top != null);

      const heroTop = document.querySelector("[data-shop-products-hero]")?.getBoundingClientRect().top ?? 0;
      const servicesTop = document.querySelector("[data-shop-products-services]")?.getBoundingClientRect().top ?? 0;
      const gridTop = document.querySelector("[data-shop-products-grid]")?.getBoundingClientRect().top ?? 0;
      const titleTop = document.querySelector("[data-shop-products-title]")?.getBoundingClientRect().top ?? 0;

      const detailBtn = document.querySelector(".shop-products-detail-btn");
      const productLink = document.querySelector(".shop-products-card__link");
      const moreBtn = document.querySelector("[data-shop-products-more]");
      const inquiryLink = document.querySelector(
        ".shop-products-service--inquiry a, [data-shop-products-services] a[href*='chat']"
      );

      return {
        scrollW: Math.max(doc.scrollWidth, body.scrollWidth),
        clientW: doc.clientWidth,
        order,
        servicesAboveGrid: servicesTop > 0 && gridTop > 0 && servicesTop < gridTop,
        servicesAboveTitle: servicesTop > 0 && titleTop > 0 && servicesTop < titleTop,
        heroAboveServices: heroTop < servicesTop,
        serviceTitles: [...document.querySelectorAll(".shop-products-service__title")].map((el) =>
          el.textContent?.trim()
        ),
        ctas: {
          detailHref: detailBtn?.getAttribute("href") || "",
          productHref: productLink?.getAttribute("href") || "",
          moreVisible: moreBtn ? !moreBtn.closest("[hidden]") : false,
          inquiryHref: inquiryLink?.getAttribute("href") || "",
        },
      };
    }, EXPECTED_ORDER);

    vpReport.order = audit.order.map((o) => o.sel.replace("[data-shop-products-", "").replace("]", ""));
    vpReport.ctas = audit.ctas;

    if (audit.scrollW > audit.clientW + 2) {
      vpReport.issues.push(`横スクロール ${audit.scrollW}px > ${audit.clientW}px`);
    }
    if (!audit.servicesAboveGrid) vpReport.issues.push("サービスが商品グリッドより下");
    if (!audit.servicesAboveTitle) vpReport.issues.push("サービスが商品一覧見出しより下");
    if (!audit.heroAboveServices) vpReport.issues.push("店舗概要がサービスより下");

    const sorted = [...audit.order].sort((a, b) => a.top - b.top);
    for (let i = 1; i < EXPECTED_ORDER.length; i++) {
      const prev = sorted.find((o) => o.sel === EXPECTED_ORDER[i - 1]);
      const curr = sorted.find((o) => o.sel === EXPECTED_ORDER[i]);
      if (!prev || !curr) continue;
      if (curr.top < prev.top) {
        vpReport.issues.push(`順序逆転: ${prev.sel} と ${curr.sel}`);
      }
    }

    if (!audit.ctas.detailHref) vpReport.issues.push("ショップ詳細CTAなし");
    if (!audit.ctas.productHref) vpReport.issues.push("商品カードCTAなし");

    const fullShot = path.join(OUT, `${phase}-shop-products-${vp.label}-full.png`);
    await page.screenshot({ path: fullShot, fullPage: true });
    vpReport.shots.push(fullShot);

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const topShot = path.join(OUT, `${phase}-shop-products-${vp.label}-top.png`);
    await page.screenshot({ path: topShot, fullPage: false });
    vpReport.shots.push(topShot);

    if (vpReport.issues.length) vpReport.verdict = "FAIL";
  } catch (err) {
    vpReport.verdict = "FAIL";
    vpReport.issues.push(String(err?.message || err));
  } finally {
    await context.close();
  }
  report.viewports.push(vpReport);
  if (vpReport.verdict !== "PASS") report.overall = "FAIL";
}

});
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await closeAllBrowsers();
process.exit(report.overall === "PASS" ? 0 : 1);
