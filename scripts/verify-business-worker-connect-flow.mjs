#!/usr/bin/env node
/**
 * business_service / worker — Connectあり
 * - 依頼直後は完了報告カードなし
 * - 作業完了申請モーダルに配送フィールドなし
 * - 作業完了申請後に完了報告カード表示
 * - キャンセル申請 → 承認/却下
 */
import { launchHeadlessBrowser } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();

function benchUrl(profileId) {
  const u = new URL(`${BASE}/chat-dual-window-demo.html`);
  u.searchParams.set("talkDev", "1");
  u.searchParams.set("review", "chat-demo");
  u.searchParams.set("demoProfile", profileId);
  u.searchParams.set("demoConnect", "1");
  u.searchParams.set("liveFlow", "1");
  u.searchParams.set("liveFlowReset", "1");
  u.searchParams.set("benchViewport", "390");
  u.searchParams.set("benchPattern", profileId === "business" ? "business-1" : "worker-1");
  return u.toString();
}

async function bootChat(page, profileId) {
  return page.evaluate((profileId) => {
    const Demo = window.TasuPlatformChatDualWindowDemo;
    const Live = window.TasuPlatformChatLiveFlow;
    const profile = Demo?.getProfile?.(profileId, true);
    if (!profile) return { ok: false, reason: "no_profile" };
    Live?.resetLiveFlow?.({ profile: profileId, connect: true });
    Demo?.seedPreStartDemoState?.(profile);
    const threadId = profile.threadId;
    const store = window.TasuChatThreadStore;
    const msgMap = store?.readMessagesMap?.() || {};
    const messages = Array.isArray(msgMap[threadId]) ? msgMap[threadId] : [];
    const thread = (store?.readAll?.() || []).find((t) => String(t.id) === String(threadId));
    const Completion = window.TasuPlatformChatCompletion;
    const report = Completion?.getCompletionReport?.(profile.dealId);
    const hasReportCard = messages.some((m) => m.kind === "completion_report");
    const hasShipForm =
      window.TasuPlatformChatPurchasePaymentFlow?.requiresShipInputForm?.(thread) === true;
    const hasWorkForm =
      window.TasuPlatformChatCategoryFlow?.requiresWorkReportForm?.(thread) === true;
    const Cancel = window.TasuPlatformChatCancelFlow;
    const canA = Cancel?.canRequestCancelConversation?.(thread, profile.partnerAId) === true;
    const canB = Cancel?.canRequestCancelConversation?.(thread, profile.partnerBId) === true;
    const canCancelReq = canA || canB;
    return {
      ok: true,
      threadId,
      dealId: profile.dealId,
      listingId: profile.listingId,
      sellerId: profile.partnerAId,
      buyerId: profile.partnerBId,
      roomStatus: thread?.roomStatus,
      threadDealId: thread?.dealId,
      listingType: thread?.listingType,
      hasReportCard,
      staticReport: Boolean(report),
      hasShipForm,
      hasWorkForm,
      canCancelReq,
      cancelDebug: {
        isWorkerSvc: Cancel?.isWorkerServiceConnectThread?.(thread),
        usesDealFlow: Completion?.usesCompletionReportDealFlow?.(profile.dealId),
        canA,
        canB,
      },
      messageKinds: messages.map((m) => m.kind),
    };
  }, profileId);
}

async function openCompleteModalOnChatPage(page, chatUrl) {
  await page.goto(chatUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(
    () => {
      const btn = document.getElementById("chatCompleteBtn");
      const ready =
        document.body?.dataset?.chatDetailReady === "true" ||
        window.__tasuChatDetailReady === true;
      return ready && btn && !btn.hidden && /作業完了/.test(btn.textContent || "");
    },
    { timeout: 30000 }
  );
  return page.evaluate(() => {
    const btn = document.getElementById("chatCompleteBtn");
    if (!btn || btn.hidden) return { ok: false, reason: "no_complete_btn" };
    btn.click();
    const ship = document.getElementById("chatShipForm");
    const work = document.getElementById("chatWorkReportForm");
    const photos = document.getElementById("chatWorkReportPhotos");
    const legacyAttach = document.getElementById("chatWorkReportAttachments");
    const title = document.getElementById("chatCompleteTitle")?.textContent || "";
    const shipStyle = ship ? window.getComputedStyle(ship).display : "none";
    const workStyle = work ? window.getComputedStyle(work).display : "none";
    return {
      ok: true,
      shipVisible: ship && !ship.hidden && shipStyle !== "none",
      workVisible: work && !work.hidden && workStyle !== "none",
      hasPhotoInput: Boolean(photos && photos.type === "file"),
      hasLegacyUrlAttach: Boolean(legacyAttach),
      title,
      body: document.getElementById("chatCompleteBody")?.textContent || "",
      primaryAction: btn?.getAttribute("data-primary-action") || "",
      requiresWork: window.TasuPlatformChatCategoryFlow?.requiresWorkReportForm?.(
        (window.TasuChatThreadStore?.readAll?.() || []).find(
          (t) => String(t.id) === String(new URLSearchParams(location.search).get("thread"))
        )
      ),
    };
  });
}

async function submitWorkCompletion(page, threadId, sellerId) {
  return page.evaluate(
    ({ threadId, sellerId }) => {
      const thread = (window.TasuChatThreadStore?.readAll?.() || []).find(
        (t) => String(t.id) === String(threadId)
      );
      const res = window.TasuPlatformChatCompletionFlow?.requestCompletion?.({
        threadId,
        thread,
        userId: sellerId,
        submittedContent: "作業完了のテスト報告",
        attachments: "写真2点",
        confirmMemo: "ご確認ください",
      });
      const msgMap = window.TasuChatThreadStore?.readMessagesMap?.() || {};
      const messages = Array.isArray(msgMap[threadId]) ? msgMap[threadId] : [];
      const hasReportCard = messages.some((m) => m.kind === "completion_report");
      return {
        ok: res?.ok === true,
        hasReportCard,
        pending: res?.pending === true,
        reason: res?.reason || "",
      };
    },
    { threadId, sellerId }
  );
}

async function runCancelRequestFlow(page, threadId, buyerId, sellerId) {
  return page.evaluate(
    ({ threadId, buyerId, sellerId }) => {
      const Cancel = window.TasuPlatformChatCancelFlow;
      const store = window.TasuChatThreadStore;
      const thread = (store?.readAll?.() || []).find((t) => String(t.id) === String(threadId));
      const req = Cancel?.requestCancelConversation?.({
        threadId,
        thread,
        userId: buyerId,
        reasonId: "schedule",
        reasonLabel: "日程都合",
      });
      const afterReq = (store?.readAll?.() || []).find((t) => String(t.id) === String(threadId));
      const canRespond =
        Cancel?.canRespondToCancelRequest?.(afterReq, sellerId) === true;
      const reject = Cancel?.rejectCancelRequest?.({
        threadId,
        thread: afterReq,
        userId: sellerId,
      });
      const afterReject = (store?.readAll?.() || []).find((t) => String(t.id) === String(threadId));
      return {
        requested: req?.ok === true,
        canRespond,
        rejected: reject?.ok === true,
        cancelRequestStatus: afterReject?.cancelRequestStatus || "",
        roomStatus: afterReject?.roomStatus,
      };
    },
    { threadId, buyerId, sellerId }
  );
}

function buildChatDetailUrl(profileId, threadId, userId, dealId, listingId, extra = {}) {
  const u = new URL(`${BASE}/chat-detail.html`);
  u.searchParams.set("thread", threadId);
  if (dealId) u.searchParams.set("deal", dealId);
  if (listingId) u.searchParams.set("listingId", listingId);
  u.searchParams.set("review", "chat-demo");
  u.searchParams.set("demoProfile", profileId);
  u.searchParams.set("demoConnect", "1");
  u.searchParams.set("liveFlow", "1");
  u.searchParams.set("talkDev", "1");
  u.searchParams.set("userId", userId);
  Object.entries(extra).forEach(([k, v]) => {
    if (v != null && v !== "") u.searchParams.set(k, String(v));
  });
  return u.toString();
}

function sellerChatUrl(profileId, threadId, sellerId, dealId, listingId) {
  return buildChatDetailUrl(profileId, threadId, sellerId, dealId, listingId);
}

async function verifyProfile(browser, profileId) {
  const page = await browser.newPage();
  const errors = [];
  try {
    await page.goto(benchUrl(profileId), { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(() => window.TasuPlatformChatDualWindowDemo?.getProfile, {
      timeout: 20000,
    });

    const boot = await bootChat(page, profileId);
    if (!boot.ok) {
      errors.push(`${profileId}: boot failed ${boot.reason}`);
      return errors;
    }

    if (boot.hasReportCard) {
      errors.push(`${profileId}: completion_report card present on initial load`);
    }
    if (boot.staticReport) {
      errors.push(`${profileId}: getCompletionReport returned data before work completion`);
    }
    if (boot.hasShipForm) {
      errors.push(`${profileId}: requiresShipInputForm true for worker/business thread`);
    }
    if (!boot.hasWorkForm) {
      errors.push(`${profileId}: requiresWorkReportForm false (expected true)`);
    }
    if (!boot.canCancelReq) {
      errors.push(
        `${profileId}: cancel request button should be available before completion (${JSON.stringify(boot.cancelDebug)})`
      );
    }
    if (boot.roomStatus !== "active") {
      errors.push(`${profileId}: expected roomStatus active, got ${boot.roomStatus}`);
    }

    const modal = await openCompleteModalOnChatPage(
      page,
      sellerChatUrl(profileId, boot.threadId, boot.sellerId, boot.dealId, boot.listingId)
    );
    if (!modal.ok) {
      errors.push(`${profileId}: could not open complete modal (${modal.reason})`);
    } else {
      if (modal.shipVisible) {
        errors.push(`${profileId}: ship form visible in work completion modal`);
      }
      if (modal.hasLegacyUrlAttach) {
        errors.push(`${profileId}: legacy URL attachment field still present`);
      }
      if (!modal.hasPhotoInput) {
        errors.push(`${profileId}: photo file input missing in work completion modal`);
      }
      if (!modal.workVisible) {
        errors.push(`${profileId}: work report form not visible in modal`);
      }
      if (!/作業完了申請/.test(modal.title)) {
        errors.push(
          `${profileId}: modal title expected 作業完了申請, got ${modal.title} (action=${modal.primaryAction || ""})`
        );
      }
    }

    const cancel = await runCancelRequestFlow(page, boot.threadId, boot.buyerId, boot.sellerId);
    if (!cancel.requested) errors.push(`${profileId}: cancel request failed`);
    if (!cancel.canRespond) errors.push(`${profileId}: seller could not respond to cancel request`);
    if (!cancel.rejected) errors.push(`${profileId}: cancel reject failed`);
    if (cancel.roomStatus === "cancelled") {
      errors.push(`${profileId}: room cancelled after reject (should continue)`);
    }

    const afterRejectThread = await page.evaluate((threadId) => {
      const thread = (window.TasuChatThreadStore?.readAll?.() || []).find(
        (t) => String(t.id) === String(threadId)
      );
      return window.TasuPlatformChatCancelFlow?.canRequestCancelConversation?.(
        thread,
        thread?.buyerId
      );
    }, boot.threadId);
    if (afterRejectThread !== true) {
      errors.push(`${profileId}: cancel request should be available again after reject`);
    }

    const afterComplete = await submitWorkCompletion(page, boot.threadId, boot.sellerId);
    if (!afterComplete.ok) {
      errors.push(
        `${profileId}: requestCompletion failed${afterComplete.reason ? ` (${afterComplete.reason})` : ""}`
      );
    }
    if (!afterComplete.hasReportCard) {
      errors.push(`${profileId}: completion_report card missing after work completion request`);
    }

    const canCancelAfterComplete = await page.evaluate((threadId) => {
      const thread = (window.TasuChatThreadStore?.readAll?.() || []).find(
        (t) => String(t.id) === String(threadId)
      );
      return window.TasuPlatformChatCancelFlow?.canRequestCancelConversation?.(
        thread,
        thread?.buyerId
      );
    }, boot.threadId);
    if (canCancelAfterComplete === true) {
      errors.push(`${profileId}: cancel request should be hidden after work completion submitted`);
    }

    const postFlow = await page.evaluate(
      ({ threadId, buyerId, sellerId }) => {
        const Completion = window.TasuPlatformChatCompletionFlow;
        const WorkSvc = window.TasuPlatformChatWorkServiceConnectFlow;
        const store = window.TasuChatThreadStore;
        const thread = (store?.readAll?.() || []).find((t) => String(t.id) === String(threadId));
        if (!WorkSvc?.isWorkServiceConnectThread?.(thread)) {
          return { ok: false, reason: "not_work_service_thread" };
        }
        const approve = Completion?.approveCompletion?.({
          threadId,
          thread,
          userId: buyerId,
        });
        const afterApprove = Completion?.readThread?.(threadId);
        const msgMap = store?.readMessagesMap?.() || {};
        const messages = Array.isArray(msgMap[threadId]) ? msgMap[threadId] : [];
        const hasStripeCard = messages.some((m) => m.kind === "work_service_stripe_payment_card");
        const pay = WorkSvc?.executeStripeConnectPayment?.({
          threadId,
          thread: afterApprove,
          userId: buyerId,
        });
        const afterPay = Completion?.readThread?.(threadId);
        const messages2 = (store?.readMessagesMap?.()?.[threadId] || []);
        const hasSellerCard = messages2.some((m) => m.kind === "work_service_seller_confirm_card");
        const paymentCompleted = afterPay?.paymentCompleted === true;
        const confirm = WorkSvc?.confirmPaymentReceived?.({
          threadId,
          thread: afterPay,
          userId: sellerId,
        });
        const finalThread = Completion?.readThread?.(threadId);
        const notifies = (window.TasuTalkNotifications?.getAll?.() || []).filter(
          (n) => String(n.threadId) === String(threadId)
        );
        const messagesFinal = (store?.readMessagesMap?.()?.[threadId] || []);
        const hasCompletionReviewCard = messagesFinal.some(
          (m) => m.kind === "platform_completion_card"
        );
        const Category = window.TasuPlatformChatCategoryFlow;
        const reviewNotifies = notifies.filter((n) => /レビュー/.test(String(n.actionLabel || "")));
        const buyerReviewNotifies = reviewNotifies.filter(
          (n) => String(n.recipientUserId) === String(buyerId)
        );
        const sellerReviewNotifies = reviewNotifies.filter(
          (n) => String(n.recipientUserId) === String(sellerId)
        );
        const sellerConfirmReview = notifies.filter(
          (n) =>
            String(n.source) === "platform_chat_work_svc_seller_confirm_v1" &&
            /レビュー/.test(String(n.actionLabel || ""))
        );
        const sellerPaidNotify = notifies.find(
          (n) =>
            String(n.recipientUserId) === String(sellerId) &&
            String(n.source) === "platform_chat_work_svc_buyer_paid_v1"
        );
        const sellerCard = messagesFinal.find((m) => m.kind === "work_service_seller_confirm_card");
        const cardMeta = sellerCard?.workServiceSellerConfirmCard || {};
        const labels = WorkSvc?.getWorkServiceFlowLabels?.(finalThread) || {};
        const reviewHrefOk = (n) => {
          const raw = String(n.href || n.targetUrl || "");
          return /chat-detail\.html/i.test(raw) && /openReview=1/.test(raw);
        };
        const normalChatReviewPrompt =
          Category?.shouldShowReviewPrompt?.(finalThread, buyerId) === true;
        const reviewEligible =
          Category?.isReviewEligible?.(finalThread, buyerId) === true;
        return {
          ok:
            approve?.awaitingPayment === true &&
            afterApprove?.roomStatus === "awaiting_payment" &&
            hasStripeCard &&
            pay?.ok === true &&
            paymentCompleted &&
            hasSellerCard &&
            confirm?.ok === true &&
            finalThread?.roomStatus === "completed" &&
            WorkSvc?.isReadyForReview?.(finalThread) === true &&
            !hasCompletionReviewCard &&
            !normalChatReviewPrompt &&
            reviewEligible &&
            buyerReviewNotifies.length === 1 &&
            sellerReviewNotifies.length === 1 &&
            sellerConfirmReview.length === 0 &&
            reviewNotifies.every(reviewHrefOk) &&
            !/支払い確認/.test(String(sellerPaidNotify?.title || "")) &&
            cardMeta.title === labels.sellerConfirmCardTitle &&
            cardMeta.button === labels.sellerConfirmButton &&
            !/支払い確認/.test(String(cardMeta.title || "")),
          approve,
          pay,
          confirm,
          roomStatus: finalThread?.roomStatus,
          notifyTitles: notifies.map((n) => n.title).slice(-8),
          buyerReviewCount: buyerReviewNotifies.length,
          sellerReviewCount: sellerReviewNotifies.length,
          sellerConfirmReviewCount: sellerConfirmReview.length,
          hasCompletionReviewCard,
          normalChatReviewPrompt,
          paymentCompleted,
          sellerCardTitle: cardMeta.title,
        };
      },
      { threadId: boot.threadId, buyerId: boot.buyerId, sellerId: boot.sellerId }
    );
    if (!postFlow.ok) {
      errors.push(`${profileId}: post-completion connect flow failed ${JSON.stringify(postFlow)}`);
    }

    const normalChatUrl = buildChatDetailUrl(
      profileId,
      boot.threadId,
      boot.buyerId,
      boot.dealId,
      boot.listingId,
      { demoState: "completed" }
    );
    await page.goto(normalChatUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(
      () =>
        document.body?.dataset?.chatDetailReady === "true" ||
        window.__tasuChatDetailReady === true,
      { timeout: 30000 }
    );
    const normalReviewUi = await page.evaluate(() => {
      const bar = document.getElementById("chatPostCompleteBar");
      const reviewBtn = document.getElementById("chatReviewBarBtn");
      return {
        prompt: Boolean(document.querySelector("[data-platform-job-review-prompt]")),
        barBtn: Boolean(bar && !bar.hidden && reviewBtn && !reviewBtn.hidden),
        modalOpen: Boolean(
          document.getElementById("chatReviewModal") &&
            !document.getElementById("chatReviewModal").hidden
        ),
      };
    });
    if (normalReviewUi.prompt || normalReviewUi.barBtn || normalReviewUi.modalOpen) {
      errors.push(
        `${profileId}: review UI visible on normal completed chat ${JSON.stringify(normalReviewUi)}`
      );
    }

    for (const [role, userId] of [
      ["buyer", boot.buyerId],
      ["seller", boot.sellerId],
    ]) {
      const notifyReviewUrl = buildChatDetailUrl(
        profileId,
        boot.threadId,
        userId,
        boot.dealId,
        boot.listingId,
        { from: "notify", openReview: "1", demoState: "completed" }
      );
      const clickWall = Date.now();
      await page.evaluate((wall) => {
        sessionStorage.setItem("tasu_review_notify_click_wall", String(wall));
      }, clickWall);
      await page.goto(notifyReviewUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForFunction(
        () => {
          const modal = document.getElementById("chatReviewModal");
          return modal && !modal.hidden;
        },
        { timeout: 3000 }
      );
      const reviewTiming = await page.evaluate(() => {
        const log = window.__reviewAutoOpenLog || [];
        const opened = log.find((e) => e.step === "openReviewModal_called");
        return {
          log,
          openedPhase: opened?.phase || "",
          sinceNotifyClickMs: opened?.sinceNotifyClickMs,
          usedFallbackOnly: opened?.phase === "init_complete_fallback",
        };
      });
      if (reviewTiming.sinceNotifyClickMs == null || reviewTiming.sinceNotifyClickMs > 1000) {
        errors.push(
          `${profileId}: review modal too slow from notify (${role}) ${JSON.stringify(reviewTiming)}`
        );
      }
      if (reviewTiming.usedFallbackOnly) {
        errors.push(
          `${profileId}: review modal opened only on init_complete_fallback (${role})`
        );
      }
      const inChatReview = await page.evaluate(() => {
        const bar = document.getElementById("chatPostCompleteBar");
        const reviewBtn = document.getElementById("chatReviewBarBtn");
        return {
          prompt: Boolean(document.querySelector("[data-platform-job-review-prompt]")),
          barBtn: Boolean(
            bar && !bar.hidden && reviewBtn && !reviewBtn.hidden
          ),
          modalOpen: Boolean(
            document.getElementById("chatReviewModal") &&
              !document.getElementById("chatReviewModal").hidden
          ),
        };
      });
      if (inChatReview.prompt || inChatReview.barBtn) {
        errors.push(
          `${profileId}: inline review UI visible when opened from notify (${role}) ${JSON.stringify(inChatReview)}`
        );
      }
      if (!inChatReview.modalOpen) {
        errors.push(`${profileId}: review modal not open from notify (${role})`);
      }
    }
  } finally {
    await page.close();
  }
  return errors;
}

const browser = await launchHeadlessBrowser();
const allErrors = [];
for (const profileId of ["business"]) {
  const errs = await verifyProfile(browser, profileId);
  allErrors.push(...errs);
}
await browser.close();

if (allErrors.length) {
  console.error("FAIL\n" + allErrors.map((e) => `- ${e}`).join("\n"));
  process.exit(1);
}
console.log("OK business/worker connect flow checks passed");
