#!/usr/bin/env node
/**
 * shop / Connectあり — 完了後手数料 → レビュー通知・openReview 自動表示
 */
import { launchHeadlessBrowser } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const PAUSE = 300;

function benchUrl() {
  const u = new URL(`${BASE}/chat-dual-window-demo.html`);
  u.searchParams.set("talkDev", "1");
  u.searchParams.set("review", "chat-demo");
  u.searchParams.set("demoProfile", "shop");
  u.searchParams.set("demoConnect", "1");
  u.searchParams.set("liveFlow", "1");
  u.searchParams.set("userId", "u_hiro");
  u.searchParams.set("benchViewport", "390");
  u.searchParams.set("benchPattern", "shop-1");
  u.searchParams.set("liveFlowReset", "1");
  return u.toString();
}

async function bootstrap(page) {
  return page.evaluate(() => {
    const Demo = window.TasuPlatformChatDualWindowDemo;
    const Live = window.TasuPlatformChatLiveFlow;
    const Contacts = window.TasuListingContactRequestsStore;
    const profile = Demo?.getProfile?.("shop", true);
    if (!profile) return { ok: false, reason: "no_profile" };
    Live?.resetLiveFlow?.({ profile: "shop", connect: true });
    Demo?.seedPreStartDemoState?.(profile);
    const listing =
      Contacts?.resolveListing?.(profile.listingId) || {
        id: profile.listingId,
        listing_type: profile.listingType,
        listingType: profile.listingType,
        title: profile.listingTitle,
      };
    let contact = Live?.readBenchPreStartRecord?.(profile);
    if (!contact) {
      const submitted = Contacts?.submitContact?.(listing, {
        intent: "purchase",
        productId: "0",
        productName: profile.listingTitle,
      });
      if (!submitted?.ok && submitted?.reason !== "already_submitted") {
        return { ok: false, reason: submitted?.reason || "submit_failed" };
      }
      contact = submitted?.contact || Live?.readBenchPreStartRecord?.(profile);
    }
    if (!contact?.contact_id) return { ok: false, reason: "no_contact" };
    const activated = Contacts?.beginContactChat?.(profile.listingId, contact.contact_id);
    if (!activated?.ok) return { ok: false, reason: activated?.reason || "activate_failed" };
    const threadId = String(activated.threadId || activated.contact?.thread_id || "");
    if (!threadId) return { ok: false, reason: "no_thread" };
    return { ok: true, threadId, sellerId: profile.partnerAId, buyerId: profile.partnerBId };
  });
}

async function runAction(page, threadId, action, sellerId, buyerId) {
  return page.evaluate(
    ({ threadId, action, sellerId, buyerId }) => {
      const thread = (window.TasuChatThreadStore?.readAll?.() || []).find((t) => String(t.id) === String(threadId));
      const Purchase = window.TasuPlatformChatPurchasePaymentFlow;
      const Completion = window.TasuPlatformChatCompletionFlow;
      const map = {
        ship: () => Completion?.markProductShipped?.({ threadId, thread, userId: sellerId }),
        receive: () => Purchase?.markProductReceived?.({ threadId, thread, userId: buyerId }),
      };
      return map[action]?.() || { ok: false };
    },
    { threadId, action, sellerId, buyerId }
  );
}

async function payCompletionFee(page, threadId, sellerId) {
  return page.evaluate(
    ({ threadId, sellerId }) => {
      const Fee = window.TasuPlatformChatFee;
      const res = Fee?.completeCompletionFeePayment?.(threadId, {
        listingId: "demo-shop-reworks",
        category: "shop_store",
      });
      window.TasuPlatformChatDualWindowNotify?.notifyDemoPurchaseCompletionFeePaid?.({
        threadId,
        thread: (window.TasuChatThreadStore?.readAll?.() || []).find((t) => String(t.id) === String(threadId)),
        sellerId,
      });
      return { ok: res?.ok === true, feePaid: Fee?.isFeePaid?.(threadId) };
    },
    { threadId, sellerId }
  );
}

function findNotify(rows, { recipientUserId, threadId, titleRe, ctaRe, requireOpenReview, forbidOpenReview }) {
  const hit = rows.find((n) => {
    if (String(n.recipientUserId) !== String(recipientUserId)) return false;
    if (threadId && String(n.threadId) !== String(threadId)) return false;
    const title = String(n.title || "");
    const cta = String(n.actionLabel || "");
    const href = String(n.href || n.targetUrl || "");
    if (titleRe && !titleRe.test(title)) return false;
    if (ctaRe && !ctaRe.test(cta)) return false;
    if (requireOpenReview && !/openReview=1/.test(href)) return false;
    if (forbidOpenReview && /openReview=1/.test(href)) return false;
    return true;
  });
  return hit ? String(hit.href || hit.targetUrl || "") : "";
}

async function mountChat(page, href, frameId) {
  const abs = href.startsWith("http") ? href : new URL(href, BASE).toString();
  await page.evaluate(({ href, frameId }) => {
    const frame = document.getElementById(frameId);
    if (frame) frame.src = href;
  }, { href: abs, frameId });
  await page
    .waitForFunction(
      (id) => {
        const w = document.getElementById(id)?.contentWindow;
        return (
          w?.__tasuChatDetailLoadDiag?.chatDetailLoadOk === true ||
          w?.document?.body?.dataset?.chatDetailReady === "true"
        );
      },
      frameId,
      { timeout: 15000 }
    )
    .catch(() => null);
  await page.waitForTimeout(1200);
}

async function readReviewState(page, frameId) {
  return page.evaluate((frameId) => {
    const win = document.getElementById(frameId)?.contentWindow;
    const doc = win?.document;
    const params = new URLSearchParams(win?.location?.search || "");
    const threadId = params.get("thread");
    const thread =
      win?.currentRoom ||
      (win?.TasuChatThreadStore?.readAll?.() || []).find((t) => String(t.id) === String(threadId));
    const userId = params.get("userId");
    return {
      href: win?.location?.href || "",
      openReview: params.get("openReview") || "",
      demoState: params.get("demoState") || "",
      threadFound: Boolean(thread),
      completed: Boolean(thread?.completed),
      applies: win?.TasuPlatformChatPurchasePaymentFlow?.appliesToThread?.(thread),
      ready: win?.TasuPlatformChatPurchasePaymentFlow?.isReadyForReview?.(thread, userId),
      modalVisible: doc?.getElementById("chatReviewModal")?.hidden === false,
      shouldAutoOpen: win?.TasuPlatformChatReviewFlow?.shouldAutoOpenReviewFromContext?.(
        params,
        thread,
        userId
      ),
      isRoomCompletedForReview: win?.TasuPlatformChatReviewFlow?.isRoomCompletedForReview?.(
        thread,
        userId
      ),
      canShowReview: win?.TasuPlatformChatReviewFlow?.canShowReviewForRoom?.(thread, userId),
      alreadyReviewed:
        win?.TasuPlatformChatReviewFlow?.hasUserSubmittedReviewForRoom?.(thread, userId),
      isJob: win?.TasuPlatformChatJobFlow?.isJobThread?.(thread),
      roomStatus: String(thread?.roomStatus || thread?.status || ""),
      reviewFnLength: win?.TasuPlatformChatReviewFlow?.isRoomCompletedForReview?.length,
    };
  }, frameId);
}

const browser = await launchHeadlessBrowser();
const page = await browser.newPage();
const errors = [];

try {
  await page.goto(benchUrl(), { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(800);
  const boot = await bootstrap(page);
  if (!boot.ok) throw new Error(boot.reason || "bootstrap_failed");
  const { threadId, sellerId, buyerId } = boot;

  await runAction(page, threadId, "ship", sellerId, buyerId);
  await page.waitForTimeout(PAUSE);
  await runAction(page, threadId, "receive", sellerId, buyerId);
  await page.waitForTimeout(PAUSE);

  const afterComplete = await page.evaluate(
    ({ threadId, sellerId, buyerId }) => {
      const thread = (window.TasuChatThreadStore?.readAll?.() || []).find((t) => String(t.id) === String(threadId));
      const rows = window.TasuTalkNotifications?.getAll?.() || [];
      const Purchase = window.TasuPlatformChatPurchasePaymentFlow;
      const fee = Purchase?.getPurchaseCompletionFeeState?.(thread);
      return {
        completed: thread?.completed === true,
        roomStatus: String(thread?.roomStatus || ""),
        feePending: fee?.pending === true,
        feePaid: fee?.paid === true,
        sellerFeeNotify: rows.some(
          (n) =>
            String(n.recipientUserId) === sellerId &&
            /手数料/.test(String(n.title)) &&
            /手数料を支払う/.test(String(n.actionLabel)) &&
            !/openReview=1/.test(String(n.href || n.targetUrl || "")) &&
            /platform-chat-fee-pay\.html/.test(String(n.href || n.targetUrl || ""))
        ),
        sellerReviewTooEarly: rows.some(
          (n) =>
            String(n.recipientUserId) === sellerId &&
            /レビュー/.test(String(n.actionLabel)) &&
            /完了/.test(String(n.title))
        ),
        buyerReviewNotify: rows.some(
          (n) =>
            String(n.recipientUserId) === buyerId &&
            /レビュー/.test(String(n.actionLabel)) &&
            /openReview=1/.test(String(n.href || n.targetUrl || ""))
        ),
        buyerReady: Purchase?.isReadyForReview?.(thread, buyerId),
        sellerReadyBeforeFee: Purchase?.isReadyForReview?.(thread, sellerId),
      };
    },
    { threadId, sellerId, buyerId }
  );

  if (!afterComplete.completed) errors.push("thread_not_completed");
  if (!afterComplete.feePending) errors.push("fee_not_pending");
  if (!afterComplete.sellerFeeNotify) errors.push("seller_fee_notify_missing_or_wrong_href");
  if (afterComplete.sellerReviewTooEarly) errors.push("seller_review_notify_before_fee");
  if (!afterComplete.buyerReviewNotify) errors.push("buyer_review_notify_missing_openReview");
  if (!afterComplete.buyerReady) errors.push("buyer_not_ready_for_review");
  if (afterComplete.sellerReadyBeforeFee) errors.push("seller_ready_before_fee");

  const rows = await page.evaluate(() => window.TasuTalkNotifications?.getAll?.() || []);
  const buyerHref = findNotify(rows, {
    recipientUserId: buyerId,
    threadId,
    titleRe: /完了/,
    ctaRe: /レビュー/,
    requireOpenReview: true,
  });
  if (!buyerHref) errors.push("buyer_review_href_missing");

  await mountChat(page, buyerHref, "frame-b-chat");
  const buyerState = await readReviewState(page, "frame-b-chat");
  if (!/openReview=1/.test(buyerState.href) && !buyerState.modalVisible) {
    errors.push("buyer_chat_missing_openReview");
  }
  if (!buyerState.modalVisible && !buyerState.shouldAutoOpen) {
    errors.push(`buyer_review_not_opened:${JSON.stringify(buyerState)}`);
  }

  const feePay = await payCompletionFee(page, threadId, sellerId);
  if (!feePay.feePaid) errors.push("fee_not_marked_paid");

  const sellerHref = findNotify(
    await page.evaluate(() => window.TasuTalkNotifications?.getAll?.() || []),
    {
      recipientUserId: sellerId,
      threadId,
      titleRe: /完了/,
      ctaRe: /レビュー/,
      requireOpenReview: true,
    }
  );
  if (!sellerHref) errors.push("seller_review_href_missing_after_fee");

  await mountChat(page, sellerHref, "frame-a-chat");
  await page
    .waitForFunction(
      () => {
        const modal = document.getElementById("frame-a-chat")?.contentWindow?.document?.getElementById(
          "chatReviewModal"
        );
        return modal != null && modal.hidden === false;
      },
      { timeout: 6000 }
    )
    .catch(() => null);
  const sellerState = await readReviewState(page, "frame-a-chat");
  if (!/openReview=1/.test(sellerState.href) && !sellerState.modalVisible) {
    errors.push("seller_chat_missing_openReview");
  }
  if (!sellerState.modalVisible && !sellerState.shouldAutoOpen) {
    errors.push(`seller_review_not_opened:${JSON.stringify(sellerState)}`);
  }

  const feeNotifyHref = findNotify(
    await page.evaluate(() => window.TasuTalkNotifications?.getAll?.() || []),
    {
      recipientUserId: sellerId,
      threadId,
      titleRe: /手数料/,
      ctaRe: /手数料を支払う/,
      forbidOpenReview: true,
    }
  );
  if (feeNotifyHref && /openReview=1/.test(feeNotifyHref)) errors.push("fee_notify_has_openReview");

  console.log(JSON.stringify({ ok: errors.length === 0, errors, afterComplete, buyerState, sellerState }, null, 2));
  process.exit(errors.length === 0 ? 0 : 1);
} catch (err) {
  console.error(err);
  process.exit(1);
} finally {
  await browser.close();
}
