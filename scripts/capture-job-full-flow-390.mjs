#!/usr/bin/env node
/**
 * 求人 end-to-end 通知デモ — 390px スクショ16枚
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer, logScreenshotUrl } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT = path.join("screenshots", "platform-job-full-flow");
const THREAD = "chat-demo-job-full-001";
const LISTING = "job_demo_full_001";
const APP_ID = "job-app-demo-full-001";
const POSTER = "u_job_demo_full";
const APPLICANT = "u_hiro";

const NOTIFY = {
  apply: "platform-verify-job-full-apply-001",
  posterStart: "platform-verify-job-full-poster-start-001",
  applicantStart: "platform-verify-job-full-applicant-start-001",
  complete: "platform-verify-job-full-complete-001",
  review: "platform-verify-job-full-review-001",
};

fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) {
  if (f.endsWith(".png")) fs.unlinkSync(path.join(OUT, f));
}

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

await page.goto(`${BASE}/talk-home.html?talkDev=1&jobFullFresh=1`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(
  () => {
    const apps = window.TasuJobApplicationsStore?.readAll?.() || [];
    return !apps.some(
      (a) => a.job_id === "job_demo_full_001" && a.applicant_id === "u_hiro"
    );
  },
  { timeout: 15000 }
);

async function shot(name, url, waitFn) {
  logScreenshotUrl(name, url.replace(BASE, ""));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  if (waitFn) await waitFn();
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, name) });
}

await shot(
  "01-job-detail-390.png",
  `${BASE}/detail-job.html?id=${LISTING}&userId=${APPLICANT}&talkDev=1&jobFullFresh=1`,
  () =>
    page.waitForSelector("[data-listing-primary-cta]:not(.is-applied)", {
      state: "attached",
      timeout: 15000,
    })
);

await page.evaluate(() => {
  const btn =
    document.querySelector("[data-job-dock-apply]:not(.is-applied)") ||
    document.querySelector("[data-listing-primary-cta]:not(.is-applied)");
  btn?.click();
});
await page.waitForTimeout(900);
await page.screenshot({ path: path.join(OUT, "02-apply-complete-390.png") });

await page.goto(`${BASE}/talk-home.html?review=job-full&talkDev=1&jobFullReset=1`, {
  waitUntil: "domcontentloaded",
});
await page.waitForTimeout(1000);

await shot(
  "03-apply-notify-390.png",
  `${BASE}/talk-home.html?tab=notify&review=job-full&userId=${POSTER}&talkDev=1`,
  () => page.waitForSelector(`article[data-talk-notify-id="${NOTIFY.apply}"]`, { timeout: 15000 })
);

await shot(
  "04-applications-390.png",
  `${BASE}/detail-job.html?id=${LISTING}&userId=${POSTER}&talkDev=1&review=job-full&view=applications&from=talk#applications`,
  async () => {
    await page.waitForFunction(() => document.body.dataset.listingLoaded === "true", { timeout: 45000 });
    await page.waitForSelector("[data-job-applications-list] [data-job-app-card]", { timeout: 15000 });
    await page.waitForFunction(
      () => (document.querySelectorAll("[data-job-app-card]").length || 0) >= 3,
      { timeout: 10000 }
    );
  }
);

await page.evaluate(() => {
  const list = document.querySelector("[data-job-applications-list]");
  if (list) list.scrollTop = list.scrollHeight;
});
await page.waitForTimeout(350);
await page.screenshot({ path: path.join(OUT, "04-applications-scrolled-390.png") });

const payUrl = `${BASE}/platform-chat-fee-pay.html?thread=${THREAD}&listingId=${LISTING}&category=job&applicationId=${APP_ID}&userId=${POSTER}&talkDev=1&review=job-full`;
await shot("05-fee-pay-550-390.png", payUrl, () =>
  page.waitForSelector("[data-platform-fee-pay]", { timeout: 15000 })
);

await page.locator("[data-platform-fee-pay]").click();
await page.waitForURL(/chat-detail\.html|platform-chat-fee-pay/, { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(900);
await page.screenshot({ path: path.join(OUT, "06-fee-pay-complete-390.png") });

await shot(
  "07-chat-after-pay-390.png",
  `${BASE}/chat-detail.html?thread=${THREAD}&userId=${POSTER}&talkDev=1&review=job-full`,
  () =>
    page.waitForFunction(
      () => document.querySelector("[data-platform-job-hired-card]"),
      { timeout: 15000 }
    )
);

await shot(
  "08-chat-start-notify-390.png",
  `${BASE}/talk-home.html?tab=notify&review=job-full&userId=${APPLICANT}&talkDev=1`,
  () => page.waitForSelector(`article[data-talk-notify-id="${NOTIFY.applicantStart}"]`, { timeout: 15000 })
);

const notifyCard = page.locator(`article[data-talk-notify-id="${NOTIFY.applicantStart}"]`);
await notifyCard.locator("[data-talk-notify-action='navigate']").click();
await page.waitForURL(/chat-detail\.html/, { timeout: 20000 });
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(OUT, "09-notify-to-chat-390.png") });

await page.waitForFunction(
  () => document.querySelector("[data-platform-job-hired-card]"),
  { timeout: 15000 }
);
await page.screenshot({ path: path.join(OUT, "10-chat-start-card-390.png") });

await page.fill("#chatInput", "了解しました。よろしくお願いします。");
await page.click("#chatSend");
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(OUT, "11-message-sent-390.png") });

await page.evaluate(() => {
  window.TasuPlatformChatJobFlow?.appendJobCompletionCard?.(
    "chat-demo-job-full-001",
    window.TasuChatThreadStore?.readAll?.().find((t) => t.id === "chat-demo-job-full-001")
  );
  const room = window.TasuChatThreadStore?.readAll?.().find((t) => t.id === "chat-demo-job-full-001");
  window.TasuTalkPlatformNotify?.notifyJobConversationCompleted?.({ thread: room, roomId: room?.id, listing: { id: room?.listingId } });
});
await shot(
  "12-complete-notify-390.png",
  `${BASE}/talk-home.html?tab=notify&review=job-full&userId=${APPLICANT}&talkDev=1`,
  () => page.waitForSelector(`article[data-talk-notify-id="${NOTIFY.complete}"]`, { timeout: 15000 })
);

await shot(
  "13-completion-landing-390.png",
  `${BASE}/job-completion.html?thread=${THREAD}&userId=${APPLICANT}&talkDev=1&review=job-full`,
  () => page.waitForSelector("#jobCompletionReviewBtn", { timeout: 15000 })
);

await shot(
  "14-completion-card-390.png",
  `${BASE}/chat-detail.html?thread=${THREAD}&userId=${APPLICANT}&talkDev=1&review=job-full`,
  () =>
    page.waitForFunction(
      () => document.querySelector("[data-platform-job-completion-card]"),
      { timeout: 15000 }
    )
);

await shot(
  "15-review-page-390.png",
  `${BASE}/job-review.html?thread=${THREAD}&userId=${APPLICANT}&talkDev=1&review=job-full`,
  () => page.waitForSelector("#jobReviewStars", { timeout: 15000 })
);

await page.locator(".chat-review-star[data-star='5']").click();
await page.fill("#jobReviewComment", "丁寧なやりとりで助かりました。");
await page.click("#jobReviewSubmit");
await page.waitForSelector("#jobReviewDonePanel:not([hidden])", { timeout: 15000 });
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(OUT, "16-review-submitted-390.png") });

await shot(
  "17-flow-ended-390.png",
  `${BASE}/talk-home.html?tab=chat&thread=official_tasful&userId=${APPLICANT}&talkDev=1&review=job-full`,
  () => page.waitForSelector("body.talk-job-full-review-mode", { timeout: 15000 })
);

const audit = await page.evaluate(() => ({
  notifyCount: (window.TasuTalkJobFullReviewMode?.getJobFullReviewMasterRows?.() || []).length,
  reviewMode: window.TasuTalkJobFullReviewMode?.isJobFullReviewMode?.(),
}));

});

console.log(
  JSON.stringify(
    {
      ok: true,
      base: BASE,
      out: OUT,
      audit,
      files: fs.readdirSync(OUT).filter((f) => f.endsWith(".png")).sort(),
    },
    null,
    2
  )
);

await closeAllBrowsers();
