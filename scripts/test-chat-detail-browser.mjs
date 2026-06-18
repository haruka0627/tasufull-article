#!/usr/bin/env node
/**
 * chat-list → chat-detail メッセージ送受信 E2E
 *
 *   BASE_URL=http://localhost:5180 node scripts/test-chat-detail-browser.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://localhost:5173").replace(/\/$/, "");
const THREAD_KEY = "tasful_chat_threads";
const MESSAGES_KEY = "tasful_chat_messages";
const GENERAL_DEMO_ID = "general-demo-002";

/** @type {{ step: string; ok: boolean; detail?: string }[]} */
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
    t.includes("Supabase") ||
    t.includes("[TasuSupabase]")
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

async function createThreadViaDetail(page) {
  await page.goto(`${BASE}/detail-general.html`, { waitUntil: "networkidle" });
  await page.waitForFunction(
    () => document.body.dataset.listingLoaded === "true",
    { timeout: 15000 }
  );
  const btn = page.locator("[data-business-service-estimate], [data-biz-detail-inquiry]").first();
  await Promise.all([
    page.waitForURL(/chat-list\.html\?thread=/, { timeout: 15000 }),
    btn.click(),
  ]);
  const threadId = new URL(page.url()).searchParams.get("thread");
  return threadId;
}

async function waitChatListRendered(page) {
  await page.waitForFunction(
    () => {
      const list = document.getElementById("chatThreadList");
      if (!list) return false;
      const text = list.textContent || "";
      if (text.includes("読み込み中")) return false;
      return list.querySelector(".chat-thread__title") != null;
    },
    { timeout: 20000 }
  );
}

async function waitChatDetailReady(page) {
  await page.waitForFunction(
    () => document.body.dataset.chatDetailReady === "true",
    { timeout: 20000 }
  );
}

async function main() {
  console.log(`\nchat-detail E2E — ${BASE}\n`);
  const consoleErrors = [];
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error" && !isIgnorableConsoleError(msg.text())) {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (e) => consoleErrors.push(String(e.message || e)));

  await clearChatStorage(page);
  const threadId = await createThreadViaDetail(page);
  if (threadId) pass("相談スレッド作成", threadId);
  else fail("相談スレッド作成");

  await waitChatListRendered(page);

  const listHref = await page.evaluate(
    ({ id }) =>
      document.querySelector(`[data-chat-thread-id="${id}"] .chat-thread`)?.getAttribute("href") || "",
    { id: threadId }
  );
  if (listHref.includes(`thread=${encodeURIComponent(threadId)}`) && !listHref.includes("roomId=")) {
    pass("一覧リンク thread パラメータ", listHref);
  } else if (listHref.includes("thread=")) {
    pass("一覧リンク thread パラメータ", listHref);
  } else {
    fail("一覧リンク thread パラメータ", listHref);
  }

  await page.locator(`[data-chat-thread-id="${threadId}"] .chat-thread`).click();
  await page.waitForURL(/chat-detail\.html/, { timeout: 15000 });
  await waitChatDetailReady(page);

  const header = await page.evaluate(() => ({
    url: location.href,
    title: document.getElementById("chatTitle")?.textContent?.trim() || "",
    sub: document.getElementById("chatSub")?.textContent?.trim() || "",
    category: document.getElementById("chatListingCategory")?.textContent?.trim() || "",
    detailLink: document.getElementById("chatListingDetailLink")?.getAttribute("href") || "",
    metaHidden: document.getElementById("chatListingMeta")?.hidden,
  }));

  if (/chat-detail\.html\?thread=/.test(header.url)) pass("詳細URL", header.url);
  else fail("詳細URL", header.url);

  if (header.title.includes("地域交流") || header.title.includes("掲載")) pass("掲載タイトル", header.title);
  else fail("掲載タイトル", header.title);

  if (header.sub.includes("相手：")) pass("相手名", header.sub);
  else fail("相手名", header.sub);

  if (!header.metaHidden && header.category) pass("カテゴリ", header.category);
  else fail("カテゴリ", header.category || "hidden");

  if (header.detailLink.includes("detail-general")) pass("掲載詳細リンク", header.detailLink);
  else fail("掲載詳細リンク", header.detailLink);

  const introCount = await page.evaluate(
    () => document.querySelectorAll("#chatMessages .chat-bubble__text").length
  );
  if (introCount >= 1) pass("初期メッセージ表示", String(introCount));
  else fail("初期メッセージ表示", String(introCount));

  const testPrefix = "よろしくお願いします";
  const testText = testPrefix;
  await page.fill("#chatInput", testText);
  await page.click("#chatSend");
  await page.waitForFunction(
    (prefix) =>
      Array.from(document.querySelectorAll("#chatMessages .chat-bubble__text")).some((el) =>
        el.textContent?.includes(prefix)
      ),
    testPrefix,
    { timeout: 15000 }
  );
  pass("メッセージ送信・表示");

  const stored = await page.evaluate(
    ({ threadKey, messagesKey, id, text }) => {
      const threads = JSON.parse(localStorage.getItem(threadKey) || "[]");
      const row = threads.find((t) => t.id === id);
      const map = JSON.parse(localStorage.getItem(messagesKey) || "{}");
      const msgs = map[id] || [];
      return {
        lastMessage: row?.lastMessage || "",
        updatedAt: row?.updatedAt || "",
        msgCount: msgs.length,
        hasSent: msgs.some((m) => String(m.text || "").includes(text)),
      };
    },
    { threadKey: THREAD_KEY, messagesKey: MESSAGES_KEY, id: threadId, text: testPrefix }
  );

  if (stored.hasSent && stored.msgCount >= 2) pass("tasful_chat_messages 保存", `${stored.msgCount}件`);
  else fail("tasful_chat_messages 保存", JSON.stringify(stored));

  if (stored.lastMessage.includes(testPrefix)) pass("thread.lastMessage 更新", stored.lastMessage);
  else fail("thread.lastMessage 更新", stored.lastMessage);

  await page.goto(`${BASE}/chat-list.html`, { waitUntil: "domcontentloaded" });
  await waitChatListRendered(page);

  const listPreview = await page.evaluate(
    ({ id }) =>
      document.querySelector(`[data-chat-thread-id="${id}"] .chat-thread__preview`)?.textContent?.trim() || "",
    { id: threadId }
  );
  if (listPreview.includes(testPrefix)) pass("chat-list 最新プレビュー", listPreview);
  else fail("chat-list 最新プレビュー", listPreview);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/chat-detail.html?thread=${encodeURIComponent(threadId)}`, {
    waitUntil: "domcontentloaded",
  });
  await waitChatDetailReady(page);
  const mobileBox = await page.evaluate(() =>
    document.querySelector(".chat-detail")?.getBoundingClientRect()
  );
  if (mobileBox && mobileBox.width > 280) pass("スマホレイアウト", `${Math.round(mobileBox.width)}px`);
  else fail("スマホレイアウト", `${mobileBox?.width ?? 0}px`);

  const fatal = consoleErrors.filter((t) => !isIgnorableConsoleError(t));
  if (fatal.length === 0) pass("console エラーなし");
  else fail("console エラーなし", fatal.slice(0, 2).join(" | "));

  await browser.close();
  const ok = results.filter((r) => r.ok).length;
  console.log(`\n--- 結果: ${ok}/${results.length} OK ---\n`);
  process.exit(ok === results.length ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
