#!/usr/bin/env node
/**
 * 通知一覧スクロール・並び順安定性（390px）
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { mkdirSync } from "fs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT_DIR = "screenshots/notify-scroll-stability";
const NOTIFY_ID = "builder-ops-route-005";
mkdirSync(OUT_DIR, { recursive: true });

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

const panelSel = '[data-talk-panel="notify"], .talk-home-main, html';

await page.goto(`${BASE}/talk-home.html?tab=notify`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForSelector(`[data-talk-notify-id="${NOTIFY_ID}"]`, { timeout: 25000 });
await page.waitForTimeout(800);

await page.evaluate((id) => {
  const card = document.querySelector(`[data-talk-notify-id="${id}"]`);
  card?.scrollIntoView({ block: "center" });
  const roots = [
    document.querySelector('[data-talk-panel="notify"]'),
    document.querySelector(".talk-home-main"),
    document.querySelector(".dash-content"),
    document.scrollingElement,
  ].filter(Boolean);
  for (const root of roots) {
    if (root.scrollHeight > root.clientHeight + 2) {
      const panelRect = root.getBoundingClientRect();
      const cardRect = card?.getBoundingClientRect();
      if (card && cardRect) {
        root.scrollTop = Math.max(
          0,
          Math.round(root.scrollTop + (cardRect.top - panelRect.top) - 100)
        );
      }
      break;
    }
  }
}, NOTIFY_ID);
await page.waitForTimeout(500);

const before = await page.evaluate(() => {
  const panel =
    document.querySelector('[data-talk-panel="notify"]') ||
    document.querySelector(".talk-home-main") ||
    document.scrollingElement;
  const ids = [...new Set([...document.querySelectorAll("[data-talk-notify-id]")].map(
    (el) => el.getAttribute("data-talk-notify-id")
  ))];
  return { scroll: panel?.scrollTop || 0, ids: ids.slice(0, 8) };
});
await page.screenshot({ path: `${OUT_DIR}/01-before-open-390.png`, fullPage: true });
console.log("before scroll:", before.scroll, "top ids:", before.ids.join(", "));

await page.evaluate((id) => {
  const card = document.querySelector(`[data-talk-notify-id="${id}"]`);
  const action = card?.querySelector("[data-talk-notify-action]");
  if (action) action.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  else card?.click();
}, NOTIFY_ID);
await page.waitForURL(/mvp-thread\.html/, { timeout: 20000 });
await page.waitForTimeout(600);

await page.evaluate(() => window.TasufulAppMobile?.goBackToTalk?.());
await page.waitForURL(/talk-home\.html/, { timeout: 20000 });
await page.waitForTimeout(2800);

const after = await page.evaluate((notifyId) => {
  const panel =
    document.querySelector('[data-talk-panel="notify"]') ||
    document.querySelector(".talk-home-main") ||
    document.scrollingElement;
  const ids = [...new Set([...document.querySelectorAll("[data-talk-notify-id]")].map(
    (el) => el.getAttribute("data-talk-notify-id")
  ))];
  const target = document.querySelector(`[data-talk-notify-id="${notifyId}"]`);
  return {
    scroll: panel?.scrollTop || 0,
    ids: ids.slice(0, 8),
    cardFound: Boolean(target),
    cardRead: target?.classList.contains("talk-notify-card--unread") === false,
  };
}, NOTIFY_ID);
await page.screenshot({ path: `${OUT_DIR}/02-after-return-390.png`, fullPage: true });

const orderOk = before.ids.join("|") === after.ids.join("|");
const scrollOk = Math.abs(after.scroll - before.scroll) <= 24;
const readOk = after.cardFound && after.cardRead;

console.log("after scroll:", after.scroll, "top ids:", after.ids.join(", "));
console.log(`order: ${orderOk ? "OK" : "NG"} scroll: ${scrollOk ? "OK" : "NG"} (${before.scroll}→${after.scroll}) read kept: ${readOk ? "OK" : "NG"}`);

});
await closeAllBrowsers();
process.exit(orderOk && scrollOk && readOk ? 0 : 1);
