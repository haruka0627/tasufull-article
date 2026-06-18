/**
 * Connectなし — やりとり開始前ゲート（相手確認 → 550円 → チャット解放）
 */
(function (global) {
  "use strict";

  const PHASE = Object.freeze({
    AWAITING_PARTNER: "awaiting_partner",
    AWAITING_FEE: "awaiting_fee",
    DECLINED: "declined",
  });

  const PROCEED_BTN = "チャットに進む";
  const DECLINE_BTN = "断る";

  const COPY = Object.freeze({
    skill: {
      purchase: {
        cardTitle: "購入希望者がいます",
        waitTitle: "出品者の確認をお待ちください",
        waitBody: "出品者が内容を確認するまでお待ちください。やりとりが開始されると通知でお知らせします。",
      },
      inquiry: {
        cardTitle: "お問い合わせがあります",
        waitTitle: "出品者の確認をお待ちください",
        waitBody: "出品者が内容を確認するまでお待ちください。",
      },
    },
    product: {
      purchase: {
        cardTitle: "購入希望者がいます",
        waitTitle: "出品者の確認をお待ちください",
        waitBody: "出品者が内容を確認するまでお待ちください。やりとりが開始されると通知でお知らせします。",
      },
    },
    worker: {
      request: {
        cardTitle: "依頼者がいます",
        waitTitle: "ワーカーの確認をお待ちください",
        waitBody: "ワーカーが内容を確認するまでお待ちください。",
      },
    },
  });

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

  function formatNameWithSan(name) {
    const n = pickStr(name);
    if (!n) return "相手";
    return n.endsWith("さん") ? n : `${n} さん`;
  }

  function normalizeCategoryKey(thread) {
    const Fee = global.TasuPlatformChatFee;
    const raw = pickStr(
      thread?.listingType,
      thread?.category,
      thread?.listing_type
    );
    if (Fee?.resolveCategoryKey) {
      return Fee.resolveCategoryKey({ listing_type: raw, category: raw });
    }
    const key = raw.toLowerCase().replace(/-/g, "_");
    if (key === "shop") return "shop_store";
    if (key === "business" || key === "field_service") return "business_service";
    return key;
  }

  function resolveContactKind(thread) {
    return pickStr(thread?.platformContactKind, thread?.contactKind, "purchase");
  }

  function resolveFlowCopyCategory(cat) {
    const Category = global.TasuPlatformChatCategoryFlow;
    const base = Category?.resolveFlowBaseKey?.(cat) || cat;
    if (base === "product") return "product";
    if (base === "worker") return "worker";
    return cat;
  }

  function resolveCopy(thread) {
    const cat = normalizeCategoryKey(thread);
    const flowCat = resolveFlowCopyCategory(cat);
    const kind = resolveContactKind(thread);
    const bucket = COPY[flowCat] || COPY.skill;
    return bucket[kind] || bucket.purchase || bucket.consult || bucket.request || COPY.skill.purchase;
  }

  function buildPartnerBody(thread) {
    const copy = resolveCopy(thread);
    const requesterName = formatNameWithSan(pickStr(thread?.buyerName, "購入者"));
    const cat = normalizeCategoryKey(thread);
    const kind = resolveContactKind(thread);

    const Category = global.TasuPlatformChatCategoryFlow;
    const flowBase = Category?.resolveFlowBaseKey?.(cat) || cat;
    if (flowBase === "worker" || kind === "request") {
      return `${requesterName}から依頼がありました。やりとりを開始するか選択してください。`;
    }
    if (kind === "inquiry" || kind === "consult" || kind === "estimate") {
      return `${requesterName}からお問い合わせがありました。やりとりを開始するか選択してください。`;
    }
    if (flowBase === "product") {
      return `${requesterName}がこの商品を購入しました。やりとりを開始するか選択してください。`;
    }
    return `${requesterName}がこのスキルを購入しました。やりとりを開始するか選択してください。`;
  }

  function isConnectThread(thread) {
    if (global.TasuPlatformChatConnectEntryFlow?.isConnectEntryThread?.(thread) === true) {
      return true;
    }
    const Connect = global.TasuPlatformChatConnectChatFlow;
    if (Connect?.isConnectThread?.(thread) === true) return true;
    if (Connect?.shouldUseConnectCompletionUi?.(thread) === true) return true;
    if (pickStr(thread?.dealId)) {
      const listing = {
        id: thread?.listingId,
        listing_type: thread?.listingType,
      };
      return global.TasuPlatformChatFee?.hasStripeConnect?.(listing, normalizeCategoryKey(thread)) === true;
    }
    return false;
  }

  function getPhase(thread) {
    const explicit = pickStr(thread?.platformStartPhase);
    if (explicit) return explicit;
    const rs = pickStr(thread?.roomStatus, thread?.status).toLowerCase();
    if (rs === "cancelled") return PHASE.DECLINED;
    if (rs === "fee_pending") return PHASE.AWAITING_PARTNER;
    return "";
  }

  function isGatedPlainThread(thread) {
    if (!thread || typeof thread !== "object") return false;
    if (isConnectThread(thread)) return false;

    const cat = normalizeCategoryKey(thread);
    const Fee = global.TasuPlatformChatFee;
    if (cat === "job") return false;
    if (!Fee?.isFeeApplicableCategory?.(cat)) return false;

    const listing = {
      id: thread.listingId,
      listing_type: thread.listingType,
    };
    if (Fee?.hasStripeConnect?.(listing, cat)) return false;

    const phase = getPhase(thread);
    if (phase === PHASE.DECLINED) return true;

    const rs = pickStr(thread.roomStatus, thread.status).toLowerCase();
    if (rs === "fee_pending") return true;

    if (rs === "cancelled" && pickStr(thread.cancelReason) === "partner_declined") return true;
    return false;
  }

  function isPartnerSide(thread, userId) {
    const me = pickStr(userId);
    const sellerId = pickStr(thread?.sellerId, thread?.partnerUserId);
    return Boolean(me && sellerId && me === sellerId);
  }

  function isRequesterSide(thread, userId) {
    const me = pickStr(userId);
    const buyerId = pickStr(thread?.buyerId);
    return Boolean(me && buyerId && me === buyerId);
  }

  function isFeePaid(thread) {
    const threadId = pickStr(thread?.id, thread?.threadId);
    return global.TasuPlatformChatFee?.isFeePaid?.(threadId) === true;
  }

  /**
   * Connectなし — 550円前は chat-detail を開かない（判断は管理ページ側）
   */
  function shouldBlockChatDetailAccess(thread) {
    if (!thread || typeof thread !== "object") return false;
    if (isConnectThread(thread)) return false;

    const Fee = global.TasuPlatformChatFee;
    const threadId = pickStr(thread?.id, thread?.threadId);
    if (threadId && Fee?.isFeePaid?.(threadId)) return false;

    const rs = pickStr(thread?.roomStatus, thread?.status).toLowerCase();
    const phase = getPhase(thread);
    const kind = String(thread?.threadKind || "");
    const listing = {
      id: thread?.listingId,
      listing_type: thread?.listingType,
    };
    const cat = Fee?.resolveCategoryKey?.(listing) || normalizeCategoryKey(thread);
    const platformPreChat =
      (Fee?.isJobCategory?.(cat) || Fee?.isFeeApplicableCategory?.(cat)) &&
      Fee?.hasStripeConnect?.(listing, cat) !== true;

    if (phase === PHASE.DECLINED) return platformPreChat || kind === "job_hire" || kind === "worker_request";
    if (rs === "cancelled" && pickStr(thread?.cancelReason) === "partner_declined") {
      return platformPreChat || kind === "job_hire" || kind === "worker_request";
    }

    if (rs === "fee_pending" && platformPreChat) return true;
    if (kind === "job_hire" || kind === "worker_request") {
      if (rs === "fee_pending" || phase === PHASE.AWAITING_PARTNER || phase === PHASE.AWAITING_FEE) {
        return true;
      }
    }

    if (isGatedPlainThread(thread)) {
      if (phase === PHASE.AWAITING_PARTNER || phase === PHASE.AWAITING_FEE) return true;
      if (rs === "fee_pending") return true;
    }

    return false;
  }

  /** @deprecated chat-detail では常に false（ゲート UI は管理ページのみ） */
  function shouldShowPreStartUi(thread, userId) {
    return false;
  }

  function buildListingDetailUrl(listingId, thread) {
    const id = pickStr(listingId);
    if (!id) return null;
    const Fee = global.TasuPlatformChatFee;
    const cat = Fee?.resolveCategoryKey?.({
      id,
      listing_type: thread?.listingType,
    }) || normalizeCategoryKey(thread);
    const routeType =
      cat === "shop_store" || cat === "shop"
        ? "shop"
        : cat === "business_service" || cat === "business"
          ? "business_service"
          : cat === "product"
            ? "product"
            : cat === "worker"
              ? "worker"
              : cat === "job"
                ? "job"
                : "skill";
    return global.TasuListingRouteResolver?.buildDetailUrl?.(routeType, id) || null;
  }

  function resolveManagementRedirectUrl(thread) {
    if (!thread || !shouldBlockChatDetailAccess(thread)) return null;

    const listingId = pickStr(thread.listingId);
    if (!listingId) return null;

    const rs = pickStr(thread?.roomStatus, thread?.status).toLowerCase();
    const phase = getPhase(thread);
    const Notify = global.TasuTalkPlatformNotify;
    const listing = {
      id: listingId,
      listing_type: thread.listingType,
      title: thread.listingTitle,
    };

    if (phase === PHASE.DECLINED || (rs === "cancelled" && pickStr(thread?.cancelReason) === "partner_declined")) {
      return buildListingDetailUrl(listingId, thread);
    }

    if (String(thread.threadKind || "") === "job_hire") {
      return Notify?.buildJobApplicationsNotifyUrl?.(listingId, listing) || null;
    }
    if (String(thread.threadKind || "") === "worker_request") {
      return Notify?.buildWorkerRequestsNotifyUrl?.(listingId, listing) || null;
    }
    return (
      Notify?.buildListingContactsNotifyUrl?.(listingId, listing, {
        contactId: thread.contactId,
        category: thread.listingType,
      }) || null
    );
  }

  function shouldRedirectToManagementPage(thread) {
    const url = resolveManagementRedirectUrl(thread);
    return url && url !== "#" ? url : null;
  }

  function readThread(threadId) {
    const id = pickStr(threadId);
    if (!id) return null;
    const store = global.TasuChatThreadStore;
    const loaded = store?.loadRoom?.(id);
    if (loaded?.thread) return loaded.thread;
    return (store?.readAll?.() || []).find((row) => String(row.id) === id) || null;
  }

  function writeThread(thread) {
    const store = global.TasuChatThreadStore;
    if (!store?.readAll || !store?.writeAll || !thread?.id) return null;
    const list = store.readAll();
    const idx = list.findIndex((row) => String(row.id) === String(thread.id));
    if (idx < 0) return null;
    list[idx] = { ...list[idx], ...thread, updatedAt: new Date().toISOString() };
    store.writeAll(list);
    return list[idx];
  }

  function clearThreadMessages(threadId) {
    const store = global.TasuChatThreadStore;
    if (!store?.MESSAGES_KEY) return;
    try {
      if (typeof store.writeMessagesMap === "function") {
        store.writeMessagesMap({ [threadId]: [] });
        return;
      }
      const raw = global.localStorage.getItem(store.MESSAGES_KEY);
      const map = raw ? JSON.parse(raw) : {};
      map[threadId] = [];
      global.localStorage.setItem(store.MESSAGES_KEY, JSON.stringify(map));
    } catch {
      /* ignore */
    }
  }

  function migrateThreadPhase(threadId, thread) {
    const row = readThread(threadId) || thread;
    if (!row || !isGatedPlainThread(row)) return row;
    if (pickStr(row.platformStartPhase)) return row;

    const id = pickStr(threadId, row.id);
    const store = global.TasuChatThreadStore;
    const messages = store?.getMessages?.(id) || [];
    const hasFeeCard = messages.some((m) => m?.kind === "pre_chat_start_fee_card");
    const nextPhase = hasFeeCard ? PHASE.AWAITING_FEE : PHASE.AWAITING_PARTNER;

    if (!hasFeeCard && messages.length > 0) {
      clearThreadMessages(id);
    }

    return writeThread({
      ...row,
      platformStartPhase: nextPhase,
    });
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

  function notifyFeeRequired(thread) {
    try {
      global.TasuTalkPlatformFeeNotify?.notifyChatFeeRequired?.({
        listing: resolveListing(thread),
        thread,
        recipientRole: "seller",
        recipientUserId: pickStr(thread?.sellerId, thread?.partnerUserId),
      });
    } catch {
      /* ignore */
    }
  }

  function notifyDeclined(thread, declinedBy) {
    try {
      global.TasuTalkPlatformNotify?.notifyListingContactDeclined?.({
        thread,
        listing: resolveListing(thread),
        declinedBy,
      });
    } catch {
      /* ignore */
    }
    try {
      if (global.TasuPlatformChatDualWindowDemo?.isDemoThread?.(thread?.id) === true) {
        global.TasuPlatformChatDualWindowNotify?.notifyDemoContactDeclined?.({
          thread,
          threadId: thread?.id,
          declinedBy,
        });
      }
    } catch {
      /* ignore */
    }
  }

  function proceedToFee(threadId, userId) {
    const thread = readThread(threadId);
    if (!thread) return { ok: false, reason: "thread_not_found" };
    if (!isGatedPlainThread(thread)) return { ok: false, reason: "not_gated" };
    if (!isPartnerSide(thread, userId)) return { ok: false, reason: "not_partner" };
    if (getPhase(thread) !== PHASE.AWAITING_PARTNER) {
      return { ok: false, reason: "invalid_phase" };
    }

    const listing = resolveListing(thread);
    const Fee = global.TasuPlatformChatFee;
    Fee?.ensurePendingFee?.(listing, thread, {});

    const updated = writeThread({
      ...thread,
      platformStartPhase: PHASE.AWAITING_FEE,
      roomStatus: "fee_pending",
      status: "fee_pending",
    });

    notifyFeeRequired(updated);
    return { ok: true, thread: updated };
  }

  function declineContact(threadId, userId) {
    const thread = readThread(threadId);
    if (!thread) return { ok: false, reason: "thread_not_found" };
    if (!isGatedPlainThread(thread)) return { ok: false, reason: "not_gated" };
    if (!isPartnerSide(thread, userId)) return { ok: false, reason: "not_partner" };
    const phase = getPhase(thread);
    if (phase !== PHASE.AWAITING_PARTNER && phase !== PHASE.AWAITING_FEE) {
      return { ok: false, reason: "invalid_phase" };
    }

    const now = new Date().toISOString();
    const updated = writeThread({
      ...thread,
      platformStartPhase: PHASE.DECLINED,
      roomStatus: "cancelled",
      status: "cancelled",
      cancelReason: "partner_declined",
      cancelledBy: userId,
      cancelledAt: now,
      lastMessage: "今回は見送りになりました",
    });

    clearThreadMessages(threadId);
    notifyDeclined(updated, userId);
    return { ok: true, thread: updated };
  }

  function buildFeeCardHtml(thread, userId) {
    const StartFee = global.TasuPlatformChatStartFeeCard;
    if (!StartFee?.renderStartFeeCardHtml) return "";
    const amount = global.TasuPlatformChatFee?.calcPreChatFee?.(resolveListing(thread)) || 550;
    const synthetic = {
      kind: StartFee.CARD_KIND,
      startFeeCard: {
        title: StartFee.CARD_TITLE,
        amountYen: amount,
      },
    };
    return StartFee.renderStartFeeCardHtml(synthetic, thread, userId);
  }

  function renderPartnerCardHtml(thread) {
    const copy = resolveCopy(thread);
    const requesterName = pickStr(thread?.buyerName, "購入者");
    const listingTitle = pickStr(thread?.listingTitle, "出品");
    return (
      `<div class="platform-contact-gate" data-platform-contact-gate>` +
      `<article class="platform-contact-gate__card" aria-label="${esc(copy.cardTitle)}">` +
      `<h2 class="platform-contact-gate__title">${esc(copy.cardTitle)}</h2>` +
      `<p class="platform-contact-gate__body">${esc(buildPartnerBody(thread))}</p>` +
      `<p class="platform-contact-gate__meta">${esc(listingTitle)} — ${esc(requesterName)}</p>` +
      `<div class="platform-contact-gate__actions">` +
      `<button type="button" class="platform-contact-gate__btn platform-contact-gate__btn--primary" data-contact-gate-proceed onclick="window.TasuPlatformChatContactGate.__uiProceed(event)">${esc(PROCEED_BTN)}</button>` +
      `<button type="button" class="platform-contact-gate__btn platform-contact-gate__btn--ghost" data-contact-gate-decline onclick="window.TasuPlatformChatContactGate.__uiDecline(event)">${esc(DECLINE_BTN)}</button>` +
      `</div>` +
      `</article>` +
      `</div>`
    );
  }

  function renderWaitCardHtml(thread) {
    const copy = resolveCopy(thread);
    return (
      `<div class="platform-contact-gate" data-platform-contact-gate>` +
      `<article class="platform-contact-gate__card platform-contact-gate__card--wait" aria-label="${esc(copy.waitTitle)}">` +
      `<h2 class="platform-contact-gate__title">${esc(copy.waitTitle)}</h2>` +
      `<p class="platform-contact-gate__body">${esc(copy.waitBody)}</p>` +
      `</article>` +
      `</div>`
    );
  }

  function renderRequesterFeeWaitCardHtml(thread) {
    const copy = resolveCopy(thread);
    const partnerLabel = pickStr(thread?.sellerName, "相手");
    const body =
      pickStr(copy.feeWaitBody) ||
      `${partnerLabel} さんのやりとり開始料のお支払いをお待ちください。支払い完了後にチャットが解放されます。`;
    return (
      `<div class="platform-contact-gate" data-platform-contact-gate>` +
      `<article class="platform-contact-gate__card platform-contact-gate__card--wait" aria-label="${esc(copy.feeWaitTitle || "やりとり開始待ち")}">` +
      `<h2 class="platform-contact-gate__title">${esc(copy.feeWaitTitle || "やりとり開始をお待ちください")}</h2>` +
      `<p class="platform-contact-gate__body">${esc(body)}</p>` +
      `</article>` +
      `</div>`
    );
  }

  function renderDeclinedCardHtml() {
    return (
      `<div class="platform-contact-gate" data-platform-contact-gate>` +
      `<article class="platform-contact-gate__card platform-contact-gate__card--declined" aria-label="見送り">` +
      `<h2 class="platform-contact-gate__title">今回は見送りになりました</h2>` +
      `<p class="platform-contact-gate__body">やりとりは開始されませんでした。</p>` +
      `</article>` +
      `</div>`
    );
  }

  function renderPreStartPanelHtml(thread, userId) {
    if (!thread) return "";
    const phase = getPhase(thread);

    if (phase === PHASE.DECLINED) {
      return renderDeclinedCardHtml();
    }

    if (phase === PHASE.AWAITING_PARTNER) {
      if (isPartnerSide(thread, userId)) return renderPartnerCardHtml(thread);
      if (isRequesterSide(thread, userId)) return renderWaitCardHtml(thread);
      return renderWaitCardHtml(thread);
    }

    if (phase === PHASE.AWAITING_FEE) {
      if (isPartnerSide(thread, userId)) {
        return (
          `<div class="platform-contact-gate" data-platform-contact-gate>` +
          buildFeeCardHtml(thread, userId) +
          `</div>`
        );
      }
      if (isRequesterSide(thread, userId)) {
        return renderRequesterFeeWaitCardHtml(thread);
      }
      return renderRequesterFeeWaitCardHtml(thread);
    }

    return renderWaitCardHtml(thread);
  }

  function resolveActorId(fallback) {
    const Identity = global.TasuChatUserIdentity;
    return pickStr(
      Identity?.getEffectiveUserId?.(),
      Identity?.getCurrentUserId?.(),
      fallback
    );
  }

  const panelHooks = new WeakMap();

  function bindPreStartPanel(container, thread, userId, hooks) {
    if (!container) return;
    panelHooks.set(container, { thread, userId, hooks });

    if (global.__tasuContactGateDocBound === true) return;
    global.__tasuContactGateDocBound = true;

    global.document.addEventListener("click", (ev) => {
      const gateRoot = ev.target.closest("[data-platform-contact-gate]");
      if (!gateRoot) return;
      const host = gateRoot.closest("#chatMessages");
      if (!host) return;
      const ctx = panelHooks.get(host);
      if (!ctx) return;

      const proceedBtn = ev.target.closest("[data-contact-gate-proceed]");
      const declineBtn = ev.target.closest("[data-contact-gate-decline]");
      const payBtn = ev.target.closest("[data-start-fee-pay]");
      const threadId = pickStr(
        ctx.thread?.id,
        global.TasuChatService?.getRoomIdFromLocation?.()
      );

      if (proceedBtn) {
        ev.preventDefault();
        proceedBtn.disabled = true;
        const actorId = resolveActorId(ctx.userId);
        const res = proceedToFee(threadId, actorId);
        if (!res?.ok) {
          proceedBtn.disabled = false;
          return;
        }
        ctx.hooks?.onProceed?.(res);
        return;
      }

      if (declineBtn) {
        ev.preventDefault();
        declineBtn.disabled = true;
        const actorId = resolveActorId(ctx.userId);
        const res = declineContact(threadId, actorId);
        if (!res?.ok) {
          declineBtn.disabled = false;
          return;
        }
        ctx.hooks?.onDecline?.(res);
        return;
      }

      if (payBtn) {
        ev.preventDefault();
        const StartFee = global.TasuPlatformChatStartFeeCard;
        if (!StartFee?.completeStartFeePayment || !threadId) return;
        payBtn.disabled = true;
        const actorId = resolveActorId(ctx.userId);
        const res = StartFee.completeStartFeePayment({
          threadId,
          thread: readThread(threadId) || ctx.thread,
          userId: actorId,
        });
        if (!res?.ok) {
          payBtn.disabled = false;
          return;
        }
        ctx.hooks?.onFeePaid?.(res);
      }
    });
  }

  function ensureThreadDefaults(thread, options) {
    if (!thread) return thread;
    const feePending = options?.feePending === true;
    if (!feePending) return thread;
    return {
      ...thread,
      platformStartPhase: pickStr(thread.platformStartPhase) || PHASE.AWAITING_PARTNER,
      platformContactKind: pickStr(thread.platformContactKind, options?.intent, "purchase"),
      roomStatus: "fee_pending",
      status: "fee_pending",
    };
  }

  function dispatchGateChange(detail) {
    try {
      global.dispatchEvent(new CustomEvent("tasu:contact-gate-changed", { detail }));
    } catch {
      /* ignore */
    }
    if (detail?.ok && typeof global.__tasuChatDetailReload === "function") {
      try {
        global.__tasuChatDetailReload(detail);
      } catch {
        /* ignore */
      }
    }
  }

  function __uiProceed(ev) {
    if (ev?.preventDefault) ev.preventDefault();
    const btn = ev?.currentTarget;
    if (btn instanceof global.HTMLButtonElement) btn.disabled = true;
    const threadId = pickStr(global.TasuChatService?.getRoomIdFromLocation?.());
    const res = proceedToFee(threadId, resolveActorId());
    if (!res?.ok && btn instanceof global.HTMLButtonElement) btn.disabled = false;
    dispatchGateChange(res);
    return res;
  }

  function __uiDecline(ev) {
    if (ev?.preventDefault) ev.preventDefault();
    const btn = ev?.currentTarget;
    if (btn instanceof global.HTMLButtonElement) btn.disabled = true;
    const threadId = pickStr(global.TasuChatService?.getRoomIdFromLocation?.());
    const res = declineContact(threadId, resolveActorId());
    if (!res?.ok && btn instanceof global.HTMLButtonElement) btn.disabled = false;
    dispatchGateChange(res);
    return res;
  }

  function __uiPayFee(ev) {
    if (ev?.preventDefault) ev.preventDefault();
    const btn = ev?.currentTarget;
    if (btn instanceof global.HTMLButtonElement) btn.disabled = true;
    const threadId = pickStr(global.TasuChatService?.getRoomIdFromLocation?.());
    const thread = readThread(threadId);
    const StartFee = global.TasuPlatformChatStartFeeCard;
    const res = StartFee?.completeStartFeePayment?.({
      threadId,
      thread,
      userId: resolveActorId(),
    });
    if (!res?.ok && btn instanceof global.HTMLButtonElement) btn.disabled = false;
    dispatchGateChange(res);
    return res;
  }

  global.TasuPlatformChatContactGate = {
    PHASE,
    PROCEED_BTN,
    DECLINE_BTN,
    getPhase,
    isGatedPlainThread,
    isPartnerSide,
    isRequesterSide,
    isFeePayer: isPartnerSide,
    shouldBlockChatDetailAccess,
    shouldShowPreStartUi,
    resolveManagementRedirectUrl,
    shouldRedirectToManagementPage,
    buildListingDetailUrl,
    migrateThreadPhase,
    proceedToFee,
    declineContact,
    renderPreStartPanelHtml,
    bindPreStartPanel,
    ensureThreadDefaults,
    __uiProceed,
    __uiDecline,
    __uiPayFee,
  };
})(typeof window !== "undefined" ? window : globalThis);
