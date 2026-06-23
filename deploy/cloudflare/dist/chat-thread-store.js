/**
 * 相談スレッド — localStorage (tasful_chat_threads / tasful_chat_messages)
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasful_chat_threads";
  const MESSAGES_KEY = "tasful_chat_messages";
  const EVENT_NAME = "tasful-chat-threads-changed";

  const INITIAL_MESSAGE_BY_TYPE = {
    general: "掲載内容について相談したいです。",
    skill: "掲載について相談したいです。",
    product: "掲載について相談したいです。",
    job: "掲載について相談したいです。",
    worker: "掲載について相談したいです。",
  };

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function newThreadId() {
    return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function isUuidThreadId(threadId) {
    return global.TasuTalkRoomEnsure?.isUuidRoomId?.(threadId) === true ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        String(threadId || "").trim()
      );
  }

  function isLegacyLsThreadId(threadId) {
    return /^chat-/i.test(String(threadId || "").trim());
  }

  function shouldUseSupabaseEnsure() {
    return global.TasuTalkRoomEnsure?.shouldPreferEdgeEnsure?.() === true ||
      (global.TasuChatSupabase?.isConfigured?.() === true &&
        global.TasuTalkRoomEnsure?.isTalkDevStubMode?.() !== true);
  }

  function readAll() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeAll(list) {
    const safe = Array.isArray(list) ? list : [];
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
      global.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { list: safe } }));
    } catch (err) {
      console.warn("[TasuChatThreadStore] save failed:", err);
    }
    return safe;
  }

  function readMessagesMap() {
    try {
      const raw = global.localStorage.getItem(MESSAGES_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function mergeMessagesMap(current, incoming) {
    const merged = { ...(current || {}) };
    const inc = incoming && typeof incoming === "object" ? incoming : {};
    Object.keys(inc).forEach((chatId) => {
      const prev = Array.isArray(merged[chatId]) ? merged[chatId] : [];
      const next = Array.isArray(inc[chatId]) ? inc[chatId] : [];
      const byId = new Map();
      prev.forEach((m) => {
        if (m?.id) byId.set(String(m.id), m);
      });
      next.forEach((m) => {
        if (m?.id) byId.set(String(m.id), m);
      });
      merged[chatId] = [...byId.values()].sort((a, b) =>
        String(a.createdAt || "").localeCompare(String(b.createdAt || ""))
      );
    });
    return merged;
  }

  function writeMessagesMap(map) {
    try {
      const merged = mergeMessagesMap(readMessagesMap(), map);
      global.localStorage.setItem(MESSAGES_KEY, JSON.stringify(merged));
    } catch (err) {
      console.warn("[TasuChatThreadStore] messages save failed:", err);
    }
  }

  function getBuyerId() {
    if (global.TasuChatUserIdentity?.getEffectiveUserId) {
      return global.TasuChatUserIdentity.getEffectiveUserId();
    }
    return global.TASU_CHAT_SUPABASE_CONFIG?.currentUserId || "demo-user";
  }

  function getBuyerName() {
    const profile = global.TasuMemberProfile?.getDisplayProfile?.() || global.TasuMemberAuth?.getLastProfile?.();
    return (
      pickStr(profile?.displayName, profile?.name, profile?.nickname) || "ゲストユーザー"
    );
  }

  function resolveListingTypeKey(listing) {
    const explicit = pickStr(listing?.listingType, listing?.listing_type, listing?.type);
    if (explicit) {
      const map = {
        business_service: "business-service",
        shop_store: "shop-store",
        general: "general",
        product: "product",
      };
      const key = explicit.toLowerCase().replace(/-/g, "_");
      return map[key] || explicit.replace(/_/g, "-");
    }
    const store = global.TasuListingLocalStore;
    if (store?.resolveListingTypeKey) {
      const key = store.resolveListingTypeKey(listing._localRecord || listing);
      const map = {
        business_service: "business-service",
        shop_store: "shop-store",
        general: "general",
      };
      return map[key] || key || "general";
    }
    const detailType = pickStr(global.document?.body?.dataset?.detailType).toLowerCase();
    if (detailType === "field_service") return "business-service";
    if (detailType === "shop_store") return "shop-store";
    if (detailType) return detailType.replace(/_/g, "-");
    return pickStr(listing?.listingType, listing?.listing_type, listing?.type) || "general";
  }

  function resolveInitialMessage(listing, options = {}) {
    if (options.lastMessage) return String(options.lastMessage).trim();
    const typeKey = resolveListingTypeKey(listing);
    const Category = global.TasuPlatformChatCategoryFlow;
    const normalized = Category?.normalizeCategoryKey?.(typeKey.replace(/-/g, "_")) || typeKey;
    const flowBase = Category?.resolveFlowBaseKey?.(normalized) || normalized;
    const flowKey = String(flowBase).replace(/_/g, "-");
    return (
      INITIAL_MESSAGE_BY_TYPE[flowKey] ||
      INITIAL_MESSAGE_BY_TYPE[flowBase] ||
      INITIAL_MESSAGE_BY_TYPE[typeKey] ||
      INITIAL_MESSAGE_BY_TYPE.general
    );
  }

  function pickImageUrl(listing) {
    const images = Array.isArray(listing?.images) ? listing.images : [];
    return pickStr(
      listing?.image,
      listing?.imageUrl,
      listing?.image_url,
      listing?.thumbnail_url,
      images[0]
    );
  }

  function resolveSeller(listing) {
    const listingId = pickStr(listing?.id, listing?.listing_id);
    const extra =
      listing?.category_extra?.shop_store ||
      listing?.form_data?.category_extra?.shop_store ||
      {};
    const sellerId = pickStr(
      listing?.user_id,
      listing?.seller_user_id,
      listing?.author_user_id,
      listing?.form_data?.user_id,
      `demo-seller-${listingId || "unknown"}`
    );
    const sellerName = pickStr(
      listing?.company_name,
      extra.shop_name,
      listing?.seller_name,
      listing?.organizer,
      "掲載者"
    );
    return { sellerId, sellerName };
  }

  function buildDetailUrl(listing) {
    const record = listing?._localRecord || listing;
    const fromStore = global.TasuListingLocalStore?.buildDetailPageUrl?.(record);
    if (fromStore && fromStore !== "#") return fromStore;
    const listingId = pickStr(listing?.id, listing?.listing_id);
    const typeKey = resolveListingTypeKey(listing);
    const R = global.TasuListingRouteResolver;
    if (R?.buildDetailUrl) {
      const typeMap = {
        "business-service": "business_service",
        shop_store: "shop",
        "shop-store": "shop",
        general: "general",
        skill: "skill",
        product: "product",
        job: "job",
        worker: "worker",
      };
      const routeType = typeMap[typeKey] || "general";
      return R.buildDetailUrl(routeType, listingId);
    }
    return "#";
  }

  function seedMessages(thread, listing) {
    const map = readMessagesMap();
    const buyerId = thread.buyerId;
    const now = thread.createdAt || new Date().toISOString();
    const intro = {
      id: `msg-${Date.now()}-intro`,
      chatId: thread.id,
      roomId: thread.id,
      senderId: buyerId,
      senderName: thread.buyerName,
      text: thread.lastMessage,
      createdAt: now,
      kind: "text",
    };
    map[thread.id] = [intro];
    writeMessagesMap({ [thread.id]: map[thread.id] });
  }

  function seedHireMessages(thread) {
    const map = readMessagesMap();
    const sellerId = thread.sellerId;
    const buyerId = thread.buyerId;
    const sellerName = thread.sellerName;
    const buyerName = thread.buyerName;
    const now = thread.activatedAt || thread.updatedAt || thread.createdAt || new Date().toISOString();
    const lastMessage =
      thread.lastMessage || "条件確認・日程調整はこのチャットで進めてください。";
    map[thread.id] = [
      {
        id: `msg-${Date.now()}-hire-owner`,
        chatId: thread.id,
        roomId: thread.id,
        senderId: sellerId,
        senderName: sellerName,
        senderAvatarUrl: pickStr(
          global.TasuChatUserIdentity?.getProfileForUserId?.(sellerId)?.avatarUrl
        ),
        text: `${buyerName} さんとやりとりを開始しました。${lastMessage}`,
        createdAt: now,
        kind: "text",
      },
      {
        id: `msg-${Date.now()}-hire-applicant`,
        chatId: thread.id,
        roomId: thread.id,
        senderId: buyerId,
        senderName: buyerName,
        senderAvatarUrl: pickStr(
          global.TasuChatUserIdentity?.getProfileForUserId?.(buyerId)?.avatarUrl
        ),
        text: "よろしくお願いします。",
        createdAt: now,
        kind: "text",
      },
    ];
    writeMessagesMap({ [thread.id]: map[thread.id] });
  }

  function findOpenThread(listingId, buyerId) {
    const lid = String(listingId || "").trim();
    const bid = String(buyerId || "").trim();
    if (!lid || !bid) return null;
    return (
      readAll().find(
        (row) =>
          String(row.listingId) === lid &&
          String(row.buyerId) === bid &&
          String(row.status || "").toLowerCase() === "open"
      ) || null
    );
  }

  function findFeePendingThread(listingId, buyerId) {
    const lid = String(listingId || "").trim();
    const bid = String(buyerId || "").trim();
    if (!lid || !bid) return null;
    return (
      readAll().find(
        (row) =>
          String(row.listingId) === lid &&
          String(row.buyerId) === bid &&
          String(row.status || "").toLowerCase() === "fee_pending"
      ) || null
    );
  }

  function findHireThread(listingId, applicationId) {
    const lid = String(listingId || "").trim();
    const aid = String(applicationId || "").trim();
    if (!lid || !aid) return null;
    return (
      readAll().find(
        (row) =>
          String(row.listingId) === lid &&
          String(row.applicationId) === aid &&
          String(row.threadKind || "") === "job_hire"
      ) || null
    );
  }

  function threadExists(threadId) {
    const id = pickStr(threadId);
    if (!id) return false;
    return readAll().some((row) => String(row.id) === id);
  }

  function roomExists(threadId) {
    const id = pickStr(threadId);
    if (!id) return false;
    return Boolean(loadRoom(id)?.thread);
  }

  function findApplicationByThreadId(threadId) {
    const id = pickStr(threadId);
    if (!id) return null;
    return (
      (global.TasuJobApplicationsStore?.readAll?.() || []).find(
        (row) => String(row.thread_id) === id
      ) || null
    );
  }

  function enrichHireAccessContext(queryThread, queryRoomId, listingId, applicationId) {
    let lid = pickStr(listingId);
    let aid = pickStr(applicationId);
    const hinted = pickStr(queryThread, queryRoomId);
    if (hinted && (!lid || !aid)) {
      const app = findApplicationByThreadId(hinted);
      if (app) {
        lid = lid || pickStr(app.job_id);
        aid = aid || pickStr(app.application_id);
      }
    }
    if ((!lid || !aid) && hinted) {
      const row = readAll().find((t) => String(t.id) === hinted);
      if (row) {
        lid = lid || pickStr(row.listingId);
        aid = aid || pickStr(row.applicationId);
      }
    }
    return { listingId: lid, applicationId: aid };
  }

  function readJobApplicationsCount() {
    try {
      return (global.TasuJobApplicationsStore?.readAll?.() || []).length;
    } catch {
      return 0;
    }
  }

  const THREAD_RESOLVE_FAIL_REASONS = Object.freeze({
    APPLICATION_NOT_FOUND: "application_not_found",
    APPLICATION_THREAD_ID_MISMATCH: "application_thread_id_mismatch",
    URL_THREAD_NOT_IN_STORE: "url_thread_not_in_store",
    RESTORE_NOT_CALLED: "restore_not_called",
    RESTORE_CREATED_DIFFERENT_THREAD_ID: "restore_created_different_thread_id",
    RESOLVED_THREAD_ID_MISMATCH: "resolved_thread_id_mismatch",
    QUERY_USER_NOT_PARTICIPANT: "query_user_not_participant",
    ROOM_NOT_CREATED: "room_not_created",
    UNKNOWN: "unknown_thread_resolve_failure",
  });

  function publishBenchThreadResolveDiag(diag) {
    try {
      global.__tasuBenchThreadResolveDiag = {
        traceName: "thread解決内部トレース",
        ...(diag || {}),
        at: new Date().toISOString(),
      };
    } catch {
      /* ignore */
    }
  }

  function applyThreadParticipantsToDiag(diag, thread) {
    const participants = thread?.participantIds || thread?.threadParticipants || [];
    const participantList = Array.isArray(participants)
      ? participants.map((p) => String(p)).filter(Boolean)
      : [];
    diag.participantIds = participantList.join(",");
    diag.isQueryUserParticipant = Boolean(
      diag.queryUserId && participantList.some((p) => p === diag.queryUserId)
    );
  }

  function refreshApplicationThreadIdAfter(diag) {
    const listingId = pickStr(diag.queryListingId);
    const applicationId = pickStr(diag.applicationId, diag.queryApplicationId);
    if (!listingId || !applicationId) {
      diag.applicationThreadIdAfter = "";
      return;
    }
    const app = global.TasuJobApplicationsStore?.findApplication?.(listingId, applicationId);
    diag.applicationThreadIdAfter = pickStr(app?.thread_id);
  }

  function recordFindHireThreadDiag(diag, listingId, applicationId) {
    if (!diag) return null;
    diag.findHireThreadCalled = true;
    const linked = findHireThread(listingId, applicationId);
    diag.findHireThreadResultId = pickStr(linked?.id);
    return linked;
  }

  function resolveListingForHire(listingId, listing) {
    if (listing && pickStr(listing.id, listing.listing_id)) return listing;
    const resolved = global.TasuJobApplicationsStore?.resolveListing?.(listingId);
    if (resolved) return resolved;
    const lid = pickStr(listingId);
    if (!lid) return null;
    return { id: lid, listing_id: lid, title: lid };
  }

  function classifyThreadResolveFailure(diag, result) {
    const urlThreadId = pickStr(diag.urlThreadId);
    const hasApplication =
      diag.applicationFoundById === true || diag.applicationFoundByThreadId === true;
    if (diag.queryApplicationId && !hasApplication) {
      return {
        failStep: "application_lookup",
        failReason: THREAD_RESOLVE_FAIL_REASONS.APPLICATION_NOT_FOUND,
      };
    }
    if (
      diag.applicationThreadIdBefore &&
      urlThreadId &&
      diag.applicationThreadIdBefore !== urlThreadId
    ) {
      return {
        failStep: "application_thread_id",
        failReason: THREAD_RESOLVE_FAIL_REASONS.APPLICATION_THREAD_ID_MISMATCH,
      };
    }
    if (
      diag.restoreCalled &&
      diag.restoreResultThreadId &&
      urlThreadId &&
      diag.restoreResultThreadId !== urlThreadId
    ) {
      return {
        failStep: "restoreHireThreadAtId",
        failReason: THREAD_RESOLVE_FAIL_REASONS.RESTORE_CREATED_DIFFERENT_THREAD_ID,
      };
    }
    if (diag.createdThreadId && urlThreadId && diag.createdThreadId !== urlThreadId) {
      return {
        failStep: "createHireThread",
        failReason: THREAD_RESOLVE_FAIL_REASONS.RESOLVED_THREAD_ID_MISMATCH,
      };
    }
    if (diag.resolvedThreadId && urlThreadId && diag.resolvedThreadId !== urlThreadId) {
      return {
        failStep: "resolveThreadAccess",
        failReason: THREAD_RESOLVE_FAIL_REASONS.RESOLVED_THREAD_ID_MISMATCH,
      };
    }
    if (diag.ensureCalled && !diag.restoreCalled && urlThreadId && !diag.threadExistsByUrlThreadId) {
      return {
        failStep: "ensureChatThreadForAcceptedJob",
        failReason: THREAD_RESOLVE_FAIL_REASONS.RESTORE_NOT_CALLED,
      };
    }
    if (urlThreadId && !diag.threadExistsByUrlThreadId && !diag.restoreCalled) {
      return {
        failStep: "thread_store",
        failReason: THREAD_RESOLVE_FAIL_REASONS.URL_THREAD_NOT_IN_STORE,
      };
    }
    if (
      diag.ensureCalled &&
      pickStr(diag.ensureResultThreadId) &&
      !roomExists(pickStr(diag.ensureResultThreadId))
    ) {
      return {
        failStep: "roomExists",
        failReason: THREAD_RESOLVE_FAIL_REASONS.ROOM_NOT_CREATED,
      };
    }
    if (diag.queryUserId && diag.participantIds && diag.isQueryUserParticipant === false) {
      return {
        failStep: "participant_check",
        failReason: THREAD_RESOLVE_FAIL_REASONS.QUERY_USER_NOT_PARTICIPANT,
      };
    }
    if (pickStr(diag.failReason) && Object.values(THREAD_RESOLVE_FAIL_REASONS).includes(diag.failReason)) {
      return {
        failStep: pickStr(diag.failStep, "resolveThreadAccess"),
        failReason: diag.failReason,
      };
    }
    return {
      failStep: pickStr(diag.failStep, result?.reason, "resolveThreadAccess"),
      failReason: THREAD_RESOLVE_FAIL_REASONS.UNKNOWN,
    };
  }

  function finalizeThreadResolveDiag(diag, result) {
    const thread = result?.thread || null;
    const resolvedId = pickStr(result?.threadId, thread?.id);
    diag.resolvedThreadId = resolvedId;
    diag.resolvedRoomId = resolvedId;
    diag.threadExistsByUrlThreadId = diag.urlThreadId ? threadExists(diag.urlThreadId) : false;
    refreshApplicationThreadIdAfter(diag);
    applyThreadParticipantsToDiag(diag, thread);
    if (result?.ok) {
      diag.finalResult = "ok";
      const mismatch =
        (diag.urlThreadId && resolvedId && diag.urlThreadId !== resolvedId) ||
        (diag.queryUserId && diag.isQueryUserParticipant === false);
      if (mismatch) {
        const classified = classifyThreadResolveFailure(diag, result);
        diag.failStep = classified.failStep;
        diag.failReason = classified.failReason;
        diag.finalResult =
          diag.failReason === THREAD_RESOLVE_FAIL_REASONS.QUERY_USER_NOT_PARTICIPANT
            ? "ok_participant_mismatch"
            : "ok_mismatch_id";
      } else {
        diag.failStep = "";
        diag.failReason = "";
      }
    } else {
      diag.finalResult = "fail";
      const classified = classifyThreadResolveFailure(diag, result);
      diag.failStep = classified.failStep;
      diag.failReason = classified.failReason;
    }
    publishBenchThreadResolveDiag(diag);
    return diag;
  }

  function createThreadResolveDiagBase(input, enriched) {
    const queryThread = pickStr(input?.queryThread);
    const queryListingId = pickStr(enriched?.listingId, input?.listingId);
    const queryApplicationId = pickStr(enriched?.applicationId, input?.applicationId);
    const queryUserId = pickStr(input?.queryUserId, input?.userId);
    const urlThreadId = queryThread;
    const appById =
      queryListingId && queryApplicationId
        ? global.TasuJobApplicationsStore?.findApplication?.(queryListingId, queryApplicationId)
        : null;
    const appByThread = urlThreadId ? findApplicationByThreadId(urlThreadId) : null;
    const linked =
      queryListingId && queryApplicationId
        ? findHireThread(queryListingId, queryApplicationId)
        : null;
    return {
      traceName: "thread解決内部トレース",
      urlThreadId,
      queryListingId,
      queryApplicationId,
      queryUserId,
      applicationsCount: readJobApplicationsCount(),
      applicationFoundById: Boolean(appById),
      applicationFoundByThreadId: Boolean(appByThread),
      applicationId: pickStr(appById?.application_id, appByThread?.application_id, queryApplicationId),
      applicationThreadIdBefore: pickStr(appById?.thread_id, appByThread?.thread_id),
      applicationThreadIdAfter: "",
      threadStoreCount: readAll().length,
      threadExistsByUrlThreadId: urlThreadId ? threadExists(urlThreadId) : false,
      threadExistsByApplicationThreadId: pickStr(appById?.thread_id, appByThread?.thread_id)
        ? threadExists(pickStr(appById?.thread_id, appByThread?.thread_id))
        : false,
      findHireThreadCalled: Boolean(queryListingId && queryApplicationId),
      findHireThreadResultId: pickStr(linked?.id),
      ensureCalled: false,
      ensureInputListingId: "",
      ensureInputApplicationId: "",
      ensureInputPreferredThreadId: "",
      ensureResultThreadId: "",
      restoreCalled: false,
      restoreInputThreadId: "",
      restoreResultThreadId: "",
      restoreResultRoomId: "",
      createCalled: false,
      createPreferredThreadId: "",
      createdThreadId: "",
      resolvedThreadId: "",
      resolvedRoomId: "",
      participantIds: "",
      isQueryUserParticipant: false,
      finalResult: "",
      failStep: "",
      failReason: "",
    };
  }

  function markEnsureResult(diag, thread) {
    if (!diag) return;
    const id = pickStr(thread?.id);
    if (id) diag.ensureResultThreadId = id;
  }

  function finishThreadAccess(diag, result) {
    finalizeThreadResolveDiag(diag, result);
    return { ...result, _diag: diag };
  }

  function isListingPurchaseListingType(listingType, listing) {
    return (
      global.TasuPlatformChatCategoryFlow?.isProductPurchaseFlowEnabled?.(listing || listingType) ===
      true
    );
  }

  function resolveListingForPurchaseAccess(listingId) {
    const lid = pickStr(listingId);
    if (!lid) return null;
    return (
      global.TasuListingContactRequestsStore?.resolveListing?.(lid) ||
      global.TasuPlatformChatLiveFlow?.resolveBenchListingForProfile?.({ listingId: lid }) ||
      { id: lid, listing_id: lid }
    );
  }

  function resolvePurchaseContactForListing(listingId, options) {
    const lid = pickStr(listingId);
    const Contacts = global.TasuListingContactRequestsStore;
    const Live = global.TasuPlatformChatLiveFlow;
    const profile =
      options?.profile ||
      global.TasuPlatformChatDualWindowDemo?.resolveProfileForListingThread?.({
        listingId: lid,
        listingType: options?.listingType,
      });
    const contactId = pickStr(options?.contactId);
    if (contactId && Contacts?.findById) {
      const byId = Contacts.findById(contactId);
      if (byId) return byId;
    }
    if (profile && Live?.readBenchPreStartRecord) {
      const pre = Live.readBenchPreStartRecord(profile);
      if (pre) return pre;
    }
    if (Contacts?.listByListing) {
      const rows = Contacts.listByListing(lid) || [];
      if (profile?.partnerBId) {
        const match = rows.find((r) => String(r.requester_id) === String(profile.partnerBId));
        if (match) return match;
      }
      return rows[0] || null;
    }
    return null;
  }

  /** product / shop_store — URL threadId で欠落している購入 thread を復元 */
  function restoreListingPurchaseThreadAtId(threadId, listing, contact, options) {
    const id = pickStr(threadId);
    const diag = options?._diag || null;
    if (!id || !listing) {
      if (diag) {
        diag.failStep = "restoreListingPurchaseThreadAtId";
        diag.failReason = THREAD_RESOLVE_FAIL_REASONS.UNKNOWN;
      }
      return { ok: false, reason: "missing_restore_context" };
    }
    const existing = readAll().find((row) => String(row.id) === id);
    if (existing) {
      const normalized =
        global.TasuPlatformChatDualWindowDemo?.normalizeThreadPartnerIdsForBench?.(existing) ||
        existing;
      if (normalized !== existing) {
        const list = readAll().map((row) => (String(row.id) === id ? normalized : row));
        writeAll(list);
      }
      if (diag) {
        diag.restoreCalled = true;
        diag.restoreInputThreadId = id;
        diag.restoreResultThreadId = id;
        diag.restoreResultRoomId = id;
      }
      return { ok: true, thread: normalized, restored: false };
    }

    const listingId = pickStr(listing.id, listing.listing_id);
    const listingType = resolveListingTypeKey(listing);
    if (!isListingPurchaseListingType(listingType)) {
      return { ok: false, reason: "not_purchase_listing" };
    }

    const contactRow =
      contact || resolvePurchaseContactForListing(listingId, { listingType });
    const profile = global.TasuPlatformChatDualWindowDemo?.resolveProfileForListingThread?.({
      listingId,
      listingType,
    });
    const partners = profile
      ? global.TasuPlatformChatDualWindowDemo?.resolveBenchPartnerIds?.(profile) || {}
      : {};
    const { sellerId, sellerName } = resolveSeller(listing);
    const buyerId = pickStr(partners.buyerId, contactRow?.requester_id, options?.buyerId);
    const buyerName = pickStr(profile?.partnerBName, contactRow?.requester_name) || "購入者";
    const listingTitle = pickStr(listing.title, listing.company_name, listing.service_name) || listingId;
    const now = new Date().toISOString();
    const Purchase = global.TasuPlatformChatPurchasePaymentFlow;
    const row = {
      id,
      roomId: id,
      chatDomain: "work",
      threadKind: "listing_inquiry",
      contactId: pickStr(contactRow?.contact_id),
      listingId,
      listingType,
      listingTitle,
      category: pickStr(
        listing.category,
        listing.categoryLabel,
        listing.normalized_store_category,
        listing.business_subcategory
      ),
      image: pickImageUrl(listing),
      detailUrl: buildDetailUrl(listing),
      sellerId: pickStr(partners.sellerId, sellerId),
      sellerName: pickStr(profile?.partnerAName, sellerName),
      partnerUserId: pickStr(partners.sellerId, sellerId),
      buyerId,
      buyerName,
      status: "open",
      roomStatus: "active",
      platformContactKind: pickStr(contactRow?.contact_kind, "purchase"),
      source: "listing-purchase-restore",
      lastMessage: resolveInitialMessage(listing, { intent: "purchase" }),
      createdAt: now,
      updatedAt: now,
      activatedAt: now,
      _feePending: false,
    };
    if (Purchase?.createInitialPurchaseThreadFields) {
      const method = Purchase.resolvePaymentMethodFromContext?.({});
      Object.assign(row, Purchase.createInitialPurchaseThreadFields(method));
    }

    const list = readAll();
    list.unshift(row);
    writeAll(list);
    if (!getMessages(id).length) {
      seedMessages(row, listing);
    }
    if (diag) {
      diag.restoreCalled = true;
      diag.restoreInputThreadId = id;
      diag.restoreResultThreadId = id;
      diag.restoreResultRoomId = id;
    }
    return { ok: true, thread: row, created: true, restored: true };
  }

  function ensureListingPurchaseThreadAccess(ctx) {
    const threadId = pickStr(ctx?.threadId, ctx?.id);
    const listingId = pickStr(ctx?.listingId);
    const diag = ctx?._diag || null;
    if (diag) {
      diag.ensureCalled = true;
      diag.ensureInputListingId = listingId;
      diag.ensureInputPreferredThreadId = threadId;
    }
    if (!threadId || !listingId) return { ok: false, reason: "missing_purchase_context" };

    const byId = readAll().find((row) => String(row.id) === threadId);
    if (byId) {
      markEnsureResult(diag, byId);
      return { ok: true, thread: byId };
    }

    const listing = resolveListingForPurchaseAccess(listingId);
    const restored = restoreListingPurchaseThreadAtId(threadId, listing, ctx?.contact, {
      _diag: diag,
      buyerId: ctx?.buyerId,
    });
    if (restored?.ok) {
      markEnsureResult(diag, restored.thread);
      return restored;
    }
    return restored || { ok: false, reason: "purchase_restore_failed" };
  }

  /**
   * chat-detail 起動時 — URL 候補から実在 thread を解決
   * @param {{ queryThread?: string, queryRoomId?: string, listingId?: string, applicationId?: string, queryUserId?: string, userId?: string }} input
   */
  function resolveThreadAccess(input) {
    const queryThread = pickStr(input?.queryThread);
    const queryRoomId = pickStr(input?.queryRoomId, input?.roomId);
    const enriched = enrichHireAccessContext(
      queryThread,
      queryRoomId,
      input?.listingId,
      input?.applicationId
    );
    const listingId = enriched.listingId;
    const applicationId = enriched.applicationId;
    const diag = createThreadResolveDiagBase(input, enriched);
    const candidates = [
      { key: "thread", id: queryThread },
      { key: "roomId", id: queryRoomId },
    ].filter((row) => row.id);

    for (const row of candidates) {
      if (!roomExists(row.id)) continue;
      const thread = readAll().find((t) => String(t.id) === row.id) || null;
      return finishThreadAccess(diag, {
        ok: true,
        threadId: row.id,
        lookupKey: row.key,
        threadExists: true,
        roomExists: true,
        thread,
      });
    }

    const appById =
      listingId && applicationId
        ? global.TasuJobApplicationsStore?.findApplication?.(listingId, applicationId)
        : null;
    const appByThread = findApplicationByThreadId(pickStr(queryThread, queryRoomId));
    const app = appById || appByThread || null;
    diag.applicationFoundById = Boolean(appById);
    diag.applicationFoundByThreadId = Boolean(appByThread);
    diag.applicationId = pickStr(app?.application_id, applicationId);
    diag.applicationThreadIdBefore = pickStr(app?.thread_id);

    const urlThreadId = pickStr(queryThread);
    const appThreadId = pickStr(app?.thread_id);
    const preferredThreadId = pickStr(
      urlThreadId && appThreadId && urlThreadId === appThreadId ? urlThreadId : "",
      urlThreadId,
      appThreadId
    );

    if (preferredThreadId && listingId && applicationId) {
      const listing = global.TasuJobApplicationsStore?.resolveListing?.(listingId);
      const application =
        app || global.TasuJobApplicationsStore?.findApplication?.(listingId, applicationId);
      diag.ensureInputPreferredThreadId = preferredThreadId;
      const ensured = ensureChatThreadForAcceptedJob({
        listing,
        application,
        thread: {
          id: preferredThreadId,
          listingId,
          applicationId,
        },
        _diag: diag,
      });
      const ensuredThread = ensured?.thread;
      const ensuredId = pickStr(ensuredThread?.id);
      diag.findHireThreadResultId = pickStr(findHireThread(listingId, applicationId)?.id);
      diag.threadExistsByUrlThreadId = urlThreadId ? threadExists(urlThreadId) : false;
      if (ensured?.ok && ensuredId && roomExists(ensuredId)) {
        return finishThreadAccess(diag, {
          ok: true,
          threadId: ensuredId,
          lookupKey: pickStr(
            ensured.restored ? "restoreHireThreadAtId" : "ensureChatThreadForAcceptedJob"
          ),
          threadExists: true,
          roomExists: true,
          thread: ensuredThread,
          recoveredFrom:
            pickStr(queryThread, queryRoomId) && ensuredId !== pickStr(queryThread, queryRoomId)
              ? pickStr(queryThread, queryRoomId)
              : "",
          created: ensured.created === true,
          restored: ensured.restored === true,
        });
      }
      markEnsureResult(diag, ensuredThread);
      if (!ensured?.ok) {
        diag.failStep = diag.failStep || "ensureChatThreadForAcceptedJob";
        diag.failReason =
          diag.failReason || THREAD_RESOLVE_FAIL_REASONS.UNKNOWN;
      } else if (!roomExists(ensuredId)) {
        diag.failStep = "roomExists";
        diag.failReason = THREAD_RESOLVE_FAIL_REASONS.ROOM_NOT_CREATED;
      }
    } else if (urlThreadId && listingId && !applicationId) {
      const listing = resolveListingForPurchaseAccess(listingId);
      const listingType = resolveListingTypeKey(listing || { listingId });
      if (isListingPurchaseListingType(listingType)) {
        diag.ensureInputPreferredThreadId = urlThreadId;
        const ensured = ensureListingPurchaseThreadAccess({
          threadId: urlThreadId,
          listingId,
          _diag: diag,
        });
        const ensuredThread = ensured?.thread;
        const ensuredId = pickStr(ensuredThread?.id);
        diag.threadExistsByUrlThreadId = urlThreadId ? threadExists(urlThreadId) : false;
        if (ensured?.ok && ensuredId && roomExists(ensuredId)) {
          return finishThreadAccess(diag, {
            ok: true,
            threadId: ensuredId,
            lookupKey: pickStr(
              ensured.restored ? "restoreListingPurchaseThreadAtId" : "ensureListingPurchaseThreadAccess"
            ),
            threadExists: true,
            roomExists: true,
            thread: ensuredThread,
            restored: ensured.restored === true,
            created: ensured.created === true,
          });
        }
        markEnsureResult(diag, ensuredThread);
        if (!ensured?.ok) {
          diag.failStep = diag.failStep || "ensureListingPurchaseThreadAccess";
          diag.failReason = diag.failReason || THREAD_RESOLVE_FAIL_REASONS.UNKNOWN;
        } else if (!roomExists(ensuredId)) {
          diag.failStep = "roomExists";
          diag.failReason = THREAD_RESOLVE_FAIL_REASONS.ROOM_NOT_CREATED;
        }
      } else {
        diag.failStep = "missing_hire_context";
        diag.failReason = THREAD_RESOLVE_FAIL_REASONS.UNKNOWN;
      }
    } else if (urlThreadId && !listingId) {
      diag.failStep = "missing_listing_context";
      diag.failReason = THREAD_RESOLVE_FAIL_REASONS.UNKNOWN;
    }

    if (!urlThreadId) {
      const linked = recordFindHireThreadDiag(diag, listingId, applicationId);
      if (linked?.id) {
        return finishThreadAccess(diag, {
          ok: true,
          threadId: linked.id,
          lookupKey: "listingId+applicationId",
          threadExists: true,
          roomExists: true,
          thread: linked,
          recoveredFrom: pickStr(queryThread, queryRoomId),
        });
      }
    }

    if (appThreadId && roomExists(appThreadId)) {
      return finishThreadAccess(diag, {
        ok: true,
        threadId: appThreadId,
        lookupKey: "application.thread_id",
        threadExists: true,
        roomExists: true,
        thread: readAll().find((t) => String(t.id) === appThreadId) || null,
        recoveredFrom: pickStr(queryThread, queryRoomId),
      });
    }

    const fallbackId = pickStr(queryThread, queryRoomId);
    return finishThreadAccess(diag, {
      ok: false,
      reason: fallbackId ? "thread_not_found" : "missing_id",
      threadId: "",
      lookupKey: "",
      threadExists: false,
      roomExists: false,
      queryThread,
      queryRoomId,
      listingId,
      applicationId,
    });
  }

  /**
   * 550円支払い完了後 — 求人やりとり thread を確実に用意する
   * @param {{ listing?: object, application?: object, thread?: object }} ctx
   */
  function ensureChatThreadForAcceptedJob(ctx) {
    const listing = ctx?.listing || {};
    const application = ctx?.application || {};
    const thread = ctx?.thread || {};
    const diag = ctx?._diag || null;
    let listingId = pickStr(listing.id, listing.listing_id, thread.listingId);
    let applicationId = pickStr(application.application_id, thread.applicationId);
    const hintedId = pickStr(thread.id, application.thread_id);

    if (diag) {
      diag.ensureCalled = true;
      diag.ensureInputListingId = listingId;
      diag.ensureInputApplicationId = applicationId;
      diag.ensureInputPreferredThreadId = pickStr(hintedId);
    }

    if ((!listingId || !applicationId) && hintedId) {
      const app = findApplicationByThreadId(hintedId);
      if (app) {
        listingId = listingId || pickStr(app.job_id);
        applicationId = applicationId || pickStr(app.application_id);
      }
      const row = readAll().find((t) => String(t.id) === hintedId);
      if (row) {
        listingId = listingId || pickStr(row.listingId);
        applicationId = applicationId || pickStr(row.applicationId);
      }
    }

    const resolvedListing = resolveListingForHire(listingId, listing);
    const resolvedApplication =
      application && pickStr(application.application_id)
        ? application
        : global.TasuJobApplicationsStore?.findApplication?.(listingId, applicationId);

    if (hintedId) {
      const byId = readAll().find((row) => String(row.id) === hintedId);
      if (byId) {
        markEnsureResult(diag, byId);
        return { ok: true, thread: byId };
      }
      if (listingId && applicationId && resolvedListing && resolvedApplication) {
        const restored = restoreHireThreadAtId(hintedId, resolvedListing, resolvedApplication, {
          feePending: false,
          _diag: diag,
        });
        if (restored?.ok) {
          markEnsureResult(diag, restored.thread);
          return restored;
        }
      }
    }

    const linked = recordFindHireThreadDiag(diag, listingId, applicationId);
    if (linked) {
      if (hintedId && String(linked.id) !== hintedId) {
        if (resolvedListing && resolvedApplication) {
          const restored = restoreHireThreadAtId(hintedId, resolvedListing, resolvedApplication, {
            feePending: false,
            _diag: diag,
          });
          if (restored?.ok) {
            markEnsureResult(diag, restored.thread);
            return { ...restored, redirectedFrom: linked.id };
          }
        }
        if (diag) {
          diag.failStep = "findHireThread";
          diag.failReason = THREAD_RESOLVE_FAIL_REASONS.RESTORE_CREATED_DIFFERENT_THREAD_ID;
        }
      } else {
        markEnsureResult(diag, linked);
        return { ok: true, thread: linked };
      }
    }

    if (listingId && applicationId && resolvedListing && resolvedApplication) {
      const created = createHireThread(resolvedListing, resolvedApplication, {
        feePending: false,
        preferredThreadId: hintedId || undefined,
        _diag: diag,
      });
      if (created?.ok && created.thread) {
        markEnsureResult(diag, created.thread);
        return { ok: true, thread: created.thread, created: created.created === true };
      }
    }

    if (diag) {
      diag.failStep = diag.failStep || "ensureChatThreadForAcceptedJob";
      if (!resolvedApplication && applicationId) {
        diag.failReason = THREAD_RESOLVE_FAIL_REASONS.APPLICATION_NOT_FOUND;
      } else if (hintedId && !diag.restoreCalled) {
        diag.failReason = THREAD_RESOLVE_FAIL_REASONS.RESTORE_NOT_CALLED;
      } else {
        diag.failReason = THREAD_RESOLVE_FAIL_REASONS.UNKNOWN;
      }
    }

    return {
      ok: false,
      reason: "thread_not_found",
      listingId,
      applicationId,
      hintedId: hintedId || null,
    };
  }

  function findWorkerRequestThread(listingId, requestId) {
    const lid = String(listingId || "").trim();
    const rid = String(requestId || "").trim();
    if (!lid || !rid) return null;
    return (
      readAll().find(
        (row) =>
          String(row.listingId) === lid &&
          String(row.requestId) === rid &&
          String(row.threadKind || "") === "worker_request"
      ) || null
    );
  }

  /**
   * @param {object} listing
   * @param {{ intent?: string, lastMessage?: string }} [options]
   */
  function createOrOpenThread(listing, options = {}) {
    if (!listing || typeof listing !== "object") {
      return { ok: false, reason: "invalid_listing" };
    }

    const listingId = pickStr(listing.id, listing.listing_id);
    if (!listingId) return { ok: false, reason: "missing_listing_id" };

    const buyerId = getBuyerId();
    const buyerName = getBuyerName();
    const feePending = options.feePending === true;

    const existingOpen = findOpenThread(listingId, buyerId);
    if (existingOpen) {
      return { ok: true, created: false, thread: existingOpen };
    }

    if (feePending) {
      const existingPending = findFeePendingThread(listingId, buyerId);
      if (existingPending) {
        return { ok: true, created: false, thread: existingPending, feePending: true };
      }
    }

    const { sellerId, sellerName } = resolveSeller(listing);
    const listingType = resolveListingTypeKey(listing);
    const now = new Date().toISOString();
    const lastMessage = resolveInitialMessage(listing, options);

    const thread = {
      id: newThreadId(),
      chatDomain: "work",
      threadKind: "listing_inquiry",
      listingId,
      listingType,
      listingTitle: pickStr(listing.title, listing.company_name, listing.service_name) || listingId,
      category: pickStr(
        listing.category,
        listing.categoryLabel,
        listing.normalized_store_category,
        listing.business_subcategory
      ),
      image: pickImageUrl(listing),
      detailUrl: buildDetailUrl(listing),
      sellerId,
      sellerName,
      partnerUserId: sellerId,
      buyerId,
      buyerName,
      status: feePending ? "fee_pending" : "open",
      roomStatus: feePending ? "fee_pending" : "active",
      source: feePending ? "detail-cta-fee-pending" : "detail-cta",
      platformStartPhase: feePending ? "awaiting_partner" : "",
      platformContactKind: pickStr(options.intent, "purchase"),
      lastMessage,
      createdAt: now,
      updatedAt: now,
      _feePending: feePending,
    };

    const list = readAll();
    list.unshift(thread);
    writeAll(list);
    if (!feePending) {
      seedMessages(thread, listing);
    }

    return { ok: true, created: true, thread, feePending };
  }

  function findContactThread(listingId, contactId) {
    const lid = String(listingId || "").trim();
    const cid = String(contactId || "").trim();
    if (!lid || !cid) return null;
    return (
      readAll().find(
        (row) =>
          String(row.listingId) === lid &&
          String(row.contactId) === cid &&
          String(row.threadKind || "") === "listing_inquiry"
      ) || null
    );
  }

  /**
   * 550円支払い完了後 — LS fallback（P1: 新規は createThreadFromContactAsync 優先）
   */
  function createThreadFromContactLs(listing, contact) {
    if (!listing || typeof listing !== "object") {
      return { ok: false, reason: "invalid_listing" };
    }
    const listingId = pickStr(listing.id, listing.listing_id);
    const contactId = pickStr(contact?.contact_id);
    const buyerId = pickStr(contact?.requester_id);
    if (!listingId || !contactId || !buyerId) {
      return { ok: false, reason: "missing_contact_context" };
    }

    const existing = findContactThread(listingId, contactId);
    if (existing) return { ok: true, created: false, thread: existing };

    const { sellerId, sellerName } = resolveSeller(listing);
    const listingType =
      pickStr(listing.listing_type, listing.listingType, contact?.listing_type, contact?.listingType) ||
      resolveListingTypeKey(listing);
    const now = new Date().toISOString();
    const buyerName = pickStr(contact?.requester_name) || "購入者";
    const listingTitle = pickStr(listing.title, listing.company_name, listing.service_name) || listingId;
    const lastMessage = resolveInitialMessage(listing, { intent: contact?.contact_kind });

    const thread = {
      id: newThreadId(),
      chatDomain: "work",
      threadKind: "listing_inquiry",
      contactId,
      listingId,
      listingType,
      listingTitle,
      category: pickStr(
        listing.category,
        listing.categoryLabel,
        listing.normalized_store_category,
        listing.business_subcategory
      ),
      image: pickImageUrl(listing),
      detailUrl: buildDetailUrl(listing),
      sellerId,
      sellerName,
      partnerUserId: sellerId,
      buyerId,
      buyerName,
      status: "fee_pending",
      roomStatus: "fee_pending",
      platformContactKind: pickStr(contact?.contact_kind, "purchase"),
      source: "listing-contact-paid",
      lastMessage,
      createdAt: now,
      updatedAt: now,
      _feePending: true,
    };

    if (global.TasuPlatformChatCategoryFlow?.isProductPurchaseFlowEnabled?.(listing) === true) {
      const Purchase = global.TasuPlatformChatPurchasePaymentFlow;
      if (Purchase?.createInitialPurchaseThreadFields) {
        const method = Purchase.resolvePaymentMethodFromContext?.({});
        Object.assign(thread, Purchase.createInitialPurchaseThreadFields(method));
      }
    }

    const normalized =
      global.TasuPlatformChatDualWindowDemo?.normalizeThreadPartnerIdsForBench?.(thread) || thread;
    const list = readAll();
    list.unshift(normalized);
    writeAll(list);
    return { ok: true, created: true, thread: normalized, feePending: true, storage: "localStorage" };
  }

  function buildThreadRowFromEnsure(listing, contact, ensureResult, options) {
    const listingId = pickStr(listing.id, listing.listing_id);
    const contactId = pickStr(contact?.contact_id);
    const buyerId = pickStr(contact?.requester_id);
    const { sellerId, sellerName } = resolveSeller(listing);
    const listingType =
      pickStr(listing.listing_type, listing.listingType, contact?.listing_type, contact?.listingType) ||
      resolveListingTypeKey(listing);
    const now = new Date().toISOString();
    const buyerName = pickStr(contact?.requester_name) || "購入者";
    const listingTitle = pickStr(listing.title, listing.company_name, listing.service_name) || listingId;
    const roomId = pickStr(ensureResult?.room_id);
    const feePending = options?.feePending !== false;
    const thread = {
      id: roomId,
      roomId,
      chatDomain: "work",
      threadKind: pickStr(options?.threadKind, "listing_inquiry"),
      contactId,
      listingId,
      listingType,
      listingTitle,
      category: pickStr(
        listing.category,
        listing.categoryLabel,
        listing.normalized_store_category,
        listing.business_subcategory
      ),
      image: pickImageUrl(listing),
      detailUrl: buildDetailUrl(listing),
      sellerId,
      sellerName,
      partnerUserId: sellerId,
      buyerId,
      buyerName,
      status: feePending ? "fee_pending" : "open",
      roomStatus: feePending ? "fee_pending" : "active",
      platformContactKind: pickStr(contact?.contact_kind, "purchase"),
      source: pickStr(options?.source, "listing-contact-paid"),
      lastMessage: resolveInitialMessage(listing, { intent: contact?.contact_kind }),
      createdAt: now,
      updatedAt: now,
      _feePending: feePending,
      _supabaseRoom: true,
    };

    if (options?.applicationId) thread.applicationId = pickStr(options.applicationId);
    if (options?.requestId) thread.requestId = pickStr(options.requestId);

    if (global.TasuPlatformChatCategoryFlow?.isProductPurchaseFlowEnabled?.(listing) === true) {
      const Purchase = global.TasuPlatformChatPurchasePaymentFlow;
      if (Purchase?.createInitialPurchaseThreadFields) {
        const method = Purchase.resolvePaymentMethodFromContext?.({});
        Object.assign(thread, Purchase.createInitialPurchaseThreadFields(method));
      }
    }

    return global.TasuPlatformChatDualWindowDemo?.normalizeThreadPartnerIdsForBench?.(thread) || thread;
  }

  async function createThreadFromContactAsync(listing, contact, options) {
    if (!listing || typeof listing !== "object") {
      return { ok: false, reason: "invalid_listing" };
    }
    const listingId = pickStr(listing.id, listing.listing_id);
    const contactId = pickStr(contact?.contact_id);
    const buyerId = pickStr(contact?.requester_id);
    if (!listingId || !contactId || !buyerId) {
      return { ok: false, reason: "missing_contact_context" };
    }

    const existingLs = findContactThread(listingId, contactId);
    if (existingLs) {
      return { ok: true, created: false, thread: existingLs, storage: "localStorage" };
    }

    const existingRoomId = pickStr(contact?.thread_id);
    if (existingRoomId && isUuidThreadId(existingRoomId)) {
      const row = await global.TasuChatSupabase?.fetchRoomById?.(existingRoomId).catch(() => null);
      if (row) {
        const thread = buildThreadRowFromEnsure(listing, contact, { room_id: existingRoomId }, options);
        return { ok: true, created: false, thread, storage: "supabase", reused: true };
      }
    }

    if (shouldUseSupabaseEnsure() && global.TasuTalkRoomEnsure?.ensureTalkRoom) {
      const { sellerId } = resolveSeller(listing);
      const listingType =
        pickStr(listing.listing_type, listing.listingType, contact?.listing_type, contact?.listingType) ||
        resolveListingTypeKey(listing);
      const title =
        pickStr(listing.title, listing.company_name, listing.service_name, "やりとり") || listingId;
      const ensured = await global.TasuTalkRoomEnsure.ensureTalkRoom({
        listing,
        contact,
        listing_type: listingType,
        listing_id: listingId,
        buyer_id: buyerId,
        seller_id: sellerId,
        title: `【${listingType}】${title}`,
        contact_id: contactId,
        source: pickStr(options?.source, "listing-contact-paid"),
        service_type: pickStr(options?.service_type),
        service_ref_id: pickStr(options?.service_ref_id),
        status: options?.feePending === false ? "active" : "fee_pending",
        from: pickStr(options?.from, "contact"),
      });
      if (ensured?.ok && ensured.room_id) {
        const thread = buildThreadRowFromEnsure(listing, contact, ensured, options);
        return {
          ok: true,
          created: Boolean(ensured.created),
          reused: Boolean(ensured.reused),
          thread,
          feePending: options?.feePending !== false,
          storage: "supabase",
          mode: ensured.mode,
        };
      }
    }

    return createThreadFromContactLs(listing, contact);
  }

  function createThreadFromContact(listing, contact, options) {
    if (shouldUseSupabaseEnsure() && global.TasuTalkRoomEnsure?.ensureTalkRoom) {
      return createThreadFromContactAsync(listing, contact, options);
    }
    return createThreadFromContactLs(listing, contact);
  }

  async function activateThreadAfterFeePaidAsync(threadId) {
    const id = String(threadId || "").trim();
    if (!id) return { ok: false, reason: "missing_thread_id" };

    const list = readAll();
    const idx = list.findIndex((row) => String(row.id) === id);

    if (idx < 0 && isUuidThreadId(id) && global.TasuChatSupabase?.activateTransactionRoom) {
      try {
        const activatedRow = await global.TasuChatSupabase.activateTransactionRoom(id);
        const synthetic =
          activatedRow && typeof activatedRow === "object"
            ? {
                id,
                roomId: id,
                chatDomain: "work",
                listingId: pickStr(activatedRow.listing?.id, activatedRow.listing_id),
                listingType: pickStr(activatedRow.listing?.type, activatedRow.listing_type),
                listingTitle: pickStr(activatedRow.listing?.title, activatedRow.title),
                buyerId: pickStr(activatedRow.buyerId, activatedRow.buyer_id),
                sellerId: pickStr(activatedRow.sellerId, activatedRow.seller_id),
                status: "open",
                roomStatus: "active",
                _supabaseRoom: true,
              }
            : { id, roomId: id, status: "open", roomStatus: "active", _supabaseRoom: true };
        return { ok: true, thread: synthetic, activated: true, storage: "supabase" };
      } catch (err) {
        console.warn("[TasuChatThreadStore] activateTransactionRoom failed:", err);
        return { ok: false, reason: "supabase_activate_failed" };
      }
    }

    if (idx < 0) return { ok: false, reason: "thread_not_found" };
    return activateThreadAfterFeePaidLs(id, idx, list);
  }

  function activateThreadAfterFeePaidLs(threadId, idx, list) {
    const id = String(threadId || "").trim();
    if (idx == null || idx < 0) {
      idx = list.findIndex((row) => String(row.id) === id);
    }
    if (idx < 0) return { ok: false, reason: "thread_not_found" };

    const row = list[idx];
    const now = new Date().toISOString();
    const messages = getMessages(id);
    const isJobHire = String(row.threadKind || "") === "job_hire";
    const wasFeePending = String(row.status || "").toLowerCase() === "fee_pending";
    if (isJobHire && (wasFeePending || !messages.length)) {
      const seeded = global.TasuPlatformChatJobCard?.seedJobApplicationCardMessage?.(id, row);
      if (!seeded?.ok && !messages.length) seedHireMessages(row);
    } else if (!messages.length) {
      const listing =
        global.TasuPlatformChatDemoSeed?.resolveListing?.(row.listingId) ||
        {
          id: row.listingId,
          title: row.listingTitle,
          listing_type: row.listingType,
        };
      const seeded = global.TasuPlatformChatContentCard?.seedContentCardMessage?.(
        id,
        row,
        listing
      );
      if (!seeded?.ok) seedMessages(row, { title: row.listingTitle });
    }

    const normalized =
      global.TasuPlatformChatDualWindowDemo?.normalizeThreadPartnerIdsForBench?.(row) || row;
    const next = {
      ...normalized,
      status: "open",
      roomStatus: "active",
      source: isJobHire ? "job-hire" : "detail-cta",
      platformStartPhase: "",
      updatedAt: now,
      activatedAt: pickStr(normalized.activatedAt, row.activatedAt) || now,
      _feePending: false,
    };
    list[idx] = next;
    writeAll(list);
    return { ok: true, thread: next, activated: String(row.status) === "fee_pending", storage: "localStorage" };
  }

  function activateThreadAfterFeePaid(threadId) {
    const id = String(threadId || "").trim();
    if (isUuidThreadId(id) && shouldUseSupabaseEnsure()) {
      return activateThreadAfterFeePaidAsync(threadId);
    }
    const list = readAll();
    const idx = list.findIndex((row) => String(row.id) === id);
    return activateThreadAfterFeePaidLs(threadId, idx, list);
  }

  function buildHireThreadRow(threadId, listing, application, options = {}) {
    const listingId = pickStr(listing.id, listing.listing_id);
    const applicationId = pickStr(application?.application_id);
    const buyerId = pickStr(application?.applicant_id);
    const feePending = options.feePending === true;
    const { sellerId, sellerName } = resolveSeller(listing);
    const listingType = resolveListingTypeKey(listing);
    const now = new Date().toISOString();
    const buyerName = pickStr(application?.applicant_name) || "応募者";
    const listingTitle = pickStr(listing.title, listing.company_name) || listingId;
    const lastMessage = "条件確認・日程調整はこのチャットで進めてください。";
    const posterUserId = pickStr(
      listing.user_id,
      listing.seller_user_id,
      listing.author_user_id,
      global.TasuTalkPlatformNotify?.resolveJobPosterUserId?.(listingId, listing),
      !String(sellerId).startsWith("demo-seller-") ? sellerId : ""
    );
    const resolvedSellerId = posterUserId || sellerId;
    const participants = [...new Set([resolvedSellerId, buyerId].filter(Boolean))];
    const id = pickStr(threadId);
    return {
      id,
      roomId: id,
      chatDomain: "work",
      threadKind: "job_hire",
      applicationId,
      listingId,
      listingType,
      listingTitle,
      category: pickStr(listing.category, listing.categoryLabel) || "求人",
      image: pickImageUrl(listing),
      detailUrl: buildDetailUrl(listing),
      sellerId: resolvedSellerId,
      sellerName,
      posterUserId: resolvedSellerId,
      ownerUserId: resolvedSellerId,
      listingOwnerId: resolvedSellerId,
      partnerUserId: resolvedSellerId,
      buyerId,
      buyerName,
      applicantUserId: buyerId,
      participantIds: participants,
      threadParticipants: participants,
      status: feePending ? "fee_pending" : "open",
      roomStatus: feePending ? "fee_pending" : "active",
      source: feePending ? "job-hire-fee-pending" : "job-hire",
      lastMessage,
      createdAt: now,
      updatedAt: now,
      _feePending: feePending,
      _supabaseRoom: options._supabaseRoom === true,
    };
  }

  async function createHireThreadAsync(listing, application, options = {}) {
    const diag = options._diag || null;
    const preferredThreadId = pickStr(options.preferredThreadId);
    if (!listing || typeof listing !== "object") {
      return { ok: false, reason: "invalid_listing" };
    }
    const listingId = pickStr(listing.id, listing.listing_id);
    const applicationId = pickStr(application?.application_id);
    const buyerId = pickStr(application?.applicant_id);
    if (!listingId || !applicationId || !buyerId) {
      return { ok: false, reason: "missing_hire_context" };
    }

    const feePending = options.feePending === true;
    const existing = recordFindHireThreadDiag(diag, listingId, applicationId);
    if (existing && !isUuidThreadId(existing.id)) {
      return { ok: true, created: false, thread: existing, feePending: feePending && existing._feePending };
    }

    if (shouldUseSupabaseEnsure() && global.TasuTalkRoomEnsure?.ensureTalkRoom) {
      const { sellerId } = resolveSeller(listing);
      const listingType = resolveListingTypeKey(listing);
      const title = pickStr(listing.title, listing.company_name) || listingId;
      const ensured = await global.TasuTalkRoomEnsure.ensureTalkRoom({
        listing,
        application,
        listing_type: listingType || "job",
        listing_id: listingId,
        buyer_id: buyerId,
        seller_id: sellerId,
        title: `【求人】${title}`,
        service_type: "job_application",
        service_ref_id: applicationId,
        source: feePending ? "job-hire-fee-pending" : "job-hire",
        status: feePending ? "fee_pending" : "active",
        from: "job-hire",
      });
      if (ensured?.ok && ensured.room_id) {
        const thread = buildHireThreadRow(ensured.room_id, listing, application, {
          feePending,
          _supabaseRoom: true,
        });
        return {
          ok: true,
          created: Boolean(ensured.created),
          reused: Boolean(ensured.reused),
          thread,
          feePending,
          storage: "supabase",
        };
      }
    }

    return createHireThread(listing, application, options);
  }

  /** URL / application の thread_id で欠落している hire thread を復元（別 ID は作らない） */
  function restoreHireThreadAtId(threadId, listing, application, options = {}) {
    const id = pickStr(threadId);
    const diag = options._diag || null;
    if (diag) {
      diag.restoreCalled = true;
      diag.restoreInputThreadId = id;
    }
    if (!id || !listing || !application) {
      if (diag) {
        diag.failStep = "restoreHireThreadAtId";
        diag.failReason = THREAD_RESOLVE_FAIL_REASONS.UNKNOWN;
        diag.restoreResultThreadId = "";
        diag.restoreResultRoomId = "";
      }
      return { ok: false, reason: "missing_restore_context" };
    }
    const existing = readAll().find((row) => String(row.id) === id);
    if (existing) {
      if (diag) {
        diag.restoreResultThreadId = pickStr(existing.id);
        diag.restoreResultRoomId = pickStr(existing.id);
      }
      return { ok: true, thread: existing, restored: false };
    }
    const row = buildHireThreadRow(id, listing, application, options);
    const list = readAll();
    list.unshift(row);
    writeAll(list);
    if (!options.feePending) {
      seedHireMessages(row);
    }
    try {
      global.TasuJobApplicationsStore?.finalizeHireAfterPayment?.(row);
    } catch {
      /* ignore */
    }
    if (diag) {
      diag.restoreResultThreadId = pickStr(row.id);
      diag.restoreResultRoomId = pickStr(row.id);
    }
    return { ok: true, thread: row, created: true, restored: true };
  }

  /**
   * 求人 — やりとりチャットを作成（手数料支払い前は fee_pending）
   * @param {object} listing
   * @param {{ application_id?: string, applicant_id?: string, applicant_name?: string }} application
   * @param {{ feePending?: boolean, preferredThreadId?: string }} [options]
   */
  function createHireThread(listing, application, options = {}) {
    if (shouldUseSupabaseEnsure() && global.TasuTalkRoomEnsure?.ensureTalkRoom) {
      return createHireThreadAsync(listing, application, options);
    }
    const diag = options._diag || null;
    const preferredThreadId = pickStr(options.preferredThreadId);
    if (diag) {
      diag.createCalled = true;
      diag.createPreferredThreadId = preferredThreadId;
    }
    if (!listing || typeof listing !== "object") {
      return { ok: false, reason: "invalid_listing" };
    }
    const listingId = pickStr(listing.id, listing.listing_id);
    const applicationId = pickStr(application?.application_id);
    const buyerId = pickStr(application?.applicant_id);
    if (!listingId || !applicationId || !buyerId) {
      return { ok: false, reason: "missing_hire_context" };
    }

    const feePending = options.feePending === true;
    if (preferredThreadId) {
      const byPreferred = readAll().find((row) => String(row.id) === preferredThreadId);
      if (byPreferred) {
        return { ok: true, created: false, thread: byPreferred, feePending: false };
      }
      const restored = restoreHireThreadAtId(preferredThreadId, listing, application, {
        feePending,
        _diag: diag,
      });
      if (restored?.ok) return restored;
    }

    const existing = recordFindHireThreadDiag(diag, listingId, applicationId);
    if (existing) {
      if (preferredThreadId && String(existing.id) !== preferredThreadId) {
        const restored = restoreHireThreadAtId(preferredThreadId, listing, application, {
          feePending,
          _diag: diag,
        });
        if (restored?.ok) {
          return { ...restored, redirectedFrom: existing.id };
        }
      }
      if (feePending && String(existing.status || "").toLowerCase() === "fee_pending") {
        return { ok: true, created: false, thread: existing, feePending: true };
      }
      if (!feePending || String(existing.status || "").toLowerCase() === "open") {
        return { ok: true, created: false, thread: existing, feePending: false };
      }
    }

    const threadId = preferredThreadId || newThreadId();
    const thread = buildHireThreadRow(threadId, listing, application, { feePending });

    const list = readAll();
    list.unshift(thread);
    writeAll(list);

    if (!feePending) {
      seedHireMessages(thread);
    }

    if (diag) diag.createdThreadId = pickStr(thread.id);
    return { ok: true, created: true, thread, feePending };
  }

  /**
   * ワーカー依頼受諾時のみ — やりとりチャットを作成
   * @param {object} listing
   * @param {{ request_id?: string, requester_id?: string, requester_name?: string }} request
   */
  async function createWorkerRequestThreadAsync(listing, request, options = {}) {
    if (!listing || typeof listing !== "object") {
      return { ok: false, reason: "invalid_listing" };
    }
    const listingId = pickStr(listing.id, listing.listing_id);
    const requestId = pickStr(request?.request_id);
    const buyerId = pickStr(request?.requester_id);
    if (!listingId || !requestId || !buyerId) {
      return { ok: false, reason: "missing_request_context" };
    }

    const existing = findWorkerRequestThread(listingId, requestId);
    if (existing && !isUuidThreadId(existing.id)) {
      return { ok: true, created: false, thread: existing };
    }

    const feeGate =
      options.feePending === true ||
      (options.feePending !== false && global.TasuPlatformChatFee?.shouldGateChatStart?.(listing) === true);

    if (shouldUseSupabaseEnsure() && global.TasuTalkRoomEnsure?.ensureTalkRoom) {
      const { sellerId } = resolveSeller(listing);
      const listingType = resolveListingTypeKey(listing);
      const title = pickStr(listing.title) || listingId;
      const ensured = await global.TasuTalkRoomEnsure.ensureTalkRoom({
        listing,
        request,
        listing_type: listingType || "worker",
        listing_id: listingId,
        buyer_id: buyerId,
        seller_id: sellerId,
        title: `【ワーカー】${title}`,
        service_type: "worker_request",
        service_ref_id: requestId,
        source: "worker-request",
        status: feeGate ? "fee_pending" : "active",
        from: "worker-request",
      });
      if (ensured?.ok && ensured.room_id) {
        const lsResult = createWorkerRequestThread(listing, request, {
          ...options,
          _preferredRoomId: ensured.room_id,
          _skipLsWrite: true,
        });
        if (lsResult?.ok && lsResult.thread) {
          lsResult.thread.id = ensured.room_id;
          lsResult.thread.roomId = ensured.room_id;
          lsResult.thread._supabaseRoom = true;
          lsResult.storage = "supabase";
          lsResult.created = Boolean(ensured.created);
          lsResult.reused = Boolean(ensured.reused);
          return lsResult;
        }
        const now = new Date().toISOString();
        const thread = {
          id: ensured.room_id,
          roomId: ensured.room_id,
          chatDomain: "work",
          threadKind: "worker_request",
          requestId,
          listingId,
          listingType,
          listingTitle: title,
          buyerId,
          sellerId,
          status: feeGate ? "fee_pending" : "open",
          roomStatus: feeGate ? "fee_pending" : "active",
          _supabaseRoom: true,
          createdAt: now,
          updatedAt: now,
        };
        return {
          ok: true,
          created: Boolean(ensured.created),
          reused: Boolean(ensured.reused),
          thread,
          storage: "supabase",
        };
      }
    }

    return createWorkerRequestThreadLs(listing, request, options);
  }

  function createWorkerRequestThread(listing, request, options = {}) {
    if (shouldUseSupabaseEnsure() && global.TasuTalkRoomEnsure?.ensureTalkRoom && !options._skipLsWrite) {
      return createWorkerRequestThreadAsync(listing, request, options);
    }
    return createWorkerRequestThreadLs(listing, request, options);
  }

  function createWorkerRequestThreadLs(listing, request, options = {}) {
    if (!listing || typeof listing !== "object") {
      return { ok: false, reason: "invalid_listing" };
    }
    const listingId = pickStr(listing.id, listing.listing_id);
    const requestId = pickStr(request?.request_id);
    const buyerId = pickStr(request?.requester_id);
    if (!listingId || !requestId || !buyerId) {
      return { ok: false, reason: "missing_request_context" };
    }

    const existing = findWorkerRequestThread(listingId, requestId);
    if (existing) return { ok: true, created: false, thread: existing };

    const { sellerId, sellerName } = resolveSeller(listing);
    const listingType = resolveListingTypeKey(listing);
    const now = new Date().toISOString();
    const buyerName = pickStr(request?.requester_name) || "依頼者";
    const listingTitle = pickStr(listing.title) || listingId;
    const feeGate =
      options.feePending === true ||
      (options.feePending !== false && global.TasuPlatformChatFee?.shouldGateChatStart?.(listing) === true);
    const lastMessage = feeGate
      ? "依頼を受諾しました。やりとり開始料のお支払い後にチャットが解放されます。"
      : "依頼を受諾しました。条件確認・日程調整はこのチャットで進めてください。";

    const thread = {
      id: pickStr(options._preferredRoomId) || newThreadId(),
      chatDomain: "work",
      threadKind: "worker_request",
      requestId,
      listingId,
      listingType,
      listingTitle,
      category: pickStr(listing.category, listing.categoryLabel) || "ワーカー",
      image: pickImageUrl(listing),
      detailUrl: buildDetailUrl(listing),
      sellerId,
      sellerName,
      partnerUserId: sellerId,
      buyerId,
      buyerName,
      status: feeGate ? "fee_pending" : "open",
      roomStatus: feeGate ? "fee_pending" : "active",
      platformStartPhase: feeGate ? "awaiting_fee" : "",
      platformContactKind: "request",
      source: "worker-request",
      lastMessage,
      createdAt: now,
      updatedAt: now,
      _feePending: feeGate,
    };

    const list = readAll();
    if (!options._skipLsWrite) {
      list.unshift(thread);
      writeAll(list);
    }

    if (!feeGate && !options._skipLsWrite) {
      const map = readMessagesMap();
      map[thread.id] = [
        {
          id: `msg-${Date.now()}-worker-owner`,
          chatId: thread.id,
          roomId: thread.id,
          senderId: sellerId,
          senderName: sellerName,
          text: `${buyerName} さんの依頼を受けました。${lastMessage}`,
          createdAt: now,
          kind: "text",
        },
        {
          id: `msg-${Date.now()}-worker-requester`,
          chatId: thread.id,
          roomId: thread.id,
          senderId: buyerId,
          senderName: buyerName,
          text: "依頼を受けてくださりありがとうございます。よろしくお願いします。",
          createdAt: now,
          kind: "text",
        },
      ];
      writeMessagesMap({ [thread.id]: map[thread.id] });
    }

    return { ok: true, created: true, thread };
  }

  function getMessages(threadId) {
    const id = String(threadId || "").trim();
    const map = readMessagesMap();
    return Array.isArray(map[id]) ? map[id] : [];
  }

  function appendMessage(threadId, messageInput) {
    const id = String(threadId || "").trim();
    const map = readMessagesMap();
    const list = Array.isArray(map[id]) ? [...map[id]] : [];
    const msg = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      chatId: id,
      roomId: id,
      senderId: messageInput.senderId,
      senderName: messageInput.senderName || "",
      text: String(messageInput.text ?? ""),
      createdAt: new Date().toISOString(),
      kind: "text",
    };
    list.push(msg);
    writeMessagesMap({ [id]: list });

    const threads = readAll();
    const idx = threads.findIndex((t) => String(t.id) === id);
    if (idx >= 0) {
      threads[idx] = {
        ...threads[idx],
        lastMessage: msg.text,
        updatedAt: msg.createdAt,
      };
      writeAll(threads);
    }
    return msg;
  }

  function profileForParticipant(userId, displayName, avatarUrl) {
    const id = pickStr(userId);
    if (!id) return { id: "", displayName: "", avatarUrl: "" };
    const fromIdentity = global.TasuChatUserIdentity?.getProfileForUserId?.(id);
    if (fromIdentity?.id) {
      return {
        id: fromIdentity.id,
        displayName: pickStr(fromIdentity.displayName, displayName, id),
        avatarUrl: pickStr(fromIdentity.avatarUrl, avatarUrl),
      };
    }
    return {
      id,
      displayName: pickStr(displayName, id),
      avatarUrl: pickStr(avatarUrl),
    };
  }

  /** URL の userId（閲覧者）に合わせて me / partner を入れ替える */
  function applyViewerToThread(thread, viewerUserId, row) {
    if (!thread) return thread;
    const viewerId = pickStr(
      viewerUserId,
      global.TasuChatUserIdentity?.getEffectiveUserId?.()
    );
    if (!viewerId) return thread;

    const sellerId = pickStr(thread.sellerId, row?.sellerId);
    const buyerId = pickStr(thread.buyerId, row?.buyerId);
    const sellerName = pickStr(row?.sellerName, thread.partner?.displayName);
    const buyerName = pickStr(row?.buyerName);
    const sellerAvatar = pickStr(row?.image, thread.partner?.avatarUrl);

    if (viewerId === sellerId) {
      return {
        ...thread,
        me: profileForParticipant(sellerId, sellerName, sellerAvatar),
        partner: profileForParticipant(buyerId, buyerName, ""),
      };
    }
    if (viewerId === buyerId) {
      return {
        ...thread,
        me: profileForParticipant(buyerId, buyerName, ""),
        partner: profileForParticipant(sellerId, sellerName, sellerAvatar),
      };
    }

    return {
      ...thread,
      me: profileForParticipant(viewerId),
      partner: thread.partner,
    };
  }

  function toChatServiceThread(row) {
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
    const base = {
      id: row.id,
      listing: {
        id: row.listingId,
        type: row.listingType,
        title: row.listingTitle,
        detailUrl: row.detailUrl,
        category: row.category,
        image: row.image,
      },
      partner: {
        id: row.sellerId,
        displayName: row.sellerName,
        avatarUrl: row.image || "",
      },
      buyerId: row.buyerId,
      sellerId: row.sellerId,
      listingId: row.listingId,
      listingType: row.listingType,
      listingTitle: row.listingTitle,
      applicationId: row.applicationId,
      completionRequestedBy: row.completionRequestedBy,
      completionRequestedAt: row.completionRequestedAt,
      completionApprovedBy: row.completionApprovedBy,
      completedAt: row.completedAt,
      me: {
        id: row.buyerId,
        displayName: row.buyerName,
      },
      status: row.status === "open" ? "active" : row.status,
      roomStatus:
        row.roomStatus ||
        (row.status === "completed" ||
        row.status === "cancelled" ||
        row.status === "completion_pending" ||
        row.status === "fee_pending"
          ? row.status
          : "active"),
      expiresAt,
      lastReadAt: row.updatedAt,
      lastMessagePreview: row.lastMessage,
      _sortAt: row.updatedAt,
      unreadCount: Math.max(0, Number(row.unreadCount) || 0),
      _localConsult: !row._officialRoom,
      _detailUrl: row.detailUrl,
      _category: row.category,
      _listingImage: row.image,
      chatDomain: pickStr(row.chatDomain) || (row._officialRoom ? "friend" : "work"),
      threadKind: pickStr(row.threadKind) || (row._officialRoom ? "official" : "listing_inquiry"),
      partnerUserId: row.partnerUserId || row.sellerId,
      listingTitle: row.listingTitle,
      _officialRoom: Boolean(row._officialRoom),
      _talkChannel: pickStr(row._talkChannel) || "",
      source: pickStr(row.source) || "",
      platformStartPhase: pickStr(row.platformStartPhase),
      platformContactKind: pickStr(row.platformContactKind),
      cancelReason: pickStr(row.cancelReason),
      cancelledBy: pickStr(row.cancelledBy),
      cancelledAt: pickStr(row.cancelledAt),
      manualDepositConfirmedBy: pickStr(row.manualDepositConfirmedBy),
      manualDepositConfirmedAt: pickStr(row.manualDepositConfirmedAt),
      paymentMethod: pickStr(row.paymentMethod, row.payment_method, "prepaid"),
      productShipped: Boolean(row.productShipped || row.product_shipped),
      productShippedAt: pickStr(row.productShippedAt, row.product_shipped_at),
      shippingCarrier: pickStr(row.shippingCarrier, row.shipping_carrier),
      trackingNumber: pickStr(row.trackingNumber, row.tracking_number),
      productReceived: Boolean(row.productReceived || row.product_received),
      productReceivedAt: pickStr(row.productReceivedAt, row.product_received_at),
      completed: Boolean(row.completed),
      completedAt: pickStr(row.completedAt, row.completed_at),
      shippingReady: Boolean(row.shippingReady || row.shipping_ready),
      shippingReadyAt: pickStr(row.shippingReadyAt, row.shipping_ready_at),
      bankTransferReported: Boolean(row.bankTransferReported || row.bank_transfer_reported),
      bankTransferReportedAt: pickStr(row.bankTransferReportedAt, row.bank_transfer_reported_at),
      paymentConfirmed: Boolean(row.paymentConfirmed || row.payment_confirmed),
      paymentConfirmedAt: pickStr(row.paymentConfirmedAt, row.payment_confirmed_at),
      codPaymentReported: Boolean(row.codPaymentReported || row.cod_payment_reported),
      codPaymentReportedAt: pickStr(row.codPaymentReportedAt, row.cod_payment_reported_at),
      cashOnDeliveryConfirmed: Boolean(row.cashOnDeliveryConfirmed || row.cash_on_delivery_confirmed),
      cashOnDeliveryConfirmedAt: pickStr(
        row.cashOnDeliveryConfirmedAt,
        row.cash_on_delivery_confirmed_at
      ),
    };
    return global.TasuTalkChatThreadModel?.enrichThread?.(base) || base;
  }

  function isHiddenFromChatList(row) {
    if (!row || typeof row !== "object") return false;
    const Gate = global.TasuPlatformChatContactGate;
    if (Gate?.shouldBlockChatDetailAccess) {
      return Gate.shouldBlockChatDetailAccess(toChatServiceThread(row)) === true;
    }
    const rs = String(row.status || "").toLowerCase();
    if (rs !== "fee_pending") return false;
    const Fee = global.TasuPlatformChatFee;
    const threadId = pickStr(row.id);
    if (threadId && Fee?.isFeePaid?.(threadId)) return false;
    const listing = { id: row.listingId, listing_type: row.listingType };
    const cat = Fee?.resolveCategoryKey?.(listing);
    if (!cat) return false;
    if (Fee?.hasStripeConnect?.(listing, cat)) return false;
    return Fee?.isJobCategory?.(cat) || Fee?.isFeeApplicableCategory?.(cat);
  }

  function getAllForChatList() {
    return readAll()
      .filter((row) => !isHiddenFromChatList(row))
      .slice()
      .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
      .map(toChatServiceThread);
  }

  function loadRoom(roomId, options) {
    const id = String(roomId || "").trim();
    const row = readAll().find((t) => String(t.id) === id);
    if (!row) return null;
    const thread = applyViewerToThread(
      toChatServiceThread(row),
      options?.viewerUserId,
      row
    );
    const messages = getMessages(id).map((m) => ({
      ...m,
      chatId: id,
      roomId: pickStr(m.roomId, m.chatId, id),
      kind: m.kind || "text",
    }));
    return { thread, messages };
  }

  function chatListUrl(threadId) {
    if (global.TasuTalkChatEntryUrl?.buildTalkChatHubUrl) {
      return global.TasuTalkChatEntryUrl.buildTalkChatHubUrl({ threadId });
    }
    const id = String(threadId || "").trim();
    if (!id) return "talk-home.html?tab=chat";
    return `talk-home.html?tab=chat&thread=${encodeURIComponent(id)}`;
  }

  function chatDetailUrl(threadId, options) {
    const id = String(threadId || "").trim();
    if (!id) return "chat-detail.html";
    try {
      const u = new URL("chat-detail.html", global.location.href);
      if (isUuidThreadId(id)) {
        u.searchParams.set("roomId", id);
        u.searchParams.set("room", id);
      } else {
        u.searchParams.set("thread", id);
      }
      const from = String(options?.from || "").trim();
      if (from) u.searchParams.set("from", from);
      return u.pathname + u.search;
    } catch {
      if (isUuidThreadId(id)) {
        let url = `chat-detail.html?room=${encodeURIComponent(id)}&roomId=${encodeURIComponent(id)}`;
        const from = String(options?.from || "").trim();
        if (from) url += `&from=${encodeURIComponent(from)}`;
        return url;
      }
      let url = `chat-detail.html?thread=${encodeURIComponent(id)}`;
      const from = String(options?.from || "").trim();
      if (from) url += `&from=${encodeURIComponent(from)}`;
      return url;
    }
  }

  function appendChatDetailFromParam(href, from) {
    const raw = String(href || "").trim();
    const fromVal = String(from || "").trim();
    if (!raw || !fromVal || !/chat-detail\.html/i.test(raw)) return raw;
    try {
      const u = new URL(raw, global.location.href);
      u.searchParams.set("from", fromVal);
      return `${u.pathname}${u.search}${u.hash}`;
    } catch {
      const hashIdx = raw.indexOf("#");
      const base = hashIdx >= 0 ? raw.slice(0, hashIdx) : raw;
      const hash = hashIdx >= 0 ? raw.slice(hashIdx) : "";
      const sep = base.includes("?") ? "&" : "?";
      return `${base}${sep}from=${encodeURIComponent(fromVal)}${hash}`;
    }
  }

  function readBenchThreadParticipantIds(row) {
    const raw = row?.participantIds || row?.threadParticipants || row?.participants || [];
    if (!Array.isArray(raw)) return [];
    return raw.map((p) => String(p?.id || p?.userId || p || "").trim()).filter(Boolean);
  }

  function isBenchJobChatThreadRow(row, opts) {
    const id = String(row?.id || "");
    if (!/^chat-/i.test(id)) return false;
    const benchUsers = new Set(
      (opts?.participantIds || ["u_job_demo_full", "u_hiro"])
        .map((u) => String(u || "").trim())
        .filter(Boolean)
    );
    const participants = readBenchThreadParticipantIds(row);
    if (participants.some((p) => benchUsers.has(p))) return true;
    const seller = pickStr(row.sellerId, row.partnerUserId, row.posterUserId);
    const buyer = pickStr(row.buyerId, row.applicantUserId);
    return (seller && benchUsers.has(seller)) || (buyer && benchUsers.has(buyer));
  }

  function shouldPurgeBenchListingThread(row, listingIds, opts) {
    const lidSet = new Set((listingIds || []).map((id) => String(id || "").trim()).filter(Boolean));
    const id = String(row?.id || "");
    const lid = pickStr(row.listingId, row.listing_id);
    const aid = pickStr(row.applicationId, row.application_id);
    const kind = String(row.threadKind || "");
    const staleThreadIds = new Set(
      (opts?.staleThreadIds || []).map((v) => String(v || "").trim()).filter(Boolean)
    );
    const staleRunTokens = new Set(
      (opts?.staleResetTokens || []).map((v) => String(v || "").trim()).filter(Boolean)
    );

    if (staleThreadIds.has(id)) return true;
    if (aid && /^job-app-/i.test(aid) && (!lidSet.size || !lid || lidSet.has(lid))) return true;
    if (isBenchJobChatThreadRow(row, opts) && (!lidSet.size || !lid || lidSet.has(lid))) return true;
    if (!lidSet.size || !lid || !lidSet.has(lid)) return false;

    if (opts.allKinds === true) return true;
    const purgeKinds = opts.kinds || ["job_hire", "listing_inquiry", "worker_request"];
    if (!kind || purgeKinds.includes(kind)) return true;

    const hay = `${id} ${pickStr(row.roomId)} ${pickStr(row.href)}`;
    for (const token of staleRunTokens) {
      if (token && hay.includes(token)) return true;
    }
    return false;
  }

  /** ベンチ再実行 — listing / chat-* / job-app-* に紐づく thread を削除 */
  function purgeBenchListingThreads(listingIds, options) {
    const opts = options || {};
    const removedIds = [];
    const keep = readAll().filter((row) => {
      if (!shouldPurgeBenchListingThread(row, listingIds, opts)) return true;
      removedIds.push(String(row.id));
      return false;
    });
    writeAll(keep);
    if (removedIds.length && MESSAGES_KEY) {
      try {
        const raw = global.localStorage.getItem(MESSAGES_KEY);
        const map = raw ? JSON.parse(raw) : {};
        removedIds.forEach((id) => {
          delete map[id];
        });
        global.localStorage.setItem(MESSAGES_KEY, JSON.stringify(map));
      } catch {
        /* ignore */
      }
    }
    return { removedIds, kept: keep.length };
  }

  global.TasuChatThreadStore = {
    STORAGE_KEY,
    MESSAGES_KEY,
    EVENT_NAME,
    readAll,
    writeAll,
    purgeBenchListingThreads,
    findOpenThread,
    findFeePendingThread,
    findHireThread,
    threadExists,
    roomExists,
    resolveThreadAccess,
    ensureChatThreadForAcceptedJob,
    ensureListingPurchaseThreadAccess,
    restoreListingPurchaseThreadAtId,
    findWorkerRequestThread,
    findContactThread,
    createOrOpenThread,
    createThreadFromContact,
    createThreadFromContactAsync,
    activateThreadAfterFeePaid,
    activateThreadAfterFeePaidAsync,
    createHireThread,
    createHireThreadAsync,
    createWorkerRequestThread,
    createWorkerRequestThreadAsync,
    isUuidThreadId,
    isLegacyLsThreadId,
    getAllForChatList,
    loadRoom,
    applyViewerToThread,
    getMessages,
    appendMessage,
    readMessagesMap,
    writeMessagesMap,
    mergeMessagesMap,
    chatListUrl,
    chatDetailUrl,
    appendChatDetailFromParam,
    resolveListingTypeKey,
    resolveInitialMessage,
    buildDetailUrl,
  };
})(typeof window !== "undefined" ? window : globalThis);
