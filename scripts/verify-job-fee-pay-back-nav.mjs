#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

await page.goto(`${BASE}/talk-home.html?tab=notify&userId=u_job_demo_full&talkDev=1`, {
  waitUntil: "domcontentloaded",
});
await page.waitForTimeout(800);

await page.evaluate(() => {
  const panel =
    document.querySelector("[data-talk-scroll-panel='notify']") ||
    document.querySelector(".talk-panel[data-talk-tab='notify']") ||
    document.querySelector(".talk-notify-list");
  if (panel) panel.scrollTop = 320;
});

const notifyCard = page.locator("[data-talk-notify-id]").first();
await notifyCard.click();
await page.waitForURL(/detail-job|platform-chat-fee-pay/, { timeout: 15000 });

if (!page.url().includes("platform-chat-fee-pay")) {
  await page.waitForFunction(() => document.body.dataset.listingLoaded === "true", { timeout: 45000 });
  await page.evaluate(() => document.querySelector("[data-job-app-proceed]")?.click());
  await page.waitForURL(/platform-chat-fee-pay/, { timeout: 15000 });
}

const payAudit = await page.evaluate(() => ({
  url: location.href,
  from: new URLSearchParams(location.search).get("from"),
  backText: document.querySelector("[data-platform-fee-back-link]")?.textContent?.trim(),
  restoreFlag: sessionStorage.getItem("talkRestoreOnLoad"),
  scrollSaved: sessionStorage.getItem("talkScrollPosition"),
}));

await page.click("[data-platform-fee-back-link]");
await page.waitForTimeout(700);

const afterFirstBack = await page.evaluate(() => ({
  url: location.href,
  restoreFlag: sessionStorage.getItem("talkRestoreOnLoad"),
}));

if (afterFirstBack.url.includes("detail-job")) {
  await page.goBack();
  await page.waitForTimeout(2600);
} else {
  await page.waitForTimeout(2600);
}

const afterBack = await page.evaluate(() => {
  const panel =
    document.querySelector("[data-talk-scroll-panel='notify']") ||
    document.querySelector(".talk-panel[data-talk-tab='notify']") ||
    document.querySelector(".talk-notify-list");
  return {
    url: location.href,
    scroll: panel?.scrollTop || 0,
    restoreFlag: sessionStorage.getItem("talkRestoreOnLoad"),
  };
});

console.log(JSON.stringify({ payAudit, afterFirstBack, afterBack }, null, 2));
});

await closeAllBrowsers();
