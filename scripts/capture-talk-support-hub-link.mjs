#!/usr/bin/env node
/**
 * 利用者TALK — サポートルーム導線スクリーンショット
 *   node scripts/capture-talk-support-hub-link.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";

const base = await findDevServerBaseUrl({ probePath: "talk-home.html" });
console.log("Base URL:", base);
const OUT = path.join("reports", "screenshots", "talk-support-room");
fs.mkdirSync(OUT, { recursive: true });

async function capture(page, file, label) {
  const target = path.join(OUT, file);
  await page.screenshot({ path: target, fullPage: false });
  console.log(`  saved ${target} (${label})`);
}

const talkChatUrl = buildLocalPageUrl(base, "talk-home.html", "?tab=chat&talkDev=1");
const SUPPORT_ID = "talk-hub-support";

async function openSupportRoom(page) {
  await page.waitForSelector(`[data-talk-thread-id="${SUPPORT_ID}"]`, { timeout: 15000 });
  await page.click(`[data-talk-select-thread][data-talk-thread-id="${SUPPORT_ID}"]`);
  await page.waitForFunction(
    () => {
      const active = document.querySelector("[data-talk-line-room-active]");
      const btn = document.querySelector("[data-talk-support-new-inquiry]");
      return active && !active.hidden && Boolean(btn);
    },
    { timeout: 10000 }
  );
}

async function main() {
  await withPlaywrightBrowser(async (browser) => {
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await mobile.goto(talkChatUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    await mobile.waitForSelector(`[data-talk-thread-id="${SUPPORT_ID}"]`, { timeout: 15000 });
    await capture(mobile, "talk-home-support-list-390.png", "talk-home 390px list");
    await openSupportRoom(mobile);
    await capture(mobile, "support-room-390.png", "support room 390px");
    await mobile.click("[data-talk-support-new-inquiry]");
    await mobile.waitForURL(/support-intake\.html/, { timeout: 15000 });
    await mobile.waitForTimeout(300);
    await capture(mobile, "support-intake-from-room-390.png", "support-intake 390px from button");
    await mobile.close();

    const pc = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await pc.goto(talkChatUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    await pc.waitForSelector(`[data-talk-thread-id="${SUPPORT_ID}"]`, { timeout: 15000 });
    await capture(pc, "talk-home-support-list-pc.png", "talk-home PC list");
    await openSupportRoom(pc);
    await capture(pc, "support-room-pc.png", "support room PC");
    await pc.click("[data-talk-support-new-inquiry]");
    await pc.waitForURL(/support-intake\.html/, { timeout: 15000 });
    await pc.waitForTimeout(300);
    await capture(pc, "support-intake-from-room-pc.png", "support-intake PC from button");
    await pc.close();

    console.log(`\nScreenshots ready in ${OUT}/`);
    });
  
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

await closeAllBrowsers();
