#!/usr/bin/env node
/**
 * 求人 2窓完了フロー — 掲載者申請 → 応募者承認（自動検証）
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const THREAD = "chat-demo-job-full-001";
const POSTER = "u_job_demo_full";
const APPLICANT = "u_hiro";
const REVIEW_CARD_TITLE = "✓ やりとりが完了しました";
const REVIEW_CARD_BODY = "評価は1分ほどで完了します。最後に今回のやりとりを評価してください。";
const REVIEW_DONE_LABEL = "✓ 評価済み";
const INTERNAL_ID_PATTERN = /u_job_demo_full|chat-demo-job-full-001|job_demo_full_001/;

function collectVisibleText(page) {
  return page.evaluate(() => document.body?.innerText || "");
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const poster = await context.newPage();
const applicant = await context.newPage();
const issues = [];

try {
  await poster.goto(
    `${BASE}/chat-detail.html?thread=${THREAD}&userId=${POSTER}&talkDev=1&review=job-full&jobFullReset=1`,
    { waitUntil: "domcontentloaded" }
  );
  await poster.waitForFunction(() => document.body.dataset.chatDetailReady === "true");

  await applicant.goto(
    `${BASE}/talk-home.html?tab=notify&userId=${APPLICANT}&talkDev=1&review=job-full`,
    { waitUntil: "domcontentloaded" }
  );
  await applicant.waitForTimeout(800);

  if (!(await poster.locator("#chatCompleteBtn").isEnabled())) {
    issues.push("poster: やりとり完了ボタンが押せません");
  }

  await poster.locator("#chatCompleteBtn").click();
  await poster.locator("#chatCompleteSubmit").click();
  await poster.waitForTimeout(400);

  const posterRequestText = await poster.locator(".chat-system-msg__text").last().textContent();
  if (INTERNAL_ID_PATTERN.test(String(posterRequestText || ""))) {
    issues.push(`poster: 完了申請メッセージに内部IDが含まれています (${posterRequestText})`);
  }
  if (!String(posterRequestText || "").includes("タスク確認株式会社がやりとり完了を申請しました")) {
    issues.push(`poster: 完了申請メッセージ=${posterRequestText}`);
  }

  const posterPending = await poster.evaluate((id) => {
    const row = window.TasuChatThreadStore.readAll().find((t) => t.id === id);
    return row?.roomStatus;
  }, THREAD);
  if (posterPending !== "completion_pending") {
    issues.push(`poster: roomStatus=${posterPending} (expected completion_pending)`);
  }

  await applicant.reload({ waitUntil: "domcontentloaded" });
  await applicant.waitForTimeout(800);
  const requestCount = await applicant.locator(
    'article[data-talk-notify-id="platform-verify-job-full-complete-request-001"]'
  ).count();
  if (requestCount < 1) issues.push("applicant: 完了申請通知がありません");
  const requestNotifyText = await collectVisibleText(applicant);
  if (INTERNAL_ID_PATTERN.test(requestNotifyText)) {
    issues.push("applicant: 完了申請通知に内部IDが含まれています");
  }

  await applicant.goto(
    `${BASE}/chat-detail.html?thread=${THREAD}&userId=${APPLICANT}&talkDev=1&review=job-full`,
    { waitUntil: "domcontentloaded" }
  );
  await applicant.waitForFunction(() => document.body.dataset.chatDetailReady === "true");

  if (!(await applicant.locator("#chatApproveCompleteBtn").isVisible())) {
    issues.push("applicant: 承認ボタンが表示されません");
  }

  await applicant.locator("#chatApproveCompleteBtn").click();
  await applicant.waitForTimeout(500);

  if (await applicant.locator("#chatPostCompleteBar").isVisible()) {
    issues.push("applicant: 下部レビューバーが表示されています（非表示であるべき）");
  }
  const applicantReviewPrompt = applicant.locator("[data-platform-job-review-prompt]");
  if (!(await applicantReviewPrompt.isVisible())) {
    issues.push("applicant: 中央レビュー案内カードがありません");
  }
  const applicantReviewTitle = await applicantReviewPrompt
    .locator(".chat-job-review-prompt__title")
    .textContent();
  if (String(applicantReviewTitle || "").trim() !== REVIEW_CARD_TITLE) {
    issues.push(`applicant: review card title=${applicantReviewTitle}`);
  }
  const applicantReviewBody = await applicantReviewPrompt
    .locator(".chat-job-review-prompt__body")
    .textContent();
  if (String(applicantReviewBody || "").trim() !== REVIEW_CARD_BODY) {
    issues.push(`applicant: review card body=${applicantReviewBody}`);
  }
  if (!(await applicant.locator("[data-platform-job-review-open]").isVisible())) {
    issues.push("applicant: やりとり評価するボタンがありません");
  }
  if (!(await applicant.locator(".chat-composer").isHidden())) {
    issues.push("applicant: 完了後も入力欄が表示されています");
  }

  const applicantOverflow = await applicant.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth + 1;
  });
  if (applicantOverflow) {
    issues.push("applicant: 390pxで横スクロールが発生しています");
  }

  await poster.goto(
    `${BASE}/chat-detail.html?thread=${THREAD}&userId=${POSTER}&talkDev=1&review=job-full`,
    { waitUntil: "domcontentloaded" }
  );
  await poster.waitForFunction(() => document.body.dataset.chatDetailReady === "true");

  if (await poster.locator("#chatPostCompleteBar").isVisible()) {
    issues.push("poster: 下部レビューバーが表示されています（非表示であるべき）");
  }
  const posterReviewPrompt = poster.locator("[data-platform-job-review-prompt]");
  if (!(await posterReviewPrompt.isVisible())) {
    issues.push("poster: 中央レビュー案内カードがありません");
  }
  const posterReviewBody = await posterReviewPrompt
    .locator(".chat-job-review-prompt__body")
    .textContent();
  if (String(posterReviewBody || "").trim() !== REVIEW_CARD_BODY) {
    issues.push(`poster: review card body=${posterReviewBody}`);
  }
  if (!(await poster.locator("[data-platform-job-review-open]").isVisible())) {
    issues.push("poster: やりとり評価するボタンがありません");
  }

  await poster.goto(
    `${BASE}/talk-home.html?tab=notify&userId=${POSTER}&talkDev=1&review=job-full`,
    { waitUntil: "domcontentloaded" }
  );
  await poster.waitForTimeout(800);
  const completeNotify = await poster.locator(
    'article[data-talk-notify-id="platform-verify-job-full-complete-001"]'
  ).count();
  if (completeNotify < 1) issues.push("poster: 完了通知がありません");

  await poster.goto(
    `${BASE}/chat-detail.html?thread=${THREAD}&userId=${POSTER}&talkDev=1&review=job-full`,
    { waitUntil: "domcontentloaded" }
  );
  await poster.waitForFunction(() => document.body.dataset.chatDetailReady === "true");

  await poster.locator("[data-platform-job-review-open]").click();
  await poster.waitForSelector("#chatReviewModal:not([hidden])", { timeout: 5000 });
  const title = await poster.locator("#chatReviewTitle").textContent();
  if (String(title || "").trim() !== "やりとり評価") {
    issues.push(`poster: review title=${title} (expected やりとり評価)`);
  }
  const reviewTarget = await poster.locator("#chatReviewTarget").textContent();
  if (INTERNAL_ID_PATTERN.test(String(reviewTarget || ""))) {
    issues.push(`poster: 評価対象に内部IDが含まれています (${reviewTarget})`);
  }
  if (!String(reviewTarget || "").includes("ひろ") && !String(reviewTarget || "").includes("相手")) {
    issues.push(`poster: 評価対象=${reviewTarget} (expected ひろ or 相手)`);
  }

  await poster.locator("#chatReviewSkip").click();
  await poster.waitForFunction(
    (label) => {
      const done = document.querySelector(".chat-job-review-prompt__done");
      return done && done.textContent.trim() === label;
    },
    REVIEW_DONE_LABEL,
    { timeout: 10000 }
  );
  if (await poster.locator("[data-platform-job-review-open]").count()) {
    issues.push("poster: 評価後もやりとり評価するボタンが残っています");
  }

  const doubleSubmit = await poster.evaluate(
    async (id) => {
      const thread = window.TasuChatThreadStore.readAll().find((t) => t.id === id);
      return window.TasuChatService.submitReview({
        roomId: id,
        roomContext: thread,
        rating: 5,
        comment: "",
        isSkipped: false,
      });
    },
    THREAD
  );
  if (doubleSubmit?.ok !== false) {
    issues.push("poster: 二重評価がブロックされていません");
  }

  if (issues.length) {
    console.error("verify-job-dual-window-completion FAILED:\n" + issues.join("\n"));
    process.exit(1);
  }
  console.log("verify-job-dual-window-completion OK");
} finally {
  await browser.close();
}
