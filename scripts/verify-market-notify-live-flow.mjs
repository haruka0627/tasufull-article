#!/usr/bin/env node
/**
 * 市場通知 — 実購入フロー発火検証（デモシード注入なし）
 * 購入 UI + 出品者ステータス操作のみで 6 種の通知が store に記録されることを確認
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { devices } from "playwright";
import { assertPlaywrightLocalhostPage, buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "screenshots", "market-notify-live-flow");
const REPORT_PATH = path.join(OUT_DIR, "live-flow-report.json");

const PRODUCT = { shopId: "demo-shop-tasful-bakery", productId: "p-0" };
const BUYER_ID = "u_me";
const SELLER_ID = "u_bakery";
const MARKET_SOURCE = "shop_market_order_v1";

const STEPS = [
  {
    id: "purchase",
    label: "購入 → 出品者へ購入通知",
    trigger: "checkout",
    recipientUserId: SELLER_ID,
    idPrefix: "market-order-purchase-",
    title: "新しい注文が入りました",
    sellerAction: null,
  },
  {
    id: "order-accepted",
    label: "注文受付 → 購入者へ通知",
    trigger: "seller-status",
    recipientUserId: BUYER_ID,
    idPrefix: "market-order-accepted-",
    title: "注文を受け付けました",
    sellerAction: "注文受付",
  },
  {
    id: "preparing",
    label: "発送準備中 → 購入者へ通知",
    trigger: "seller-status",
    recipientUserId: BUYER_ID,
    idPrefix: "market-order-preparing-",
    title: "発送準備中です",
    sellerAction: "発送準備中",
  },
  {
    id: "shipped",
    label: "発送済み → 購入者へ通知",
    trigger: "seller-status",
    recipientUserId: BUYER_ID,
    idPrefix: "market-order-shipped-",
    title: "商品を発送しました",
    sellerAction: "発送済み",
  },
  {
    id: "delivered",
    label: "配達完了 → 購入者へ通知",
    trigger: "seller-status",
    recipientUserId: BUYER_ID,
    idPrefix: "market-order-delivered-",
    title: "配達が完了しました",
    sellerAction: "配達完了",
  },
  {
    id: "review",
    label: "レビュー依頼 → 購入者へ通知",
    trigger: "seller-status",
    recipientUserId: BUYER_ID,
    idPrefix: "market-order-review-",
    title: "レビューをお願いします",
    sellerAction: "配達完了",
    pairedWith: "delivered",
  },
];

fs.mkdirSync(OUT_DIR, { recursive: true });

function readNotifications(page) {
  return page.evaluate(() => {
    let rows = [];
    try {
      rows = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
    } catch {
      rows = [];
    }
    if (!Array.isArray(rows)) rows = [];
    return rows.map((n) => ({
      id: String(n?.id || ""),
      title: String(n?.title || ""),
      source: String(n?.source || ""),
      recipientUserId: String(n?.recipientUserId || n?.recipient_user_id || ""),
      orderId: String(n?.orderId || ""),
      createdAt: String(n?.createdAt || ""),
    }));
  });
}

function readSentKeys(page) {
  return page.evaluate(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("tasu_market_notify_sent_v1") || "{}");
      return raw && typeof raw === "object" ? Object.keys(raw) : [];
    } catch {
      return [];
    }
  });
}

function findNotify(rows, { notifyId, recipientUserId, title }) {
  return rows.find(
    (n) =>
      n.id === notifyId &&
      n.recipientUserId === recipientUserId &&
      n.title === title &&
      n.source === MARKET_SOURCE
  );
}

/** @type {object[]} */
const results = [];
let orderId = "";

const base = await findDevServerBaseUrl({ probePath: "shop-store.html" });
await withPlaywrightBrowser(async (browser) => {const context = await browser.newContext({
  ...devices["iPhone 13"],
  viewport: { width: 390, height: 844 },
  hasTouch: true,
});
const page = await context.newPage();

try {
  await page.goto(buildLocalPageUrl(base, "shop-store.html"), {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await assertPlaywrightLocalhostPage(page);

  await page.evaluate(() => {
    [
      "tasu_market_order_history",
      "tasu_market_last_order",
      "tasu_market_cart_count",
      "tasu_market_cart_items",
      "tasu_market_notify_sent_v1",
      "tasful_talk_notifications",
      "tasful_talk_notifications_seeded_v2",
      "tasful_platform_notify_master_v1",
      "tasful_builder_notify_master_v1",
      "tasful_anpi_notify_master_v1",
      "tasful_platform_fee_notify_master_v2",
    ].forEach((k) => localStorage.removeItem(k));
    sessionStorage.removeItem("tasuMarketFullFlowInit");
  });

  const detailUrl = buildLocalPageUrl(
    base,
    "detail-shop-product.html",
    `?shopId=${PRODUCT.shopId}&productId=${PRODUCT.productId}`
  );
  await page.goto(detailUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-tasful-product-buy-now]", { timeout: 20000 });
  await page.click("[data-tasful-product-buy-now]");
  await page.waitForURL(/shop-market-checkout\.html/, { timeout: 15000 });
  await page.waitForSelector("[data-tasful-checkout-submit]", { timeout: 15000 });
  await page.click("[data-tasful-checkout-submit]");
  await page.waitForURL(/shop-market-complete\.html/, { timeout: 15000 });

  orderId = await page.evaluate(() => {
    const text = document.querySelector("[data-tasful-complete-order-id]")?.textContent || "";
    return text.replace(/^注文番号:\s*/, "").trim();
  });
  if (!orderId) throw new Error("注文IDを取得できません（実購入フロー）");

  const historyOk = await page.evaluate((oid) => {
    try {
      const history = JSON.parse(localStorage.getItem("tasu_market_order_history") || "[]");
      return Array.isArray(history) && history.some((e) => String(e?.orderId || "") === oid);
    } catch {
      return false;
    }
  }, orderId);
  if (!historyOk) throw new Error("注文履歴が localStorage に記録されていません");

  const sellerOrdersUrl = buildLocalPageUrl(
    base,
    "shop-market-seller-orders.html",
    `?shopId=${PRODUCT.shopId}`
  );

  let deliveredStatusClicked = false;

  for (const step of STEPS) {
    const row = {
      id: step.id,
      label: step.label,
      trigger: step.trigger,
      expectedNotifyId: `${step.idPrefix}${orderId}`,
      recipientUserId: step.recipientUserId,
      expectedTitle: step.title,
      pass: false,
      errors: [],
      found: null,
      sentKey: null,
    };

    if (step.trigger === "seller-status") {
      if (step.id === "review" && deliveredStatusClicked) {
        /* 配達完了クリック時に review も同時発火済み */
      } else if (step.sellerAction) {
        await page.goto(sellerOrdersUrl, { waitUntil: "domcontentloaded" });
        await page.waitForSelector(`[data-tasful-seller-order-card][data-order-id="${orderId}"]`, {
          timeout: 15000,
        });
        await page.click(
          `[data-tasful-seller-order-card][data-order-id="${orderId}"] [data-tasful-seller-status-btn][data-status="${step.sellerAction}"]`
        );
        await page.waitForTimeout(500);
        if (step.sellerAction === "配達完了") deliveredStatusClicked = true;
      }
    }

    const notifications = await readNotifications(page);
    const sentKeys = await readSentKeys(page);
    const found = findNotify(notifications, {
      notifyId: row.expectedNotifyId,
      recipientUserId: step.recipientUserId,
      title: step.title,
    });

    row.found = found || null;
    row.sentKey = `${orderId}::${step.id === "purchase" ? "purchase" : step.id === "order-accepted" ? "accepted" : step.id === "preparing" ? "preparing" : step.id === "shipped" ? "shipped" : step.id === "delivered" ? "delivered" : "review"}`;
    row.sentRecorded = sentKeys.includes(row.sentKey);

    if (!found) row.errors.push(`通知未発火: ${row.expectedNotifyId} (${step.recipientUserId})`);
    if (!row.sentRecorded) row.errors.push(`送信済みマーカーなし: ${row.sentKey}`);
    if (found && found.orderId && found.orderId !== orderId) {
      row.errors.push(`orderId不一致: ${found.orderId}`);
    }

    row.pass = row.errors.length === 0;
    results.push(row);
  }

  await page.goto(
    buildLocalPageUrl(base, "talk-home.html", `?tab=notify&talkDev=1&benchEmbed=1&userId=${BUYER_ID}`),
    { waitUntil: "domcontentloaded", timeout: 60000 }
  );
  await page.waitForSelector('[data-talk-panel="notify"]:not([hidden])', { timeout: 20000 });
  await page.waitForTimeout(600);

  const buyerUiCount = await page.evaluate((oid) => {
    const cards = [...document.querySelectorAll("[data-talk-notify-id]")];
    return cards.filter((el) => {
      const id = el.getAttribute("data-talk-notify-id") || "";
      return id.startsWith("market-order-") && id.endsWith(`-${oid}`);
    }).length;
  }, orderId);

  await page.locator("[data-talk-notify-list]").screenshot({
    path: path.join(OUT_DIR, "buyer-notify-list-after-live-flow-390.png"),
  });

  const sellerUiCheck = await page.evaluate(({ oid, sellerId }) => {
    return { buyerCardsOnBuyerTab: null, note: "seller tab checked separately" };
  }, { oid: orderId, sellerId: SELLER_ID });

  await page.goto(
    buildLocalPageUrl(base, "talk-home.html", `?tab=notify&talkDev=1&benchEmbed=1&userId=${SELLER_ID}`),
    { waitUntil: "domcontentloaded", timeout: 60000 }
  );
  await page.waitForSelector('[data-talk-panel="notify"]:not([hidden])', { timeout: 20000 });
  await page.waitForTimeout(400);

  const sellerPurchaseVisible = await page.evaluate((oid) => {
    const el = document.querySelector(`[data-talk-notify-id="market-order-purchase-${oid}"]`);
    return Boolean(el && el.getBoundingClientRect().height > 0);
  }, orderId);

  results.push({
    id: "ui-buyer-market-cards",
    label: "購入者 TALK 通知タブに市場通知が表示",
    pass: buyerUiCount >= 5,
    buyerMarketCardCount: buyerUiCount,
    errors: buyerUiCount >= 5 ? [] : [`buyer UI cards: expected >=5, got ${buyerUiCount}`],
  });

  results.push({
    id: "ui-seller-purchase",
    label: "出品者 TALK 通知タブに購入通知が表示",
    pass: sellerPurchaseVisible,
    errors: sellerPurchaseVisible ? [] : ["seller purchase card not visible in notify tab"],
  });
} catch (err) {
  results.push({
    id: "fatal",
    pass: false,
    errors: [String(err?.message || err)],
  });

}
});


const coreSteps = STEPS.map((s) => s.id);
const coreResults = results.filter((r) => coreSteps.includes(r.id));
const overallPass =
  Boolean(orderId) &&
  coreResults.length === STEPS.length &&
  coreResults.every((r) => r.pass) &&
  results.filter((r) => r.id.startsWith("ui-")).every((r) => r.pass);

const report = {
  generatedAt: new Date().toISOString(),
  mode: "live-purchase-flow",
  demoSeedInjected: false,
  baseUrl: base,
  orderId,
  product: PRODUCT,
  buyerUserId: BUYER_ID,
  sellerUserId: SELLER_ID,
  overallPass,
  passCount: results.filter((r) => r.pass).length,
  failCount: results.filter((r) => !r.pass).length,
  results,
};

fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");
console.log(
  JSON.stringify(
    {
      overallPass,
      orderId,
      reportPath: REPORT_PATH,
      passCount: report.passCount,
      failCount: report.failCount,
      steps: coreResults.map((r) => ({ id: r.id, pass: r.pass, errors: r.errors })),
    },
    null,
    2
  )
);
await closeAllBrowsers();
process.exit(overallPass ? 0 : 1);
