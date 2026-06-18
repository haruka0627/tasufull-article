#!/usr/bin/env node
/**
 * 店舗販売4ページ — ブランド統一スクショ（PC1280 / 390px）
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "screenshots", "shop-mall-brand");
fs.mkdirSync(OUT, { recursive: true });

const base = await findDevServerBaseUrl({ probePath: "shop-vendors.html" });
const report = { base, shots: [], logo: [], colors: [] };

const pages = [
  { key: "shop-vendors", url: "shop-vendors.html" },
  { key: "detail-shop-store", url: "detail-shop-store.html?id=demo-shop-haru-cafe" },
  { key: "shop-products", url: "shop-products.html?id=demo-shop-haru-cafe" },
  {
    key: "detail-shop-product",
    url: "detail-shop-product.html?shopId=demo-shop-haru-cafe&productId=demo-restaurant-0",
  },
];

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();

for (const vp of [
  { tag: "pc1280", width: 1280, height: 900 },
  { tag: "390", width: 390, height: 844 },
]) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  for (const p of pages) {
    await page.goto(buildLocalPageUrl(base, p.url), { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(p.key.includes("detail") ? 1800 : 1000);
    const file = `${p.key}-${vp.tag}.png`;
    await page.screenshot({ path: path.join(OUT, file), fullPage: false });
    report.shots.push(file);

    const audit = await page.evaluate(() => {
      const header =
        document.querySelector(
          "header.shop-market-header, header.tasful-market-mall-header, header[data-shop-store-market-header], header[data-biz-detail-market-header]"
        ) || document.querySelector("header");
      const footer = document.querySelector(".tasful-market-footer");
      const logo = document.querySelector(".tasful-ai-logo-icon, .tasful-market-mall-header__logo-img");
      const headerBg = header ? getComputedStyle(header).backgroundColor : "";
      const footerBg = footer ? getComputedStyle(footer).backgroundColor : "";
      const logoBox = logo?.getBoundingClientRect();
      const logoNatural = logo instanceof HTMLImageElement ? { w: logo.naturalWidth, h: logo.naturalHeight } : null;
      return {
        headerBg,
        footerBg,
        hasFooter: Boolean(footer),
        logoSrc: logo instanceof HTMLImageElement ? logo.currentSrc || logo.src : "",
        logoRendered: logoBox ? { w: Math.round(logoBox.width), h: Math.round(logoBox.height) } : null,
        logoNatural,
        logoOk: logoBox ? logoBox.width >= 40 && logoBox.height >= 40 && logoBox.width <= 80 : null,
      };
    });
    report.logo.push({ page: p.key, viewport: vp.tag, ...audit });
    if (audit.headerBg.includes("35") || audit.headerBg.includes("47")) {
      report.colors.push({ page: p.key, viewport: vp.tag, header: "navy-ok", headerBg: audit.headerBg });
    }
  }
}

// detail-shop.html 旧リンク grep 結果
const detailShopHtml = fs.readFileSync(path.join(__dirname, "..", "detail-shop.html"), "utf8");
const oldLinkHits = [];
for (const m of detailShopHtml.matchAll(/href="([^"]+)"/g)) {
  const href = m[1];
  if (/detail-shop\.html(?!\?)|shop-store\.html/.test(href)) oldLinkHits.push(href);
}
report.detailShopOldLinks = {
  count: oldLinkHits.length,
  samples: [...new Set(oldLinkHits)].slice(0, 12),
  note: "detail-shop.html は対象外（旧UI）。shop-store.html へのリンクが残存。canonical は detail-shop-store.html / shop-vendors.html",
};

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ shots: report.shots.length, logoIssues: report.logo.filter((l) => l.logoOk === false), oldLinks: report.detailShopOldLinks.count }, null, 2));
});

await closeAllBrowsers();
