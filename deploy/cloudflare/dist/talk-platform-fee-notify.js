/**
 * プラット通知 — 手数料（Connect未利用: チャット開始前 / Connect利用: 取引完了時）
 */
(function (global) {
  "use strict";

  const SOURCE = "platform_fee_v1";

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function pushNotification(input) {
    return global.TasuTalkPlatformNotify?.pushNotification?.(input) || null;
  }

  function buildMinimalPayload(base) {
    return {
      ...base,
      type: "platform_fee",
      body: "",
      actionLabel: "確認する",
      sendTalkMessage: true,
      officialRoomId: "official_platform",
      source: SOURCE,
      minimalNotifyCard: true,
      notifyTags: ["platform_fee"],
      sendNotification: true,
    };
  }

  /**
   * Connect未利用 — やりとりチャット開始前
   * @param {{ listing?: object, thread?: object, feeAmount?: number }} detail
   */
  function notifyChatFeeRequired(detail) {
    const Fee = global.TasuPlatformChatFee;
    const listing = detail?.listing || {};
    const thread = detail?.thread || {};
    const threadId = pickStr(thread.id, detail?.threadId);
    const listingId = pickStr(listing.id, listing.listing_id, thread.listingId);
    const category = Fee?.resolveCategoryKey?.(listing) || "skill";
    const feeAmount = detail?.feeAmount != null ? detail.feeAmount : Fee?.calcPreChatFee?.(listing);
    const payUrl =
      Fee?.buildFeePayUrl?.({
        threadId,
        listingId,
        category,
        listing,
        thread,
      }) || "platform-chat-fee-pay.html";

    if (threadId && Fee?.ensurePendingFee) {
      Fee.ensurePendingFee(listing, thread, { feeAmount });
    }

    return pushNotification(
      buildMinimalPayload({
        type: Fee?.getNotifyType?.(category) || "skill",
        category: Fee?.getCategoryLabel?.(category) || "取引",
        title: "やりとりチャットを開始するには手数料が必要です",
        href: payUrl,
        targetUrl: payUrl,
        priority: "high",
        recipientRole: pickStr(detail?.recipientRole) || "seller",
        recipientUserId: pickStr(detail?.recipientUserId, thread?.sellerId),
        threadId,
        listingId,
        feeAmount,
        feePhase: "pre_chat",
        connectMode: "prepay",
      })
    );
  }

  /**
   * Connect利用 — 取引完了時（やりとりチャット内の完了報告へ）
   * @param {{ listing?: object, thread?: object, deal?: object, room?: object, agreedAmount?: number }} detail
   */
  function notifyDealCompletedConnect(detail) {
    const Fee = global.TasuPlatformChatFee;
    const listing = detail?.listing || {};
    const deal = detail?.deal || {};
    const thread = detail?.thread || {};
    const room = detail?.room || {};
    const category = Fee?.resolveCategoryKey?.(listing) || "skill";
    const dealId = pickStr(deal.id);
    const threadId = pickStr(thread.id, deal.chat_id);
    const roomId = pickStr(room.id, deal.chat_id, thread.id);
    if (dealId || threadId || roomId) {
      global.TasuPlatformChatCompletion?.ensureDemoSkillDealThread?.();
    }
    const dealUrl =
      Fee?.buildCompletionNotifyChatUrl?.({
        listing,
        deal,
        thread,
        room,
        dealId,
        roomId,
        threadId,
        category,
      }) ||
      Fee?.buildChatDetailUrl?.({ threadId, roomId, dealId, thread, room }) ||
      "#";

    const amountBase =
      detail?.agreedAmount != null
        ? detail.agreedAmount
        : deal.agreed_amount != null
          ? deal.agreed_amount
          : Fee?.extractListingAmount?.(listing);
    const feeAmount = Fee?.calcCompletionFee?.(amountBase);

    return pushNotification(
      buildMinimalPayload({
        type: Fee?.getNotifyType?.(category) || "skill",
        category: Fee?.getCategoryLabel?.(category) || "取引",
        title: "取引が完了しました",
        href: dealUrl,
        targetUrl: dealUrl,
        priority: "high",
        recipientRole: pickStr(detail?.recipientRole) || "party",
        dealId: pickStr(deal.id),
        threadId: pickStr(thread.id, deal.chat_id),
        roomId: pickStr(room.id, deal.chat_id),
        listingId: pickStr(listing.id, listing.listing_id, thread.listingId),
        feeAmount,
        feePhase: "on_complete",
        connectMode: "connect",
      })
    );
  }

  /**
   * 手数料支払い完了 — 双方のやりとりチャット開始
   * @param {{ thread?: object, listing?: object }} detail
   */
  function notifyChatActivated(detail) {
    const Fee = global.TasuPlatformChatFee;
    const thread = detail?.thread || {};
    const listing = detail?.listing || {};
    const threadId = pickStr(thread.id, detail?.threadId);
    const category =
      Fee?.resolveCategoryKey?.(listing) ||
      Fee?.resolveCategoryKey?.(thread) ||
      (String(thread?.threadKind || "") === "job_hire" ? "job" : "skill");
    const chatUrl = Fee?.buildChatDetailUrl?.({ threadId, thread }) || Fee?.buildChatUrl?.({ id: threadId });
    const isJob = Fee?.isJobCategory?.(category);

    const base = {
      type: "platform_fee",
      category: Fee?.getCategoryLabel?.(category) || (isJob ? "求人" : "取引"),
      title: isJob ? "やりとりチャットが開始されました" : "やりとりチャットが開始されました",
      href: chatUrl,
      targetUrl: chatUrl,
      priority: "high",
      threadId,
      listingId: pickStr(listing.id, thread.listingId),
      feePhase: "chat_activated",
      connectMode: "prepay",
    };

    if (detail?.notifyRequesterOnly === true) {
      return pushNotification(
        buildMinimalPayload({
          ...base,
          recipientRole: "buyer",
          recipientUserId: pickStr(thread.buyerId),
        })
      );
    }
    pushNotification(buildMinimalPayload({ ...base, recipientRole: "seller" }));
    return pushNotification(buildMinimalPayload({ ...base, recipientRole: "buyer" }));
  }

  function isPlatformFeeNotification(n) {
    if (!n || typeof n !== "object") return false;
    if (n.source === SOURCE) return true;
    if (n.minimalNotifyCard === true && Array.isArray(n.notifyTags) && n.notifyTags.includes("platform_fee")) {
      return true;
    }
    return false;
  }

  global.TasuTalkPlatformFeeNotify = {
    SOURCE,
    notifyChatFeeRequired,
    notifyChatActivated,
    notifyDealCompletedConnect,
    isPlatformFeeNotification,
  };
})(typeof window !== "undefined" ? window : globalThis);
