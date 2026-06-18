#!/usr/bin/env node
/**
 * 店舗販売導線 — 回帰検証（shop-vendors 系のみ・市場TOP/shop-store.html 非対象）
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "screenshots", "shop-vendor-regression");
fs.mkdirSync(OUT, { recursive: true });

const SAMPLE_SHOP = "demo-shop-haru-cafe";
const SAMPLE_PRODUCT = "demo-restaurant-0";
const STORE_PRODUCT_PAGE = "detail-shop-store-product.html";

const base = await findDevServerBaseUrl({ probePath: "shop-vendors.html" });
const report = {
  base,
  generatedAt: new Date().toISOString(),
  flow:
    "shop-vendors → detail-shop-store → shop-products → detail-shop-store-product → shop-store-cart → shop-store-checkout → shop-store-complete",
  excluded: [
    "shop-store.html（市場TOP）",
    "市場TOPへの店舗販売導線追加",
    "detail-shop-product.html（市場/Amazon型）",
  ],
  checks: [],
  ok: 0,
  ng: 0,
  screenshots: [],
};

function record(id, name, pass, detail, extra = {}) {
  report.checks.push({ id, name, pass, detail, ...extra });
  if (pass) report.ok += 1;
  else report.ng += 1;
}

function buildStoreProductUrl(shopId, productId) {
  return `${STORE_PRODUCT_PAGE}?shopId=${encodeURIComponent(shopId)}&productId=${encodeURIComponent(productId)}`;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(25000);

async function shot(file, viewport) {
  const p = path.join(OUT, file);
  await page.screenshot({ path: p, fullPage: false });
  report.screenshots.push({ file, viewport });
}

async function clearCart() {
  await page.goto(buildLocalPageUrl(base, "shop-vendors.html"), { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.removeItem("tasu_market_cart_items");
    localStorage.removeItem("tasu_market_cart_count");
  });
}

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

async function waitStoreDetail() {
  await page.waitForFunction(
    () =>
      document.body.dataset.listingLoaded === "true" ||
      document.querySelector("[data-biz-detail-title]")?.textContent?.trim(),
    { timeout: 20000 }
  );
}

async function waitStoreProductDetail() {
  await page.waitForFunction(
    () => {
      const layout = document.querySelector("[data-shop-product-layout]");
      const title = document.querySelector("[data-shop-product-title]")?.textContent?.trim() || "";
      const price = document.querySelector("[data-shop-product-price]")?.textContent?.trim() || "";
      const status = document.querySelector("[data-shop-product-status]")?.textContent?.trim() || "";
      if (/見つかりません|指定されていません/.test(status)) return true;
      return Boolean(layout && !layout.hidden && title && title !== "商品" && price);
    },
    { timeout: 25000 }
  );
}

function isTerminalProductError(pd) {
  return /見つかりません|指定されていません/.test(pd.status || "");
}

function evaluateStoreProductDetail(expectedShopId) {
  return page.evaluate((shopId) => {
    const u = new URL(location.href);
    return {
      path: u.pathname,
      shopId: u.searchParams.get("shopId"),
      productId: u.searchParams.get("productId"),
      title: document.querySelector("[data-shop-product-title]")?.textContent?.trim() || "",
      price: document.querySelector("[data-shop-product-price]")?.textContent?.trim() || "",
      layoutHidden: document.querySelector("[data-shop-product-layout]")?.hidden ?? true,
      status: document.querySelector("[data-shop-product-status]")?.textContent?.trim() || "",
      hasShopHeader: Boolean(document.querySelector("[data-shop-store-market-header]")),
      hasMarketHeader: Boolean(document.querySelector(".tasful-market-mall-header")),
      hasCartBtn: Boolean(document.querySelector("[data-shop-product-add-cart]")),
      shopLink:
        document.querySelector("[data-shop-product-shop-link]")?.getAttribute("href") ||
        document.querySelector("[data-shop-product-shop-name] a")?.getAttribute("href") ||
        "",
      expectedShopId: shopId,
    };
  }, expectedShopId);
}

function isStoreProductDetailOk(pd, expectedShopId) {
  return (
    pd.path.endsWith("/detail-shop-store-product.html") &&
    !pd.layoutHidden &&
    Boolean(pd.title) &&
    Boolean(pd.price) &&
    pd.hasShopHeader &&
    !pd.hasMarketHeader &&
    pd.hasCartBtn &&
    pd.shopId === expectedShopId &&
    !/見つかりません/.test(pd.status)
  );
}

// ── ① 店舗一覧 27件 ──
await page.setViewportSize({ width: 1280, height: 900 });
await loadAllVendorCards();
const vendorCards = await page.evaluate(() =>
  Array.from(document.querySelectorAll("[data-shop-store-grid] .shop-store-card[data-id]")).map((card) => {
    const id = card.getAttribute("data-id") || "";
    const detailHref =
      card.querySelector('a[href*="detail-shop-store"]')?.getAttribute("href") ||
      card.querySelector('.shop-store-btn--detail[href*="detail-shop"]')?.getAttribute("href") ||
      "";
    const productsHref = card.querySelector('a[href*="shop-products"]')?.getAttribute("href") || "";
    return { id, detailHref, productsHref };
  })
);
await shot("01-shop-vendors-pc1280.png", "1280");
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(buildLocalPageUrl(base, "shop-vendors.html"), { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
await shot("02-shop-vendors-390.png", "390");

const vendorCountOk = vendorCards.length === 27;
record("1", "店舗一覧27件", vendorCountOk, `${vendorCards.length}件`);

// ── ② 店舗詳細（全カード） ──
const storeDetailFails = [];
for (const card of vendorCards) {
  if (!card.id) continue;
  await page.setViewportSize({ width: 1280, height: 900 });
  const href = card.detailHref || `detail-shop-store.html?id=${encodeURIComponent(card.id)}`;
  if (!href.includes("detail-shop-store.html")) {
    storeDetailFails.push({ id: card.id, reason: "href not detail-shop-store", href });
    continue;
  }
  await page.goto(buildLocalPageUrl(base, href.replace(/^\//, "")), { waitUntil: "domcontentloaded" });
  try {
    await waitStoreDetail();
  } catch {
    storeDetailFails.push({ id: card.id, reason: "timeout" });
    continue;
  }
  const st = await page.evaluate(() => ({
    title: document.querySelector("[data-biz-detail-title]")?.textContent?.trim() || "",
    rootHidden: document.querySelector("[data-biz-detail-root]")?.hidden,
    status: document.querySelector("[data-listing-detail-status]")?.textContent?.trim() || "",
  }));
  if (st.rootHidden || /見つかりません/.test(st.status) || !st.title) {
    storeDetailFails.push({ id: card.id, reason: st.status || "no title" });
  }
}
record("2", "店舗詳細（27店）", storeDetailFails.length === 0, `NG ${storeDetailFails.length}件`, {
  failures: storeDetailFails.slice(0, 8),
});

await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(buildLocalPageUrl(base, `detail-shop-store.html?id=${SAMPLE_SHOP}`), { waitUntil: "domcontentloaded" });
await waitStoreDetail();
await shot("03-detail-shop-store-pc1280.png", "1280");
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(500);
await shot("04-detail-shop-store-390.png", "390");

// ── ③ 商品一覧（27店） ──
const productsFails = [];
const productHrefsByShop = new Map();
for (const card of vendorCards) {
  const productsPage = await browser.newPage();
  await productsPage.setViewportSize({ width: 1280, height: 900 });
  await productsPage.goto(buildLocalPageUrl(base, `shop-products.html?id=${encodeURIComponent(card.id)}`), {
    waitUntil: "domcontentloaded",
  });
  await productsPage.waitForFunction(
    () => document.querySelectorAll(".shop-products-card__link").length > 0,
    { timeout: 15000 }
  );
  await productsPage.waitForTimeout(700);
  const st = await productsPage.evaluate(() => ({
    error: document.querySelector(".shop-products-error")?.textContent?.trim() || "",
    cards: document.querySelectorAll(".shop-products-card__link").length,
    hrefs: [...document.querySelectorAll(".shop-products-card__link")]
      .slice(0, 3)
      .map((a) => a.getAttribute("href") || ""),
    usesStoreProduct: [...document.querySelectorAll(".shop-products-card__link")]
      .slice(0, 3)
      .every((a) => /detail-shop-store-product\.html/.test(a.getAttribute("href") || "")),
  }));
  await productsPage.close();
  productHrefsByShop.set(card.id, st.hrefs.filter(Boolean));
  if (st.error || st.cards === 0 || !st.usesStoreProduct) {
    productsFails.push({
      id: card.id,
      error: st.error || (st.cards === 0 ? "no cards" : "card href not detail-shop-store-product"),
    });
  }
}
record("3", "商品一覧（27店）", productsFails.length === 0, `NG ${productsFails.length}件`, {
  failures: productsFails,
});

await page.goto(buildLocalPageUrl(base, `shop-products.html?id=${SAMPLE_SHOP}`), { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);
await page.setViewportSize({ width: 1280, height: 900 });
await shot("05-shop-products-pc1280.png", "1280");
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(400);
await shot("06-shop-products-390.png", "390");

// ── ④ 店舗販売商品詳細UI（代表店・PC/390） ──
async function verifyStoreProductUi(viewportTag, width, height) {
  await page.setViewportSize({ width, height });
  await page.goto(buildLocalPageUrl(base, buildStoreProductUrl(SAMPLE_SHOP, SAMPLE_PRODUCT)), {
    waitUntil: "domcontentloaded",
  });
  try {
    await waitStoreProductDetail();
  } catch {
    return { pass: false, reason: "timeout" };
  }
  await page.waitForTimeout(800);
  const pd = await evaluateStoreProductDetail(SAMPLE_SHOP);
  const shopLinkOk = pd.shopLink.includes("detail-shop-store.html") && pd.shopLink.includes(`id=${SAMPLE_SHOP}`);
  const pass = isStoreProductDetailOk(pd, SAMPLE_SHOP) && shopLinkOk;
  await shot(`07-detail-store-product-${viewportTag}.png`, viewportTag);
  return {
    pass,
    pd,
    shopLinkOk,
    reason: pass
      ? "店舗販売商品詳細UI OK"
      : [
          !pd.title && "no title",
          !pd.price && "no price",
          !pd.hasShopHeader && "no shop header",
          pd.hasMarketHeader && "market header visible",
          !pd.hasCartBtn && "no cart btn",
          !shopLinkOk && `shop link NG: ${pd.shopLink}`,
        ]
          .filter(Boolean)
          .join("; "),
  };
}

const storeProductPc = await verifyStoreProductUi("pc1280", 1280, 900);
const storeProduct390 = await verifyStoreProductUi("390", 390, 844);
record(
  "4",
  "店舗販売商品詳細 PC1280",
  storeProductPc.pass,
  storeProductPc.reason,
  { sample: storeProductPc.pd }
);
record(
  "4b",
  "店舗販売商品詳細 390px",
  storeProduct390.pass,
  storeProduct390.reason,
  { sample: storeProduct390.pd }
);

await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(buildLocalPageUrl(base, buildStoreProductUrl(SAMPLE_SHOP, SAMPLE_PRODUCT)), {
  waitUntil: "domcontentloaded",
});
await waitStoreProductDetail();
await page.waitForTimeout(500);
await shot("08-detail-store-product-pc1280.png", "1280");
await page.setViewportSize({ width: 390, height: 844 });
await shot("09-detail-store-product-390.png", "390");

// ── ⑤ 店舗リンク + 先頭3商品×27店 ──
let detailOk = 0;
let detailNg = 0;
const sellerFails = [];
const detailFails = [];
const shopProductPass = new Map();
for (const card of vendorCards) {
  shopProductPass.set(card.id, []);
  const hrefs = (productHrefsByShop.get(card.id) || []).filter(
    (href) => href && !/productId=demo-other-0(?:&|$)/.test(href)
  );
  for (const href of hrefs) {
    if (!href) continue;
    await page.setViewportSize({ width: 1280, height: 900 });
    if (!/detail-shop-store-product\.html/.test(href)) {
      detailNg += 1;
      shopProductPass.get(card.id).push(false);
      detailFails.push({ shopId: card.id, href, reason: "href not detail-shop-store-product" });
      continue;
    }
    await page.goto(buildLocalPageUrl(base, href.replace(/^\//, "")), { waitUntil: "domcontentloaded" });
    try {
      await waitStoreProductDetail();
    } catch {
      detailNg += 1;
      shopProductPass.get(card.id).push(false);
      detailFails.push({ shopId: card.id, href, reason: "timeout" });
      continue;
    }
    await page.waitForTimeout(400);
    const pd = await evaluateStoreProductDetail(card.id);
    if (isTerminalProductError(pd)) {
      detailNg += 1;
      shopProductPass.get(card.id).push(false);
      detailFails.push({ shopId: card.id, href, reason: pd.status, shopLink: pd.shopLink });
      continue;
    }
    const ok = isStoreProductDetailOk(pd, card.id);
    const shopLinkOk =
      pd.shopLink.includes("detail-shop-store.html") && pd.shopLink.includes(`id=${encodeURIComponent(card.id)}`);
    shopProductPass.get(card.id).push(ok);
    if (ok) {
      detailOk += 1;
      if (!shopLinkOk) {
        sellerFails.push({ shopId: card.id, shopLink: pd.shopLink });
      }
    } else {
      detailNg += 1;
      detailFails.push({
        shopId: card.id,
        href,
        reason: pd.status || pd.title || "fail",
        shopLink: pd.shopLink,
      });
    }
  }
}
const shopsWithoutProductDetail = [...shopProductPass.entries()]
  .filter(([, results]) => !results.some(Boolean))
  .map(([shopId]) => shopId);
record("5", "店舗リンク→detail-shop-store", sellerFails.length === 0, `NG ${sellerFails.length}件`, {
  failures: sellerFails.slice(0, 5),
});
record(
  "5b",
  "商品詳細表示（先頭3×27店）",
  detailNg === 0 && shopsWithoutProductDetail.length === 0,
  `OK ${detailOk} / NG ${detailNg} · 店舗ゼロ件 ${shopsWithoutProductDetail.length}`,
  {
    failures: detailFails.slice(0, 8),
    shopsWithoutProductDetail,
  }
);

// ── ⑥⑦⑧ 購入フロー（shop-store-cart/checkout/complete） ──
async function runPurchaseFlow(viewportTag, width, height) {
  await clearCart();
  await page.setViewportSize({ width, height });

  await page.goto(buildLocalPageUrl(base, buildStoreProductUrl(SAMPLE_SHOP, SAMPLE_PRODUCT)), {
    waitUntil: "domcontentloaded",
  });
  await waitStoreProductDetail();
  await page.waitForTimeout(800);

  const addOk = await page.evaluate(() => {
    const btn = document.querySelector("[data-shop-product-add-cart]");
    if (!btn || btn.disabled) return false;
    btn.click();
    const items = JSON.parse(localStorage.getItem("tasu_market_cart_items") || "[]");
    return Array.isArray(items) && items.length > 0;
  });
  if (!addOk) return { pass: false, step: "cart-add" };

  await page.goto(buildLocalPageUrl(base, "shop-store-cart.html"), { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  const cartSt = await page.evaluate(() => ({
    path: location.pathname,
    summary: document.querySelector("[data-shop-store-cart-summary]")?.textContent?.trim() || "",
    items: document.querySelectorAll(".tasful-market-cart-item").length,
    checkoutHidden: document.querySelector("[data-shop-store-cart-checkout-aside], [data-shop-store-cart-checkout]")
      ?.hidden,
    hasMarketPath: /shop-market-cart/.test(location.pathname),
  }));
  await shot(`10-cart-${viewportTag}.png`, viewportTag);
  const cartOk =
    cartSt.path.endsWith("/shop-store-cart.html") && !cartSt.hasMarketPath && (!/空/.test(cartSt.summary) || cartSt.items > 0);
  if (!cartOk) return { pass: false, step: "cart-page", cartSt };

  await page.goto(buildLocalPageUrl(base, "shop-store-checkout.html?mode=cart"), { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);

  const checkoutSt = await page.evaluate(() => ({
    path: location.pathname,
    status: document.querySelector("[data-shop-store-checkout-status]")?.textContent?.trim() || "",
    layoutHidden: document.querySelector("[data-shop-store-checkout-layout]")?.hidden,
    items: document.querySelectorAll(".tasful-market-checkout-item").length,
    hasMarketHeader: Boolean(document.querySelector(".tasful-market-mall-header")),
  }));
  await shot(`11-checkout-${viewportTag}.png`, viewportTag);
  if (
    !checkoutSt.path.endsWith("/shop-store-checkout.html") ||
    (/商品がありません|空|指定/.test(checkoutSt.status) && checkoutSt.items === 0)
  ) {
    return { pass: false, step: "checkout-empty", checkoutSt };
  }

  await page.evaluate(() => {
    document.querySelector("[data-shop-store-checkout-submit], [data-shop-store-checkout-submit-aside]")?.click();
  });
  await page.waitForTimeout(2000);

  let onComplete = /shop-store-complete\.html/.test(page.url());
  if (!onComplete) {
    await page.waitForURL(/shop-store-complete\.html/, { timeout: 12000 }).catch(() => {});
    onComplete = /shop-store-complete\.html/.test(page.url());
  }
  if (!onComplete) {
    return { pass: false, step: "complete-fail", checkoutSt };
  }

  await page.waitForTimeout(800);
  const completeSt = await page.evaluate(() => ({
    url: location.href,
    title: document.querySelector(".shop-store-complete-card__title")?.textContent?.trim() || "",
    orderId: document.querySelector("[data-shop-store-complete-order-id]")?.textContent?.trim() || "",
    shopLink: document.querySelector("[data-shop-store-complete-shop-link]")?.getAttribute("href") || "",
  }));
  await shot(`12-complete-${viewportTag}.png`, viewportTag);
  const completeOk =
    /ご注文|ありがとう/.test(completeSt.title) ||
    completeSt.orderId ||
    (/shop-store-complete/.test(completeSt.url) && completeSt.shopLink.includes("detail-shop-store.html"));
  return {
    pass: cartOk && completeOk,
    step: completeOk ? "done" : "complete-fail",
    cartSt,
    checkoutSt,
    completeSt,
    reachedComplete: onComplete,
  };
}

const flowPc = await runPurchaseFlow("pc1280", 1280, 900);
record("6", "カート投入 PC1280", flowPc.step !== "cart-add", flowPc.step === "cart-add" ? "失敗" : "OK");
record("7", "注文確認 PC1280", !["checkout-empty", "cart-add", "cart-page"].includes(flowPc.step), flowPc.step, flowPc.checkoutSt);
record("8", "注文完了 PC1280", flowPc.pass, flowPc.completeSt?.title || flowPc.step, flowPc);

await clearCart();
const flow390 = await runPurchaseFlow("390", 390, 844);
record("6b", "カート投入 390px", flow390.step !== "cart-add", flow390.step === "cart-add" ? "失敗" : "OK");
record("7b", "注文確認 390px", !["checkout-empty", "cart-add", "cart-page"].includes(flow390.step), flow390.step, flow390.checkoutSt);
record("8b", "注文完了 390px", flow390.pass, flow390.completeSt?.title || flow390.step, flow390);

report.summary = {
  ok: report.ok,
  ng: report.ng,
  total: report.checks.length,
  allPass: report.ng === 0,
};

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(
  JSON.stringify(
    {
      ok: report.ok,
      ng: report.ng,
      allPass: report.ng === 0,
      checks: report.checks.map((c) => ({ id: c.id, name: c.name, pass: c.pass, detail: c.detail })),
    },
    null,
    2
  )
);
await browser.close();
process.exit(report.ng === 0 ? 0 : 1);
