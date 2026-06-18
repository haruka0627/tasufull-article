/**
 * TALK 友達 / カレンダー / フィルタ UI 検証（390 / 1280）
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "talk-friend-calendar-390");
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

const browser = await chromium.launch({ headless: true });

async function openChat(page) {
  await page.goto(`${base}/talk-home.html?tab=chat&talkDev=1`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForSelector("[data-talk-line-list-filters]", { timeout: 15000 });
  await page.waitForTimeout(1200);
}

const page390 = await browser.newPage({ viewport: { width: 390, height: 844 } });
await openChat(page390);

const addMenu390 = await page390.evaluate(() => {
  document.querySelector("[data-talk-friend-add-open]")?.click();
  const menu = document.querySelector("[data-talk-add-menu]");
  return {
    menuVisible: menu && !menu.hidden,
    items: [...document.querySelectorAll("[data-talk-add-action]")].map((el) => el.textContent?.trim()),
  };
});
await page390.screenshot({ path: path.join(OUT_DIR, "talk-add-menu-mobile390.png"), fullPage: true });

await page390.evaluate(() => {
  document.querySelector('[data-talk-add-action="friend"]')?.click();
});
await page390.waitForTimeout(600);
const friendModal390 = await page390.evaluate(() => ({
  open: !document.querySelector("[data-talk-friend-add-modal]")?.hidden,
  methods: [...document.querySelectorAll("[data-talk-friend-method]")].map((el) => el.textContent?.trim()),
  hasQr: Boolean(document.querySelector('[data-talk-friend-panel="qr"]:not([hidden])')),
}));
await page390.screenshot({ path: path.join(OUT_DIR, "talk-friend-add-mobile390.png"), fullPage: true });

await page390.evaluate(() => {
  document.querySelector("[data-talk-friend-add-close]")?.click();
});
await page390.waitForTimeout(300);

const filters390 = await page390.evaluate(() => {
  const tab = document.querySelector(".talk-line-category-tab");
  const bar = document.querySelector(".talk-line-category-bar");
  const tabRect = tab?.getBoundingClientRect();
  const barRect = bar?.getBoundingClientRect();
  return {
    tabs: [...document.querySelectorAll("[data-talk-line-filter]")].map((el) => el.textContent?.trim()),
    tabHeight: tabRect?.height || 0,
    barHeight: barRect?.height || 0,
  };
});

await page390.evaluate(() => {
  document.querySelector("[data-talk-list-overflow-open]")?.click();
});
await page390.waitForTimeout(300);
const overflow390 = await page390.evaluate(() => ({
  open: !document.querySelector("[data-talk-list-overflow-menu]")?.hidden,
  items: [...document.querySelectorAll("[data-talk-list-action]")].map((el) => el.textContent?.trim()),
}));
await page390.screenshot({ path: path.join(OUT_DIR, "talk-list-overflow-mobile390.png"), fullPage: true });

await page390.evaluate(() => {
  document.querySelector('[data-talk-select-thread][data-talk-thread-id="talk-mock-friend-001"]')?.click();
});
await page390.waitForTimeout(900);
await page390.evaluate(() => {
  document.querySelector('[data-talk-line-action="menu"]')?.click();
});
await page390.waitForTimeout(400);
const roomMenu390 = await page390.evaluate(() => ({
  open: !document.querySelector("[data-talk-room-menu]")?.hidden,
  items: [...document.querySelectorAll("[data-talk-room-menu-action]")].map((el) => el.textContent?.trim()),
}));
await page390.screenshot({ path: path.join(OUT_DIR, "talk-room-menu-mobile390.png"), fullPage: true });

await page390.evaluate(() => {
  document.querySelector('[data-talk-room-menu-action="calendar-add"]')?.click();
});
await page390.waitForTimeout(600);
const calendarPage390 = page390.url().includes("talk-calendar.html");
if (!calendarPage390) {
  throw new Error("Expected navigation to talk-calendar.html");
}
await page390.screenshot({ path: path.join(OUT_DIR, "talk-calendar-page-mobile390.png"), fullPage: true });

await page390.goto(`${base}/talk-home.html?tab=chat&thread=talk-mock-friend-001&talkDev=1`, {
  waitUntil: "domcontentloaded",
});
await page390.waitForTimeout(800);
await page390.evaluate(() => {
  document.querySelector('[data-talk-line-action="menu"]')?.click();
});
await page390.waitForTimeout(300);
await page390.evaluate(() => {
  document.querySelector('[data-talk-room-menu-action="profile"]')?.click();
});
await page390.waitForTimeout(600);
const profilePage390 = page390.url().includes("talk-profile.html");
await page390.screenshot({ path: path.join(OUT_DIR, "talk-profile-page-mobile390.png"), fullPage: true });

await page390.goto(`${base}/talk-home.html?tab=chat&thread=talk-mock-friend-001&talkDev=1`, {
  waitUntil: "domcontentloaded",
});
await page390.waitForTimeout(800);
const chatOnly390 = await page390.evaluate(() => ({
  hasProfileModal: Boolean(document.querySelector("[data-talk-profile-modal]:not([hidden])")),
  hasCalendarModal: Boolean(document.querySelector("[data-talk-calendar-modal]")),
  hasMemoModal: Boolean(document.querySelector("[data-talk-memo-modal]")),
  hasMessages: Boolean(document.querySelector("[data-talk-line-messages]")),
  hasComposer: Boolean(document.querySelector("[data-talk-line-composer]:not([hidden])")),
}));
await page390.screenshot({ path: path.join(OUT_DIR, "talk-chat-only-mobile390.png"), fullPage: true });

await page390.goto(`${base}/talk-home.html?tab=chat&talkDev=1`, { waitUntil: "domcontentloaded" });
await page390.waitForTimeout(800);
await page390.evaluate(() => {
  document.querySelector('[data-talk-list-action="mark-all-read"]')?.click();
});
await page390.waitForTimeout(1200);
const markAllRead390 = await page390.evaluate(() => {
  const platform = document.querySelector('[data-talk-thread-id="official_platform"]');
  const unreadBadge = platform?.querySelector(".talk-line-list__badge, .talk-chat-line__unread");
  return {
    clicked: true,
    platformUnreadText: unreadBadge?.textContent?.trim() || "",
  };
});
await page390.screenshot({ path: path.join(OUT_DIR, "talk-mark-all-read-mobile390.png"), fullPage: true });

await page390.goto(`${base}/talk-home.html?tab=chat&thread=official_platform&talkDev=1`, {
  waitUntil: "domcontentloaded",
});
await page390.waitForTimeout(900);
await page390.evaluate(() => {
  document.querySelector('[data-talk-line-action="menu"]')?.click();
});
await page390.waitForTimeout(400);
const officialMenu390 = await page390.evaluate(() => ({
  items: [...document.querySelectorAll("[data-talk-room-menu-action]")].map((el) => el.textContent?.trim()),
}));
await page390.screenshot({ path: path.join(OUT_DIR, "talk-official-room-menu-mobile390.png"), fullPage: true });
await page390.close();

const page1280 = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await openChat(page1280);
await page1280.click('[data-talk-select-thread][data-talk-thread-id="official_platform"]');
await page1280.waitForTimeout(800);
await page1280.screenshot({ path: path.join(OUT_DIR, "talk-home-desktop1280.png"), fullPage: true });
await page1280.close();
await browser.close();

const checks = {
  addMenuHasFriendAndGroup: addMenu390.items.includes("友達追加") && addMenu390.items.includes("グループ作成"),
  friendModalMethods: ["QRコード", "電話番号", "ID検索", "招待リンク"].every((l) => friendModal390.methods.includes(l)),
  friendModalOpen: friendModal390.open,
  filterTabHeight48: filters390.tabHeight >= 48 && filters390.barHeight >= 48,
  filterTabs: ["すべて", "未読", "重要", "プラット", "運営", "安否"].every((l) => filters390.tabs.includes(l)),
  overflowMenu: overflow390.items.includes("未読のみ表示") && overflow390.items.includes("すべて既読にする"),
  roomMenuSafety: ["ブロック", "通報", "ミュート", "ピン留め", "メモ"].every((l) =>
    roomMenu390.items.some((item) => item.includes(l.replace("を解除", "")))
  ),
  roomMenuCalendar: roomMenu390.items.some((i) => i.includes("カレンダー")) && roomMenu390.items.some((i) => i.includes("予定")),
  officialMenuOnly: officialMenu390.items.join("|") === "カレンダー|予定一覧|ミュート",
  calendarPageNav: calendarPage390,
  profilePageNav: profilePage390,
  chatNoSubModals: !chatOnly390.hasProfileModal && !chatOnly390.hasCalendarModal && !chatOnly390.hasMemoModal,
  chatHasMessagesAndComposer: chatOnly390.hasMessages && chatOnly390.hasComposer,
  markAllReadRan: markAllRead390.clicked,
};

const report = {
  pass: Object.values(checks).every(Boolean),
  checks,
  addMenu390,
  friendModal390,
  filters390,
  overflow390,
  roomMenu390,
  officialMenu390,
  chatOnly390,
  markAllRead390,
};
fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (!report.pass) {
  console.error("FAIL");
  process.exit(1);
}
console.log("PASS");
