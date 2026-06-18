/**
 * プラットフォームチャット — 評価送信後の通知・システムメッセージ（全カテゴリ共通）
 */
(function (global) {
  "use strict";

  const NOTIFY_SOURCE = "platform_chat_review_v1";
  /** 完了済みチャット内へのレビューCTA常設は不可（TALK通知→レビュー画面のみ） */
  const INLINE_CHAT_REVIEW_IN_THREAD = false;

  function isInlineChatReviewEnabled() {
    return INLINE_CHAT_REVIEW_IN_THREAD;
  }
  const REVIEW_RECEIVED_TITLE = "レビューされました";
  const REVIEW_RECEIVED_CTA = "評価を見る";
  const REVIEW_SUBMITTED_TOAST = "評価を送信しました";
  const REVIEW_PROMPT_DONE = "✓ 評価を送信しました";

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function readLocalReviews() {
    try {
      const raw = global.localStorage?.getItem("tasu_chat_seed_v1");
      const seed = raw ? JSON.parse(raw) : {};
      return Array.isArray(seed?.reviews) ? seed.reviews : [];
    } catch {
      return [];
    }
  }

  function hasUserSubmittedReview(threadId, userId, targetUserId) {
    const id = pickStr(threadId);
    const me = pickStr(userId);
    const target = pickStr(targetUserId);
    if (!id || !me) return false;
    return readLocalReviews().some((row) => {
      if (String(row.room_id) !== id || String(row.reviewer_id) !== me) return false;
      if (!target) return true;
      return String(row.reviewed_user_id) === target;
    });
  }

  function getReviewTargetUserId(thread, reviewerId) {
    const me = pickStr(reviewerId);
    const Demo = global.TasuPlatformChatDualWindowDemo;
    const partners = Demo?.resolveBenchPartnerIds?.(null, thread) || {};
    const Category = global.TasuPlatformChatCategoryFlow;
    const buyer =
      pickStr(partners.buyerId) ||
      Category?.getBuyerId?.(thread) ||
      pickStr(thread?.buyerId, thread?.buyer_id);
    const seller =
      pickStr(partners.sellerId) ||
      Category?.getSellerId?.(thread) ||
      pickStr(thread?.sellerId, thread?.seller_id);
    if (me && buyer && me === buyer) return seller;
    if (me && seller && me === seller) return buyer;
    if (global.TasuPlatformChatJobFlow?.isJobThread?.(thread)) {
      return global.TasuPlatformChatJobFlow.getJobReviewTargetUserId?.(thread, reviewerId) || "";
    }
    return "";
  }

  function formatReviewerDisplayName(reviewerId, thread) {
    const Category = global.TasuPlatformChatCategoryFlow;
    return (
      Category?.resolveActorDisplayName?.(reviewerId, thread) ||
      pickStr(thread?.partner?.displayName) ||
      "相手"
    );
  }

  function formatNameWithSan(reviewerName) {
    const name = pickStr(reviewerName, "相手");
    if (/さん$/.test(name)) return name;
    return `${name}さん`;
  }

  function formatReviewReceivedBody(reviewerName) {
    return `${formatNameWithSan(reviewerName)}が今回のやりとりを評価しました`;
  }

  function formatReviewSystemMessage(reviewerName) {
    return `✓ ${formatNameWithSan(reviewerName)}が評価を送信しました`;
  }

  function resolveListingTitle(thread) {
    return pickStr(
      thread?.listingTitle,
      thread?.listing_title,
      thread?.title,
      thread?.partner?.listingTitle
    );
  }

  function resolveListingId(thread) {
    return pickStr(thread?.listingId, thread?.listing_id);
  }

  function resolveCategoryKey(thread) {
    const Fee = global.TasuPlatformChatFee;
    return (
      Fee?.resolveCategoryKey?.(thread) ||
      global.TasuPlatformChatCategoryFlow?.getCategorySpec?.(thread)?.key ||
      "skill"
    );
  }

  function applyReviewNotifyParamsToChatUrl(href, options) {
    const raw = pickStr(href);
    if (!raw || raw === "#" || !/chat-detail\.html/i.test(raw)) return raw;
    const state = pickStr(options?.state, options?.demoState, "completed").toLowerCase();
    try {
      const u = new URL(raw, global.location?.href || "http://localhost/");
      const from = pickStr(options?.from, u.searchParams.get("from"), "notify");
      if (from) u.searchParams.set("from", from);
      if (state) u.searchParams.set("demoState", state);
      if (
        state === "completed" ||
        ["1", "true"].includes(pickStr(options?.openReview, u.searchParams.get("openReview")).toLowerCase())
      ) {
        u.searchParams.set("openReview", pickStr(options?.openReview, "1"));
      }
      const threadId = pickStr(u.searchParams.get("thread"));
      const store = global.TasuChatThreadStore;
      const thread =
        options?.thread ||
        (threadId && store?.readAll
          ? (store.readAll() || []).find((row) => String(row.id) === threadId)
          : null);
      const Entry = global.TasuPlatformChatConnectEntryFlow;
      if (
        thread &&
        Entry?.shouldAppendConnectEntryUrlParams?.({
          thread,
          connectEntryPayment: thread.connectEntryPayment,
        }) === true
      ) {
        return Entry.appendConnectEntryUrlParams(`${u.pathname}${u.search}${u.hash || ""}`, {
          thread,
          threadId,
          connectEntryPayment: true,
        });
      }
      return `${u.pathname}${u.search}${u.hash || ""}`;
    } catch {
      return raw;
    }
  }

  function buildReviewOpenChatUrl(thread, recipientUserId, options) {
    const threadId = pickStr(options?.threadId, thread?.id);
    const userId = pickStr(recipientUserId);
    const Demo = global.TasuPlatformChatDualWindowDemo;
    const profile = Demo?.resolveProfileForThread?.(thread);

    if (profile && Demo?.chatUrl) {
      return Demo.chatUrl(profile.id, userId, {
        review: Demo.REVIEW_PARAM || "chat-demo",
        state: pickStr(options?.state, "completed"),
        from: pickStr(options?.from, "notify"),
        openReview: pickStr(options?.openReview, "1"),
        threadId,
      });
    }

    const u = new URL("chat-detail.html", global.location?.href || "http://localhost/");
    if (threadId) u.searchParams.set("thread", threadId);
    u.searchParams.set("talkDev", "1");
    if (userId) u.searchParams.set("userId", userId);
    u.searchParams.set("from", pickStr(options?.from, "notify"));
    u.searchParams.set("openReview", pickStr(options?.openReview, "1"));
    u.searchParams.set("demoState", pickStr(options?.state, "completed"));
    return `${u.pathname}${u.search}`;
  }

  function parseReviewerIdFromReviewNotifyId(notifyId, threadId) {
    const id = pickStr(notifyId);
    const tid = pickStr(threadId);
    if (!id || !tid) return "";
    const prefix = `platform-chat-review-received-${tid}-`;
    if (!id.startsWith(prefix)) return "";
    return pickStr(id.slice(prefix.length));
  }

  function findReceivedReview(threadId, recipientUserId, reviewerId) {
    const id = pickStr(threadId);
    const recipient = pickStr(recipientUserId);
    const reviewer = pickStr(reviewerId);
    if (!id || !recipient) return null;
    return (
      readLocalReviews().find((row) => {
        if (String(row.room_id) !== id) return false;
        if (String(row.reviewed_user_id) !== recipient) return false;
        if (reviewer && String(row.reviewer_id) !== reviewer) return false;
        if (row.is_skipped === true) return false;
        return true;
      }) || null
    );
  }

  function hasReceivedReviewToView(threadId, recipientUserId, reviewerId) {
    return Boolean(findReceivedReview(threadId, recipientUserId, reviewerId));
  }

  function buildReviewViewChatUrl(thread, recipientUserId, options) {
    const opts = options || {};
    const threadId = pickStr(opts.threadId, thread?.id);
    const userId = pickStr(recipientUserId);
    const reviewerId = pickStr(opts.reviewerId);
    if (!threadId || !userId) return "";
    if (!hasReceivedReviewToView(threadId, userId, reviewerId)) return "";

    const Demo = global.TasuPlatformChatDualWindowDemo;
    const profile = Demo?.resolveProfileForThread?.(thread);

    if (profile && Demo?.chatUrl) {
      return Demo.chatUrl(profile.id, userId, {
        review: Demo.REVIEW_PARAM || "chat-demo",
        connect: profile.connect,
        state: pickStr(opts.state, "completed"),
        from: pickStr(opts.from, "notify"),
        openReviews: pickStr(opts.openReviews, "1"),
        reviewerId,
        threadId,
      });
    }

    const u = new URL("chat-detail.html", global.location?.href || "http://localhost/");
    u.searchParams.set("thread", threadId);
    u.searchParams.set("talkDev", "1");
    u.searchParams.set("userId", userId);
    u.searchParams.set("from", pickStr(opts.from, "notify"));
    u.searchParams.set("openReviews", pickStr(opts.openReviews, "1"));
    u.searchParams.set("demoState", pickStr(opts.state, "completed"));
    if (reviewerId) u.searchParams.set("reviewerId", reviewerId);
    if (global.TasuPlatformChatJobFlow?.isJobThread?.(thread)) {
      const demoId = pickStr(global.TasuPlatformChatJobFlow?.DEMO_THREAD_ID, "chat-demo-job-full-001");
      if (threadId === demoId) u.searchParams.set("review", "job-full");
    }
    return `${u.pathname}${u.search}`;
  }

  function buildReviewReceivedHref(thread, recipientUserId, options) {
    const opts = options || {};
    const reviewerId = pickStr(opts.reviewerId);
    return buildReviewViewChatUrl(thread, recipientUserId, {
      threadId: pickStr(thread?.id),
      reviewerId,
      from: pickStr(opts.from, "notify"),
      state: "completed",
      openReviews: "1",
    });
  }

  function appendReviewSystemMessage(threadId, reviewerName) {
    const Completion = global.TasuPlatformChatCompletionFlow;
    return Completion?.appendSystemMessage?.(threadId, formatReviewSystemMessage(reviewerName));
  }

  function notifyReviewReceived(detail) {
    const thread = detail?.thread || {};
    const threadId = pickStr(detail?.roomId, detail?.threadId, thread?.id);
    const reviewerId = pickStr(detail?.reviewerId);
    const reviewedUserId = pickStr(detail?.reviewedUserId);
    const isSkipped = Boolean(detail?.isSkipped);

    if (isSkipped || !threadId || !reviewerId || !reviewedUserId) {
      return { ok: false, skipped: true };
    }

    const notifyId = `platform-chat-review-received-${threadId}-${reviewerId}`;
    const existing = (global.TasuTalkNotifications?.getAll?.() || []).find(
      (n) => String(n.id) === notifyId
    );
    if (existing) return { ok: true, notification: existing, duplicate: true };

    const reviewerName = formatReviewerDisplayName(reviewerId, thread);
    const categoryKey = resolveCategoryKey(thread);
    const Fee = global.TasuPlatformChatFee;
    const categoryLabel =
      global.TasuPlatformChatCategoryFlow?.getLabels?.(thread)?.categoryLabel ||
      Fee?.getCategoryLabel?.(categoryKey) ||
      "取引";
    const href = buildReviewReceivedHref(thread, reviewedUserId, { reviewerId });
    if (!href) {
      return { ok: false, skipped: true, reason: "no_review_row" };
    }
    const body = formatReviewReceivedBody(reviewerName);
    const listingId = resolveListingId(thread);
    const listingTitle = resolveListingTitle(thread) || categoryLabel;

    const draft = {
      id: notifyId,
      type: Fee?.getNotifyType?.(categoryKey) || categoryKey,
      category: categoryLabel,
      title: REVIEW_RECEIVED_TITLE,
      body,
      actionLabel: REVIEW_RECEIVED_CTA,
      href,
      targetUrl: href,
      priority: "medium",
      sendTalkMessage: true,
      officialRoomId: "official_tasful",
      minimalNotifyCard: true,
      source: NOTIFY_SOURCE,
      recipientUserId: reviewedUserId,
      threadId,
      listingId,
      notifyListingTitle: listingTitle,
      reviewerId,
      reviewerName,
      notifyEventAt: new Date().toISOString(),
    };

    draft.actionLabel =
      pickStr(draft.actionLabel) ||
      global.TasuPlatformNotifyActionLabels?.resolvePlatformNotifyActionLabel?.(draft) ||
      REVIEW_RECEIVED_CTA;

    const row =
      global.TasuTalkPlatformNotify?.notifyPlatformReviewReceived?.(draft) ||
      global.TasuTalkPlatformNotify?.pushNotification?.(draft) ||
      global.TasuTalkData?.addNotification?.(draft) ||
      global.TasuTalkNotifications?.add?.(draft);

    try {
      const all = global.TasuTalkNotifications?.getAll?.() || [];
      global.__tasuReviewNotifyDiag = {
        reviewNotifyCreated: Boolean(row),
        reviewNotifyRecipient: reviewedUserId,
        reviewerId,
        reviewedUserId,
        threadId,
        notificationsCountBefore: all.length - (row ? 1 : 0),
        notificationsCountAfter: all.length,
        latestNotificationType: pickStr(row?.type, row?.source),
        latestNotificationRecipient: pickStr(row?.recipientUserId),
      };
    } catch {
      /* ignore */
    }

    if (row) {
      try {
        global.TasuTalkPlatformNotify?.refreshBenchNotifyForCompletionRecipients?.(
          reviewedUserId,
          reviewerId
        );
      } catch {
        /* ignore */
      }
    }

    return { ok: Boolean(row), notification: row };
  }

  function handleReviewSubmitted(detail) {
    const thread = detail?.thread || {};
    const threadId = pickStr(detail?.roomId, detail?.threadId, thread?.id);
    const reviewerId = pickStr(detail?.reviewerId);
    const reviewedUserId = pickStr(detail?.reviewedUserId);
    const isSkipped = Boolean(detail?.isSkipped);

    if (!threadId || !reviewerId) return { ok: false, reason: "invalid_input" };
    if (isSkipped) return { ok: true, skipped: true };

    const Category = global.TasuPlatformChatCategoryFlow;
    if (Category?.isPlatformCompletionThread?.(thread) !== true) {
      return { ok: true, skipped: true, reason: "not_platform_thread" };
    }

    const reviewerName = formatReviewerDisplayName(reviewerId, thread);
    appendReviewSystemMessage(threadId, reviewerName);
    const notifyRes = notifyReviewReceived({
      thread,
      threadId,
      roomId: threadId,
      reviewerId,
      reviewedUserId: reviewedUserId || getReviewTargetUserId(thread, reviewerId),
      isSkipped,
    });

    try {
      global.dispatchEvent(
        new CustomEvent("tasful-platform-review-submitted", {
          detail: { threadId, reviewerId, reviewedUserId, notification: notifyRes?.notification },
        })
      );
    } catch {
      /* ignore */
    }

    return { ok: true, notify: notifyRes };
  }

  function isPlatformReviewNotification(row) {
    return String(row?.source || "") === NOTIFY_SOURCE;
  }

  function escHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function hasUserSubmittedReviewForRoom(thread, userId) {
    const threadId = pickStr(thread?.id);
    const meId = pickStr(userId);
    if (!threadId || !meId) return false;
    const target = getReviewTargetUserId(thread, meId);
    if (global.TasuPlatformChatJobFlow?.isJobThread?.(thread) === true) {
      return (
        global.TasuPlatformChatJobFlow?.hasUserSubmittedReview?.(threadId, meId, target) === true
      );
    }
    if (global.TasuPlatformChatCategoryFlow?.hasUserSubmittedReview?.(threadId, meId) === true) {
      return true;
    }
    return hasUserSubmittedReview(threadId, meId, target);
  }

  function isRoomCompletedForReview(thread, userId) {
    if (!thread) return false;
    const rs = pickStr(thread?.roomStatus, thread?.status).toLowerCase();
    const storeCompleted = rs === "completed" || thread?.completed === true;
    if (!storeCompleted) return false;

    const Category = global.TasuPlatformChatCategoryFlow;
    if (Category?.isMarketplaceConnectEntryThread?.(thread) === true) {
      return true;
    }
    if (
      thread?.connectEntryPayment === true &&
      Category?.isMarketplaceConnectCategory?.(Category?.resolveCategoryKey?.(thread)) === true
    ) {
      return true;
    }

    const Job = global.TasuPlatformChatJobFlow;
    if (Job?.isJobThread?.(thread) === true) {
      return Job.shouldShowJobReviewPrompt?.(thread) === true;
    }

    const Purchase = global.TasuPlatformChatPurchasePaymentFlow;
    const isPurchaseLike =
      Purchase?.appliesToThread?.(thread) === true ||
      Category?.isProductFlowCategory?.(thread) === true ||
      Category?.isShopStoreCategory?.(thread) === true;
    if (isPurchaseLike) {
      const me = pickStr(userId);
      if (me && typeof Purchase?.isReadyForReview === "function") {
        return Purchase.isReadyForReview(thread, me) === true;
      }
      return storeCompleted;
    }

    const WorkSvc = global.TasuPlatformChatWorkServiceConnectFlow;
    if (WorkSvc?.isWorkServiceConnectThread?.(thread) === true) {
      const me = pickStr(userId);
      if (me) return WorkSvc.isReadyForReview?.(thread, me) === true;
      return storeCompleted;
    }

    const Connect = global.TasuPlatformChatConnectChatFlow;
    if (Connect?.isConnectThread?.(thread) === true) {
      return Connect.isPaymentCompletedForReview?.(thread) === true;
    }

    const manual = global.TasuPlatformChatManualTransferFlow;
    if (manual?.isManualTransferActive?.(thread) === true) {
      return manual.isPaymentConfirmedForReview?.(thread) === true;
    }

    return true;
  }

  function canShowReviewForRoom(thread, userId) {
    if (!INLINE_CHAT_REVIEW_IN_THREAD) return false;
    const Job = global.TasuPlatformChatJobFlow;
    const Category = global.TasuPlatformChatCategoryFlow;
    const Demo = global.TasuPlatformChatDualWindowDemo;
    const Purchase = global.TasuPlatformChatPurchasePaymentFlow;
    if (Category?.isMarketplaceConnectEntryThread?.(thread) === true) {
      return Category.isReviewEligible?.(thread, userId) === true;
    }
    if (
      thread?.connectEntryPayment === true &&
      Category?.isMarketplaceConnectCategory?.(Category?.resolveCategoryKey?.(thread)) === true
    ) {
      return Category?.isReviewEligible?.(thread, userId) === true;
    }
    if (Job?.isJobThread?.(thread) === true) {
      return Job.shouldShowJobReviewPrompt?.(thread) === true;
    }
    if (Purchase?.appliesToThread?.(thread) === true) {
      return Purchase.isReadyForReview?.(thread, userId) === true;
    }
    if (Category?.isReviewEligible?.(thread, userId) === true) return true;
    if (Demo?.shouldShowReviewPrompt?.(thread, userId) === true) return true;
    return false;
  }

  function renderReviewOpenActionHtml(thread, userId, options) {
    const room = thread || {};
    const meId = pickStr(userId);
    if (!canShowReviewForRoom(room, meId)) return "";
    const labels = options?.labels || global.TasuPlatformChatCategoryFlow?.getLabels?.(room) || {};
    const btnLabel = pickStr(options?.btnLabel, labels.reviewPromptBtn, labels.reviewBtn, "レビューする");
    const doneLabel = pickStr(options?.doneLabel, labels.reviewPromptDone, REVIEW_PROMPT_DONE);
    const reviewed = options?.reviewed === true || hasUserSubmittedReviewForRoom(room, meId);
    if (reviewed) {
      return `<p class="chat-job-review-prompt__done" role="status">${escHtml(doneLabel)}</p>`;
    }
    return (
      `<button type="button" class="chat-job-review-prompt__btn" data-platform-review-open data-platform-job-review-open aria-label="${escHtml(btnLabel)}">${escHtml(btnLabel)}</button>`
    );
  }

  const REVIEW_NOTIFY_CLICK_WALL_KEY = "tasu_review_notify_click_wall";

  function stampReviewNotifyClickFromHref(href) {
    const raw = pickStr(href);
    if (!raw || !/(?:^|[?&])openReview=(?:1|true)(?:&|$)/i.test(raw)) return false;
    const wall = Date.now();
    try {
      global.sessionStorage?.setItem(REVIEW_NOTIFY_CLICK_WALL_KEY, String(wall));
    } catch {
      /* ignore */
    }
    try {
      global.dispatchEvent?.(
        new CustomEvent("tasu-review-notify-click", { detail: { href: raw, wall } })
      );
    } catch {
      /* ignore */
    }
    return true;
  }

  function readReviewNotifyClickWall() {
    try {
      return Number(global.sessionStorage?.getItem(REVIEW_NOTIFY_CLICK_WALL_KEY)) || 0;
    } catch {
      return 0;
    }
  }

  function shouldAutoOpenReviewFromContext(searchParams, thread, userId) {
    const params =
      searchParams instanceof URLSearchParams
        ? searchParams
        : new URLSearchParams(global.location?.search || "");
    const openReviewIntent = ["1", "true"].includes(
      pickStr(params.get("openReview"), params.get("reviewOpen")).toLowerCase()
    );
    if (!openReviewIntent) return false;
    if (hasUserSubmittedReviewForRoom(thread, userId)) return false;
    if (!isRoomCompletedForReview(thread, userId)) return false;
    return canShowReviewForRoom(thread, userId);
  }

  global.TasuPlatformChatReviewFlow = {
    NOTIFY_SOURCE,
    REVIEW_RECEIVED_TITLE,
    REVIEW_RECEIVED_CTA,
    REVIEW_SUBMITTED_TOAST,
    REVIEW_PROMPT_DONE,
    hasUserSubmittedReview,
    getReviewTargetUserId,
    formatReviewerDisplayName,
    formatReviewReceivedBody,
    formatReviewSystemMessage,
    buildReviewOpenChatUrl,
    buildReviewViewChatUrl,
    applyReviewNotifyParamsToChatUrl,
    buildReviewReceivedHref,
    findReceivedReview,
    hasReceivedReviewToView,
    parseReviewerIdFromReviewNotifyId,
    appendReviewSystemMessage,
    notifyReviewReceived,
    handleReviewSubmitted,
    isPlatformReviewNotification,
    hasUserSubmittedReviewForRoom,
    isRoomCompletedForReview,
    canShowReviewForRoom,
    isInlineChatReviewEnabled,
    INLINE_CHAT_REVIEW_IN_THREAD,
    renderReviewOpenActionHtml,
    shouldAutoOpenReviewFromContext,
    stampReviewNotifyClickFromHref,
    readReviewNotifyClickWall,
    REVIEW_NOTIFY_CLICK_WALL_KEY,
  };
})(typeof window !== "undefined" ? window : globalThis);
