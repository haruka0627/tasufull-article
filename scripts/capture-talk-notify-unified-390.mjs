/**
 * TASFUL TALK 通知統一 — 390px スクリーンショット（現行UI / talkDev=1）
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "talk-notify-unified-390");
fs.mkdirSync(OUT_DIR, { recursive: true });

const base = await findDevServerBaseUrl({ probePath: "talk-home.html" });
console.log("Base URL:", base);

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

await page.addInitScript(() => {
  [
    "tasful_talk_notifications",
    "tasful_platform_notify_master_v1",
    "tasful_platform_notify_master_v2",
    "tasful_builder_notify_master_v1",
    "tasful_anpi_notify_master_v1",
    "tasful_talk_notifications_seeded_v2",
    "tasful_chat_messages",
    "tasful_official_room_last_seen_v1",
  ].forEach((k) => localStorage.removeItem(k));
});

const notifyUrl = buildLocalPageUrl(base, "talk-home.html", "?tab=notify&talkDev=1&benchEmbed=1&userId=u_me");
await page.goto(notifyUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector('[data-talk-notify-id="builder-board-apply-001"]', { timeout: 25000 });
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(OUT_DIR, "01-notify-tab-top.png"), fullPage: false });

await page.evaluate(() => {
  const card = document.querySelector('article[data-talk-notify-id="platform-verify-job-full-apply-001"]');
  card?.scrollIntoView({ block: "center" });
});
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(OUT_DIR, "02-notify-job-apply.png"), fullPage: false });

await page.evaluate(() => {
  const card = document.querySelector('article[data-talk-notify-id="builder-ops-route-001"]');
  card?.scrollIntoView({ block: "center" });
});
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(OUT_DIR, "03-notify-builder-ops-route.png"), fullPage: false });

await page.goto(buildLocalPageUrl(base, "talk-home.html", "?tab=chat&talkDev=1"), {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForTimeout(1200);
const builderRoom = page.locator('[data-talk-thread-id="official_builder"]').first();
if (await builderRoom.count()) {
  await builderRoom.click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT_DIR, "04-official-builder-room.png"), fullPage: false });
}

});
console.log("Saved to", OUT_DIR);

await closeAllBrowsers();
