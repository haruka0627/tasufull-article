/**
 * TASFUL TALK — 公式トーク通知ミラー スクリーンショット（390px）
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "talk-official-notify-v1");
const PORTS = [5173, 5176, 5174, 5199, 5200, 5188];

async function findBaseUrl() {
  for (const port of PORTS) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/talk-home.html?tab=chat`, { method: "HEAD" });
      if (res.ok) return `http://127.0.0.1:${port}`;
    } catch {
      /* next */
    }
  }
  throw new Error("No dev server found");
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = await findBaseUrl();
console.log("Base URL:", base);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });

async function freshPage() {
  const page = await context.newPage();
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
  return page;
}

const listPage = await freshPage();
await listPage.goto(`${base}/talk-home.html?tab=chat`, { waitUntil: "domcontentloaded", timeout: 60000 });
await listPage.waitForSelector('[data-talk-thread-id="official_tasful"]', { timeout: 20000 });
await listPage.waitForTimeout(1200);
await listPage.screenshot({ path: path.join(OUT_DIR, "01-talk-list.png"), fullPage: false });
console.log("Saved: 01-talk-list.png");

async function captureRoom(file, roomId) {
  const p = await freshPage();
  await p.goto(`${base}/talk-home.html?tab=chat&thread=${roomId}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await p.waitForSelector("[data-talk-line-room-active]:not([hidden])", { timeout: 15000 });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: path.join(OUT_DIR, file), fullPage: false });
  console.log("Saved:", file);
  await p.close();
}

await captureRoom("02-official-tasful-room.png", "official_tasful");
await captureRoom("03-official-anpi-room.png", "official_anpi");
await captureRoom("04-official-builder-room.png", "official_builder");

const notifyPage = await freshPage();
await notifyPage.goto(`${base}/talk-home.html?tab=notify`, { waitUntil: "domcontentloaded", timeout: 60000 });
await notifyPage.waitForSelector('[data-talk-notify-id="platform-system-maintenance-001"]', { timeout: 15000 });
await notifyPage.waitForTimeout(900);
await notifyPage.screenshot({ path: path.join(OUT_DIR, "05-notify-tab.png"), fullPage: false });
console.log("Saved: 05-notify-tab.png");

const destPage = await freshPage();
await destPage.goto(`${base}/talk-home.html?tab=chat&thread=official_builder`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await destPage.waitForSelector(".chat-notify-card__action", { timeout: 15000 });
const href = await destPage.locator(".chat-notify-card__action").first().getAttribute("href");
await destPage.locator(".chat-notify-card__action").first().click();
await destPage.waitForTimeout(1400);
await destPage.screenshot({ path: path.join(OUT_DIR, "06-action-destination.png"), fullPage: false });
console.log("Saved: 06-action-destination.png", href);

await listPage.close();
await notifyPage.close();
await destPage.close();
await browser.close();
console.log("Done.");
