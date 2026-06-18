#!/usr/bin/env node
/**
 * skill Connectあり — B納品確認後に completed + 取引完了カード + レビュー通知
 */
import { launchHeadlessBrowser } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const THREAD_ID = "chat-demo-skill-deal-001";
const SELLER_ID = "u_sachi";
const BUYER_ID = "u_hiro";
const LISTING_ID = "demo-skill-001";

const browser = await launchHeadlessBrowser();
const page = await browser.newPage();
const errors = [];

function chatUrl(userId) {
  const u = new URL(`${BASE}/chat-detail.html`);
  u.searchParams.set("thread", THREAD_ID);
  u.searchParams.set("userId", userId);
  u.searchParams.set("listingId", LISTING_ID);
  u.searchParams.set("demoProfile", "skill");
  u.searchParams.set("demoConnect", "1");
  u.searchParams.set("platform_connect", "1");
  u.searchParams.set("connectEntryPayment", "1");
  u.searchParams.set("entryProfile", "skill");
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
      const now = new Date().toISOString();
      const threads = (store?.readAll?.() || []).filter((t) => String(t.id) !== threadId);
      threads.unshift({
        id: threadId,
        chatDomain: "work",
        threadKind: "listing_inquiry",
        listingId,
        listingType: "skill",
        listingTitle: "プロ品質の動画編集・ショート動画制作",
        category: "スキル",
        dealId: "skill_deal_demo_001",
        sellerId,
        sellerName: "さちこ",
        partnerUserId: sellerId,
        buyerId,
        buyerName: "ひろ",
        roomStatus: "completion_pending",
        status: "completion_pending",
        connectEntryPayment: true,
        connectEntryPaidAt: now,
        platformContactKind: "purchase",
        productShipped: true,
        productShippedAt: now,
        completionRequestedBy: sellerId,
        completionRequestedAt: now,
        completionDeliverySummary: "納品データをお送りしました",
        source: "chat-dual-window-demo",
        lastMessage: "納品完了を申請しました",
        createdAt: now,
        updatedAt: now,
      });
      store.writeAll(threads);

      const raw = localStorage.getItem(store.MESSAGES_KEY);
      const map = raw ? JSON.parse(raw) : {};
      map[threadId] = [
        {
          id: `msg-${threadId}-hello`,
          chatId: threadId,
          senderId: sellerId,
          senderName: "さちこ",
          text: "納品物をお送りします。",
          createdAt: now,
          kind: "text",
        },
      ];
      localStorage.setItem(store.MESSAGES_KEY, JSON.stringify(map));

      const notifyKey = "tasful_talk_notifications";
      const notifies = JSON.parse(localStorage.getItem(notifyKey) || "[]").filter(
        (n) => String(n.threadId) !== threadId
      );
      localStorage.setItem(notifyKey, JSON.stringify(notifies));
    },
    { threadId: THREAD_ID, sellerId: SELLER_ID, buyerId: BUYER_ID, listingId: LISTING_ID }
  );

  const preApprove = await page.evaluate((threadId) => {
    const thread = window.TasuChatThreadStore.readAll().find((t) => String(t.id) === threadId);
    return {
      manualTransfer:
        window.TasuPlatformChatCompletionFlow.requiresManualTransferAfterApproval(thread),
      connectUi: window.TasuPlatformChatConnectChatFlow.shouldUseConnectCompletionUi(thread),
      usesReport: window.TasuPlatformChatCompletion?.usesCompletionReportDealFlow?.(
        thread?.dealId
      ),
    };
  }, THREAD_ID);

  if (preApprove.manualTransfer !== false) {
    errors.push(`skill connect still uses manual transfer after approval ${JSON.stringify(preApprove)}`);
  }
  if (preApprove.connectUi !== false) {
    errors.push(`skill connect still uses connect completion UI ${JSON.stringify(preApprove)}`);
  }
  if (preApprove.usesReport === true) {
    errors.push(`skill connect still uses completion report deal flow`);
  }

  await page.goto(chatUrl(BUYER_ID), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => document.body.dataset.chatDetailReady === "true", {
    timeout: 30000,
  });

  const approveBtn = page.locator("#chatCompleteBtn[data-primary-action='approve']");
  if ((await approveBtn.count()) < 1) {
    errors.push("B approve button not visible");
  } else {
    const btnLabel = await approveBtn.innerText();
    if (!/納品を確認/.test(btnLabel)) {
      errors.push(`B button label expected 納品を確認 got: ${btnLabel}`);
    }
    await approveBtn.click();
    await page.waitForFunction(
      (threadId) => {
        const thread = window.TasuChatThreadStore.readAll().find((t) => String(t.id) === threadId);
        return pickStr(thread?.roomStatus, thread?.status) === "completed";
        function pickStr(...vals) {
          for (const v of vals) {
            const s = String(v ?? "").trim();
            if (s) return s;
          }
          return "";
        }
      },
      THREAD_ID,
      { timeout: 10000 }
    );
  }

  const after = await page.evaluate(({ threadId, sellerId, buyerId }) => {
    const thread = window.TasuChatThreadStore.readAll().find((t) => String(t.id) === threadId);
    const msgs = window.TasuChatThreadStore.getMessages(threadId) || [];
    const notifies = window.TasuTalkNotifications?.getAll?.() || [];
    const reviewNotifies = notifies.filter(
      (n) =>
        String(n.threadId) === threadId &&
        /取引が完了|レビュー/.test(String(n.title || "") + String(n.actionLabel || ""))
    );
    const sellerReview = reviewNotifies.some((n) => String(n.recipientUserId) === sellerId);
    const buyerReview = reviewNotifies.some((n) => String(n.recipientUserId) === buyerId);
    return {
      roomStatus: thread?.roomStatus || thread?.status || "",
      completionCards: msgs.filter((m) => m.kind === "platform_completion_card").length,
      completionReports: msgs.filter((m) => m.kind === "completion_report").length,
      connectPendingCards: msgs.filter((m) => m.kind === "connect_completion_pending_card").length,
      manualTransferCards: msgs.filter((m) => m.kind === "manual_transfer_deposit_confirm_card").length,
      reviewNotifyCount: reviewNotifies.length,
      sellerReview,
      buyerReview,
      lifecycle: window.TasuChatRoomStatus?.resolveRoomLifecycleStatus?.(thread),
      canSend: window.TasuChatRoomStatus?.getLifecycleUi?.(
        window.TasuChatRoomStatus?.resolveRoomLifecycleStatus?.(thread)
      )?.canSend,
    };
  }, { threadId: THREAD_ID, sellerId: SELLER_ID, buyerId: BUYER_ID });

  if (after.roomStatus !== "completed") {
    errors.push(`roomStatus not completed: ${JSON.stringify(after)}`);
  }
  if (after.lifecycle !== "completed") {
    errors.push(`lifecycle not completed: ${JSON.stringify(after)}`);
  }
  if (after.canSend !== false) {
    errors.push(`composer still can send after completion: ${JSON.stringify(after)}`);
  }
  if (after.completionCards < 1) {
    errors.push(`platform_completion_card missing: ${JSON.stringify(after)}`);
  }
  if (after.completionReports > 0) {
    errors.push(`completion_report card present: ${JSON.stringify(after)}`);
  }
  if (after.manualTransferCards > 0) {
    errors.push(`manual transfer card present: ${JSON.stringify(after)}`);
  }
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
console.log("OK skill connect completion flow");
