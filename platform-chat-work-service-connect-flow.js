/**
 * worker / business_service — Connectあり 作業完了後フロー
 * 作業完了申請 → 依頼者承認 → Stripe Connect決済 → 手数料控除 → 支払い完了通知
 * → 業者/ワーカー確認完了 → 取引完了 → レビュー
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasful_platform_work_service_connect_v1";
  const STRIPE_PAY_CARD_KIND = "work_service_stripe_payment_card";
  const SELLER_CONFIRM_CARD_KIND = "work_service_seller_confirm_card";

  const NOTIFY_SOURCE_BUYER_PAID = "platform_chat_work_svc_buyer_paid_v1";

  const PLATFORM_FEE_RATE = 0.1;
  const MIN_PLATFORM_FEE_YEN = 110;

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fmtYen(amount) {
    try {
      return `${Math.max(0, Math.round(Number(amount) || 0)).toLocaleString("ja-JP")}円`;
    } catch {
      return `${Math.max(0, Math.round(Number(amount) || 0))}円`;
    }
  }

  function readStateMap() {
    try {
      const raw = global.localStorage?.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeStateMap(map) {
    try {
      global.localStorage?.setItem(STORAGE_KEY, JSON.stringify(map || {}));
      global.dispatchEvent?.(new CustomEvent("tasful-work-service-connect-changed"));
    } catch {
      /* ignore */
    }
  }

  function getThreadState(threadId) {
    const id = pickStr(threadId);
    if (!id) return { status: "none" };
    const row = readStateMap()[id];
    if (!row || typeof row !== "object") return { status: "none" };
    return {
      status: pickStr(row.status, "none"),
      paidAt: pickStr(row.paidAt),
      confirmedAt: pickStr(row.confirmedAt),
      amountYen: Number(row.amountYen) || 0,
      feeYen: Number(row.feeYen) || 0,
      payoutYen: Number(row.payoutYen) || 0,
    };
  }

  function setThreadState(threadId, patch) {
    const id = pickStr(threadId);
    if (!id) return getThreadState(id);
    const map = readStateMap();
    map[id] = {
      ...(map[id] || {}),
      ...(patch || {}),
      updatedAt: new Date().toISOString(),
    };
    writeStateMap(map);
    return getThreadState(id);
  }

  function isWorkServiceConnectThread(thread) {
    const Category = global.TasuPlatformChatCategoryFlow;
    if (Category?.isMarketplaceConnectEntryThread?.(thread) === true) {
      return false;
    }
    if (global.TasuPlatformChatPurchasePaymentFlow?.appliesToThread?.(thread) === true) {
      return false;
    }
    const isWorkerSvc = Category?.requiresWorkReportForm?.(thread) === true;
    const isBusinessSvc =
      Category?.isBusinessServiceCategory?.(thread) === true &&
      Category?.isPlatformCompletionThread?.(thread) === true;
    if (!isWorkerSvc && !isBusinessSvc) return false;

    const dealId = pickStr(thread?.dealId);
    if (
      dealId &&
      global.TasuPlatformChatCompletion?.usesCompletionReportDealFlow?.(dealId) === true
    ) {
      return true;
    }
    if (isWorkerSvc) return true;
    return global.TasuPlatformChatConnectChatFlow?.isConnectThread?.(thread) === true;
  }

  function resolveAmountYen(thread) {
    const raw =
      thread?.agreedAmount ??
      thread?.agreed_amount ??
      thread?.amountYen ??
      thread?.amount_yen ??
      0;
    const amount = Math.max(0, Math.round(Number(raw) || 0));
    if (amount > 0) return amount;
    return 5500;
  }

  function calcFeeBreakdown(amountYen) {
    const amount = Math.max(0, Math.round(Number(amountYen) || 0));
    const fee = Math.max(MIN_PLATFORM_FEE_YEN, Math.round(amount * PLATFORM_FEE_RATE));
    const payout = Math.max(0, amount - fee);
    return { amountYen: amount, feeYen: fee, payoutYen: payout };
  }

  function getBuyerId(thread) {
    return global.TasuPlatformChatCategoryFlow?.getBuyerId?.(thread) || pickStr(thread?.buyerId);
  }

  function getSellerId(thread) {
    return global.TasuPlatformChatCategoryFlow?.getSellerId?.(thread) || pickStr(thread?.sellerId);
  }

  function isBuyer(thread, userId) {
    return pickStr(userId) === pickStr(getBuyerId(thread));
  }

  function isSeller(thread, userId) {
    return pickStr(userId) === pickStr(getSellerId(thread));
  }

  function readMessages(threadId) {
    const store = global.TasuChatThreadStore;
    try {
      const raw = global.localStorage.getItem(store.MESSAGES_KEY);
      const map = raw ? JSON.parse(raw) : {};
      return Array.isArray(map?.[threadId]) ? map[threadId] : [];
    } catch {
      return [];
    }
  }

  function writeMessages(threadId, list) {
    const store = global.TasuChatThreadStore;
    if (!store?.MESSAGES_KEY) return;
    if (typeof store.writeMessagesMap === "function") {
      store.writeMessagesMap({ [threadId]: list });
      return;
    }
    try {
      const raw = global.localStorage.getItem(store.MESSAGES_KEY);
      const map = raw ? JSON.parse(raw) : {};
      map[threadId] = list;
      global.localStorage.setItem(store.MESSAGES_KEY, JSON.stringify(map));
    } catch {
      /* ignore */
    }
  }

  const WORK_SERVICE_FLOW_LABELS = {
    sellerPaidNotifyTitle: "依頼者のお支払いが完了しました",
    sellerPaidNotifyBody: "確認してください",
    sellerPaidNotifyCta: "確認する",
    sellerConfirmCardTitle: "確認完了",
    sellerConfirmCardBody: "依頼者のお支払いが完了しました。確認してください",
    sellerConfirmButton: "確認完了",
    sellerConfirmDone: "確認完了済み",
  };

  function getWorkServiceFlowLabels(thread) {
    return WORK_SERVICE_FLOW_LABELS;
  }

  function buildChatNotifyHref(profile, userId, threadId, state) {
    const Demo = global.TasuPlatformChatDualWindowDemo;
    return (
      Demo?.chatUrl?.(profile?.id || "worker", userId, {
        review: Demo.REVIEW_PARAM || "chat-demo",
        connect: true,
        threadId,
        from: "notify",
        state: pickStr(state, "active"),
      }) || `chat-detail.html?thread=${encodeURIComponent(threadId)}`
    );
  }

  function pushRuntimeNotification(draft) {
    const store = global.TasuTalkNotifications;
    if (!store?.getAll || !store?.saveAll) return { ok: false };
    const notifyId = pickStr(draft.id);
    const byId = new Map((store.getAll() || []).map((n) => [String(n.id), n]));
    const existing = byId.get(String(notifyId)) || null;
    const row = {
      ...(existing || {}),
      ...draft,
      readAt: existing?.readAt || null,
      updatedAt: new Date().toISOString(),
      createdAt: existing?.createdAt || new Date().toISOString(),
    };
    byId.set(String(notifyId), row);
    store.saveAll([...byId.values()], { localOnly: true, silent: true, source: pickStr(draft.source) });
    global.TasuTalkOfficialRooms?.syncNotification?.(row);
    try {
      global.dispatchEvent(
        new CustomEvent("tasful-talk-notifications-changed", { detail: { notifyOnly: true } })
      );
    } catch {
      /* ignore */
    }
    return { ok: true, notification: row };
  }

  function notifyBuyerPaymentComplete(thread, threadId) {
    const buyerId = getBuyerId(thread);
    const profile = global.TasuPlatformChatDualWindowDemo?.resolveProfileForThread?.(thread || threadId);
    if (!buyerId || !profile) return { ok: false };
    const href = buildChatNotifyHref(profile, buyerId, threadId);
    return pushRuntimeNotification({
      id: `work-svc-buyer-paid-${threadId}-${buyerId}`,
      type: pickStr(profile.categoryKey, profile.id, "worker"),
      category: pickStr(thread?.category, profile.label),
      title: "お支払いが完了しました",
      body: "Stripe Connect決済が完了しました。",
      actionLabel: "確認する",
      href,
      targetUrl: href,
      priority: "high",
      sendTalkMessage: true,
      officialRoomId: "official_tasful",
      source: NOTIFY_SOURCE_BUYER_PAID,
      recipientUserId: buyerId,
      threadId,
      listingId: pickStr(thread?.listingId),
      notifyListingTitle: pickStr(thread?.listingTitle),
      minimalNotifyCard: true,
      demoState: "active",
    });
  }

  function notifySellerPaymentComplete(thread, threadId) {
    const sellerId = getSellerId(thread);
    const profile = global.TasuPlatformChatDualWindowDemo?.resolveProfileForThread?.(thread || threadId);
    if (!sellerId || !profile) return { ok: false };
    const labels = getWorkServiceFlowLabels(thread);
    const href = buildChatNotifyHref(profile, sellerId, threadId);
    return pushRuntimeNotification({
      id: `work-svc-seller-paid-${threadId}-${sellerId}`,
      type: pickStr(profile.categoryKey, profile.id, "worker"),
      category: pickStr(thread?.category, profile.label),
      title: labels.sellerPaidNotifyTitle,
      body: labels.sellerPaidNotifyBody,
      actionLabel: labels.sellerPaidNotifyCta,
      href,
      targetUrl: href,
      priority: "high",
      sendTalkMessage: true,
      officialRoomId: "official_tasful",
      source: NOTIFY_SOURCE_BUYER_PAID,
      recipientUserId: sellerId,
      threadId,
      listingId: pickStr(thread?.listingId),
      notifyListingTitle: pickStr(thread?.listingTitle),
      minimalNotifyCard: true,
      demoState: "active",
    });
  }

  function ensureStripePaymentCardAfterApproval(threadId, thread) {
    const id = pickStr(threadId);
    if (!id) return { ok: false, reason: "missing_thread" };
    const list = readMessages(id);
    if (list.some((m) => m.kind === STRIPE_PAY_CARD_KIND)) return { ok: true, skipped: true };

    const breakdown = calcFeeBreakdown(resolveAmountYen(thread));
    setThreadState(id, { ...breakdown, status: "pending" });

    list.push({
      id: `msg-${id}-work-svc-stripe-pay`,
      chatId: id,
      roomId: id,
      senderId: "__system__",
      senderName: "TASFUL",
      text: "",
      createdAt: new Date().toISOString(),
      kind: STRIPE_PAY_CARD_KIND,
      workServiceStripeCard: {
        title: "Stripe Connect決済",
        body: "作業完了が承認されました。TASFUL経由でお支払いください。",
        button: "決済を完了する",
        amountYen: breakdown.amountYen,
        feeYen: breakdown.feeYen,
        payoutYen: breakdown.payoutYen,
      },
    });
    writeMessages(id, list);
    return { ok: true };
  }

  function ensureSellerConfirmCard(threadId, thread) {
    const id = pickStr(threadId);
    if (!id) return { ok: false };
    const list = readMessages(id);
    if (list.some((m) => m.kind === SELLER_CONFIRM_CARD_KIND)) return { ok: true, skipped: true };

    const state = getThreadState(id);
    const labels = getWorkServiceFlowLabels(thread);
    list.push({
      id: `msg-${id}-work-svc-seller-confirm`,
      chatId: id,
      roomId: id,
      senderId: "__system__",
      senderName: "TASFUL",
      text: "",
      createdAt: new Date().toISOString(),
      kind: SELLER_CONFIRM_CARD_KIND,
      workServiceSellerConfirmCard: {
        title: labels.sellerConfirmCardTitle,
        body: labels.sellerConfirmCardBody,
        button: labels.sellerConfirmButton,
        amountYen: state.amountYen,
        payoutYen: state.payoutYen,
      },
    });
    writeMessages(id, list);
    return { ok: true };
  }

  function executeStripeConnectPayment({ threadId, thread, userId }) {
    const id = pickStr(threadId, thread?.id);
    const room = thread || global.TasuPlatformChatCompletionFlow?.readThread?.(id);
    if (!id || !room) return { ok: false, reason: "missing_context" };
    if (!isWorkServiceConnectThread(room)) return { ok: false, reason: "not_work_service" };
    if (!isBuyer(room, userId)) return { ok: false, reason: "not_buyer" };
    const rs = pickStr(room.roomStatus, room.status).toLowerCase();
    if (rs !== "awaiting_payment") return { ok: false, reason: "not_awaiting_payment" };

    const state = getThreadState(id);
    if (state.status === "paid" || state.status === "confirmed") {
      return { ok: true, skipped: true };
    }

    const breakdown = calcFeeBreakdown(state.amountYen || resolveAmountYen(room));
    const now = new Date().toISOString();
    setThreadState(id, { ...breakdown, status: "paid", paidAt: now });

    const Completion = global.TasuPlatformChatCompletionFlow;
    Completion?.patchThread?.(id, {
      paymentCompleted: true,
      payment_completed: true,
      workServicePaymentCompletedAt: now,
      workServicePaymentAmountYen: breakdown.amountYen,
      workServicePaymentFeeYen: breakdown.feeYen,
      workServicePaymentPayoutYen: breakdown.payoutYen,
    });

    Completion?.appendSystemMessage?.(
      id,
      `Stripe Connect決済が完了しました（支払額 ${fmtYen(breakdown.amountYen)} / 手数料 ${fmtYen(breakdown.feeYen)} / 振込 ${fmtYen(breakdown.payoutYen)}）`
    );

    ensureSellerConfirmCard(id, room);
    notifyBuyerPaymentComplete(room, id);
    notifySellerPaymentComplete(room, id);

    try {
      global.dispatchEvent(new CustomEvent("tasful-chat-threads-changed"));
      global.dispatchEvent(new CustomEvent("tasful-talk-notifications-changed", { detail: { notifyOnly: true } }));
    } catch {
      /* ignore */
    }
    return { ok: true, thread: Completion?.readThread?.(id) || room, paymentCompleted: true };
  }

  function confirmPaymentReceived({ threadId, thread, userId }) {
    const id = pickStr(threadId, thread?.id);
    const room = thread || global.TasuPlatformChatCompletionFlow?.readThread?.(id);
    if (!id || !room) return { ok: false, reason: "missing_context" };
    if (!isWorkServiceConnectThread(room)) return { ok: false, reason: "not_work_service" };
    if (!isSeller(room, userId)) return { ok: false, reason: "not_seller" };

    const state = getThreadState(id);
    if (state.status !== "paid") return { ok: false, reason: "payment_not_reported" };

    const now = new Date().toISOString();
    setThreadState(id, { status: "confirmed", confirmedAt: now });

    const Completion = global.TasuPlatformChatCompletionFlow;
    const updated = Completion?.patchThread?.(id, {
      roomStatus: Completion.COMPLETED_STATUS,
      status: Completion.COMPLETED_STATUS,
      completedAt: now,
      paymentConfirmed: true,
      payment_confirmed: true,
      workServicePaymentConfirmedBy: pickStr(userId),
      workServicePaymentConfirmedAt: now,
    });

    const finalRoom = updated || room;

    Completion?.finalizeCompletion?.({
      thread: finalRoom,
      threadId: id,
      approverId: pickStr(userId),
    });

    try {
      global.dispatchEvent(new CustomEvent("tasful-chat-threads-changed"));
    } catch {
      /* ignore */
    }

    return { ok: true, thread: finalRoom };
  }

  function isPaymentCompletedForReview(thread) {
    if (!isWorkServiceConnectThread(thread)) return false;
    const id = pickStr(thread?.id);
    if (!id) return false;
    const rs = pickStr(thread?.roomStatus, thread?.status).toLowerCase();
    if (rs !== "completed") return false;
    return getThreadState(id).status === "confirmed";
  }

  function isReadyForReview(thread, userId) {
    if (!isWorkServiceConnectThread(thread)) return false;
    return isPaymentCompletedForReview(thread);
  }

  function renderStripePaymentCardHtml(message, thread, meId) {
    if (!isBuyer(thread, meId)) {
      const state = getThreadState(thread?.id);
      if (state.status === "pending") {
        return `<p class="chat-manual-pay__hint" role="note">依頼者のStripe Connect決済をお待ちください</p>`;
      }
      return "";
    }
    const card = message?.workServiceStripeCard || {};
    const state = getThreadState(thread?.id);
    const paid = state.status === "paid" || state.status === "confirmed";
    const title = pickStr(card.title, "Stripe Connect決済");
    const body = pickStr(card.body);
    const amountYen = state.amountYen || Number(card.amountYen) || 0;
    const feeYen = state.feeYen || Number(card.feeYen) || 0;
    const payoutYen = state.payoutYen || Number(card.payoutYen) || 0;
    const threadId = pickStr(thread?.id, message?.roomId);

    const rows = [
      ["お支払い金額", fmtYen(amountYen)],
      ["プラットフォーム手数料", fmtYen(feeYen)],
      ["業者への振込（控除後）", fmtYen(payoutYen)],
    ]
      .map(([k, v]) => `<div class="chat-manual-pay__row"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
      .join("");

    const action = paid
      ? `<p class="chat-manual-pay__done" role="status">お支払いが完了しました</p>`
      : `<button type="button" class="chat-connect-card__btn chat-connect-card__btn--primary" data-work-service-stripe-pay data-thread-id="${esc(threadId)}">${esc(pickStr(card.button, "決済を完了する"))}</button>`;

    return (
      `<div class="chat-connect-card-wrap" data-work-service-stripe-card data-thread-id="${esc(threadId)}">` +
      `<article class="chat-connect-card chat-connect-card--pay-required" aria-label="${esc(title)}">` +
      `<h3 class="chat-connect-card__title">${esc(title)}</h3>` +
      `<p class="chat-connect-card__body">${esc(body)}</p>` +
      `<dl class="chat-manual-pay__list">${rows}</dl>` +
      `<div class="chat-connect-card__actions">${action}</div>` +
      `</article>` +
      `</div>`
    );
  }

  function renderSellerConfirmCardHtml(message, thread, meId) {
    if (!isSeller(thread, meId)) return "";
    const card = message?.workServiceSellerConfirmCard || {};
    const state = getThreadState(thread?.id);
    const rs = pickStr(thread?.roomStatus, thread?.status).toLowerCase();
    const done = state.status === "confirmed" || rs === "completed";
    if (state.status !== "paid" && !done) {
      return `<p class="chat-manual-pay__hint" role="note">依頼者のお支払い完了後に確認できます</p>`;
    }
    const labels = getWorkServiceFlowLabels(thread);
    const title = pickStr(card.title, labels.sellerConfirmCardTitle);
    const body = pickStr(card.body, labels.sellerConfirmCardBody);
    const threadId = pickStr(thread?.id, message?.roomId);
    const payoutYen = state.payoutYen || Number(card.payoutYen) || 0;

    const action = done
      ? `<p class="chat-manual-pay__done" role="status">${esc(labels.sellerConfirmDone)}</p>`
      : `<button type="button" class="chat-connect-card__btn chat-connect-card__btn--primary" data-work-service-seller-confirm data-thread-id="${esc(threadId)}">${esc(pickStr(card.button, labels.sellerConfirmButton))}</button>`;

    return (
      `<div class="chat-connect-card-wrap" data-work-service-seller-confirm-card data-thread-id="${esc(threadId)}">` +
      `<article class="chat-connect-card chat-connect-card--deposit" aria-label="${esc(title)}">` +
      `<h3 class="chat-connect-card__title">${esc(title)}</h3>` +
      `<p class="chat-connect-card__body">${esc(body)}</p>` +
      `<p class="chat-manual-pay__note">振込予定額: ${esc(fmtYen(payoutYen))}</p>` +
      `<div class="chat-connect-card__actions">${action}</div>` +
      `</article>` +
      `</div>`
    );
  }

  function stripePayFromEvent(ev) {
    const btn = ev?.currentTarget || ev?.target?.closest?.("[data-work-service-stripe-pay]");
    if (!btn || btn.disabled) return { ok: false };
    const threadId = pickStr(btn.getAttribute("data-thread-id"), new URL(global.location.href).searchParams.get("thread"));
    const meId = global.TasuChatUserIdentity?.getEffectiveUserId?.() || "";
    const thread = global.TasuPlatformChatCompletionFlow?.readThread?.(threadId);
    btn.disabled = true;
    const res = executeStripeConnectPayment({ threadId, thread, userId: meId });
    if (!res?.ok) btn.disabled = false;
    return res;
  }

  function sellerConfirmFromEvent(ev) {
    const btn = ev?.currentTarget || ev?.target?.closest?.("[data-work-service-seller-confirm]");
    if (!btn || btn.disabled) return { ok: false };
    const threadId = pickStr(btn.getAttribute("data-thread-id"), new URL(global.location.href).searchParams.get("thread"));
    const meId = global.TasuChatUserIdentity?.getEffectiveUserId?.() || "";
    const thread = global.TasuPlatformChatCompletionFlow?.readThread?.(threadId);
    btn.disabled = true;
    const res = confirmPaymentReceived({ threadId, thread, userId: meId });
    if (!res?.ok) btn.disabled = false;
    return res;
  }

  global.TasuPlatformChatWorkServiceConnectFlow = {
    STORAGE_KEY,
    STRIPE_PAY_CARD_KIND,
    SELLER_CONFIRM_CARD_KIND,
    isWorkServiceConnectThread,
    getThreadState,
    setThreadState,
    ensureStripePaymentCardAfterApproval,
    ensureSellerConfirmCard,
    executeStripeConnectPayment,
    confirmPaymentReceived,
    isPaymentCompletedForReview,
    isReadyForReview,
    renderStripePaymentCardHtml,
    renderSellerConfirmCardHtml,
    stripePayFromEvent,
    sellerConfirmFromEvent,
    getWorkServiceFlowLabels,
    notifyBuyerPaymentComplete,
    notifySellerPaymentComplete,
  };
})(typeof window !== "undefined" ? window : globalThis);
