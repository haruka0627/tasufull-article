#!/usr/bin/env node
/**
 * TASFUL市場通知 — UXデモ動画 3本（390×667 mp4）
 *
 * 提出動画:
 *   ① market-notify-full-flow-390.mp4   — 購入〜レビューまで通し
 *   ② market-notify-buyer-view-390.mp4  — 購入者: 通知→タップ→遷移→戻る×5
 *   ③ market-notify-seller-view-390.mp4 — 出品者: 購入通知→注文管理→発送処理
 *
 * 補助: screenshots/market-notify-390/
 *   npm run demo:market-notify-video
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import {
  closeDemoVideoContext,
  demoPause,
  DEMO_VIEWPORT_390,
  DEMO_DEVICE_PROFILE,
  formatVideoSubmissionList,
  openDemoVideoContext,
  tapMobileBack,
  writeDemoVideoManifest,
  DEFAULT_DEST_PAUSE_MS,
  DEFAULT_LIST_PAUSE_MS,
} from "./lib/capture-demo-video-390.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const VIDEO_DIR = path.join(ROOT, "videos", "market-notify-390");
const SCREENSHOT_DIR = path.join(ROOT, "screenshots", "market-notify-390");
const MANIFEST_PATH = path.join(VIDEO_DIR, "demo-manifest.json");

const PRODUCT = { shopId: "demo-shop-tasful-bakery", productId: "p-0" };
const BUYER_ID = "u_me";
const SELLER_ID = "u_bakery";

const BUYER_NOTIFY_CASES = [
  {
    id: "02-order-accepted",
    notifyIdPrefix: "market-order-accepted-",
    title: "注文を受け付けました",
    destPattern: /shop-market-order-history\.html/i,
    sellerAction: "注文受付",
  },
  {
    id: "03-preparing",
    notifyIdPrefix: "market-order-preparing-",
    title: "発送準備中です",
    destPattern: /shop-market-order-history\.html.*detail=1/i,
    sellerAction: "発送準備中",
  },
  {
    id: "04-shipped",
    notifyIdPrefix: "market-order-shipped-",
    title: "商品を発送しました",
    destPattern: /shop-market-order-history\.html.*detail=1/i,
    sellerAction: "発送済み",
  },
  {
    id: "05-delivered",
    notifyIdPrefix: "market-order-delivered-",
    title: "配達が完了しました",
    destPattern: /shop-market-order-history\.html/i,
    sellerAction: "配達完了",
  },
  {
    id: "06-review",
    notifyIdPrefix: "market-order-review-",
    title: "レビューをお願いします",
    destPattern: /detail-shop-product\.html.*review=1/i,
    sellerAction: null,
  },
];

const PURCHASE_NOTIFY = {
  notifyIdPrefix: "market-order-purchase-",
  destPattern: /shop-market-seller-orders\.html/i,
};

fs.mkdirSync(VIDEO_DIR, { recursive: true });
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
fs.mkdirSync(path.join(VIDEO_DIR, ".tmp"), { recursive: true });

function talkNotifyUrl(base, userId) {
  return buildLocalPageUrl(
    base,
    "talk-home.html",
    `?tab=notify&talkDev=1&benchEmbed=1&userId=${encodeURIComponent(userId)}`
  );
}

function sellerOrdersUrl(base) {
  return buildLocalPageUrl(base, "shop-market-seller-orders.html", `?shopId=${PRODUCT.shopId}`);
}

async function resetMarketState(page) {
  await page.evaluate(() => {
    localStorage.removeItem("tasu_market_order_history");
    localStorage.removeItem("tasu_market_last_order");
    localStorage.removeItem("tasu_market_cart_count");
    localStorage.removeItem("tasu_market_cart_items");
    localStorage.removeItem("tasu_market_notify_sent_v1");
    localStorage.removeItem("tasful_talk_notifications");
    sessionStorage.removeItem("tasuMarketFullFlowInit");
  });
}

async function runPurchaseOnly(page, base) {
  await page.goto(buildLocalPageUrl(base, "shop-store.html"), { waitUntil: "domcontentloaded", timeout: 60000 });
  await resetMarketState(page);
  await page.goto(
    buildLocalPageUrl(
      base,
      "detail-shop-product.html",
      `?shopId=${PRODUCT.shopId}&productId=${PRODUCT.productId}`
    ),
    { waitUntil: "domcontentloaded" }
  );
  await page.waitForSelector("[data-tasful-product-buy-now]", { timeout: 20000 });
  await demoPause(page, 500);
  await page.click("[data-tasful-product-buy-now]");
  await page.waitForURL(/shop-market-checkout\.html/, { timeout: 15000 });
  await page.waitForSelector("[data-tasful-checkout-submit]", { timeout: 15000 });
  await demoPause(page, 500);
  await page.click("[data-tasful-checkout-submit]");
  await page.waitForURL(/shop-market-complete\.html/, { timeout: 15000 });
  await demoPause(page, 800);

  const orderId = await page.evaluate(() =>
    document.querySelector("[data-tasful-complete-order-id]")?.textContent?.replace(/^注文番号:\s*/, "").trim()
  );
  if (!orderId) throw new Error("注文IDを取得できません");
  return orderId;
}

async function seedAllBuyerNotifications(page, base, orderId) {
  const url = sellerOrdersUrl(base);
  for (const spec of BUYER_NOTIFY_CASES) {
    if (!spec.sellerAction) continue;
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(`[data-tasful-seller-order-card][data-order-id="${orderId}"]`, { timeout: 15000 });
    await page.click(
      `[data-tasful-seller-order-card][data-order-id="${orderId}"] [data-tasful-seller-status-btn][data-status="${spec.sellerAction}"]`
    );
    await demoPause(page, 300);
  }
}

async function openNotifyTab(page, base, userId) {
  await page.goto(talkNotifyUrl(base, userId), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector('[data-talk-panel="notify"]:not([hidden])', { timeout: 20000 });
  await page.waitForSelector("[data-talk-notify-list]", { timeout: 20000 });
  await demoPause(page, DEFAULT_LIST_PAUSE_MS);
}

async function scrollNotifyIntoView(page, notifyId) {
  await page.evaluate((id) => {
    document.querySelector(`[data-talk-notify-id="${id}"]`)?.scrollIntoView({ block: "center", behavior: "instant" });
  }, notifyId);
  await demoPause(page, DEFAULT_LIST_PAUSE_MS);
}

async function tapNotifyCard(page, notifyId, destPattern) {
  await scrollNotifyIntoView(page, notifyId);
  await page.waitForSelector(`[data-talk-notify-id="${notifyId}"]`, { timeout: 20000 });
  const cta = page.locator(`[data-talk-notify-id="${notifyId}"] [data-talk-notify-action]`).first();
  const card = page.locator(`[data-talk-notify-id="${notifyId}"]`).first();
  await card.scrollIntoViewIfNeeded();
  await demoPause(page, 600);
  if (await cta.count()) await cta.click({ timeout: 15000 });
  else await card.click({ timeout: 15000 });
  await page.waitForURL((url) => destPattern.test(url.href), { timeout: 15000 });
  await page.waitForLoadState("domcontentloaded");
  await demoPause(page, DEFAULT_DEST_PAUSE_MS);
}

async function tapBackToNotifyTab(page) {
  await tapMobileBack(page, DEFAULT_DEST_PAUSE_MS);
  await page.waitForURL(/talk-home\.html/i, { timeout: 15000 });
  await page.waitForSelector('[data-talk-panel="notify"]:not([hidden])', { timeout: 15000 });
  await demoPause(page, DEFAULT_LIST_PAUSE_MS);
}

async function clickSellerStatus(page, base, orderId, status) {
  await page.goto(sellerOrdersUrl(base), { waitUntil: "domcontentloaded" });
  const btn = page.locator(
    `[data-tasful-seller-order-card][data-order-id="${orderId}"] [data-tasful-seller-status-btn][data-status="${status}"]`
  );
  await btn.waitFor({ state: "visible", timeout: 15000 });
  await demoPause(page, 500);
  await btn.click();
  await demoPause(page, 1200);
}

async function waitForNotifyCard(page, notifyId) {
  await page.waitForFunction(
    (id) => Boolean(document.querySelector(`[data-talk-notify-id="${id}"]`)),
    notifyId,
    { timeout: 15000 }
  );
}

/** 提出動画① — 購入からレビューまで通し（出品者・購入者を交互） */
async function recordFullFlowVideo(browser, base) {
  const fileName = "market-notify-full-flow-390.mp4";
  const mp4Path = path.join(VIDEO_DIR, fileName);
  const context = await openDemoVideoContext(browser, path.join(VIDEO_DIR, ".tmp", "full-flow"));
  const page = await context.newPage();

  const orderId = await runPurchaseOnly(page, base);
  const purchaseId = `${PURCHASE_NOTIFY.notifyIdPrefix}${orderId}`;

  await openNotifyTab(page, base, SELLER_ID);
  await tapNotifyCard(page, purchaseId, PURCHASE_NOTIFY.destPattern);

  await page.waitForSelector(`[data-tasful-seller-order-card][data-order-id="${orderId}"]`, { timeout: 15000 });
  await demoPause(page, 600);
  await page.click(
    `[data-tasful-seller-order-card][data-order-id="${orderId}"] [data-tasful-seller-status-btn][data-status="注文受付"]`
  );
  await demoPause(page, 1200);

  for (let i = 0; i < BUYER_NOTIFY_CASES.length; i += 1) {
    const spec = BUYER_NOTIFY_CASES[i];
    await openNotifyTab(page, base, BUYER_ID);
    const notifyId = `${spec.notifyIdPrefix}${orderId}`;
    await waitForNotifyCard(page, notifyId);
    await tapNotifyCard(page, notifyId, spec.destPattern);
    if (spec.id === "06-review") break;
    await tapBackToNotifyTab(page);
    const next = BUYER_NOTIFY_CASES[i + 1];
    if (next?.sellerAction) {
      await clickSellerStatus(page, base, orderId, next.sellerAction);
    }
  }

  return closeDemoVideoContext(page, context, mp4Path).then((meta) => ({
    ...meta,
    fileName,
    description:
      "購入→購入通知→seller-orders→注文受付→各ステータス通知→レビュー画面まで通しデモ",
    orderId,
  }));
}

/** 提出動画② — 購入者: 通知一覧→タップ→遷移→戻るを5種連続 */
async function recordBuyerViewVideo(browser, base, storageState, orderId) {
  const fileName = "market-notify-buyer-view-390.mp4";
  const mp4Path = path.join(VIDEO_DIR, fileName);
  const context = await openDemoVideoContext(browser, path.join(VIDEO_DIR, ".tmp", "buyer-view"), storageState);
  const page = await context.newPage();

  await openNotifyTab(page, base, BUYER_ID);
  await demoPause(page, 1200);

  for (let i = 0; i < BUYER_NOTIFY_CASES.length; i += 1) {
    const spec = BUYER_NOTIFY_CASES[i];
    const notifyId = `${spec.notifyIdPrefix}${orderId}`;
    if (i > 0) {
      await scrollNotifyIntoView(page, notifyId);
    }
    await waitForNotifyCard(page, notifyId);
    await tapNotifyCard(page, notifyId, spec.destPattern);
    if (i < BUYER_NOTIFY_CASES.length - 1) {
      await tapBackToNotifyTab(page);
      await demoPause(page, 800);
    }
  }

  return closeDemoVideoContext(page, context, mp4Path).then((meta) => ({
    ...meta,
    fileName,
    description: "購入者視点 — 通知一覧→タップ→遷移→戻る→次通知（5種連続）",
    orderId,
  }));
}

/** 提出動画③ — 出品者: 購入通知→注文管理→発送処理 */
async function recordSellerViewVideo(browser, base) {
  const fileName = "market-notify-seller-view-390.mp4";
  const mp4Path = path.join(VIDEO_DIR, fileName);
  const context = await openDemoVideoContext(browser, path.join(VIDEO_DIR, ".tmp", "seller-view"));
  const page = await context.newPage();

  const orderId = await runPurchaseOnly(page, base);
  const purchaseId = `${PURCHASE_NOTIFY.notifyIdPrefix}${orderId}`;

  await demoPause(page, 2000);
  await openNotifyTab(page, base, SELLER_ID);
  await demoPause(page, 2000);
  await tapNotifyCard(page, purchaseId, PURCHASE_NOTIFY.destPattern);

  const statuses = ["注文受付", "発送準備中", "発送済み", "配達完了"];
  for (const status of statuses) {
    const btn = page.locator(
      `[data-tasful-seller-order-card][data-order-id="${orderId}"] [data-tasful-seller-status-btn][data-status="${status}"]`
    );
    await btn.waitFor({ state: "visible", timeout: 15000 });
    await demoPause(page, 1200);
    await btn.click();
    await demoPause(page, 2000);
  }

  await demoPause(page, 2500);

  return closeDemoVideoContext(page, context, mp4Path).then((meta) => ({
    ...meta,
    fileName,
    description: "出品者視点 — 購入通知→注文管理→発送処理（ステータス更新で通知発火）",
    orderId,
  }));
}

const base = await findDevServerBaseUrl({ probePath: "shop-store.html" });
await withPlaywrightBrowser(async (browser) => {const setupContext = await browser.newContext({
  ...DEMO_DEVICE_PROFILE,
  viewport: DEMO_VIEWPORT_390,
  isMobile: true,
  hasTouch: true,
});
const setupPage = await setupContext.newPage();

let orderId = "";
/** @type {import('playwright').BrowserContextOptions['storageState']|undefined} */
let buyerStorageState;
const errors = [];

try {
  orderId = await runPurchaseOnly(setupPage, base);
  await seedAllBuyerNotifications(setupPage, base, orderId);
  buyerStorageState = await setupContext.storageState();
} catch (err) {
  errors.push(String(err?.message || err));
} finally {
  await setupContext.close();
}

if (!orderId) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2));
  await closeAllBrowsers();
  process.exit(1);
}

const submissions = [];

try {
  submissions.push(await recordFullFlowVideo(browser, base));
} catch (err) {
  errors.push(`full-flow: ${String(err?.message || err)}`);
}

try {
  submissions.push(await recordBuyerViewVideo(browser, base, buyerStorageState, orderId));
} catch (err) {
  errors.push(`buyer-view: ${String(err?.message || err)}`);
}

try {
  submissions.push(await recordSellerViewVideo(browser, base));
} catch (err) {
  errors.push(`seller-view: ${String(err?.message || err)}`);
}

});

const submissionList = formatVideoSubmissionList(submissions);
const overallPass = submissions.length === 3 && errors.length === 0;

const manifest = {
  generatedAt: new Date().toISOString(),
  baseUrl: base,
  viewport: DEMO_VIEWPORT_390,
  device: "iPhone SE相当（390×667）",
  format: "mp4",
  orderId,
  product: PRODUCT,
  submissionPriority: "video",
  supplementaryScreenshots: SCREENSHOT_DIR.replace(/\\/g, "/"),
  overallPass,
  submissions: submissionList,
  errors,
  reusableLib: "scripts/lib/capture-demo-video-390.mjs",
};

writeDemoVideoManifest(MANIFEST_PATH, manifest);

console.log(JSON.stringify({ ok: overallPass, orderId, submissions: submissionList, manifestPath: MANIFEST_PATH }, null, 2));
console.log("\n--- 提出動画 ---\n");
for (const v of submissionList) {
  console.log(`${v.fileName}\n${v.duration}\n${v.content}\n`);
}

await closeAllBrowsers();
process.exit(overallPass ? 0 : 1);
