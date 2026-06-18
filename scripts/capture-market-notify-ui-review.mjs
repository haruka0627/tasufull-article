#!/usr/bin/env node
/**
 * TASFUL市場通知 — Gemini UI/UX レビュー用スクリーンショット一式（390px + PC）
 * 出力:
 *   screenshots/market-notify-390/
 *   screenshots/market-notify-pc/
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { devices } from "playwright";
import { buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const PRODUCT = { shopId: "demo-shop-tasful-bakery", productId: "p-0" };
const BUYER_ID = "u_me";
const SELLER_ID = "u_bakery";

const NOTIFY_CASES = [
  {
    id: "01-purchase",
    notifyIdPrefix: "market-order-purchase-",
    recipient: "seller",
    sellerAction: null,
    destPattern: /shop-market-seller-orders\.html/i,
  },
  {
    id: "02-order-accepted",
    notifyIdPrefix: "market-order-accepted-",
    recipient: "buyer",
    sellerAction: "注文受付",
    destPattern: /shop-market-order-history\.html/i,
  },
  {
    id: "03-preparing",
    notifyIdPrefix: "market-order-preparing-",
    recipient: "buyer",
    sellerAction: "発送準備中",
    destPattern: /shop-market-order-history\.html.*detail=1/i,
  },
  {
    id: "04-shipped",
    notifyIdPrefix: "market-order-shipped-",
    recipient: "buyer",
    sellerAction: "発送済み",
    destPattern: /shop-market-order-history\.html.*detail=1/i,
  },
  {
    id: "05-delivered",
    notifyIdPrefix: "market-order-delivered-",
    recipient: "buyer",
    sellerAction: "配達完了",
    destPattern: /shop-market-order-history\.html/i,
  },
  {
    id: "06-review",
    notifyIdPrefix: "market-order-review-",
    recipient: "buyer",
    sellerAction: null,
    destPattern: /detail-shop-product\.html.*review=1/i,
  },
];

const VIEWPORTS = [
  { key: "390", outDir: "market-notify-390", width: 390, height: 844, device: "iPhone 13", hasTouch: true },
  { key: "pc", outDir: "market-notify-pc", width: 1280, height: 900, device: null, hasTouch: false },
];

function talkNotifyUrl(base, userId) {
  return buildLocalPageUrl(
    base,
    "talk-home.html",
    `?tab=notify&talkDev=1&benchEmbed=1&userId=${encodeURIComponent(userId)}`
  );
}

async function runMarketFlow(page, base) {
  await page.goto(buildLocalPageUrl(base, "shop-store.html"), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.evaluate(() => {
    localStorage.removeItem("tasu_market_order_history");
    localStorage.removeItem("tasu_market_last_order");
    localStorage.removeItem("tasu_market_cart_count");
    localStorage.removeItem("tasu_market_cart_items");
    localStorage.removeItem("tasu_market_notify_sent_v1");
    localStorage.removeItem("tasful_talk_notifications");
    sessionStorage.removeItem("tasuMarketFullFlowInit");
  });

  await page.goto(
    buildLocalPageUrl(
      base,
      "detail-shop-product.html",
      `?shopId=${PRODUCT.shopId}&productId=${PRODUCT.productId}`
    ),
    { waitUntil: "domcontentloaded" }
  );
  await page.waitForSelector("[data-tasful-product-buy-now]", { timeout: 20000 });
  await page.click("[data-tasful-product-buy-now]");
  await page.waitForURL(/shop-market-checkout\.html/, { timeout: 15000 });
  await page.click("[data-tasful-checkout-submit]");
  await page.waitForURL(/shop-market-complete\.html/, { timeout: 15000 });

  const orderId = await page.evaluate(() =>
    document.querySelector("[data-tasful-complete-order-id]")?.textContent?.replace(/^注文番号:\s*/, "").trim()
  );
  if (!orderId) throw new Error("注文IDを取得できません");

  const sellerOrdersUrl = buildLocalPageUrl(
    base,
    "shop-market-seller-orders.html",
    `?shopId=${PRODUCT.shopId}`
  );

  for (const spec of NOTIFY_CASES) {
    if (!spec.sellerAction) continue;
    await page.goto(sellerOrdersUrl, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(`[data-tasful-seller-order-card][data-order-id="${orderId}"]`, { timeout: 15000 });
    await page.click(
      `[data-tasful-seller-order-card][data-order-id="${orderId}"] [data-tasful-seller-status-btn][data-status="${spec.sellerAction}"]`
    );
    await page.waitForTimeout(350);
  }

  return orderId;
}

async function openNotifyTab(page, base, userId) {
  await page.goto(talkNotifyUrl(base, userId), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector('[data-talk-panel="notify"]:not([hidden])', { timeout: 20000 });
  await page.waitForSelector("[data-talk-notify-list]", { timeout: 20000 });
  await page.waitForTimeout(800);
}

async function scrollMarketCardsIntoView(page, orderId) {
  await page.evaluate((oid) => {
    const ids = [
      `market-order-purchase-${oid}`,
      `market-order-accepted-${oid}`,
      `market-order-preparing-${oid}`,
      `market-order-shipped-${oid}`,
      `market-order-delivered-${oid}`,
      `market-order-review-${oid}`,
    ];
    ids.forEach((id) => {
      document.querySelector(`[data-talk-notify-id="${id}"]`)?.scrollIntoView({ block: "nearest" });
    });
    document.querySelector("[data-talk-notify-list]")?.scrollTo(0, 0);
  }, orderId);
  await page.waitForTimeout(400);
}

async function captureNotifyCase(page, base, outDir, orderId, spec) {
  const notifyId = `${spec.notifyIdPrefix}${orderId}`;
  const userId = spec.recipient === "seller" ? SELLER_ID : BUYER_ID;

  await openNotifyTab(page, base, userId);
  await page.evaluate((id) => {
    document.querySelector(`[data-talk-notify-id="${id}"]`)?.scrollIntoView({ block: "center" });
  }, notifyId);
  await page.waitForSelector(`[data-talk-notify-id="${notifyId}"]`, { timeout: 20000 });
  await page.waitForTimeout(500);

  const listPath = path.join(outDir, `market-notify-${spec.id}-talk-list.png`);
  const cardPath = path.join(outDir, `market-notify-${spec.id}-card.png`);
  const primaryPath = path.join(outDir, `market-notify-${spec.id}.png`);
  const destPath = path.join(outDir, `market-notify-${spec.id}-dest.png`);

  await page.screenshot({ path: listPath, fullPage: false });
  await page.locator(`[data-talk-notify-id="${notifyId}"]`).screenshot({ path: cardPath });
  fs.copyFileSync(cardPath, primaryPath);

  const cta = page.locator(`[data-talk-notify-id="${notifyId}"] [data-talk-notify-action]`).first();
  const card = page.locator(`[data-talk-notify-id="${notifyId}"]`).first();
  await card.scrollIntoViewIfNeeded();
  if (await cta.count()) {
    await cta.click({ timeout: 15000 });
  } else {
    await card.click({ timeout: 15000 });
  }
  await page.waitForURL((url) => spec.destPattern.test(url.href), { timeout: 15000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: destPath, fullPage: false });

  return {
    id: spec.id,
    notifyId,
    userId,
    list: listPath,
    card: cardPath,
    primary: primaryPath,
    dest: destPath,
    destUrl: page.url(),
  };
}

async function captureListOverview(page, base, outDir, orderId, viewportKey) {
  const manifest = { viewport: viewportKey, orderId, shots: {} };

  await openNotifyTab(page, base, BUYER_ID);
  await scrollMarketCardsIntoView(page, orderId);
  const buyerFull = path.join(outDir, "market-notify-buyer-list-full.png");
  const listEl = page.locator("[data-talk-notify-list]");
  await listEl.screenshot({ path: buyerFull });
  manifest.shots.buyerList = buyerFull;

  const buyerCount = await page.evaluate((oid) => {
    const prefix = `market-order-`;
    const suffix = `-${oid}`;
    return [...document.querySelectorAll("[data-talk-notify-id]")].filter((el) => {
      const id = el.getAttribute("data-talk-notify-id") || "";
      return id.startsWith(prefix) && id.endsWith(suffix) && !id.includes("purchase");
    }).length;
  }, orderId);
  manifest.buyerMarketCount = buyerCount;

  await openNotifyTab(page, base, SELLER_ID);
  const sellerFull = path.join(outDir, "market-notify-seller-list-full.png");
  await page.locator("[data-talk-notify-list]").screenshot({ path: sellerFull });
  manifest.shots.sellerList = sellerFull;

  await openNotifyTab(page, base, BUYER_ID);
  await page.evaluate((oid) => {
    const list = document.querySelector("[data-talk-notify-list]");
    if (!list) return;
    list.scrollTop = 0;
    const cards = [...list.querySelectorAll("[data-talk-notify-id]")].filter((el) => {
      const id = el.getAttribute("data-talk-notify-id") || "";
      return id.startsWith("market-order-") && id.endsWith(`-${oid}`) && !id.includes("purchase");
    });
    if (cards[0]) cards[0].scrollIntoView({ block: "start" });
  }, orderId);
  await page.waitForTimeout(400);
  const allBuyerTypes = path.join(outDir, "market-notify-all6-buyer-types.png");
  await page.screenshot({ path: allBuyerTypes, fullPage: false });
  manifest.shots.allBuyerTypes = allBuyerTypes;

  await openNotifyTab(page, base, SELLER_ID);
  const purchaseId = `market-order-purchase-${orderId}`;
  await page.evaluate((id) => {
    document.querySelector(`[data-talk-notify-id="${id}"]`)?.scrollIntoView({ block: "center" });
  }, purchaseId);
  await page.waitForTimeout(400);
  const sellerPurchase = path.join(outDir, "market-notify-all6-seller-purchase.png");
  await page.screenshot({ path: sellerPurchase, fullPage: false });
  manifest.shots.sellerPurchase = sellerPurchase;

  const indexPath = path.join(outDir, "market-notify-index-all6.png");
  await page.goto(talkNotifyUrl(base, BUYER_ID), { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-talk-panel="notify"]:not([hidden])', { timeout: 20000 });
  await page.evaluate((oid) => {
    const list = document.querySelector("[data-talk-notify-list]");
    if (!list) return;
    const cards = [...list.querySelectorAll("[data-talk-notify-id]")].filter((el) => {
      const id = el.getAttribute("data-talk-notify-id") || "";
      return id.startsWith("market-order-") && id.endsWith(`-${oid}`) && !id.includes("purchase");
    });
    cards.forEach((c) => c.scrollIntoView({ block: "nearest" }));
    list.scrollTop = 0;
  }, orderId);
  await page.waitForTimeout(500);
  await page.locator("[data-talk-notify-list]").screenshot({ path: indexPath, fullPage: true });
  manifest.shots.indexAll6 = indexPath;

  return manifest;
}

const base = await findDevServerBaseUrl({ probePath: "shop-store.html" });
const browser = await chromium.launch({ headless: true });
const report = {
  generatedAt: new Date().toISOString(),
  baseUrl: base,
  orderId: "",
  product: PRODUCT,
  viewports: {},
};

for (const vp of VIEWPORTS) {
  const outDir = path.join(ROOT, "screenshots", vp.outDir);
  fs.mkdirSync(outDir, { recursive: true });

  const contextOptions = vp.device
    ? { ...devices[vp.device], viewport: { width: vp.width, height: vp.height }, hasTouch: vp.hasTouch }
    : { viewport: { width: vp.width, height: vp.height }, hasTouch: false };

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  const orderId = await runMarketFlow(page, base);
  report.orderId = orderId;

  const cases = [];
  for (const spec of NOTIFY_CASES) {
    cases.push(await captureNotifyCase(page, base, outDir, orderId, spec));
  }

  const overview = await captureListOverview(page, base, outDir, orderId, vp.key);

  report.viewports[vp.key] = {
    outDir: outDir.replace(/\\/g, "/"),
    viewport: { width: vp.width, height: vp.height },
    cases,
    overview,
  };

  await context.close();
}

const manifestPath = path.join(ROOT, "screenshots", "market-notify-390", "ui-review-manifest.json");
fs.writeFileSync(manifestPath, JSON.stringify(report, null, 2), "utf8");

await browser.close();
console.log(JSON.stringify({ ok: true, orderId: report.orderId, manifestPath }, null, 2));
