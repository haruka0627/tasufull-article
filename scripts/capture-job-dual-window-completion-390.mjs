#!/usr/bin/env node
/**
 * 求人 2窓 — 掲載者申請 → 応募者承認（390px スクショ）
 * 同一 BrowserContext = 同一 localStorage（2窓同期を再現）
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer, logScreenshotUrl } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT = path.join("screenshots", "platform-job-dual-window-completion");
const THREAD = "chat-demo-job-full-001";
const POSTER = "u_job_demo_full";
const APPLICANT = "u_hiro";
const REVIEW = "job-full";
const VIEWPORT = { width: 390, height: 844 };

const qs = (pathname, params) => {
  const u = new URL(pathname, BASE);
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== "") u.searchParams.set(k, String(v));
  });
  return u.pathname + u.search;
};

const URLS = {
  posterReset: qs("/chat-detail.html", {
    thread: THREAD,
    userId: POSTER,
    talkDev: 1,
    review: REVIEW,
    jobFullReset: 1,
  }),
  posterChat: qs("/chat-detail.html", { thread: THREAD, userId: POSTER, talkDev: 1, review: REVIEW }),
  posterNotify: qs("/talk-home.html", { tab: "notify", userId: POSTER, talkDev: 1, review: REVIEW }),
  applicantNotify: qs("/talk-home.html", { tab: "notify", userId: APPLICANT, talkDev: 1, review: REVIEW }),
  applicantChat: qs("/chat-detail.html", { thread: THREAD, userId: APPLICANT, talkDev: 1, review: REVIEW }),
  launcher: qs("/job-dual-window-completion.html", { talkDev: 1, review: REVIEW }),
};

fs.mkdirSync(path.join(OUT, "poster"), { recursive: true });
fs.mkdirSync(path.join(OUT, "applicant"), { recursive: true });

Object.entries(URLS).forEach(([k, v]) => logScreenshotUrl(`dual-${k}`, v.replace(/^\//, "")));

await withPlaywrightBrowser(async (browser) => {const context = await browser.newContext({ viewport: VIEWPORT });
const poster = await context.newPage();
const applicant = await context.newPage();

async function waitChatReady(page) {
  await page.waitForFunction(() => document.body.dataset.chatDetailReady === "true", null, {
    timeout: 20000,
  });
  await page.waitForTimeout(350);
}

async function waitNotifyReady(page) {
  await page.waitForSelector("[data-talk-notify-list], .talk-notify-list, #talkNotifyList", {
    timeout: 20000,
  });
  await page.waitForTimeout(500);
}

function shot(page, subdir, name) {
  return page.screenshot({ path: path.join(OUT, subdir, name) });
}


  await poster.goto(`${BASE}${URLS.posterReset}`, { waitUntil: "domcontentloaded" });
  await waitChatReady(poster);
  await shot(poster, "poster", "01-chat-active-390.png");

  await applicant.goto(`${BASE}${URLS.applicantNotify}`, { waitUntil: "domcontentloaded" });
  await waitNotifyReady(applicant);
  await shot(applicant, "applicant", "01-notify-before-390.png");

  await poster.bringToFront();
  await poster.locator("#chatCompleteBtn").click();
  await poster.waitForSelector("#chatCompleteModal:not([hidden])", { timeout: 5000 });
  await shot(poster, "poster", "02-complete-modal-390.png");
  await poster.locator("#chatCompleteSubmit").click();
  await poster.waitForTimeout(500);
  await shot(poster, "poster", "03-pending-request-390.png");

  await applicant.reload({ waitUntil: "domcontentloaded" });
  await waitNotifyReady(applicant);
  const requestNotify = applicant.locator(
    'article[data-talk-notify-id="platform-verify-job-full-complete-request-001"]'
  );
  await requestNotify.first().waitFor({ timeout: 10000 });
  await shot(applicant, "applicant", "02-notify-request-390.png");

  await Promise.all([
    applicant.waitForURL(/chat-detail\.html/, { timeout: 15000 }),
    requestNotify.first().locator("[data-talk-notify-action='navigate']").click(),
  ]);
  await waitChatReady(applicant);
  await applicant.locator("#chatApproveCompleteBtn").waitFor({ state: "visible", timeout: 10000 });
  await shot(applicant, "applicant", "03-chat-approve-390.png");

  await applicant.locator("#chatApproveCompleteBtn").click();
  await applicant.waitForTimeout(600);
  await applicant.locator("[data-platform-job-review-prompt]").waitFor({ state: "visible", timeout: 10000 });
  if (await applicant.locator("#chatPostCompleteBar").isVisible()) {
    throw new Error("applicant: bottom review bar should be hidden for job chat");
  }
  await applicant.locator("[data-platform-job-review-prompt]").scrollIntoViewIfNeeded();
  await shot(applicant, "applicant", "04-chat-completed-390.png");

  await applicant.locator("[data-platform-job-review-open]").click();
  await applicant.waitForSelector("#chatReviewModal:not([hidden])", { timeout: 5000 });
  await shot(applicant, "applicant", "05-review-modal-390.png");
  await applicant.locator("#chatReviewModal").evaluate((el) => { el.hidden = true; });

  await poster.goto(`${BASE}${URLS.posterChat}`, { waitUntil: "domcontentloaded" });
  await waitChatReady(poster);
  await poster.locator("[data-platform-job-review-prompt]").waitFor({ state: "visible", timeout: 10000 });
  if (await poster.locator("#chatPostCompleteBar").isVisible()) {
    throw new Error("poster: bottom review bar should be hidden for job chat");
  }
  await poster.locator("[data-platform-job-review-prompt]").scrollIntoViewIfNeeded();
  await shot(poster, "poster", "04-chat-completed-390.png");

  await poster.goto(`${BASE}${URLS.posterNotify}`, { waitUntil: "domcontentloaded" });
  await waitNotifyReady(poster);
  const completeNotify = poster.locator(
    'article[data-talk-notify-id="platform-verify-job-full-complete-001"]'
  );
  await completeNotify.first().waitFor({ timeout: 10000 });
  await shot(poster, "poster", "05-notify-complete-390.png");

  await poster.goto(`${BASE}${URLS.posterChat}`, { waitUntil: "domcontentloaded" });
  await waitChatReady(poster);
  await poster.locator("[data-platform-job-review-open]").click();
  await poster.waitForSelector("#chatReviewModal:not([hidden])", { timeout: 5000 });
  const reviewTitle = await poster.locator("#chatReviewTitle").textContent();
  await shot(poster, "poster", "06-review-modal-390.png");

  console.log(`[capture] review modal title (poster): ${reviewTitle?.trim()}`);
  console.log(`[capture] OK → ${OUT}`);
});

await closeAllBrowsers();
