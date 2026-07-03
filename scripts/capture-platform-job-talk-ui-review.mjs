#!/usr/bin/env node
/**
 * Platform 求人 → TASFUL Talk — Screenshot Review
 *
 *   npm run dev 起動後:
 *   node scripts/capture-platform-job-talk-ui-review.mjs
 *
 * 出力: reports/ui-review/platform-talk/
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";
import { createUiReviewSession } from "./lib/ui-review-capture.mjs";
import {
  PLATFORM_JOB_TALK_CFG,
  resetPlatformJobTalkState,
  waitJobApplicationsReady,
  clickJobProceedForApplication,
  navigatePlatformJobToTalk,
  readPlatformJobTalkDiagnostics,
  probeBuilderWorkflowMisdisplay,
  probePlatformNotifyCard,
  sendPlatformChatMessage,
  openPlatformChatAsUser,
  chatMessagesContain,
} from "./lib/platform-job-talk-review.mjs";

const FEATURE = "platform-talk";
const cfg = PLATFORM_JOB_TALK_CFG;

const base = await findDevServerBaseUrl({ probePath: "detail-job.html" });
const applicationsUrl = buildLocalPageUrl(
  base,
  `detail-job.html?id=${cfg.listingId}&userId=${cfg.posterUserId}&talkDev=1#applications`
);

console.log(`\n=== Platform job → Talk UI review capture ===`);
console.log(`Base: ${base}`);
console.log(`Output: reports/ui-review/${FEATURE}/\n`);

const session = createUiReviewSession(FEATURE, { baseUrl: base, viewports: ["1280"] });

await withPlaywrightBrowser(async (browser) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("dialog", async (d) => d.accept());
  page.on("dialog", async (d) => d.accept());
  await resetPlatformJobTalkState(page, base);

  await session.captureStep(page, browser, {
    slug: "job-applications",
    label: "応募者確認 · やりとりに進む",
    url: applicationsUrl,
    prepare: async (p) => {
      await p.waitForFunction(() => document.body.dataset.listingLoaded === "true", { timeout: 45000 });
      await waitJobApplicationsReady(p);
    },
    waitFor: "[data-job-app-proceed]",
  });

  const proceed = page.locator(`[data-application-id="${cfg.applicationId}"] [data-job-app-proceed]`).first();
  if ((await proceed.count()) < 1) {
    await clickJobProceedForApplication(page, cfg.applicationId);
  } else {
    await Promise.all([page.waitForURL(/platform-chat-fee-pay/i, { timeout: 20000 }), proceed.click()]);
  }
  const u = new URL(page.url());
  if (u.searchParams.get("talkDev") !== "1") {
    u.searchParams.set("talkDev", "1");
    await page.goto(u.toString(), { waitUntil: "domcontentloaded" });
  }
  const threadIdPre = "";

  await session.captureStep(page, browser, {
    slug: "fee-pay-550",
    label: "550円 やりとり開始利用料",
    url: page.url(),
    waitFor: "[data-platform-fee-pay]",
  });

  await page.locator("[data-platform-fee-pay]").first().click();
  await page.waitForFunction(
    () => !document.querySelector("[data-platform-fee-complete]")?.hasAttribute("hidden"),
    { timeout: 20000 }
  );

  const chatHref = await page.evaluate(() => {
    const href = document.querySelector("[data-platform-fee-chat-link]")?.getAttribute("href") || "";
    return href && href !== "#" ? href : "";
  });
  if (!chatHref) throw new Error("chat link missing after fee pay");

  await session.captureStep(page, browser, {
    slug: "fee-pay-complete",
    label: "支払い完了 · チャットへ",
    url: page.url(),
    skipGoto: true,
    waitFor: "[data-platform-fee-chat-link]",
  });

  const chatUrl = chatHref.startsWith("http") ? chatHref : buildLocalPageUrl(base, chatHref.replace(/^\//, ""));
  const chatDevUrl = (() => {
    const u = new URL(chatUrl);
    u.searchParams.set("talkDev", "1");
    u.searchParams.set("userId", cfg.posterUserId);
    return u.toString();
  })();
  await page.goto(chatDevUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  if (!/chat-detail/i.test(page.url())) {
    throw new Error(`expected chat-detail after fee pay, got ${page.url()}`);
  }
  await page.waitForFunction(() => document.body.dataset.chatDetailReady === "true", { timeout: 30000 }).catch(() => null);
  const threadId = new URL(page.url()).searchParams.get("thread") || "";
  if (!threadId) throw new Error("threadId missing on chat-detail URL");

  await session.captureStep(page, browser, {
    slug: "talk-room-created",
    label: "Talk ルーム · 求人カード",
    url: page.url(),
    skipGoto: true,
    waitFor: "[data-platform-job-application-card], .chat-job-card, #chatMessages",
  });

  await sendPlatformChatMessage(page, "Platform案件から相談します（UI review · poster）");

  await session.captureStep(page, browser, {
    slug: "normal-chat-poster",
    label: "通常チャット · 掲載者送信",
    url: page.url(),
    skipGoto: true,
    waitFor: "#chatMessages",
  });

  await openPlatformChatAsUser(page, base, threadId, cfg.applicantUserId);
  const applicantSeesMessage = await chatMessagesContain(page, "Platform案件から相談");

  await session.captureStep(page, browser, {
    slug: "normal-chat-applicant",
    label: "通常チャット · 応募者受信",
    url: page.url(),
    skipGoto: true,
    waitFor: "#chatMessages",
  });

  await sendPlatformChatMessage(page, "応募者から返信します（UI review）");
  await openPlatformChatAsUser(page, base, threadId, cfg.posterUserId);

  await session.captureStep(page, browser, {
    slug: "thread-sync",
    label: "thread / roomId · 案件文脈",
    url: page.url(),
    skipGoto: true,
    waitFor: "#chatPeerHeader, #chatMessages",
  });

  const diagnostics = await readPlatformJobTalkDiagnostics(page, threadId);
  const forbidden = await probeBuilderWorkflowMisdisplay(page);
  const posterSeesReply = await chatMessagesContain(page, "応募者から返信");
  const notifyPoster = await probePlatformNotifyCard(page, base, cfg.posterUserId, cfg.applyNotifyId);

  session.writeReport({
    feature: FEATURE,
    baseUrl: base,
    threadId,
    diagnostics,
    notifyPoster,
    forbiddenActions: forbidden,
    checks: {
      threadCreated: Boolean(diagnostics.threadId && diagnostics.roomId),
      jobHireKind: diagnostics.threadKind === "job_hire",
      listingIdSet: diagnostics.listingId === cfg.listingId,
      applicationIdSet: Boolean(diagnostics.applicationId),
      listingTitleSet: Boolean(diagnostics.listingTitle || diagnostics.jobCardTitle),
      participantsSet: Boolean(diagnostics.posterUserId && diagnostics.applicantUserId),
      jobCardInThread:
        diagnostics.hasJobApplicationCard ||
        diagnostics.hasDomJobCard ||
        (Boolean(diagnostics.listingTitle) && diagnostics.messageCount > 0),
      chatBidirectional: applicantSeesMessage && posterSeesReply,
      applyNotifyExists: notifyPoster.notifyFound || notifyPoster.cardVisible,
      noBuilderWorkflowButtons: forbidden.visibleWorkflowButtons === 0 && forbidden.enterExitButtons === 0,
      noBuilderCommissionUi: !forbidden.hasCommissionPctText,
    },
  });

  console.log(`\nDiagnostics: ${JSON.stringify(diagnostics, null, 2)}`);
  console.log(`Notify (poster): ${JSON.stringify(notifyPoster)}`);
  console.log(`Forbidden: ${JSON.stringify(forbidden)}`);

  const checks = {
    threadCreated: Boolean(diagnostics.threadId && diagnostics.roomId),
    jobHireKind: diagnostics.threadKind === "job_hire",
    listingIdSet: diagnostics.listingId === cfg.listingId,
    jobCardInThread:
      diagnostics.hasJobApplicationCard ||
      diagnostics.hasDomJobCard ||
      (Boolean(diagnostics.listingTitle) && diagnostics.messageCount > 0),
    chatBidirectional: applicantSeesMessage && posterSeesReply,
    noBuilderWorkflowButtons: forbidden.visibleWorkflowButtons === 0 && forbidden.enterExitButtons === 0,
    noBuilderCommissionUi: !forbidden.hasCommissionPctText,
  };
  const failed = Object.entries(checks).filter(([, ok]) => !ok);
  if (failed.length) {
    console.error("\n=== UI review checks FAILED ===");
    failed.forEach(([k]) => console.error(`  ✗ ${k}`));
    await closeAllBrowsers();
    process.exit(1);
  }

  console.log("\nPASS capture-platform-job-talk-ui-review");
});

await closeAllBrowsers();
