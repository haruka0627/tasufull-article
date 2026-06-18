#!/usr/bin/env node
/**
 * Capture TASFUL AI Bottom Sheet screenshots (390px + PC)
 *   node scripts/capture-talk-tasful-ai-sheet.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";

const base = await findDevServerBaseUrl({ probePath: "talk-home.html" });
console.log("Base URL:", base);
const OUT = path.join("reports", "screenshots", "tasful-ai-talk");

async function capture(page, file, label) {
  const target = path.join(OUT, file);
  await page.screenshot({ path: target, fullPage: false });
  console.log(`  saved ${target} (${label})`);
}

const FRIEND_THREAD_ID = "talk-mock-friend-001";

async function openTalkHomeRoom(page) {
  await page.waitForSelector(`[data-talk-select-thread][data-talk-thread-id="${FRIEND_THREAD_ID}"]`, {
    timeout: 15000,
  });
  await page.click(`[data-talk-select-thread][data-talk-thread-id="${FRIEND_THREAD_ID}"]`);
  await page.waitForFunction(
    () => document.querySelector(".talk-line-split")?.classList.contains("talk-line-split--room-open"),
    { timeout: 10000 }
  );
  await page.waitForSelector("[data-talk-tasful-ai-open]", { state: "visible", timeout: 10000 });
}

async function openTalkHomeSheet(page) {
  await page.goto(buildLocalPageUrl(base, "talk-home.html", "?tab=chat&talkDev=1"), {
    waitUntil: "domcontentloaded",
    timeout: 20000,
  });
  await page.waitForSelector(".talk-line-list__item", { timeout: 15000 });
  await openTalkHomeRoom(page);
  await page.click("[data-talk-tasful-ai-open]");
  await page.waitForSelector("[data-talk-tasful-ai-sheet]:not([hidden])", { timeout: 5000 });
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  try {
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await openTalkHomeSheet(mobile);
    await capture(mobile, "talk-home-tasful-ai-sheet-390.png", "talk-home 390px sheet open");
    await mobile.close();

    const pc = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await openTalkHomeSheet(pc);
    await capture(pc, "talk-home-tasful-ai-sheet-pc.png", "talk-home PC sheet open");
    await pc.close();

    const chatMobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await chatMobile.goto(
      buildLocalPageUrl(
        base,
        "chat-detail.html",
        "?thread=chat-demo-skill-deal-001&userId=u_me&talkDev=1&review=chat-demo"
      ),
      { waitUntil: "domcontentloaded", timeout: 30000 }
    );
    await chatMobile.waitForSelector("#chatAiBtn", { timeout: 45000 });
    await chatMobile.click("#chatAiBtn");
    await chatMobile.waitForSelector("[data-talk-tasful-ai-sheet]:not([hidden])", { timeout: 5000 });
    await capture(chatMobile, "chat-detail-tasful-ai-sheet-390.png", "chat-detail 390px sheet open");
    await chatMobile.close();

    console.log("\nScreenshots ready in reports/screenshots/tasful-ai-talk/");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
