#!/usr/bin/env node
/**
 * product Connectあり — 発送→受取後 completed + 取引完了カード + レビュー通知
 */
import { launchHeadlessBrowser } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const THREAD_ID = "chat-demo-product-deal-001";
const SELLER_ID = "u_product";
const BUYER_ID = "u_hiro";
const LISTING_ID = "demo-product-001";

const browser = await launchHeadlessBrowser();
const page = await browser.newPage();
const errors = [];

function chatUrl(userId) {
  const u = new URL(`${BASE}/chat-detail.html`);
  u.searchParams.set("thread", THREAD_ID);
  u.searchParams.set("userId", userId);
  u.searchParams.set("listingId", LISTING_ID);
  u.searchParams.set("demoProfile", "product");
  u.searchParams.set("demoConnect", "1");
  u.searchParams.set("platform_connect", "1");
  u.searchParams.set("connectEntryPayment", "1");
  u.searchParams.set("entryProfile", "product");
  u.searchParams.set("liveFlow", "1");
  u.searchParams.set("review", "chat-demo");
  u.searchParams.set("talkDev", "1");
  u.searchParams.set("from", "talk");
  return u.toString();
}

try {
  await page.goto(chatUrl(SELLER_ID), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(
    () => window.TasuPlatformChatCompletionFlow?.approveCompletion && window.TasuChatThreadStore?.readAll,
    { timeout: 30000 }
  );

  await page.evaluate(
    ({ threadId, sellerId, buyerId, listingId }) => {
      const store = window.TasuChatThreadStore;
      const Purchase = window.TasuPlatformChatPurchasePaymentFlow;
      const now = new Date().toISOString();
      const threads = (store?.readAll?.() || []).filter((t) => String(t.id) !== threadId);
      const thread = {
        id: threadId,
        chatDomain: "work",
        threadKind: "listing_inquiry",
        listingId,
        listingType: "product",
        listingTitle: "プレミアム家電セット 2026",
        category: "商品",
        sellerId,
        sellerName: "premium_home",
        partnerUserId: sellerId,
        buyerId,
        buyerName: "ひろ",
        roomStatus: "completion_pending",
        status: "completion_pending",
        connectEntryPayment: true,
        connectEntryPaidAt: now,
        platformContactKind: "purchase",
        paymentMethod: "prepaid",
        paymentConfirmed: true,
        paymentConfirmedAt: now,
        productShipped: true,
        productShippedAt: now,
        completionRequestedBy: sellerId,
        completionRequestedAt: now,
        source: "chat-dual-window-demo",
        lastMessage: "商品を発送しました",
        createdAt: now,
        updatedAt: now,
      };
      Object.assign(thread, Purchase?.createInitialPurchaseThreadFields?.("prepaid") || {});
      thread.productShipped = true;
      thread.productShippedAt = now;
      threads.unshift(thread);
      store.writeAll(threads);
      const raw = localStorage.getItem(store.MESSAGES_KEY);
      const map = raw ? JSON.parse(raw) : {};
      map[threadId] = [
        {
          id: `msg-${threadId}-ship`,
          chatId: threadId,
          senderId: sellerId,
          senderName: "premium_home",
          text: "商品を発送しました。",
          createdAt: now,
          kind: "text",
        },
      ];
      localStorage.setItem(store.MESSAGES_KEY, JSON.stringify(map));
    },
    { threadId: THREAD_ID, sellerId: SELLER_ID, buyerId: BUYER_ID, listingId: LISTING_ID }
  );

  await page.goto(chatUrl(BUYER_ID), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => document.body.dataset.chatDetailReady === "true", {
    timeout: 30000,
  });

  const approveBtn = page.locator("#chatCompleteBtn[data-primary-action='approve']");
  if ((await approveBtn.count()) < 1) {
    errors.push("B receive confirm button not visible");
  } else {
    const btnLabel = await approveBtn.innerText();
    if (!/受取確認/.test(btnLabel)) {
      errors.push(`B button label expected 受取確認 got: ${btnLabel}`);
    }
    await approveBtn.click();
  }
  await page.waitForFunction(
    (threadId) => {
      const thread = window.TasuChatThreadStore.readAll().find((t) => String(t.id) === threadId);
      const rs = String(thread?.roomStatus || thread?.status || "").toLowerCase();
      return rs === "completed";
    },
    THREAD_ID,
    { timeout: 10000 }
  );

  const after = await page.evaluate(
    ({ threadId, sellerId, buyerId }) => {
      const thread = window.TasuChatThreadStore.readAll().find((t) => String(t.id) === threadId);
      const msgs = window.TasuChatThreadStore.getMessages(threadId) || [];
      const notifies = window.TasuTalkNotifications?.getAll?.() || [];
      const reviewNotifies = notifies.filter(
        (n) =>
          String(n.threadId) === threadId &&
          /取引が完了|レビュー/.test(String(n.title || "") + String(n.actionLabel || ""))
      );
      return {
        roomStatus: thread?.roomStatus || thread?.status || "",
        completionCards: msgs.filter((m) => m.kind === "platform_completion_card").length,
        completionReports: msgs.filter((m) => m.kind === "completion_report").length,
        sellerReview: reviewNotifies.some((n) => String(n.recipientUserId) === sellerId),
        buyerReview: reviewNotifies.some((n) => String(n.recipientUserId) === buyerId),
        lifecycle: window.TasuChatRoomStatus?.resolveRoomLifecycleStatus?.(thread),
        canSend: window.TasuChatRoomStatus?.getLifecycleUi?.(
          window.TasuChatRoomStatus?.resolveRoomLifecycleStatus?.(thread)
        )?.canSend,
        showReview: window.TasuPlatformChatCategoryFlow?.shouldShowReviewPrompt?.(
          thread,
          buyerId
        ),
        canShowReview: window.TasuPlatformChatReviewFlow?.canShowReviewForRoom?.(
          thread,
          buyerId
        ),
        reviewCardHtml:
          window.TasuPlatformChatCategoryFlow?.renderPlatformCompletionCardHtml?.(
            (window.TasuChatThreadStore.getMessages(threadId) || []).find(
              (m) => m.kind === "platform_completion_card"
            ),
            thread,
            buyerId
          ) || "",
      };
    },
    { threadId: THREAD_ID, sellerId: SELLER_ID, buyerId: BUYER_ID }
  );

  if (after.showReview !== false) {
    errors.push(`chat review prompt should be notify-only: ${JSON.stringify(after)}`);
  }
  if (/レビューを書く|レビューする/.test(after.reviewCardHtml)) {
    errors.push(`completion card must not duplicate review CTA: ${JSON.stringify(after)}`);
  }
  if (after.canShowReview !== true) {
    errors.push(`review modal should be eligible from notify: ${JSON.stringify(after)}`);
  }

  if (after.roomStatus !== "completed") errors.push(`roomStatus not completed: ${JSON.stringify(after)}`);
  if (after.lifecycle !== "completed") errors.push(`lifecycle not completed: ${JSON.stringify(after)}`);
  if (after.canSend !== false) errors.push(`composer still can send: ${JSON.stringify(after)}`);
  if (after.completionCards < 1) errors.push(`platform_completion_card missing: ${JSON.stringify(after)}`);
  if (after.completionReports > 0) errors.push(`completion_report present: ${JSON.stringify(after)}`);
  if (!after.sellerReview || !after.buyerReview) {
    errors.push(`review notify missing for A/B: ${JSON.stringify(after)}`);
  }
} finally {
  await page.close();
  await browser.close();
}

if (errors.length) {
  console.error("FAIL\n" + errors.map((e) => `- ${e}`).join("\n"));
  process.exit(1);
}
console.log("OK product connect completion flow");
