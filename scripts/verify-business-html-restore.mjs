#!/usr/bin/env node
/**
 * business.html board restore verification
 */
import fs from "node:fs";
import path from "node:path";
import { parse } from "parse5";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = "business.html";
const html = fs.readFileSync(path.join(ROOT, FILE), "utf8");
const js = fs.readFileSync(path.join(ROOT, "business-board-page.js"), "utf8");

const ufffd = (html.match(/\uFFFD/g) || []).length;
let parseOk = true;
try {
  parse(html);
} catch (err) {
  parseOk = false;
  console.error("parse5:", err);
}

const sels = [...js.matchAll(/\$\(\s*["'`](\[[^\`'"]+\])["'`]/g)].map((m) => m[1]);
const missingHooks = sels.filter((s) => !html.includes(s.slice(1, -1)));

const staticChecks = {
  ufffd,
  parse5: parseOk,
  businessBoardPage: html.includes("business-board-page"),
  bizBoardFilter: html.includes("biz-board-filter"),
  bizBoardSearch: html.includes("biz-board-search"),
  categoryNav: html.includes("data-business-category-nav"),
  bizBoardTabs: html.includes("data-biz-board-tabs"),
  bizBoardTable: html.includes("biz-board-table"),
  boardCss: html.includes("business-board.css"),
  boardPageJs: html.includes("business-board-page.js"),
  boardRendererJs: html.includes("business-board-renderer.js"),
  boardDemoJs: html.includes("business-board-demo.js"),
  shopMarketHeader: html.includes("data-business-market-header"),
  shopStoreCardsCss: html.includes("shop-store-cards.css"),
  tasfulAiLogoCss: html.includes("tasful-ai-logo.css"),
  businessBoardHeaderCss: html.includes("business-board-header.css"),
  tasuBannerMarkup: html.includes('class="tasu-banner"'),
  headerSearchBusiness: /action="business\.html"[^>]*method="get"/.test(html),
  domHooksMissing: missingHooks.length,
  domHooksMissingList: missingHooks,
};

const BASE = process.env.BASE_URL || "http://127.0.0.1:5188";
await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();
const pageErrors = [];
const consoleErrors = [];

page.on("pageerror", (e) => pageErrors.push(String(e.message || e)));
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});

let loaded = false;
let dom = {};
try {
  const res = await page.goto(`${BASE}/business.html`, {
    waitUntil: "networkidle",
    timeout: 45000,
  });
  loaded = res?.ok() ?? false;
  await page.waitForTimeout(2500);

  dom = {
    leftFilterVisible: await page.locator(".biz-board-filter").isVisible(),
    searchVisible: await page.locator(".biz-board-search").isVisible(),
    categoryNavVisible: await page.locator("[data-business-category-nav]").isVisible(),
    tabsVisible: await page.locator("[data-biz-board-tabs]").isVisible(),
    tableVisible: await page.locator(".biz-board-table").isVisible(),
    tableHeadVisible: await page.locator(".biz-board-table thead").isVisible(),
    rowCount: await page.locator(".biz-board-table tbody tr").count(),
    detailLinkCount: await page.locator('a[href*="detail-business-service.html"]').count(),
    bodyHasBoardClass: await page.evaluate(() =>
      document.body.classList.contains("business-board-page"),
    ),
    detailUrlFromRenderer: await page.evaluate(
      () =>
        window.TasuBusinessBoardRenderer?.getDetailUrl?.({
          id: "demo-biz-pr-1",
          business_type: "field_service",
        }) === "detail-business-service.html?id=demo-biz-pr-1",
    ),
    shopMarketHeaderVisible: await page
      .locator("header.shop-market-header[data-business-market-header]")
      .isVisible(),
    tasuBannerVisible: await page.locator(".tasu-banner").isVisible().catch(() => false),
    tasuBannerCount: await page.locator(".tasu-banner").count(),
  };
} catch (err) {
  pageErrors.push(`navigation: ${err.message || err}`);
}

});

const report = {
  static: staticChecks,
  browser: {
    baseUrl: BASE,
    loaded,
    pageErrors,
    consoleErrors,
    dom,
  },
};

const pass =
  ufffd === 0 &&
  parseOk &&
  missingHooks.length === 0 &&
  staticChecks.businessBoardPage &&
  staticChecks.bizBoardFilter &&
  staticChecks.bizBoardSearch &&
  staticChecks.bizBoardTable &&
  staticChecks.shopMarketHeader &&
  staticChecks.shopStoreCardsCss &&
  staticChecks.tasfulAiLogoCss &&
  staticChecks.businessBoardHeaderCss &&
  !staticChecks.tasuBannerMarkup &&
  loaded &&
  pageErrors.length === 0 &&
  consoleErrors.length === 0 &&
  dom.shopMarketHeaderVisible &&
  dom.tasuBannerCount === 0 &&
  !dom.tasuBannerVisible &&
  dom.leftFilterVisible &&
  dom.searchVisible &&
  dom.categoryNavVisible &&
  dom.tabsVisible &&
  dom.tableVisible &&
  (dom.detailLinkCount > 0 || dom.detailUrlFromRenderer);

console.log(JSON.stringify(report, null, 2));
console.log(pass ? "PASS business.html restore" : "FAIL business.html restore");
process.exitCode = pass ? 0 : 1;

await closeAllBrowsers();
