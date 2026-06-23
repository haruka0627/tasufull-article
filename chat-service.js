/**
 * 取引用チャット — データ層
 * - Supabase 優先（transaction_rooms / transaction_messages / transaction_reads）
 * - 接続失敗時はダミーデータ + localStorage にフォールバック
 * - moderateMessage(): AI審査差し込み口
 */
(function () {
  "use strict";

  const STORAGE_KEY = "tasu_chat_seed_v1";
  let supabaseReady = false;
  let initPromise = null;

  function nowIso() {
    return new Date().toISOString();
  }

  function safeJsonParse(text, fallback) {
    try {
      return JSON.parse(text);
    } catch {
      return fallback;
    }
  }

  function isConsultThreadId(roomId) {
    const id = normalizeRoomId(roomId);
    if (!id) return false;
    try {
      if (window.TasuChatThreadStore?.readAll) {
        return window.TasuChatThreadStore.readAll().some((t) => String(t.id) === id);
      }
    } catch {
      /* ignore */
    }
    return /^chat-/i.test(id);
  }

  function isThreadStoreRoomId(roomId) {
    const id = normalizeRoomId(roomId);
    if (!id || !window.TasuChatThreadStore?.loadRoom) return false;
    return Boolean(window.TasuChatThreadStore.loadRoom(id)?.thread);
  }

  function isLocalRoomId(roomId) {
    if (isConsultThreadId(roomId)) return true;
    if (isThreadStoreRoomId(roomId)) return true;
    if (window.TasuPlatformChatDualWindowDemo?.isDemoThread?.(roomId)) return true;
    if (window.TasuChatSupabase?.isLocalRoomId) {
      return window.TasuChatSupabase.isLocalRoomId(roomId);
    }
    return /^local-room-/i.test(normalizeRoomId(roomId));
  }

  function emitDemoMessageNotify(roomId, messageInput) {
    try {
      window.TasuPlatformChatDualWindowNotify?.onDemoMessageSent?.({
        threadId: roomId,
        senderId: messageInput.senderId || getConfigMeId(),
        text: messageInput.text || "",
      });
    } catch (err) {
      console.warn("[TasuChat] demo message notify failed:", err);
    }
  }

  function loadConsultRoomMessages(roomId) {
    if (!window.TasuChatThreadStore?.loadRoom) return null;
    const id = normalizeRoomId(roomId);
    const data = window.TasuChatThreadStore.loadRoom(id);
    if (!data?.thread) return null;
    return {
      thread: enrichThreadLifecycle(data.thread),
      messages: Array.isArray(data.messages) ? data.messages : [],
    };
  }

  function getSeed() {
    window.TasuChatSupabase?.mergeLegacyLocalChatSeed?.();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return safeJsonParse(raw, null);
    }

    const dummy = window.TasuChatDummy;
    const seed = {
      threads: dummy?.threads ?? [],
      messagesByChatId: dummy?.messagesByChatId ?? {},
      lastSeenByChatId: {},
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return seed;
  }

  function setSeed(seed) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  }

  function normalizeRoomId(roomId) {
    const raw = String(roomId || "").trim();
    if (!raw) return "";
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function readLocationRoomParams() {
    const params = new URLSearchParams(location.search);
    return {
      thread: normalizeRoomId(params.get("thread")),
      roomId: normalizeRoomId(params.get("roomId") || params.get("room") || params.get("chatId")),
      listingId: pickStr(params.get("listingId")),
      applicationId: pickStr(params.get("applicationId")),
      dealId: pickStr(params.get("deal")),
      userId: pickStr(params.get("userId")),
      role: pickStr(params.get("benchRole"), params.get("role")),
      demoProfile: pickStr(params.get("demoProfile")),
      benchEmbed: pickStr(params.get("benchEmbed")),
      liveFlow: pickStr(params.get("liveFlow")),
      review: pickStr(params.get("review")),
      from: pickStr(params.get("from")),
      openReview: pickStr(params.get("openReview"), params.get("reviewOpen")),
      demoState: pickStr(params.get("demoState")),
    };
  }

  /**
   * URL 上の thread / roomId / listingId+applicationId から実在する room を解決する。
   * roomId と thread が両方ある場合、thread store に存在する方を優先する。
   */
  function resolveRoomIdFromLocation() {
    const query = readLocationRoomParams();
    const store = window.TasuChatThreadStore;
    const access = store?.resolveThreadAccess?.({
      queryThread: query.thread,
      queryRoomId: query.roomId,
      listingId: query.listingId,
      applicationId: query.applicationId,
      queryUserId: query.userId,
    });
    if (access?.ok && access.threadId) {
      return {
        ok: true,
        roomId: access.threadId,
        lookupKey: pickStr(access.lookupKey),
        query,
        threadExists: access.threadExists === true,
        roomExists: access.roomExists === true,
        recoveredFrom: pickStr(access.recoveredFrom),
        reason: "",
      };
    }

    const hintedId = pickStr(query.thread, query.roomId);
    if (hintedId) {
      const jobAccess = window.TasuPlatformChatJobFlow?.ensureJobThreadForAccess?.(hintedId);
      const recoveredId = pickStr(jobAccess?.correctThreadId, jobAccess?.thread?.id);
      if (recoveredId && isThreadStoreRoomId(recoveredId)) {
        return {
          ok: true,
          roomId: recoveredId,
          lookupKey: pickStr(jobAccess?.recovered ? "ensureJobThreadForAccess" : "thread"),
          query,
          threadExists: true,
          roomExists: true,
          recoveredFrom: hintedId,
          reason: "",
        };
      }
    }

    const threadOk = Boolean(query.thread && isThreadStoreRoomId(query.thread));
    const roomOk = Boolean(query.roomId && isThreadStoreRoomId(query.roomId));
    let roomId = "";
    let lookupKey = "";
    if (threadOk) {
      roomId = query.thread;
      lookupKey = "thread";
    } else if (roomOk) {
      roomId = query.roomId;
      lookupKey = "roomId";
    }

    if (roomId) {
      return {
        ok: true,
        roomId,
        lookupKey,
        query,
        threadExists: true,
        roomExists: true,
        reason: "",
      };
    }

    return {
      ok: false,
      roomId: hintedId,
      lookupKey: query.thread ? "thread" : query.roomId ? "roomId" : "",
      query,
      threadExists: false,
      roomExists: false,
      reason: pickStr(access?.reason, hintedId ? "thread_not_found" : "missing_id"),
    };
  }

  function getRoomIdFromLocation() {
    return pickStr(resolveRoomIdFromLocation().roomId);
  }

  /** @deprecated roomId に統一。chatId は互換のみ */
  function getChatIdFromLocation() {
    return getRoomIdFromLocation();
  }

  function isLikelySupabaseRoomId(roomId) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      normalizeRoomId(roomId)
    );
  }

  function syncRoomIdInUrl(roomId) {
    const id = normalizeRoomId(roomId);
    if (!id) return;
    const params = new URLSearchParams(location.search);
    const userId = params.get("userId") || window.TasuChatUserIdentity?.getUserIdFromUrl?.() || "";
    const useThreadParam = isConsultThreadId(id) || isThreadStoreRoomId(id) || /^chat-/i.test(id);
    params.delete("chatId");
    params.delete("room");
    if (useThreadParam) {
      params.delete("roomId");
      if (params.get("thread") === id && (!userId || params.get("userId") === userId)) {
        const next = `${location.pathname}?${params.toString()}${location.hash}`;
        history.replaceState(null, "", next);
        return;
      }
      params.set("thread", id);
    } else {
      params.delete("thread");
      if (params.get("roomId") === id && !params.has("chatId") && (!userId || params.get("userId") === userId)) {
        return;
      }
      params.set("roomId", id);
    }
    if (userId) params.set("userId", userId);
    const next = `${location.pathname}?${params.toString()}${location.hash}`;
    history.replaceState(null, "", next);
  }

  function chatDetailUrl(roomId) {
    const id = normalizeRoomId(roomId);
    if (!id) return "chat-detail.html";
    if (window.TasuChatThreadStore?.chatDetailUrl) {
      return window.TasuChatThreadStore.chatDetailUrl(id);
    }
    if (isConsultThreadId(id)) {
      return `chat-detail.html?thread=${encodeURIComponent(id)}`;
    }
    return `chat-detail.html?roomId=${encodeURIComponent(id)}`;
  }

  function formatRemaining(expiresAtIso) {
    if (expiresAtIso == null || expiresAtIso === "") {
      return "";
    }
    const expiresAt = new Date(expiresAtIso).getTime();
    if (!Number.isFinite(expiresAt)) {
      return "";
    }
    const ms = expiresAt - Date.now();
    if (ms <= 0) {
      return "期限切れ";
    }
    const totalMin = Math.ceil(ms / 60000);
    const hours = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      const remH = hours % 24;
      return `残り ${days}日${remH}時間`;
    }
    return `残り ${hours}時間${mins}分`;
  }

  /** expires_at < now()（chat-room-status.js と同期） */
  function isExpired(thread) {
    if (window.TasuChatRoomStatus?.isRoomExpired) {
      return window.TasuChatRoomStatus.isRoomExpired(thread);
    }
    const expiresAt = thread?.expiresAt || thread?.expires_at;
    const ms = new Date(expiresAt).getTime();
    if (!Number.isFinite(ms)) return false;
    return ms < Date.now();
  }

  function isRoomExpired(room) {
    return isExpired(room);
  }

  /**
   * @param {string} roomId
   * @param {object|null} [cachedRoom]
   * @returns {Promise<{ expired: boolean, room: object|null, expiresAt: string }>}
   */
  async function checkRoomExpired(roomId, cachedRoom) {
    const id = normalizeRoomId(roomId);
    const fallbackExpires =
      window.TasuChatRoomStatus?.getExpiresAt?.(cachedRoom) ||
      cachedRoom?.expiresAt ||
      cachedRoom?.expires_at ||
      "";

    try {
      if (!id) {
        return { expired: false, room: cachedRoom || null, expiresAt: fallbackExpires };
      }

      await ensureInitialized();

      if (cachedRoom) {
        const expiresAt = window.TasuChatRoomStatus?.getExpiresAt?.(cachedRoom) || fallbackExpires;
        return {
          expired: isRoomExpired(cachedRoom),
          room: cachedRoom,
          expiresAt,
        };
      }

      if (isLocalRoomId(id)) {
        const { thread } = loadMessagesDummy(id);
        if (thread) {
          const expiresAt = window.TasuChatRoomStatus?.getExpiresAt?.(thread) || "";
          return { expired: isRoomExpired(thread), room: thread, expiresAt };
        }
      } else if (supabaseReady && window.TasuChatSupabase?.fetchRoomById) {
        try {
          const row = await window.TasuChatSupabase.fetchRoomById(id);
          if (row) {
            const thread = window.TasuChatSupabase.mapRoomRowToThread(row);
            const expiresAt = window.TasuChatRoomStatus?.getExpiresAt?.(thread) || "";
            return { expired: isRoomExpired(thread), room: thread, expiresAt };
          }
          console.warn("[TasuChat] checkRoomExpired: transaction_rooms not found", { roomId: id });
        } catch (err) {
          console.warn("[TasuChat] checkRoomExpired: fetch room failed", { roomId: id, err });
        }
      }
    } catch (err) {
      console.warn("[TasuChat] checkRoomExpired failed (treat as active):", err);
    }

    return {
      expired: cachedRoom ? isRoomExpired(cachedRoom) : false,
      room: cachedRoom || null,
      expiresAt: fallbackExpires,
    };
  }

  /** メッセージが取れている = ルームは存在するとみなす（表示済みルーム用） */
  function createRoomContextFromMessages(roomId, messages, partialThread) {
    const id = normalizeRoomId(roomId);
    const expiresAt =
      partialThread?.expiresAt ||
      partialThread?.expires_at ||
      new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    return {
      id,
      listing: partialThread?.listing || {
        id: "",
        type: "",
        title: partialThread?.listing?.title || id,
      },
      partner: partialThread?.partner || {
        id: "partner",
        displayName: "（相手）",
        avatarUrl: "https://placehold.co/64x64/f3ead4/967622?text=P",
      },
      me:
        partialThread?.me ||
        window.TASU_CHAT_SUPABASE_CONFIG?.me || {
          id: getConfigMeId(),
          displayName: "あなた",
          avatarUrl: "https://placehold.co/64x64/f3ead4/967622?text=ME",
        },
      expiresAt,
      lastReadAt: partialThread?.lastReadAt || "",
      unreadCount: partialThread?.unreadCount ?? 0,
      lastMessagePreview: partialThread?.lastMessagePreview || "",
      roomStatus:
        partialThread?.roomStatus ||
        (partialThread?.status === "completed" || partialThread?.status === "cancelled"
          ? partialThread.status
          : "active"),
      status:
        window.TasuChatRoomStatus?.resolveRoomLifecycleStatus?.({
          roomStatus: partialThread?.roomStatus,
          status: partialThread?.status,
          expiresAt,
        }) || "active",
      buyerId: partialThread?.buyerId || partialThread?.buyer_id || "",
      sellerId: partialThread?.sellerId || partialThread?.seller_id || "",
      remainingLabel: formatRemaining(expiresAt),
      paymentMethod: partialThread?.paymentMethod || partialThread?.payment_method || "",
      productShipped: partialThread?.productShipped || partialThread?.product_shipped,
      productShippedAt: partialThread?.productShippedAt || partialThread?.product_shipped_at || "",
      shippingCarrier: partialThread?.shippingCarrier || partialThread?.shipping_carrier || "",
      trackingNumber: partialThread?.trackingNumber || partialThread?.tracking_number || "",
      productReceived: partialThread?.productReceived || partialThread?.product_received,
      productReceivedAt: partialThread?.productReceivedAt || partialThread?.product_received_at || "",
      shippingReady: partialThread?.shippingReady || partialThread?.shipping_ready,
      bankTransferReported:
        partialThread?.bankTransferReported || partialThread?.bank_transfer_reported,
      paymentConfirmed: partialThread?.paymentConfirmed || partialThread?.payment_confirmed,
      listingType: partialThread?.listingType || partialThread?.listing_type || "",
      platformContactKind: partialThread?.platformContactKind || "",
      listingId: partialThread?.listingId || partialThread?.listing_id || "",
      listingTitle: partialThread?.listingTitle || "",
      source: partialThread?.source || "",
    };
  }

  function isCurrentUserBuyer(room, userId) {
    if (window.TasuChatReviews?.isBuyerForRoom) {
      return window.TasuChatReviews.isBuyerForRoom(room, userId || getConfigMeId());
    }
    const buyerId = room?.buyerId ?? room?.buyer_id ?? "";
    return buyerId && String(buyerId) === String(userId || getConfigMeId());
  }

  /**
   * 自動完了可否（cron / Edge Function 用・今回は関数のみ）
   */
  function canAutoCompleteRoom(room, reportsCount) {
    if (window.TasuChatReviews?.canAutoCompleteRoom) {
      return window.TasuChatReviews.canAutoCompleteRoom(room, reportsCount);
    }
    return false;
  }

  async function countReportsForRoom(roomId) {
    const id = normalizeRoomId(roomId);
    if (!id) return 0;
    await ensureInitialized();
    if (supabaseReady && window.TasuChatSupabase?.countReportsForRoom) {
      try {
        return await window.TasuChatSupabase.countReportsForRoom(id);
      } catch (err) {
        console.warn("[TasuChat] countReportsForRoom failed:", err);
        return 0;
      }
    }
    const seed = getSeed();
    const list = Array.isArray(seed.reports) ? seed.reports : [];
    return list.filter((r) => String(r.room_id || r.roomId) === id).length;
  }

  /**
   * レビュー保存 → review_scores 更新
   * @param {{ roomId: string, rating?: number, comment?: string, isSkipped?: boolean, roomContext?: object }} input
   */
  async function submitReview(input) {
    const roomId = normalizeRoomId(input?.roomId);
    const room = input?.roomContext || null;
    const reviewerId = getConfigMeId();

    if (!roomId || !room) {
      return { ok: false, reason: "チャットが見つかりません" };
    }

    const isJobRoom = window.TasuPlatformChatJobFlow?.isJobThread?.(room) === true;
    const isPlatformRoom =
      window.TasuPlatformChatCategoryFlow?.isPlatformCompletionThread?.(room) === true;
    if (!isJobRoom && !isPlatformRoom && !isCurrentUserBuyer(room, reviewerId)) {
      return { ok: false, reason: "依頼者のみレビューできます" };
    }

    const reviewedUserId = isJobRoom
      ? window.TasuPlatformChatJobFlow?.getJobReviewTargetUserId?.(room, reviewerId) || ""
      : isPlatformRoom
        ? window.TasuPlatformChatReviewFlow?.getReviewTargetUserId?.(room, reviewerId) || ""
        : window.TasuChatReviews?.getReviewedUserIdForBuyer?.(room) ||
          room.sellerId ||
          room.seller_id ||
          "";
    if (!reviewedUserId) {
      return { ok: false, reason: "評価対象が見つかりません" };
    }

    if (
      (isJobRoom || isPlatformRoom) &&
      window.TasuPlatformChatReviewFlow?.hasUserSubmittedReview?.(
        roomId,
        reviewerId,
        reviewedUserId
      )
    ) {
      return { ok: false, reason: "すでに評価済みです" };
    }

    const isSkipped = Boolean(input?.isSkipped);
    const rating = isSkipped
      ? null
      : window.TasuChatReviews?.validateRating?.(input?.rating) ?? null;
    if (!isSkipped && rating == null) {
      return { ok: false, reason: "★1〜5を選択してください" };
    }

    const comment = String(input?.comment || "").trim();

    await ensureInitialized();

    if (supabaseReady && window.TasuChatSupabase?.insertReview && !isLocalRoomId(roomId)) {
      try {
        await window.TasuChatSupabase.insertReview({
          roomId,
          reviewerId,
          reviewedUserId,
          rating,
          comment: comment || undefined,
          isSkipped,
        });
        await window.TasuChatSupabase.upsertReviewScoresAfterReview(reviewedUserId, {
          rating,
          isSkipped,
        });
        window.TasuPlatformChatReviewFlow?.handleReviewSubmitted?.({
          thread: room,
          roomId,
          reviewerId,
          reviewedUserId,
          rating,
          comment,
          isSkipped,
        });
        return { ok: true, skipped: isSkipped };
      } catch (err) {
        console.warn("[TasuChat] submitReview failed:", err);
        if (window.TasuChatSupabase?.logSupabaseError) {
          window.TasuChatSupabase.logSupabaseError("submitReview", err);
        }
        return { ok: false, reason: "レビューの保存に失敗しました" };
      }
    }

    return submitReviewDummy({
      roomId,
      reviewerId,
      reviewedUserId,
      rating,
      comment,
      isSkipped,
      roomContext: room,
    });
  }

  function submitReviewDummy({
    roomId,
    reviewerId,
    reviewedUserId,
    rating,
    comment,
    isSkipped,
    roomContext,
  }) {
    const seed = getSeed();
    seed.reviews = Array.isArray(seed.reviews) ? seed.reviews : [];
    seed.reviewScores = seed.reviewScores && typeof seed.reviewScores === "object" ? seed.reviewScores : {};

    const duplicate = seed.reviews.some(
      (row) =>
        String(row.room_id) === String(roomId) &&
        String(row.reviewer_id) === String(reviewerId) &&
        String(row.reviewed_user_id) === String(reviewedUserId)
    );
    if (duplicate) {
      return { ok: false, reason: "すでに評価済みです" };
    }

    seed.reviews.push({
      id: `rev_${Date.now()}`,
      room_id: roomId,
      reviewer_id: reviewerId,
      reviewed_user_id: reviewedUserId,
      rating: isSkipped ? null : rating,
      comment: comment || null,
      is_skipped: isSkipped,
      created_at: nowIso(),
    });

    const existing = seed.reviewScores[reviewedUserId] || null;
    const compute = window.TasuChatReviews?.computeReviewScoreUpdate;
    const next = compute
      ? compute(existing, { rating, isSkipped })
      : {
          average_rating: isSkipped ? 0 : rating,
          total_reviews: 1,
          skipped_reviews: isSkipped ? 1 : 0,
        };

    seed.reviewScores[reviewedUserId] = {
      user_id: reviewedUserId,
      ...next,
      updated_at: nowIso(),
    };
    setSeed(seed);
    window.TasuPlatformChatReviewFlow?.handleReviewSubmitted?.({
      thread: roomContext,
      roomId,
      reviewerId,
      reviewedUserId,
      rating,
      comment,
      isSkipped,
    });
    return { ok: true, skipped: isSkipped };
  }

  function resolveRoomLifecycle(room) {
    if (window.TasuChatRoomStatus?.resolveRoomLifecycleStatus) {
      return window.TasuChatRoomStatus.resolveRoomLifecycleStatus(room);
    }
    return isExpired(room) ? "expired" : "active";
  }

  function getMessagingBlockReason(room) {
    if (window.TasuPlatformChatJobFlow?.isJobRoomClosed?.(room) === true) {
      return (
        window.TasuPlatformChatJobFlow?.JOB_CLOSED_SEND_BLOCK || "このチャットは終了しています"
      );
    }
    const lifecycle = resolveRoomLifecycle(room);
    const ui = window.TasuChatRoomStatus?.getLifecycleUi?.(lifecycle);
    if (ui && !ui.canSend) {
      return ui.sendBlockMessage || ui.alertMessage || "送信できません";
    }
    return "";
  }

  /**
   * 取引完了（status = completed）
   * @param {string} roomId
   */
  async function completeTransaction(roomId, roomContext) {
    const id = normalizeRoomId(roomId);
    if (!id) {
      return { ok: false, reason: "チャットが見つかりません" };
    }

    await ensureInitialized();

    let room =
      roomContext && normalizeRoomId(roomContext.id) === id ? roomContext : null;
    if (!room && supabaseReady && window.TasuChatSupabase?.fetchRoomById) {
      try {
        const row = await window.TasuChatSupabase.fetchRoomById(id);
        if (row) {
          room = window.TasuChatSupabase.mapRoomRowToThread(row);
        }
      } catch (err) {
        console.warn("[TasuChat] completeTransaction: fetch room for buyer check failed", err);
      }
    }
    if (!room) {
      const seed = getSeed();
      room = (seed.threads || []).find((t) => String(t.id) === id) || null;
    }
    if (room && !isCurrentUserBuyer(room, getConfigMeId())) {
      return { ok: false, reason: "依頼者のみ取引を完了できます" };
    }

    if (
      supabaseReady &&
      window.TasuChatSupabase?.completeTransactionRoom &&
      !isLocalRoomId(id)
    ) {
      try {
        const thread = await window.TasuChatSupabase.completeTransactionRoom(id);
        return { ok: true, thread };
      } catch (err) {
        console.warn("[TasuChat] completeTransaction failed:", err);
        if (window.TasuChatSupabase?.logSupabaseError) {
          window.TasuChatSupabase.logSupabaseError("completeTransaction", err);
        }
        return { ok: false, reason: "取引完了の更新に失敗しました" };
      }
    }

    const seed = getSeed();
    const thread = (seed.threads || []).find((t) => String(t.id) === id);
    if (!thread) {
      return { ok: false, reason: "チャットが見つかりません" };
    }
    if (!isCurrentUserBuyer(thread, getConfigMeId())) {
      return { ok: false, reason: "依頼者のみ取引を完了できます" };
    }
    thread.roomStatus = "completed";
    setSeed(seed);
    return {
      ok: true,
      thread: {
        ...thread,
        status: resolveRoomLifecycle(thread),
        roomStatus: "completed",
      },
    };
  }

  function getConfigMeId() {
    if (window.TasuChatUserIdentity?.getEffectiveUserId) {
      return window.TasuChatUserIdentity.getEffectiveUserId();
    }
    return window.TASU_CHAT_SUPABASE_CONFIG?.currentUserId || "u_me";
  }

  /**
   * 送信前審査（chat-moderation.js）
   * @param {{ text?: string, imageUrls?: string[], userId?: string, roomId?: string, senderId?: string, chatId?: string }} input
   * @returns {{ allowed: boolean, level: string, reasons: string[], message: string }}
   */
  function moderateMessage(input) {
    if (window.TasuChatModeration?.moderateMessage) {
      return window.TasuChatModeration.moderateMessage({
        text: input?.text ?? "",
        imageUrls: input?.imageUrls ?? [],
        ocrText: input?.ocrText ?? "",
        userId: input?.userId ?? input?.senderId ?? getConfigMeId(),
        roomId: normalizeRoomId(input?.roomId ?? input?.chatId ?? ""),
      });
    }
    return { allowed: true, level: "ok", reasons: [], message: "" };
  }

  /**
   * 画像 OCR → moderateMessage（OCR失敗時は warn のみでテキスト審査継続）
   * @param {string} roomId
   * @param {object} messageInput
   */
  async function runModeration(roomId, messageInput) {
    const imageUrls = collectImageUrls(messageInput);
    let ocrText = "";

    if (imageUrls.length && window.TasuChatOcr?.extractTextFromImages) {
      const { ocrText: extracted } = await window.TasuChatOcr.extractTextFromImages(imageUrls);
      ocrText = extracted || "";
    }

    const result = moderateMessage({
      text: messageInput.text,
      imageUrls,
      ocrText,
      userId: messageInput.senderId,
      roomId,
    });
    if (ocrText) {
      result._ocrText = ocrText;
    }
    return result;
  }

  function shouldPersistModerationLog(mod) {
    return mod && (mod.level === "blocked" || mod.level === "warning");
  }

  /**
   * 審査ログ保存（失敗しても送信フローは継続）
   * @param {string} roomId
   * @param {object} messageInput
   * @param {{ allowed: boolean, level: string, reasons: string[] }} mod
   */
  async function persistModerationLog(roomId, messageInput, mod) {
    if (!shouldPersistModerationLog(mod)) return;
    if (!supabaseReady || !window.TasuChatSupabase?.insertModerationLog) return;

    try {
      const logText = [messageInput.text || "", messageInput._ocrText || ""]
        .filter(Boolean)
        .join("\n---OCR---\n");

      await window.TasuChatSupabase.insertModerationLog({
        roomId,
        userId: messageInput.senderId || getConfigMeId(),
        messageText: logText,
        imageUrls: collectImageUrls(messageInput),
        reasons: mod.reasons || [],
        level: mod.level,
        allowed: mod.allowed,
      });
    } catch (err) {
      console.warn("[TasuChat] moderation_logs save failed:", err);
    }
  }

  function collectImageUrls(messageInput) {
    /** @type {string[]} */
    const urls = [];
    const dataUrl = messageInput?.attachment?.dataUrl;
    if (dataUrl) urls.push(String(dataUrl));
    if (Array.isArray(messageInput?.imageUrls)) {
      for (const u of messageInput.imageUrls) {
        if (u) urls.push(String(u));
      }
    }
    return urls;
  }

  async function ensureInitialized() {
    if (initPromise) {
      return initPromise;
    }

    initPromise = (async () => {
      if (!window.TasuChatSupabase?.isConfigured?.()) {
        supabaseReady = false;
        return false;
      }
      try {
        await window.TasuChatSupabase.init();
        supabaseReady = true;
        return true;
      } catch (err) {
        console.warn("[TasuChat] Supabase init failed, using dummy data.", err);
        supabaseReady = false;
        return false;
      }
    })();

    return initPromise;
  }

  function isUsingSupabase() {
    return supabaseReady;
  }

  /* ---------- Dummy (localStorage) ---------- */

  function loadLocalConsultThreads() {
    if (!window.TasuChatThreadStore?.getAllForChatList) return [];
    try {
      return window.TasuChatThreadStore.getAllForChatList();
    } catch (err) {
      console.warn("[TasuChat] local consult threads load failed:", err);
      return [];
    }
  }

  function mergeConsultThreadsFirst(baseThreads) {
    const local = loadLocalConsultThreads();
    const legacyLs =
      (typeof window !== "undefined" ? window : global).TasuChatThreadStore?.getAllForChatList?.().filter((t) =>
        /^chat-/i.test(String(t?.id || ""))
      ) || [];
    const mergedLocal = [...local];
    const seen = new Set(mergedLocal.map((t) => String(t.id)));
    for (const row of legacyLs) {
      const id = String(row.id || "");
      if (!id || seen.has(id)) continue;
      const dupRemote = (baseThreads || []).some(
        (r) =>
          String(r.contactId || r.contact_id || "") &&
          String(r.contactId || r.contact_id) === String(row.contactId || row.contact_id)
      );
      if (dupRemote) continue;
      mergedLocal.push(row);
      seen.add(id);
    }
    if (!mergedLocal.length) return baseThreads;
    const localIds = new Set(mergedLocal.map((t) => String(t.id)));
    const rest = (baseThreads || []).filter((t) => !localIds.has(String(t.id)));
    return [...mergedLocal, ...rest];
  }

  function loadThreadsDummy() {
    const seed = getSeed();
    const threads = Array.isArray(seed.threads) ? seed.threads : [];

    return mergeConsultThreadsFirst(
      threads
      .map((t) => {
        const lastSeenIso = seed.lastSeenByChatId?.[t.id] || t.lastReadAt || "";
        const unread =
          typeof t.unreadCount === "number" ? t.unreadCount : getUnreadCountDummy(t.id, lastSeenIso);
        const roomStatus = t.roomStatus || (t.status === "completed" || t.status === "cancelled" ? t.status : "active");
        const lifecycle = resolveRoomLifecycle({ ...t, roomStatus, expiresAt: t.expiresAt });
        return {
          ...t,
          roomStatus,
          status: lifecycle,
          remainingLabel: formatRemaining(t.expiresAt),
          unreadCount: unread,
        };
      })
      .sort((a, b) => {
        const aLast = getLastMessageAtDummy(a.id);
        const bLast = getLastMessageAtDummy(b.id);
        return bLast.localeCompare(aLast);
      })
    );
  }

  function getLastMessageAtDummy(roomId) {
    const id = normalizeRoomId(roomId);
    if (window.TasuChatThreadStore?.readAll) {
      const row = window.TasuChatThreadStore.readAll().find((t) => String(t.id) === id);
      if (row?.updatedAt) return row.updatedAt;
    }
    const seed = getSeed();
    const list = seed.messagesByChatId?.[id] || seed.messagesByChatId?.[roomId] || [];
    const last = list[list.length - 1];
    return last?.createdAt || "1970-01-01T00:00:00.000Z";
  }

  function getUnreadCountDummy(roomId, lastSeenIso) {
    const seed = getSeed();
    const list = seed.messagesByChatId?.[roomId] || [];
    const lastSeen = lastSeenIso ? new Date(lastSeenIso).getTime() : 0;
    if (!Number.isFinite(lastSeen)) {
      return 0;
    }
    return list.reduce((acc, m) => {
      const created = new Date(m.createdAt).getTime();
      if (Number.isFinite(created) && created > lastSeen && m.senderId !== getConfigMeId()) {
        return acc + 1;
      }
      return acc;
    }, 0);
  }

  function enrichThreadLifecycle(thread) {
    if (!thread) return null;
    const roomStatus =
      thread.roomStatus ||
      (thread.status === "completed" || thread.status === "cancelled" ? thread.status : "active");
    const base = {
      ...thread,
      buyerId: thread.buyerId || thread.buyer_id || "",
      sellerId: thread.sellerId || thread.seller_id || "",
      roomStatus,
      status: resolveRoomLifecycle({ ...thread, roomStatus, expiresAt: thread.expiresAt }),
    };
    return window.TasuTalkChatThreadModel?.enrichThread?.(base) || base;
  }

  function enrichThreadsForTalk(threads) {
    if (!Array.isArray(threads)) return [];
    if (window.TasuTalkChatThreadModel?.enrichThreads) {
      return window.TasuTalkChatThreadModel.enrichThreads(threads);
    }
    return threads.map((t) => enrichThreadLifecycle(t) || t);
  }

  function loadMessagesDummy(roomId) {
    const id = normalizeRoomId(roomId);
    const consult = loadConsultRoomMessages(id);
    if (consult) {
      return consult;
    }
    const seed = getSeed();
    const raw =
      (seed.threads || []).find((t) => String(t.id) === id) ||
      (seed.threads || []).find((t) => String(t.id) === roomId) ||
      null;
    const messages = seed.messagesByChatId?.[id] || seed.messagesByChatId?.[roomId] || [];
    return { thread: enrichThreadLifecycle(raw), messages };
  }

  function isSystemMessageInput(messageInput) {
    return (
      messageInput?.kind === "system" ||
      String(messageInput?.senderId || "").trim() === "__system__"
    );
  }

  function buildSystemMessage(roomId, messageInput) {
    const id = normalizeRoomId(roomId);
    const text = String(messageInput?.text || "").trim();
    return {
      id: `sys_${Math.random().toString(16).slice(2)}_${Date.now()}`,
      roomId: id,
      chatId: id,
      senderId: "__system__",
      senderName: String(messageInput?.senderName || "TASFUL"),
      senderAvatarUrl: "",
      text,
      createdAt: nowIso(),
      kind: "system",
      attachment: null,
    };
  }

  async function saveDealSystemMessage(roomId, text, roomContext) {
    const id = normalizeRoomId(roomId);
    const body = String(text || "").trim();
    if (!id || !body) {
      return { ok: false, reason: "メッセージが空です" };
    }

    await ensureInitialized();

    const messageInput = {
      senderId: "__system__",
      senderName: "TASFUL",
      text: body,
      kind: "system",
    };

    if (isLocalRoomId(id) && window.TasuChatSupabase?.insertLocalRoomMessage) {
      try {
        const message = window.TasuChatSupabase.insertLocalRoomMessage(id, messageInput);
        const preview = body.slice(0, 160);
        try {
          window.TasuChatSupabase.touchLocalRoomActivity?.(id, preview);
        } catch {
          /* insertLocalRoomMessage may already update thread */
        }
        return { ok: true, message };
      } catch (err) {
        console.warn("[TasuChat] saveDealSystemMessage local room failed:", err);
      }
    }

    if (supabaseReady && isLikelySupabaseRoomId(id) && window.TasuChatSupabase?.insertMessage) {
      try {
        const message = await window.TasuChatSupabase.insertMessage(id, messageInput);
        return { ok: true, message };
      } catch (err) {
        console.warn("[TasuChat] saveDealSystemMessage supabase failed:", err);
      }
    }

    return saveMessageDummy(id, messageInput);
  }

  function saveMessageDummy(roomId, messageInput) {
    const id = normalizeRoomId(roomId);

    if (isSystemMessageInput(messageInput)) {
      const msg = buildSystemMessage(id, messageInput);
      const seed = getSeed();
      if (!seed.messagesByChatId) seed.messagesByChatId = {};
      if (!Array.isArray(seed.messagesByChatId[id])) seed.messagesByChatId[id] = [];
      seed.messagesByChatId[id].push(msg);
      const preview = String(msg.text || "").trim().slice(0, 160);
      const threadIdx = (seed.threads || []).findIndex((t) => String(t.id) === id);
      if (threadIdx >= 0) {
        seed.threads[threadIdx] = {
          ...seed.threads[threadIdx],
          updatedAt: msg.createdAt,
          updated_at: msg.createdAt,
          ...(preview ? { lastMessagePreview: preview } : {}),
        };
      }
      if (window.TasuChatSupabase?.touchLocalRoomActivity && isLocalRoomId(id)) {
        try {
          window.TasuChatSupabase.touchLocalRoomActivity(id, preview);
        } catch {
          /* seed paths may differ */
        }
      }
      setSeed(seed);
      return { ok: true, message: msg };
    }

    if (window.TasuChatThreadStore?.loadRoom?.(id)) {
      const meId = messageInput.senderId || getConfigMeId();
      const raw = window.TasuChatThreadStore.appendMessage(id, {
        senderId: meId,
        senderName: messageInput.senderName || "あなた",
        text: messageInput.text || "",
      });
      const msg = {
        ...raw,
        roomId: id,
        chatId: id,
        senderAvatarUrl: messageInput.senderAvatarUrl || "",
        attachment: messageInput.attachment || null,
      };
      emitDemoMessageNotify(id, { ...messageInput, senderId: meId });
      return { ok: true, message: msg };
    }
    const seed = getSeed();
    const thread = (seed.threads || []).find((t) => String(t.id) === id);
    if (!thread) {
      return { ok: false, reason: "チャットが見つかりません" };
    }
    const blockReason = getMessagingBlockReason(thread);
    if (blockReason) {
      return { ok: false, reason: blockReason };
    }
    if (isExpired(thread)) {
      return { ok: false, reason: "期限切れのため送信できません" };
    }

    const rawText = String(messageInput.text ?? "");
    const attachment = messageInput.attachment;
    const hasAttachment = Boolean(attachment && attachment.dataUrl);
    if (!rawText.trim() && !hasAttachment) {
      return { ok: false, reason: "メッセージが空です" };
    }

    const msg = {
      id: `m_${Math.random().toString(16).slice(2)}_${Date.now()}`,
      roomId: id,
      senderId: messageInput.senderId,
      senderName: messageInput.senderName,
      senderAvatarUrl: messageInput.senderAvatarUrl,
      text: rawText,
      createdAt: nowIso(),
      kind: hasAttachment ? "mixed" : "text",
      attachment: hasAttachment
        ? {
            name: attachment.name || "image",
            dataUrl: attachment.dataUrl,
          }
        : null,
    };

    if (!seed.messagesByChatId) {
      seed.messagesByChatId = {};
    }
    if (!Array.isArray(seed.messagesByChatId[id])) {
      seed.messagesByChatId[id] = [];
    }
    seed.messagesByChatId[id].push(msg);

    if (!seed.lastSeenByChatId) {
      seed.lastSeenByChatId = {};
    }
    seed.lastSeenByChatId[id] = msg.createdAt;
    setSeed(seed);
    if (window.TasuPlatformChatDualWindowDemo?.isDemoThread?.(id)) {
      emitDemoMessageNotify(id, messageInput);
    }
    return { ok: true, message: msg };
  }

  function markThreadSeenDummy(roomId) {
    const seed = getSeed();
    if (!seed.lastSeenByChatId) {
      seed.lastSeenByChatId = {};
    }
    seed.lastSeenByChatId[roomId] = nowIso();
    setSeed(seed);
  }

  /* ---------- Public async API ---------- */

  async function loadThreads() {
    await ensureInitialized();
    if (supabaseReady) {
      try {
        const remote = await window.TasuChatSupabase.loadThreads(formatRemaining, isExpired);
        return enrichThreadsForTalk(mergeConsultThreadsFirst(remote));
      } catch (err) {
        console.warn("[TasuChat] loadThreads failed, fallback to dummy.", err);
      }
    }
    return enrichThreadsForTalk(loadThreadsDummy());
  }

  async function loadMessages(roomId) {
    let id = normalizeRoomId(roomId);
    if (!id) {
      const resolved = resolveRoomIdFromLocation();
      id = normalizeRoomId(resolved.roomId);
    }
    if (!id) {
      return { thread: null, messages: [] };
    }

    await ensureInitialized();

    const consult = loadConsultRoomMessages(id);
    if (consult) {
      return consult;
    }

    if (isLocalRoomId(id)) {
      window.TasuChatSupabase?.mergeLegacyLocalChatSeed?.();
      const local =
        window.TasuChatSupabase?.loadLocalRoomMessages?.(id) || loadMessagesDummy(id);
      if (local.thread) {
        return { thread: enrichThreadLifecycle(local.thread), messages: local.messages || [] };
      }
      return loadMessagesDummy(id);
    }
    if (supabaseReady) {
      try {
        const result = await window.TasuChatSupabase.loadMessages(id);
        if (result.thread) {
          return result;
        }
        if (Array.isArray(result.messages) && result.messages.length > 0) {
          return {
            thread: createRoomContextFromMessages(id, result.messages, result.thread),
            messages: result.messages,
          };
        }
        if (isLikelySupabaseRoomId(id)) {
          return result;
        }
      } catch (err) {
        if (window.TasuChatSupabase?.logSupabaseError) {
          window.TasuChatSupabase.logSupabaseError("loadMessages", err);
        } else {
          console.warn("[TasuChat] loadMessages failed, fallback to dummy.", err);
        }
        if (isLikelySupabaseRoomId(id)) {
          return { thread: null, messages: [] };
        }
      }
    }
    return loadMessagesDummy(id);
  }

  async function resolveRoomForSend(id, roomContext) {
    const ctxId = roomContext ? normalizeRoomId(roomContext.id) : "";
    if (roomContext && ctxId === id) {
      return roomContext;
    }
    if (isLocalRoomId(id)) {
      const { thread } = loadMessagesDummy(id);
      return thread || null;
    }
    if (supabaseReady) {
      const row = await window.TasuChatSupabase.fetchRoomById(id);
      if (row) {
        return window.TasuChatSupabase.mapRoomRowToThread(row);
      }
    }
    return null;
  }

  async function saveMessage(roomId, messageInput, roomContext) {
    const id = normalizeRoomId(roomId);
    if (!id) {
      return { ok: false, reason: "チャットが見つかりません" };
    }

    await ensureInitialized();

    const lifecycleBlock = getMessagingBlockReason(roomContext);
    if (lifecycleBlock) {
      console.warn("[TasuChat] saveMessage blocked: room lifecycle (context)", {
        roomId: id,
        lifecycle: resolveRoomLifecycle(roomContext),
      });
      return { ok: false, reason: lifecycleBlock };
    }

    const expiredMsg =
      window.TasuChatRoomStatus?.EXPIRED_SEND_MESSAGE || "期限切れのため送信できません";
    if (isRoomExpired(roomContext)) {
      console.warn("[TasuChat] saveMessage blocked: room expired (context)", { roomId: id });
      return { ok: false, reason: expiredMsg };
    }

    if (!isConsultThreadId(id)) {
      try {
        const expiryCheck = await checkRoomExpired(id, roomContext);
        if (expiryCheck.expired) {
          console.warn("[TasuChat] saveMessage blocked: room expired", {
            roomId: id,
            expiresAt: expiryCheck.expiresAt,
          });
          return { ok: false, reason: expiredMsg };
        }
      } catch (err) {
        console.warn("[TasuChat] saveMessage expiry check failed (allowing send guard via context):", err);
        if (isRoomExpired(roomContext)) {
          return { ok: false, reason: expiredMsg };
        }
      }
    }

    const rawText = String(messageInput.text ?? "");
    const hasAttachment = Boolean(messageInput.attachment?.dataUrl);
    if (!rawText.trim() && !hasAttachment) {
      return { ok: false, reason: "メッセージが空です" };
    }
    messageInput = { ...messageInput, text: rawText };

    const partnerId =
      roomContext?.partner?.id ||
      messageInput.partnerId ||
      "";
    const blockCheck = await getRoomBlockStatus(id, messageInput.senderId, partnerId);
    if (blockCheck.active) {
      return {
        ok: false,
        reason:
          window.TasuChatBlocks?.BLOCKED_SEND_MESSAGE || "ブロック中のため送信できません。",
      };
    }

    if (!isConsultThreadId(id)) {
      const mod = await runModeration(id, messageInput);
      if (mod._ocrText) {
        messageInput._ocrText = mod._ocrText;
      }
      if (shouldPersistModerationLog(mod)) {
        void persistModerationLog(id, messageInput, mod);
      }

      if (!mod.allowed) {
        return {
          ok: false,
          reason: mod.message || window.TasuChatModeration?.BLOCKED_USER_MESSAGE || "送信できませんでした",
          moderation: mod,
        };
      }
    }

    if (isLocalRoomId(id)) {
      return saveMessageDummy(id, messageInput);
    }

    if (supabaseReady) {
      try {
        const thread = await resolveRoomForSend(id, roomContext);
        if (!thread) {
          return { ok: false, reason: "チャットが見つかりません" };
        }
        const threadBlock = getMessagingBlockReason(thread);
        if (threadBlock) {
          console.warn("[TasuChat] saveMessage blocked: room lifecycle (thread)", {
            roomId: id,
            lifecycle: resolveRoomLifecycle(thread),
          });
          return { ok: false, reason: threadBlock };
        }
        if (isExpired(thread)) {
          console.warn("[TasuChat] saveMessage blocked: room expired (thread)", { roomId: id });
          return { ok: false, reason: expiredMsg };
        }

        const message = await window.TasuChatSupabase.insertMessage(id, messageInput);
        await window.TasuChatSupabase.markRoomReadNow(id);
        if (isThreadStoreRoomId(id) || window.TasuPlatformChatDualWindowDemo?.isDemoThread?.(id)) {
          emitDemoMessageNotify(id, messageInput);
        }
        return { ok: true, message };
      } catch (err) {
        if (window.TasuChatSupabase?.logSupabaseError) {
          window.TasuChatSupabase.logSupabaseError("saveMessage", err);
        } else {
          console.warn("[TasuChat] saveMessage supabase error:", err);
        }
        if (roomContext && normalizeRoomId(roomContext.id) === id) {
          try {
            if (isExpired(roomContext)) {
              console.warn("[TasuChat] saveMessage blocked: room expired (retry)", { roomId: id });
              return { ok: false, reason: expiredMsg };
            }
            const message = await window.TasuChatSupabase.insertMessage(id, messageInput);
            await window.TasuChatSupabase.markRoomReadNow(id);
            if (isThreadStoreRoomId(id) || window.TasuPlatformChatDualWindowDemo?.isDemoThread?.(id)) {
              emitDemoMessageNotify(id, messageInput);
            }
            return { ok: true, message };
          } catch (retryErr) {
            if (window.TasuChatSupabase?.logSupabaseError) {
              window.TasuChatSupabase.logSupabaseError("saveMessage retry", retryErr);
            } else {
              console.warn("[TasuChat] saveMessage retry failed:", retryErr);
            }
            return { ok: false, reason: "送信に失敗しました" };
          }
        }
        if (isLikelySupabaseRoomId(id)) {
          return { ok: false, reason: "送信に失敗しました" };
        }
      }
    }

    return saveMessageDummy(id, messageInput);
  }

  /**
   * チャット詳細: transaction_messages の Realtime INSERT 購読
   * @param {string} roomId
   * @param {{ onInsert?: (msg: object) => void, enrich?: (row: object) => object }} callbacks
   * @returns {() => void}
   */
  function subscribeRoomMessages(roomId, callbacks) {
    if (!supabaseReady || !window.TasuChatSupabase?.subscribeRoomDetail) {
      return () => {};
    }
    const id = normalizeRoomId(roomId);
    const partnerUserId = callbacks?.partnerUserId || "";
    return window.TasuChatSupabase.subscribeRoomDetail(id, partnerUserId, callbacks);
  }

  function unsubscribeRoomMessages() {
    window.TasuChatSupabase?.unsubscribeRoomDetail?.();
  }

  function getReadReceiptMessageId(messages, meId, partnerLastReadAt) {
    if (window.TasuChatSupabase?.getReadReceiptMessageId) {
      return window.TasuChatSupabase.getReadReceiptMessageId(messages, meId, partnerLastReadAt);
    }
    return null;
  }

  function subscribeListMessages(callbacks) {
    if (!supabaseReady || !window.TasuChatSupabase?.subscribeListMessages) {
      return () => {};
    }
    return window.TasuChatSupabase.subscribeListMessages(callbacks);
  }

  function unsubscribeListMessages() {
    window.TasuChatSupabase?.unsubscribeListMessages?.();
  }

  async function markRoomReadNow(roomId) {
    const id = normalizeRoomId(roomId);
    if (!id) return "";

    await ensureInitialized();
    if (isLocalRoomId(id)) {
      markThreadSeenDummy(id);
      return nowIso();
    }
    if (supabaseReady) {
      try {
        return (await window.TasuChatSupabase.markRoomReadNow(id)) || nowIso();
      } catch (err) {
        if (window.TasuChatSupabase?.logSupabaseError) {
          window.TasuChatSupabase.logSupabaseError("markRoomReadNow", err);
        }
        if (isLocalRoomId(id)) {
          markThreadSeenDummy(id);
          return nowIso();
        }
      }
    }
    markThreadSeenDummy(id);
    return nowIso();
  }

  async function markThreadSeen(roomId) {
    const id = normalizeRoomId(roomId);
    if (!id) return;

    await ensureInitialized();
    await markRoomReadNow(id);
  }

  /**
   * メッセージ通報 → reports（失敗してもチャットは継続）
   * @param {{ roomId: string, messageId: string, reason: string, detail?: string, reporterId?: string }} input
   */
  /**
   * @returns {{ active: boolean, iBlockedThem: boolean, theyBlockedMe: boolean }}
   */
  async function getRoomBlockStatus(roomId, userId, partnerId) {
    const me = userId || getConfigMeId();
    const partner = String(partnerId || "").trim();
    if (!partner) {
      return { active: false, iBlockedThem: false, theyBlockedMe: false };
    }

    await ensureInitialized();
    if (!supabaseReady || !window.TasuChatSupabase?.fetchBlockStatusBetween) {
      return { active: false, iBlockedThem: false, theyBlockedMe: false };
    }

    try {
      return await window.TasuChatSupabase.fetchBlockStatusBetween(me, partner);
    } catch (err) {
      console.warn("[TasuChat] getRoomBlockStatus failed:", err);
      return { active: false, iBlockedThem: false, theyBlockedMe: false };
    }
  }

  /**
   * @param {{ roomId: string, blockedId: string, blockerId?: string }} input
   */
  async function blockUser(input) {
    const roomId = normalizeRoomId(input?.roomId);
    const blockedId = String(input?.blockedId || "").trim();
    const blockerId = input?.blockerId || getConfigMeId();

    if (!roomId || !blockedId) {
      return { ok: false, reason: "ブロックできません" };
    }
    if (blockerId === blockedId) {
      return { ok: false, reason: "自分自身はブロックできません" };
    }

    await ensureInitialized();
    if (!supabaseReady || !window.TasuChatSupabase?.insertBlock) {
      console.warn("[TasuChat] blockUser: Supabase is not available");
      return { ok: false, reason: "ブロックを保存できませんでした" };
    }

    try {
      await window.TasuChatSupabase.insertBlock({
        roomId,
        blockerId,
        blockedId,
      });
      return { ok: true };
    } catch (err) {
      console.warn("[TasuChat] blocked_users insert failed:", err);
      if (window.TasuChatSupabase?.logSupabaseError) {
        window.TasuChatSupabase.logSupabaseError("insert blocked_users", err);
      }
      return { ok: false, reason: "ブロックを保存できませんでした" };
    }
  }

  async function submitReport(input) {
    const roomId = normalizeRoomId(input?.roomId);
    const messageId = String(input?.messageId || "").trim();
    const reason = String(input?.reason || "").trim();
    const detail = String(input?.detail || "").trim();

    if (!roomId || !messageId || !reason) {
      return { ok: false, reason: "通報内容が不足しています" };
    }

    if (!window.TasuChatReports?.isUuid?.(messageId)) {
      return { ok: false, reason: "このメッセージは通報できません" };
    }

    await ensureInitialized();

    if (!supabaseReady || !window.TasuChatSupabase?.insertReport) {
      console.warn("[TasuChat] submitReport: Supabase is not available");
      return { ok: false, reason: "通報を送信できませんでした" };
    }

    try {
      await window.TasuChatSupabase.insertReport({
        roomId,
        reporterId: input?.reporterId || getConfigMeId(),
        targetMessageId: messageId,
        reason,
        detail: detail || undefined,
      });
      return { ok: true, message: window.TasuChatReports?.REPORT_SUCCESS_MESSAGE || "通報を受け付けました" };
    } catch (err) {
      console.warn("[TasuChat] reports insert failed:", err);
      if (window.TasuChatSupabase?.logSupabaseError) {
        window.TasuChatSupabase.logSupabaseError("insert reports", err);
      }
      return { ok: false, reason: "通報を送信できませんでした" };
    }
  }

  window.TasuChatService = {
    ensureInitialized,
    isUsingSupabase,
    normalizeRoomId,
    isConsultThreadId,
    chatDetailUrl,
    syncRoomIdInUrl,
    readLocationRoomParams,
    resolveRoomIdFromLocation,
    getRoomIdFromLocation,
    getChatIdFromLocation,
    createRoomContextFromMessages,
    loadThreads,
    loadMessages,
    saveMessage,
    saveDealSystemMessage,
    markThreadSeen,
    markRoomReadNow,
    formatRemaining,
    isExpired,
    isRoomExpired,
    checkRoomExpired,
    resolveRoomLifecycle,
    getMessagingBlockReason,
    isCurrentUserBuyer,
    canAutoCompleteRoom,
    countReportsForRoom,
    submitReview,
    completeTransaction,
    moderateMessage,
    subscribeRoomMessages,
    unsubscribeRoomMessages,
    getReadReceiptMessageId,
    subscribeListMessages,
    unsubscribeListMessages,
    submitReport,
    getRoomBlockStatus,
    blockUser,
  };
})();
