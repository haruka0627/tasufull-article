/**
 * トークカレンダー — デモ予定入り 390px キャプチャ
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "talk-calendar-demo-390");
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

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

async function seedCalendar() {
  await page.goto(`${base}/talk-home.html?tab=chat&talkDev=1`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  return page.evaluate(() => {
    const result = globalThis.TasuTalkRoomCalendarDemo?.ensureDemoCalendarEvents?.({ force: true });
    const store = globalThis.TasuTalkRoomCalendarStore;
    return {
      seed: result,
      friend: store?.listEvents?.("talk-mock-friend-001")?.length || 0,
      platform: store?.listEvents?.("official_platform")?.length || 0,
      anpi: store?.listEvents?.("official_anpi")?.length || 0,
      ops: store?.listEvents?.("official_tasful")?.length || 0,
    };
  });
}

async function openCalendar(threadId) {
  await page.goto(`${base}/talk-calendar.html?thread=${encodeURIComponent(threadId)}&from=talk&talkDev=1`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForSelector("[data-talk-calendar-list]", { timeout: 15000 });
  await page.waitForSelector(".talk-calendar-card", { timeout: 15000 });
  await page.waitForTimeout(800);
}

async function readCalendarMetrics(threadId) {
  return page.evaluate((id) => {
    const cards = [...document.querySelectorAll(".talk-calendar-card")];
    const chatHasCalendarModal = Boolean(document.querySelector("[data-talk-calendar-modal]"));
    return {
      threadId: id,
      cardCount: cards.length,
      titles: cards.map((c) => c.querySelector(".talk-calendar-card__title")?.textContent?.trim()),
      notifyOn: cards.filter((c) => /通知ON/.test(c.textContent || "")).length,
      navButtons: cards.filter((c) => c.querySelector(".talk-calendar-card__nav")).length,
      empty: Boolean(document.querySelector(".talk-calendar-empty")),
      chatHasCalendarModal,
    };
  }, threadId);
}

const seedReport = await seedCalendar();
console.log("Seed:", seedReport);

const captures = [
  { threadId: "talk-mock-friend-001", file: "talk-calendar-friend-list-mobile390.png", scroll: 0 },
  { threadId: "talk-mock-friend-001", file: "talk-calendar-friend-detail-mobile390.png", scroll: "site" },
  { threadId: "official_platform", file: "talk-calendar-platform-mobile390.png", scroll: 0 },
  { threadId: "official_anpi", file: "talk-calendar-anpi-mobile390.png", scroll: 0 },
  { threadId: "official_tasful", file: "talk-calendar-ops-mobile390.png", scroll: 0 },
];

const report = {};

for (const cap of captures) {
  await openCalendar(cap.threadId);
  if (cap.scroll === "site") {
    await page.evaluate(() => {
      const card = document.querySelector('[data-talk-calendar-event-id="cal-demo-friend-site-001"]');
      card?.scrollIntoView({ block: "center" });
    });
    await page.waitForTimeout(400);
  }
  report[cap.file] = await readCalendarMetrics(cap.threadId);
  await page.screenshot({ path: path.join(OUT_DIR, cap.file), fullPage: false });
  console.log(cap.file, report[cap.file]);
}

await page.goto(`${base}/talk-home.html?tab=chat&thread=talk-mock-friend-001&talkDev=1`, {
  waitUntil: "domcontentloaded",
});
await page.waitForSelector(".talk-line-room-header", { timeout: 15000 });
await page.waitForTimeout(800);
const chatCheck = await page.evaluate(() => ({
  hasCalendarModal: Boolean(document.querySelector("[data-talk-calendar-modal]")),
  hasCalendarList: Boolean(document.querySelector("[data-talk-calendar-list]")),
  url: location.href,
}));
console.log("Chat check:", chatCheck);

});

const pass =
  seedReport.friend >= 3 &&
  seedReport.platform >= 2 &&
  seedReport.anpi >= 1 &&
  seedReport.ops >= 1 &&
  report["talk-calendar-friend-list-mobile390.png"]?.cardCount >= 3 &&
  report["talk-calendar-friend-list-mobile390.png"]?.notifyOn >= 3 &&
  report["talk-calendar-friend-detail-mobile390.png"]?.navButtons >= 1 &&
  report["talk-calendar-platform-mobile390.png"]?.cardCount >= 2 &&
  report["talk-calendar-anpi-mobile390.png"]?.cardCount >= 1 &&
  report["talk-calendar-ops-mobile390.png"]?.cardCount >= 1 &&
  !chatCheck.hasCalendarModal &&
  !chatCheck.hasCalendarList;

console.log("\nPASS:", pass);
await closeAllBrowsers();
process.exit(pass ? 0 : 1);
