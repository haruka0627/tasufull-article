/**
 * チャット中心 — 完了申請 → 承認 → クローズ → レビュー
 */
(function (global) {
  "use strict";

  const PENDING_STATUS = "completion_pending";
  const AWAITING_PAYMENT_STATUS = "awaiting_payment";
  const COMPLETED_STATUS = "completed";

  const Category = () => global.TasuPlatformChatCategoryFlow;

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function isJobThread(thread) {
    return global.TasuPlatformChatJobFlow?.isJobThread?.(thread) === true;
  }

  function isConnectThread(thread) {
    return global.TasuPlatformChatConnectChatFlow?.isConnectThread?.(thread) === true;
  }

  function isPlatformThread(thread) {
    return Category()?.isPlatformCompletionThread?.(thread) === true;
  }

  function isBuilderThread(thread) {
    return Category()?.isBuilderThread?.(thread) === true;
  }

  function isInternalUserLabel(str) {
    const s = pickStr(str);
    if (!s) return true;
    if (/^u_[a-z0-9_]+$/i.test(s)) return true;
    if (/^chat-demo-/i.test(s)) return true;
    if (/^job[-_]?(app[-_])?demo/i.test(s)) return true;
    return false;
  }

  function sanitizeUserFacingLabel(str) {
    const s = pickStr(str);
    return isInternalUserLabel(s) ? "" : s;
  }

  function resolveListingCompanyName(thread) {
    const listingId = pickStr(thread?.listingId);
    if (!listingId) return "";
    try {
      const listing = global.TasuListingStore?.fetchListingById?.(listingId);
      return sanitizeUserFacingLabel(
        pickStr(listing?.company_name, listing?.form_data?.company, listing?.seller_name)
      );
    } catch {
      return "";
    }
  }

  function resolveActorDisplayName(userId, thread) {
    return Category()?.resolveActorDisplayName?.(userId, thread) || "利用者";
  }

  function formatActorParticle(name) {
    return Category()?.formatActorParticle?.(name) || "が";
  }

  function formatCompletionRequestMessage(thread, actorName, userId) {
    if (Category()?.formatCompletionRequestMessage) {
      return Category().formatCompletionRequestMessage(thread, actorName, userId);
    }
    const actor = sanitizeUserFacingLabel(actorName) || resolveActorDisplayName(userId, thread) || "利用者";
    return `${actor}${formatActorParticle(actor)}取引完了を申請しました`;
  }

  function formatNotifyRequestFrom(actorName, thread, requesterId) {
    const actor = sanitizeUserFacingLabel(actorName) || resolveActorDisplayName(requesterId, thread);
    if (!actor) return "相手から";
    if (formatActorParticle(actor) === "が") return `${actor}から`;
    return `${actor}さんから`;
  }

  function getLabels(thread) {
    if (isPlatformThread(thread)) {
      return Category().getLabels(thread);
    }
    return {
      completeBtn: "取引完了",
      completeDone: "取引完了済み",
      pendingBtn: "完了申請中",
      approveBtn: "取引完了を承認",
      cancelBtn: "キャンセル",
      modalTitle: "取引完了",
      cancelModalTitle: "取引を終了",
      cancelModalBody: "理由を選択してください。終了後はチャットが閲覧専用になります。",
      cancelSubmitLabel: "終了する",
      confirmBody: "取引完了を申請します。相手が承認すると取引が締めくくられます。",
      submitLabel: "申請する",
      requestSystem: (name, userId) => formatCompletionRequestMessage(thread, name, userId),
      doneSystem: "取引が完了しました",
      notifyRequestTitle: (name, userId) => formatCompletionRequestMessage(thread, name, userId),
      completedNotice: "取引が完了しました",
      completedPlaceholder: "このやりとりは完了しています。履歴としてご確認いただけます。",
      cancelledPlaceholder: "取引終了のため送信できません",
      reviewBtn: "レビューする",
      reviewTitle: "取引相手を評価",
      reviewSub: "相手への評価は任意です。スキップしても取引は完了したままです。",
    };
  }

  function getReviewTitleForUser(thread, userId) {
    if (isPlatformThread(thread)) {
      return Category().getReviewTitleForUser(thread, userId);
    }
    return getLabels(thread).reviewTitle;
  }

  function getReviewTargetLabel(thread, userId) {
    if (global.TasuPlatformChatDualWindowDemo?.isDemoThread?.(thread)) {
      const profile = global.TasuPlatformChatDualWindowDemo.resolveProfileForThread(thread);
      const me = pickStr(userId);
      const partnerName =
        profile && me === profile.partnerAId
          ? profile.partnerBName
          : profile && me === profile.partnerBId
            ? profile.partnerAName
            : "相手";
      return `評価対象：${pickStr(sanitizeUserFacingLabel(partnerName), partnerName, "相手")}`;
    }
    if (isPlatformThread(thread)) {
      return Category().getReviewTargetLabel(thread, userId);
    }
    const sellerName = pickStr(
      sanitizeUserFacingLabel(thread?.sellerName),
      sanitizeUserFacingLabel(thread?.partner?.displayName),
      "出品者"
    );
    return `評価対象：${sellerName}`;
  }

  function getCompletionStatus(thread) {
    const rs = pickStr(thread?.roomStatus, thread?.status).toLowerCase();
    if (rs === COMPLETED_STATUS) return COMPLETED_STATUS;
    if (rs === AWAITING_PAYMENT_STATUS) return AWAITING_PAYMENT_STATUS;
    if (rs === PENDING_STATUS) return PENDING_STATUS;
    if (thread?.completionRequestedBy && !thread?.completionApprovedBy) return PENDING_STATUS;
    return "active";
  }

  function requiresManualTransferAfterApproval(thread) {
    if (
      global.TasuPlatformChatWorkServiceConnectFlow?.isWorkServiceConnectThread?.(thread) === true
    ) {
      return false;
    }
    if (
      global.TasuPlatformChatConnectEntryFlow?.isConnectEntryThread?.(thread) === true ||
      thread?.connectEntryPayment === true
    ) {
      return false;
    }
    if (!thread || isConnectThread(thread) || isBuilderThread(thread) || isJobThread(thread)) {
      return false;
    }
    return isPlatformThread(thread);
  }

  function getBuyerId(thread) {
    return Category()?.getBuyerId?.(thread) || pickStr(thread?.buyerId, thread?.buyer_id);
  }

  function getSellerId(thread) {
    return Category()?.getSellerId?.(thread) || pickStr(thread?.sellerId, thread?.seller_id);
  }

  function buildChatUrl(threadId, thread, options) {
    if (isJobThread(thread) && global.TasuPlatformChatJobFlow?.buildJobChatUrl) {
      return global.TasuPlatformChatJobFlow.buildJobChatUrl(threadId, options);
    }
    const u = new URL("chat-detail.html", global.location?.href || "http://localhost/");
    u.searchParams.set("thread", pickStr(threadId));
    u.searchParams.set("talkDev", "1");
    if (options?.userId) u.searchParams.set("userId", pickStr(options.userId));
    if (options?.from) u.searchParams.set("from", pickStr(options.from));
    return `${u.pathname}${u.search}`;
  }

  function buildReviewUrl(threadId, thread, options) {
    if (isJobThread(thread) && global.TasuPlatformChatJobFlow?.buildJobReviewUrl) {
      return global.TasuPlatformChatJobFlow.buildJobReviewUrl(threadId, options);
    }
    const Review = global.TasuPlatformChatReviewFlow;
    if (Review?.buildReviewOpenChatUrl) {
      return Review.buildReviewOpenChatUrl(thread, options?.userId, {
        threadId: pickStr(threadId),
        from: pickStr(options?.from, "notify"),
        state: "completed",
        openReview: "1",
      });
    }
    const u = new URL("chat-detail.html", global.location?.href || "http://localhost/");
    u.searchParams.set("thread", pickStr(threadId));
    u.searchParams.set("talkDev", "1");
    if (options?.userId) u.searchParams.set("userId", pickStr(options.userId));
    u.searchParams.set("from", pickStr(options?.from, "notify"));
    u.searchParams.set("openReview", "1");
    u.searchParams.set("demoState", "completed");
    return `${u.pathname}${u.search}`;
  }

  function readThread(threadId) {
    const id = pickStr(threadId);
    return (global.TasuChatThreadStore?.readAll?.() || []).find((t) => String(t.id) === id) || null;
  }

  function patchThread(threadId, patch) {
    const store = global.TasuChatThreadStore;
    if (!store?.readAll || !store?.writeAll) return null;
    const list = store.readAll();
    const idx = list.findIndex((t) => String(t.id) === String(threadId));
    if (idx < 0) return null;
    const next = { ...list[idx], ...patch, updatedAt: new Date().toISOString() };
    list[idx] = next;
    store.writeAll(list);
    global.dispatchEvent(new CustomEvent("tasful-chat-threads-changed"));
    return next;
  }

  function appendSystemMessage(threadId, text) {
    const id = pickStr(threadId);
    const store = global.TasuChatThreadStore;
    if (!id || !store?.MESSAGES_KEY) return { ok: false };

    const body = pickStr(text);
    const msg = {
      id: `msg-${id}-sys-${Date.now()}`,
      chatId: id,
      roomId: id,
      senderId: "__system__",
      senderName: "TASFUL",
      text: body,
      createdAt: new Date().toISOString(),
      kind: "system",
    };

    try {
      const raw = global.localStorage.getItem(store.MESSAGES_KEY);
      const map = raw ? JSON.parse(raw) : {};
      const list = Array.isArray(map[id]) ? [...map[id]] : [];
      list.push(msg);
      if (typeof store.writeMessagesMap === "function") {
        store.writeMessagesMap({ [id]: list });
      } else {
        map[id] = list;
        global.localStorage.setItem(store.MESSAGES_KEY, JSON.stringify(map));
      }
      return { ok: true, message: msg };
    } catch (err) {
      return { ok: false, reason: String(err?.message || err) };
    }
  }

  function canRequestCompletion(thread, userId) {
    if (!thread || isBuilderThread(thread)) return false;
    if (Category()?.canRequestCompletion) {
      return Category().canRequestCompletion(thread, userId);
    }
    return false;
  }

  function canApproveCompletion(thread, userId) {
    if (!thread || isBuilderThread(thread)) return false;
    if (!isPlatformThread(thread)) return false;
    if (getCompletionStatus(thread) !== PENDING_STATUS) return false;
    const me = pickStr(userId);
    const requester = pickStr(thread.completionRequestedBy);
    if (!me || !requester || me === requester) return false;
    return me === getSellerId(thread) || me === getBuyerId(thread);
  }

  function resolveNotifyRecipientId(thread, requesterId) {
    const Demo = global.TasuPlatformChatDualWindowDemo;
    const partners = Demo?.resolveBenchPartnerIds?.(null, thread) || {};
    const sellerId = pickStr(partners.sellerId, getSellerId(thread));
    const buyerId = pickStr(partners.buyerId, getBuyerId(thread));
    const requester = pickStr(requesterId);
    if (requester === sellerId) return buyerId;
    if (requester === buyerId) return sellerId;
    return buyerId || sellerId;
  }

  function notifyCompletionRequested({ thread, threadId, requesterId, requesterName }) {
    const labels = getLabels(thread);
    const actorName = resolveActorDisplayName(requesterId, thread);
    const title = labels.notifyRequestTitle(actorName, requesterId);
    const chatUrl = buildChatUrl(threadId, thread, {
      userId: resolveNotifyRecipientId(thread, requesterId),
      from: "talk",
      review: global.TasuPlatformChatDualWindowDemo?.isDemoThread?.(thread) ? "chat-demo" : undefined,
    });

    if (global.TasuPlatformChatDualWindowDemo?.isDemoThread?.(thread) === true) {
      if (isJobThread(thread)) {
        return global.TasuTalkPlatformNotify?.notifyJobCompletionRequested?.({
          title,
          thread,
          threadId,
          listing: { id: thread.listingId, title: thread.listingTitle, listing_type: "job" },
          href: chatUrl,
          requesterName: actorName,
          requesterId,
        });
      }
      return global.TasuPlatformChatDualWindowNotify?.notifyDemoCompletionRequested?.({
        thread,
        threadId,
        requesterId,
        requesterName: actorName,
        title,
      });
    }

    if (isJobThread(thread)) {
      return global.TasuTalkPlatformNotify?.notifyJobCompletionRequested?.({
        title,
        thread,
        threadId,
        listing: { id: thread.listingId, title: thread.listingTitle, listing_type: "job" },
        href: chatUrl,
        requesterName: actorName,
        requesterId,
      });
    }

    return global.TasuTalkPlatformNotify?.notifyDealCompletionRequested?.({
      title,
      thread,
      threadId,
      listing: {
        id: thread.listingId,
        title: thread.listingTitle,
        listing_type: thread.listingType,
      },
      href: chatUrl,
      requesterName: actorName,
      requesterId,
    });
  }

  function notifyCompletionApprovedToRequester({ thread, threadId, approverId, requesterId }) {
    const id = pickStr(threadId, thread?.id);
    const room = thread || readThread(id);
    if (!id || !room) return { ok: false, skipped: true, reason: "invalid_input" };

    const approver = pickStr(approverId);
    const requester = pickStr(requesterId, room?.completionRequestedBy, room?.endRequestedBy);
    if (!approver || !requester || approver === requester) {
      return { ok: false, skipped: true, reason: "same_user" };
    }

    if (isJobThread(room)) {
      try {
        return (
          global.TasuTalkPlatformNotify?.notifyJobCompletionApprovedToRequester?.({
            thread: room,
            threadId: id,
            roomId: id,
            approverId: approver,
            requesterId: requester,
            closedByUserId: approver,
          }) || { ok: false, skipped: true }
        );
      } catch (err) {
        console.warn("[TasuPlatformChatCompletionFlow] job approval notify failed:", err);
        return { ok: false, reason: String(err?.message || err) };
      }
    }

    if (global.TasuPlatformChatDualWindowDemo?.isDemoThread?.(room) === true) {
      try {
        return (
          global.TasuPlatformChatDualWindowNotify?.notifyCompletionApprovedToRequester?.({
            thread: room,
            threadId: id,
            approverId: approver,
            requesterId: requester,
          }) || { ok: false, skipped: true }
        );
      } catch (err) {
        console.warn("[TasuPlatformChatCompletionFlow] demo approval notify failed:", err);
        return { ok: false, reason: String(err?.message || err) };
      }
    }

    return { ok: false, skipped: true, reason: "unsupported_thread" };
  }

  function finalizeCompletion({ thread, threadId, approverId }) {
    const labels = getLabels(thread);
    const WorkSvc = global.TasuPlatformChatWorkServiceConnectFlow;
    const isWorkSvc = WorkSvc?.isWorkServiceConnectThread?.(thread) === true;
    const isMktConnect = Category()?.isMarketplaceConnectEntryThread?.(thread) === true;
    const connect = isConnectThread(thread);
    const doneText = isMktConnect
      ? pickStr(labels.receiveSystem, labels.doneSystem, "取引が完了しました")
      : isWorkSvc
        ? pickStr(labels.doneSystem, labels.completedNotice, "取引が完了しました")
        : connect
          ? labels.reviewPromptTitle || `✓ ${labels.completedNotice}`
          : labels.doneSystem;
    appendSystemMessage(threadId, doneText);

    const listing = {
      id: thread.listingId,
      listing_type: thread.listingType || thread.listing_type,
      title: thread.listingTitle,
    };

    if (isWorkSvc) {
      if (global.TasuPlatformChatDualWindowDemo?.isDemoThread?.(thread) === true) {
        try {
          global.TasuPlatformChatDualWindowNotify?.notifyDemoCompletionApproved?.({
            thread,
            threadId,
            approverId: pickStr(approverId),
            requesterId: pickStr(thread.completionRequestedBy),
          });
        } catch (err) {
          console.warn("[TasuPlatformChatCompletionFlow] work service review notify failed:", err);
        }
      }
      return { ok: true, workServiceConnect: true };
    }

    if (connect) {
      try {
        global.TasuPlatformChatConnectChatFlow?.appendConnectPaymentRequiredCard?.(threadId, thread);
      } catch (err) {
        console.warn("[TasuPlatformChatCompletionFlow] connect pay card failed:", err);
      }
      return { ok: true, connect: true };
    }

    if (isJobThread(thread)) {
      try {
        const JobFlow = global.TasuPlatformChatJobFlow;
        global.TasuPlatformChatJobFlow?.handleJobConversationCompleted?.({
          thread,
          roomId: threadId,
          threadId,
          listing,
          closedByUserId: pickStr(approverId, thread?.closedByUserId),
          posterUserId: JobFlow?.resolveJobPosterUserId?.(thread),
          applicantUserId: JobFlow?.resolveJobApplicantUserId?.(thread),
        });
      } catch (err) {
        console.warn("[TasuPlatformChatCompletionFlow] job notify failed:", err);
      }
      return { ok: true, job: true };
    }

    if (isPlatformThread(thread) && !isWorkSvc) {
      Category()?.appendPlatformCompletionCard?.(threadId, thread);
    }

    if (global.TasuPlatformChatDualWindowDemo?.isDemoThread?.(thread) === true) {
      try {
        global.TasuPlatformChatDualWindowNotify?.notifyDemoCompletionApproved?.({
          thread,
          threadId,
          approverId: pickStr(approverId),
          requesterId: pickStr(thread.completionRequestedBy),
        });
      } catch (err) {
        console.warn("[TasuPlatformChatCompletionFlow] demo approval notify failed:", err);
      }
    }

    if (global.TasuPlatformChatFee?.shouldNotifyOnCompletion?.(listing)) {
      try {
        global.TasuTalkPlatformFeeNotify?.notifyDealCompletedConnect?.({
          listing,
          thread,
          room: thread,
        });
      } catch (err) {
        console.warn("[TasuPlatformChatCompletionFlow] connect notify failed:", err);
      }
    }

    return { ok: true };
  }

  function markProductShipped({ threadId, thread, userId, carrier, tracking }) {
    const id = pickStr(threadId, thread?.id);
    const room = thread || readThread(id);
    if (!room) return { ok: false, reason: "チャットが見つかりません" };
    const Purchase = global.TasuPlatformChatPurchasePaymentFlow;
    const isMktConnect = Category()?.isMarketplaceConnectEntryThread?.(room) === true;
    const canShip = Purchase?.appliesToThread?.(room)
      ? Purchase.canMarkProductShipped?.(room, userId) === true
      : Category()?.canMarkProductShipped?.(room, userId) === true;
    if (!canShip) {
      return { ok: false, reason: "発送完了にできません" };
    }

    const labels = getLabels(room);
    const now = new Date().toISOString();
    const shippingInfo =
      Purchase?.resolveShippingInfoForShip?.(room, { carrier, tracking }) ||
      Purchase?.resolveDemoShippingInfo?.(room) ||
      { carrier: pickStr(carrier, "ヤマト運輸"), tracking: pickStr(tracking) };
    if (!isMktConnect && Purchase?.requiresShipInputForm?.(room) === true && !pickStr(shippingInfo.carrier)) {
      return { ok: false, reason: "配送会社を入力してください" };
    }

    if (isMktConnect) {
      const sellerId = pickStr(userId);
      const updated = patchThread(id, {
        productShipped: true,
        productShippedAt: now,
        roomStatus: PENDING_STATUS,
        completionRequestedBy: sellerId,
        completionRequestedAt: now,
        completionDeliverySummary: pickStr(room.listingTitle, labels.pendingContentLabel),
      });
      const updatedRoom = updated || room;
      appendSystemMessage(id, labels.shipSystem || labels.sellerCompleteBtn || "完了を通知しました");
      try {
        Category()?.appendMarketplaceConnectConfirmCard?.(id, updatedRoom);
      } catch (err) {
        console.warn("[TasuPlatformChatCompletionFlow] marketplace connect confirm card failed:", err);
      }
      notifyCompletionRequested({
        thread: updatedRoom,
        threadId: id,
        requesterId: sellerId,
        requesterName: resolveActorDisplayName(sellerId, updatedRoom),
      });
      return { ok: true, thread: updatedRoom, pending: true };
    }

    const updated = patchThread(id, {
      productShipped: true,
      productShippedAt: now,
      shippingCarrier: pickStr(shippingInfo.carrier, "ヤマト運輸"),
      trackingNumber: pickStr(shippingInfo.tracking),
    });
    appendSystemMessage(id, labels.shipSystem || "商品を発送しました");
    const updatedRoom = updated || room;
    try {
      Purchase?.appendProductShippingInfoCard?.(id, updatedRoom);
    } catch (err) {
      console.warn("[TasuPlatformChatCompletionFlow] product shipping card failed:", err);
    }
    try {
      global.TasuPlatformChatDualWindowNotify?.notifyDemoProductShipped?.({
        thread: updatedRoom,
        threadId: id,
        sellerId: pickStr(userId),
      });
    } catch (err) {
      console.warn("[TasuPlatformChatCompletionFlow] demo product shipped notify failed:", err);
    }
    return { ok: true, thread: updatedRoom };
  }

  function requestCompletion(detail) {
    const opts = detail || {};
    const id = pickStr(opts.threadId, opts.thread?.id);
    const room = opts.thread || readThread(id);
    const userId = opts.userId;
    if (!room) return Promise.resolve({ ok: false, reason: "チャットが見つかりません" });
    if (!canRequestCompletion(room, userId)) {
      return Promise.resolve({ ok: false, reason: "完了申請できません" });
    }

    const name = resolveActorDisplayName(userId, room);
    const labels = getLabels(room);
    const now = new Date().toISOString();
    const dealId = pickStr(room.dealId);
    const CompletionReport = global.TasuPlatformChatCompletion;
    const usesDealReport =
      dealId &&
      CompletionReport?.usesCompletionReportDealFlow?.(dealId) === true &&
      global.TasuPlatformChatConnectEntryFlow?.isConnectEntryThread?.(room) !== true &&
      room?.connectEntryPayment !== true;

    if (usesDealReport) {
      CompletionReport?.appendCompletionReportMessage?.(dealId, {
        threadId: id,
        reporterId: pickStr(userId),
        reporterName: name,
        submittedContent: pickStr(opts.submittedContent, opts.content),
        attachments: pickStr(opts.attachments),
        confirmMemo: pickStr(opts.confirmMemo),
      });
    }

    const updated = patchThread(id, {
      roomStatus: PENDING_STATUS,
      completionRequestedBy: pickStr(userId),
      completionRequestedAt: now,
      completionDeliverySummary: pickStr(opts.submittedContent, opts.content, room.listingTitle),
    });
    const updatedRoom = updated || room;
    notifyCompletionRequested({ thread: updatedRoom, threadId: id, requesterId: userId, requesterName: name });
    appendSystemMessage(id, labels.requestSystem(name, userId));

    const Connect = global.TasuPlatformChatConnectChatFlow;
    const marketplaceConnectEntry =
      global.TasuPlatformChatConnectEntryFlow?.isConnectEntryThread?.(updatedRoom) === true;
    if (
      Connect?.shouldUseConnectCompletionUi?.(updatedRoom) === true &&
      !usesDealReport &&
      !marketplaceConnectEntry
    ) {
      Connect.appendConnectRequestFollowUpMessages?.(id);
      Connect.appendPendingApprovalCard?.(id, updatedRoom);
    }

    return { ok: true, thread: updatedRoom, pending: true };
  }

  function approveCompletion({ threadId, thread, userId }) {
    const id = pickStr(threadId, thread?.id);
    const room = thread || readThread(id);
    if (!room) return { ok: false, reason: "チャットが見つかりません" };
    if (!canApproveCompletion(room, userId)) {
      return { ok: false, reason: "承認できません" };
    }

    const now = new Date().toISOString();
    const approverId = pickStr(userId);

    const WorkSvc = global.TasuPlatformChatWorkServiceConnectFlow;
    const isConnectEntry =
      global.TasuPlatformChatCategoryFlow?.isMarketplaceConnectEntryThread?.(room) === true;
    if (!isConnectEntry && WorkSvc?.isWorkServiceConnectThread?.(room) === true) {
      const updated = patchThread(id, {
        roomStatus: AWAITING_PAYMENT_STATUS,
        completionApprovedBy: approverId,
        completionApprovedAt: now,
      });
      const updatedRoom = updated || room;

      try {
        global.TasuPlatformChatConnectChatFlow?.removePendingApprovalCard?.(id);
      } catch {
        /* ignore */
      }

      try {
        WorkSvc.ensureStripePaymentCardAfterApproval?.(id, updatedRoom);
      } catch (err) {
        console.warn("[TasuPlatformChatCompletionFlow] work service stripe card failed:", err);
      }

      const labels = getLabels(updatedRoom);
      appendSystemMessage(
        id,
        pickStr(
          labels.approvedAwaitingConnectPaymentSystem,
          "作業完了を承認しました。依頼者のStripe Connect決済をお待ちください。"
        )
      );

      return { ok: true, thread: updatedRoom, awaitingPayment: true };
    }

    if (requiresManualTransferAfterApproval(room)) {
      const updated = patchThread(id, {
        roomStatus: AWAITING_PAYMENT_STATUS,
        completionApprovedBy: approverId,
        completionApprovedAt: now,
      });
      const updatedRoom = updated || room;

      try {
        global.TasuPlatformChatConnectChatFlow?.removePendingApprovalCard?.(id);
      } catch {
        /* ignore */
      }

      try {
        global.TasuPlatformChatManualTransferFlow?.ensureBuyerPaymentCardMessage?.(id, updatedRoom);
      } catch (err) {
        console.warn("[TasuPlatformChatCompletionFlow] buyer payment card failed:", err);
      }

      const labels = getLabels(updatedRoom);
      appendSystemMessage(
        id,
        pickStr(labels.approvedAwaitingPaymentSystem, "承認しました。お支払い先をご確認ください。")
      );

      notifyCompletionApprovedToRequester({
        thread: updatedRoom,
        threadId: id,
        approverId,
        requesterId: pickStr(updatedRoom.completionRequestedBy, room.completionRequestedBy),
      });

      return { ok: true, thread: updatedRoom, awaitingPayment: true };
    }

    try {
      global.TasuPlatformChatConnectChatFlow?.removePendingApprovalCard?.(id);
    } catch {
      /* ignore */
    }
    if (isConnectEntry) {
      try {
        Category()?.removeMarketplaceConnectConfirmCard?.(id);
      } catch {
        /* ignore */
      }
    }

    const updated = patchThread(id, {
      roomStatus: COMPLETED_STATUS,
      status: COMPLETED_STATUS,
      completedAt: now,
      completionApprovedBy: approverId,
      ...(isConnectEntry ? { productReceived: true, productReceivedAt: now } : {}),
    });

    notifyCompletionApprovedToRequester({
      thread: updated || room,
      threadId: id,
      approverId,
      requesterId: pickStr(room.completionRequestedBy, updated?.completionRequestedBy),
    });

    finalizeCompletion({ thread: updated || room, threadId: id, approverId });

    return {
      ok: true,
      thread: {
        ...(updated || room),
        roomStatus: COMPLETED_STATUS,
        status: COMPLETED_STATUS,
      },
    };
  }

  function completeAfterManualDeposit({ threadId, thread, userId }) {
    const id = pickStr(threadId, thread?.id);
    const room = thread || readThread(id);
    if (!room) return { ok: false, reason: "チャットが見つかりません" };
    if (getCompletionStatus(room) !== AWAITING_PAYMENT_STATUS) {
      return { ok: false, reason: "入金確認の対象ではありません" };
    }

    const Manual = global.TasuPlatformChatManualTransferFlow;
    if (Manual?.getThreadState?.(id)?.status !== "paid") {
      return { ok: false, reason: "支払い報告前です" };
    }

    const now = new Date().toISOString();
    const updated = patchThread(id, {
      roomStatus: COMPLETED_STATUS,
      status: COMPLETED_STATUS,
      completedAt: now,
      completedBy: pickStr(userId),
      manualDepositConfirmedBy: pickStr(userId),
      manualDepositConfirmedAt: now,
    });

    if (Manual?.setThreadState) {
      Manual.setThreadState(id, { status: "confirmed", confirmedAt: now });
    }

    finalizeCompletion({ thread: updated || room, threadId: id, approverId: userId });

    return {
      ok: true,
      thread: {
        ...(updated || room),
        roomStatus: COMPLETED_STATUS,
        status: COMPLETED_STATUS,
      },
    };
  }

  global.TasuPlatformChatCompletionFlow = {
    PENDING_STATUS,
    AWAITING_PAYMENT_STATUS,
    COMPLETED_STATUS,
    isJobThread,
    isConnectThread,
    isPlatformThread,
    isBuilderThread,
    isInternalUserLabel,
    sanitizeUserFacingLabel,
    resolveActorDisplayName,
    resolveListingCompanyName,
    formatCompletionRequestMessage,
    formatNotifyRequestFrom,
    getLabels,
    getReviewTitleForUser,
    getReviewTargetLabel,
    getCompletionStatus,
    canRequestCompletion,
    markProductShipped,
    getPrimaryActionMode: (thread, userId) =>
      Category()?.getPrimaryActionMode?.(thread, userId) || "",
    getPrimaryActionLabel: (thread, userId) =>
      Category()?.getPrimaryActionLabel?.(thread, userId) || "",
    canShowPrimaryAction: (thread, userId) =>
      Category()?.canShowPrimaryAction?.(thread, userId) === true,
    canApproveCompletion,
    requestCompletion,
    approveCompletion,
    notifyCompletionApprovedToRequester,
    completeAfterManualDeposit,
    requiresManualTransferAfterApproval,
    buildChatUrl,
    buildReviewUrl,
    appendSystemMessage,
    readThread,
    patchThread,
    finalizeCompletion,
  };
})(typeof window !== "undefined" ? window : globalThis);
