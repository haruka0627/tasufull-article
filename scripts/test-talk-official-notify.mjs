/**
 * TASFUL TALK — 公式トーク通知ミラー Playwright 検証（390px）
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const PORTS = [5173, 5176, 5174, 5199, 5200, 5188];

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

const base = await findBaseUrl();
console.log("Base URL:", base);

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

await page.addInitScript(() => {
  [
    "tasful_talk_notifications",
    "tasful_platform_notify_master_v1",
    "tasful_builder_notify_master_v1",
    "tasful_anpi_notify_master_v1",
    "tasful_talk_notifications_seeded_v2",
    "tasful_chat_messages",
    "tasful_official_room_last_seen_v1",
  ].forEach((k) => localStorage.removeItem(k));
});

await page.goto(`${base}/talk-home.html?tab=chat`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector('[data-talk-thread-id="official_tasful"]', { timeout: 20000 });
await page.waitForTimeout(1200);

const audit = await page.evaluate(() => {
  const officialIds = ["official_tasful", "official_anpi", "official_builder"];
  const cards = officialIds.map((id) => {
    const row = document.querySelector(`[data-talk-thread-id="${id}"]`);
    return {
      id,
      exists: Boolean(row),
      name: row?.querySelector(".talk-line-list__name")?.textContent?.trim(),
      officialChip: row?.querySelector(".talk-line-list__chip--official")?.textContent?.trim(),
      preview: row?.querySelector(".talk-line-list__preview")?.textContent?.trim(),
      unread: row?.querySelector(".talk-chat-line__unread")?.textContent?.trim() || "0",
      unreadCount: window.TasuTalkOfficialRooms?.getRoomPreview?.(id)?.unreadCount ?? 0,
    };
  });
  const mockFriend = document.querySelector('[data-talk-thread-id="talk-mock-friend-001"]');
  const tab = document.querySelector("[data-tasu-app-tabbar]");
  const masters = window.TasuTalkData?.getNotifications?.({ applySettings: false }) || [];
  const talkMirror = masters.filter((n) => n.sendTalkMessage && n.officialRoomId);
  const notifyOnly = masters.filter((n) => n.sendNotification && !n.sendTalkMessage);
  const tasfulMsgs = window.TasuTalkOfficialRooms?.getRoomMessages?.("official_tasful") || [];
  const builderMsgs = window.TasuTalkOfficialRooms?.getRoomMessages?.("official_builder") || [];
  const anpiMsgs = window.TasuTalkOfficialRooms?.getRoomMessages?.("official_anpi") || [];
  return {
    cards,
    mockFriendOk: Boolean(mockFriend),
    tabVisible: Boolean(tab),
    notifyCount: masters.length,
    talkMirrorCount: talkMirror.length,
    notifyOnlyCount: notifyOnly.length,
    tasfulMsgCount: tasfulMsgs.length,
    builderMsgCount: builderMsgs.length,
    builderTalkEstimate: builderMsgs.some((m) =>
      String(m.notifyCard?.title || m.text || "").includes("見積")
    ),
    anpiMsgCount: anpiMsgs.length,
    sampleAction: tasfulMsgs[0]?.notifyCard?.href || "",
  };
});

console.log("Audit:", JSON.stringify(audit, null, 2));

let failed = false;

for (const card of audit.cards) {
  const ok =
    card.exists &&
    card.officialChip === "公式" &&
    card.preview &&
    Number(card.unreadCount) > 0;
  console.log(ok ? "OK" : "NG", card.id, card.name, "unread=", card.unread);
  if (!ok) failed = true;
}

if (!audit.mockFriendOk) failed = true;
if (!audit.tabVisible) failed = true;
if (audit.notifyCount < 40) failed = true;
if (audit.talkMirrorCount < 30) failed = true;
if (audit.tasfulMsgCount < 18) failed = true;
if (audit.anpiMsgCount < 6) failed = true;
if (audit.builderMsgCount < 3) failed = true;
if (audit.builderTalkEstimate) failed = true;

async function openOfficialRoom(roomId) {
  await page.locator(`[data-talk-select-thread][data-talk-thread-id="${roomId}"]`).click();
  await page.waitForSelector("[data-talk-line-room-active]:not([hidden])", { timeout: 10000 });
  await page.waitForTimeout(700);
}

await openOfficialRoom("official_tasful");
const tasfulRoom = await page.evaluate(() => ({
  actions: [...document.querySelectorAll(".chat-notify-card__action")].map((a) => ({
    label: a.textContent?.trim(),
    href: a.getAttribute("href"),
  })),
  composerHidden: document.querySelector("[data-talk-line-composer]")?.hidden === true,
}));
console.log("TASFUL room:", JSON.stringify(tasfulRoom, null, 2));
if (!tasfulRoom.actions.length || !tasfulRoom.composerHidden) failed = true;
if (!tasfulRoom.actions.some((a) => a.href?.includes("dashboard.html"))) failed = true;

await page.goto(`${base}/talk-home.html?tab=chat&thread=official_anpi`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForTimeout(1200);
const anpiRoom = await page.evaluate(() => ({
  actions: [...document.querySelectorAll(".chat-notify-card__action")].map((a) => a.getAttribute("href")),
  title: document.querySelector(".chat-notify-card__title")?.textContent?.trim(),
}));
console.log("Anpi room:", JSON.stringify(anpiRoom, null, 2));
if (!anpiRoom.actions.some((h) => h?.includes("anpi-dashboard.html"))) failed = true;

await page.goto(`${base}/talk-home.html?tab=chat&thread=official_builder`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForTimeout(1200);
const builderRoom = await page.evaluate(() => ({
  actions: [...document.querySelectorAll(".chat-notify-card__action")].map((a) => a.getAttribute("href")),
}));
console.log("Builder room:", JSON.stringify(builderRoom, null, 2));
if (!builderRoom.actions.some((h) => h?.includes("builder/board-thread.html"))) failed = true;

await page.goto(`${base}/talk-home.html?tab=notify`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(900);
const notifyTab = await page.evaluate(() => ({
  platform: document.querySelectorAll('[data-talk-notify-id^="platform-"]').length,
  builder: document.querySelectorAll('[data-talk-notify-id^="builder-"]').length,
  anpi: document.querySelectorAll('[data-talk-notify-id^="anpi-"]').length,
}));
console.log("Notify tab:", JSON.stringify(notifyTab, null, 2));
if (notifyTab.platform < 19) failed = true;
if (notifyTab.builder < 22) failed = true;
if (notifyTab.anpi < 6) failed = true;

});
await closeAllBrowsers();
process.exit(failed ? 1 : 0);
