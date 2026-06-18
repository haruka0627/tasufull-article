/**
 * Connectなし — やりとり開始料550円（チャット内カード + 支払い完了でチャット解放）
 */
(function (global) {
  "use strict";

  const CARD_KIND = "pre_chat_start_fee_card";
  const CARD_TITLE = "やりとり開始料のお支払い";
  const CARD_DESC = "相手とやりとりを開始するには、TASFULのやりとり開始料が必要です。";
  const PAY_BTN = "550円を支払ってやりとりを開始する";
  const REQUESTER_WAIT = "相手のやりとり開始料のお支払いをお待ちください。";

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
    const n = Math.round(Number(amount) || 0);
    return `${n.toLocaleString("ja-JP")}円`;
  }

  function resolveFeeAmount(thread) {
    const Fee = global.TasuPlatformChatFee;
    const threadId = pickStr(thread?.id, thread?.threadId);
    const row = Fee?.getFeeRecord?.(threadId);
    if (row?.feeAmount != null) return Math.round(Number(row.feeAmount));
    return Fee?.MIN_FEE_YEN || 550;
  }

  function isFeePendingThread(thread) {
    const status = pickStr(thread?.status, thread?.roomStatus).toLowerCase();
    return status === "fee_pending";
  }

  function isBuyer(thread, userId) {
    const me = pickStr(userId);
    const buyerId = pickStr(thread?.buyerId);
    return Boolean(me && buyerId && me === buyerId);
  }

  /** Connectなしゲート — 「チャットに進む」を押した側（出品者/掲載者/受託者）が支払う */
  function isFeePayer(thread, userId) {
    const Gate = global.TasuPlatformChatContactGate;
    if (Gate?.isGatedPlainThread?.(thread) === true) {
      return Gate.isPartnerSide?.(thread, userId) === true;
    }
    const me = pickStr(userId);
    const sellerId = pickStr(thread?.sellerId, thread?.partnerUserId);
    if (String(thread?.threadKind || "") === "job_hire") {
      return Boolean(me && sellerId && me === sellerId);
    }
    return Boolean(me && sellerId && me === sellerId);
  }

  function isAwaitingStartFee(thread) {
    const Fee = global.TasuPlatformChatFee;
    if (Fee?.requiresConversationStartFee?.(thread) !== true) return false;

    const Gate = global.TasuPlatformChatContactGate;
    if (Gate?.shouldBlockChatDetailAccess?.(thread)) return false;

    const threadId = pickStr(thread?.id, thread?.threadId);
    if (!threadId || !Fee) return false;
    if (!isFeePendingThread(thread)) return false;
    if (Fee.isFeePaid?.(threadId) === true) return false;
    if (Gate?.isGatedPlainThread?.(thread) === true) return false;
    return true;
  }

  function readMessages(threadId) {
    const store = global.TasuChatThreadStore;
    if (!store?.getMessages) return [];
    return store.getMessages(threadId) || [];
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

  function resolveListing(thread) {
    const listingId = pickStr(thread?.listingId);
    const catalog = global.TasuListingDemoCatalog?.STORE_BY_ID?.[listingId];
    if (catalog) return { ...catalog, id: listingId, listing_type: thread?.listingType };
    return {
      id: listingId,
      listing_type: thread?.listingType,
      title: thread?.listingTitle,
    };
  }

  function seedStartFeeCardMessage(threadId, thread) {
    const id = pickStr(threadId, thread?.id);
    if (!id || !isAwaitingStartFee(thread)) return { ok: false, reason: "not_fee_pending" };

    const list = readMessages(id);
    if (list.some((m) => m.kind === CARD_KIND)) {
      return { ok: true, skipped: true };
    }

    const amount = resolveFeeAmount(thread);
    list.push({
      id: `msg-${id}-start-fee-card`,
      chatId: id,
      roomId: id,
      senderId: "__system__",
      senderName: "TASFUL",
      text: "",
      createdAt: new Date().toISOString(),
      kind: CARD_KIND,
      startFeeCard: {
        title: CARD_TITLE,
        amountYen: amount,
        description: CARD_DESC,
        payButton: PAY_BTN,
      },
    });
    writeMessages(id, list);
    return { ok: true };
  }

  function ensureCardMessages(threadId, thread, listing) {
    const id = pickStr(threadId, thread?.id);
    if (!id || !thread) return { ok: false, reason: "missing_thread" };
    const Gate = global.TasuPlatformChatContactGate;
    if (Gate?.shouldBlockChatDetailAccess?.(thread)) {
      return { ok: true, skipped: true, reason: "management_page_gate" };
    }
    if (!isAwaitingStartFee(thread)) return { ok: true, skipped: true };
    return seedStartFeeCardMessage(id, thread);
  }

  function renderStartFeeCardHtml(message, thread, meId) {
    if (global.TasuPlatformChatFee?.requiresConversationStartFee?.(thread) !== true) {
      return "";
    }
    const card = message?.startFeeCard || {};
    const title = pickStr(card.title, CARD_TITLE);
    const amount = resolveFeeAmount(thread);
    const description = pickStr(card.description, CARD_DESC);
    const payer = isFeePayer(thread, meId);
    const awaiting = isAwaitingStartFee(thread);

    let action = "";
    if (payer && awaiting) {
      action = `<button type="button" class="chat-manual-pay__btn chat-manual-pay__btn--primary" data-start-fee-pay onclick="window.TasuPlatformChatContactGate?.__uiPayFee?.(event)">${esc(PAY_BTN)}</button>`;
    } else if (payer && !awaiting) {
      action = `<p class="chat-manual-pay__done" role="status">お支払い済みです</p>`;
    } else if (!payer && awaiting) {
      action = `<p class="chat-manual-pay__hint" role="note">${esc(REQUESTER_WAIT)}</p>`;
    }

    return (
      `<div class="chat-manual-pay-wrap" data-start-fee-card>` +
      `<article class="chat-manual-pay" aria-label="${esc(title)}">` +
      `<h3 class="chat-manual-pay__title">${esc(title)}</h3>` +
      `<p class="chat-manual-pay__note">${esc(description)}</p>` +
      `<dl class="chat-manual-pay__list">` +
      `<div class="chat-manual-pay__row"><dt>金額</dt><dd>${esc(fmtYen(amount))}</dd></div>` +
      `</dl>` +
      `<div class="chat-manual-pay__actions">` +
      `<div class="chat-manual-pay__actions-col">${action}</div>` +
      `</div>` +
      `</article>` +
      `</div>`
    );
  }

  function completeStartFeePayment(detail) {
    const Fee = global.TasuPlatformChatFee;
    const thread = detail?.thread || {};
    const threadId = pickStr(detail?.threadId, thread?.id);
    const userId = pickStr(detail?.userId);
    if (!threadId || !Fee) return { ok: false, reason: "missing_context" };
    if (!isFeePayer(thread, userId)) return { ok: false, reason: "not_fee_payer" };
    if (!isAwaitingStartFee(thread)) return { ok: false, reason: "not_awaiting_fee" };

    const amount = resolveFeeAmount(thread);
    Fee.ensurePendingFee?.(resolveListing(thread), thread, { feeAmount: amount });

    const activated = Fee.activateThreadAfterPayment?.(threadId);
    if (!activated?.ok) return activated || { ok: false, reason: "activate_failed" };
    return { ok: true, thread: activated.thread, activated: true };
  }

  global.TasuPlatformChatStartFeeCard = {
    CARD_KIND,
    CARD_TITLE,
    isFeePayer,
    isAwaitingStartFee,
    ensureCardMessages,
    seedStartFeeCardMessage,
    renderStartFeeCardHtml,
    completeStartFeePayment,
  };
})(typeof window !== "undefined" ? window : globalThis);
