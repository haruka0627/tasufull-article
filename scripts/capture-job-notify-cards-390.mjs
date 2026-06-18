#!/usr/bin/env node
/**
 * 求人カテゴリ通知カード（応募 / 採用 / 一覧2件）390px スクショ
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer, devUrl } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT = path.join("screenshots", "platform-job-notify-cards");
const APPLY_NOTIFY_ID = "platform-verify-job-full-apply-001";
const HIRED_NOTIFY_ID = "platform-verify-job-full-applicant-start-001";

fs.mkdirSync(OUT, { recursive: true });

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

async function waitNotifyReady() {
  await page.waitForFunction(
    () =>
      window.TasuTalkJobReviewMode?.isJobReviewMode?.() &&
      (window.TasuTalkData?.getNotifications?.({ filter: "all", applySettings: false }) || []).length === 2,
    { timeout: 45000 }
  );
  await page.waitForSelector(`article[data-talk-notify-id="${APPLY_NOTIFY_ID}"] .talk-notify-card__job-head`, {
    timeout: 15000,
  });
  await page.waitForSelector(`article[data-talk-notify-id="${HIRED_NOTIFY_ID}"] .talk-notify-card__job-title`, {
    timeout: 15000,
  });
  await page.waitForTimeout(600);
}

async function screenshotCard(notifyId, filename) {
  const card = page.locator(`article[data-talk-notify-id="${notifyId}"]`);
  await card.waitFor({ timeout: 15000 });
  await card.screenshot({ path: path.join(OUT, filename) });
}

await page.goto(devUrl("talk-home.html?tab=notify&review=job&talkDev=1"), {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await waitNotifyReady();

await screenshotCard(APPLY_NOTIFY_ID, "01-apply-notify-390.png");
await screenshotCard(HIRED_NOTIFY_ID, "02-hired-notify-390.png");
await page.screenshot({ path: path.join(OUT, "03-notify-list-both-390.png") });

const audit = await page.evaluate(
  ({ applyId, hiredId }) => {
    function readCard(id) {
      const card = document.querySelector(`article[data-talk-notify-id="${id}"]`);
      if (!card) return null;
      return {
        categoryChip: card.querySelector(".talk-notify-card__job-head .talk-notify-card__category-chip")?.textContent?.trim(),
        jobTitle: card.querySelector(".talk-notify-card__job-title")?.textContent?.trim(),
        eventTitle: card.querySelector(".talk-notify-card__title--job-event")?.textContent?.trim(),
        supplement: card.querySelector(".talk-notify-card__job-supplement")?.textContent?.trim(),
        time: card.querySelector(".talk-notify-card__job-time")?.textContent?.trim(),
        action: card.querySelector(".talk-notify-card__minimal-action")?.textContent?.trim(),
      };
    }
    return {
      apply: readCard(applyId),
      hired: readCard(hiredId),
      cardCount: document.querySelectorAll("article[data-talk-notify-id]").length,
    };
  },
  { applyId: APPLY_NOTIFY_ID, hiredId: HIRED_NOTIFY_ID }
);

});

console.log(JSON.stringify({ outDir: OUT, audit }, null, 2));

await closeAllBrowsers();
