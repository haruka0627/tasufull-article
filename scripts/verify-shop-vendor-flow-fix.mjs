#!/usr/bin/env node
/**
 * 店舗販売導線 A–D 修正後の検証 + スクショ
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "screenshots", "shop-vendor-flow-fix");
fs.mkdirSync(OUT, { recursive: true });

const base = await findDevServerBaseUrl({ probePath: "shop-vendors.html" });
const report = {
  base,
  generatedAt: new Date().toISOString(),
  ok: [],
  ng: [],
  counts: { ok: 0, ng: 0 },
  steps: {},
};

function pass(step, detail) {
  report.ok.push({ step, detail });
  report.counts.ok += 1;
}
function fail(step, detail) {
  report.ng.push({ step, detail });
  report.counts.ng += 1;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(25000);

async function loadAllVendorCards() {
  await page.goto(buildLocalPageUrl(base, "shop-vendors.html"), { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-shop-store-grid] .shop-store-card[data-id]", { timeout: 25000 });
  for (let i = 0; i < 12; i++) {
    const before = await page.locator(".shop-store-card[data-id]").count();
    await page.evaluate(() => {
      const btn = document.querySelector("[data-shop-load-more]");
      if (btn && !btn.hidden) btn.click();
    });
    await page.waitForTimeout(400);
    const after = await page.locator(".shop-store-card[data-id]").count();
    if (after <= before) break;
  }
}

// ① shop-vendors 27店舗
await loadAllVendorCards();
const vendorCards = await page.evaluate(() =>
  Array.from(document.querySelectorAll("[data-shop-store-grid] .shop-store-card[data-id]")).map((card) => ({
    id: card.getAttribute("data-id") || "",
    title:
      card.querySelector(".shop-store-card__name")?.textContent?.trim() ||
      card.querySelector(".shop-store-card__name a")?.textContent?.trim() ||
      "",
  }))
);
report.steps.vendorList = { count: vendorCards.length };
await page.setViewportSize({ width: 1280, height: 900 });
await page.screenshot({ path: path.join(OUT, "01-shop-vendors-pc1280.png"), fullPage: false });
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: path.join(OUT, "02-shop-vendors-390.png"), fullPage: false });

if (vendorCards.length === 27) pass("① shop-vendors 27店舗", `${vendorCards.length}件`);
else fail("① shop-vendors 27店舗", `期待27件 / 実際${vendorCards.length}件`);

// ②③ 全店舗: shop-products 先頭3商品 → detail
const productsPageFails = [];
const productDetailFails = [];
let productDetailOk = 0;
let productDetailNg = 0;

for (const card of vendorCards) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(buildLocalPageUrl(base, `shop-products.html?id=${encodeURIComponent(card.id)}`), {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(800);
  const shopSt = await page.evaluate(() => ({
    error: document.querySelector(".shop-products-error")?.textContent?.trim() || "",
    backHref: document.querySelector(".shop-products-error a")?.getAttribute("href") || "",
    cards: [...document.querySelectorAll(".shop-products-card__link")].map((a) => ({
      href: a.getAttribute("href") || "",
      title: (a.getAttribute("aria-label") || "").trim().slice(0, 50),
    })),
  }));
  if (shopSt.error || shopSt.cards.length === 0) {
    productsPageFails.push({ id: card.id, error: shopSt.error || "no cards" });
    continue;
  }
  if (card.id === "shop-store-demo-other-002" || card.id === "shop-store-demo-other-003") {
    if (shopSt.backHref && shopSt.backHref.includes("shop-vendors.html")) {
      pass(`② other-demo ${card.id}`, "shop-products 表示OK");
    }
  }
  for (const link of shopSt.cards.slice(0, 3)) {
    const u = new URL(link.href, base);
    const shopId = u.searchParams.get("shopId") || "";
    const productId = u.searchParams.get("productId") || "";
    await page.goto(buildLocalPageUrl(base, link.href.replace(/^\//, "")), { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    const pd = await page.evaluate(() => ({
      title: document.querySelector("[data-tasful-product-title]")?.textContent?.trim() || "",
      mainHidden: document.querySelector("[data-tasful-product-main]")?.hidden,
      status: document.querySelector("[data-tasful-product-status]")?.textContent?.trim() || "",
      brandHref: document.querySelector("[data-tasful-product-brand] a")?.getAttribute("href") || "",
      sellerHref: document.querySelector(".tasful-market-product-buybox__seller-name")?.getAttribute("href") || "",
      sellerViewHref: document.querySelector("[data-tasful-product-seller-view]")?.getAttribute("href") || "",
    }));
    const ok =
      !pd.mainHidden &&
      Boolean(pd.title) &&
      !/見つかりません|指定されていません/.test(pd.status) &&
      shopId === card.id;
    if (ok) {
      productDetailOk += 1;
      const storeBack =
        pd.brandHref.includes("detail-shop-store.html") &&
        pd.sellerHref.includes("detail-shop-store.html") &&
        pd.sellerViewHref.includes("detail-shop-store.html") &&
        pd.brandHref.includes(`id=${encodeURIComponent(card.id)}`);
      if (!storeBack) {
        productDetailFails.push({
          id: card.id,
          productId,
          reason: "seller links not detail-shop-store",
          brandHref: pd.brandHref,
        });
      }
    } else {
      productDetailNg += 1;
      productDetailFails.push({ id: card.id, productId, reason: pd.status || "not rendered", title: pd.title });
    }
  }
}

report.steps.productsPages = { failed: productsPageFails.length, failures: productsPageFails };
report.steps.productDetails = {
  ok: productDetailOk,
  ng: productDetailNg,
  failures: productDetailFails.slice(0, 20),
};

if (productsPageFails.length === 0) pass("② shop-products 全27店舗", "エラーなし");
else fail("② shop-products 全27店舗", `${productsPageFails.length}件 NG: ${productsPageFails.map((f) => f.id).join(", ")}`);

if (productDetailNg === 0) pass("③ detail-shop-product 先頭3商品×27店", `${productDetailOk}件すべてOK`);
else fail("③ detail-shop-product", `OK ${productDetailOk} / NG ${productDetailNg}`);

const sellerLinkFails = productDetailFails.filter((f) => f.reason === "seller links not detail-shop-store");
if (sellerLinkFails.length === 0 && productDetailOk > 0) pass("④ 出品者リンク→detail-shop-store", "ブランド/出品者/出品者を見る");
else if (sellerLinkFails.length) fail("④ 出品者リンク", `${sellerLinkFails.length}件が shop-market-seller 等`);

// ⑤ 購入フロー demo-* と p-*
const flowCases = [
  { shopId: "demo-shop-haru-cafe", productId: "demo-restaurant-0", label: "demo-*" },
  { shopId: "demo-shop-haru-cafe", productId: "p-0", label: "p-*" },
];
const flowFails = [];
for (const fc of flowCases) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => {
    localStorage.removeItem("tasu_market_cart_items");
    localStorage.removeItem("tasu_market_cart_count");
  });
  await page.goto(
    buildLocalPageUrl(base, `detail-shop-product.html?shopId=${encodeURIComponent(fc.shopId)}&productId=${encodeURIComponent(fc.productId)}`),
    { waitUntil: "domcontentloaded" }
  );
  await page.waitForTimeout(2000);
  const rendered = await page.evaluate(
    () =>
      !document.querySelector("[data-tasful-product-main]")?.hidden &&
      Boolean(document.querySelector("[data-tasful-product-title]")?.textContent?.trim())
  );
  if (!rendered) {
    flowFails.push(`${fc.label}: not rendered`);
    continue;
  }
  await page.locator("[data-tasful-product-add-cart-pc]").first().click({ timeout: 5000 });
  await page.waitForTimeout(600);
  const cartOk = await page.evaluate((productId) => {
    const items = JSON.parse(localStorage.getItem("tasu_market_cart_items") || "[]");
    const count = Number(localStorage.getItem("tasu_market_cart_count") || 0);
    return (Array.isArray(items) && items.some((it) => it.productId === productId)) || count > 0;
  }, fc.productId);
  if (!cartOk) flowFails.push(`${fc.label}: cart empty`);
}
report.steps.purchaseFlow = { failures: flowFails };
if (flowFails.length === 0) pass("⑤ 購入フロー demo-* / p-*", "カート投入OK");
else fail("⑤ 購入フロー", flowFails.join("; "));

// スクショ: 代表ページ PC1280 + 390
const shots = [
  { file: "03-detail-shop-store-pc1280.png", url: "detail-shop-store.html?id=demo-shop-haru-cafe", w: 1280 },
  { file: "04-shop-products-pc1280.png", url: "shop-products.html?id=demo-shop-haru-cafe", w: 1280 },
  { file: "05-detail-product-demo-pc1280.png", url: "detail-shop-product.html?shopId=demo-shop-haru-cafe&productId=demo-restaurant-0", w: 1280 },
  { file: "06-detail-product-p0-pc1280.png", url: "detail-shop-product.html?shopId=demo-shop-haru-cafe&productId=p-0", w: 1280 },
  { file: "07-other002-products-pc1280.png", url: "shop-products.html?id=shop-store-demo-other-002", w: 1280 },
  { file: "08-detail-product-390.png", url: "detail-shop-product.html?shopId=demo-shop-haru-cafe&productId=demo-restaurant-0", w: 390 },
  { file: "09-shop-products-390.png", url: "shop-products.html?id=demo-shop-haru-cafe", w: 390 },
];
for (const s of shots) {
  await page.setViewportSize({ width: s.w, height: s.w === 390 ? 844 : 900 });
  await page.goto(buildLocalPageUrl(base, s.url), { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(s.url.includes("detail-shop-product") ? 1500 : 900);
  await page.screenshot({ path: path.join(OUT, s.file), fullPage: false });
}

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ counts: report.counts, steps: report.steps }, null, 2));
await browser.close();
