/**
 * 2窓デモ — 動的通知（メッセージ・完了申請・承認・キャンセル）
 */
(function (global) {
  "use strict";

  const MESSAGE_SOURCE = "platform_chat_demo_message_v1";
  const COMPLETION_REQUEST_SOURCE = "platform_chat_demo_completion_request_v1";
  const BUYER_PAID_SOURCE = "platform_chat_demo_buyer_paid_v1";
  const APPROVAL_SOURCE = "platform_chat_demo_approved_v1";
  const CANCEL_SOURCE = "platform_chat_demo_cancelled_v1";
  const CHAT_STARTED_SOURCE = "platform_chat_demo_chat_started_v1";
  const PRODUCT_SHIPPED_SOURCE = "platform_chat_demo_product_shipped_v1";
  const SHIPPING_READY_SOURCE = "platform_chat_demo_shipping_ready_v1";
  const BANK_TRANSFER_REPORTED_SOURCE = "platform_chat_demo_bank_transfer_reported_v1";
  const PAYMENT_CONFIRMED_SOURCE = "platform_chat_demo_payment_confirmed_v1";
  const PRODUCT_RECEIVED_SOURCE = "platform_chat_demo_product_received_v1";
  const COD_REPORTED_SOURCE = "platform_chat_demo_cod_reported_v1";
  const COD_CONFIRMED_SOURCE = "platform_chat_demo_cod_confirmed_v1";
  const PURCHASE_COMPLETED_SOURCE = "platform_chat_demo_purchase_completed_v1";

  const MESSAGE_TITLE = "新しいメッセージが届きました";
  const MESSAGE_CTA = "チャットを開く";
  const COMPLETION_REQUEST_CTA = "承認する";
  const BUYER_PAID_CTA = "入金を確認する";
  const APPROVAL_CTA = "レビューを書く";
  const CANCEL_CTA = "チャットを開く";
  const PRODUCT_SHIPPED_CTA = "確認する";

  const RUNTIME_SOURCES = new Set([
    MESSAGE_SOURCE,
    COMPLETION_REQUEST_SOURCE,
    BUYER_PAID_SOURCE,
    APPROVAL_SOURCE,
    CANCEL_SOURCE,
    CHAT_STARTED_SOURCE,
    PRODUCT_SHIPPED_SOURCE,
    SHIPPING_READY_SOURCE,
    BANK_TRANSFER_REPORTED_SOURCE,
    PAYMENT_CONFIRMED_SOURCE,
    PRODUCT_RECEIVED_SOURCE,
    COD_REPORTED_SOURCE,
    COD_CONFIRMED_SOURCE,
    PURCHASE_COMPLETED_SOURCE,
  ]);

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function isChatDemoReviewMode() {
    return global.TasuTalkChatDemoReviewMode?.isChatDemoReviewMode?.() === true;
  }

  function resolveRecipientUserId(profile, actorId, thread) {
    const sid = pickStr(actorId);
    if (!sid) return "";
    const Demo = global.TasuPlatformChatDualWindowDemo;
    const partners = Demo?.resolveBenchPartnerIds?.(profile, thread) || {};
    const sellerId = pickStr(partners.sellerId, thread?.sellerId, thread?.partnerUserId);
    const buyerId = pickStr(partners.buyerId, thread?.buyerId);
    const effectiveProfile = partners.profile || profile;
    if (effectiveProfile) {
      const profileA = pickStr(effectiveProfile.partnerAId, sellerId);
      const profileB = pickStr(effectiveProfile.partnerBId, buyerId);
      if (sid === profileA) return profileB;
      if (sid === profileB) return profileA;
    }
    if (sellerId && buyerId) {
      if (sid === sellerId) return buyerId;
      if (sid === buyerId) return sellerId;
    }
    return "";
  }

  function resolveSenderDisplayName(profile, senderId) {
    const sid = pickStr(senderId);
    if (!profile) return "相手";
    if (sid === profile.partnerAId) return profile.partnerAName;
    if (sid === profile.partnerBId) return profile.partnerBName;
    return "相手";
  }

  function formatNameWithSan(name) {
    const n = pickStr(name, "相手");
    return /さん$/.test(n) ? n : `${n}さん`;
  }

  function buildChatNotifyHref(profile, recipientUserId, state, threadId, options) {
    const Demo = global.TasuPlatformChatDualWindowDemo;
    if (!Demo?.chatUrl) return "#";
    const demoState = pickStr(state, "active");
    const opts = options && typeof options === "object" ? options : {};
    const extra = {
      review: Demo.REVIEW_PARAM || "chat-demo",
      connect: profile.connect,
      state: demoState,
      from: "notify",
      threadId: pickStr(threadId),
    };
    if (opts.openReview) extra.openReview = pickStr(opts.openReview);
    return Demo.chatUrl(profile.id, recipientUserId, extra);
  }

  function shouldEmitDemoRuntimeNotify(threadOrId) {
    const Demo = global.TasuPlatformChatDualWindowDemo;
    if (!Demo?.isDemoThread?.(threadOrId)) return false;
    if (isChatDemoReviewMode()) return true;
    if (global.TasuPlatformChatLiveFlow?.isLiveFlowMode?.() === true) return true;
    if (global.TasuPlatformChatBenchEmbed?.isBenchParentContext?.() === true) return true;
    return Demo.resolveProfileForThread?.(threadOrId) != null;
  }

  function resolveCategoryMeta(profile, thread) {
    const Demo = global.TasuPlatformChatDualWindowDemo;
    const stub = thread || Demo?.buildThreadStub?.(profile) || profile;
    const labels = global.TasuPlatformChatCategoryFlow?.getLabels?.(stub) || {};
    return {
      type: profile.categoryKey === "job" ? "job" : profile.categoryKey,
      category: labels.categoryLabel || profile.category || profile.label || "取引",
      listingId: pickStr(thread?.listingId, profile.listingId),
      listingTitle: pickStr(thread?.listingTitle, profile.listingTitle),
    };
  }

  function resolveBenchNotifyKind(source) {
    const src = pickStr(source);
    if (src === MESSAGE_SOURCE) return "message";
    if (src === CHAT_STARTED_SOURCE) return "chat_started";
    if (src === PRODUCT_SHIPPED_SOURCE) return "product_shipped";
    if (src === SHIPPING_READY_SOURCE) return "shipping_ready";
    if (src === BANK_TRANSFER_REPORTED_SOURCE) return "bank_transfer_reported";
    if (src === PAYMENT_CONFIRMED_SOURCE) return "payment_confirmed";
    if (src === PRODUCT_RECEIVED_SOURCE) return "product_received";
    if (src === COD_REPORTED_SOURCE) return "cod_reported";
    if (src === COD_CONFIRMED_SOURCE) return "cod_confirmed";
    if (src === PURCHASE_COMPLETED_SOURCE) return "purchase_completed";
    if (src === COMPLETION_REQUEST_SOURCE) return "completion_request";
    if (src === BUYER_PAID_SOURCE) return "buyer_paid";
    if (src === APPROVAL_SOURCE) return "approval";
    if (src === CANCEL_SOURCE) return "cancelled";
    return "";
  }

  function notifyBenchParentRuntimeNotification(row) {
    const recipientUserId = pickStr(row?.recipientUserId);
    const threadId = pickStr(row?.threadId, row?.thread_id);
    const source = pickStr(row?.source);
    if (!recipientUserId) return;
    try {
      if (global.parent && global.parent !== global) {
        const kind = resolveBenchNotifyKind(source);
        global.parent.postMessage(
          {
            type: "tasu-bench-chat-message-sent",
            recipientUserId,
            threadId,
            source,
            title: pickStr(row?.title),
            kind,
            immediate: kind === "approval" || kind === "product_shipped",
          },
          "*"
        );
      }
    } catch {
      /* ignore */
    }
  }

  function pushDemoRuntimeNotification(draft) {
    const store = global.TasuTalkNotifications;
    if (!store?.getAll || !store?.saveAll) {
      return { ok: false, reason: "missing_store" };
    }

    const notifyId = pickStr(draft.id);
    let allRows = store.getAll() || [];
    if (String(draft.source || "") === MESSAGE_SOURCE) {
      const threadId = pickStr(draft.threadId);
      const recipientUserId = pickStr(draft.recipientUserId);
      if (threadId && recipientUserId && notifyId) {
        allRows = allRows.filter((n) => {
          if (String(n.id) === notifyId) return true;
          if (String(n.source || "") !== MESSAGE_SOURCE) return true;
          if (pickStr(n.threadId) !== threadId) return true;
          if (pickStr(n.recipientUserId) !== recipientUserId) return true;
          return false;
        });
      }
    }
    const existing = allRows.find((n) => String(n.id) === notifyId);
    const byId = new Map(allRows.map((n) => [String(n.id), n]));
    const row = {
      ...(existing || {}),
      ...draft,
      readAt: existing?.readAt || null,
      updatedAt: new Date().toISOString(),
      createdAt: existing?.createdAt || new Date().toISOString(),
    };
    byId.set(notifyId, row);
    store.saveAll([...byId.values()].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))), {
      localOnly: true,
      silent: true,
      source: pickStr(draft.source),
    });
    global.TasuTalkOfficialRooms?.syncNotification?.(row);

    try {
      global.dispatchEvent(
        new CustomEvent("tasful-talk-notifications-changed", {
          detail: { notifyOnly: true, source: pickStr(draft.source) },
        })
      );
    } catch {
      /* ignore */
    }

    if (RUNTIME_SOURCES.has(String(row?.source || ""))) {
      notifyBenchParentRuntimeNotification(row);
    }

    return { ok: true, notification: row };
  }

  function shouldHandleDemoThread(threadOrId) {
    if (!shouldEmitDemoRuntimeNotify(threadOrId)) return false;
    const Demo = global.TasuPlatformChatDualWindowDemo;
    return (
      Demo?.isDemoThread?.(threadOrId) === true ||
      Demo?.resolveProfileForThread?.(threadOrId) != null
    );
  }

  function notifyDemoChatMessage(detail) {
    const threadId = pickStr(detail?.threadId, detail?.roomId);
    if (!shouldEmitDemoRuntimeNotify(threadId)) {
      return { ok: false, skipped: true, reason: "not_demo_mode" };
    }

    const senderId = pickStr(detail?.senderId);
    const text = pickStr(detail?.text);
    if (!threadId || !senderId || !text) {
      return { ok: false, skipped: true, reason: "invalid_input" };
    }

    if (!shouldHandleDemoThread(threadId)) {
      return { ok: false, skipped: true, reason: "not_demo_thread" };
    }

    const Demo = global.TasuPlatformChatDualWindowDemo;
    const thread =
      (global.TasuChatThreadStore?.readAll?.() || []).find((t) => String(t.id) === threadId) ||
      null;
    const profile = Demo.resolveProfileForThread?.(thread || threadId);
    const recipientUserId = resolveRecipientUserId(profile, senderId, thread);
    if (!profile || !recipientUserId || recipientUserId === senderId) {
      return { ok: false, skipped: true, reason: "no_recipient" };
    }

    const senderName = resolveSenderDisplayName(profile, senderId);
    const meta = resolveCategoryMeta(profile, thread);
    const href = buildChatNotifyHref(profile, recipientUserId, "active", threadId);
    const notifyId = `platform-chat-demo-message-${threadId}-${recipientUserId}`;
    const platformRow = global.TasuTalkPlatformNotify?.notifyPlatformChatMessage?.({
      id: notifyId,
      threadId,
      roomId: threadId,
      senderId,
      senderName,
      recipientUserId,
      text,
      type: meta.type,
      category: meta.category,
      href,
      targetUrl: href,
      listingId: meta.listingId,
      notifyListingTitle: meta.listingTitle,
    });
    if (platformRow) {
      notifyBenchParentRuntimeNotification({
        recipientUserId,
        threadId,
        source: MESSAGE_SOURCE,
      });
      return { ok: true, notification: platformRow };
    }

    const preview = text.length > 48 ? `${text.slice(0, 48)}…` : text;
    return pushDemoRuntimeNotification({
      id: notifyId,
      type: meta.type,
      category: meta.category,
      title: MESSAGE_TITLE,
      body: `${senderName}：${preview}`,
      actionLabel: MESSAGE_CTA,
      href,
      targetUrl: href,
      priority: "medium",
      sendTalkMessage: true,
      officialRoomId: "official_tasful",
      source: MESSAGE_SOURCE,
      senderUserId: senderId,
      recipientUserId,
      threadId,
      listingId: meta.listingId,
      notifyListingTitle: meta.listingTitle,
      minimalNotifyCard: true,
      demoState: "active",
    });
  }

  function notifyDemoCompletionRequested(detail) {
    if (!shouldHandleDemoThread(detail?.thread || detail?.threadId)) {
      return { ok: false, skipped: true, reason: "not_demo_thread" };
    }

    const Demo = global.TasuPlatformChatDualWindowDemo;
    const thread = detail?.thread || {};
    const threadId = pickStr(detail?.threadId, thread?.id);
    const requesterId = pickStr(detail?.requesterId);
    const profile = Demo.resolveProfileForThread?.(thread || threadId);
    const recipientUserId = resolveRecipientUserId(profile, requesterId, thread);
    if (!profile || !threadId || !requesterId || !recipientUserId) {
      return { ok: false, skipped: true, reason: "invalid_input" };
    }

    const Completion = global.TasuPlatformChatCompletionFlow;
    const requesterName = pickStr(
      detail?.requesterName,
      Completion?.resolveActorDisplayName?.(requesterId, thread)
    );
    const labels = Completion?.getLabels?.(thread) || {};
    const title =
      typeof labels.notifyRequestTitle === "function"
        ? labels.notifyRequestTitle(requesterName, requesterId)
        : pickStr(detail?.title, "完了申請が届きました");
    const notifyId = `platform-chat-demo-completion-request-${threadId}-${recipientUserId}`;
    const meta = resolveCategoryMeta(profile, thread);
    const href = buildChatNotifyHref(profile, recipientUserId, "pending", threadId);

    return pushDemoRuntimeNotification({
      id: notifyId,
      type: meta.type,
      category: meta.category,
      title,
      body: pickStr(detail?.body, labels.connectPendingBody, ""),
      actionLabel: COMPLETION_REQUEST_CTA,
      href,
      targetUrl: href,
      priority: "high",
      sendTalkMessage: true,
      officialRoomId: "official_tasful",
      source: COMPLETION_REQUEST_SOURCE,
      recipientUserId,
      threadId,
      listingId: meta.listingId,
      notifyListingTitle: meta.listingTitle,
      notifySupplementLine: Completion?.formatNotifyRequestFrom?.(requesterName, thread, requesterId) || "",
      minimalNotifyCard: true,
      demoState: "pending",
    });
  }

  function notifyDemoBuyerPaid(detail) {
    if (!shouldHandleDemoThread(detail?.thread || detail?.threadId)) {
      return { ok: false, skipped: true, reason: "not_demo_thread" };
    }

    const Demo = global.TasuPlatformChatDualWindowDemo;
    const thread = detail?.thread || {};
    const threadId = pickStr(detail?.threadId, thread?.id);
    const sellerId = pickStr(detail?.sellerId);
    const profile = Demo.resolveProfileForThread?.(thread || threadId);
    if (!profile || !threadId || !sellerId) {
      return { ok: false, skipped: true, reason: "invalid_input" };
    }

    const notifyId = `platform-chat-demo-buyer-paid-${threadId}-${sellerId}`;
    const meta = resolveCategoryMeta(profile, thread);
    const href = buildChatNotifyHref(profile, sellerId, "active", threadId);

    const paidCopy =
      global.TasuPlatformChatCategoryFlow?.getPayerPaidNotifyCopy?.(thread) || {
        title: "購入者が支払いました",
        body: "入金を確認してください",
        cta: BUYER_PAID_CTA,
      };

    return pushDemoRuntimeNotification({
      id: notifyId,
      type: meta.type,
      category: meta.category,
      title: paidCopy.title,
      body: paidCopy.body,
      actionLabel: paidCopy.cta || BUYER_PAID_CTA,
      href,
      targetUrl: href,
      priority: "high",
      sendTalkMessage: true,
      officialRoomId: "official_tasful",
      source: BUYER_PAID_SOURCE,
      recipientUserId: sellerId,
      threadId,
      listingId: meta.listingId,
      notifyListingTitle: meta.listingTitle,
      minimalNotifyCard: true,
      demoState: "active",
    });
  }

  function notifyCompletionApprovedToRequester(detail) {
    if (!shouldHandleDemoThread(detail?.thread || detail?.threadId)) {
      return { ok: false, skipped: true, reason: "not_demo_thread" };
    }

    const Completion = global.TasuPlatformChatCompletionFlow;
    if (Completion?.isJobThread?.(detail?.thread) === true) {
      return { ok: false, skipped: true, reason: "job_handled_elsewhere" };
    }

    const Demo = global.TasuPlatformChatDualWindowDemo;
    const thread = detail?.thread || {};
    const threadId = pickStr(detail?.threadId, thread?.id);
    const profile = Demo.resolveProfileForThread?.(thread || threadId);
    const approverId = pickStr(detail?.approverId);
    const requesterId = pickStr(detail?.requesterId, thread?.completionRequestedBy);
    if (!profile || !threadId || !requesterId || !approverId) {
      return { ok: false, skipped: true, reason: "invalid_input" };
    }
    if (requesterId === approverId) {
      return { ok: false, skipped: true, reason: "same_user" };
    }

    const notifyId = `platform-chat-demo-completion-approved-requester-${threadId}-${requesterId}`;
    const store = global.TasuTalkNotifications;
    const existing = (store?.getAll?.() || []).find((n) => String(n.id) === notifyId);
    if (existing) return { ok: true, notification: existing, duplicate: true };

    const meta = resolveCategoryMeta(profile, thread);
    const href = buildChatNotifyHref(profile, requesterId, "completed", threadId);
    const row = pushDemoRuntimeNotification({
      id: notifyId,
      type: meta.type,
      category: meta.category,
      title: "やり取り完了が承認されました",
      body: "相手が完了申請を承認しました。",
      actionLabel: "確認する",
      href,
      targetUrl: href,
      priority: "high",
      sendTalkMessage: true,
      officialRoomId: "official_tasful",
      source: APPROVAL_SOURCE,
      recipientUserId: requesterId,
      threadId,
      listingId: meta.listingId,
      notifyListingTitle: meta.listingTitle,
      minimalNotifyCard: true,
      demoState: "completed",
      notifyEventAt: new Date().toISOString(),
    });

    try {
      global.__tasuCompletionApprovedNotifyDiag = {
        completionApprovedNotifyCreated: Boolean(row?.notification),
        completionApprovedNotifyRecipient: requesterId,
        approverId,
        requesterId,
        threadId,
      };
    } catch {
      /* ignore */
    }

    return row;
  }

  function notifyDemoCompletionApproved(detail) {
    if (!shouldHandleDemoThread(detail?.thread || detail?.threadId)) {
      return { ok: false, skipped: true, reason: "not_demo_thread" };
    }

    const Completion = global.TasuPlatformChatCompletionFlow;
    if (Completion?.isJobThread?.(detail?.thread) === true) {
      return { ok: false, skipped: true, reason: "job_handled_elsewhere" };
    }

    const Demo = global.TasuPlatformChatDualWindowDemo;
    const thread = detail?.thread || {};
    const threadId = pickStr(detail?.threadId, thread?.id);
    const profile = Demo.resolveProfileForThread?.(thread || threadId);
    const partners = Demo?.resolveBenchPartnerIds?.(profile, thread) || {};
    const buyerId = pickStr(partners.buyerId, profile?.partnerBId);
    const sellerId = pickStr(partners.sellerId, profile?.partnerAId);
    const recipients = [
      ...new Set(
        [pickStr(detail?.recipientUserId), buyerId, sellerId].filter(Boolean)
      ),
    ];
    if (!profile || !threadId || !recipients.length) {
      return { ok: false, skipped: true, reason: "invalid_input" };
    }

    const title = "取引が完了しました";
    const reviewCta = APPROVAL_CTA;
    const meta = resolveCategoryMeta(profile, thread);
    const rows = recipients.map((recipientUserId) => {
      const href = buildChatNotifyHref(profile, recipientUserId, "completed", threadId, {
        openReview: "1",
      });
      return pushDemoRuntimeNotification({
        id: `platform-chat-demo-completion-approved-${threadId}-${recipientUserId}`,
        type: meta.type,
        category: meta.category,
        title,
        body: "お疲れさまでした。レビューで取引を締めくくれます。",
        actionLabel: reviewCta,
        href,
        targetUrl: href,
        priority: "high",
        sendTalkMessage: true,
        officialRoomId: "official_tasful",
        source: APPROVAL_SOURCE,
        recipientUserId,
        threadId,
        listingId: meta.listingId,
        notifyListingTitle: meta.listingTitle,
        notifySupplementLine: "お疲れさまでした",
        minimalNotifyCard: true,
        demoState: "completed",
        openReview: "1",
      });
    });

    return { ok: true, notifications: rows };
  }

  function appendFromToHref(href, from) {
    const raw = pickStr(href);
    const value = pickStr(from).toLowerCase();
    if (!raw || raw === "#" || (value !== "talk" && value !== "notify")) return raw;
    try {
      const u = new URL(raw, global.location?.href || "http://localhost/");
      u.searchParams.set("from", value);
      return `${u.pathname}${u.search}${u.hash || ""}`;
    } catch {
      return raw;
    }
  }

  function pushPurchasePaymentNotify(draft) {
    const thread = draft?.thread || {};
    const threadId = pickStr(draft?.threadId, thread?.id);
    const recipientUserId = pickStr(draft?.recipientUserId);
    const source = pickStr(draft?.source);
    const notifyKey = pickStr(draft?.notifyKey, source);
    if (!shouldHandleDemoThread(thread || threadId) || !recipientUserId || !source) {
      return { ok: false, skipped: true, reason: "invalid_input" };
    }
    const Demo = global.TasuPlatformChatDualWindowDemo;
    const profile = Demo.resolveProfileForThread?.(thread || threadId);
    if (!profile || !threadId) return { ok: false, skipped: true, reason: "invalid_input" };
    const meta = resolveCategoryMeta(profile, thread);
    const cta = pickStr(draft.cta);
    const hrefOverride = pickStr(draft.href);
    const openReview =
      draft.openReview === false || draft.openReview === "0"
        ? null
        : pickStr(draft.openReview, /レビュー/.test(cta) ? "1" : "");
    const href = hrefOverride
      ? appendFromToHref(hrefOverride, pickStr(draft.from, "notify"))
      : buildChatNotifyHref(
          profile,
          recipientUserId,
          pickStr(draft.demoState, "active"),
          threadId,
          openReview ? { openReview } : {}
        );
    const notifyId = `platform-chat-demo-${notifyKey}-${threadId}-${recipientUserId}`;
    return pushDemoRuntimeNotification({
      id: notifyId,
      type: meta.type,
      category: meta.category,
      title: pickStr(draft.title),
      body: pickStr(draft.body),
      actionLabel: pickStr(draft.cta, "確認する"),
      href,
      targetUrl: href,
      priority: "high",
      sendTalkMessage: true,
      officialRoomId: "official_tasful",
      source,
      senderUserId: pickStr(draft.senderUserId),
      recipientUserId,
      threadId,
      listingId: meta.listingId,
      notifyListingTitle: meta.listingTitle,
      minimalNotifyCard: true,
      demoState: pickStr(draft.demoState, "active"),
    });
  }

  function notifyDemoShippingReady(detail) {
    const thread = detail?.thread || {};
    const threadId = pickStr(detail?.threadId, thread?.id);
    const sellerId = pickStr(detail?.sellerId);
    const buyerId = resolveRecipientUserId(
      global.TasuPlatformChatDualWindowDemo?.resolveProfileForThread?.(thread || threadId),
      sellerId,
      thread
    );
    return pushPurchasePaymentNotify({
      thread,
      threadId,
      source: SHIPPING_READY_SOURCE,
      notifyKey: "shipping-ready",
      senderUserId: sellerId,
      recipientUserId: buyerId,
      title: "商品の発送準備が整いました",
      body: "お支払いをお願いします",
      cta: "確認する",
    });
  }

  function notifyDemoBankTransferReported(detail) {
    const thread = detail?.thread || {};
    const threadId = pickStr(detail?.threadId, thread?.id);
    const buyerId = pickStr(detail?.buyerId);
    const sellerId = resolveRecipientUserId(
      global.TasuPlatformChatDualWindowDemo?.resolveProfileForThread?.(thread || threadId),
      buyerId,
      thread
    );
    const sellerNotify = pushPurchasePaymentNotify({
      thread,
      threadId,
      source: BANK_TRANSFER_REPORTED_SOURCE,
      notifyKey: "bank-transfer-reported",
      senderUserId: buyerId,
      recipientUserId: sellerId,
      title: "購入者が銀行振込完了を報告しました",
      body: "入金を確認してください",
      cta: "確認する",
    });
    const buyerNotify = buyerId
      ? pushPurchasePaymentNotify({
          thread,
          threadId,
          source: BANK_TRANSFER_REPORTED_SOURCE,
          notifyKey: "bank-transfer-reported-buyer",
          senderUserId: buyerId,
          recipientUserId: buyerId,
          title: "銀行振込完了を報告しました",
          body: "出品者の入金確認をお待ちください",
          cta: "確認する",
        })
      : null;
    return { ok: true, sellerNotify, buyerNotify };
  }

  function notifyDemoPaymentConfirmed(detail) {
    const thread = detail?.thread || {};
    const threadId = pickStr(detail?.threadId, thread?.id);
    const sellerId = pickStr(detail?.sellerId);
    const buyerId = resolveRecipientUserId(
      global.TasuPlatformChatDualWindowDemo?.resolveProfileForThread?.(thread || threadId),
      sellerId,
      thread
    );
    return pushPurchasePaymentNotify({
      thread,
      threadId,
      source: PAYMENT_CONFIRMED_SOURCE,
      notifyKey: "payment-confirmed",
      senderUserId: sellerId,
      recipientUserId: buyerId,
      title: "入金確認が完了しました",
      body: "商品の発送をお待ちください",
      cta: "確認する",
    });
  }

  function notifyDemoProductReceived(detail) {
    const thread = detail?.thread || {};
    const threadId = pickStr(detail?.threadId, thread?.id);
    const buyerId = pickStr(detail?.buyerId);
    const sellerId = resolveRecipientUserId(
      global.TasuPlatformChatDualWindowDemo?.resolveProfileForThread?.(thread || threadId),
      buyerId,
      thread
    );
    return pushPurchasePaymentNotify({
      thread,
      threadId,
      source: PRODUCT_RECEIVED_SOURCE,
      notifyKey: "product-received",
      senderUserId: buyerId,
      recipientUserId: sellerId,
      title: "購入者が商品を受け取りました",
      body: "取引が完了しました",
      cta: "確認する",
    });
  }

  function notifyDemoCodPaymentReported(detail) {
    const thread = detail?.thread || {};
    const threadId = pickStr(detail?.threadId, thread?.id);
    const buyerId = pickStr(detail?.buyerId);
    const sellerId = resolveRecipientUserId(
      global.TasuPlatformChatDualWindowDemo?.resolveProfileForThread?.(thread || threadId),
      buyerId,
      thread
    );
    return pushPurchasePaymentNotify({
      thread,
      threadId,
      source: COD_REPORTED_SOURCE,
      notifyKey: "cod-reported",
      senderUserId: buyerId,
      recipientUserId: sellerId,
      title: "購入者が商品受取と代金支払いを報告しました",
      body: "代引き回収を確認してください",
      cta: "確認する",
    });
  }

  function notifyDemoCodConfirmed(detail) {
    const thread = detail?.thread || {};
    const threadId = pickStr(detail?.threadId, thread?.id);
    const sellerId = pickStr(detail?.sellerId);
    const profile = global.TasuPlatformChatDualWindowDemo?.resolveProfileForThread?.(thread || threadId);
    const buyerId = resolveRecipientUserId(profile, sellerId, thread);
    const rows = [buyerId, sellerId].filter(Boolean);
    const results = rows.map((uid) =>
      pushPurchasePaymentNotify({
        thread,
        threadId,
        source: COD_CONFIRMED_SOURCE,
        notifyKey: "cod-confirmed",
        senderUserId: sellerId,
        recipientUserId: uid,
        title: "代引き回収確認が完了しました",
        body: "取引が完了しました",
        cta: "確認する",
        demoState: "completed",
      })
    );
    return { ok: results.some((r) => r?.ok) };
  }

  function notifyDemoPurchaseCompleted(detail) {
    const thread = detail?.thread || {};
    const threadId = pickStr(detail?.threadId, thread?.id);
    const profile = global.TasuPlatformChatDualWindowDemo?.resolveProfileForThread?.(thread || threadId);
    const sellerId = pickStr(thread?.sellerId, profile?.partnerAId);
    const buyerId = pickStr(thread?.buyerId, profile?.partnerBId);
    const Purchase = global.TasuPlatformChatPurchasePaymentFlow;
    const feeRequired = Purchase?.shouldQueuePurchaseCompletionFee?.(thread) === true;
    const recipients = feeRequired ? [buyerId] : [sellerId, buyerId];
    const results = recipients.filter(Boolean).map((uid) =>
      pushPurchasePaymentNotify({
        thread,
        threadId,
        source: PURCHASE_COMPLETED_SOURCE,
        notifyKey: "purchase-completed",
        senderUserId: pickStr(detail?.actorId),
        recipientUserId: uid,
        title: "取引が完了しました",
        body: "お疲れさまでした。レビューで取引を締めくくれます。",
        cta: APPROVAL_CTA,
        demoState: "completed",
        openReview: "1",
      })
    );
    return { ok: results.some((r) => r?.ok) };
  }

  function notifyDemoPurchaseCompletionFeeRequired(detail) {
    const thread = detail?.thread || {};
    const threadId = pickStr(detail?.threadId, thread?.id);
    const Purchase = global.TasuPlatformChatPurchasePaymentFlow;
    const fee = Purchase?.getPurchaseCompletionFeeState?.(thread);
    if (!fee?.pending) return { ok: false, skipped: true, reason: "fee_not_pending" };
    const profile = global.TasuPlatformChatDualWindowDemo?.resolveProfileForThread?.(thread || threadId);
    const sellerId = pickStr(thread?.sellerId, profile?.partnerAId);
    if (!sellerId) return { ok: false, reason: "missing_seller" };
    const payUrl = pickStr(
      fee.payUrl,
      global.TasuPlatformChatFee?.buildCompletionFeePayUrl?.({
        threadId,
        listingId: pickStr(thread?.listingId, profile?.listingId),
        category: pickStr(thread?.listingType, profile?.categoryKey),
        feeAmount: fee.amount,
      })
    );
    const row = pushPurchasePaymentNotify({
      thread,
      threadId,
      source: "platform_chat_demo_purchase_completion_fee_v1",
      notifyKey: "purchase-completion-fee",
      senderUserId: pickStr(thread?.buyerId, profile?.partnerBId),
      recipientUserId: sellerId,
      title: "取引完了手数料をお支払いください",
      body: `取引が完了しました。手数料 ¥${fee.amount.toLocaleString("ja-JP")} のお支払いをお願いします。`,
      cta: "手数料を支払う",
      demoState: "completed",
      href: payUrl,
      openReview: false,
      from: "notify",
    });
    return { ok: Boolean(row?.ok), row };
  }

  function notifyDemoPurchaseCompletionFeePaid(detail) {
    const thread = detail?.thread || {};
    const threadId = pickStr(detail?.threadId, thread?.id);
    const profile = global.TasuPlatformChatDualWindowDemo?.resolveProfileForThread?.(thread || threadId);
    const sellerId = pickStr(detail?.sellerId, thread?.sellerId, profile?.partnerAId);
    if (!threadId || !sellerId) return { ok: false, skipped: true, reason: "invalid_input" };

    const notifyId = `platform-chat-demo-purchase-completion-fee-paid-${threadId}-${sellerId}`;
    const store = global.TasuTalkNotifications;
    const existing = (store?.getAll?.() || []).find((n) => String(n.id) === notifyId);
    if (existing) return { ok: true, notification: existing, duplicate: true };

    const row = pushPurchasePaymentNotify({
      thread,
      threadId,
      source: "platform_chat_demo_purchase_completion_fee_paid_v1",
      notifyKey: "purchase-completion-fee-paid",
      senderUserId: pickStr(thread?.buyerId, profile?.partnerBId),
      recipientUserId: sellerId,
      title: "取引が完了しました",
      body: "お疲れさまでした。レビューで取引を締めくくれます。",
      cta: APPROVAL_CTA,
      demoState: "completed",
      openReview: "1",
    });
    return { ok: Boolean(row?.ok), row };
  }

  function notifyDemoProductShipped(detail) {
    if (!shouldHandleDemoThread(detail?.thread || detail?.threadId)) {
      return { ok: false, skipped: true, reason: "not_demo_thread" };
    }

    const Demo = global.TasuPlatformChatDualWindowDemo;
    const thread = detail?.thread || {};
    const threadId = pickStr(detail?.threadId, thread?.id);
    const sellerId = pickStr(detail?.sellerId);
    const profile = Demo.resolveProfileForThread?.(thread || threadId);
    if (!profile || !threadId || !sellerId) {
      return { ok: false, skipped: true, reason: "invalid_input" };
    }

    const buyerId = resolveRecipientUserId(profile, sellerId, thread);
    if (!buyerId) {
      return { ok: false, skipped: true, reason: "recipient_unresolved" };
    }

    const notifyId = `platform-chat-demo-product-shipped-${threadId}-${buyerId}`;
    const meta = resolveCategoryMeta(profile, thread);
    const href = buildChatNotifyHref(profile, buyerId, "active", threadId);
    const Purchase = global.TasuPlatformChatPurchasePaymentFlow;
    const method = Purchase?.getPaymentMethod?.(thread) || "prepaid";
    const shipCopy =
      method === "cash_on_delivery"
        ? {
            title: "商品が発送されました",
            body: "到着時に代金をお支払いください",
            cta: PRODUCT_SHIPPED_CTA,
          }
        : global.TasuPlatformChatCategoryFlow?.getProductShippedNotifyCopy?.(thread) || {
            title: "商品が発送されました",
            body: "出品者から発送通知が届きました。到着後に受け取り完了を申請してください。",
            cta: PRODUCT_SHIPPED_CTA,
          };

    return pushDemoRuntimeNotification({
      id: notifyId,
      type: meta.type,
      category: meta.category,
      title: shipCopy.title,
      body: shipCopy.body,
      actionLabel: shipCopy.cta || PRODUCT_SHIPPED_CTA,
      href,
      targetUrl: href,
      priority: "high",
      sendTalkMessage: true,
      officialRoomId: "official_tasful",
      source: PRODUCT_SHIPPED_SOURCE,
      senderUserId: sellerId,
      recipientUserId: buyerId,
      threadId,
      listingId: meta.listingId,
      notifyListingTitle: meta.listingTitle,
      minimalNotifyCard: true,
      demoState: "active",
    });
  }

  function notifyDemoChatStarted(detail) {
    const thread = detail?.thread || {};
    const threadId = pickStr(detail?.threadId, thread?.id);
    if (!shouldEmitDemoRuntimeNotify(thread || threadId)) {
      return { ok: false, skipped: true, reason: "not_demo_thread" };
    }

    const purchaseStarted = global.TasuTalkPlatformNotify?.notifyPurchaseChatStartedAfterPayment?.(detail);
    if (purchaseStarted?.ok) {
      return purchaseStarted;
    }

    const Demo = global.TasuPlatformChatDualWindowDemo;
    const profile = Demo.resolveProfileForThread?.(thread || threadId);
    const sellerId = pickStr(thread?.sellerId, profile?.partnerAId);
    const buyerId = pickStr(thread?.buyerId, profile?.partnerBId);
    if (!profile || !threadId || !sellerId || !buyerId || sellerId === buyerId) {
      return { ok: false, skipped: true, reason: "invalid_input" };
    }

    const meta = resolveCategoryMeta(profile, thread);
    const sellerHref = buildChatNotifyHref(profile, sellerId, "active", threadId);
    const buyerHref = buildChatNotifyHref(profile, buyerId, "active", threadId);
    const sellerNotifyId = `platform-chat-demo-chat-started-${threadId}-${sellerId}`;
    const buyerNotifyId = `platform-chat-demo-chat-started-${threadId}-${buyerId}`;

    const sellerResult = pushDemoRuntimeNotification({
      id: sellerNotifyId,
      type: meta.type || profile.categoryKey || "skill",
      category: meta.category,
      title: "やりとりが開始されました",
      body: `${profile.partnerBName || "依頼者"} さんとのやりとりチャットが開始されました。内容を確認してください。`,
      actionLabel: MESSAGE_CTA,
      href: sellerHref,
      targetUrl: sellerHref,
      priority: "high",
      sendTalkMessage: true,
      officialRoomId: "official_tasful",
      source: CHAT_STARTED_SOURCE,
      senderUserId: buyerId,
      recipientUserId: sellerId,
      threadId,
      listingId: meta.listingId,
      notifyListingTitle: meta.listingTitle,
      minimalNotifyCard: true,
      demoState: "active",
    });

    const buyerResult = pushDemoRuntimeNotification({
      id: buyerNotifyId,
      type: meta.type || profile.categoryKey || "skill",
      category: meta.category,
      title: "やりとりが開始されました",
      body: "出品者が確認し、チャットが開始されました。内容を確認してください。",
      actionLabel: MESSAGE_CTA,
      href: buyerHref,
      targetUrl: buyerHref,
      priority: "high",
      sendTalkMessage: true,
      officialRoomId: "official_tasful",
      source: CHAT_STARTED_SOURCE,
      senderUserId: sellerId,
      recipientUserId: buyerId,
      threadId,
      listingId: meta.listingId,
      notifyListingTitle: meta.listingTitle,
      minimalNotifyCard: true,
      demoState: "active",
    });

    const ok = Boolean(sellerResult?.ok || buyerResult?.ok);
    if (ok) {
      try {
        global.TasuPlatformChatBenchEmbed?.postBenchChatStarted?.({
          thread,
          threadId,
          buyerId,
          profile,
          chatHref: buyerHref,
        });
      } catch {
        /* ignore */
      }
    }

    return { ok, sellerResult, buyerResult };
  }

  function notifyDemoContactDeclined(detail) {
    if (!isChatDemoReviewMode()) return { ok: false, skipped: true, reason: "not_demo_mode" };
    if (!shouldHandleDemoThread(detail?.thread || detail?.threadId)) {
      return { ok: false, skipped: true, reason: "not_demo_thread" };
    }

    const Demo = global.TasuPlatformChatDualWindowDemo;
    const thread = detail?.thread || {};
    const threadId = pickStr(detail?.threadId, thread?.id);
    const profile = Demo.resolveProfileForThread?.(thread || threadId);
    const buyerId = pickStr(thread?.buyerId, profile?.partnerBId);
    if (!profile || !threadId || !buyerId) {
      return { ok: false, skipped: true, reason: "invalid_input" };
    }

    const notifyId = `platform-chat-demo-declined-${threadId}-${buyerId}`;
    const meta = resolveCategoryMeta(profile, thread);
    const href = buildChatNotifyHref(profile, buyerId, "cancelled");

    return pushDemoRuntimeNotification({
      id: notifyId,
      type: meta.type,
      category: meta.category,
      title: "今回は見送りになりました",
      body: "今回のやりとりは見送りになりました。",
      actionLabel: "内容を確認する",
      href,
      targetUrl: href,
      priority: "medium",
      sendTalkMessage: true,
      officialRoomId: "official_tasful",
      source: CANCEL_SOURCE,
      recipientUserId: buyerId,
      threadId,
      listingId: meta.listingId,
      notifyListingTitle: meta.listingTitle,
      minimalNotifyCard: true,
      demoState: "cancelled",
    });
  }

  function notifyDemoConversationCancelled(detail) {
    if (!shouldHandleDemoThread(detail?.thread || detail?.threadId)) {
      return { ok: false, skipped: true, reason: "not_demo_thread" };
    }

    const Demo = global.TasuPlatformChatDualWindowDemo;
    const thread = detail?.thread || {};
    const threadId = pickStr(detail?.threadId, thread?.id);
    const cancelledBy = pickStr(detail?.cancelledBy);
    const profile = Demo.resolveProfileForThread?.(thread || threadId);
    const recipientUserId = resolveRecipientUserId(profile, cancelledBy, thread);
    if (!profile || !threadId || !cancelledBy || !recipientUserId) {
      return { ok: false, skipped: true, reason: "invalid_input" };
    }

    const Completion = global.TasuPlatformChatCompletionFlow;
    const actorName = Completion?.resolveActorDisplayName?.(cancelledBy, thread) || "相手";
    const reason = pickStr(detail?.reasonLabel, detail?.reason);
    const notifyId = `platform-chat-demo-cancelled-${threadId}-${recipientUserId}`;
    const meta = resolveCategoryMeta(profile, thread);
    const href = buildChatNotifyHref(profile, recipientUserId, "cancelled");

    return pushDemoRuntimeNotification({
      id: notifyId,
      type: meta.type,
      category: meta.category,
      title: "やりとりがキャンセルされました",
      body: reason
        ? `${formatNameWithSan(actorName)}がキャンセルしました（${reason}）`
        : `${formatNameWithSan(actorName)}がやりとりをキャンセルしました`,
      actionLabel: CANCEL_CTA,
      href,
      targetUrl: href,
      priority: "high",
      sendTalkMessage: true,
      officialRoomId: "official_tasful",
      source: CANCEL_SOURCE,
      recipientUserId,
      threadId,
      listingId: meta.listingId,
      notifyListingTitle: meta.listingTitle,
      minimalNotifyCard: true,
      demoState: "cancelled",
    });
  }

  function notifyDemoCancelRequested(detail) {
    if (!shouldHandleDemoThread(detail?.thread || detail?.threadId)) {
      return { ok: false, skipped: true, reason: "not_demo_thread" };
    }
    const Demo = global.TasuPlatformChatDualWindowDemo;
    const thread = detail?.thread || {};
    const threadId = pickStr(detail?.threadId, thread?.id);
    const requesterId = pickStr(detail?.requesterId);
    const profile = Demo.resolveProfileForThread?.(thread || threadId);
    const recipientUserId = resolveRecipientUserId(profile, requesterId, thread);
    if (!profile || !threadId || !requesterId || !recipientUserId) {
      return { ok: false, skipped: true, reason: "invalid_input" };
    }
    const Completion = global.TasuPlatformChatCompletionFlow;
    const actorName = Completion?.resolveActorDisplayName?.(requesterId, thread) || "相手";
    const reason = pickStr(detail?.reasonLabel);
    const meta = resolveCategoryMeta(profile, thread);
    const href = buildChatNotifyHref(profile, recipientUserId, "active");
    return pushDemoRuntimeNotification({
      id: `platform-chat-demo-cancel-req-${threadId}-${recipientUserId}`,
      type: meta.type,
      category: meta.category,
      title: "相手がキャンセルを申請しました",
      body: reason
        ? `${formatNameWithSan(actorName)}からキャンセル申請（${reason}）`
        : `${formatNameWithSan(actorName)}からキャンセル申請が届きました`,
      actionLabel: "承認する",
      href,
      targetUrl: href,
      priority: "high",
      sendTalkMessage: true,
      officialRoomId: "official_tasful",
      source: CANCEL_SOURCE,
      recipientUserId,
      threadId,
      listingId: meta.listingId,
      notifyListingTitle: meta.listingTitle,
      minimalNotifyCard: true,
      cancelRequest: true,
    });
  }

  function notifyDemoCancelRequestApproved(detail) {
    const thread = detail?.thread || {};
    const threadId = pickStr(detail?.threadId, thread?.id);
    const requesterId = pickStr(thread?.cancelRequestedBy, thread?.buyerId, thread?.sellerId);
    return notifyDemoConversationCancelled({
      ...detail,
      threadId,
      thread,
      cancelledBy: pickStr(detail?.approverId),
      reasonLabel: pickStr(thread?.cancelRequestReason, "キャンセル申請承認"),
      recipientUserId: requesterId,
    });
  }

  function notifyDemoCancelRequestRejected(detail) {
    if (!shouldHandleDemoThread(detail?.thread || detail?.threadId)) {
      return { ok: false, skipped: true };
    }
    const Demo = global.TasuPlatformChatDualWindowDemo;
    const thread = detail?.thread || {};
    const threadId = pickStr(detail?.threadId, thread?.id);
    const requesterId = pickStr(detail?.requesterId);
    const profile = Demo.resolveProfileForThread?.(thread || threadId);
    if (!profile || !threadId || !requesterId) return { ok: false, skipped: true };
    const meta = resolveCategoryMeta(profile, thread);
    const href = buildChatNotifyHref(profile, requesterId, "active");
    return pushDemoRuntimeNotification({
      id: `platform-chat-demo-cancel-reject-${threadId}-${requesterId}`,
      type: meta.type,
      category: meta.category,
      title: "キャンセル申請が却下されました",
      body: "取引は継続されます。",
      actionLabel: "チャットを開く",
      href,
      targetUrl: href,
      priority: "high",
      source: CANCEL_SOURCE,
      recipientUserId: requesterId,
      threadId,
      listingId: meta.listingId,
      minimalNotifyCard: true,
    });
  }

  function isDemoRuntimeNotification(row) {
    return RUNTIME_SOURCES.has(String(row?.source || ""));
  }

  function isDemoMessageNotification(row) {
    return String(row?.source || "") === MESSAGE_SOURCE;
  }

  function onDemoMessageSent(detail) {
    return notifyDemoChatMessage(detail);
  }

  /** @alias notifyDemoChatMessage — senderUserId / recipientUserId で相手側のみに通知 */
  function notifyNewMessage(detail) {
    return notifyDemoChatMessage(detail);
  }

  global.TasuPlatformChatDualWindowNotify = {
    MESSAGE_SOURCE,
    COMPLETION_REQUEST_SOURCE,
    BUYER_PAID_SOURCE,
    APPROVAL_SOURCE,
    CANCEL_SOURCE,
    MESSAGE_TITLE,
    MESSAGE_CTA,
    COMPLETION_REQUEST_CTA,
    BUYER_PAID_CTA,
    APPROVAL_CTA,
    CANCEL_CTA,
    isDemoRuntimeNotification,
    isDemoMessageNotification,
    notifyDemoChatMessage,
    notifyNewMessage,
    notifyDemoCompletionRequested,
    notifyCompletionApprovedToRequester,
    notifyDemoBuyerPaid,
    notifyDemoProductShipped,
    notifyDemoShippingReady,
    notifyDemoBankTransferReported,
    notifyDemoPaymentConfirmed,
    notifyDemoProductReceived,
    notifyDemoCodPaymentReported,
    notifyDemoCodConfirmed,
    notifyDemoPurchaseCompleted,
    notifyDemoPurchaseCompletionFeeRequired,
    notifyDemoPurchaseCompletionFeePaid,
    notifyDemoCompletionApproved,
    notifyDemoChatStarted,
    PRODUCT_SHIPPED_SOURCE,
    PRODUCT_SHIPPED_CTA,
    notifyDemoContactDeclined,
    notifyDemoConversationCancelled,
    notifyDemoCancelRequested,
    notifyDemoCancelRequestApproved,
    notifyDemoCancelRequestRejected,
    CHAT_STARTED_SOURCE,
    onDemoMessageSent,
  };
})(typeof window !== "undefined" ? window : globalThis);
