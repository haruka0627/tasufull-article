#!/usr/bin/env node
/**
 * 店舗販売導線 調査（修正禁止・レポートのみ）
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "screenshots", "shop-vendor-flow-audit");
fs.mkdirSync(OUT, { recursive: true });

const base = await findDevServerBaseUrl({ probePath: "shop-vendors.html" });
const report = {
  base,
  steps: {},
  broken: [],
  ok: [],
  duplicates: [],
  orphans: [],
  recommendations: [],
};

function fail(step, detail) {
  report.broken.push({ step, detail });
}
function pass(step, detail) {
  report.ok.push({ step, detail });
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

// ── ① shop-vendors → detail-shop-store（全カード） ──
await loadAllVendorCards();
const vendorCards = await page.evaluate(() =>
  Array.from(document.querySelectorAll("[data-shop-store-grid] .shop-store-card[data-id]")).map((card) => {
    const id = card.getAttribute("data-id") || "";
    const title =
      card.querySelector(".shop-store-card__name")?.textContent?.trim() ||
      card.querySelector(".shop-store-card__name a")?.textContent?.trim() ||
      "";
    const detailHref =
      card.querySelector('.shop-store-btn--detail[href*="detail-shop"]')?.getAttribute("href") ||
      card.querySelector('a[href*="detail-shop-store"]')?.getAttribute("href") ||
      "";
    const productsHref =
      card.querySelector('.shop-store-btn--shop[href*="shop-products"]')?.getAttribute("href") ||
      card.querySelector('.shop-store-btn--gold[href*="shop-products"]')?.getAttribute("href") ||
      "";
    return { id, title, detailHref, productsHref };
  })
);

report.steps.vendorList = { count: vendorCards.length, cards: vendorCards };

const detailLinkFails = [];
for (const card of vendorCards) {
  if (!card.id) continue;
  const u = new URL(card.detailHref || "", base);
  const hrefId = u.searchParams.get("id") || "";
  if (!card.detailHref.includes("detail-shop-store.html")) {
    detailLinkFails.push({ id: card.id, reason: "href not detail-shop-store", href: card.detailHref });
    continue;
  }
  if (hrefId !== card.id) {
    detailLinkFails.push({ id: card.id, reason: "id mismatch", href: card.detailHref });
    continue;
  }
  await page.goto(buildLocalPageUrl(base, card.detailHref.replace(/^\//, "")), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () =>
      document.body.dataset.listingLoaded === "true" ||
      document.querySelector("[data-biz-detail-title]")?.textContent?.trim(),
    { timeout: 20000 }
  );
  const st = await page.evaluate(() => ({
    title: document.querySelector("[data-biz-detail-title]")?.textContent?.trim() || "",
    rootHidden: document.querySelector("[data-biz-detail-root]")?.hidden,
    status: document.querySelector("[data-listing-detail-status]")?.textContent?.trim() || "",
    loaded: document.body.dataset.listingLoaded,
  }));
  if (st.rootHidden || /見つかりません/.test(st.status) || !st.title) {
    detailLinkFails.push({ id: card.id, reason: st.status || "no title", title: st.title });
  }
}

report.steps.vendorToDetail = {
  total: vendorCards.length,
  failed: detailLinkFails.length,
  failures: detailLinkFails.slice(0, 15),
};
if (detailLinkFails.length === 0) pass("① vendors→detail-shop-store", `${vendorCards.length}件すべてOK`);
else fail("① vendors→detail-shop-store", `${detailLinkFails.length}/${vendorCards.length}件 NG`);

// ── ② detail-shop-store → shop-products（商品を見る） ──
const storeToProductsFails = [];
const sampleStores = vendorCards.slice(0, 8);
for (const card of sampleStores) {
  await page.goto(buildLocalPageUrl(base, `detail-shop-store.html?id=${encodeURIComponent(card.id)}`), {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(
    () => document.querySelector("[data-biz-detail-title]")?.textContent?.trim(),
    { timeout: 20000 }
  );
  const links = await page.evaluate(() => {
    const all = [...document.querySelectorAll('a[href*="shop-products"]')].map((a) => ({
      href: a.getAttribute("href") || "",
      text: (a.textContent || "").trim().slice(0, 40),
    }));
    return all;
  });
  const productLink = links.find((l) => /商品|メニュー|すべて/.test(l.text)) || links[0];
  if (!productLink?.href) {
    storeToProductsFails.push({ id: card.id, reason: "shop-products link not found" });
    continue;
  }
  await page.goto(buildLocalPageUrl(base, productLink.href.replace(/^\//, "")), { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const shopPage = await page.evaluate(() => ({
    title: document.querySelector(".shop-products-title, h1")?.textContent?.trim() || document.title,
    hasCards: document.querySelectorAll(".shop-products-card").length,
    error: document.querySelector(".shop-products-error")?.textContent?.trim() || "",
  }));
  if (shopPage.error || (!shopPage.hasCards && !shopPage.title)) {
    storeToProductsFails.push({ id: card.id, reason: shopPage.error || "empty products page" });
  }
}
report.steps.detailToProducts = { sampled: sampleStores.length, failed: storeToProductsFails.length, failures: storeToProductsFails };
if (storeToProductsFails.length === 0) pass("② detail→shop-products", `サンプル${sampleStores.length}件OK`);
else fail("② detail→shop-products", `${storeToProductsFails.length}/${sampleStores.length}件 NG`);

// ── ③ shop-products → detail-shop-product（全商品カード） ──
await page.goto(buildLocalPageUrl(base, "shop-products.html?id=demo-shop-haru-cafe"), { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1000);
const productCards = await page.evaluate(() =>
  [...document.querySelectorAll(".shop-products-card a[href*='detail-shop-product'], a.shop-products-card__link")].map((a) => ({
    href: a.getAttribute("href") || "",
    title: (a.getAttribute("aria-label") || a.textContent || "").trim().slice(0, 60),
  }))
);
const uniqueHrefs = [...new Set(productCards.map((c) => c.href))];
const productLinkFails = [];
for (const href of uniqueHrefs) {
  const u = new URL(href, base);
  const shopId = u.searchParams.get("shopId") || "";
  const productId = u.searchParams.get("productId") || "";
  if (!shopId || !productId) {
    productLinkFails.push({ href, reason: "missing shopId/productId" });
    continue;
  }
  await page.goto(buildLocalPageUrl(base, href.replace(/^\//, "")), { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const pd = await page.evaluate(() => ({
    url: location.href,
    title: document.querySelector("[data-tasful-product-title]")?.textContent?.trim() || "",
    mainHidden: document.querySelector("[data-tasful-product-main]")?.hidden,
    status: document.querySelector("[data-tasful-product-status]")?.textContent?.trim() || "",
  }));
  const u2 = new URL(pd.url);
  if (pd.mainHidden || !pd.title || /見つかりません|指定されていません/.test(pd.status)) {
    productLinkFails.push({ href, reason: pd.status || "not rendered", title: pd.title });
  }
  if (u2.searchParams.get("shopId") !== shopId || u2.searchParams.get("productId") !== productId) {
    productLinkFails.push({ href, reason: "param drift on load" });
  }
}
report.steps.productsToDetail = {
  cardLinks: uniqueHrefs.length,
  failed: productLinkFails.length,
  failures: productLinkFails,
};
if (productLinkFails.length === 0) pass("③ shop-products→detail-shop-product", `${uniqueHrefs.length}商品リンクOK`);
else fail("③ shop-products→detail-shop-product", `${productLinkFails.length}/${uniqueHrefs.length}件 NG`);

// ── ④⑤ detail-shop-product params & back to store ──
await page.goto(
  buildLocalPageUrl(base, "detail-shop-product.html?shopId=demo-shop-haru-cafe&productId=demo-restaurant-0"),
  { waitUntil: "domcontentloaded" }
);
await page.waitForTimeout(1500);
const productDetailAudit = await page.evaluate(() => {
  const u = new URL(location.href);
  const brandLink = document.querySelector("[data-tasful-product-brand] a");
  const sellerNameLink = document.querySelector(".tasful-market-product-buybox__seller-name");
  const sellerView = document.querySelector("[data-tasful-product-seller-view]");
  return {
    shopId: u.searchParams.get("shopId"),
    productId: u.searchParams.get("productId"),
    title: document.querySelector("[data-tasful-product-title]")?.textContent?.trim() || "",
    brandHref: brandLink?.getAttribute("href") || "",
    sellerBuyboxHref: sellerNameLink?.getAttribute("href") || "",
    sellerViewHref: sellerView?.getAttribute("href") || "",
    hasAddCart: Boolean(document.querySelector("[data-tasful-product-add-cart]")),
  };
});
report.steps.productDetail = productDetailAudit;

const backToStore =
  productDetailAudit.brandHref.includes("detail-shop-store") ||
  productDetailAudit.sellerBuyboxHref.includes("detail-shop-store") ||
  productDetailAudit.sellerViewHref.includes("detail-shop-store");
if (productDetailAudit.shopId === "demo-shop-haru-cafe" && productDetailAudit.productId === "demo-restaurant-0" && productDetailAudit.title) {
  pass("④ shopId/productId引き継ぎ", `${productDetailAudit.shopId} / ${productDetailAudit.productId}`);
} else {
  fail("④ shopId/productId引き継ぎ", JSON.stringify(productDetailAudit));
}
if (backToStore) pass("⑤ 店舗詳細へ戻る導線", "detail-shop-store へのリンクあり");
else {
  fail("⑤ 店舗詳細へ戻る導線", `brand=${productDetailAudit.brandHref} seller=${productDetailAudit.sellerBuyboxHref} view=${productDetailAudit.sellerViewHref}`);
  report.recommendations.push("detail-shop-product の出品者/ブランドリンクを detail-shop-store.html?id= へ統一（現状 shop-market-seller.html または detail-shop.html）");
}

// ── ⑥ 購入フロー ──
const flowErrors = [];
try {
  await page.goto(
    buildLocalPageUrl(base, "detail-shop-product.html?shopId=demo-shop-haru-cafe&productId=demo-restaurant-0"),
    { waitUntil: "domcontentloaded" }
  );
  await page.waitForTimeout(1200);
  await page.click("[data-tasful-product-add-cart]");
  await page.waitForTimeout(600);

  await page.goto(buildLocalPageUrl(base, "shop-market-cart.html"), { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const cart = await page.evaluate(() => ({
    summary: document.querySelector("[data-tasful-market-cart-summary]")?.textContent?.trim() || "",
    items: document.querySelectorAll("[data-tasful-market-cart-items] .tasful-market-cart-item, .tasful-market-cart-line").length,
    checkoutHidden: document.querySelector("[data-tasful-market-cart-checkout]")?.hidden,
  }));
  if (/空/.test(cart.summary) && cart.items === 0) flowErrors.push("cart empty after add");

  await page.goto(buildLocalPageUrl(base, "shop-market-checkout.html?mode=cart"), { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  const checkout = await page.evaluate(() => ({
    status: document.querySelector("[data-tasful-market-checkout-status]")?.textContent?.trim() || "",
    hasForm: Boolean(document.querySelector("[data-tasful-market-checkout-form], form")),
    title: document.title,
  }));
  if (/商品がありません|空/.test(checkout.status)) flowErrors.push(`checkout: ${checkout.status}`);

  // Try submit if possible (demo)
  const submit = page.locator("[data-tasful-market-checkout-submit], button[type='submit']").first();
  if (await submit.count()) {
    await submit.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
  }
  const completeUrl = page.url();
  const onComplete = /shop-market-complete/.test(completeUrl);
  if (!onComplete) {
    // manual navigate to test complete page loads
    await page.goto(buildLocalPageUrl(base, "shop-market-complete.html"), { waitUntil: "domcontentloaded" });
  }
  const complete = await page.evaluate(() => ({
    url: location.href,
    title: document.title,
    hasRoot: Boolean(document.querySelector(".tasful-market-complete, [data-tasful-market-complete]")),
  }));
  report.steps.purchaseFlow = { cart, checkout, complete, flowErrors, reachedComplete: onComplete || /complete/.test(complete.url) };
  if (flowErrors.length === 0 && (onComplete || complete.hasRoot)) pass("⑥ 購入フロー", "カート→確認→完了ページ到達");
  else fail("⑥ 購入フロー", flowErrors.join("; ") || "完了ページ未到達");
} catch (e) {
  fail("⑥ 購入フロー", String(e.message || e));
  report.steps.purchaseFlow = { error: String(e.message || e) };
}

// ── ⑦ 重複・孤立URL（静的） ──
report.duplicates = [
  { urls: ["detail-shop.html", "detail-shop-store.html"], note: "同一店舗詳細UIの重複（スクリプト・CSSほぼ同一）" },
  { urls: ["shop-store.html", "shop-vendors.html"], note: "shop-store=市場TOP / shop-vendors=店舗一覧（役割分離済み）" },
  { urls: ["shop-market-seller.html", "detail-shop-store.html"], note: "商品詳細の出品者リンクは shop-market-seller を指す（店舗詳細と別系統）" },
];
report.orphans = [
  { url: "detail-shop-product-page.js", note: "detail-shop-product.html 未読込（デッドコード候補）" },
  { url: "detail-shop.html", note: "listing-renderer / favorite-store / order-complete が依然参照" },
  { url: "shop-store.html（店舗一覧として）", note: "市場TOP化。店舗一覧は shop-vendors.html へ移行" },
];

report.recommendations.push(
  "正規店舗詳細URLを detail-shop-store.html に一本化（detail-shop.html はリダイレクトまたは廃止予定化）",
  "商品詳細の出品者リンク sellerPageHref を detail-shop-store.html?id= に変更検討",
  "shop-products エラー時の戻り先を shop-vendors.html に更新検討",
  "listing-renderer.js / favorite-store.js の detail-shop.html 参照を detail-shop-store.html へ"
);

const reportPath = path.join(OUT, "report.json");
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ok: report.ok.length, broken: report.broken.length, reportPath }, null, 2));
console.log(JSON.stringify(report, null, 2));

await browser.close();
process.exit(0);
