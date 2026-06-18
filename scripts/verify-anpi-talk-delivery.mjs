#!/usr/bin/env node
/**
 * 安否通知 — TASFUL TALK 配信確認（通知タブは回帰のみ）
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { mkdirSync } from "fs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const VIEWPORT = { width: 390, height: 844 };
const OUT_DIR = "screenshots/anpi-talk-delivery";

/** ユーザー指定デモ ↔ マスターID */
const KEY_CASES = [
  {
    id: "anpi-check-request-001",
    title: "安否確認をお願いします",
    destination: "安否回答画面",
    expectPath: "/anpi-dashboard.html",
    expectHash: "check",
  },
  {
    id: "anpi-family-response-001",
    title: "安否回答がありました",
    destination: "安否ダッシュボード",
    expectPath: "/anpi-dashboard.html",
    expectHash: "family",
  },
  {
    id: "anpi-no-response-001",
    title: "未回答者がいます",
    destination: "未回答者一覧",
    expectPath: "/anpi-dashboard.html",
    expectHash: "no-response",
  },
];

const NOTIFY_TAB_CASES = [
  { id: "anpi-check-request-001", title: "安否確認をお願いします" },
  { id: "anpi-family-response-001", title: "安否回答がありました" },
  { id: "anpi-no-response-001", title: "未回答者がいます" },
  { id: "anpi-disaster-info-001", title: "災害情報が発表されました" },
  { id: "anpi-drill-001", title: "安否訓練のお知らせ" },
  { id: "anpi-setting-updated-001", title: "通知設定が更新されました" },
];

const STORAGE_KEYS = [
  "tasful_talk_notifications",
  "tasful_platform_notify_master_v1",
  "tasful_builder_notify_master_v1",
  "tasful_anpi_notify_master_v1",
  "tasful_talk_notifications_seeded_v2",
  "tasful_chat_messages",
  "tasful_official_room_last_seen_v1",
];

function matchUrl(actualUrl, c) {
  const u = new URL(actualUrl);
  const issues = [];
  if (u.pathname !== c.expectPath) {
    issues.push(`path: ${u.pathname} (expected ${c.expectPath})`);
  }
  if (c.expectHash) {
    const hash = u.hash.replace(/^#/, "");
    if (hash !== c.expectHash) issues.push(`hash=${hash || "(なし)"} (expected ${c.expectHash})`);
  }
  return issues;
}

function sameTarget(actual, expected) {
  try {
    const a = new URL(actual, "http://localhost/");
    const e = new URL(expected, "http://localhost/");
    if (a.pathname !== e.pathname) return false;
    for (const [key, val] of e.searchParams.entries()) {
      if (a.searchParams.get(key) !== val) return false;
    }
    return a.hash.replace(/^#/, "") === e.hash.replace(/^#/, "");
  } catch {
    return false;
  }
}

mkdirSync(OUT_DIR, { recursive: true });
let results = [];
await withPlaywrightBrowser(async (browser) => {
async function resetStorage(page) {
  await page.goto(`${BASE}/talk-home.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.evaluate((keys) => keys.forEach((k) => localStorage.removeItem(k)), STORAGE_KEYS);
}

// --- TALK一覧（公式ルームカード）---
const listPage = await browser.newPage({ viewport: VIEWPORT });
await resetStorage(listPage);
await listPage.goto(`${BASE}/talk-home.html?tab=chat`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await listPage.waitForSelector('[data-talk-thread-id="official_anpi"]', { timeout: 20000 });
await listPage.waitForTimeout(900);
await listPage.screenshot({ path: `${OUT_DIR}/01-talk-list-anpi-390.png`, fullPage: true });

const listInfo = await listPage.evaluate(() => {
  const row = document.querySelector('[data-talk-thread-id="official_anpi"]');
  return {
    visible: Boolean(row),
    name: row?.querySelector(".talk-line-list__name")?.textContent?.trim() || "",
    preview: row?.querySelector(".talk-line-list__preview")?.textContent?.trim() || "",
    unread: window.TasuTalkOfficialRooms?.getRoomPreview?.("official_anpi")?.unreadCount ?? 0,
  };
});
results.push({
  surface: "talk-list",
  status: listInfo.visible && listInfo.unread > 0 ? "OK" : "NG",
  issues: listInfo.visible
    ? listInfo.unread > 0
      ? []
      : ["未読バッジなし"]
    : ["official_anpi 未表示"],
  ...listInfo,
});

// --- TALKルーム内 ---
const roomPage = await browser.newPage({ viewport: VIEWPORT });
await resetStorage(roomPage);
await roomPage.goto(`${BASE}/talk-home.html?tab=chat&thread=official_anpi`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await roomPage.waitForSelector(".chat-notify-card__title", { timeout: 20000 });
await roomPage.waitForTimeout(900);
await roomPage.screenshot({ path: `${OUT_DIR}/02-talk-room-anpi-390.png`, fullPage: true });

const talkAudit = await roomPage.evaluate((ids) => {
  const msgs =
    window.TasuTalkOfficialRooms?.getRoomMessages?.("official_anpi")?.filter(
      (m) => m.kind === "notify_card"
    ) || [];
  const byId = {};
  for (const m of msgs) {
    const nid = String(m.notifyCard?.notificationId || "");
    if (nid) byId[nid] = m.notifyCard;
  }
  const domCards = [...document.querySelectorAll(".chat-bubble--notify-card")].map((el) => ({
    title: el.querySelector(".chat-notify-card__title")?.textContent?.trim() || "",
    body: el.querySelector(".chat-bubble__text")?.textContent?.trim() || "",
    actionLabel: el.querySelector(".chat-notify-card__action")?.textContent?.trim() || "",
  }));
  return { msgCount: msgs.length, byId, domCards, ids };
}, KEY_CASES.map((c) => c.id));

for (const c of KEY_CASES) {
  const card = talkAudit.byId[c.id];
  const issues = [];
  if (!card) issues.push("TALKルームに未表示");
  else {
    if (card.title !== c.title) issues.push(`title=${card.title}`);
    if (card.body) issues.push(`body残存: ${card.body}`);
    if (card.actionLabel !== "確認する") issues.push(`actionLabel=${card.actionLabel}`);
  }
  results.push({
    surface: "talk-room",
    id: c.id,
    title: c.title,
    status: issues.length === 0 ? "OK" : "NG",
    issues,
    href: card?.href || "",
  });
}

// --- メッセージ0件でも一覧に常時表示 ---
const emptyPage = await browser.newPage({ viewport: VIEWPORT });
await emptyPage.goto(`${BASE}/talk-home.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
await emptyPage.evaluate((keys) => keys.forEach((k) => localStorage.removeItem(k)), STORAGE_KEYS);
await emptyPage.goto(`${BASE}/talk-home.html?tab=chat`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await emptyPage.waitForSelector('[data-talk-thread-id="official_anpi"]', { timeout: 20000 });
const emptyState = await emptyPage.evaluate(() => {
  const row = document.querySelector('[data-talk-thread-id="official_anpi"]');
  const msgCount = window.TasuTalkOfficialRooms?.getRoomMessages?.("official_anpi")?.length ?? -1;
  return {
    visible: Boolean(row),
    name: row?.querySelector(".talk-line-list__name")?.textContent?.trim() || "",
    msgCount,
  };
});
results.push({
  surface: "talk-list-empty",
  status: emptyState.visible && emptyState.name === "TASFUL安否センター" ? "OK" : "NG",
  issues: emptyState.visible
    ? emptyState.name === "TASFUL安否センター"
      ? []
      : [`name=${emptyState.name}`]
    : ["メッセージ0件でも未表示"],
  ...emptyState,
});
await emptyPage.close();

// --- TALKボタン遷移（主要3件）---
for (const c of KEY_CASES) {
  const page = await browser.newPage({ viewport: VIEWPORT });
  const row = { surface: "talk-nav", id: c.id, title: c.title, status: "NG", issues: [] };
  try {
    await resetStorage(page);
    await page.goto(`${BASE}/talk-home.html?tab=chat&thread=official_anpi`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForSelector(".chat-notify-card__action", { timeout: 20000 });

    const expectedHref = talkAudit.byId[c.id]?.href || "";
    if (!expectedHref) {
      row.issues.push("href未検出");
    } else {
      const navPromise = page
        .waitForURL((url) => !url.pathname.endsWith("/talk-home.html"), { timeout: 15000 })
        .catch(() => null);

      const clicked = await page.evaluate((href) => {
        const sameTarget = (actual, expected) => {
          try {
            const a = new URL(actual, window.location.href);
            const e = new URL(expected, window.location.href);
            if (a.pathname !== e.pathname) return false;
            for (const [key, val] of e.searchParams.entries()) {
              if (a.searchParams.get(key) !== val) return false;
            }
            return a.hash.replace(/^#/, "") === e.hash.replace(/^#/, "");
          } catch {
            return false;
          }
        };
        const link = [...document.querySelectorAll(".chat-notify-card__action")].find((a) =>
          sameTarget(a.getAttribute("href") || a.href, href)
        );
        if (!link) return false;
        link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        return true;
      }, expectedHref);

      if (!clicked) row.issues.push("TALKボタン未検出");
      else {
        await navPromise;
        await page.waitForLoadState("domcontentloaded");
        await page.waitForTimeout(900);
        row.navUrl = page.url();
        row.issues.push(...matchUrl(row.navUrl, c));
        await page.screenshot({
          path: `${OUT_DIR}/03-talk-nav-${c.id}-390.png`,
          fullPage: true,
        });
      }
    }
  } catch (err) {
    row.issues.push(String(err?.message || err));
  }
  row.status = row.issues.length === 0 ? "OK" : "NG";
  results.push(row);
  console.log(row.status, "talk-nav", c.title, row.navUrl || "");
  await page.close();
}

// --- 通知タブ回帰 ---
const notifyPage = await browser.newPage({ viewport: VIEWPORT });
await resetStorage(notifyPage);
await notifyPage.goto(`${BASE}/talk-home.html?tab=notify`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await notifyPage.waitForSelector('[data-talk-notify-id="anpi-check-request-001"]', { timeout: 20000 });
await notifyPage.evaluate(() => {
  document.querySelector('[data-talk-notify-mobile-chip="anpi"]')?.click();
});
await notifyPage.waitForTimeout(800);
await notifyPage.screenshot({ path: `${OUT_DIR}/04-notify-tab-anpi-filter-390.png`, fullPage: true });

for (const c of NOTIFY_TAB_CASES) {
  const info = await notifyPage.evaluate((id) => {
    const card = document.querySelector(`[data-talk-notify-id="${id}"]`);
    const action = card?.querySelector("[data-talk-notify-action]");
    return {
      visible: Boolean(card),
      title: card?.querySelector(".talk-notify-card__title")?.textContent?.trim() || "",
      actionLabel: action?.textContent?.trim() || "",
      href: action?.getAttribute("href") || "",
    };
  }, c.id);
  const issues = [];
  if (!info.visible) issues.push("未表示");
  if (info.title !== c.title) issues.push(`title=${info.title}`);
  results.push({
    surface: "notify-tab",
    id: c.id,
    status: issues.length === 0 ? "OK" : "NG",
    issues,
    ...info,
  });
}

await listPage.close();
await roomPage.close();
await notifyPage.close();
});

const failed = results.filter((r) => r.status !== "OK");
console.log(`\nTALK messages: ${talkAudit.msgCount}`);
console.log(`結果: ${results.length - failed.length}/${results.length} OK`);
if (failed.length) {
  for (const r of failed) {
    console.log(`- [${r.surface}] ${r.id || r.title || ""}: ${r.issues.join("; ")}`);
  }
  await closeAllBrowsers();
  process.exit(1);
}
await closeAllBrowsers();
process.exit(0);
