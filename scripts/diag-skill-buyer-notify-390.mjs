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

const audit = await page.evaluate((id) => {
  const card = document.querySelector(`article[data-talk-notify-id="${id}"]`);
  const cta = card?.querySelector("[data-talk-notify-action]");
  const ctaCS = cta ? getComputedStyle(cta) : null;
  const row = (window.TasuTalkNotifications?.getAll?.() || []).find((n) => n.id === id);
  const nav = window.TasuTalkNotifyActions?.buildNotifyNavigateAction?.(row);
  const list = document.querySelector(".talk-notify-list");
  const filterBar = document.querySelector("[data-talk-notify-filter-bar]");
  const catBar = document.querySelector(".talk-notify-category-bar");
  const rects = (sel) => {
    const el = document.querySelector(sel);
    const r = el?.getBoundingClientRect();
    return r ? { w: Math.round(r.width), right: Math.round(r.right) } : null;
  };
  return {
    found: Boolean(card),
    role: card?.getAttribute("role"),
    ctaHref: cta?.getAttribute("href") || "",
    ctaAction: cta?.getAttribute("data-talk-notify-action") || "",
    ctaPointer: ctaCS?.pointerEvents || "",
    navHref: nav?.href || "",
    rowHref: row?.href || "",
    isMaster: window.TasuTalkNotifyActions?.isPlatformMasterNotification?.(row),
    isTalkMaster: window.TasuTalkNotifyActions?.isTalkMasterNotification?.(row),
    docScrollW: document.documentElement.scrollWidth,
    vw: document.documentElement.clientWidth,
    bodyOverflowX: getComputedStyle(document.body).overflowX,
    list: rects(".talk-notify-list"),
    card: rects(`article[data-talk-notify-id="${id}"]`),
    filterBar: rects("[data-talk-notify-filter-bar]"),
    catBar: rects(".talk-notify-category-bar"),
    title:
      card?.querySelector(".talk-notify-card__title--job-event")?.textContent?.trim() ||
      card?.querySelector(".talk-notify-card__title")?.textContent?.trim() ||
      "",
    ctaLabel: cta?.textContent?.trim() || "",
  };
}, NOTIFY_ID);

console.log(JSON.stringify(audit, null, 2));

let navigated = false;
page.on("framenavigated", (f) => {
  if (f.url().includes("chat-detail")) navigated = true;
});

const before = page.url();
await page.evaluate((id) => {
  const cta = document.querySelector(`article[data-talk-notify-id="${id}"] [data-talk-notify-action]`);
  cta?.click();
}, NOTIFY_ID);
await page.waitForTimeout(1500);
console.log("click navigated:", navigated, "url:", page.url());
if (!navigated) {
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(`article[data-talk-notify-id="${NOTIFY_ID}"]`);
  const href = await page.evaluate((id) => {
    return (
      document
        .querySelector(`article[data-talk-notify-id="${id}"] [data-talk-notify-action]`)
        ?.getAttribute("href") || ""
    );
  }, NOTIFY_ID);
  await page.goto(new URL(href, BASE).href, { waitUntil: "domcontentloaded" });
  console.log("direct href:", page.url());
}

});

await closeAllBrowsers();
