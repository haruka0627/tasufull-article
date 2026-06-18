/**
 * TASFUL市場 — PC版 UI スクリーンショット（1280px）
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { assertPlaywrightLocalhostPage, buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "market-pc-1280");
const VIEWPORT = { width: 1280, height: 900 };
const CART_KEY = "tasu_market_cart_count";

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = await findDevServerBaseUrl({ probePath: "shop-store.html" });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: VIEWPORT });

async function shot(name, url, waitSel) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await assertPlaywrightLocalhostPage(page);
  if (waitSel) await page.waitForSelector(waitSel, { timeout: 20000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT_DIR, name), fullPage: false });
}

const TOP_PATH = "shop-store.html";
const topUrl = buildLocalPageUrl(base, TOP_PATH);

await page.goto(topUrl, { waitUntil: "domcontentloaded" });
await assertPlaywrightLocalhostPage(page);
await page.evaluate((key) => localStorage.setItem(key, "2"), CART_KEY);
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-tasful-market-header]", { timeout: 15000 });
await page.waitForSelector(".tasful-market-pc-hero-full", { timeout: 20000 });
await page.waitForTimeout(600);

const topPageAudit = await page.evaluate(() => {
  const href = window.location.href;
  const pathname = window.location.pathname;
  const stylesheets = [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => {
    try {
      return new URL(l.href).pathname.split("/").pop();
    } catch {
      return l.getAttribute("href");
    }
  });
  const stack = document.querySelector(".tasful-market-mall-header__stack");
  const shell = document.querySelector(".tasful-market-shell");
  const footer = document.querySelector(".tasful-market-footer");
  const grid = document.querySelector(".tasful-market-grid");
  const scrollCard = document.querySelector(".tasful-market-pc-shelf-card");
  const cardImg = scrollCard?.querySelector(".tasful-market-pc-shelf-card__img img");
  const cardTitle = scrollCard?.querySelector(".tasful-market-pc-shelf-card__title");
  return {
    href,
    pathname,
    pageDataAttr: document.body.getAttribute("data-page"),
    stylesheets,
    hasTopCss: stylesheets.includes("shop-market-top.css"),
    hasHeaderCss: stylesheets.includes("shop-market-header.css"),
    hasPcCss: stylesheets.includes("shop-market-pc.css"),
    cssOrderOk:
      stylesheets.indexOf("shop-market-top.css") >= 0 &&
      stylesheets.indexOf("shop-market-header.css") > stylesheets.indexOf("shop-market-top.css") &&
      stylesheets.indexOf("shop-market-pc.css") > stylesheets.indexOf("shop-market-header.css"),
    hasTimesale: Boolean(document.querySelector("#tasful-market-pc-hero")),
    hasPopular: Boolean(document.querySelector("#tasful-market-pc-also-strip")),
    hasFeature: Boolean(document.querySelector("#tasful-market-pc-hero")),
    hasPcHero: Boolean(document.querySelector(".tasful-market-pc-hero-full")),
    hasPcQuad: Boolean(document.querySelector(".tasful-market-pc-quad-stage")),
    mobileTopHidden: (() => {
      const el = document.querySelector(".tasful-market-mobile-top");
      return el ? getComputedStyle(el).display === "none" : false;
    })(),
    searchInFirstView: (() => {
      const search = document.querySelector(".tasful-market-mall-header__search");
      const nav = document.querySelector(".tasful-market-mall-header__nav");
      const searchRect = search?.getBoundingClientRect();
      const navRect = nav?.getBoundingClientRect();
      return Boolean(
        searchRect &&
          searchRect.height >= 40 &&
          searchRect.bottom <= window.innerHeight &&
          navRect &&
          navRect.bottom <= window.innerHeight + 4
      );
    })(),
    shelfCardCount: document.querySelectorAll(".tasful-market-pc-shelf-card, .tasful-market-pc-quad__thumb").length,
    stackMaxWidth: stack ? getComputedStyle(stack).maxWidth : "",
    shellMaxWidth: shell ? getComputedStyle(shell).maxWidth : "",
    footerMaxWidth: footer ? getComputedStyle(footer).maxWidth : "",
    footerWidth: footer ? Math.round(footer.getBoundingClientRect().width) : 0,
    footerInnerMaxWidth: document.querySelector(".tasful-market-footer__inner")
      ? getComputedStyle(document.querySelector(".tasful-market-footer__inner")).maxWidth
      : "",
    gridCols: grid ? getComputedStyle(grid).gridTemplateColumns : "",
    scrollCardWidth: scrollCard ? Math.round(scrollCard.getBoundingClientRect().width) : 0,
    cardImgMaxHeight: cardImg ? getComputedStyle(cardImg).maxHeight : "",
    cardTitleWeight: cardTitle ? getComputedStyle(cardTitle).fontWeight : "",
    hasSellLink: Boolean(document.querySelector("[data-tasful-market-header-sell]")),
    scrollWidth: document.documentElement.scrollWidth,
  };
});

await page.screenshot({ path: path.join(OUT_DIR, "01-market-top-pc.png"), fullPage: false });

await shot("02-market-search-pc.png", buildLocalPageUrl(base, "shop-search.html"), ".tasful-market-search-card");

await page.waitForFunction(() => {
  const top = document.querySelector(".tasful-market-mall-header__top");
  const searchRow = document.querySelector(".tasful-market-mall-header__search-row");
  return Boolean(top && searchRow && top.contains(searchRow));
});

const headerAudit = await page.evaluate(() => {
  const stack = document.querySelector(".tasful-market-mall-header__stack");
  const logo = document.querySelector(".tasful-market-mall-header__logo");
  const search = document.querySelector(".tasful-market-mall-header__search");
  const actions = document.querySelector(".tasful-market-mall-header__actions");
  const nav = document.querySelector(".tasful-market-mall-header__nav-scroll");
  const stackRect = stack?.getBoundingClientRect();
  const logoRect = logo?.getBoundingClientRect();
  const searchRect = search?.getBoundingClientRect();
  const actionsRect = actions?.getBoundingClientRect();
  const firstCard = document.querySelector(".tasful-market-search-card");
  const imgWrap = firstCard?.querySelector(".tasful-market-search-card__img");
  const img = firstCard?.querySelector(".tasful-market-search-card__img img");
  const title = firstCard?.querySelector(".tasful-market-search-card__title");
  const price = firstCard?.querySelector(".tasful-market-search-card__price");
  return {
    stackMaxWidth: stack ? getComputedStyle(stack).maxWidth : "",
    stackWidth: Math.round(stackRect?.width || 0),
    navMaxWidth: nav ? getComputedStyle(nav).maxWidth : "",
    logoLeft: Math.round(logoRect?.left || 0),
    searchWidth: Math.round(searchRect?.width || 0),
    actionsRight: Math.round(actionsRect?.right || 0),
    searchInTopRow: Boolean(
      searchRect &&
        document.querySelector(".tasful-market-mall-header__top")?.contains(search) &&
        searchRect.top < (document.querySelector(".tasful-market-mall-header__nav")?.getBoundingClientRect().top ?? 999)
    ),
    searchBelowNav: Boolean(
      searchRect && document.querySelector(".tasful-market-mall-header__nav")?.getBoundingClientRect().top >= searchRect.bottom - 2
    ),
    searchIsWiderThanLogo: Boolean(searchRect && logoRect && searchRect.width > logoRect.width * 1.5),
    imgMaxHeight: imgWrap ? getComputedStyle(imgWrap).maxHeight : "",
    imgTagMaxHeight: img ? getComputedStyle(img).maxHeight : "",
    titleWeight: title ? getComputedStyle(title).fontWeight : "",
    priceWeight: price ? getComputedStyle(price).fontWeight : "",
    gridCols: getComputedStyle(document.querySelector(".tasful-market-search-grid")).gridTemplateColumns,
  };
});

const detailUrl = buildLocalPageUrl(base, "detail-shop-product.html", "shopId=demo-shop-tasful-bakery&productId=p-0");
await shot("03-market-product-detail-pc.png", detailUrl, "[data-tasful-product-main]");

await page.evaluate((key) => localStorage.setItem(key, "3"), CART_KEY);
await shot("04-market-cart-pc.png", buildLocalPageUrl(base, "shop-market-cart.html"), ".tasful-market-cart-main");

await shot("05-market-order-history-pc.png", buildLocalPageUrl(base, "shop-market-order-history.html"), "[data-tasful-order-history-toolbar]");

await shot("06-market-checkout-pc.png", buildLocalPageUrl(base, "shop-market-checkout.html?mode=cart"), "[data-tasful-checkout-layout]");

await shot("07-market-complete-pc.png", buildLocalPageUrl(base, "shop-market-complete.html"), ".tasful-market-complete-card");

await shot("08-market-seller-orders-pc.png", buildLocalPageUrl(base, "shop-market-seller-orders.html"), ".tasful-market-seller-orders-main");

const audit = await page.evaluate(() => {
  const stack = document.querySelector(".tasful-market-mall-header__stack");
  const sell = document.querySelector("[data-tasful-market-header-sell]");
  const footer = document.querySelector(".tasful-market-footer");
  const checkoutMain = document.querySelector(".tasful-market-checkout-main");
  const historyMain = document.querySelector(".tasful-market-order-history-main");
  const header = document.querySelector(".tasful-market-mall-header[data-tasful-market-header]");
  const headerBg = header ? getComputedStyle(header).backgroundImage : "";
  return {
    scrollWidth: document.documentElement.scrollWidth,
    headerGradient: /linear-gradient/.test(headerBg),
    hasSellLink: Boolean(sell),
    hasFooter: Boolean(footer),
    footerMaxWidth: footer ? getComputedStyle(footer).maxWidth : "",
    checkoutMaxWidth: checkoutMain ? getComputedStyle(checkoutMain).maxWidth : "",
    historyMaxWidth: historyMain ? getComputedStyle(historyMain).maxWidth : "",
  };
});

await browser.close();

const pass =
  topPageAudit.pathname.endsWith(TOP_PATH) &&
  topPageAudit.pageDataAttr === "shop_market_home" &&
  topPageAudit.hasTopCss &&
  topPageAudit.hasHeaderCss &&
  topPageAudit.hasPcCss &&
  topPageAudit.cssOrderOk &&
  topPageAudit.hasTimesale &&
  topPageAudit.hasPcHero &&
  topPageAudit.hasPcQuad &&
  topPageAudit.mobileTopHidden &&
  topPageAudit.searchInFirstView &&
  topPageAudit.shelfCardCount >= 4 &&
  audit.scrollWidth <= 1280 &&
  audit.headerGradient &&
  audit.hasSellLink &&
  audit.hasFooter &&
  topPageAudit.footerWidth >= 1270 &&
  topPageAudit.footerInnerMaxWidth === "1240px" &&
  headerAudit.stackWidth >= 1210 &&
  headerAudit.stackWidth <= 1280 &&
  headerAudit.searchInTopRow &&
  headerAudit.searchBelowNav &&
  headerAudit.searchIsWiderThanLogo &&
  headerAudit.searchWidth >= 480 &&
  headerAudit.searchWidth <= 730 &&
  (parseInt(headerAudit.imgMaxHeight, 10) <= 200 || parseInt(headerAudit.imgTagMaxHeight, 10) <= 200) &&
  parseInt(headerAudit.titleWeight, 10) >= 700 &&
  headerAudit.gridCols.split(" ").filter(Boolean).length >= 3;

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl: base,
  topUrl,
  viewport: VIEWPORT,
  topPageAudit,
  audit,
  headerAudit,
  pass,
  screenshots: fs.readdirSync(OUT_DIR).filter((f) => f.endsWith(".png")),
};

fs.writeFileSync(path.join(OUT_DIR, "pc-report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(pass ? 0 : 1);
