#!/usr/bin/env node
/**
 * 通知タブ — 390px 下部余白・空状態
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const browser = await chromium.launch({ headless: true });
const issues = [];

async function measure(label, url, afterLoad) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("[data-talk-notify-list]", { timeout: 20000 });
  if (afterLoad) await afterLoad(page);
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    const list = document.querySelector("[data-talk-notify-list]");
    if (list) list.scrollTop = list.scrollHeight;
  });
  await page.waitForTimeout(300);
  const m = await page.evaluate(() => {
    const cards = [...document.querySelectorAll(".talk-notify-list article.talk-notify-card")];
    const last = cards[cards.length - 1];
    const tab = document.querySelector("[data-talk-mobile-tabbar]");
    const list = document.querySelector("[data-talk-notify-list]");
    const empty = document.querySelector(".talk-notify-empty-state__title");
    const tabTop = tab?.getBoundingClientRect().top ?? window.innerHeight;
    const lastBottom = last?.getBoundingClientRect().bottom ?? 0;
    const listRect = list?.getBoundingClientRect();
    const panel = document.querySelector('[data-talk-panel="notify"]');
    return {
      cards: cards.length,
      gap: last ? Math.round(tabTop - lastBottom) : null,
      empty: empty?.textContent?.trim() || null,
      listH: listRect ? Math.round(listRect.height) : 0,
      listBottom: listRect ? Math.round(listRect.bottom) : 0,
      tabTop: Math.round(tabTop),
      offsetTop: panel
        ? getComputedStyle(panel).getPropertyValue("--talk-notify-list-offset-top").trim()
        : "",
      scrollH: list?.scrollHeight ?? 0,
      clientH: list?.clientHeight ?? 0,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  });
  await page.close();
  console.log(`[${label}]`, m);
  return m;
}

try {
  const empty = await measure("empty", `${BASE}/talk-home.html?tab=notify&talkDev=1`, async (page) => {
    await page.waitForFunction(() => window.TasuTalkData?.getNotifications);
    await page.evaluate(() => {
      window.TasuTalkData.getNotifications = () => [];
      window.TasuTalkData.getUnreadCount = () => 0;
      const input = document.querySelector("[data-talk-notify-search]");
      if (input) input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  });
  if (empty.empty !== "通知はありません") {
    issues.push(`empty: title=${empty.empty} (expected 通知はありません)`);
  }

  const few = await measure(
    "job-full",
    `${BASE}/talk-home.html?tab=notify&userId=u_hiro&talkDev=1&review=job-full`
  );
  if (few.gap == null || few.gap < 12 || few.gap > 40) {
    issues.push(`job-full: gap=${few.gap}px (expected 12-40px)`);
  }
  if (few.overflow) issues.push("job-full: horizontal overflow");

  const many = await measure("many", `${BASE}/talk-home.html?tab=notify&talkDev=1`);
  if (many.cards < 10) issues.push(`many: only ${many.cards} cards`);
  if (many.gap == null || many.gap < 12 || many.gap > 40) {
    issues.push(`many: gap=${many.gap}px (expected 12-40px)`);
  }
  if (!many.clientH || many.scrollH <= many.clientH + 2) {
    issues.push("many: list should scroll");
  }

  if (issues.length) {
    console.error("verify-talk-notify-list-spacing-390 FAILED:\n" + issues.join("\n"));
    process.exit(1);
  }
  console.log("verify-talk-notify-list-spacing-390 OK");
} finally {
  await browser.close();
}
