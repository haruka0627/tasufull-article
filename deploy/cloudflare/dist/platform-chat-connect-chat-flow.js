/**
 * Connect — チャット内 完了申請カード / 支払い / 返金
 */
(function (global) {
  "use strict";

  const PAYMENT_STORAGE_KEY = "tasful_platform_connect_payments_v1";
  const SELLER_STATUS_KEY = "tasful_demo_connect_seller_status_v1";

  const PENDING_CARD_TITLE = "やりとり完了申請";
  const PENDING_CARD_BODY = "承認すると報酬が支払われます。";
  const PAYMENT_CARD_TITLE = "✓ やりとりが完了しました";
  const PAYMENT_CARD_BODY = "報酬の支払いが完了しました";
  const REFUND_CARD_TITLE = "✓ 返金処理が完了しました";
  const PAY_REQUIRED_TITLE = "TASFUL決済でお支払い";
  const PAY_REQUIRED_BODY =
    "この取引はTASFUL決済対象です。承認後、TASFUL経由で支払いを行います。";
  const PAY_REQUIRED_BTN = "支払いを完了する";

  const NOTIFY_SOURCE_PAYMENT = "platform_chat_demo_connect_payment_done_v1";
  const NOTIFY_SOURCE_REFUND = "platform_chat_demo_connect_refund_done_v1";

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

  function isConnectThread(thread) {
    if (global.TasuPlatformChatConnectEntryFlow?.isConnectEntryThread?.(thread) === true) {
      return false;
    }
    const Category = global.TasuPlatformChatCategoryFlow;
    const listing = {
      id: thread?.listingId,
      listing_type: thread?.listingType,
      listingType: thread?.listingType,
    };
    if (Category?.usesConnectEntryPayment?.(listing) === true) return false;
    const profile = global.TasuPlatformChatDualWindowDemo?.resolveProfileForThread?.(thread);
    if (profile?.connect && Category?.isMarketplaceConnectCategory?.(profile.categoryKey || profile.id)) {
      return false;
    }
    if (profile?.connect) return true;
    return global.TasuPlatformChatFee?.shouldNotifyOnCompletion?.(listing) === true;
  }

  function shouldUseConnectCompletionUi(thread) {
    if (
      global.TasuPlatformChatConnectEntryFlow?.isConnectEntryThread?.(thread) === true ||
      thread?.connectEntryPayment === true
    ) {
      return false;
    }
    const status = global.TasuPlatformChatCompletionFlow?.getCompletionStatus?.(thread);
    if (
      status === "completion_pending" &&
      global.TasuPlatformChatDualWindowDemo?.isDemoThread?.(thread?.id || thread) === true
    ) {
      const Demo = global.TasuPlatformChatDualWindowDemo;
      const Category = global.TasuPlatformChatCategoryFlow;
      const profile = Demo?.resolveProfileForThread?.(thread);
      if (Category?.isMarketplaceConnectEntryProfile?.(profile) === true) {
        return false;
      }
      return true;
    }
    return isConnectThread(thread);
  }

  function buildPendingApprovalCardMessage(threadId, thread) {
    const Category = global.TasuPlatformChatCategoryFlow;
    const Completion = global.TasuPlatformChatCompletionFlow;
    const labels = Category?.getLabels?.(thread) || {};
    const requesterId = pickStr(thread?.completionRequestedBy);
    const requesterName =
      Completion?.resolveActorDisplayName?.(requesterId, thread) ||
      Category?.resolveActorDisplayName?.(requesterId, thread) ||
      "申請者";
    const listingTitle = pickStr(thread?.listingTitle, labels.categoryLabel, "対象案件");
    const deliverySummary = pickStr(
      thread?.completionDeliverySummary,
      thread?.listingTitle,
      labels.categoryLabel,
      "納品内容の確認をお願いします"
    );
    return {
      id: `msg-${threadId}-connect-pending-card`,
      chatId: threadId,
      roomId: threadId,
      senderId: "__system__",
      senderName: "TASFUL",
      text: "",
      createdAt: new Date().toISOString(),
      kind: "connect_completion_pending_card",
      connectCompletionCard: {
        title: pickStr(labels.connectPendingTitle, PENDING_CARD_TITLE),
        body: pickStr(labels.connectPendingBody, PENDING_CARD_BODY),
        deliverySummary,
        requesterName,
        listingTitle,
        status: "pending",
      },
    };
  }

  function buildPaymentDoneCardMessage(threadId, thread) {
    const labels = global.TasuPlatformChatCategoryFlow?.getLabels?.(thread) || {};
    return {
      id: `msg-${threadId}-connect-payment-card`,
      chatId: threadId,
      roomId: threadId,
      senderId: "__system__",
      senderName: "TASFUL",
      text: "",
      createdAt: new Date().toISOString(),
      kind: "connect_payment_done_card",
      connectPaymentCard: {
        title: PAYMENT_CARD_TITLE,
        body: PAYMENT_CARD_BODY,
      },
    };
  }

  function buildRefundDoneCardMessage(threadId) {
    return {
      id: `msg-${threadId}-connect-refund-card`,
      chatId: threadId,
      roomId: threadId,
      senderId: "__system__",
      senderName: "TASFUL",
      text: "",
      createdAt: new Date().toISOString(),
      kind: "connect_refund_done_card",
      connectRefundCard: {
        title: REFUND_CARD_TITLE,
      },
    };
  }

  function writeMessages(threadId, messages) {
    const store = global.TasuChatThreadStore;
    if (!store?.MESSAGES_KEY) return;
    if (typeof store.writeMessagesMap === "function") {
      store.writeMessagesMap({ [threadId]: messages });
      return;
    }
    try {
      const raw = global.localStorage.getItem(store.MESSAGES_KEY);
      const map = raw ? JSON.parse(raw) : {};
      map[threadId] = messages;
      global.localStorage.setItem(store.MESSAGES_KEY, JSON.stringify(map));
    } catch {
      /* ignore */
    }
  }

  function readMessages(threadId) {
    const store = global.TasuChatThreadStore;
    try {
      const raw = global.localStorage.getItem(store.MESSAGES_KEY);
      const map = raw ? JSON.parse(raw) : {};
      return Array.isArray(map[threadId]) ? map[threadId] : [];
    } catch {
      return [];
    }
  }

  function readMap(key) {
    try {
      const raw = global.localStorage?.getItem(key);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeMap(key, map) {
    try {
      global.localStorage?.setItem(key, JSON.stringify(map || {}));
    } catch {
      /* ignore */
    }
  }

  function getPaymentState(threadId) {
    const id = pickStr(threadId);
    if (!id) return { status: "none" };
    const map = readMap(PAYMENT_STORAGE_KEY);
    const row = map[id];
    if (!row || typeof row !== "object") return { status: "none" };
    return {
      status: pickStr(row.status, "none"),
      paidAt: pickStr(row.paidAt),
      refundedAt: pickStr(row.refundedAt),
    };
  }

  function setPaymentState(threadId, patch) {
    const id = pickStr(threadId);
    if (!id) return getPaymentState(id);
    const map = readMap(PAYMENT_STORAGE_KEY);
    map[id] = {
      ...(map[id] || {}),
      ...(patch || {}),
      updatedAt: new Date().toISOString(),
    };
    writeMap(PAYMENT_STORAGE_KEY, map);
    return getPaymentState(id);
  }

  function isPaymentCompletedForReview(thread) {
    const id = pickStr(thread?.id, thread?.threadId);
    if (!id) return false;
    return pickStr(getPaymentState(id)?.status).toLowerCase() === "paid";
  }

  function buildConnectPaymentRequiredCardMessage(threadId) {
    return {
      id: `msg-${threadId}-connect-pay-required-card`,
      chatId: threadId,
      roomId: threadId,
      senderId: "__system__",
      senderName: "TASFUL",
      text: "",
      createdAt: new Date().toISOString(),
      kind: "connect_payment_required_card",
      connectPayRequiredCard: {
        title: PAY_REQUIRED_TITLE,
        body: PAY_REQUIRED_BODY,
        button: PAY_REQUIRED_BTN,
      },
    };
  }

  function appendConnectPaymentRequiredCard(threadId) {
    const id = pickStr(threadId);
    if (!id) return { ok: false, reason: "missing_thread_id" };
    const list = readMessages(id);
    if (list.some((m) => m.kind === "connect_payment_required_card")) {
      return { ok: true, skipped: true };
    }
    list.push(buildConnectPaymentRequiredCardMessage(id));
    writeMessages(id, list);
    setPaymentState(id, { status: "pending" });
    return { ok: true };
  }

  function pushRuntimeNotification(draft) {
    const store = global.TasuTalkNotifications;
    if (!store?.getAll || !store?.saveAll) return { ok: false, reason: "missing_store" };
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
      global.dispatchEvent(new CustomEvent("tasful-talk-notifications-changed", { detail: { notifyOnly: true } }));
    } catch {
      /* ignore */
    }
    return { ok: true, notification: row };
  }

  function resolveOtherUserId(thread, actorId) {
    const me = pickStr(actorId);
    const sellerId = pickStr(thread?.sellerId);
    const buyerId = pickStr(thread?.buyerId);
    if (me && me === sellerId) return buyerId;
    if (me && me === buyerId) return sellerId;
    return "";
  }

  function notifyPaymentDone(thread, threadId, buyerId) {
    const sellerId = resolveOtherUserId(thread, buyerId);
    if (!sellerId) return { ok: false };
    const Demo = global.TasuPlatformChatDualWindowDemo;
    const profile = Demo?.resolveProfileForThread?.(thread || threadId);
    const href =
      Demo?.chatUrl?.(profile?.id || "skill", sellerId, {
        review: Demo.REVIEW_PARAM || "chat-demo",
        connect: true,
        state: "connect-pay",
        from: "notify",
      }) || "#";
    const id = `platform-chat-demo-connect-payment-done-${threadId}-${sellerId}`;
    return pushRuntimeNotification({
      id,
      type: "skill",
      category: pickStr(thread?.category, "スキル"),
      title: "支払いが完了しました",
      body: "購入者がTASFUL決済で支払いを完了しました。",
      actionLabel: "確認する",
      href,
      targetUrl: href,
      priority: "high",
      sendTalkMessage: true,
      officialRoomId: "official_tasful",
      source: NOTIFY_SOURCE_PAYMENT,
      senderUserId: buyerId,
      recipientUserId: sellerId,
      threadId,
      listingId: pickStr(thread?.listingId),
      notifyListingTitle: pickStr(thread?.listingTitle),
      minimalNotifyCard: true,
      demoState: "connect-pay",
    });
  }

  function notifyRefundDone(thread, threadId, sellerId) {
    const buyerId = resolveOtherUserId(thread, sellerId);
    if (!buyerId) return { ok: false };
    const Demo = global.TasuPlatformChatDualWindowDemo;
    const profile = Demo?.resolveProfileForThread?.(thread || threadId);
    const href =
      Demo?.chatUrl?.(profile?.id || "skill", buyerId, {
        review: Demo.REVIEW_PARAM || "chat-demo",
        connect: true,
        state: "connect-refund",
        from: "notify",
      }) || "#";
    const id = `platform-chat-demo-connect-refund-done-${threadId}-${buyerId}`;
    return pushRuntimeNotification({
      id,
      type: "skill",
      category: pickStr(thread?.category, "スキル"),
      title: "返金が処理されました",
      body: "キャンセルに伴う返金が処理されました。",
      actionLabel: "確認する",
      href,
      targetUrl: href,
      priority: "high",
      sendTalkMessage: true,
      officialRoomId: "official_tasful",
      source: NOTIFY_SOURCE_REFUND,
      senderUserId: sellerId,
      recipientUserId: buyerId,
      threadId,
      listingId: pickStr(thread?.listingId),
      notifyListingTitle: pickStr(thread?.listingTitle),
      minimalNotifyCard: true,
      demoState: "connect-refund",
    });
  }

  function completeConnectPayment({ threadId, thread, userId }) {
    const id = pickStr(threadId, thread?.id);
    const buyerId = pickStr(userId);
    if (!id || !thread || !buyerId) return { ok: false, reason: "missing_context" };
    if (pickStr(thread?.buyerId) && pickStr(thread?.buyerId) !== buyerId) {
      return { ok: false, reason: "not_buyer" };
    }
    setPaymentState(id, { status: "paid", paidAt: new Date().toISOString() });
    appendPaymentDoneCard(id, thread);
    try {
      notifyPaymentDone(thread, id, buyerId);
    } catch {
      /* ignore */
    }
    try {
      global.dispatchEvent(new CustomEvent("tasful-chat-threads-changed"));
    } catch {
      /* ignore */
    }
    return { ok: true };
  }

  function markConnectRefunded({ threadId, thread, userId }) {
    const id = pickStr(threadId, thread?.id);
    const sellerId = pickStr(userId);
    if (!id || !thread || !sellerId) return { ok: false, reason: "missing_context" };
    setPaymentState(id, { status: "refunded", refundedAt: new Date().toISOString() });
    appendRefundDoneCard(id);
    try {
      notifyRefundDone(thread, id, sellerId);
    } catch {
      /* ignore */
    }
    return { ok: true, refunded: true };
  }

  function getSellerConnectStatus(sellerId) {
    const sid = pickStr(sellerId);
    if (!sid) return "ready";
    const map = readMap(SELLER_STATUS_KEY);
    const raw = pickStr(map[sid]?.status, map[sid]);
    if (raw === "identity") return "identity";
    if (raw === "payout") return "payout";
    return "ready";
  }

  function setSellerConnectStatus(sellerId, status) {
    const sid = pickStr(sellerId);
    if (!sid) return { ok: false, reason: "missing_seller" };
    const map = readMap(SELLER_STATUS_KEY);
    map[sid] = { status: pickStr(status, "ready"), updatedAt: new Date().toISOString() };
    writeMap(SELLER_STATUS_KEY, map);
    return { ok: true, sellerId: sid, status: pickStr(status, "ready") };
  }

  function removeNotificationsByIds(ids) {
    const store = global.TasuTalkNotifications;
    if (!store?.getAll || !store?.saveAll) return;
    const rm = new Set((ids || []).map(String));
    const next = (store.getAll() || []).filter((n) => !rm.has(String(n.id)));
    store.saveAll(next, { localOnly: true, silent: true });
  }

  function upsertRequirementNotification(kind, profile, sellerId) {
    const Flow = global.TasuPlatformChatDualWindowFlow;
    const spec =
      kind === "identity"
        ? Flow?.CONNECT_NOTIFIES?.find?.((n) => n.phase === "connect-identity")
        : Flow?.CONNECT_NOTIFIES?.find?.((n) => n.phase === "connect-payout");
    const Demo = global.TasuPlatformChatDualWindowDemo;
    const base = global.location?.href || "http://localhost/";
    const href =
      kind === "identity" || kind === "payout"
        ? (() => {
            const u = new URL("payment-settings.html", base);
            u.searchParams.set("talkDev", "1");
            u.searchParams.set("review", "chat-demo");
            if (profile?.id) u.searchParams.set("demoProfile", profile.id);
            return `${u.pathname}${u.search}`;
          })()
        : "#";
    const id =
      kind === "identity"
        ? "platform-chat-demo-connect-identity-001"
        : "platform-chat-demo-connect-payout-001";
    return pushRuntimeNotification({
      id,
      type: "skill",
      category: pickStr(profile?.category, "スキル"),
      title: pickStr(
        kind === "identity"
          ? global.TasuTalkNotifyTier?.formatConnectNotifyTitle?.(spec?.title) ||
              "【重要】売上の受け取りには本人確認が必要です"
          : spec?.title,
        kind === "identity" ? "【重要】売上の受け取りには本人確認が必要です" : "振込先の確認が必要です"
      ),
      body: pickStr(spec?.body),
      actionLabel: pickStr(spec?.cta),
      href,
      targetUrl: href,
      priority: "high",
      sendTalkMessage: true,
      officialRoomId: "official_tasful",
      source: "platform_chat_demo_connect_requirements_v1",
      recipientUserId: sellerId,
      threadId: pickStr(profile?.threadId),
      listingId: pickStr(profile?.listingId),
      notifyListingTitle: pickStr(profile?.listingTitle),
      minimalNotifyCard: true,
    });
  }

  function syncDemoConnectRequirementNotifications(profile) {
    if (!profile?.connect) {
      const Review = global.TasuTalkChatDemoReviewMode;
      const inManagedDemo =
        Review?.isChatDemoReviewMode?.() === true ||
        global.TasuPlatformChatLiveFlow?.isLiveFlowMode?.() === true;
      if (!inManagedDemo) {
        reconcilePendingConnectRequirementNotifications();
        return { ok: true, skipped: true, reason: "standalone_preserve" };
      }
      removeNotificationsByIds([
        "platform-chat-demo-connect-identity-001",
        "platform-chat-demo-connect-payout-001",
      ]);
      return { ok: true, skipped: true };
    }
    const sellerId = pickStr(profile.partnerAId);
    const status = getSellerConnectStatus(sellerId);
    removeNotificationsByIds([
      "platform-chat-demo-connect-identity-001",
      "platform-chat-demo-connect-payout-001",
    ]);
    if (status === "identity") {
      upsertRequirementNotification("identity", profile, sellerId);
      return { ok: true, status };
    }
    if (status === "payout") {
      upsertRequirementNotification("payout", profile, sellerId);
      return { ok: true, status };
    }
    return { ok: true, status: "ready" };
  }

  function reconcilePendingConnectRequirementNotifications() {
    const map = readMap(SELLER_STATUS_KEY);
    const sellerIds = Object.keys(map || {}).filter((sid) => {
      const status = getSellerConnectStatus(sid);
      return status === "identity" || status === "payout";
    });
    if (!sellerIds.length) return { ok: true, reconciled: 0 };
    const Demo = global.TasuPlatformChatDualWindowDemo;
    let reconciled = 0;
    sellerIds.forEach((sellerId) => {
      const status = getSellerConnectStatus(sellerId);
      const profile = Demo?.getProfile?.() || {
        id: "skill",
        category: "Connect",
        connect: true,
        partnerAId: sellerId,
      };
      if (status === "identity") {
        upsertRequirementNotification("identity", { ...profile, partnerAId: sellerId }, sellerId);
        reconciled += 1;
      } else if (status === "payout") {
        upsertRequirementNotification("payout", { ...profile, partnerAId: sellerId }, sellerId);
        reconciled += 1;
      }
    });
    return { ok: true, reconciled };
  }

  function appendConnectRequestFollowUpMessages(threadId, options) {
    const list = options?.messages || readMessages(threadId);
    const follow = {
      id: `msg-${threadId}-sys-connect-hint`,
      chatId: threadId,
      senderId: "__system__",
      senderName: "TASFUL",
      text: "承認されると報酬が支払われます",
      createdAt: new Date().toISOString(),
      kind: "system",
    };
    if (list.some((m) => String(m.text) === follow.text)) return list;
    list.push(follow);
    if (!options?.skipWrite) writeMessages(threadId, list);
    return list;
  }

  function appendPendingApprovalCard(threadId, thread) {
    const room = thread || readThreadFromStore(threadId);
    const list = readMessages(threadId);
    if (list.some((m) => m.kind === "connect_completion_pending_card")) return { ok: true, skipped: true };
    list.push(buildPendingApprovalCardMessage(threadId, room));
    writeMessages(threadId, list);
    return { ok: true };
  }

  function readThreadFromStore(threadId) {
    return (global.TasuChatThreadStore?.readAll?.() || []).find((t) => String(t.id) === String(threadId)) || null;
  }

  function removePendingApprovalCard(threadId) {
    const list = readMessages(threadId).filter((m) => m.kind !== "connect_completion_pending_card");
    writeMessages(threadId, list);
  }

  function appendPaymentDoneCard(threadId, thread) {
    const room = thread || readThreadFromStore(threadId);
    const list = readMessages(threadId).filter((m) => m.kind !== "connect_completion_pending_card");
    if (!list.some((m) => m.kind === "connect_payment_done_card")) {
      list.push(buildPaymentDoneCardMessage(threadId, room));
    }
    writeMessages(threadId, list);
  }

  function appendRefundDoneCard(threadId) {
    const list = readMessages(threadId).filter((m) => m.kind !== "connect_completion_pending_card");
    if (!list.some((m) => m.kind === "connect_refund_done_card")) {
      list.push(buildRefundDoneCardMessage(threadId));
    }
    writeMessages(threadId, list);
  }

  function resolveThreadIdFromContext(thread, message, trigger) {
    return pickStr(
      thread?.id,
      message?.roomId,
      message?.chatId,
      trigger?.closest?.("[data-connect-pending-card]")?.getAttribute?.("data-thread-id"),
      new URL(global.location?.href || "http://localhost/").searchParams.get("thread")
    );
  }

  function showApproveInlineError(message) {
    const text = pickStr(message, "承認に失敗しました");
    if (global.TasuChatDetailUi?.showFlowError) {
      global.TasuChatDetailUi.showFlowError(text);
      return;
    }
    const errorEl = global.document?.getElementById?.("chatInlineError");
    if (errorEl) {
      errorEl.textContent = text;
      errorEl.style.display = "block";
      return;
    }
    console.warn("[TasuPlatformChatConnectChatFlow] approve failed:", text);
  }

  async function refreshChatAfterApprove(res, threadId) {
    const detailUi = global.TasuChatDetailUi;
    if (detailUi?.afterFlowApprove) {
      await detailUi.afterFlowApprove(res);
      return;
    }
    if (typeof global.__tasuChatDetailReload === "function") {
      global.__tasuChatDetailReload({ thread: res?.thread });
      return;
    }
    try {
      global.dispatchEvent(
        new CustomEvent("tasu:connect-completion-approved", {
          detail: { threadId, thread: res?.thread, result: res },
        })
      );
    } catch {
      /* ignore */
    }
    if (res?.awaitingPayment) {
      global.location.reload();
    }
  }

  async function approvePendingCompletionFromUi(trigger, ev) {
    if (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (typeof ev.stopImmediatePropagation === "function") {
        ev.stopImmediatePropagation();
      }
    }
    const btn = trigger?.closest?.("[data-connect-complete-approve]") || trigger;
    if (!btn) return { ok: false, reason: "button_unavailable" };
    if (btn.disabled || btn.dataset.tasuApproveSubmitting === "1") {
      return { ok: false, reason: "button_unavailable" };
    }

    const threadId = resolveThreadIdFromContext(null, null, btn);
    const root = global.document?.documentElement;
    if (root && root.dataset.tasuApproveInFlight === threadId) {
      return { ok: false, reason: "approve_in_flight" };
    }
    const flow = global.TasuPlatformChatCompletionFlow;
    const meId = global.TasuChatUserIdentity?.getEffectiveUserId?.() || "";
    const thread = flow?.readThread?.(threadId);

    if (!threadId) {
      showApproveInlineError("チャットルームを特定できませんでした");
      return { ok: false, reason: "missing_thread" };
    }
    if (!flow?.approveCompletion) {
      showApproveInlineError("承認処理を読み込めませんでした");
      return { ok: false, reason: "missing_flow" };
    }

    const detailUi = global.TasuChatDetailUi;
    detailUi?.setFlowActionPending?.(true);
    if (!detailUi?.setFlowActionPending) {
      global.document.documentElement.dataset.tasuFlowActionPending = "1";
    }
    if (root) root.dataset.tasuApproveInFlight = threadId;
    btn.dataset.tasuApproveSubmitting = "1";
    btn.disabled = true;
    let res;
    try {
      res = flow.approveCompletion({
        threadId,
        thread,
        userId: meId,
      });
    } catch (err) {
      if (root) delete root.dataset.tasuApproveInFlight;
      detailUi?.setFlowActionPending?.(false);
      delete global.document.documentElement.dataset.tasuFlowActionPending;
      btn.disabled = false;
      delete btn.dataset.tasuApproveSubmitting;
      showApproveInlineError(String(err?.message || err || "承認に失敗しました"));
      return { ok: false, reason: String(err?.message || err) };
    }
    if (!res?.ok) {
      if (root) delete root.dataset.tasuApproveInFlight;
      detailUi?.setFlowActionPending?.(false);
      delete global.document.documentElement.dataset.tasuFlowActionPending;
      btn.disabled = false;
      delete btn.dataset.tasuApproveSubmitting;
      showApproveInlineError(res?.reason || "承認に失敗しました");
      return res;
    }

    try {
      await refreshChatAfterApprove(res, threadId);
    } catch (err) {
      if (root) delete root.dataset.tasuApproveInFlight;
      detailUi?.setFlowActionPending?.(false);
      delete global.document.documentElement.dataset.tasuFlowActionPending;
      btn.disabled = false;
      delete btn.dataset.tasuApproveSubmitting;
      showApproveInlineError(String(err?.message || err || "承認後の画面更新に失敗しました"));
      return { ok: false, reason: String(err?.message || err) };
    }
    delete btn.dataset.tasuApproveSubmitting;
    if (root) delete root.dataset.tasuApproveInFlight;
    detailUi?.setFlowActionPending?.(false);
    delete global.document.documentElement.dataset.tasuFlowActionPending;
    return res;
  }

  async function rejectPendingCompletionFromUi(trigger, ev) {
    if (ev) {
      ev.preventDefault();
      ev.stopPropagation();
    }
    if (global.TasuChatDetailUi?.rejectConnectCompletion) {
      await global.TasuChatDetailUi.rejectConnectCompletion();
      return { ok: true };
    }
    const threadId = resolveThreadIdFromContext(null, null, trigger);
    const cancelFlow = global.TasuPlatformChatCancelFlow;
    const meId = global.TasuChatUserIdentity?.getEffectiveUserId?.() || "";
    const thread = global.TasuPlatformChatCompletionFlow?.readThread?.(threadId);
    if (!threadId || !cancelFlow?.rejectConnectCompletion) {
      return { ok: false, reason: "missing_flow" };
    }
    return cancelFlow.rejectConnectCompletion({
      threadId,
      thread,
      userId: meId,
    });
  }

  function approvePendingCardFromEvent(ev) {
    void approvePendingCompletionFromUi(ev?.currentTarget, ev);
    return false;
  }

  function rejectPendingCardFromEvent(ev) {
    void rejectPendingCompletionFromUi(ev?.currentTarget, ev);
    return false;
  }

  function installConnectPendingCardBridge() {
    const root = global.document?.documentElement;
    if (!root || root.dataset.tasuConnectPendingBridge === "1") return;
    root.dataset.tasuConnectPendingBridge = "1";
    const handlePendingCardPointer = (ev) => {
      const approveBtn = ev.target?.closest?.("[data-connect-complete-approve]");
      if (approveBtn) {
        void approvePendingCompletionFromUi(approveBtn, ev);
        return;
      }
      const rejectBtn = ev.target?.closest?.("[data-connect-complete-reject]");
      if (rejectBtn) {
        void rejectPendingCompletionFromUi(rejectBtn, ev);
      }
    };
    global.document.addEventListener("pointerdown", handlePendingCardPointer, true);
    global.document.addEventListener("click", handlePendingCardPointer, true);
  }

  function renderPendingApprovalCardHtml(message, thread, meId) {
    const card = message?.connectCompletionCard || {};
    const title = pickStr(card.title, PENDING_CARD_TITLE);
    const body = pickStr(card.body, PENDING_CARD_BODY);
    const flow = global.TasuPlatformChatCompletionFlow;
    const canApprove = flow?.canApproveCompletion?.(thread, meId) === true;
    const isDemoPending =
      flow?.getCompletionStatus?.(thread) === "completion_pending" &&
      global.TasuPlatformChatDualWindowDemo?.isDemoThread?.(thread?.id || thread) === true;
    const canReject =
      (global.TasuPlatformChatCancelFlow?.canCancelConversation?.(thread, meId) === true &&
        flow?.getCompletionStatus?.(thread) === "completion_pending") ||
      (isDemoPending && canApprove);
    const labels = global.TasuPlatformChatCategoryFlow?.getLabels?.(thread) || {};
    const rejectLabel = pickStr(labels.rejectBtn, "キャンセルする");

    const actions =
      canApprove || canReject
        ? `<div class="chat-connect-card__actions">` +
          (canApprove
            ? `<button type="button" class="chat-connect-card__btn chat-connect-card__btn--primary" data-connect-complete-approve onclick="return TasuPlatformChatConnectChatFlow.approvePendingCardFromEvent(event)">${esc("承認する")}</button>`
            : "") +
          (canReject
            ? `<button type="button" class="chat-connect-card__btn chat-connect-card__btn--ghost" data-connect-complete-reject onclick="return TasuPlatformChatConnectChatFlow.rejectPendingCardFromEvent(event)">${esc(rejectLabel)}</button>`
            : "") +
          `</div>`
        : "";

    const deliverySummary = pickStr(
      card.deliverySummary,
      thread?.listingTitle,
      labels.categoryLabel
    );
    const requesterId = pickStr(thread?.completionRequestedBy);
    const requesterName = pickStr(
      card.requesterName,
      flow?.resolveActorDisplayName?.(requesterId, thread),
      global.TasuPlatformChatCategoryFlow?.resolveActorDisplayName?.(requesterId, thread)
    );
    const projectTitle = pickStr(card.listingTitle, thread?.listingTitle, labels.categoryLabel);
    const metaRows = [
      deliverySummary ? `<div class="chat-connect-card__field"><dt>納品内容</dt><dd>${esc(deliverySummary)}</dd></div>` : "",
      requesterName ? `<div class="chat-connect-card__field"><dt>申請者</dt><dd>${esc(requesterName)}</dd></div>` : "",
      projectTitle ? `<div class="chat-connect-card__field"><dt>対象案件</dt><dd>${esc(projectTitle)}</dd></div>` : "",
    ]
      .filter(Boolean)
      .join("");

    const threadId = resolveThreadIdFromContext(thread, message);
    return (
      `<div class="chat-connect-card-wrap" data-connect-pending-card data-thread-id="${esc(threadId)}">` +
      `<article class="chat-connect-card chat-connect-card--pending" aria-label="${esc(title)}">` +
      `<h3 class="chat-connect-card__title">${esc(title)}</h3>` +
      (metaRows ? `<dl class="chat-connect-card__fields">${metaRows}</dl>` : "") +
      (body ? `<p class="chat-connect-card__body">${esc(body)}</p>` : "") +
      actions +
      `</article>` +
      `</div>`
    );
  }

  function renderPaymentDoneCardHtml(message, thread, userId) {
    const card = message?.connectPaymentCard || {};
    const title = pickStr(card.title, PAYMENT_CARD_TITLE);
    const body = pickStr(card.body, PAYMENT_CARD_BODY);
    return (
      `<div class="chat-connect-card-wrap" data-connect-payment-card>` +
      `<article class="chat-connect-card chat-connect-card--payment" aria-label="${esc(title)}">` +
      `<h3 class="chat-connect-card__title">${esc(title)}</h3>` +
      `<p class="chat-connect-card__body">${esc(body)}</p>` +
      `</article>` +
      `</div>`
    );
  }

  function renderConnectPaymentRequiredCardHtml(message, thread, meId) {
    const card = message?.connectPayRequiredCard || {};
    const title = pickStr(card.title, PAY_REQUIRED_TITLE);
    const body = pickStr(card.body, PAY_REQUIRED_BODY);
    const btnLabel = pickStr(card.button, PAY_REQUIRED_BTN);
    const buyerId =
      global.TasuPlatformChatCategoryFlow?.getBuyerId?.(thread) || pickStr(thread?.buyerId);
    const isBuyer = pickStr(meId) === pickStr(buyerId);
    const paid = isPaymentCompletedForReview(thread);
    let action = "";
    if (isBuyer && !paid) {
      action = `<button type="button" class="chat-connect-card__btn chat-connect-card__btn--primary" data-connect-pay-complete>${esc(btnLabel)}</button>`;
    } else if (isBuyer && paid) {
      action = `<p class="chat-manual-pay__done" role="status">お支払い済みです</p>`;
    } else if (!isBuyer && !paid) {
      action = `<p class="chat-manual-pay__hint" role="note">購入者のお支払いをお待ちください</p>`;
    }
    return (
      `<div class="chat-connect-card-wrap" data-connect-pay-required-card>` +
      `<article class="chat-connect-card chat-connect-card--pay-required" aria-label="${esc(title)}">` +
      `<h3 class="chat-connect-card__title">${esc(title)}</h3>` +
      `<p class="chat-connect-card__body">${esc(body)}</p>` +
      (action ? `<div class="chat-connect-card__actions">${action}</div>` : "") +
      `</article>` +
      `</div>`
    );
  }

  function renderRefundDoneCardHtml(message) {
    const card = message?.connectRefundCard || {};
    const title = pickStr(card.title, REFUND_CARD_TITLE);
    return (
      `<div class="chat-connect-card-wrap" data-connect-refund-card>` +
      `<article class="chat-connect-card chat-connect-card--refund" aria-label="${esc(title)}">` +
      `<h3 class="chat-connect-card__title">${esc(title)}</h3>` +
      `</article>` +
      `</div>`
    );
  }

  function simulateConnectPaymentOnApprove({ threadId, thread }) {
    appendPaymentDoneCard(threadId);
    const listing = {
      id: thread?.listingId,
      listing_type: thread?.listingType,
      title: thread?.listingTitle,
    };
    try {
      global.TasuTalkPlatformFeeNotify?.notifyDealCompletedConnect?.({
        listing,
        thread,
        room: thread,
      });
    } catch (err) {
      console.warn("[TasuPlatformChatConnectChatFlow] connect notify failed:", err);
    }
    return { ok: true };
  }

  installConnectPendingCardBridge();

  global.TasuPlatformChatConnectChatFlow = {
    PAYMENT_STORAGE_KEY,
    SELLER_STATUS_KEY,
    PENDING_CARD_TITLE,
    PENDING_CARD_BODY,
    PAYMENT_CARD_TITLE,
    PAYMENT_CARD_BODY,
    REFUND_CARD_TITLE,
    isConnectThread,
    shouldUseConnectCompletionUi,
    buildPendingApprovalCardMessage,
    buildPaymentDoneCardMessage,
    buildRefundDoneCardMessage,
    appendConnectRequestFollowUpMessages,
    appendPendingApprovalCard,
    removePendingApprovalCard,
    appendPaymentDoneCard,
    appendRefundDoneCard,
    renderPendingApprovalCardHtml,
    renderConnectPaymentRequiredCardHtml,
    renderPaymentDoneCardHtml,
    renderRefundDoneCardHtml,
    simulateConnectPaymentOnApprove,
    appendConnectPaymentRequiredCard,
    completeConnectPayment,
    markConnectRefunded,
    isPaymentCompletedForReview,
    getSellerConnectStatus,
    setSellerConnectStatus,
    syncDemoConnectRequirementNotifications,
    reconcilePendingConnectRequirementNotifications,
    approvePendingCompletionFromUi,
    approvePendingCardFromEvent,
    rejectPendingCardFromEvent,
  };
})(typeof window !== "undefined" ? window : globalThis);
