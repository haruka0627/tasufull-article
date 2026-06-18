#!/usr/bin/env node
/**
 * 相談・問い合わせ CTA → chat-list E2E
 *
 *   node scripts/test-contact-chat-actions-browser.mjs
 *   BASE_URL=http://localhost:5180 node scripts/test-contact-chat-actions-browser.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://localhost:5173").replace(/\/$/, "");
const THREAD_KEY = "tasful_chat_threads";
const MESSAGES_KEY = "tasful_chat_messages";
const GENERAL_DEMO_ID = "general-demo-002";
const SHOP_OTHER_ID = "shop-store-demo-other-001";
const BIZ_DEMO_ID = "demo-biz-08";

/** @type {{ step: string, ok: boolean, detail?: string }[]} */
const results = [];

function pass(step, detail = "") {
  results.push({ step, ok: true, detail });
  console.log(`  OK  ${step}${detail ? `: ${detail}` : ""}`);
}

function fail(step, detail = "") {
  results.push({ step, ok: false, detail });
  console.error(`  NG  ${step}${detail ? `: ${detail}` : ""}`);
}

function isIgnorableConsoleError(text) {
  const t = String(text || "");
  return (
    t.includes("Failed to load resource") ||
    t.includes("net::ERR_") ||
    t.includes("favicon") ||
    t.includes("404") ||
    t.includes("supabase") ||
    t.includes("Supabase")
  );
}

async function clearChatStorage(page) {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ threadKey, messagesKey }) => {
      localStorage.removeItem(threadKey);
      localStorage.removeItem(messagesKey);
    },
    { threadKey: THREAD_KEY, messagesKey: MESSAGES_KEY }
  );
}

async function readThreads(page) {
  return page.evaluate((key) => {
    try {
      return JSON.parse(localStorage.getItem(key) || "[]");
    } catch {
      return [];
    }
  }, THREAD_KEY);
}

async function waitGeneralLoaded(page) {
  await page.waitForFunction(
    () => document.body.dataset.listingLoaded === "true",
    { timeout: 15000 }
  );
}

async function waitShopLoaded(page) {
  await page.waitForFunction(
    () =>
      document.body.dataset.listingLoaded === "true" ||
      document.querySelector("[data-biz-detail-root]:not([hidden])"),
    { timeout: 15000 }
  );
}

async function clickContactCta(page, selector) {
  const btn = page.locator(selector).first();
  await btn.waitFor({ state: "visible", timeout: 10000 });
  await Promise.all([
    page.waitForURL(/chat-list\.html\?thread=/, { timeout: 15000 }),
    btn.click(),
  ]);
  await waitChatListRendered(page);
}

async function waitChatListRendered(page) {
  await page.waitForFunction(
    () => {
      const list = document.getElementById("chatThreadList");
      if (!list) return false;
      const text = list.textContent || "";
      if (text.includes("読み込み中")) return false;
      if (text.includes("読み込みに失敗")) return false;
      return (
        list.querySelector(".chat-thread__title") != null ||
        text.includes("チャットがありません")
      );
    },
    { timeout: 20000 }
  );
}

async function testGeneralContact(page) {
  console.log("\n=== detail-general.html ===");
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  page.on("console", (msg) => {
    if (msg.type() === "error" && !isIgnorableConsoleError(msg.text())) errors.push(msg.text());
  });

  await clearChatStorage(page);
  await page.goto(`${BASE}/detail-general.html`, { waitUntil: "networkidle" });
  await waitGeneralLoaded(page);

  await clickContactCta(
    page,
    "[data-business-service-estimate], [data-biz-detail-inquiry]"
  );

  if (/chat-list\.html\?thread=/.test(page.url())) pass("general: chat-list 遷移", page.url());
  else fail("general: chat-list 遷移", page.url());

  const threads = await readThreads(page);
  const row = threads.find((t) => t.listingId === GENERAL_DEMO_ID);
  if (row) pass("general: tasful_chat_threads 保存", row.id);
  else fail("general: tasful_chat_threads 保存");

  if (row?.lastMessage?.includes("掲載内容について相談")) pass("general: 初期メッセージ");
  else fail("general: 初期メッセージ", row?.lastMessage);

  const listText = await page.evaluate(
    () => document.getElementById("chatThreadList")?.textContent || ""
  );
  if (listText.includes("地域交流")) pass("general: chat-list 表示");
  else fail("general: chat-list 表示", listText.slice(0, 120));

  const countBefore = threads.length;
  await page.goto(`${BASE}/detail-general.html`, { waitUntil: "networkidle" });
  await waitGeneralLoaded(page);
  await clickContactCta(
    page,
    "[data-business-service-estimate], [data-biz-detail-inquiry]"
  );
  const threadsAfter = await readThreads(page);
  if (threadsAfter.length === countBefore) pass("general: 重複作成なし");
  else fail("general: 重複作成なし", `${countBefore} -> ${threadsAfter.length}`);

  if (errors.length === 0) pass("general: console エラーなし");
  else fail("general: console エラーなし", errors.slice(0, 2).join(" | "));
}

async function testShopContact(page) {
  console.log("\n=== detail-shop other ===");
  await clearChatStorage(page);
  await page.goto(`${BASE}/detail-shop.html?id=${SHOP_OTHER_ID}`, { waitUntil: "networkidle" });
  await waitShopLoaded(page);
  await page.waitForTimeout(500);

  await clickContactCta(page, "[data-biz-detail-sticky-inquiry], .shop-sticky-action-nav__btn--gold");

  const threads = await readThreads(page);
  const row = threads.find((t) => t.listingId === SHOP_OTHER_ID);
  if (row) pass("shop: tasful_chat_threads 保存", row.id);
  else fail("shop: tasful_chat_threads 保存");

  if (row?.lastMessage?.includes("商品・販売について")) pass("shop: 初期メッセージ");
  else fail("shop: 初期メッセージ", row?.lastMessage);

  const detailLink = await page.evaluate(
    ({ demoId }) => {
      const row = document.querySelector(`[data-listing-id="${demoId}"]`);
      const link = row?.querySelector(".chat-thread__detail-link");
      return link?.getAttribute("href") || "";
    },
    { demoId: SHOP_OTHER_ID }
  );
  if (detailLink?.includes(SHOP_OTHER_ID)) pass("shop: 詳細リンク", detailLink);
  else fail("shop: 詳細リンク", detailLink);
}

async function testBizContact(page) {
  console.log("\n=== detail-business-service ===");
  await clearChatStorage(page);
  await page.goto(`${BASE}/detail-business-service.html?id=${BIZ_DEMO_ID}`, {
    waitUntil: "networkidle",
  });
  await waitGeneralLoaded(page);

  await clickContactCta(page, "[data-business-service-chat], [data-biz-detail-inquiry]");

  const threads = await readThreads(page);
  const row = threads.find((t) => t.listingId === BIZ_DEMO_ID);
  if (row) pass("biz: tasful_chat_threads 保存", row.id);
  else fail("biz: tasful_chat_threads 保存");

  if (row?.lastMessage?.includes("見積もり・相談")) pass("biz: 初期メッセージ");
  else fail("biz: 初期メッセージ", row?.lastMessage);
}

async function testDashboardLink(page) {
  const hasBack = await page.evaluate(() =>
    Boolean(document.querySelector("[data-chat-back-dashboard], .chat-list-back"))
  );
  if (hasBack) pass("chat-list: ダッシュボードへ戻る");
  else fail("chat-list: ダッシュボードへ戻る");
}

async function testLayout(page, width) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`${BASE}/chat-list.html`, { waitUntil: "networkidle" });
  const box = await page.evaluate(() =>
    document.querySelector(".chat-list__item--local-consult")?.getBoundingClientRect()
  );
  if (box && box.width > 0) pass(`chat-list レイアウト ${width}px`, `${Math.round(box.width)}px`);
  else pass(`chat-list レイアウト ${width}px`, "スレッドなし（スキップ）");
}

async function main() {
  console.log(`\n相談・問い合わせ E2E — ${BASE}\n`);
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();

  await testGeneralContact(page);
  await testShopContact(page);
  await testBizContact(page);
  await testDashboardLink(page);
  await testLayout(page, 1280);
  await testLayout(page, 390);

    });
  const ok = results.filter((r) => r.ok).length;
  console.log(`\n--- 結果: ${ok}/${results.length} OK ---\n`);
  await closeAllBrowsers();
  process.exit(ok === results.length ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

await closeAllBrowsers();
