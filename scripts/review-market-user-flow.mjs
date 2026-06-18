#!/usr/bin/env node
/**
 * 市場 利用者導線総監査
 *   node scripts/review-market-user-flow.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launchHeadlessBrowser } from "./lib/playwright-browser.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SHOT_DIR = join(root, "screenshots", "market-user-flow-review");
const REPORT_MD = join(SHOT_DIR, "review-report.md");
const REPORT_JSON = join(SHOT_DIR, "review-report.json");

const PRODUCT = { shopId: "demo-shop-tasful-bakery", productId: "p-0", titleHint: /ベーカリー|bakery|クロワッサン|パン/i };
const PRODUCT_NO_CONNECT = { shopId: "demo-shop-bakery", productId: "p-0" };
const BUYER_ID = "u_me";
const SELLER_ID = "u_bakery";
const MARKET_SOURCE = "shop_market_order_v1";

const MARKET_KEYS = [
  "tasu_market_order_history",
  "tasu_market_last_order",
  "tasu_market_cart_count",
  "tasu_market_cart_items",
  "tasu_market_notify_sent_v1",
  "tasu_market_admin_events_v1",
  "tasful_talk_notifications",
  "tasful_talk_notifications_seeded_v2",
  "tasful_platform_notify_master_v1",
  "tasful_platform_notify_master_v2",
  "tasful_builder_notify_master_v1",
  "tasful_anpi_notify_master_v1",
  "tasful_platform_fee_notify_master_v2",
];

const NOTIFY_STEPS = [
  { id: "purchase", recipient: SELLER_ID, prefix: "market-order-purchase-", title: "新しい注文が入りました", sellerAction: null },
  { id: "accepted", recipient: BUYER_ID, prefix: "market-order-accepted-", title: "注文を受け付けました", sellerAction: "注文受付" },
  { id: "preparing", recipient: BUYER_ID, prefix: "market-order-preparing-", title: "発送準備中です", sellerAction: "発送準備中" },
  { id: "shipped", recipient: BUYER_ID, prefix: "market-order-shipped-", title: "商品を発送しました", sellerAction: "発送済み" },
  { id: "delivered", recipient: BUYER_ID, prefix: "market-order-delivered-", title: "配達が完了しました", sellerAction: "配達完了" },
];

const NAV_TIMEOUT = 20000;
const SEL_TIMEOUT = 12000;

async function findBaseUrl() {
  const ports = [5500, 5173, 5176, 8765, 5199];
  const hosts = ["http://127.0.0.1", "http://localhost"];
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 2500);
  try {
    for (const host of hosts) {
      for (const port of ports) {
        try {
          const base = `${host}:${port}`;
          const res = await fetch(`${base}/shop-store.html`, { method: "HEAD", signal: ctrl.signal });
          if (res.ok) return base;
        } catch {
          /* next */
        }
      }
    }
  } finally {
    clearTimeout(timer);
  }
  return null;
}

function pageUrl(base, rel) {
  if (base) return `${base.replace(/\/$/, "")}/${rel.replace(/^\//, "")}`;
  return pathToFileURL(join(root, rel)).href;
}

function notifyHomeUrl(base, userId) {
  const u = new URL(pageUrl(base, "talk-home.html"));
  u.searchParams.set("tab", "notify");
  u.searchParams.set("talkDev", "1");
  u.searchParams.set("benchEmbed", "1");
  u.searchParams.set("userId", userId);
  return u.toString();
}

async function gotoWithRetry(page, url, options = {}) {
  const { retries = 2, ...gotoOpts } = options;
  let lastErr = null;
  for (let i = 0; i < retries; i += 1) {
    try {
      await page.goto(url, gotoOpts);
      return;
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message || err);
      if (!/ERR_ABORTED|NS_BINDING_ABORTED|interrupted/i.test(msg) || i + 1 >= retries) throw err;
      await page.waitForTimeout(400);
    }
  }
  throw lastErr;
}

async function shot(page, name) {
  const path = join(SHOT_DIR, `${name}.png`);
  await page.screenshot({ path, fullPage: false, timeout: 15000, animations: "disabled" }).catch(() => {});
  return path;
}

async function resetMarketStores(page) {
  await page.evaluate((keys) => {
    sessionStorage.removeItem("__marketUserFlowAuditBoot");
    sessionStorage.removeItem("tasuMarketFullFlowInit");
    keys.forEach((k) => localStorage.removeItem(k));
  }, MARKET_KEYS);
}

async function waitForMarketProductReady(page) {
  await page.waitForSelector("[data-tasful-product-main]:not([hidden])", { timeout: SEL_TIMEOUT });
  await page.waitForSelector("[data-tasful-product-title]", { timeout: SEL_TIMEOUT });
  await page.waitForTimeout(350);
}

async function waitForShopStoreProductReady(page) {
  await page.waitForSelector("[data-shop-product-layout]:not([hidden])", { timeout: SEL_TIMEOUT });
  await page.waitForTimeout(350);
}

async function clickVisibleMarketBuyNow(page) {
  const btn = page
    .locator("[data-tasful-product-buy-now]:visible, [data-tasful-product-buy-now-pc]:visible")
    .first();
  await btn.waitFor({ state: "visible", timeout: SEL_TIMEOUT });
  await btn.click();
}

async function clickVisibleMarketCheckoutSubmit(page) {
  await page.waitForSelector("[data-tasful-checkout-body]:not([hidden])", { timeout: SEL_TIMEOUT });
  const btn = page
    .locator("[data-tasful-checkout-submit]:visible, [data-tasful-checkout-submit-aside]:visible")
    .first();
  await btn.waitFor({ state: "visible", timeout: SEL_TIMEOUT });
  await btn.click();
}

async function clickVisibleShopStoreCheckoutSubmit(page) {
  await page.waitForSelector("[data-shop-store-checkout-body]:not([hidden])", { timeout: SEL_TIMEOUT });
  const btn = page
    .locator("[data-shop-store-checkout-submit]:visible, [data-shop-store-checkout-submit-aside]:visible")
    .first();
  await btn.waitFor({ state: "visible", timeout: SEL_TIMEOUT });
  await btn.click();
}

async function runMarketPurchase(page, base) {
  const detailUrl = pageUrl(
    base,
    `detail-shop-product.html?shopId=${PRODUCT.shopId}&productId=${PRODUCT.productId}`
  );
  await gotoWithRetry(page, detailUrl, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
  await waitForMarketProductReady(page);
  await clickVisibleMarketBuyNow(page);
  await page.waitForURL(/shop-market-checkout\.html/, { timeout: NAV_TIMEOUT });
  await clickVisibleMarketCheckoutSubmit(page);
  await page.waitForURL(/shop-market-complete\.html/, { timeout: NAV_TIMEOUT });
  const orderId = await page.evaluate(() => {
    const text = document.querySelector("[data-tasful-complete-order-id]")?.textContent || "";
    return text.replace(/^注文番号:\s*/, "").trim();
  });
  return orderId;
}

async function advanceSellerStatuses(page, base, orderId) {
  const sellerUrl = pageUrl(base, `shop-market-seller-orders.html?shopId=${PRODUCT.shopId}`);
  for (const step of NOTIFY_STEPS) {
    if (!step.sellerAction) continue;
    await gotoWithRetry(page, sellerUrl, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
    await page.waitForSelector(`[data-tasful-seller-order-card][data-order-id="${orderId}"]`, {
      timeout: SEL_TIMEOUT,
    });
    await page.click(
      `[data-tasful-seller-order-card][data-order-id="${orderId}"] [data-tasful-seller-status-btn][data-status="${step.sellerAction}"]`
    );
    await page.waitForTimeout(500);
  }
}

async function readNotifications(page) {
  return page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
    } catch {
      return [];
    }
  });
}

/* ── 確認1: 市場TOP ── */
async function auditTopFlow(page, base, vp) {
  const item = { id: "top", kind: "市場TOP", vp: vp.name, status: "FAIL", issues: [] };
  try {
    await gotoWithRetry(page, pageUrl(base, "shop-store.html"), {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT,
    });
    const top = await page.evaluate(() => ({
      hasHeader: Boolean(document.querySelector("[data-tasful-market-header]")),
      hasSearch: Boolean(document.querySelector("[data-tasful-market-search-input]")),
      hasNav: Boolean(document.querySelector("[data-tasful-market-nav]")),
      cardCount: document.querySelectorAll("a[href*='detail-shop-product'], a[href*='shop-search']").length,
    }));
    if (!top.hasHeader) item.issues.push("市場ヘッダーなし");
    if (!top.hasSearch) item.issues.push("検索入力なし");
    if (!top.cardCount) item.issues.push("TOP導線リンクなし");

    await gotoWithRetry(page, pageUrl(base, "shop-search.html?keyword=bakery"), {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT,
    });
    await page.waitForTimeout(800);
    const search = await page.evaluate(() => ({
      url: location.href,
      hasResults: document.querySelectorAll("a[href*='detail-shop-product'], .tasful-market-search-card, article").length,
      bodyHasBakery: /bakery|ベーカリー|パン/i.test(document.body.innerText || ""),
    }));
    if (!/shop-search\.html/i.test(search.url)) item.issues.push("検索URL不一致");
    if (!search.hasResults && !search.bodyHasBakery) item.issues.push("検索結果なし");

    item.top = top;
    item.search = search;
    item.status = item.issues.length ? "WARNING" : "PASS";
    await shot(page, `01-top-${vp.name}`);
  } catch (err) {
    item.issues.push(String(err?.message || err));
  }
  return item;
}

/* ── 確認2: 店舗導線 ── */
async function auditShopFlow(page, base, vp) {
  const item = { id: "shop", kind: "店舗導線", vp: vp.name, status: "FAIL", issues: [] };
  try {
    await gotoWithRetry(page, pageUrl(base, `detail-shop-store.html?id=${PRODUCT.shopId}`), {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT,
    });
    await page.waitForFunction(
      () => {
        const root = document.querySelector("[data-biz-detail-root]");
        return root && !root.hidden;
      },
      { timeout: SEL_TIMEOUT }
    ).catch(() => {});

    const store = await page.evaluate(() => ({
      title: document.querySelector("[data-biz-detail-title]")?.textContent?.trim() || "",
      hasProductsSection: Boolean(document.querySelector("[data-shop-section='products'], #section-products")),
      hasMenuTab: Boolean(document.querySelector("[data-shop-tab='menu'], [data-shop-sticky-nav='products']")),
    }));

    await gotoWithRetry(page, pageUrl(base, `shop-products.html?id=${PRODUCT.shopId}`), {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT,
    });
    await page.waitForSelector("[data-shop-products-grid]", { timeout: SEL_TIMEOUT }).catch(() => {});
    await page.waitForTimeout(800);

    const products = await page.evaluate(() => ({
      title: document.querySelector("[data-shop-products-title]")?.textContent?.trim() || "",
      cardCount: document.querySelectorAll("[data-shop-products-grid] a, .shop-products-card").length,
      hasAllLink: /すべて見る|もっと見る/.test(document.body.innerText || ""),
    }));

    if (!store.title) item.issues.push("店舗詳細タイトルなし");
    if (!products.cardCount) item.issues.push("商品一覧カード0件");

    item.store = store;
    item.products = products;
    item.status = item.issues.length ? "WARNING" : "PASS";
    await shot(page, `02-shop-${vp.name}`);
  } catch (err) {
    item.issues.push(String(err?.message || err));
  }
  return item;
}

/* ── 確認3: 商品導線 ── */
async function auditProductFlow(page, base, vp) {
  const item = { id: "product", kind: "商品導線", vp: vp.name, status: "FAIL", issues: [] };
  try {
    await gotoWithRetry(
      page,
      pageUrl(base, `detail-shop-product.html?shopId=${PRODUCT.shopId}&productId=${PRODUCT.productId}`),
      { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT }
    );
    await waitForMarketProductReady(page);
    const market = await page.evaluate(() => ({
      title: document.querySelector("[data-tasful-product-title]")?.textContent?.trim() || "",
      hasImage: Boolean(document.querySelector("[data-tasful-product-image][src]")),
      hasPrice: Boolean(document.querySelector("[data-tasful-product-price]")?.textContent?.trim()),
      hasConnect: /Connect/.test(document.body.innerText || ""),
      url: location.href,
    }));
    if (!market.title) item.issues.push("商品タイトルなし");
    if (!market.hasImage) item.issues.push("商品画像なし");
    if (!market.hasPrice) item.issues.push("価格なし");

    await gotoWithRetry(
      page,
      pageUrl(
        base,
        `detail-shop-product.html?shopId=${PRODUCT_NO_CONNECT.shopId}&productId=${PRODUCT_NO_CONNECT.productId}`
      ),
      { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT }
    );
    await page.waitForSelector("[data-tasful-product-title]", { timeout: SEL_TIMEOUT }).catch(() => {});
    const noConnect = await page.evaluate(() => {
      const trust = document.querySelector("[data-tasful-product-trust]")?.textContent || "";
      return {
        connectBadge: /Connect認証/.test(trust),
      };
    });

    item.market = market;
    item.noConnect = noConnect;
    item.status = item.issues.length ? "WARNING" : "PASS";
    await shot(page, `03-product-${vp.name}`);
  } catch (err) {
    item.issues.push(String(err?.message || err));
  }
  return item;
}

/* ── 確認4: 購入導線 ── */
async function auditPurchaseFlow(page, base, vp) {
  const item = { id: "purchase", kind: "購入導線", vp: vp.name, status: "FAIL", issues: [], orderId: "" };
  try {
    await gotoWithRetry(
      page,
      pageUrl(base, `detail-shop-product.html?shopId=${PRODUCT.shopId}&productId=${PRODUCT.productId}`),
      { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT }
    );
    await waitForMarketProductReady(page);
    const addCart = page
      .locator("[data-tasful-product-add-cart]:visible, [data-tasful-product-add-cart-pc]:visible")
      .first();
    await addCart.click().catch(() => {});
    await page.waitForTimeout(500);

    await gotoWithRetry(page, pageUrl(base, "shop-market-cart.html"), {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT,
    });
    await page
      .waitForSelector("[data-tasful-market-cart-items]:not([hidden])", { timeout: SEL_TIMEOUT })
      .catch(() => {});
    const cart = await page.evaluate(() => ({
      hasItems: document.querySelectorAll(".tasful-market-cart-item").length >= 1,
      hasCheckout: Boolean(document.querySelector("[data-tasful-market-cart-checkout]:not([hidden])")),
    }));
    if (!cart.hasItems) item.issues.push("カートに商品なし");

    const orderId = await runMarketPurchase(page, base);
    item.orderId = orderId;
    if (!orderId) item.issues.push("注文番号なし");

    const complete = await page.evaluate(() => ({
      orderText: document.querySelector("[data-tasful-complete-order-id]")?.textContent?.trim() || "",
      shop: document.querySelector("[data-tasful-complete-shop]")?.textContent?.trim() || "",
      product: document.querySelector("[data-tasful-complete-product]")?.textContent?.trim() || "",
      total: document.querySelector("[data-tasful-complete-total]")?.textContent?.trim() || "",
    }));
    if (!complete.shop || !complete.product) item.issues.push("完了画面の注文内容不足");

    item.cart = cart;
    item.complete = complete;
    item.status = orderId && item.issues.length <= 1 ? (item.issues.length ? "WARNING" : "PASS") : "FAIL";
    await shot(page, `04-purchase-${vp.name}`);
  } catch (err) {
    item.issues.push(String(err?.message || err));
  }
  return item;
}

/* ── 確認5/10: 通知 + 一致 ── */
async function auditNotifyFlows(page, base, vp, orderId) {
  const results = [];
  if (!orderId) {
    return [{ id: "notify", kind: "通知導線", vp: vp.name, status: "FAIL", issues: ["orderId未生成"] }];
  }

  await advanceSellerStatuses(page, base, orderId);
  const notifications = await readNotifications(page);

  for (const step of NOTIFY_STEPS) {
    const item = { ...step, kind: step.id, vp: vp.name, status: "FAIL", issues: [], notifyId: `${step.prefix}${orderId}` };
    const found = notifications.find(
      (n) =>
        n.id === item.notifyId &&
        String(n.recipientUserId || n.recipient_user_id) === step.recipient &&
        n.title === step.title &&
        n.source === MARKET_SOURCE
    );
    if (!found) item.issues.push(`通知未発火: ${item.notifyId}`);
    item.found = Boolean(found);
    item.status = found ? "PASS" : "FAIL";
    results.push(item);
  }

  await gotoWithRetry(page, notifyHomeUrl(base, BUYER_ID), {
    waitUntil: "domcontentloaded",
    timeout: NAV_TIMEOUT,
  });
  await page.waitForSelector("[data-talk-notify-list]", { state: "attached", timeout: SEL_TIMEOUT });
  await page.waitForTimeout(600);

  const buyerCards = await page.evaluate((oid) => {
    return [...document.querySelectorAll("[data-talk-notify-id]")].filter((el) => {
      const id = el.getAttribute("data-talk-notify-id") || "";
      return id.startsWith("market-order-") && id.endsWith(`-${oid}`);
    }).length;
  }, orderId);

  results.push({
    id: "talk_buyer_cards",
    kind: "購入者TALK通知表示",
    vp: vp.name,
    status: buyerCards >= 3 ? "PASS" : "WARNING",
    issues: buyerCards >= 3 ? [] : [`購入者通知カード ${buyerCards}件`],
    buyerCards,
  });

  await gotoWithRetry(page, notifyHomeUrl(base, SELLER_ID), {
    waitUntil: "domcontentloaded",
    timeout: NAV_TIMEOUT,
  });
  await page.waitForSelector("[data-talk-notify-list]", { state: "attached", timeout: SEL_TIMEOUT });
  const sellerVisible = await page.locator(`[data-talk-notify-id="market-order-purchase-${orderId}"]`).count();
  results.push({
    id: "talk_seller_purchase",
    kind: "出店者購入通知",
    vp: vp.name,
    status: sellerVisible ? "PASS" : "FAIL",
    issues: sellerVisible ? [] : ["出品者購入通知カードなし"],
  });

  await shot(page, `05-notify-${vp.name}`);
  return results;
}

/* ── 確認6: TALK連携（通知クリック→注文詳細） ── */
async function auditTalkFlow(page, base, vp, orderId) {
  const item = { id: "talk", kind: "TALK連携", vp: vp.name, status: "FAIL", issues: [] };
  if (!orderId) {
    item.issues.push("orderId未生成");
    return item;
  }
  try {
    await gotoWithRetry(page, notifyHomeUrl(base, BUYER_ID), {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT,
    });
    await page.waitForSelector(`[data-talk-notify-id="market-order-accepted-${orderId}"]`, {
      state: "attached",
      timeout: SEL_TIMEOUT,
    });
    const card = page.locator(`[data-talk-notify-id="market-order-accepted-${orderId}"]`).first();
    const btn = card.locator("[data-talk-notify-action], .talk-notify-card__minimal-action").first();
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT }).catch(() => {}),
      btn.click(),
    ]);
    const dest = page.url();
    if (!/shop-market-order-history\.html/i.test(dest)) item.issues.push(`遷移先不一致: ${dest}`);
    if (!dest.includes(orderId)) item.issues.push("URLに注文番号なし");

    const onPage = await page.evaluate((oid) => ({
      body: document.body.innerText || "",
      hasCard: Boolean(document.querySelector(`[data-tasful-order-card][data-order-id="${oid}"]`)),
    }), orderId);
    if (!onPage.hasCard && !onPage.body.includes(orderId)) item.issues.push("注文履歴に対象注文なし");

    item.destUrl = dest;
    item.status = item.issues.length ? "WARNING" : "PASS";
    await shot(page, `06-talk-${vp.name}`);
  } catch (err) {
    item.issues.push(String(err?.message || err));
  }
  return item;
}

/* ── 確認7: 注文履歴 ── */
async function auditOrderHistory(page, base, vp, orderId) {
  const item = { id: "history", kind: "注文履歴", vp: vp.name, status: "FAIL", issues: [] };
  if (!orderId) {
    item.issues.push("orderId未生成");
    return item;
  }
  try {
    await gotoWithRetry(page, pageUrl(base, `shop-market-order-history.html?orderId=${orderId}&detail=1`), {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT,
    });
    await page.waitForTimeout(900);
    const hist = await page.evaluate((oid) => {
      const card = document.querySelector(`[data-tasful-order-card][data-order-id="${oid}"]`);
      return {
        hasCard: Boolean(card),
        status: card?.querySelector(".tasful-market-order-history-card__status")?.textContent?.trim() || "",
        detail: Boolean(document.querySelector("[data-tasful-order-detail]")),
        body: document.body.innerText || "",
      };
    }, orderId);
    if (!hist.hasCard) item.issues.push("注文カードなし");
    if (!hist.status) item.issues.push("ステータス表示なし");
    if (!/\d|¥|円/.test(hist.body)) item.issues.push("金額表示なし");

    item.hist = hist;
    item.status = item.issues.length ? "WARNING" : "PASS";
    await shot(page, `07-history-${vp.name}`);
  } catch (err) {
    item.issues.push(String(err?.message || err));
  }
  return item;
}

/* ── 店舗販売チャネル ── */
async function auditShopStorePurchase(page, base, vp) {
  const item = { id: "shop_store", kind: "店舗販売購入", vp: vp.name, status: "FAIL", issues: [] };
  try {
    await gotoWithRetry(
      page,
      pageUrl(
        base,
        `detail-shop-store-product.html?shopId=${PRODUCT.shopId}&productId=${PRODUCT.productId}`
      ),
      { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT }
    );
    await waitForShopStoreProductReady(page);
    const hasBuy = await page.locator("[data-shop-product-buy-now]").count();
    if (!hasBuy) {
      item.issues.push("店舗販売 購入CTAなし");
      item.status = "WARNING";
      return item;
    }
    await page.locator("[data-shop-product-buy-now]").click({ force: true });
    await page.waitForURL(/shop-store-checkout\.html/, { timeout: NAV_TIMEOUT });
    await clickVisibleShopStoreCheckoutSubmit(page);
    await page.waitForURL(/shop-store-complete\.html/, { timeout: NAV_TIMEOUT });
    const ok = await page.evaluate(() => Boolean(document.querySelector("[data-shop-store-complete], body[data-page='shop_store_complete']")));
    if (!ok) item.issues.push("店舗販売 完了画面なし");
    item.status = item.issues.length ? "WARNING" : "PASS";
    await shot(page, `08-shop-store-${vp.name}`);
  } catch (err) {
    item.issues.push(String(err?.message || err));
    item.status = "WARNING";
  }
  return item;
}

/* ── 確認8: 異常操作 ── */
async function auditAbnormalOps(page, base, vp) {
  const results = [];
  const cases = [
    {
      id: "cart_spam",
      kind: "カート連打",
      run: async () => {
        await gotoWithRetry(
          page,
          pageUrl(base, `detail-shop-product.html?shopId=${PRODUCT.shopId}&productId=${PRODUCT.productId}`),
          { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT }
        );
        await waitForMarketProductReady(page);
        const btn = page
          .locator("[data-tasful-product-add-cart]:visible, [data-tasful-product-add-cart-pc]:visible")
          .first();
        for (let i = 0; i < 3; i++) await btn.click().catch(() => {});
        await page.waitForTimeout(400);
        const count = await page.evaluate(() => Number(localStorage.getItem("tasu_market_cart_count") || 0));
        if (count > 10) return [`カート件数異常: ${count}`];
        return [];
      },
    },
    {
      id: "reload",
      kind: "reload",
      run: async () => {
        await gotoWithRetry(page, pageUrl(base, "shop-market-cart.html"), {
          waitUntil: "domcontentloaded",
          timeout: NAV_TIMEOUT,
        });
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForTimeout(600);
        return [];
      },
    },
    {
      id: "url_direct",
      kind: "URL直打ち",
      run: async () => {
        await gotoWithRetry(page, pageUrl(base, "shop-market-complete.html"), {
          waitUntil: "domcontentloaded",
          timeout: NAV_TIMEOUT,
        });
        const overlay = await page.evaluate(() => Boolean(document.querySelector("vite-error-overlay")));
        return overlay ? ["vite-error-overlay"] : [];
      },
    },
    {
      id: "notify_spam",
      kind: "通知連打",
      run: async () => {
        await gotoWithRetry(page, notifyHomeUrl(base, BUYER_ID), {
          waitUntil: "domcontentloaded",
          timeout: NAV_TIMEOUT,
        });
        const card = page.locator("[data-talk-notify-id]").first();
        if (!(await card.count())) return [];
        for (let i = 0; i < 3; i++) await card.click({ force: true }).catch(() => {});
        return [];
      },
    },
  ];

  for (const c of cases) {
    const row = { id: c.id, kind: c.kind, vp: vp.name, status: "PASS", issues: [] };
    try {
      row.issues = await c.run();
      if (row.issues.length) row.status = "WARNING";
    } catch (err) {
      row.issues.push(String(err?.message || err));
      row.status = "FAIL";
    }
    results.push(row);
  }
  await shot(page, `09-abnormal-${vp.name}`);
  return results;
}

/* ── 確認9: 権限制御 ── */
async function auditRolePermissions(page, base, vp) {
  const roles = [
    {
      id: "buyer",
      label: "購入者",
      url: pageUrl(base, `detail-shop-product.html?shopId=${PRODUCT.shopId}&productId=${PRODUCT.productId}`),
      expectBuy: true,
      expectSellerBtn: false,
    },
    {
      id: "seller",
      label: "出店者",
      url: pageUrl(base, `shop-market-seller-orders.html?shopId=${PRODUCT.shopId}`),
      expectBuy: false,
      expectSellerPage: true,
    },
    {
      id: "connect_yes",
      label: "Connectあり商品",
      url: pageUrl(base, `detail-shop-product.html?shopId=${PRODUCT.shopId}&productId=${PRODUCT.productId}`),
      expectConnect: true,
    },
    {
      id: "connect_no",
      label: "Connectなし商品",
      url: pageUrl(
        base,
        `detail-shop-product.html?shopId=${PRODUCT_NO_CONNECT.shopId}&productId=${PRODUCT_NO_CONNECT.productId}`
      ),
      expectConnect: false,
    },
  ];
  const results = [];
  for (const role of roles) {
    const item = { ...role, vp: vp.name, status: "PASS", issues: [] };
    try {
      await gotoWithRetry(page, role.url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
      if (role.expectBuy) await waitForMarketProductReady(page);
      else await page.waitForTimeout(600);
      const ui = await page.evaluate(() => {
        const isVisible = (sel) => {
          const el = document.querySelector(sel);
          if (!el || el.hidden) return false;
          const style = getComputedStyle(el);
          if (style.display === "none" || style.visibility === "hidden") return false;
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        };
        const trust = document.querySelector("[data-tasful-product-trust]")?.textContent || "";
        return {
          hasBuy: isVisible("[data-tasful-product-buy-now]") || isVisible("[data-tasful-product-buy-now-pc]"),
          hasSellerPage: Boolean(
            document.querySelector("[data-tasful-seller-orders-lead]") ||
              document.querySelector("[data-tasful-seller-orders-list]") ||
              document.querySelector("[data-tasful-seller-orders-empty]")
          ),
          hasConnectBadge: /Connect認証/.test(trust),
        };
      });
      if (role.expectBuy && !ui.hasBuy) item.issues.push("購入ボタンなし");
      if (role.expectBuy === false && ui.hasBuy) item.issues.push("不要な購入ボタン");
      if (role.expectSellerPage && !ui.hasSellerPage) item.issues.push("出店者注文管理画面なし");
      if (role.expectConnect === true && !ui.hasConnectBadge) item.issues.push("Connect表示なし");
      if (role.expectConnect === false && ui.hasConnectBadge) item.issues.push("Connectなし商品にConnect表示");
      if (item.issues.length) item.status = "WARNING";
    } catch (err) {
      item.issues.push(String(err?.message || err));
      item.status = "FAIL";
    }
    results.push(item);
  }
  await shot(page, `10-roles-${vp.name}`);
  return results;
}

/* ── 確認11: AI運営秘書 ── */
async function auditAiOpsIntegration(page, base, vp) {
  const item = { id: "ai_ops", kind: "AI運営秘書連携", vp: vp.name, status: "FAIL", issues: [], checks: [] };
  try {
    await gotoWithRetry(page, pageUrl(base, "admin-operations-dashboard.html"), {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT,
    });
    await page.waitForFunction(
      () => window.TasuMarketEventStore?.appendMarketEvent && window.TasuAdminAiKpiCenter,
      { timeout: SEL_TIMEOUT }
    );

    const res = await page.evaluate(() => {
      window.TasuMarketEventStore?.clearForTests?.();
      window.TasuAdminAiOpsWatch?.clearForTests?.();
      const now = new Date().toISOString();
      const events = [
        { id: "audit_oc", event_type: "order_created", order_id: "AUDIT-OC", amount: 3200, created_at: now },
        { id: "audit_pc", event_type: "payment_completed", order_id: "AUDIT-OC", amount: 3200, created_at: now },
        { id: "audit_cancel", event_type: "order_cancelled", order_id: "AUDIT-CX", amount: 1000, created_at: now },
        { id: "audit_rr", event_type: "refund_requested", order_id: "AUDIT-RF", amount: 5000, created_at: now },
        { id: "audit_rd", event_type: "refund_completed", order_id: "AUDIT-RF", amount: 5000, created_at: now },
      ];
      events.forEach((e) => window.TasuMarketEventStore.appendMarketEvent(e));
      window.dispatchEvent(new CustomEvent("tasu-market-events-changed"));

      const types = [...new Set(window.TasuMarketEventStore.listMarketEvents().map((e) => e.event_type))];
      const inbox = window.TasuAdminAiDailyInbox?.buildInboxItems?.() || [];
      const ow = window.TasuAdminAiOpsWatch?.buildOpsWatchSnapshot?.() || {};
      const kpi = window.TasuAdminAiKpiCenter?.collectKpiMetrics?.() || {};
      const plans = window.TasuAdminAiResponsePlans?.buildResponsePlans?.() || [];
      const autoFix = window.TasuAdminAiAutoFixCandidate?.buildAutoFixSnapshot?.() || { candidates: [] };

      return {
        types,
        inboxMarket: inbox.filter((i) => i.source === "market").length,
        owOrderCreated: ow.metrics?.market?.orderCreated || 0,
        owRefundReq: ow.metrics?.market?.refundRequested || 0,
        kpiMarketOrder: kpi.marketOrderCreated || 0,
        kpiRefundReq: kpi.marketRefundRequested || 0,
        planMarket: plans.filter((p) => /market|返金|キャンセル|支払い/.test(`${p.eventTypeLabel || ""}${p.title || ""}`)).length,
        autoFixMarket: (autoFix.candidates || []).filter((c) => c.source === "market").length,
      };
    });

    const checks = [
      { id: "event_types", label: "5種イベント記録", ok: ["order_created", "payment_completed", "order_cancelled", "refund_requested", "refund_completed"].every((t) => res.types.includes(t)) },
      { id: "daily_inbox", label: "Daily Inbox market", ok: res.inboxMarket > 0 },
      { id: "ops_watch", label: "Ops Watch market指標", ok: res.owOrderCreated > 0 || res.owRefundReq > 0 },
      { id: "kpi_center", label: "KPI Center market", ok: res.kpiMarketOrder > 0 || res.kpiRefundReq > 0 },
      { id: "auto_fix", label: "Auto Fix Candidate market", ok: res.autoFixMarket >= 0 },
    ];
    item.checks = checks;
    item.metrics = res;
    for (const c of checks) {
      if (!c.ok) item.issues.push(`${c.label}: 未反映`);
    }
    item.status = item.issues.length === 0 ? "PASS" : item.issues.length <= 1 ? "WARNING" : "FAIL";
    await shot(page, `11-ai-ops-${vp.name}`);
  } catch (err) {
    item.issues.push(String(err?.message || err));
  }
  return item;
}

function collectAllResults(report) {
  return [
    ...(report.topFlow || []),
    ...(report.shopFlow || []),
    ...(report.productFlow || []),
    ...(report.purchaseFlow || []),
    ...(report.notifyFlows || []),
    ...(report.talkFlow || []),
    ...(report.orderHistory || []),
    ...(report.shopStorePurchase || []),
    ...(report.abnormalOps || []),
    ...(report.rolePermissions || []),
    ...(report.aiOpsIntegration || []),
  ].filter(Boolean);
}

function gradeReport(report) {
  const all = collectAllResults(report);
  const coreFail = all.filter((x) => x.status === "FAIL" && !x.auxiliary).length;
  const warnN = all.filter((x) => x.status === "WARNING").length;
  if (coreFail >= 3) return "FAIL";
  if (coreFail > 0 || warnN >= 8) return "WARNING";
  return "PASS";
}

function synthesizeFindings(report) {
  const good = [];
  const problems = [];
  const mismatch = [];
  const permission = [];
  const abnormal = [];
  const aiOps = [];
  const immediate = [];
  const future = [];
  const recs = new Set();

  const push = (r, label) => {
    if (!r) return;
    if (r.status === "PASS") good.push(`${label}: OK (${r.vp}px)`);
    else problems.push({ kind: label, id: r.id, status: r.status, issues: r.issues });
  };

  for (const vp of ["390", "1280"]) {
    push(report.topFlow?.find((x) => x.vp === vp), "市場TOP");
    push(report.shopFlow?.find((x) => x.vp === vp), "店舗導線");
    push(report.productFlow?.find((x) => x.vp === vp), "商品導線");
    push(report.purchaseFlow?.find((x) => x.vp === vp), "購入導線");
    push(report.talkFlow?.find((x) => x.vp === vp), "TALK連携");
    push(report.orderHistory?.find((x) => x.vp === vp), "注文履歴");
    push(report.shopStorePurchase?.find((x) => x.vp === vp), "店舗販売");
  }

  for (const n of report.notifyFlows || []) {
    if (n.status === "PASS") good.push(`${n.kind}: 通知 OK (${n.vp}px)`);
    else {
      problems.push({ kind: n.kind, id: n.id, status: n.status, issues: n.issues });
      mismatch.push(`${n.kind} (${n.vp}px): ${n.issues?.join(" / ") || "不一致"}`);
    }
  }

  for (const a of report.abnormalOps || []) {
    if (a.status === "PASS") good.push(`${a.kind}: 異常操作 OK (${a.vp}px)`);
    else {
      abnormal.push(`${a.kind} (${a.vp}px): ${a.issues?.join(" / ")}`);
      problems.push({ kind: a.kind, id: a.id, status: a.status, issues: a.issues });
    }
  }

  for (const r of report.rolePermissions || []) {
    if (r.status === "PASS") good.push(`${r.label}: 権限 OK (${r.vp}px)`);
    else permission.push(`${r.label} (${r.vp}px): ${r.issues?.join(" / ")}`);
  }

  for (const a of report.aiOpsIntegration || []) {
    if (a.status === "PASS") aiOps.push(`AI運営秘書 市場連携 OK (${a.vp}px)`);
    else aiOps.push(`AI運営秘書 (${a.vp}px): ${a.issues?.join(" / ")}`);
    if (a.status !== "PASS") problems.push({ kind: "AI運営秘書", id: a.id, status: a.status, issues: a.issues });
  }

  recs.add("市場通知 href の orderId パラメータ統一（detail=1 / expand=1）");
  recs.add("店舗販売（shop_store）と TASFUL市場（TM-）の通知 category 差分を CI で固定");
  recs.add("Connectあり/なし商品の検索フィルタ connect=1 と商品バッジの整合");
  recs.add("購入完了→TALK通知→注文履歴の四者一致を review-market-user-flow に常設");
  recs.add("shop-store-complete と shop-market-complete の注文番号形式（TS-/TM-）明文化");
  recs.add("カート連打時の qty 上限ガード");
  recs.add("complete 画面 URL 直打ち時の空状態 UX");
  recs.add("detail-shop-store → shop-products → detail-shop-store-product パンくず整合");
  recs.add("390px カート/checkout 固定CTA の到達性");
  recs.add("seller-orders ステータス連打時の通知 dedup 確認");
  recs.add("市場イベント tasu_market_admin_events_v1 と Ops Watch 指標の同期");
  recs.add("Auto Fix Candidate の market キャンセル増加検知");
  recs.add("返金申請 refund_requested の Inbox 優先度");
  recs.add("TALK 通知から chat-detail への導線要否の仕様整理");
  recs.add("dashboard / shop-store TOP のカテゴリ nav と shop-search パラメータ統一");
  if (mismatch.length) recs.add("通知タイトル/本文/遷移先/注文内容の一致検証強化");
  if (permission.length) recs.add("出店者管理画面への購入者アクセスガード");

  immediate.push(...problems.filter((p) => p.status === "FAIL").slice(0, 5).map((p) => `${p.kind}: ${p.issues?.[0] || ""}`));
  future.push("本番決済 Stripe 連携後の payment_completed E2E");
  future.push("注文キャンセル/返金の利用者向けステータス画面");
  future.push("JWT ロールと seller-orders 権限のサーバー検証");

  report.goodFlows = good;
  report.problemFlows = problems;
  report.notifyMismatch = mismatch.length ? mismatch : ["（重大な不一致なし）"];
  report.permissionIssues = permission.length ? permission : ["（重大な権限問題なし）"];
  report.abnormalIssues = abnormal.length ? abnormal : ["（重大な異常操作問題なし）"];
  report.aiOpsIntegrationSummary = aiOps.length ? aiOps : ["（未検証）"];
  report.recommendations = [...recs].slice(0, 20);
  report.immediateFixes = immediate.filter(Boolean).slice(0, 8);
  report.futureFixes = future;

  const all = collectAllResults(report);
  report.counts = {
    pass: all.filter((x) => x.status === "PASS").length,
    warning: all.filter((x) => x.status === "WARNING").length,
    fail: all.filter((x) => x.status === "FAIL").length,
  };
  report.overall = gradeReport(report);
}

function buildMarkdown(report) {
  return [
    "# 市場 利用者導線監査",
    "",
    `実施: ${report.capturedAt}`,
    `Base: ${report.base || "file:// (dev server 未検出)"}`,
    "",
    "## 総合評価",
    "",
    `**${report.overall}**`,
    "",
    `- PASS: ${report.counts.pass}`,
    `- WARNING: ${report.counts.warning}`,
    `- FAIL: ${report.counts.fail}`,
    "",
    "---",
    "",
    "## 正常導線",
    "",
    ...report.goodFlows.map((g) => `- ${g}`),
    "",
    "---",
    "",
    "## 問題導線",
    "",
    ...(report.problemFlows.length
      ? report.problemFlows.map((p) => `- **${p.kind || p.id}** (${p.status}): ${p.issues?.join(" / ") || "—"}`)
      : ["- （重大な問題導線なし）"]),
    "",
    "---",
    "",
    "## 通知不一致",
    "",
    ...report.notifyMismatch.map((n) => `- ${n}`),
    "",
    "---",
    "",
    "## 権限問題",
    "",
    ...report.permissionIssues.map((p) => `- ${p}`),
    "",
    "---",
    "",
    "## 異常操作問題",
    "",
    ...report.abnormalIssues.map((a) => `- ${a}`),
    "",
    "---",
    "",
    "## AI運営秘書連携",
    "",
    ...report.aiOpsIntegrationSummary.map((a) => `- ${a}`),
    "",
    "---",
    "",
    "## 改善推奨TOP20",
    "",
    ...report.recommendations.map((r, i) => `${i + 1}. ${r}`),
    "",
    "---",
    "",
    "### 即修正",
    "",
    ...(report.immediateFixes.length ? report.immediateFixes.map((f) => `- ${f}`) : ["- （なし）"]),
    "",
    "### 将来対応",
    "",
    ...report.futureFixes.map((f) => `- ${f}`),
    "",
    "---",
    "",
    "## スクショ",
    "",
    `保存先: \`screenshots/market-user-flow-review/\` (${report.screenshots.length}枚)`,
    "",
    "## テスト",
    "",
    "実施: `node scripts/review-market-user-flow.mjs`",
    "ビューポート: 390px / 1280px",
    "",
  ].join("\n");
}

async function main() {
  await mkdir(SHOT_DIR, { recursive: true });
  const base = await findBaseUrl();
  if (!base) {
    console.error("WARN: dev server not found");
    process.exitCode = 1;
    return;
  }

  const browser = await launchHeadlessBrowser();
  const report = {
    capturedAt: new Date().toISOString(),
    base,
    topFlow: [],
    shopFlow: [],
    productFlow: [],
    purchaseFlow: [],
    notifyFlows: [],
    talkFlow: [],
    orderHistory: [],
    shopStorePurchase: [],
    abnormalOps: [],
    rolePermissions: [],
    aiOpsIntegration: [],
    screenshots: [],
    overall: "FAIL",
  };

  try {
    const context = await browser.newContext();
    await context.addInitScript((keys) => {
      if (sessionStorage.getItem("__marketUserFlowAuditBoot") === "1") return;
      sessionStorage.setItem("__marketUserFlowAuditBoot", "1");
      keys.forEach((k) => localStorage.removeItem(k));
    }, MARKET_KEYS);

    for (const vp of [
      { name: "390", width: 390, height: 844 },
      { name: "1280", width: 1280, height: 900 },
    ]) {
      const page = await context.newPage({ viewport: { width: vp.width, height: vp.height } });
      await gotoWithRetry(page, pageUrl(base, "shop-store.html"), {
        waitUntil: "domcontentloaded",
        timeout: NAV_TIMEOUT,
      });
      await resetMarketStores(page);

      report.topFlow.push(await auditTopFlow(page, base, vp));
      report.shopFlow.push(await auditShopFlow(page, base, vp));
      report.productFlow.push(await auditProductFlow(page, base, vp));
      const purchase = await auditPurchaseFlow(page, base, vp);
      report.purchaseFlow.push(purchase);
      const orderId = purchase.orderId || "";
      report.notifyFlows.push(...(await auditNotifyFlows(page, base, vp, orderId)));
      report.talkFlow.push(await auditTalkFlow(page, base, vp, orderId));
      report.orderHistory.push(await auditOrderHistory(page, base, vp, orderId));
      report.shopStorePurchase.push(await auditShopStorePurchase(page, base, vp));
      report.abnormalOps.push(...(await auditAbnormalOps(page, base, vp)));
      report.rolePermissions.push(...(await auditRolePermissions(page, base, vp)));
      report.aiOpsIntegration.push(await auditAiOpsIntegration(page, base, vp));

      await page.close();
    }

    await context.close();
    synthesizeFindings(report);
    report.screenshots = readdirSync(SHOT_DIR).filter((f) => f.endsWith(".png"));

    const md = buildMarkdown(report);
    await writeFile(REPORT_MD, md, "utf8");
    await writeFile(REPORT_JSON, JSON.stringify(report, null, 2), "utf8");

    console.log(md);
    console.log(`\nReport: ${REPORT_MD}`);
    console.log(`JSON: ${REPORT_JSON}`);
    console.log(`Overall: ${report.overall}`);

    if (report.overall === "FAIL") process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
