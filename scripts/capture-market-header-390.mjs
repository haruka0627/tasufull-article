/**
 * TASFUL市場 — 共通ヘッダー 390px 検証（localhost 必須）
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { assertPlaywrightLocalhostPage, buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "market-header-390");
const CART_KEY = "tasu_market_cart_count";

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = await findDevServerBaseUrl({ probePath: "shop-store.html" });
const topUrl = buildLocalPageUrl(base, "shop-store.html");
const searchUrl = buildLocalPageUrl(base, "shop-search.html");
const cartUrl = buildLocalPageUrl(base, "shop-market-cart.html");
const navFoodUrl = buildLocalPageUrl(base, "shop-search.html", "category=food");

const browser = await chromium.launch({ headless: true });

async function inspectHeader(page) {
  return page.evaluate(() => {
    const header = document.querySelector("[data-tasful-market-header]");
    const headerRect = header?.getBoundingClientRect();
    const logo = document.querySelector(".tasful-market-mall-header__logo");
    const search = document.querySelector(".tasful-market-mall-header__search");
    const searchRect = search?.getBoundingClientRect();
    const cart = document.querySelector(".tasful-market-mall-header__cart");
    const account = document.querySelector(".tasful-market-mall-header__account");
    const nav = document.querySelector(".tasful-market-mall-header__nav");
    const navStyle = nav ? getComputedStyle(nav) : null;
    const navItems = Array.from(document.querySelectorAll("[data-tasful-market-nav-item]"));
    const badge = document.querySelector("[data-tasful-market-cart-count]");
    const stack = document.querySelector(".tasful-market-mall-header__stack");
    const stackStyle = stack ? getComputedStyle(stack) : null;
    const searchBtn = document.querySelector(".tasful-market-mall-header__search-btn");
    const searchBtnStyle = searchBtn ? getComputedStyle(searchBtn) : null;
    const stackHeight = stack ? stack.offsetHeight : 0;
    const navHeight = nav ? nav.offsetHeight : 0;
    const accountRect = account?.getBoundingClientRect();
    const cartRect = cart?.getBoundingClientRect();
    const actionsOverlap = Boolean(
      accountRect &&
        cartRect &&
        accountRect.right > cartRect.left + 2 &&
        accountRect.bottom > cartRect.top + 2 &&
        cartRect.right > accountRect.left + 2
    );
    return {
      hasHeader: Boolean(header),
      headerFixedTop: Boolean(headerRect && headerRect.top <= 2),
      headerHeight: Math.max(header?.offsetHeight || 0, stackHeight + navHeight),
      hasLogo: Boolean(logo),
      logoHref: logo?.getAttribute("href") || "",
      hasSearch: Boolean(search),
      searchHeight: searchRect ? Math.round(searchRect.height) : 0,
      searchVisible: Boolean(searchRect && searchRect.height >= 40),
      hasCartLink: cart?.getAttribute("href")?.includes("shop-market-cart.html"),
      hasAccountLink: Boolean(account),
      navCount: navItems.length,
      navScrollable: navItems.length >= 8,
      navNavyBg: navStyle?.backgroundColor === "rgb(35, 47, 62)",
      stackNavyBg: stackStyle?.backgroundColor === "rgb(35, 47, 62)",
      logoLightText: logo ? getComputedStyle(logo).color === "rgb(255, 255, 255)" : false,
      searchBtnGold: Boolean(
        searchBtnStyle &&
          (searchBtnStyle.backgroundImage.includes("linear-gradient") ||
            searchBtnStyle.backgroundColor === "rgb(240, 193, 75)" ||
            searchBtnStyle.backgroundColor === "rgb(247, 216, 117)")
      ),
      noHorizontalOverflow: document.documentElement.scrollWidth <= 390,
      actionsNoOverlap: !actionsOverlap,
      navHasFood: navItems.some((el) => el.textContent?.includes("食品")),
      navHasConnect: navItems.some((el) => el.textContent?.includes("Connect")),
      cartBadgeVisible: badge ? !badge.hidden : false,
      cartBadgeText: badge?.textContent || "",
    };
  });
}

const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(topUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await assertPlaywrightLocalhostPage(page);
await page.waitForSelector("[data-tasful-market-header]", { state: "attached", timeout: 15000 });
await page.evaluate((key) => localStorage.setItem(key, "3"), CART_KEY);
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-tasful-market-cart-count]", { state: "attached", timeout: 15000 });
await page.waitForSelector("[data-tasful-market-nav-item]", { state: "attached", timeout: 15000 });
await page.waitForTimeout(500);

const topReport = await inspectHeader(page);

await page.fill("[data-tasful-market-search-input]", "パン");
await Promise.all([
  page.waitForURL(/shop-search\.html/, { waitUntil: "domcontentloaded", timeout: 15000 }),
  page.evaluate(() => document.querySelector("[data-tasful-market-search-form]")?.requestSubmit()),
]);
const searchFromTopOk = page.url().includes("shop-search.html") && page.url().includes("keyword");

await page.waitForSelector(".tasful-market-search-card", { timeout: 15000 });
const searchReport = await inspectHeader(page);
searchReport.sameHeaderStructure =
  searchReport.hasHeader &&
  searchReport.hasLogo &&
  searchReport.hasSearch &&
  searchReport.navCount === topReport.navCount;

await page.goto(navFoodUrl, { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-tasful-market-nav-item]", { timeout: 15000 });
const navFoodActive = await page.evaluate(
  () => document.querySelector('[data-tasful-market-nav-item="food"]')?.classList.contains("is-active") === true
);

await page.goto(cartUrl, { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-tasful-market-header]", { state: "attached", timeout: 15000 });
const cartPageOk = page.url().includes("shop-market-cart.html");
const cartHeaderOk = await page.evaluate(() => Boolean(document.querySelector("[data-tasful-market-header]")));
const cartLinkOnSearch = searchReport.hasCartLink;

await page.screenshot({
  path: path.join(OUT_DIR, "market-header-top390.png"),
  fullPage: false,
  clip: { x: 0, y: 0, width: 390, height: 844 },
});

await page.screenshot({
  path: path.join(OUT_DIR, "market-header-actions-390.png"),
  fullPage: false,
  clip: { x: 0, y: 0, width: 390, height: 120 },
});

await browser.close();

const pass =
  topReport.hasHeader &&
  topReport.headerFixedTop &&
  topReport.headerHeight >= 120 &&
  topReport.hasLogo &&
  topReport.logoHref.includes("shop-store.html") &&
  topReport.hasSearch &&
  topReport.searchVisible &&
  topReport.hasCartLink &&
  topReport.hasAccountLink &&
  topReport.navCount >= 10 &&
  topReport.navNavyBg &&
  topReport.stackNavyBg &&
  topReport.logoLightText &&
  topReport.searchBtnGold &&
  topReport.noHorizontalOverflow &&
  topReport.actionsNoOverlap &&
  topReport.cartBadgeVisible &&
  topReport.cartBadgeText === "3" &&
  searchFromTopOk &&
  searchReport.sameHeaderStructure &&
  searchReport.navNavyBg &&
  searchReport.stackNavyBg &&
  searchReport.noHorizontalOverflow &&
  navFoodActive &&
  cartLinkOnSearch &&
  cartPageOk &&
  cartHeaderOk;

console.log(
  JSON.stringify({ baseUrl: base, topUrl, searchUrl, cartUrl, navFoodUrl, topReport, searchReport, searchFromTopOk, navFoodActive, cartPageOk, cartHeaderOk, cartLinkOnSearch, pass }, null, 2)
);
process.exit(pass ? 0 : 1);
