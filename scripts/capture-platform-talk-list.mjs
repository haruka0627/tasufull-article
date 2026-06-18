/**
 * 一般トーク一覧 — TASFUL運営ルーム実画面キャプチャ + localStorage 監査
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "platform-talk-list");
const PORTS = [5173, 5174, 5176, 5199, 5200, 5188];

async function findBaseUrl() {
  for (const port of PORTS) {
    try {
      const res = await fetch(`http://localhost:${port}/talk-home.html?tab=chat`, { method: "GET" });
      if (res.ok) return `http://localhost:${port}`;
    } catch {
      /* next */
    }
  }
  throw new Error("No dev server found");
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = await findBaseUrl();
console.log("Base URL:", base);

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

await page.goto(`${base}/talk-home.html?tab=chat`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(2500);

const audit = await page.evaluate(() => {
  const readJson = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };
  const messages = readJson("tasful_chat_messages", {});
  const threads = readJson("tasful_chat_threads", []);
  const notifications = readJson("tasful_talk_notifications", []);
  const officialMsgs = Array.isArray(messages?.official_tasful) ? messages.official_tasful : [];
  const officialThread = (Array.isArray(threads) ? threads : []).find((t) => t.id === "official_tasful");
  const builderThread = (Array.isArray(threads) ? threads : []).find((t) => t.id === "official_builder");
  const talkMirror = notifications.filter((n) => n.sendTalkMessage && n.officialRoomId === "official_tasful");
  const display = window.TasuTalkData?.buildChatDisplayList?.(window.TasuTalkHomeUi ? [] : []) || [];
  const listEl = document.querySelector("#talkChatThreadList");
  const tasfulCard = document.querySelector('[data-talk-thread-id="official_tasful"]');
  const builderCard = document.querySelector('[data-talk-thread-id="official_builder"]');
  return {
    storageKeys: {
      tasful_chat_messages_hasOfficial: officialMsgs.length > 0,
      official_tasful_messageCount: officialMsgs.length,
      tasful_chat_threads_hasOfficial: Boolean(officialThread),
      official_tasful_thread: officialThread || null,
      official_builder_thread: builderThread || null,
      tasful_talk_notifications_mirrorCount: talkMirror.length,
    },
    officialRoomCards: (window.TasuTalkOfficialRooms?.getOfficialRoomCards?.() || []).map((c) => ({
      id: c.id,
      name: c.partner?.displayName,
      preview: c.lastMessagePreview,
      unread: c.unreadCount,
    })),
    listItemIds: [...document.querySelectorAll("[data-talk-thread-id]")].map((el) => el.getAttribute("data-talk-thread-id")),
    tasfulCardVisible: Boolean(tasfulCard),
    tasfulCardName: tasfulCard?.querySelector(".talk-line-list__name")?.textContent?.trim() || "",
    tasfulCardUnread: tasfulCard?.querySelector(".talk-chat-line__unread")?.textContent?.trim() || "0",
    builderCardVisible: Boolean(builderCard),
    listHtmlLength: listEl?.innerHTML?.length || 0,
    sampleOfficialTitles: officialMsgs.slice(-3).map((m) => m.notifyCard?.title || m.text),
  };
});

const auditPath = path.join(OUT_DIR, "localStorage-audit.json");
fs.writeFileSync(auditPath, JSON.stringify(audit, null, 2), "utf8");
console.log("Audit saved:", auditPath);
console.log(JSON.stringify(audit, null, 2));

if (!audit.tasfulCardVisible) {
  console.warn("TASFUL運営カード未表示 — 同期を再実行");
  await page.evaluate(() => {
    window.TasuTalkOfficialRooms?.syncAllFromStore?.();
    window.TasuTalkOfficialRooms?.repairOfficialThreadsFromMessages?.();
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
}

await page.waitForSelector('[data-talk-thread-id="official_tasful"]', { timeout: 20000 });
await page.screenshot({ path: path.join(OUT_DIR, "talk-list-390.png"), fullPage: false });
console.log("Saved: talk-list-390.png");

await page.locator('[data-talk-select-thread][data-talk-thread-id="official_tasful"]').click();
await page.waitForSelector("[data-talk-line-room-active]:not([hidden])", { timeout: 15000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(OUT_DIR, "official-tasful-room-390.png"), fullPage: false });
console.log("Saved: official-tasful-room-390.png");

});

await closeAllBrowsers();
