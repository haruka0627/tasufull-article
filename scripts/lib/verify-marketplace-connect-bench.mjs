/**
 * skill / product / worker Connectあり — ベンチ初期状態の共通検証
 */
import { launchHeadlessBrowser } from "./playwright-browser.mjs";
import { requireDevServer } from "./dev-base-url.mjs";

/** @type {Record<string, object>} */
export const MARKETPLACE_CONNECT_BENCH_PROFILES = {
  skill: {
    benchPattern: "skill-1",
    demoProfile: "skill",
    threadId: "chat-demo-skill-deal-001",
    sellerId: "u_sachi",
    buyerId: "u_hiro",
    listingId: "demo-skill-001",
    dealId: "skill_deal_demo_001",
    detailPage: "detail-skill.html",
    ctaSelector:
      "[data-tasu-mdetail-cta-dock] .tasu-mdetail-cta-dock__btn--primary, [data-listing-primary-cta], .skill-cta-panel__primary",
    notifyTitlePattern: /購入|スキルが購入/,
    workServiceListingType: "skill",
  },
  product: {
    benchPattern: "product-1",
    demoProfile: "product",
    threadId: "chat-demo-product-deal-001",
    sellerId: "u_product",
    buyerId: "u_hiro",
    listingId: "demo-product-001",
    dealId: "product_deal_demo_001",
    detailPage: "detail-product.html",
    ctaSelector:
      "[data-tasu-mdetail-cta-dock] .tasu-mdetail-cta-dock__btn--primary, [data-listing-primary-cta], .skill-cta-panel__primary",
    notifyTitlePattern: /購入|商品が購入/,
    workServiceListingType: "product",
  },
  worker: {
    benchPattern: "worker-1",
    demoProfile: "worker",
    threadId: "chat-demo-worker-deal-001",
    sellerId: "demo-worker-001",
    buyerId: "u_hiro",
    listingId: "demo-worker-001",
    dealId: "worker_deal_demo_001",
    detailPage: "detail-worker.html",
    ctaSelector:
      "[data-tasu-mdetail-cta-dock] .tasu-mdetail-cta-dock__btn--primary, [data-listing-primary-cta], .skill-cta-panel__primary",
    notifyTitlePattern: /依頼が届き|購入/,
    workServiceListingType: "worker",
  },
};

function benchUrl(cfg) {
  const u = new URL(`${cfg.base}/chat-dual-window-demo.html`);
  u.searchParams.set("talkDev", "1");
  u.searchParams.set("review", "chat-demo");
  u.searchParams.set("demoProfile", cfg.demoProfile);
  u.searchParams.set("demoConnect", "1");
  u.searchParams.set("liveFlow", "1");
  u.searchParams.set("liveFlowReset", "1");
  u.searchParams.set("benchViewport", "390");
  u.searchParams.set("benchPattern", cfg.benchPattern);
  return u.toString();
}

export async function verifyMarketplaceConnectBenchInitial(profileKey) {
  const profile = MARKETPLACE_CONNECT_BENCH_PROFILES[profileKey];
  if (!profile) throw new Error(`unknown profile: ${profileKey}`);

  const BASE = await requireDevServer();
  const cfg = { ...profile, base: BASE };
  const errors = [];

  const browser = await launchHeadlessBrowser();
  const page = await browser.newPage();

  try {
    await page.goto(benchUrl(cfg), { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(
      () => window.TasuPlatformChatLiveFlow?.resetLiveFlow && window.TasuChatThreadStore?.readAll,
      { timeout: 30000 }
    );
    await page.waitForSelector("#frame-a-chat[src], #frame-b-chat[src]", { timeout: 30000 });
    await page.waitForTimeout(1200);

    const frames = await page.evaluate(({ listingId, detailPage }) => {
      const aChat = document.getElementById("frame-a-chat")?.src || "";
      const bChat = document.getElementById("frame-b-chat")?.src || "";
      let pendingContacts = 0;
      try {
        const raw = localStorage.getItem("tasful_listing_contact_requests_v1");
        const list = raw ? JSON.parse(raw) : [];
        pendingContacts = (Array.isArray(list) ? list : []).filter(
          (r) => String(r.listing_id) === listingId
        ).length;
      } catch {
        pendingContacts = -1;
      }
      return { aChat, bChat, pendingContacts, detailPage };
    }, cfg);

    if (new RegExp(cfg.detailPage, "i").test(frames.aChat)) {
      errors.push(`A chat frame shows detail preview: ${frames.aChat}`);
    }
    if (!/platform-chat-bench-seller-idle\.html/i.test(frames.aChat)) {
      errors.push(`A chat frame should be seller idle: ${frames.aChat}`);
    }
    if (!new RegExp(cfg.detailPage, "i").test(frames.bChat)) {
      errors.push(`B chat frame should be detail page: ${frames.bChat}`);
    }
    if (frames.pendingContacts > 0) {
      errors.push(`pre-seeded contact requests count=${frames.pendingContacts}`);
    }

    const bFrame = page.frameLocator("#frame-b-chat");
    await bFrame.locator("body[data-listing-loaded='true']").waitFor({ state: "attached", timeout: 30000 });
    await bFrame
      .locator("body.tasu-mdetail-ready, body[data-listing-loaded='true']")
      .first()
      .waitFor({ state: "attached", timeout: 30000 });
    await page.waitForFunction(
      () => {
        const doc = document.getElementById("frame-b-chat")?.contentDocument;
        if (!doc) return false;
        const dock = doc.querySelector(
          "[data-tasu-mdetail-cta-dock] .tasu-mdetail-cta-dock__btn--primary"
        );
        if (dock) {
          const st = window.getComputedStyle(dock);
          if (st.display !== "none" && st.visibility !== "hidden") return true;
        }
        const hero = doc.querySelector("[data-listing-primary-cta]");
        if (hero) {
          const st = window.getComputedStyle(hero);
          if (st.display !== "none" && st.visibility !== "hidden") return true;
        }
        return false;
      },
      { timeout: 30000 }
    );
    const ctaText = await page.evaluate(() => {
      const doc = document.getElementById("frame-b-chat")?.contentDocument;
      const btn =
        doc?.querySelector("[data-tasu-mdetail-cta-dock] .tasu-mdetail-cta-dock__btn--primary") ||
        doc?.querySelector("[data-listing-primary-cta]");
      return btn?.textContent?.trim() || "";
    });
    if (/送信済み/i.test(ctaText)) {
      errors.push(`B primary CTA already submitted: ${ctaText}`);
    }

    const clickResult = await page.evaluate((ctaSelector) => {
      const frame = document.getElementById("frame-b-chat");
      const win = frame?.contentWindow;
      const doc = frame?.contentDocument;
      const btn =
        doc?.querySelector("[data-tasu-mdetail-cta-dock] .tasu-mdetail-cta-dock__btn--primary") ||
        doc?.querySelector(ctaSelector);
      if (!btn || !win) return { ok: false, reason: "missing_button" };
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
    }, cfg.ctaSelector);

    if (!clickResult.ok) {
      errors.push(
        `B CTA startContact failed usesEntry=${clickResult.usesEntry} hasListing=${clickResult.hasListing} reason=${clickResult.reason || "unknown"}`
      );
    } else if (!clickResult.payUrl) {
      errors.push(`B CTA startContact ok but missing payUrl ${JSON.stringify(clickResult)}`);
    }

    await page.waitForTimeout(1500);
    await page
      .waitForFunction(
        () => /platform-chat-fee-pay\.html/i.test(document.getElementById("frame-b-chat")?.src || ""),
        { timeout: 8000 }
      )
      .catch(() => {
        errors.push(`B frame did not navigate to connect entry pay after CTA ${JSON.stringify(clickResult)}`);
      });

    const afterClick = await page.evaluate(() => {
      const bChat = document.getElementById("frame-b-chat")?.src || "";
      return { bChat };
    });

    if (!/platform-chat-fee-pay\.html/i.test(afterClick.bChat)) {
      errors.push(`B CTA did not open connect entry pay url: ${afterClick.bChat}`);
    }
    if (!/phase=connect_entry/i.test(afterClick.bChat)) {
      errors.push(`B pay url missing phase=connect_entry: ${afterClick.bChat}`);
    }

    const audit = await page.evaluate(
      ({ threadId, sellerId, dealId, notifyTitlePattern, workServiceListingType }) => {
        const Completion = window.TasuPlatformChatCompletion;
        const store = window.TasuChatThreadStore;
        const msgs =
          JSON.parse(localStorage.getItem(store?.MESSAGES_KEY || "") || "{}")[threadId] || [];
        const thread = (store?.readAll?.() || []).find((t) => String(t.id) === threadId) || null;
        const notifyRe = new RegExp(notifyTitlePattern);
        const notifies = (window.TasuTalkNotifications?.getAll?.() || []).filter((n) =>
          notifyRe.test(String(n.title || ""))
        );
        const sellerPurchaseNotify = notifies.filter(
          (n) => String(n.recipientUserId) === String(sellerId)
        );
        const completionCards = msgs.filter((m) => m.kind === "completion_report");
        const approveText = msgs.some((m) =>
          /承認する|差し戻す|完了報告/.test(String(m.text || "") + JSON.stringify(m.completionReport || {}))
        );
        return {
          usesReport: Completion?.usesCompletionReportDealFlow?.(dealId),
          connectEntryPayment: thread?.connectEntryPayment === true,
          hasThread: Boolean(thread),
          roomStatus: thread?.roomStatus || thread?.status || "",
          dealIdOnThread: thread?.dealId || "",
          completionCards: completionCards.length,
          approveText,
          sellerPurchaseNotifyCount: sellerPurchaseNotify.length,
          isWorkService: thread
            ? window.TasuPlatformChatWorkServiceConnectFlow?.isWorkServiceConnectThread?.(thread)
            : false,
        };
      },
      {
        threadId: cfg.threadId,
        sellerId: cfg.sellerId,
        dealId: cfg.dealId,
        notifyTitlePattern: cfg.notifyTitlePattern.source,
        workServiceListingType: cfg.workServiceListingType,
      }
    );

    if (audit.hasThread && audit.usesReport === true && !audit.connectEntryPayment) {
      errors.push(`${profileKey} still uses completion report deal flow`);
    }
    if (audit.isWorkService === true) {
      errors.push(`${profileKey} thread treated as work service connect`);
    }
    if (audit.completionCards > 0 || audit.approveText) {
      errors.push(`completion_report in seed messages ${JSON.stringify(audit)}`);
    }
    if (audit.hasThread && audit.roomStatus === "active") {
      errors.push(`chat active before B connect payment ${JSON.stringify(audit)}`);
    }
    if (audit.sellerPurchaseNotifyCount > 0) {
      errors.push(`seller notify before B payment count=${audit.sellerPurchaseNotifyCount}`);
    }
    if (audit.dealIdOnThread && audit.hasThread) {
      errors.push(`pre-payment thread still has dealId ${audit.dealIdOnThread}`);
    }

    const chatDetailUrl = new URL(`${BASE}/chat-detail.html`);
    chatDetailUrl.searchParams.set("thread", cfg.threadId);
    chatDetailUrl.searchParams.set("userId", cfg.buyerId);
    chatDetailUrl.searchParams.set("listingId", cfg.listingId);
    chatDetailUrl.searchParams.set("demoProfile", cfg.demoProfile);
    chatDetailUrl.searchParams.set("demoConnect", "1");
    chatDetailUrl.searchParams.set("platform_connect", "1");
    chatDetailUrl.searchParams.set("liveFlow", "1");
    chatDetailUrl.searchParams.set("review", "chat-demo");
    chatDetailUrl.searchParams.set("from", "talk");

    await page.goto(chatDetailUrl.toString(), { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(
      () =>
        window.TasuChatRoomStatus?.resolveRoomLifecycleStatus &&
        window.TasuPlatformChatFee?.requiresConversationStartFee,
      { timeout: 20000 }
    );

    const feeGate = await page.evaluate(
      ({ threadId, listingId, workServiceListingType, dealId }) => {
        const thread = {
          id: threadId,
          listingId,
          listingType: workServiceListingType,
          dealId,
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
        return {
          requiresFee: Fee?.requiresConversationStartFee?.(thread),
          lifecycle,
          canSend: ui?.canSend,
          awaitingStartFee: StartFee?.isAwaitingStartFee?.(thread),
        };
      },
      {
        threadId: cfg.threadId,
        listingId: cfg.listingId,
        workServiceListingType: cfg.workServiceListingType,
        dealId: cfg.dealId,
      }
    );

    if (feeGate.requiresFee !== false) {
      errors.push(`connect ${profileKey} still requires conversation fee ${JSON.stringify(feeGate)}`);
    }
    if (feeGate.lifecycle === "fee_pending") {
      errors.push(`connect ${profileKey} lifecycle still fee_pending ${JSON.stringify(feeGate)}`);
    }
    if (feeGate.canSend !== true) {
      errors.push(`connect ${profileKey} composer blocked ${JSON.stringify(feeGate)}`);
    }
    if (feeGate.awaitingStartFee === true) {
      errors.push(`connect ${profileKey} awaiting start fee card ${JSON.stringify(feeGate)}`);
    }
  } finally {
    await page.close();
    await browser.close();
  }

  return errors;
}

/** A「依頼者を確認する」→ チャットに進む直後に550円ゲートが一瞬も出ないこと */
export async function verifyMarketplaceConnectSellerConfirmNoFeeGate(profileKey) {
  const profile = MARKETPLACE_CONNECT_BENCH_PROFILES[profileKey];
  if (!profile) throw new Error(`unknown profile: ${profileKey}`);

  const BASE = await requireDevServer();
  const cfg = { ...profile, base: BASE };
  const errors = [];

  const browser = await launchHeadlessBrowser();
  const page = await browser.newPage();

  try {
    await page.goto(benchUrl(cfg), { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(
      () =>
        window.TasuPlatformChatLiveFlow?.resetLiveFlow &&
        window.TasuListingContactRequestsStore?.beginContactChat &&
        window.TasuPlatformChatConnectEntryFlow?.activateConnectEntryAfterPayment,
      { timeout: 30000 }
    );
    await page.waitForSelector("#frame-b-chat[src]", { timeout: 30000 });
    await page.waitForTimeout(1200);
    await page
      .frameLocator("#frame-b-chat")
      .locator("body[data-listing-loaded='true']")
      .waitFor({ state: "attached", timeout: 30000 });
    await page.waitForFunction(
      () => {
        const doc = document.getElementById("frame-b-chat")?.contentDocument;
        if (!doc) return false;
        const dock = doc.querySelector(
          "[data-tasu-mdetail-cta-dock] .tasu-mdetail-cta-dock__btn--primary"
        );
        if (dock) {
          const st = window.getComputedStyle(dock);
          if (st.display !== "none" && st.visibility !== "hidden") return true;
        }
        const hero = doc.querySelector("[data-listing-primary-cta]");
        if (hero) {
          const st = window.getComputedStyle(hero);
          return st.display !== "none" && st.visibility !== "hidden";
        }
        return false;
      },
      { timeout: 30000 }
    );

    const bCta = await page.evaluate((ctaSelector) => {
      const frame = document.getElementById("frame-b-chat");
      const win = frame?.contentWindow;
      const doc = frame?.contentDocument;
      const btn =
        doc?.querySelector("[data-tasu-mdetail-cta-dock] .tasu-mdetail-cta-dock__btn--primary") ||
        doc?.querySelector(ctaSelector);
      if (!btn || !win) return { ok: false, reason: "missing_button" };
      const result = win.TasuContactActions?.startContact?.(btn);
      return { ok: Boolean(result?.ok), payUrl: result?.payUrl || "", reason: result?.reason || "" };
    }, cfg.ctaSelector);

    if (!bCta.ok) {
      errors.push(`B startContact failed: ${bCta.reason || "unknown"}`);
      return errors;
    }

    const paySim = await page.evaluate(({ listingId }) => {
      let contactId = "";
      try {
        const raw = localStorage.getItem("tasful_listing_contact_requests_v1");
        const list = raw ? JSON.parse(raw) : [];
        const row = (Array.isArray(list) ? list : [])
          .filter((r) => String(r.listing_id) === listingId)
          .sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")))[0];
        contactId = String(row?.contact_id || "");
      } catch {
        contactId = "";
      }
      if (!contactId) return { ok: false, reason: "missing_contact" };
      const activated = window.TasuPlatformChatConnectEntryFlow?.activateConnectEntryAfterPayment?.({
        contactId,
        listingId,
      });
      return {
        ok: activated?.ok === true,
        reason: activated?.reason || "",
        threadId: activated?.threadId || activated?.thread?.id || "",
        awaitingSeller: activated?.awaitingSellerConfirm === true,
      };
    }, cfg);

    if (!paySim.ok) {
      errors.push(`connect entry payment simulation failed: ${paySim.reason || "unknown"}`);
      return errors;
    }

    const sellerConfirm = await page.evaluate(({ listingId, sellerId }) => {
      let contactId = "";
      try {
        const raw = localStorage.getItem("tasful_listing_contact_requests_v1");
        const list = raw ? JSON.parse(raw) : [];
        const row = (Array.isArray(list) ? list : []).find(
          (r) => String(r.listing_id) === listingId && String(r.status) === "active"
        );
        contactId = String(row?.contact_id || "");
      } catch {
        contactId = "";
      }
      if (!contactId) return { ok: false, reason: "missing_active_contact" };
      const result = window.TasuListingContactRequestsStore?.beginContactChat?.(listingId, contactId);
      const payUrl = String(result?.payUrl || "");
      let parsed = {};
      try {
        const u = new URL(payUrl, location.href);
        parsed = {
          connectEntryPayment: u.searchParams.get("connectEntryPayment"),
          demoConnect: u.searchParams.get("demoConnect"),
          platform_connect: u.searchParams.get("platform_connect"),
          entryProfile: u.searchParams.get("entryProfile"),
          demoProfile: u.searchParams.get("demoProfile"),
          thread: u.searchParams.get("thread"),
        };
      } catch {
        parsed = {};
      }
      return {
        ok: result?.ok === true,
        reason: result?.reason || "",
        payUrl,
        threadId: result?.threadId || "",
        parsed,
        userId: sellerId,
      };
    }, { listingId: cfg.listingId, sellerId: cfg.sellerId });

    if (!sellerConfirm.ok) {
      errors.push(`A beginContactChat failed: ${sellerConfirm.reason || "unknown"}`);
      return errors;
    }
    if (!/chat-detail\.html/i.test(sellerConfirm.payUrl)) {
      errors.push(`A payUrl is not chat-detail: ${sellerConfirm.payUrl}`);
      return errors;
    }
    if (sellerConfirm.parsed.connectEntryPayment !== "1") {
      errors.push(`payUrl missing connectEntryPayment=1 ${JSON.stringify(sellerConfirm.parsed)}`);
    }
    if (sellerConfirm.parsed.demoConnect !== "1") {
      errors.push(`payUrl missing demoConnect=1 ${JSON.stringify(sellerConfirm.parsed)}`);
    }
    if (sellerConfirm.parsed.platform_connect !== "1") {
      errors.push(`payUrl missing platform_connect=1 ${JSON.stringify(sellerConfirm.parsed)}`);
    }

    const chatHref = new URL(sellerConfirm.payUrl, BASE);
    chatHref.searchParams.set("userId", cfg.sellerId);
    chatHref.searchParams.set("talkDev", "1");
    chatHref.searchParams.set("liveFlow", "1");
    chatHref.searchParams.set("review", "chat-demo");
    chatHref.searchParams.set("from", "contacts");
    if (!chatHref.searchParams.get("listingId")) {
      chatHref.searchParams.set("listingId", cfg.listingId);
    }

    await page.goto(chatHref.toString(), { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(
      () => document.body.dataset.chatDetailReady === "true" || document.getElementById("chatMessages"),
      { timeout: 15000 }
    );

    const gateCheck = await page.evaluate(() => {
      const Fee = window.TasuPlatformChatFee;
      const Category = window.TasuPlatformChatCategoryFlow;
      const Entry = window.TasuPlatformChatConnectEntryFlow;
      const params = new URLSearchParams(location.search);
      const threadId = params.get("thread") || "";
      const thread =
        (window.TasuChatThreadStore?.readAll?.() || []).find((t) => String(t.id) === threadId) ||
        window.currentRoom ||
        null;
      const bodyText = document.body?.innerText || "";
      const composer = document.getElementById("chatInput");
      const composerDisabled = composer?.disabled === true || composer?.readOnly === true;
      return {
        url: {
          connectEntryPayment: params.get("connectEntryPayment"),
          demoConnect: params.get("demoConnect"),
          platform_connect: params.get("platform_connect"),
          entryProfile: params.get("entryProfile"),
          demoProfile: params.get("demoProfile"),
        },
        thread: thread
          ? {
              connectEntryPayment: thread.connectEntryPayment === true,
              roomStatus: thread.roomStatus || thread.status || "",
            }
          : null,
        isMarketplaceConnectEntryThread: Category?.isMarketplaceConnectEntryThread?.(thread),
        requiresConversationStartFee: Fee?.requiresConversationStartFee?.(thread),
        lifecycle: window.TasuChatRoomStatus?.resolveRoomLifecycleStatus?.(thread),
        hasStartFeeCard: Boolean(
          document.querySelector("[data-start-fee-pay], .chat-manual-pay__btn")
        ),
        hasFeePayText: /やりとり開始料のお支払い後にメッセージを送信できます/.test(bodyText),
        has550GateText: /やりとり手数料のお支払い|やりとり開始料のお支払い/.test(bodyText),
        composerDisabled,
        connectEntryUrlFlag: Entry?.readConnectEntryPaymentFromUrl?.(),
      };
    });

    if (gateCheck.requiresConversationStartFee !== false) {
      errors.push(`requiresConversationStartFee not false ${JSON.stringify(gateCheck)}`);
    }
    if (gateCheck.isMarketplaceConnectEntryThread !== true) {
      errors.push(`isMarketplaceConnectEntryThread not true ${JSON.stringify(gateCheck)}`);
    }
    if (gateCheck.lifecycle === "fee_pending") {
      errors.push(`lifecycle fee_pending on first paint ${JSON.stringify(gateCheck)}`);
    }
    if (gateCheck.has550GateText) {
      errors.push(`550 yen gate text visible ${JSON.stringify(gateCheck)}`);
    }
    if (gateCheck.hasFeePayText) {
      errors.push(`fee pending composer notice visible ${JSON.stringify(gateCheck)}`);
    }
    if (gateCheck.hasStartFeeCard) {
      errors.push(`start fee card visible ${JSON.stringify(gateCheck)}`);
    }
    if (gateCheck.composerDisabled) {
      errors.push(`composer locked on first paint ${JSON.stringify(gateCheck)}`);
    }
    if (gateCheck.url.connectEntryPayment !== "1") {
      errors.push(`chat URL missing connectEntryPayment ${JSON.stringify(gateCheck.url)}`);
    }
  } finally {
    await page.close();
    await browser.close();
  }

  return errors;
}

/** 完了後 — レビュー通知タップでモーダルが開く（チャット内レビュー導線は出さない） */
export async function verifyMarketplaceConnectReviewNotifyOpen(profileKey) {
  const profile = MARKETPLACE_CONNECT_BENCH_PROFILES[profileKey];
  if (!profile) throw new Error(`unknown profile: ${profileKey}`);

  const BASE = await requireDevServer();
  const cfg = { ...profile, base: BASE };
  const errors = [];

  const browser = await launchHeadlessBrowser();
  const page = await browser.newPage();

  try {
    const chatUrl = new URL(`${BASE}/chat-detail.html`);
    chatUrl.searchParams.set("thread", cfg.threadId);
    chatUrl.searchParams.set("userId", cfg.buyerId);
    chatUrl.searchParams.set("listingId", cfg.listingId);
    chatUrl.searchParams.set("demoProfile", cfg.demoProfile);
    chatUrl.searchParams.set("demoConnect", "1");
    chatUrl.searchParams.set("platform_connect", "1");
    chatUrl.searchParams.set("connectEntryPayment", "1");
    chatUrl.searchParams.set("entryProfile", cfg.demoProfile);
    chatUrl.searchParams.set("liveFlow", "1");
    chatUrl.searchParams.set("review", "chat-demo");
    chatUrl.searchParams.set("talkDev", "1");
    chatUrl.searchParams.set("from", "notify");
    chatUrl.searchParams.set("openReview", "1");
    chatUrl.searchParams.set("demoState", "completed");

    await page.goto(`${BASE}/chat-list.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(() => window.TasuChatThreadStore?.writeAll, { timeout: 30000 });

    await page.evaluate(
      ({ threadId, sellerId, buyerId, listingId, demoProfile }) => {
        const store = window.TasuChatThreadStore;
        const now = new Date().toISOString();
        const threads = (store?.readAll?.() || []).filter((t) => String(t.id) !== threadId);
        threads.unshift({
          id: threadId,
          chatDomain: "work",
          threadKind: "listing_inquiry",
          listingId,
          listingType: demoProfile,
          listingTitle: "bench listing",
          sellerId,
          partnerUserId: sellerId,
          buyerId,
          buyerName: "buyer",
          roomStatus: "completed",
          status: "completed",
          connectEntryPayment: true,
          connectEntryPaidAt: now,
          platformConnectMode: "entry",
          platformContactKind: "purchase",
          source: "listing-contact-paid",
          createdAt: now,
          updatedAt: now,
          completedAt: now,
        });
        store.writeAll(threads);
        const raw = localStorage.getItem(store.MESSAGES_KEY);
        const map = raw ? JSON.parse(raw) : {};
        map[threadId] = [
          {
            id: `msg-${threadId}-platform-completion-card`,
            chatId: threadId,
            kind: "platform_completion_card",
            senderId: "__system__",
            createdAt: now,
            platformCompletionCard: { cardTitle: "取引が完了しました" },
          },
        ];
        localStorage.setItem(store.MESSAGES_KEY, JSON.stringify(map));
      },
      {
        threadId: cfg.threadId,
        sellerId: cfg.sellerId,
        buyerId: cfg.buyerId,
        listingId: cfg.listingId,
        demoProfile: cfg.demoProfile,
      }
    );

    await page.goto(chatUrl.toString(), { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(
      () => window.TasuPlatformChatReviewFlow?.canShowReviewForRoom,
      { timeout: 30000 }
    );
    await page.waitForFunction(
      () => {
        const modal = document.getElementById("chatReviewModal");
        return modal && modal.hidden === false;
      },
      { timeout: 20000 }
    );

    const audit = await page.evaluate((buyerId) => {
      const threadId = new URL(location.href).searchParams.get("thread");
      const thread = window.TasuChatThreadStore.readAll().find((t) => String(t.id) === threadId);
      return {
        canShowReview: window.TasuPlatformChatReviewFlow?.canShowReviewForRoom?.(thread, buyerId),
        showChatPrompt: window.TasuPlatformChatCategoryFlow?.shouldShowReviewPrompt?.(thread, buyerId),
        modalOpen: document.getElementById("chatReviewModal")?.hidden === false,
        hasChatReviewBtn: Boolean(
          document.querySelector("[data-platform-review-open], [data-platform-job-review-open]")
        ),
        hasDuplicatePrompt: Boolean(document.querySelector("[data-platform-job-review-prompt]")),
      };
    }, cfg.buyerId);

    if (audit.showChatPrompt !== false) {
      errors.push(`${profileKey} chat review prompt should be hidden: ${JSON.stringify(audit)}`);
    }
    if (audit.hasChatReviewBtn || audit.hasDuplicatePrompt) {
      errors.push(`${profileKey} duplicate in-chat review CTA: ${JSON.stringify(audit)}`);
    }
    if (audit.canShowReview !== true) {
      errors.push(`${profileKey} canShowReviewForRoom false: ${JSON.stringify(audit)}`);
    }
    if (audit.modalOpen !== true) {
      errors.push(`${profileKey} review modal did not open: ${JSON.stringify(audit)}`);
    }

    const sellerUrl = new URL(chatUrl.toString());
    sellerUrl.searchParams.set("userId", cfg.sellerId);
    await page.goto(sellerUrl.toString(), { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(
      () => {
        const modal = document.getElementById("chatReviewModal");
        return modal && modal.hidden === false;
      },
      { timeout: 20000 }
    );
    const sellerAudit = await page.evaluate((sellerId) => {
      const threadId = new URL(location.href).searchParams.get("thread");
      const thread = window.TasuChatThreadStore.readAll().find((t) => String(t.id) === threadId);
      const Review = window.TasuPlatformChatReviewFlow;
      const target = Review?.getReviewTargetUserId?.(thread, sellerId);
      return {
        from: new URL(location.href).searchParams.get("from"),
        openReview: new URL(location.href).searchParams.get("openReview"),
        canShowReview: Review?.canShowReviewForRoom?.(thread, sellerId),
        reviewTarget: target,
        sellerId,
        buyerId: thread?.buyerId,
        modalOpen: document.getElementById("chatReviewModal")?.hidden === false,
      };
    }, cfg.sellerId);
    if (sellerAudit.from !== "notify") {
      errors.push(`${profileKey} seller review URL from!=notify: ${JSON.stringify(sellerAudit)}`);
    }
    if (sellerAudit.canShowReview !== true) {
      errors.push(`${profileKey} seller canShowReviewForRoom false: ${JSON.stringify(sellerAudit)}`);
    }
    if (String(sellerAudit.reviewTarget) === String(cfg.sellerId)) {
      errors.push(`${profileKey} seller review target is self: ${JSON.stringify(sellerAudit)}`);
    }
    if (sellerAudit.modalOpen !== true) {
      errors.push(`${profileKey} seller review modal did not open: ${JSON.stringify(sellerAudit)}`);
    }
  } finally {
    await page.close();
    await browser.close();
  }

  return errors;
}

function seedCompletedConnectReviewState(cfg) {
  return ({ threadId, sellerId, buyerId, listingId, demoProfile }) => {
    const store = window.TasuChatThreadStore;
    const Notify = window.TasuTalkNotifications;
    const Demo = window.TasuPlatformChatDualWindowDemo;
    const now = new Date().toISOString();
    const threads = (store?.readAll?.() || []).filter((t) => String(t.id) !== threadId);
    threads.unshift({
      id: threadId,
      chatDomain: "work",
      threadKind: "listing_inquiry",
      listingId,
      listingType: demoProfile,
      listingTitle: "bench listing",
      sellerId,
      partnerUserId: sellerId,
      buyerId,
      buyerName: "buyer",
      roomStatus: "completed",
      status: "completed",
      connectEntryPayment: true,
      connectEntryPaidAt: now,
      platformConnectMode: "entry",
      platformContactKind: "purchase",
      source: "listing-contact-paid",
      createdAt: now,
      updatedAt: now,
      completedAt: now,
    });
    store.writeAll(threads);
    const profile = Demo?.resolveProfileForThread?.(threadId);
    const rows = [];
    [sellerId, buyerId].forEach((recipientUserId) => {
      const href = Demo?.chatUrl?.(profile?.id || demoProfile, recipientUserId, {
        review: Demo.REVIEW_PARAM || "chat-demo",
        connect: true,
        state: "completed",
        from: "notify",
        openReview: "1",
        threadId,
      });
      rows.push({
        id: `platform-chat-demo-completion-approved-${threadId}-${recipientUserId}`,
        type: demoProfile,
        category: demoProfile,
        title: "取引が完了しました",
        body: "お疲れさまでした。レビューで取引を締めくくれます。",
        actionLabel: "レビューを書く",
        href,
        targetUrl: href,
        source: "platform_chat_demo_approved_v1",
        recipientUserId,
        threadId,
        listingId,
        demoState: "completed",
        openReview: "1",
        createdAt: now,
        updatedAt: now,
      });
    });
    Notify?.saveAll?.(rows, { localOnly: true, silent: true });
  };
}

/** ベンチ上で A/B 通知「レビューを書く」→ 各チャット iframe でモーダルが開く */
export async function verifyMarketplaceConnectBenchReviewNotifyOpen(profileKey) {
  const profile = MARKETPLACE_CONNECT_BENCH_PROFILES[profileKey];
  if (!profile) throw new Error(`unknown profile: ${profileKey}`);

  const BASE = await requireDevServer();
  const cfg = { ...profile, base: BASE };
  const errors = [];
  const browser = await launchHeadlessBrowser();
  const page = await browser.newPage();

  try {
    await page.goto(benchUrl(cfg), { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(
      () => window.TasuChatThreadStore?.writeAll && window.TasuPlatformChatDualWindowDemo?.chatUrl,
      { timeout: 30000 }
    );
    await page.evaluate(seedCompletedConnectReviewState(cfg), {
      threadId: cfg.threadId,
      sellerId: cfg.sellerId,
      buyerId: cfg.buyerId,
      listingId: cfg.listingId,
      demoProfile: cfg.demoProfile,
    });

    const openChatFromNotify = async (side) => {
      const frameId = side === "A" ? "frame-a-notify" : "frame-b-notify";
      const chatFrameId = side === "A" ? "frame-a-chat" : "frame-b-chat";
      const userId = side === "A" ? cfg.sellerId : cfg.buyerId;
      await page.waitForSelector(`#${frameId}`, { timeout: 30000 });
      await page.waitForTimeout(800);
      const clicked = await page.evaluate(
        ({ frameId, userId }) => {
          const frame = document.getElementById(frameId);
          const doc = frame?.contentDocument;
          const btn = doc?.querySelector(
            "[data-talk-notify-action='navigate'][data-talk-notify-href*='openReview=1']"
          );
          if (!btn) return { ok: false, reason: "no_review_button" };
          const href = btn.getAttribute("data-talk-notify-href") || "";
          if (!/from=notify/i.test(href)) return { ok: false, reason: "missing_from_notify", href };
          btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
          return { ok: true, href };
        },
        { frameId, userId }
      );
      if (!clicked?.ok) {
        return { ok: false, side, ...clicked };
      }
      await page.waitForFunction(
        ({ chatFrameId }) => /chat-detail\.html/i.test(document.getElementById(chatFrameId)?.src || ""),
        { chatFrameId },
        { timeout: 20000 }
      );
      await page.waitForFunction(
        ({ chatFrameId }) => {
          const doc = document.getElementById(chatFrameId)?.contentDocument;
          const modal = doc?.getElementById("chatReviewModal");
          return modal && modal.hidden === false;
        },
        { chatFrameId },
        { timeout: 20000 }
      );
      const audit = await page.evaluate(
        ({ chatFrameId, userId, sellerId, buyerId }) => {
          const doc = document.getElementById(chatFrameId)?.contentDocument;
          const win = doc?.defaultView;
          const threadId = new URL(win.location.href).searchParams.get("thread");
          const thread = win.TasuChatThreadStore.readAll().find((t) => String(t.id) === threadId);
          const Review = win.TasuPlatformChatReviewFlow;
          const target = Review?.getReviewTargetUserId?.(thread, userId);
          return {
            from: new URL(win.location.href).searchParams.get("from"),
            openReview: new URL(win.location.href).searchParams.get("openReview"),
            canShowReview: Review?.canShowReviewForRoom?.(thread, userId),
            reviewTarget: target,
            modalOpen: doc?.getElementById("chatReviewModal")?.hidden === false,
            expectedPartner: userId === sellerId ? buyerId : sellerId,
          };
        },
        { chatFrameId, userId, sellerId: cfg.sellerId, buyerId: cfg.buyerId }
      );
      if (audit.from !== "notify") {
        return { ok: false, side, reason: "from_not_notify", audit };
      }
      if (audit.canShowReview !== true) {
        return { ok: false, side, reason: "not_eligible", audit };
      }
      if (String(audit.reviewTarget) !== String(audit.expectedPartner)) {
        return { ok: false, side, reason: "wrong_review_target", audit };
      }
      if (audit.modalOpen !== true) {
        return { ok: false, side, reason: "modal_closed", audit };
      }
      return { ok: true, side, audit };
    };

    const aResult = await openChatFromNotify("A");
    if (!aResult.ok) errors.push(`A notify review open failed: ${JSON.stringify(aResult)}`);
    const bResult = await openChatFromNotify("B");
    if (!bResult.ok) errors.push(`B notify review open failed: ${JSON.stringify(bResult)}`);
  } finally {
    await page.close();
    await browser.close();
  }

  return errors;
}
