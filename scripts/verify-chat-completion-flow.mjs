#!/usr/bin/env node
/**
 * チャット中心完了フロー — 求人 + 一般案件デモ検証
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();

const JOB_THREAD = "chat-demo-job-full-001";
const GENERAL_THREAD = "chat-demo-completion-verify-skill";
const BUYER = "u_hiro";
const SELLER = "u_job_demo_full";
const GENERAL_SELLER = "demo-skill-provider";

async function seedGeneralThread(page) {
  await page.evaluate(
    ({ threadId, buyerId, sellerId }) => {
      const store = window.TasuChatThreadStore;
      if (!store?.readAll || !store?.STORAGE_KEY || !store?.MESSAGES_KEY) {
        throw new Error("TasuChatThreadStore missing");
      }
      const threads = store.readAll().filter((t) => String(t.id) !== threadId);
      threads.unshift({
        id: threadId,
        chatDomain: "work",
        threadKind: "listing_inquiry",
        listingId: "skill_deal_demo_001",
        listingType: "skill",
        listingTitle: "Web制作・LP改修（React）",
        category: "スキル",
        sellerId,
        sellerName: "クリエイター K",
        partnerUserId: sellerId,
        buyerId,
        buyerName: "ひろ",
        roomStatus: "active",
        status: "open",
        source: "completion-flow-verify",
        lastMessage: "デモ用スキル案件チャット",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      localStorage.setItem(store.STORAGE_KEY, JSON.stringify(threads));
      const raw = localStorage.getItem(store.MESSAGES_KEY);
      const map = raw ? JSON.parse(raw) : {};
      map[threadId] = [
        {
          id: `msg-${threadId}-hello`,
          chatId: threadId,
          senderId: sellerId,
          senderName: "クリエイター K",
          text: "納品物の確認をお願いします。",
          createdAt: new Date().toISOString(),
          kind: "text",
        },
      ];
      localStorage.setItem(store.MESSAGES_KEY, JSON.stringify(map));
    },
    { threadId: GENERAL_THREAD, buyerId: BUYER, sellerId: GENERAL_SELLER }
  );
}

async function resetJobDemo(page) {
  await page.goto(
    `${BASE}/chat-detail.html?thread=${JOB_THREAD}&review=job-full&jobFullReset=1&talkDev=1&userId=${SELLER}`,
    { waitUntil: "domcontentloaded" }
  );
  await page.waitForFunction(() => document.body.dataset.chatDetailReady === "true", null, {
    timeout: 15000,
  });
}

async function runFlow(page, { threadId, requesterId, approverId, reviewParam, expectRequestText, expectDoneText }) {
  const reviewQs = reviewParam ? `&review=${reviewParam}` : "";
  const issues = [];

  await page.goto(
    `${BASE}/chat-detail.html?thread=${threadId}${reviewQs}&talkDev=1&userId=${requesterId}`,
    { waitUntil: "domcontentloaded" }
  );
  await page.waitForFunction(() => document.body.dataset.chatDetailReady === "true", null, {
    timeout: 15000,
  });

  const completeBtn = page.locator("#chatCompleteBtn");
  await completeBtn.click();
  await page.locator("#chatCompleteSubmit").click();
  await page.waitForTimeout(400);

  const requestVisible = await page.locator(".chat-system-msg__text", { hasText: expectRequestText }).count();
  if (requestVisible < 1) issues.push(`requester: system request message missing (${expectRequestText})`);

  const pending = await page.evaluate(() => {
    const threadId = new URLSearchParams(location.search).get("thread");
    const row = window.TasuChatThreadStore.readAll().find((t) => String(t.id) === threadId);
    return row?.roomStatus;
  });
  if (pending !== "completion_pending") issues.push(`requester: roomStatus=${pending} expected completion_pending`);

  await page.goto(
    `${BASE}/chat-detail.html?thread=${threadId}${reviewQs}&talkDev=1&userId=${approverId}`,
    { waitUntil: "domcontentloaded" }
  );
  await page.waitForFunction(() => document.body.dataset.chatDetailReady === "true", null, {
    timeout: 15000,
  });

  const approveBtn = page.locator("#chatApproveCompleteBtn");
  if (!(await approveBtn.isVisible())) issues.push("approver: approve button not visible");
  await approveBtn.click();
  await page.waitForTimeout(500);

  const doneVisible = await page.locator(".chat-system-msg__text", { hasText: expectDoneText }).count();
  if (doneVisible < 1) issues.push(`approver: system done message missing (${expectDoneText})`);

  const completed = await page.evaluate(() => {
    const threadId = new URLSearchParams(location.search).get("thread");
    const row = window.TasuChatThreadStore.readAll().find((t) => String(t.id) === threadId);
    return row?.roomStatus;
  });
  if (completed !== "completed") issues.push(`approver: roomStatus=${completed} expected completed`);

  const composerHidden = await page.locator(".chat-composer").isHidden();
  if (!composerHidden) issues.push("approver: composer should be hidden after complete");

  const reviewBarVisible = await page.locator("#chatPostCompleteBar").isVisible();
  const jobReviewPromptVisible = await page.locator("[data-platform-job-review-prompt]").isVisible();
  if (!reviewBarVisible && !jobReviewPromptVisible) {
    issues.push("approver: review bar or job review prompt not visible");
  }

  if (reviewBarVisible) {
    await page.locator("#chatReviewBarBtn").click();
    const modalVisible = await page.locator("#chatReviewModal").isVisible();
    if (!modalVisible) issues.push("review modal did not open from bar");
  } else if (jobReviewPromptVisible) {
    await page.locator("[data-platform-job-review-open]").click();
    const modalVisible = await page.locator("#chatReviewModal").isVisible();
    if (!modalVisible) issues.push("review modal did not open from job prompt");
  }

  const sendDisabled = await page.locator("#chatSend").isDisabled().catch(() => true);
  if (!sendDisabled) issues.push("approver: send should be disabled/hidden");

  const notifyCount = await page.evaluate(({ threadId }) => {
    const list = window.TasuTalkNotifications?.getAll?.() || [];
    return list.filter(
      (n) =>
        String(n.threadId || "") === threadId &&
        (String(n.title || "").includes("申請") || String(n.title || "").includes("完了"))
    ).length;
  }, { threadId });
  if (notifyCount < 1) issues.push("notify: completion-related notification missing");

  return issues;
}

await withPlaywrightBrowser(async (browser) => {
  await resetJobDemo(page);
  await seedGeneralThread(page);

  const jobIssues = await runFlow(page, {
    threadId: JOB_THREAD,
    requesterId: SELLER,
    approverId: BUYER,
    reviewParam: "job-full",
    expectRequestText: "タスク確認株式会社がやりとり完了を申請しました",
    expectDoneText: "やりとりが完了しました",
  });

  const generalIssues = await runFlow(page, {
    threadId: GENERAL_THREAD,
    requesterId: BUYER,
    approverId: GENERAL_SELLER,
    reviewParam: "",
    expectRequestText: "ひろさんが取引完了を申請しました",
    expectDoneText: "取引が完了しました",
  });

  const all = [
    ...jobIssues.map((i) => `[job] ${i}`),
    ...generalIssues.map((i) => `[general] ${i}`),
  ];

  if (all.length) {
    console.error("verify-chat-completion-flow FAILED:\n" + all.join("\n"));
    process.exit(1);
  }

  console.log("verify-chat-completion-flow OK (job + general)");
});

await closeAllBrowsers();
