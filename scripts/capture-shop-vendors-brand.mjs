/**
 * shop-vendors / detail-shop-store ブランド統一の簡易確認
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "screenshots", "shop-vendors-brand");
fs.mkdirSync(OUT, { recursive: true });

const base = await findDevServerBaseUrl({ probePath: "shop-vendors.html" });
await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();
const report = { pages: [] };

for (const spec of [
  { path: "shop-vendors.html", name: "vendors", w: 1280 },
  { path: "shop-vendors.html", name: "vendors-390", w: 390 },
  { path: "detail-shop-store.html?id=demo-shop-haru-cafe", name: "detail", w: 1280 },
]) {
  await page.setViewportSize({ width: spec.w, height: spec.w < 500 ? 844 : 900 });
  await page.goto(buildLocalPageUrl(base, spec.path), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(800);

  const audit = await page.evaluate(() => {
    const header = document.querySelector("header.shop-market-header");
    const footer = document.querySelector(".tasful-market-footer");
    const logoImg = document.querySelector(".shop-market-header .tasful-ai-logo-icon");
    const hbg = header ? getComputedStyle(header).backgroundColor : "";
    const fbg = footer ? getComputedStyle(footer).backgroundColor : "";
    const logoMain = document.querySelector(".shop-market-header .tasful-ai-logo-text .main");
    const logoColor = logoMain ? getComputedStyle(logoMain).color : "";
    return {
      hasBrandClass: document.body.classList.contains("tasful-shop-mall-brand"),
      hasMarketFooter: Boolean(footer),
      hasOldSiteFooter: Boolean(document.querySelector(".shop-store-site-footer")),
      headerBg: hbg,
      footerBg: fbg,
      logoSrc: logoImg?.getAttribute("src") || "",
      logoColor,
      hasHero: Boolean(document.querySelector(".shop-platform-hero")),
      hasCategory: Boolean(document.querySelector(".shop-platform-categories")),
      hasGrid: Boolean(document.querySelector("[data-shop-store-grid]")),
      headerClass: header?.className || "",
      isMallHeader: Boolean(document.querySelector(".tasful-market-mall-header")),
    };
  });

  const shot = path.join(OUT, `${spec.name}-${spec.w}.png`);
  if (spec.name === "vendors") {
    await page.evaluate(() => document.getElementById("shop-store-results")?.scrollIntoView({ block: "start" }));
    await page.waitForTimeout(400);
  }
  if (spec.name === "detail") {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(400);
  }
  await page.screenshot({ path: shot, fullPage: false });
  report.pages.push({ ...spec, audit, screenshot: shot });
}

});
const reportPath = path.join(OUT, "report.json");
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

const vendors = report.pages.find((p) => p.name === "vendors");
const detail = report.pages.find((p) => p.name === "detail");
const ok =
  vendors?.audit?.hasBrandClass &&
  vendors?.audit?.hasMarketFooter &&
  !vendors?.audit?.isMallHeader &&
  vendors?.audit?.hasHero &&
  vendors?.audit?.hasCategory &&
  vendors?.audit?.hasGrid &&
  detail?.audit?.hasMarketFooter &&
  !detail?.audit?.hasOldSiteFooter;

await closeAllBrowsers();
process.exit(ok ? 0 : 1);
