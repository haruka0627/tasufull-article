#!/usr/bin/env node
/**
 * TASFUL TALK — 通知詳細ボトムシート（390px）
 *   node scripts/test-talk-notify-detail-mobile.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");

async function main() {
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  const pass = (m) => console.log(`  ✓ ${m}`);
  const fail = (m) => {
    errors.push(m);
    console.log(`  ✗ ${m}`);
  };

  
    await page.goto(`${BASE}/talk-home.html?tab=notify`, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await page.waitForFunction(() => typeof window.TasuTalkNotifyDetail?.open === "function");
    await page.evaluate(() => {
      window.__TASU_TALK_SKIP_ACTION_CONFIRM = true;
    });
    page.on("dialog", (d) => d.accept());
    await page.waitForSelector("[data-talk-notify-list] .talk-notify-card", { timeout: 10000 });

    const listPad = await page.evaluate(() => {
      const list = document.querySelector("[data-talk-notify-list]");
      return parseFloat(getComputedStyle(list).paddingBottom) >= 80;
    });
    if (!listPad) fail("notify list padding-bottom for tab bar");
    else pass("notify list padding-bottom for tab bar");

    const firstCard = page.locator("[data-talk-notify-list] .talk-notify-card").first();
    await firstCard.click();
    await page.waitForTimeout(200);

    const detailOpen = await page.evaluate(() => {
      const sheet = document.querySelector("[data-talk-notify-detail]");
      return sheet && !sheet.hidden && sheet.classList.contains("talk-notify-detail--sheet");
    });
    if (!detailOpen) fail("notify card opens bottom sheet");
    else pass("notify card opens bottom sheet");

    const hasMeta = await page.locator("[data-talk-notify-detail-body] .talk-notify-detail__meta-grid").count();
    if (hasMeta < 1) fail("detail shows meta fields");
    else pass("detail shows meta fields");

    await page.click("button.talk-notify-detail__close");
    await page.waitForTimeout(150);
    if (!(await page.evaluate(() => document.querySelector("[data-talk-notify-detail]")?.hidden)))
      fail("detail closes");
    else pass("detail closes");

    await firstCard.click();
    await page.waitForTimeout(150);
    const markRead = page.locator("[data-talk-notify-detail-action='mark-read']").first();
    if ((await markRead.count()) > 0) {
      await markRead.click();
      await page.waitForTimeout(200);
      const openCount = await page.evaluate(
        () => document.querySelectorAll("[data-talk-notify-detail]:not([hidden])").length
      );
      if (openCount !== 1) fail("detail action does not duplicate sheet");
      else pass("detail action does not duplicate sheet");
      await page.click("button.talk-notify-detail__close");
    } else pass("mark-read N/A (already read)");

    await page.evaluate(() => window.TasuTalkNotifyDetail?.close?.());
    const actionBtn = firstCard.locator("[data-talk-notify-action]").first();
    if ((await actionBtn.count()) > 0) {
      await actionBtn.evaluate((el) => {
        el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });
      await page.waitForTimeout(300);
      const openSheets = await page.evaluate(
        () => document.querySelectorAll("[data-talk-notify-detail]:not([hidden])").length
      );
      if (openSheets > 0) fail("card action opened detail sheet (propagation)");
      else pass("card inline action without opening detail");
    } else pass("card actions N/A");

    const lastVisible = await page.evaluate(async () => {
      const cards = [...document.querySelectorAll("[data-talk-notify-list] .talk-notify-card")];
      if (!cards.length) return true;
      const last = cards[cards.length - 1];
      last.scrollIntoView({ block: "end" });
      await new Promise((r) => setTimeout(r, 150));
      const rect = last.getBoundingClientRect();
      const tab = document.querySelector("[data-talk-mobile-tabbar]");
      const tabTop = tab ? tab.getBoundingClientRect().top : window.innerHeight;
      return rect.bottom <= tabTop + 6;
    });
    if (!lastVisible) fail("last card hidden under tab bar");
    else pass("last card readable above tab bar");

    console.log("\n---");
    if (errors.length) {
      console.error(`FAILED (${errors.length})`);
      errors.forEach((e) => console.error(`  - ${e}`));
      process.exitCode = 1;
    } else {
      console.log("All notify detail mobile checks passed.");
    }
    });
  
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

await closeAllBrowsers();
