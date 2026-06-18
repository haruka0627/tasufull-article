#!/usr/bin/env node
import { devices, withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const URL =
  `${BASE}/talk-home.html?tab=notify&talkDev=1&review=chat-demo&demoProfile=skill&userId=u_hiro`;
const NOTIFY_ID = "platform-chat-demo-skill-review-b-001";

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({
  ...devices["iPhone 13"],
  viewport: { width: 390, height: 844 },
  hasTouch: true,
});
await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector(`article[data-talk-notify-id="${NOTIFY_ID}"]`, { timeout: 25000 });
await page.waitForTimeout(800);

const overflow = await page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const offenders = [];
  document.querySelectorAll(".talk-notify-card, .talk-filter-bar, .talk-notify-category-bar, .talk-notify-mobile-chips, .talk-line-category-tabs").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.right > vw + 1 || r.width > vw + 1) {
      offenders.push({
        cls: el.className.split(" ").slice(0, 3).join(" "),
        w: Math.round(r.width),
        right: Math.round(r.right),
      });
    }
  });
  return {
    vw,
    docScrollW: document.documentElement.scrollWidth,
    offenders,
    cardCount: document.querySelectorAll(".talk-notify-card").length,
  };
});
console.log("overflow", JSON.stringify(overflow, null, 2));

let tapNav = false;
page.on("framenavigated", (f) => {
  if (f.url().includes("chat-detail")) tapNav = true;
});

const cta = page.locator(`article[data-talk-notify-id="${NOTIFY_ID}"] [data-talk-notify-action]`).first();
try {
  await cta.tap({ timeout: 10000 });
  await page.waitForTimeout(2000);
  console.log("tap ok navigated:", tapNav, page.url());
} catch (err) {
  console.log("tap failed:", err.message);
  // card tap fallback
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(`article[data-talk-notify-id="${NOTIFY_ID}"]`);
  const card = page.locator(`article[data-talk-notify-id="${NOTIFY_ID}"]`).first();
  try {
    await card.tap({ timeout: 10000 });
    await page.waitForTimeout(2000);
    console.log("card tap navigated:", tapNav, page.url());
  } catch (err2) {
    console.log("card tap failed:", err2.message);
  }
}

});

await closeAllBrowsers();
