#!/usr/bin/env node
/**
 * 商品詳細 — 4タブアンカーナビ検証（PC1280 / 390px）
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "screenshots", "shop-product-anchor-tabs");
fs.mkdirSync(OUT, { recursive: true });

const DETAIL =
  "detail-shop-product.html?shopId=demo-shop-haru-cafe&productId=demo-restaurant-0";
const base = await findDevServerBaseUrl({ probePath: "detail-shop-product.html" });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const report = { base, tabs: [], screenshots: [], pass: true, failures: [] };

async function auditViewport(width, height, tag) {
  await page.setViewportSize({ width, height });
  await page.goto(buildLocalPageUrl(base, DETAIL), { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-tasful-product-main]:not([hidden])", { timeout: 20000 });
  await page.waitForTimeout(1200);

  const navShot = path.join(OUT, `anchor-tabs-${tag}-nav.png`);
  await page.evaluate(() => {
    const nav = document.querySelector("[data-tasful-product-section-nav]");
    nav?.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: navShot, fullPage: false });
  report.screenshots.push(navShot);

  const tabIds = ["product-description", "product-reviews", "product-shipping", "product-info"];
  for (const sectionId of tabIds) {
    await page.locator(`[data-tasful-section-link="${sectionId}"]`).click();
    await page.waitForTimeout(900);
    const shot = path.join(OUT, `anchor-tabs-${tag}-${sectionId}.png`);
    await page.screenshot({ path: shot, fullPage: false });
    report.screenshots.push(shot);
  }

  const st = await page.evaluate(() => {
    const nav = document.querySelector("[data-tasful-product-section-nav]");
    const navStyle = nav ? getComputedStyle(nav) : null;
    const innerStyle = nav?.querySelector(".tasful-market-product-section-nav__inner");
    const listStyle = nav?.querySelector(".tasful-market-product-section-nav__list");
    const links = [...document.querySelectorAll("[data-tasful-section-link]")];
    const linkRects = links.map((el) => el.getBoundingClientRect());
    const minTap = linkRects.length ? Math.min(...linkRects.map((r) => r.height)) : 0;
    const overflowX = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    const innerOverflowX = innerStyle ? getComputedStyle(innerStyle).overflowX : "";
    const gridCols = listStyle ? getComputedStyle(listStyle).gridTemplateColumns : "";
    const urlBefore = location.href;
    return {
      navVisible: navStyle?.display !== "none",
      linkCount: links.filter((el) => !el.closest("li")?.hidden).length,
      minTapHeight: Math.round(minTap),
      overflowX,
      innerOverflowX,
      gridCols,
      hasShippingSection: Boolean(document.getElementById("product-shipping")),
      urlUnchanged: location.href === urlBefore,
      cartBtn: Boolean(document.querySelector("[data-tasful-product-add-cart], [data-tasful-product-add-cart-pc]")),
    };
  });

  const checks = {
    viewport: tag,
    ...st,
    tapOk: st.minTapHeight >= 44,
    tabsOk: st.linkCount === 4,
    noHorizontalScroll: !st.overflowX && st.innerOverflowX !== "auto" && st.innerOverflowX !== "scroll",
    gridOk: /repeat\(4/.test(st.gridCols),
  };
  report.tabs.push(checks);
  if (!checks.tabsOk || !checks.tapOk || !checks.noHorizontalScroll || !checks.hasShippingSection) {
    report.pass = false;
    report.failures.push(`${tag}: ${JSON.stringify(checks)}`);
  }

  // カート導線が壊れていないか
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  const cartOk = await page.evaluate(() => {
    const btn =
      document.querySelector("[data-tasful-product-add-cart-pc]") ||
      document.querySelector("[data-tasful-product-add-cart]");
    if (!btn) return false;
    btn.click();
    const items = JSON.parse(localStorage.getItem("tasu_market_cart_items") || "[]");
    return Array.isArray(items) && items.length > 0;
  });
  checks.cartOk = cartOk;
  if (!cartOk) {
    report.pass = false;
    report.failures.push(`${tag}: cart add failed`);
  }
}

await auditViewport(1280, 900, "pc1280");
await page.evaluate(() => {
  localStorage.removeItem("tasu_market_cart_items");
  localStorage.removeItem("tasu_market_cart_count");
});
await auditViewport(390, 844, "390");

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ pass: report.pass, tabs: report.tabs, failures: report.failures }, null, 2));
await browser.close();
process.exit(report.pass ? 0 : 1);
