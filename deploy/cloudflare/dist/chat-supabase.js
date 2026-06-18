/**
 * Supabase データ層（transaction_rooms / transaction_messages / transaction_reads）
 */
(function () {
  "use strict";

  /** @type {import('@supabase/supabase-js').SupabaseClient|null} */
  let client = null;
  /** @type {import('@supabase/supabase-js').RealtimeChannel|null} */
  let roomDetailChannel = null;
  /** @type {import('@supabase/supabase-js').RealtimeChannel|null} */
  let listMessagesChannel = null;

  function normalizeRoomId(roomId) {
    const raw = String(roomId || "").trim();
    if (!raw) return "";
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }

  const LOCAL_CHAT_STORAGE_KEY = "tasu_chat_seed_v1";
  const LEGACY_CHAT_STORAGE_KEY = "tasu_chat_seed";

  function isLocalRoomId(roomId) {
    return /^local-room-/i.test(normalizeRoomId(roomId));
  }

  function safeJsonParse(text, fallback) {
    try {
      return JSON.parse(text);
    } catch {
      return fallback;
    }
  }

  function normalizeLocalChatSeed(seed) {
    const base = seed && typeof seed === "object" ? seed : {};
    if (!Array.isArray(base.threads)) base.threads = [];
    if (!base.messagesByChatId) base.messagesByChatId = {};
    if (!base.lastSeenByChatId) base.lastSeenByChatId = {};
    return base;
  }

  function readLocalChatSeed() {
    mergeLegacyLocalChatSeed();
    const raw = localStorage.getItem(LOCAL_CHAT_STORAGE_KEY);
    if (raw) {
      return normalizeLocalChatSeed(safeJsonParse(raw, null));
    }
    return { threads: [], messagesByChatId: {}, lastSeenByChatId: {} };
  }

  function writeLocalChatSeed(seed) {
    localStorage.setItem(LOCAL_CHAT_STORAGE_KEY, JSON.stringify(normalizeLocalChatSeed(seed)));
  }

  function mergeLegacyLocalChatSeed() {
    try {
      const legacyRaw = localStorage.getItem(LEGACY_CHAT_STORAGE_KEY);
      if (!legacyRaw) return;
      const legacy = normalizeLocalChatSeed(safeJsonParse(legacyRaw, null));
      const currentRaw = localStorage.getItem(LOCAL_CHAT_STORAGE_KEY);
      const current = currentRaw
        ? normalizeLocalChatSeed(safeJsonParse(currentRaw, null))
        : { threads: [], messagesByChatId: {}, lastSeenByChatId: {} };
      const ids = new Set(current.threads.map((t) => String(t.id)));
      for (const t of legacy.threads) {
        if (!ids.has(String(t.id))) {
          current.threads.push(t);
          ids.add(String(t.id));
        }
      }
      for (const [chatId, msgs] of Object.entries(legacy.messagesByChatId || {})) {
        if (!Array.isArray(current.messagesByChatId[chatId]) || !current.messagesByChatId[chatId].length) {
          current.messagesByChatId[chatId] = msgs;
        }
      }
      Object.assign(current.lastSeenByChatId, legacy.lastSeenByChatId || {});
      writeLocalChatSeed(current);
    } catch (err) {
      console.warn("[TasuChat] mergeLegacyLocalChatSeed failed:", err);
    }
  }

  function fetchLocalThreadById(roomId) {
    const id = normalizeRoomId(roomId);
    if (!id) return null;
    const seed = readLocalChatSeed();
    return (
      (seed.threads || []).find((t) => String(t.id) === id) ||
      (seed.threads || []).find((t) => String(t.id) === roomId) ||
      null
    );
  }

  function localThreadToRoomRow(thread) {
    if (!thread) return null;
    return {
      id: thread.id,
      listing_id: thread.listing?.id || "",
      listing_type: thread.listing?.type || "business",
      title: thread.listing?.title || thread.partner?.displayName || "",
      buyer_id: thread.buyerId || thread.buyer_id || "",
      seller_id: thread.sellerId || thread.seller_id || "",
      partner_id: thread.partner?.id || thread.partner_id || "",
      partner_display_name: thread.partner?.displayName || thread.partner_display_name || "",
      expires_at: thread.expiresAt || thread.expires_at || "",
      status: thread.roomStatus || thread.status || "active",
      service_deal_id: thread.serviceDealId || thread.service_deal_id || null,
      updated_at: thread.updatedAt || thread.updated_at || nowIso(),
    };
  }

  function loadLocalRoomMessages(roomId) {
    const id = normalizeRoomId(roomId);
    const thread = fetchLocalThreadById(id);
    const seed = readLocalChatSeed();
    const messages = seed.messagesByChatId?.[id] || seed.messagesByChatId?.[roomId] || [];
    if (!thread) {
      return { thread: null, messages: [] };
    }
    const roomStatus =
      thread.roomStatus ||
      (thread.status === "completed" || thread.status === "cancelled" ? thread.status : "active");
    const lifecycle =
      window.TasuChatRoomStatus?.resolveRoomLifecycleStatus?.({
        ...thread,
        roomStatus,
        expiresAt: thread.expiresAt,
      }) || roomStatus;
    return {
      thread: {
        ...thread,
        buyerId: thread.buyerId || thread.buyer_id || "",
        sellerId: thread.sellerId || thread.seller_id || "",
        roomStatus,
        status: lifecycle,
      },
      messages,
    };
  }

  function insertLocalRoomMessage(roomId, messageInput) {
    const id = normalizeRoomId(roomId);
    const seed = readLocalChatSeed();
    const thread = fetchLocalThreadById(id);
    if (!thread) {
      throw new Error("local room not found");
    }
    const rawText = String(messageInput.text ?? "");
    const attachment = messageInput.attachment;
    const hasAttachment = Boolean(attachment?.dataUrl);
    const isSystemSender = String(messageInput.senderId || "").trim() === "__system__";
    if (!rawText.trim() && !hasAttachment && !isSystemSender) {
      throw new Error("message is empty");
    }
    const text = rawText;
    const msg = {
      id: `m_${Math.random().toString(16).slice(2)}_${Date.now()}`,
      roomId: id,
      senderId: messageInput.senderId,
      senderName: messageInput.senderName || (isSystemSender ? "TASFUL" : ""),
      senderAvatarUrl: messageInput.senderAvatarUrl,
      text,
      createdAt: nowIso(),
      kind: messageInput.kind || (isSystemSender ? "system" : hasAttachment ? "mixed" : "text"),
      attachment: hasAttachment
        ? { name: attachment.name || "image", dataUrl: attachment.dataUrl }
        : null,
    };
    if (!seed.messagesByChatId[id]) {
      seed.messagesByChatId[id] = [];
    }
    seed.messagesByChatId[id].push(msg);
    if (!seed.lastSeenByChatId) seed.lastSeenByChatId = {};
    seed.lastSeenByChatId[id] = msg.createdAt;
    const threadIdx = (seed.threads || []).findIndex((t) => String(t.id) === id);
    if (threadIdx >= 0) {
      const preview = String(text || "（システム）").trim().slice(0, 160);
      seed.threads[threadIdx] = {
        ...seed.threads[threadIdx],
        updatedAt: msg.createdAt,
        updated_at: msg.createdAt,
        lastMessagePreview: preview,
      };
    }
    writeLocalChatSeed(seed);
    return msg;
  }

  function touchLocalRoomActivity(roomId, previewText) {
    const id = normalizeRoomId(roomId);
    if (!id) return;
    const seed = readLocalChatSeed();
    const at = nowIso();
    const preview = String(previewText || "").trim().slice(0, 160);
    const idx = (seed.threads || []).findIndex((t) => String(t.id) === id);
    if (idx < 0) return;
    seed.threads[idx] = {
      ...seed.threads[idx],
      updatedAt: at,
      updated_at: at,
      ...(preview ? { lastMessagePreview: preview } : {}),
    };
    writeLocalChatSeed(seed);
  }

  function markLocalRoomReadNow(roomId) {
    const id = normalizeRoomId(roomId);
    const at = nowIso();
    const seed = readLocalChatSeed();
    if (!seed.lastSeenByChatId) seed.lastSeenByChatId = {};
    seed.lastSeenByChatId[id] = at;
    writeLocalChatSeed(seed);
    return at;
  }

  function completeLocalTransactionRoom(roomId) {
    const id = normalizeRoomId(roomId);
    const seed = readLocalChatSeed();
    const thread = fetchLocalThreadById(id);
    if (!thread) {
      throw new Error("local room not found");
    }
    thread.roomStatus = "completed";
    thread.status = "completed";
    const idx = (seed.threads || []).findIndex((t) => String(t.id) === id);
    if (idx >= 0) {
      seed.threads[idx] = thread;
    }
    writeLocalChatSeed(seed);
    return {
      ...thread,
      status:
        window.TasuChatRoomStatus?.resolveRoomLifecycleStatus?.(thread) || "completed",
    };
  }

  function getConfig() {
    return window.TASU_CHAT_SUPABASE_CONFIG || {};
  }

  function getCurrentUserId() {
    if (window.TasuChatUserIdentity?.getEffectiveUserId) {
      return window.TasuChatUserIdentity.getEffectiveUserId();
    }
    return getConfig().currentUserId || getConfig().me?.id || "u_me";
  }

  function getMeProfile() {
    if (window.TasuChatUserIdentity?.getEffectiveMeProfile) {
      return window.TasuChatUserIdentity.getEffectiveMeProfile();
    }
    const cfg = getConfig();
    return (
      cfg.me || {
        id: getCurrentUserId(),
        displayName: "あなた",
        avatarUrl: "https://placehold.co/64x64/f3ead4/967622?text=ME",
      }
    );
  }

  const MESSAGE_SELECT =
    "id, room_id, sender_id, message, image_url, created_at";

  function logSupabaseError(context, error) {
    console.error(`[TasuChat] ${context}`, {
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
    });
  }

  function pick(row, keys, fallback = "") {
    if (!row) return fallback;
    for (const key of keys) {
      const value = row[key];
      if (value != null && value !== "") return String(value);
    }
    return fallback;
  }

  function resolveListingTitle(room) {
    const listingId = pick(room, ["listing_id"]);
    const title = pick(room, ["title", "listing_title", "deal_title"]);
    const Model = window.TasuTalkChatThreadModel;
    if (Model?.resolveListingDisplayTitle) {
      return Model.resolveListingDisplayTitle({
        listing: { id: listingId, title, type: pick(room, ["listing_type"]) },
        listingId,
        title,
      });
    }
    if (title && title !== listingId) return title;
    const catalog = window.TasuChatDisplayCatalog?.resolveListing?.(listingId);
    if (catalog?.title) return catalog.title;
    return listingId || "（案件名未設定）";
  }

  function resolvePartner(room) {
    const meId = getCurrentUserId();
    const displayName = pick(room, ["partner_display_name", "counterparty_name"]);
    const buyerId = room.buyer_id != null && room.buyer_id !== "" ? String(room.buyer_id) : "";
    const sellerId = room.seller_id != null && room.seller_id !== "" ? String(room.seller_id) : "";

    let partnerId = pick(room, ["partner_id"]);
    if (!partnerId) {
      if (buyerId && buyerId !== meId) partnerId = buyerId;
      else if (sellerId && sellerId !== meId) partnerId = sellerId;
      else partnerId = sellerId || buyerId || "partner";
    }

    const Model = window.TasuTalkChatThreadModel;
    const resolvedName = Model?.resolvePartnerDisplayName
      ? Model.resolvePartnerDisplayName(
          {
            partner: {
              id: partnerId,
              displayName,
              display_name: displayName,
              avatar_url: pick(room, ["partner_avatar_url"]),
            },
            partner_display_name: displayName,
            listing: {
              id: pick(room, ["listing_id"]),
              type: pick(room, ["listing_type"]),
              title: pick(room, ["title", "listing_title"]),
            },
            buyerId,
            sellerId,
          },
          partnerId
        )
      : displayName || partnerId;

    return {
      id: String(partnerId),
      displayName: String(resolvedName),
      avatarUrl: pick(room, ["partner_avatar_url"], "https://placehold.co/64x64/f3ead4/967622?text=P"),
    };
  }

  function formatMessagePreview(row) {
    if (!row) return "";
    if (row.image_url) return "📎 画像";
    return String(row.message || "").trim();
  }

  function mapMessageRow(row, enrich) {
    const imageUrl = row.image_url || null;
    const text = String(row.message ?? "").trim();
    const roomId = String(row.room_id);
    return {
      id: String(row.id),
      roomId,
      senderId: row.sender_id,
      senderName: enrich?.senderName || "",
      senderAvatarUrl: enrich?.senderAvatarUrl || "",
      text,
      createdAt: row.created_at,
      kind: imageUrl ? (text ? "mixed" : "image") : "text",
      attachment: imageUrl
        ? {
            name: enrich?.attachmentName || "image",
            dataUrl: imageUrl,
          }
        : null,
    };
  }

  function mapRoomToThread(room, readRow, meta) {
    const partner = resolvePartner(room);
    const expiresAt =
      room.expires_at != null && room.expires_at !== "" ? String(room.expires_at) : "";

    const threadBase = {
      id: String(room.id),
      listing: {
        id: pick(room, ["listing_id"]),
        type: pick(room, ["listing_type"]),
        title: resolveListingTitle(room),
      },
      partner,
      buyerId: pick(room, ["buyer_id"]),
      sellerId: pick(room, ["seller_id"]),
      contactKind: pick(room, ["contact_kind", "platform_contact_kind"]),
      platformContactKind: pick(room, ["platform_contact_kind", "contact_kind"]),
      listing_type: pick(room, ["listing_type"]),
      me: getMeProfile(),
      expiresAt,
      roomStatus: room.status != null && room.status !== "" ? String(room.status) : "active",
      lastReadAt: readRow?.last_read_at || "",
      unreadCount: meta?.unreadCount ?? 0,
      lastMessagePreview: meta?.lastMessagePreview ?? "",
      remainingLabel: meta?.remainingLabel ?? "",
    };

    const lifecycle =
      window.TasuChatRoomStatus?.resolveRoomLifecycleStatus?.(threadBase) || threadBase.status;
    return {
      ...threadBase,
      status: lifecycle,
    };
  }

  /**
   * 取引完了: status = completed
   * @param {string} roomId
   */
  async function completeTransactionRoom(roomId) {
    const id = normalizeRoomId(roomId);
    if (!id) {
      throw new Error("roomId is required");
    }
    if (isLocalRoomId(id)) {
      return completeLocalTransactionRoom(id);
    }

    const sb = getClient();
    const now = nowIso();
    const { data, error } = await sb
      .from("transaction_rooms")
      .update({ status: "completed", updated_at: now })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      logSupabaseError("complete transaction_rooms", error);
      throw error;
    }

    return mapRoomRowToThread(data);
  }

  async function countReportsForRoom(roomId) {
    const id = normalizeRoomId(roomId);
    if (!id) return 0;

    const sb = getClient();
    const { count, error } = await sb
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("room_id", id);

    if (error) {
      logSupabaseError("count reports by room", error);
      return 0;
    }
    return count ?? 0;
  }

  /**
   * @param {{ roomId: string, reviewerId: string, reviewedUserId: string, rating?: number|null, comment?: string, isSkipped?: boolean }} input
   */
  async function insertReview(input) {
    const roomId = normalizeRoomId(input.roomId);
    if (!roomId || !input.reviewerId || !input.reviewedUserId) {
      throw new Error("review insert: missing required fields");
    }

    const sb = getClient();
    const row = {
      room_id: roomId,
      reviewer_id: String(input.reviewerId),
      reviewed_user_id: String(input.reviewedUserId),
      comment: input.comment ? String(input.comment).trim() : null,
      is_skipped: Boolean(input.isSkipped),
      rating: input.isSkipped ? null : input.rating ?? null,
    };

    const { data, error } = await sb.from("reviews").insert(row).select("*").single();

    if (error) {
      logSupabaseError("insert reviews", error);
      throw error;
    }
    return data;
  }

  async function fetchReviewScore(userId) {
    const uid = String(userId || "").trim();
    if (!uid) return null;

    const sb = getClient();
    const { data, error } = await sb
      .from("review_scores")
      .select("*")
      .eq("user_id", uid)
      .maybeSingle();

    if (error) {
      logSupabaseError("fetch review_scores", error);
      throw error;
    }
    return data;
  }

  /**
   * reviews 保存後に review_scores を更新
   */
  async function upsertReviewScoresAfterReview(reviewedUserId, reviewInput) {
    const uid = String(reviewedUserId || "").trim();
    if (!uid) throw new Error("reviewedUserId is required");

    const compute = window.TasuChatReviews?.computeReviewScoreUpdate;
    if (!compute) throw new Error("TasuChatReviews.computeReviewScoreUpdate missing");

    const existing = await fetchReviewScore(uid);
    const next = compute(existing, {
      rating: reviewInput.rating,
      isSkipped: Boolean(reviewInput.isSkipped),
    });

    const sb = getClient();
    const { data, error } = await sb
      .from("review_scores")
      .upsert({
        user_id: uid,
        average_rating: next.average_rating,
        total_reviews: next.total_reviews,
        skipped_reviews: next.skipped_reviews,
        updated_at: nowIso(),
      })
      .select("*")
      .single();

    if (error) {
      logSupabaseError("upsert review_scores", error);
      throw error;
    }
    return data;
  }

  function isConfigured() {
    return window.TasuSupabase?.isConfigured?.() || false;
  }

  async function init() {
    if (!isConfigured()) {
      throw new Error("Supabase is not configured");
    }
    client = window.TasuSupabase.getClient();
    if (!client) {
      throw new Error("Supabase client could not be created");
    }

    const { error } = await client.from("transaction_rooms").select("id").limit(1);
    if (error) {
      logSupabaseError("init transaction_rooms", error);
      throw error;
    }
    return true;
  }

  function getClient() {
    const shared = window.TasuSupabase?.getClient?.();
    if (shared) {
      client = shared;
      return shared;
    }
    if (!client) {
      throw new Error("Supabase client is not initialized");
    }
    return client;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  /**
   * 未読: created_at > last_read_at かつ sender_id !== currentUserId
   * @param {object} row transaction_messages row
   * @param {string} lastReadAtIso transaction_reads.last_read_at
   */
  function isUnreadMessageRow(row, lastReadAtIso) {
    const meId = getCurrentUserId();
    if (String(row.sender_id) === String(meId)) return false;
    const lastReadMs = lastReadAtIso ? new Date(lastReadAtIso).getTime() : 0;
    const created = new Date(row.created_at).getTime();
    return Number.isFinite(created) && created > lastReadMs;
  }

  /**
   * room 内メッセージ（昇順/降順どちらでも可）から未読件数
   */
  function countUnreadInRoomMessages(messages, lastReadAtIso) {
    let count = 0;
    for (const m of messages || []) {
      if (isUnreadMessageRow(m, lastReadAtIso)) count += 1;
    }
    return count;
  }

  /**
   * created_at DESC で取得したメッセージから、room ごとの最新＋未読数を算出
   * @param {Array<any>} messagesDesc
   * @param {Record<string, {last_read_at:string}>} readsMap
   * @param {string[]} roomIds
   */
  function buildRoomsMessageMeta(messagesDesc, readsMap, roomIds) {
    /** @type {Record<string, any>} */
    const latestByRoom = {};
    /** @type {Record<string, number>} */
    const unreadByRoom = {};

    for (const m of messagesDesc || []) {
      const rid = String(m.room_id);
      if (!latestByRoom[rid]) {
        latestByRoom[rid] = m;
      }

      const readAtIso = readsMap[rid]?.last_read_at || "";
      if (isUnreadMessageRow(m, readAtIso)) {
        unreadByRoom[rid] = (unreadByRoom[rid] || 0) + 1;
      }
    }

    /** @type {Record<string, {unreadCount:number, lastMessagePreview:string}>} */
    const metaByRoom = {};
    for (const rid of roomIds) {
      metaByRoom[rid] = {
        unreadCount: unreadByRoom[rid] || 0,
        lastMessagePreview: formatMessagePreview(latestByRoom[rid]),
      };
    }
    return metaByRoom;
  }

  /**
   * 相手の既読時刻（transaction_reads.last_read_at）
   * 行が無い場合は空文字（未読表示なし）
   */
  async function fetchReadAtByRoomAndUser(roomId, userId) {
    const id = normalizeRoomId(roomId);
    const uid = String(userId || "").trim();
    if (!id || !uid) return "";

    const sb = getClient();
    try {
      const { data, error } = await sb
        .from("transaction_reads")
        .select("last_read_at")
        .eq("room_id", id)
        .eq("user_id", uid)
        .maybeSingle();

      if (error) {
        logSupabaseError("fetch transaction_reads by user", error);
        return "";
      }
      return data?.last_read_at || "";
    } catch (err) {
      logSupabaseError("fetch transaction_reads by user (exception)", err);
      return "";
    }
  }

  /** message.created_at <= partnerLastReadAt なら既読 */
  function isMessageReadByPartner(createdAtIso, partnerLastReadAtIso) {
    if (!partnerLastReadAtIso) return false;
    const readMs = new Date(partnerLastReadAtIso).getTime();
    const createdMs = new Date(createdAtIso).getTime();
    if (!Number.isFinite(readMs) || !Number.isFinite(createdMs)) return false;
    return createdMs <= readMs;
  }

  /** 最新の自分メッセージのみ既読ラベル対象（Slack / LINE風） */
  function getReadReceiptMessageId(messages, meId, partnerLastReadAtIso) {
    let latestOwn = null;
    let latestMs = -Infinity;

    for (const m of messages || []) {
      if (String(m.senderId) !== String(meId)) continue;
      const createdMs = new Date(m.createdAt).getTime();
      if (!Number.isFinite(createdMs)) continue;
      if (createdMs >= latestMs) {
        latestMs = createdMs;
        latestOwn = m;
      }
    }

    if (!latestOwn) return null;
    if (isMessageReadByPartner(latestOwn.createdAt, partnerLastReadAtIso)) {
      return String(latestOwn.id);
    }
    return null;
  }

  async function fetchReadsByRoomIds(roomIds) {
    if (!roomIds.length) return {};
    const sb = getClient();
    const userId = getCurrentUserId();
    try {
      const { data, error } = await sb
        .from("transaction_reads")
        .select("room_id, last_read_at")
        .eq("user_id", userId)
        .in("room_id", roomIds);

      if (error) {
        logSupabaseError("fetch transaction_reads", error);
        return {};
      }

      /** @type {Record<string, {last_read_at:string}>} */
      const map = {};
      for (const row of data || []) {
        map[String(row.room_id)] = row;
      }
      return map;
    } catch (err) {
      logSupabaseError("fetch transaction_reads (exception)", err);
      return {};
    }
  }

  function registerLocalConsultRoom(thread, messages) {
    try {
      mergeLegacyLocalChatSeed();
      const seed = readLocalChatSeed();
      seed.threads = (seed.threads || []).filter((t) => String(t.id) !== String(thread.id));
      seed.threads.unshift(thread);
      if (!seed.messagesByChatId) seed.messagesByChatId = {};
      seed.messagesByChatId[String(thread.id)] = messages || [];
      writeLocalChatSeed(seed);
    } catch (err) {
      console.warn("[TasuChat] registerLocalConsultRoom failed:", err);
    }
  }

  /**
   * 業務サービス: 相談チャットルーム作成
   */
  async function createBusinessConsultRoom({ listing, deal }) {
    const sb = getClient();
    const serviceId = String(
      listing?.id || listing?.demo_id || listing?.form_data?.demo_id || ""
    ).trim();
    const clientId = getCurrentUserId();
    const providerId = String(
      listing?.user_id || listing?.seller_user_id || `provider_${serviceId}`
    ).trim();
    const company = String(
      listing?.company_name ||
        listing?.category_extra?.shop_store?.shop_name ||
        listing?.title ||
        "掲載者"
    ).trim();
    const title = String(listing?.title || company || "業務サービス相談").trim();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();

    const payload = {
      listing_id: serviceId,
      listing_type: "business",
      title: `【業務】${title}`,
      buyer_id: clientId,
      seller_id: providerId,
      partner_id: providerId,
      partner_display_name: company,
      expires_at: expiresAt,
      status: "active",
    };

    const dealId = String(deal?.id || "").trim();
    if (dealId && !dealId.startsWith("local-")) {
      payload.service_deal_id = dealId;
    }

    if (sb && window.location.protocol !== "file:") {
      const { data, error } = await sb
        .from("transaction_rooms")
        .insert(payload)
        .select("*")
        .single();
      if (!error && data) {
        return { id: String(data.id), row: data };
      }
      if (error) logSupabaseError("createBusinessConsultRoom", error);
    }

    const localId = `local-room-${Date.now()}`;
    const thread = {
      id: localId,
      listing: { id: serviceId, type: "business", title },
      partner: {
        id: providerId,
        displayName: company,
        avatarUrl: "https://placehold.co/64x64/f3ead4/967622?text=B",
      },
      buyerId: clientId,
      sellerId: providerId,
      me: getMeProfile(),
      status: "active",
      expiresAt,
      lastReadAt: new Date().toISOString(),
      unreadCount: 0,
      serviceDealId: dealId,
    };
    registerLocalConsultRoom(thread, []);
    return { id: localId, row: thread, local: true };
  }

  async function fetchRoomById(roomId) {
    const id = normalizeRoomId(roomId);
    if (!id) return null;
    if (isLocalRoomId(id)) {
      const thread = fetchLocalThreadById(id);
      return thread ? localThreadToRoomRow(thread) : null;
    }
    const sb = getClient();
    const { data, error } = await sb.from("transaction_rooms").select("*").eq("id", id).limit(1);
    if (error) {
      logSupabaseError("fetch transaction_rooms by id", error);
      throw error;
    }
    const row = data?.[0] ?? null;
    if (!row) {
      console.warn("[TasuChat] transaction_rooms not found for roomId:", id);
    }
    return row;
  }

  function mapRoomRowToThread(room) {
    return mapRoomToThread(room, null, { unreadCount: 0, lastMessagePreview: "" });
  }

  /** room ごとの最新メッセージ＋未読集計用（created_at DESC） */
  async function fetchMessagesByRoomIds(roomIds) {
    if (!roomIds.length) return [];
    const sb = getClient();
    const { data, error } = await sb
      .from("transaction_messages")
      .select(MESSAGE_SELECT)
      .in("room_id", roomIds)
      .order("created_at", { ascending: false });

    if (error) {
      logSupabaseError("fetch transaction_messages (rooms)", error);
      throw error;
    }
    return data || [];
  }

  async function loadThreads(formatRemaining, isExpiredFn) {
    const sb = getClient();
    const { data: rooms, error } = await sb
      .from("transaction_rooms")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      logSupabaseError("fetch transaction_rooms (threads)", error);
      throw error;
    }

    const roomList = rooms || [];
    const roomIds = roomList.map((r) => String(r.id));
    const [readsMap, messagesDesc] = await Promise.all([
      fetchReadsByRoomIds(roomIds),
      fetchMessagesByRoomIds(roomIds),
    ]);

    const metaByRoom = buildRoomsMessageMeta(messagesDesc, readsMap, roomIds);

    /** @type {Record<string, string>} */
    const latestCreatedAtByRoom = {};
    for (const m of messagesDesc) {
      const rid = String(m.room_id);
      if (!latestCreatedAtByRoom[rid]) {
        latestCreatedAtByRoom[rid] = m.created_at;
      }
    }

    const threads = roomList.map((room) => {
      const rid = String(room.id);
      const readRow = readsMap[rid];
      const meta = metaByRoom[rid] || { unreadCount: 0, lastMessagePreview: "" };
      const thread = mapRoomToThread(room, readRow, meta);
      const lifecycle =
        window.TasuChatRoomStatus?.resolveRoomLifecycleStatus?.(thread) ||
        (isExpiredFn(thread) ? "expired" : "active");
      return {
        ...thread,
        status: lifecycle,
        remainingLabel: formatRemaining(thread.expiresAt),
        unreadCount: meta.unreadCount,
        lastMessagePreview: meta.lastMessagePreview,
        _sortAt: latestCreatedAtByRoom[rid] || room.updated_at || room.created_at || "",
      };
    });

    threads.sort((a, b) => String(b._sortAt).localeCompare(String(a._sortAt)));

    return threads.map(({ _sortAt, ...thread }) => ({
      ...thread,
      _sortAt,
    }));
  }

  async function loadMessages(roomId) {
    const id = normalizeRoomId(roomId);
    if (!id) {
      return { thread: null, messages: [] };
    }
    if (isLocalRoomId(id)) {
      return loadLocalRoomMessages(id);
    }

    const sb = getClient();
    const [room, messagesResult, readsMap] = await Promise.all([
      fetchRoomById(id).catch((err) => {
        logSupabaseError("fetchRoomById", err);
        return null;
      }),
      sb
        .from("transaction_messages")
        .select(MESSAGE_SELECT)
        .eq("room_id", id)
        .order("created_at", { ascending: true }),
      fetchReadsByRoomIds([id]),
    ]);

    const { data: messages, error: msgError } = messagesResult;
    if (msgError) {
      logSupabaseError("fetch transaction_messages (detail)", msgError);
      throw msgError;
    }

    const messagesAsc = messages || [];
    const messagesDesc = [...messagesAsc].reverse();
    const metaByRoom = buildRoomsMessageMeta(messagesDesc, readsMap, [id]);
    const meta = metaByRoom[id] || { unreadCount: 0, lastMessagePreview: "" };

    let roomRow = room;
    if (!roomRow && messagesAsc.length > 0) {
      roomRow = {
        id,
        listing_id: id,
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      };
    }

    if (!roomRow && messagesAsc.length === 0) {
      return { thread: null, messages: [] };
    }

    const readRow = readsMap[id];
    const thread = mapRoomToThread(roomRow, readRow, meta);

    const me = getMeProfile();
    const partner = thread.partner;
    let partnerLastReadAt = "";
    try {
      partnerLastReadAt = await fetchReadAtByRoomAndUser(id, partner?.id || "");
    } catch (err) {
      logSupabaseError("fetch partner last_read_at (detail)", err);
    }

    return {
      thread: {
        ...thread,
        partnerLastReadAt,
      },
      messages: messagesAsc.map((row) => {
        const isMe = String(row.sender_id) === getCurrentUserId();
        return mapMessageRow(row, {
          senderName: isMe ? me.displayName : partner.displayName,
          senderAvatarUrl: isMe ? me.avatarUrl : partner.avatarUrl,
        });
      }),
    };
  }

  async function insertMessage(roomId, messageInput) {
    const id = normalizeRoomId(roomId);
    if (!id) {
      throw new Error("roomId is required");
    }
    if (isLocalRoomId(id)) {
      return insertLocalRoomMessage(id, messageInput);
    }

    const sb = getClient();
    const rawText = String(messageInput.text ?? "");
    const attachment = messageInput.attachment;
    const hasAttachment = Boolean(attachment?.dataUrl);
    if (!rawText.trim() && !hasAttachment) {
      throw new Error("message is empty");
    }

    const payload = {
      room_id: id,
      sender_id: messageInput.senderId,
      message: rawText,
      image_url: hasAttachment ? attachment.dataUrl : null,
    };

    const { data, error } = await sb
      .from("transaction_messages")
      .insert(payload)
      .select(MESSAGE_SELECT)
      .single();

    if (error) {
      logSupabaseError("insert transaction_messages", error);
      throw error;
    }

    await sb
      .from("transaction_rooms")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", id);

    return mapMessageRow(data, {
      senderName: messageInput.senderName,
      senderAvatarUrl: messageInput.senderAvatarUrl,
      attachmentName: attachment?.name,
    });
  }

  async function upsertRead(roomId, lastReadAt) {
    const id = normalizeRoomId(roomId);
    if (!id) return;

    const sb = getClient();
    const userId = getCurrentUserId();
    const { error } = await sb.from("transaction_reads").upsert(
      {
        room_id: id,
        user_id: userId,
        last_read_at: lastReadAt,
      },
      { onConflict: "room_id,user_id" }
    );

    if (error) {
      logSupabaseError("upsert transaction_reads", error);
      throw error;
    }
  }

  function unsubscribeRoomDetail() {
    if (!client || !roomDetailChannel) {
      roomDetailChannel = null;
      return;
    }
    const channel = roomDetailChannel;
    roomDetailChannel = null;
    client.removeChannel(channel);
  }

  function unsubscribeMessages() {
    unsubscribeRoomDetail();
  }

  function handlePartnerReadPayload(payload, partnerUserId, onPartnerRead) {
    const row = payload?.new;
    if (!row || String(row.user_id) !== String(partnerUserId)) return;
    if (typeof onPartnerRead === "function") {
      onPartnerRead(row.last_read_at || "");
    }
  }

  /**
   * チャット詳細: メッセージ INSERT + 相手の transaction_reads 更新を購読
   * @param {string} roomId
   * @param {string} partnerUserId
   * @param {{ onInsert?: (msg: object) => void, enrich?: (row: object) => object, onPartnerRead?: (lastReadAt: string) => void }} callbacks
   */
  function subscribeRoomDetail(roomId, partnerUserId, callbacks) {
    unsubscribeRoomDetail();

    const id = normalizeRoomId(roomId);
    const partnerId = String(partnerUserId || "").trim();
    if (!id || !client) {
      return () => {};
    }

    const sb = getClient();
    const channelName = `room:${id}`;

    roomDetailChannel = sb
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "transaction_messages",
          filter: `room_id=eq.${id}`,
        },
        (payload) => {
          try {
            const row = payload?.new;
            if (!row || String(row.room_id) !== id) return;
            const enrich =
              typeof callbacks?.enrich === "function" ? callbacks.enrich(row) : {};
            const msg = mapMessageRow(row, enrich);
            callbacks?.onInsert?.(msg);
          } catch (err) {
            logSupabaseError("realtime INSERT handler", err);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "transaction_reads",
          filter: `room_id=eq.${id}`,
        },
        (payload) => {
          try {
            handlePartnerReadPayload(payload, partnerId, callbacks?.onPartnerRead);
          } catch (err) {
            logSupabaseError("realtime reads INSERT handler", err);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "transaction_reads",
          filter: `room_id=eq.${id}`,
        },
        (payload) => {
          try {
            handlePartnerReadPayload(payload, partnerId, callbacks?.onPartnerRead);
          } catch (err) {
            logSupabaseError("realtime reads UPDATE handler", err);
          }
        }
      )
      .subscribe((status, err) => {
        if (err) {
          logSupabaseError(`realtime subscribe (${channelName})`, err);
        }
        if (status === "CHANNEL_ERROR") {
          logSupabaseError(`realtime channel error (${channelName})`, {
            message: "CHANNEL_ERROR",
            details: null,
            hint: null,
            code: status,
          });
        }
      });

    return unsubscribeRoomDetail;
  }

  /** @deprecated subscribeRoomDetail を使用 */
  function subscribeMessages(roomId, callbacks) {
    return subscribeRoomDetail(roomId, callbacks?.partnerUserId, callbacks);
  }

  /** 詳細表示中など: last_read_at を now() で upsert */
  async function markRoomReadNow(roomId) {
    const id = normalizeRoomId(roomId);
    if (!id) return "";
    if (isLocalRoomId(id)) {
      return markLocalRoomReadNow(id);
    }

    const at = nowIso();
    await upsertRead(id, at);
    return at;
  }

  async function markThreadSeen(roomId) {
    return markRoomReadNow(roomId);
  }

  function unsubscribeListMessages() {
    if (!client || !listMessagesChannel) {
      listMessagesChannel = null;
      return;
    }
    const channel = listMessagesChannel;
    listMessagesChannel = null;
    client.removeChannel(channel);
  }

  /**
   * 一覧: 全 room の INSERT を購読（未読バッジ更新用）
   * @param {{ onInsert?: (row: object) => void }} callbacks
   */
  function subscribeListMessages(callbacks) {
    unsubscribeListMessages();
    if (!client) return () => {};

    const sb = getClient();
    const channelName = "transaction_messages:list";

    listMessagesChannel = sb
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "transaction_messages",
        },
        (payload) => {
          try {
            const row = payload?.new;
            if (!row) return;
            callbacks?.onInsert?.(row);
          } catch (err) {
            logSupabaseError("realtime list INSERT handler", err);
          }
        }
      )
      .subscribe((status, err) => {
        if (err) logSupabaseError(`realtime subscribe (${channelName})`, err);
        if (status === "CHANNEL_ERROR") {
          logSupabaseError(`realtime channel error (${channelName})`, {
            message: "CHANNEL_ERROR",
            details: null,
            hint: null,
            code: status,
          });
        }
      });

    return unsubscribeListMessages;
  }

  /**
   * AI審査ログ（blocked / warning のみ想定）
   * @param {{ roomId: string, userId: string, messageText: string, imageUrls: string[], reasons: string[], level: string, allowed: boolean }} entry
   */
  async function insertModerationLog(entry) {
    if (!client) return;

    const sb = getClient();
    const payload = {
      room_id: normalizeRoomId(entry.roomId) || null,
      user_id: String(entry.userId || ""),
      message_text: String(entry.messageText ?? ""),
      image_urls: Array.isArray(entry.imageUrls) ? entry.imageUrls : [],
      reasons: Array.isArray(entry.reasons) ? entry.reasons : [],
      level: String(entry.level || "blocked"),
      allowed: Boolean(entry.allowed),
    };

    const { error } = await sb.from("moderation_logs").insert(payload);
    if (error) {
      throw error;
    }
  }

  /**
   * target_message_id から送信者 sender_id を取得
   * @param {string} messageId
   * @param {string} [roomId]
   */
  async function fetchMessageSenderId(messageId, roomId) {
    const id = String(messageId || "").trim();
    if (!id) return "";

    const sb = getClient();
    let query = sb.from("transaction_messages").select("sender_id").eq("id", id);
    const rid = normalizeRoomId(roomId);
    if (rid) {
      query = query.eq("room_id", rid);
    }

    const { data, error } = await query.maybeSingle();
    if (error) {
      logSupabaseError("fetch transaction_messages sender_id", error);
      throw error;
    }
    return data?.sender_id != null ? String(data.sender_id) : "";
  }

  /**
   * 通報保存（reports）
   * @param {{ roomId: string, reporterId: string, reportedUserId?: string, targetMessageId: string, reason: string, detail?: string }} entry
   */
  async function insertReport(entry) {
    if (!client) return;

    const sb = getClient();
    const roomId = normalizeRoomId(entry.roomId);
    const targetMessageId = String(entry.targetMessageId || "").trim();

    let reportedUserId = String(entry.reportedUserId || "").trim();
    if (!reportedUserId && targetMessageId) {
      reportedUserId = await fetchMessageSenderId(targetMessageId, roomId);
    }
    if (!reportedUserId) {
      throw new Error("reported_user_id could not be resolved from target_message_id");
    }

    const payload = {
      room_id: roomId,
      reporter_id: String(entry.reporterId || ""),
      reported_user_id: reportedUserId,
      target_message_id: targetMessageId,
      reason: String(entry.reason || ""),
      detail: entry.detail ? String(entry.detail) : null,
    };

    const { error } = await sb.from("reports").insert(payload);
    if (error) {
      throw error;
    }
  }

  /**
   * 双方向ブロック判定
   * @returns {{ active: boolean, iBlockedThem: boolean, theyBlockedMe: boolean }}
   */
  async function fetchBlockStatusBetween(userId, partnerId) {
    const me = String(userId || "").trim();
    const partner = String(partnerId || "").trim();
    if (!me || !partner || me === partner) {
      return { active: false, iBlockedThem: false, theyBlockedMe: false };
    }

    const sb = getClient();
    try {
      const { data, error } = await sb
        .from("blocked_users")
        .select("blocker_id, blocked_id")
        .or(
          `and(blocker_id.eq.${me},blocked_id.eq.${partner}),and(blocker_id.eq.${partner},blocked_id.eq.${me})`
        );

      if (error) {
        logSupabaseError("fetch blocked_users", error);
        return { active: false, iBlockedThem: false, theyBlockedMe: false };
      }

      let iBlockedThem = false;
      let theyBlockedMe = false;
      for (const row of data || []) {
        if (String(row.blocker_id) === me && String(row.blocked_id) === partner) {
          iBlockedThem = true;
        }
        if (String(row.blocker_id) === partner && String(row.blocked_id) === me) {
          theyBlockedMe = true;
        }
      }
      return {
        active: iBlockedThem || theyBlockedMe,
        iBlockedThem,
        theyBlockedMe,
      };
    } catch (err) {
      logSupabaseError("fetch blocked_users (exception)", err);
      return { active: false, iBlockedThem: false, theyBlockedMe: false };
    }
  }

  /**
   * @param {{ blockerId: string, blockedId: string, roomId?: string }} entry
   */
  async function insertBlock(entry) {
    if (!client) return;

    const sb = getClient();
    const payload = {
      blocker_id: String(entry.blockerId || ""),
      blocked_id: String(entry.blockedId || ""),
      room_id: normalizeRoomId(entry.roomId) || null,
    };

    const { error } = await sb.from("blocked_users").upsert(payload, {
      onConflict: "blocker_id,blocked_id",
      ignoreDuplicates: false,
    });

    if (error) {
      throw error;
    }
  }

  window.TasuChatSupabase = {
    isConfigured,
    init,
    loadThreads,
    loadMessages,
    insertMessage,
    insertModerationLog,
    insertReport,
    fetchMessageSenderId,
    fetchBlockStatusBetween,
    insertBlock,
    completeTransactionRoom,
    countReportsForRoom,
    insertReview,
    fetchReviewScore,
    upsertReviewScoresAfterReview,
    markThreadSeen,
    markRoomReadNow,
    upsertRead,
    isUnreadMessageRow,
    countUnreadInRoomMessages,
    formatMessagePreview,
    fetchRoomById,
    createBusinessConsultRoom,
    registerLocalConsultRoom,
    touchLocalRoomActivity,
    insertLocalRoomMessage,
    isLocalRoomId,
    mergeLegacyLocalChatSeed,
    loadLocalRoomMessages,
    mapRoomRowToThread,
    normalizeRoomId,
    getCurrentUserId,
    getMeProfile,
    logSupabaseError,
    fetchReadAtByRoomAndUser,
    isMessageReadByPartner,
    getReadReceiptMessageId,
    subscribeRoomDetail,
    subscribeMessages,
    unsubscribeRoomDetail,
    unsubscribeMessages,
    subscribeListMessages,
    unsubscribeListMessages,
    mapMessageRow,
  };
})();
