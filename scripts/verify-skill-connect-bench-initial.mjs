#!/usr/bin/env node
/**
 * skill Connectあり — ベンチ初期状態
 * - 完了報告カードなし
 * - B決済前にチャット未開始
 * - Aへ購入通知なし（決済前）
 */
import { launchHeadlessBrowser } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const THREAD_ID = "chat-demo-skill-deal-001";
const SELLER_ID = "u_sachi";
const BUYER_ID = "u_hiro";

function benchUrl() {
  const u = new URL(`${BASE}/chat-dual-window-demo.html`);
  u.searchParams.set("talkDev", "1");
  u.searchParams.set("review", "chat-demo");
  u.searchParams.set("demoProfile", "skill");
  u.searchParams.set("demoConnect", "1");
  u.searchParams.set("liveFlow", "1");
  u.searchParams.set("liveFlowReset", "1");
  u.searchParams.set("benchViewport", "390");
  u.searchParams.set("benchPattern", "skill-1");
  return u.toString();
}

const browser = await launchHeadlessBrowser();
const page = await browser.newPage();
const errors = [];

try {
  await page.goto(benchUrl(), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(
    () => window.TasuPlatformChatLiveFlow?.resetLiveFlow && window.TasuChatThreadStore?.readAll,
    { timeout: 30000 }
  );
  await page.waitForSelector("#frame-a-chat[src], #frame-b-chat[src]", { timeout: 30000 });
  await page.waitForTimeout(1200);

  const frames = await page.evaluate(() => {
    const aChat = document.getElementById("frame-a-chat")?.src || "";
    const bChat = document.getElementById("frame-b-chat")?.src || "";
    let pendingContacts = 0;
    try {
      const raw = localStorage.getItem("tasful_listing_contact_requests_v1");
      const list = raw ? JSON.parse(raw) : [];
      pendingContacts = (Array.isArray(list) ? list : []).filter(
        (r) => String(r.listing_id) === "demo-skill-001"
      ).length;
    } catch {
      pendingContacts = -1;
    }
    return { aChat, bChat, pendingContacts };
  });

  if (/detail-skill\.html/i.test(frames.aChat)) {
    errors.push(`A chat frame shows skill detail preview: ${frames.aChat}`);
  }
  if (!/platform-chat-bench-seller-idle\.html/i.test(frames.aChat)) {
    errors.push(`A chat frame should be seller idle: ${frames.aChat}`);
  }
  if (!/detail-skill\.html/i.test(frames.bChat)) {
    errors.push(`B chat frame should be skill detail: ${frames.bChat}`);
  }
  if (frames.pendingContacts > 0) {
    errors.push(`pre-seeded contact requests count=${frames.pendingContacts}`);
  }

  const bFrame = page.frameLocator("#frame-b-chat");
  await bFrame.locator("body[data-listing-loaded='true']").waitFor({ state: "attached", timeout: 30000 });
  await bFrame
    .locator("[data-listing-primary-cta], .skill-cta-panel__primary")
    .first()
    .waitFor({ state: "visible", timeout: 20000 });
  const ctaText = await bFrame
    .locator("[data-listing-primary-cta], .skill-cta-panel__primary")
    .first()
    .innerText();
  if (/送信済み/i.test(ctaText)) {
    errors.push(`B primary CTA already submitted: ${ctaText}`);
  }

  const clickResult = await page.evaluate(() => {
    const frame = document.getElementById("frame-b-chat");
    const win = frame?.contentWindow;
    const doc = frame?.contentDocument;
    const btn = doc?.querySelector("[data-listing-primary-cta], .skill-cta-panel__primary");
    if (!btn || !win) return { ok: false, reason: "missing_button" };
    const listing = win.__tasuDetailContactListing || win.TasuContactActions?.mountForListing;
    const usesEntry = win.TasuPlatformChatConnectEntryFlow?.usesConnectEntryPayment?.(
      win.__tasuDetailContactListing
    );
    const result = win.TasuContactActions?.startContact?.(btn);
    return {
      ok: Boolean(result?.ok),
      reason: result?.reason || "",
      payUrl: result?.payUrl || "",
      usesEntry: usesEntry === true,
      hasListing: Boolean(win.__tasuDetailContactListing),
    };
  });
  if (!clickResult.ok) {
    errors.push(
      `B CTA startContact failed usesEntry=${clickResult.usesEntry} hasListing=${clickResult.hasListing} reason=${clickResult.reason || "unknown"}`
    );
  } else if (!clickResult.payUrl) {
    errors.push(`B CTA startContact ok but missing payUrl ${JSON.stringify(clickResult)}`);
  }
  await page.waitForTimeout(1500);
  await page.waitForFunction(
    () => /platform-chat-fee-pay\.html/i.test(document.getElementById("frame-b-chat")?.src || ""),
    { timeout: 8000 }
  ).catch(() => {
    errors.push(
      `B frame did not navigate to connect entry pay after CTA ${JSON.stringify(clickResult)}`
    );
  });

  const afterClick = await page.evaluate(() => {
    const bChat = document.getElementById("frame-b-chat")?.src || "";
    let pendingContacts = 0;
    let feePhase = "";
    try {
      const raw = localStorage.getItem("tasful_listing_contact_requests_v1");
      const list = raw ? JSON.parse(raw) : [];
      pendingContacts = (Array.isArray(list) ? list : []).filter(
        (r) => String(r.listing_id) === "demo-skill-001"
      ).length;
      const fees = JSON.parse(localStorage.getItem("tasful_platform_chat_fees_v1") || "[]");
      const fee = (Array.isArray(fees) ? fees : []).find((f) =>
        /demo-skill-001|contact/i.test(JSON.stringify(f))
      );
      feePhase = fee?.feePhase || fee?.connectMode || "";
    } catch {
      /* ignore */
    }
    return { bChat, pendingContacts, feePhase };
  });

  if (!/platform-chat-fee-pay\.html/i.test(afterClick.bChat)) {
    errors.push(`B CTA did not open connect entry pay url: ${afterClick.bChat}`);
  }
  if (!/phase=connect_entry/i.test(afterClick.bChat)) {
    errors.push(`B pay url missing phase=connect_entry: ${afterClick.bChat}`);
  }
  if (afterClick.pendingContacts < 1) {
    errors.push(`contact not created after B CTA click`);
  }

  const audit = await page.evaluate(({ threadId, sellerId, buyerId }) => {
    const Completion = window.TasuPlatformChatCompletion;
    const store = window.TasuChatThreadStore;
    const msgs =
      JSON.parse(localStorage.getItem(store?.MESSAGES_KEY || "") || "{}")[threadId] || [];
    const thread = (store?.readAll?.() || []).find((t) => String(t.id) === threadId) || null;
    const usesReport = Completion?.usesCompletionReportDealFlow?.("skill_deal_demo_001");
    const notifies = (window.TasuTalkNotifications?.getAll?.() || []).filter((n) =>
      /購入|スキルが購入/.test(String(n.title || ""))
    );
    const sellerPurchaseNotify = notifies.filter(
      (n) => String(n.recipientUserId) === String(sellerId)
    );
    const completionCards = msgs.filter((m) => m.kind === "completion_report");
    const approveText = msgs.some((m) =>
      /承認する|差し戻す|完了報告/.test(String(m.text || "") + JSON.stringify(m.completionReport || {}))
    );
    return {
      usesReport,
      hasThread: Boolean(thread),
      roomStatus: thread?.roomStatus || thread?.status || "",
      dealIdOnThread: thread?.dealId || "",
      completionCards: completionCards.length,
      approveText,
      sellerPurchaseNotifyCount: sellerPurchaseNotify.length,
      messageKinds: msgs.map((m) => m.kind),
      isWorkService: window.TasuPlatformChatWorkServiceConnectFlow?.isWorkServiceConnectThread?.(
        thread || { id: threadId, listingType: "skill", dealId: "skill_deal_demo_001" }
      ),
    };
  }, { threadId: THREAD_ID, sellerId: SELLER_ID, buyerId: BUYER_ID });

  if (audit.usesReport !== false) {
    errors.push(`skill still uses completion report deal flow`);
  }
  if (audit.isWorkService === true) {
    errors.push(`skill thread treated as work service connect`);
  }
  if (audit.completionCards > 0 || audit.approveText) {
    errors.push(`completion_report in seed messages ${JSON.stringify(audit)}`);
  }
  if (audit.hasThread && audit.roomStatus === "active") {
    errors.push(`chat active before B connect payment ${JSON.stringify(audit)}`);
  }
  if (audit.sellerPurchaseNotifyCount > 0) {
    errors.push(`seller purchase notify before B payment count=${audit.sellerPurchaseNotifyCount}`);
  }
  const sellerNotifyAfterCta = await page.evaluate((sellerId) => {
    return (window.TasuTalkNotifications?.getAll?.() || []).filter(
      (n) =>
        String(n.recipientUserId) === String(sellerId) &&
        /購入|スキルが購入/.test(String(n.title || ""))
    ).length;
  }, SELLER_ID);
  if (sellerNotifyAfterCta > 0) {
    errors.push(`seller purchase notify before payment after CTA count=${sellerNotifyAfterCta}`);
  }
  if (audit.dealIdOnThread && audit.hasThread) {
    errors.push(`pre-payment thread still has dealId ${audit.dealIdOnThread}`);
  }

  const chatDetailUrl = new URL(`${BASE}/chat-detail.html`);
  chatDetailUrl.searchParams.set("thread", THREAD_ID);
  chatDetailUrl.searchParams.set("userId", BUYER_ID);
  chatDetailUrl.searchParams.set("listingId", "demo-skill-001");
  chatDetailUrl.searchParams.set("demoProfile", "skill");
  chatDetailUrl.searchParams.set("demoConnect", "1");
  chatDetailUrl.searchParams.set("platform_connect", "1");
  chatDetailUrl.searchParams.set("liveFlow", "1");
  chatDetailUrl.searchParams.set("review", "chat-demo");
  chatDetailUrl.searchParams.set("from", "talk");
  await page.goto(chatDetailUrl.toString(), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(
    () => window.TasuChatRoomStatus?.resolveRoomLifecycleStatus && window.TasuPlatformChatFee?.requiresConversationStartFee,
    { timeout: 20000 }
  );

  const feeGate = await page.evaluate(() => {
    const thread = {
      id: "chat-demo-skill-deal-001",
      listingId: "demo-skill-001",
      listingType: "skill",
      dealId: "skill_deal_demo_001",
      connectEntryPayment: true,
      roomStatus: "fee_pending",
      status: "fee_pending",
      platformStartPhase: "awaiting_partner",
    };
    const Fee = window.TasuPlatformChatFee;
    const Room = window.TasuChatRoomStatus;
    const StartFee = window.TasuPlatformChatStartFeeCard;
    const lifecycle = Room?.resolveRoomLifecycleStatus?.(thread);
    const ui = Room?.getLifecycleUi?.(lifecycle);
    const noticeEl = document.getElementById("chatRoomStatusNotice");
    const input = document.getElementById("chatInput");
    return {
      requiresFee: Fee?.requiresConversationStartFee?.(thread),
      lifecycle,
      canSend: ui?.canSend,
      notice: ui?.noticeMessage || "",
      awaitingStartFee: StartFee?.isAwaitingStartFee?.(thread),
      noticeVisible: noticeEl ? !noticeEl.hidden : null,
      noticeText: noticeEl?.textContent || "",
      inputDisabled: input?.disabled,
      inputPlaceholder: input?.placeholder || "",
    };
  });

  if (feeGate.requiresFee !== false) {
    errors.push(`connect skill thread still requires conversation fee ${JSON.stringify(feeGate)}`);
  }
  if (feeGate.lifecycle === "fee_pending") {
    errors.push(`connect skill lifecycle still fee_pending ${JSON.stringify(feeGate)}`);
  }
  if (feeGate.canSend !== true) {
    errors.push(`connect skill composer blocked ${JSON.stringify(feeGate)}`);
  }
  if (/やりとり開始料/.test(feeGate.notice + feeGate.noticeText + feeGate.inputPlaceholder)) {
    errors.push(`connect skill shows start-fee copy ${JSON.stringify(feeGate)}`);
  }
  if (feeGate.awaitingStartFee === true) {
    errors.push(`connect skill awaiting start fee card ${JSON.stringify(feeGate)}`);
  }
} finally {
  await page.close();
  await browser.close();
}

if (errors.length) {
  console.error("FAIL\n" + errors.map((e) => `- ${e}`).join("\n"));
  process.exit(1);
}
console.log("OK skill connect bench initial state");
