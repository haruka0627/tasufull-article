/**
 * TASFUL TALK — 公式トーク（通知ミラー）
 * Phase 3: プラット / 安否 / 運営 の3通知ルーム
 */
(function (global) {
  "use strict";

  const THREADS_KEY = "tasful_chat_threads";
  const MESSAGES_KEY = "tasful_chat_messages";
  const LAST_SEEN_KEY = "tasful_official_room_last_seen_v1";
  const SYNC_MARKER = "tasful_official_talk_sync_v1";
  const PHASE3_MARKER = "tasful_official_talk_phase3_v1";
  const NOTIFY_CARD_MARKER = "tasful_official_notify_card_rich_v5";

  const OFFICIAL_PLATFORM = "official_platform";
  const OFFICIAL_ANPI = "official_anpi";
  const OFFICIAL_TASFUL = "official_tasful";

  /** @deprecated Phase 3 — official_platform へ統合 */
  const OFFICIAL_BUILDER = "official_builder";

  const NOTIFICATION_CENTER_ROOM_ORDER = Object.freeze([
    OFFICIAL_PLATFORM,
    OFFICIAL_ANPI,
    OFFICIAL_TASFUL,
  ]);

  /** メッセージ0件でも TALK 一覧に常時出す通知ルーム */
  const ALWAYS_VISIBLE_OFFICIAL_ROOMS = new Set(NOTIFICATION_CENTER_ROOM_ORDER);

  const ROOMS = Object.freeze({
    [OFFICIAL_PLATFORM]: {
      id: OFFICIAL_PLATFORM,
      displayName: "TASFULプラット通知",
      defaultPreview: "求人・スキル・Builder などの取引通知",
      senderId: "__official_platform__",
      senderName: "TASFULプラット通知",
      _talkChannel: "system",
      avatarTone: "blue",
    },
    [OFFICIAL_ANPI]: {
      id: OFFICIAL_ANPI,
      displayName: "TASFUL安否通知",
      defaultPreview: "安否確認・見守りのお知らせ",
      senderId: "__official_anpi__",
      senderName: "TASFUL安否通知",
      _talkChannel: "anpi",
      avatarTone: "rose",
    },
    [OFFICIAL_TASFUL]: {
      id: OFFICIAL_TASFUL,
      displayName: "TASFUL運営通知",
      defaultPreview: "メンテナンス・規約・重要なお知らせ",
      senderId: "__official_tasful__",
      senderName: "TASFUL運営通知",
      _talkChannel: "system",
      avatarTone: "slate",
    },
  });

  const LEGACY_ROOM_ALIASES = Object.freeze({
    [OFFICIAL_BUILDER]: OFFICIAL_PLATFORM,
  });

  const OPS_NOTIFY_IDS = new Set(["platform-verify-official-001", "platform-verify-system-001"]);

  const CATEGORY_PREFIX_MAP = Object.freeze({
    求人: "【求人】",
    スキル: "【スキル】",
    ワーカー: "【ワーカー】",
    業務サービス: "【業務】",
    店舗販売: "【店舗】",
    商品: "【商品】",
    Builder: "【Builder】",
    Connect: "【Connect】",
    安否: "【安否】",
    運営: "【運営】",
    取引: "【取引】",
    レビュー: "【レビュー】",
    公式: "【運営】",
  });

  const BUILDER_TALK_IDS =
    global.TasuTalkBuilderNotifyMaster?.BUILDER_TALK_IDS ||
    new Set([
      "builder-project-new-001",
      "builder-project-invite-001",
      "builder-project-started-001",
      "builder-schedule-changed-001",
      "builder-completion-received-001",
      "builder-invoice-received-001",
      "builder-payment-completed-001",
    ]);

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function normalizeLegacyRoomId(roomId) {
    const id = String(roomId || "").trim();
    return LEGACY_ROOM_ALIASES[id] || id;
  }

  function readMessagesMap() {
    try {
      const raw = global.localStorage.getItem(MESSAGES_KEY);
      const map = raw ? JSON.parse(raw) : {};
      return map && typeof map === "object" ? map : {};
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
    const merged = mergeMessagesMap(readMessagesMap(), map);
    global.localStorage.setItem(MESSAGES_KEY, JSON.stringify(merged));
  }

  function readThreads() {
    try {
      const raw = global.localStorage.getItem(THREADS_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  function writeThreads(list) {
    global.localStorage.setItem(THREADS_KEY, JSON.stringify(Array.isArray(list) ? list : []));
    try {
      global.dispatchEvent(new CustomEvent("tasful-chat-threads-changed"));
    } catch {
      /* ignore */
    }
  }

  function getCurrentUserId() {
    return (
      global.TasuChatUserIdentity?.getEffectiveUserId?.() ||
      global.TASU_CHAT_SUPABASE_CONFIG?.currentUserId ||
      "u_me"
    );
  }

  function getCurrentUserName() {
    const profile =
      global.TasuMemberProfile?.getDisplayProfile?.() || global.TasuMemberAuth?.getLastProfile?.();
    return pickStr(profile?.displayName, profile?.name, profile?.nickname) || "ゲストユーザー";
  }

  function listingCategoryForRoom(roomId) {
    if (roomId === OFFICIAL_PLATFORM) return "platform";
    if (roomId === OFFICIAL_ANPI) return "anpi";
    return "system";
  }

  function buildOfficialThreadRecord(roomId) {
    const room = ROOMS[roomId];
    if (!room) return null;
    const preview = getRoomPreview(roomId);
    const now = preview.updatedAt || new Date().toISOString();
    return {
      id: roomId,
      listingId: listingCategoryForRoom(roomId),
      listingType: "official",
      listingTitle: room.displayName,
      category: listingCategoryForRoom(roomId),
      sellerId: room.senderId,
      sellerName: room.displayName,
      buyerId: getCurrentUserId(),
      buyerName: getCurrentUserName(),
      partnerUserId: room.senderId,
      status: "active",
      source: "talk-official-rooms",
      lastMessage: preview.lastMessagePreview || room.defaultPreview,
      createdAt: now,
      updatedAt: now,
      chatDomain: "friend",
      threadKind: "official",
      _officialRoom: true,
      _talkChannel: room._talkChannel,
      unreadCount: preview.unreadCount,
    };
  }

  function upsertOfficialThread(roomId) {
    const id = normalizeLegacyRoomId(roomId);
    const room = ROOMS[id];
    if (!room) return false;
    if (!ALWAYS_VISIBLE_OFFICIAL_ROOMS.has(id)) {
      const messages = getRoomMessages(id);
      if (!messages.length) return false;
    }
    const next = buildOfficialThreadRecord(id);
    if (!next) return false;
    const threads = readThreads().filter((t) => String(t.id) !== OFFICIAL_BUILDER);
    const idx = threads.findIndex((t) => String(t.id) === id);
    if (idx >= 0) {
      threads[idx] = {
        ...threads[idx],
        ...next,
        createdAt: pickStr(threads[idx].createdAt) || next.createdAt,
      };
    } else {
      threads.unshift(next);
    }
    writeThreads(threads);
    return true;
  }

  function upsertOfficialThreadsForRooms(roomIds) {
    let changed = 0;
    (roomIds || NOTIFICATION_CENTER_ROOM_ORDER).forEach((roomId) => {
      if (upsertOfficialThread(roomId)) changed += 1;
    });
    return changed;
  }

  function readLastSeenMap() {
    try {
      const raw = global.localStorage.getItem(LAST_SEEN_KEY);
      const map = raw ? JSON.parse(raw) : {};
      return map && typeof map === "object" ? map : {};
    } catch {
      return {};
    }
  }

  function writeLastSeenMap(map) {
    global.localStorage.setItem(LAST_SEEN_KEY, JSON.stringify(map));
  }

  function getRoomMessages(roomId) {
    const id = normalizeLegacyRoomId(roomId);
    const map = readMessagesMap();
    const legacyBuilder =
      id === OFFICIAL_PLATFORM && Array.isArray(map[OFFICIAL_BUILDER]) ? map[OFFICIAL_BUILDER] : [];
    const list = [...legacyBuilder, ...(Array.isArray(map[id]) ? map[id] : [])];
    const rows = list
      .slice()
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    const byId = new Map();
    rows.forEach((m) => {
      if (m?.id) byId.set(String(m.id), m);
    });
    const deduped = [...byId.values()].sort((a, b) =>
      String(a.createdAt).localeCompare(String(b.createdAt))
    );
    if (global.TasuTalkWorkerReviewMode?.isWorkerReviewMode?.()) {
      return global.TasuTalkWorkerReviewMode.filterWorkerReviewTalkMessages(id, deduped);
    }
    if (global.TasuTalkJobFullReviewMode?.filterJobFullReviewTalkMessages) {
      return global.TasuTalkJobFullReviewMode.filterJobFullReviewTalkMessages(id, deduped);
    }
    if (global.TasuTalkJobReviewMode?.filterJobReviewTalkMessages) {
      return global.TasuTalkJobReviewMode.filterJobReviewTalkMessages(id, deduped);
    }
    return deduped;
  }

  function messageIdForNotification(notificationId) {
    return `official-notify-${String(notificationId || "").trim()}`;
  }

  function isBuilderTalkNotification(row) {
    const id = String(row?.id || "");
    const builderIds = global.TasuTalkBuilderNotifyMaster?.BUILDER_TALK_IDS || BUILDER_TALK_IDS;
    return (
      row?.type === "builder" ||
      id.startsWith("builder-") ||
      builderIds.has?.(id) ||
      BUILDER_TALK_IDS.has(id)
    );
  }

  function isAnpiTalkNotification(row) {
    const id = String(row?.id || "");
    return row?.type === "anpi" || id.startsWith("anpi-") || pickStr(row?.category) === "安否";
  }

  function isConnectTalkNotification(row) {
    const category = pickStr(row?.category);
    const source = String(row?.source || "").toLowerCase();
    const title = String(row?.title || "");
    if (category === "Connect") return true;
    if (/connect/i.test(source)) return true;
    if (/Connect|本人確認|Stripe/i.test(title)) return true;
    return false;
  }

  function isOpsTalkNotification(row) {
    if (!row || typeof row !== "object") return false;
    if (isAnpiTalkNotification(row)) return false;
    const id = String(row?.id || "");
    if (OPS_NOTIFY_IDS.has(id)) return true;
    const category = pickStr(row?.category);
    if (category === "運営") return true;
    if (category === "公式" && String(row?.type || "") === "system") return true;
    const source = String(row?.source || "").toLowerCase();
    if (source === "support" || source === "ops_watch") return true;
    const title = String(row?.title || "");
    if (/メンテナンス|規約|サポート|アカウント|重要なお知らせ|運営から/.test(title)) return true;
    return false;
  }

  const PLATFORM_TALK_CATEGORIES = new Set([
    "求人",
    "スキル",
    "商品",
    "ワーカー",
    "業務サービス",
    "店舗販売",
    "Builder",
    "Connect",
    "取引",
    "レビュー",
  ]);

  function isPlatformTalkNotification(row) {
    if (!row || typeof row !== "object") return false;
    if (row.sendTalkMessage === false) return false;
    if (isAnpiTalkNotification(row) || isOpsTalkNotification(row)) return false;
    if (isBuilderTalkNotification(row) || isConnectTalkNotification(row)) return true;
    const id = String(row?.id || "");
    const category = pickStr(row?.category);
    const source = String(row?.source || "").toLowerCase();
    if (source === "ops_watch" || source === "follow") return false;
    if (global.TasuTalkPlatformNotifyMaster?.isPlatformMasterNotification?.(row)) return true;
    if (id.startsWith("platform-") && !OPS_NOTIFY_IDS.has(id)) return true;
    if (PLATFORM_TALK_CATEGORIES.has(category)) return true;
    if (String(row?.type || "") === "ai") return false;
    return false;
  }

  function resolveOfficialRoomId(row) {
    if (!row || typeof row !== "object") return null;
    if (isAnpiTalkNotification(row)) return OFFICIAL_ANPI;
    if (isOpsTalkNotification(row)) return OFFICIAL_TASFUL;
    if (
      isBuilderTalkNotification(row) ||
      isPlatformTalkNotification(row) ||
      isConnectTalkNotification(row)
    ) {
      return OFFICIAL_PLATFORM;
    }
    const explicit = normalizeLegacyRoomId(pickStr(row?.officialRoomId));
    if (explicit === OFFICIAL_ANPI) return OFFICIAL_ANPI;
    if (explicit === OFFICIAL_TASFUL) return OFFICIAL_TASFUL;
    if (explicit === OFFICIAL_PLATFORM) return OFFICIAL_PLATFORM;
    if (explicit && ROOMS[explicit]) return explicit;
    if (row?.sendTalkMessage === true) return OFFICIAL_PLATFORM;
    return null;
  }

  function resolveCategoryPrefix(notification) {
    const category = pickStr(notification?.category);
    if (CATEGORY_PREFIX_MAP[category]) return CATEGORY_PREFIX_MAP[category];
    if (isBuilderTalkNotification(notification)) return "【Builder】";
    if (isConnectTalkNotification(notification)) return "【Connect】";
    if (isAnpiTalkNotification(notification)) return "【安否】";
    if (isOpsTalkNotification(notification)) return "【運営】";
    const type = String(notification?.type || "").toLowerCase();
    const typeMap = {
      job: "【求人】",
      skill: "【スキル】",
      worker: "【ワーカー】",
      business: "【業務】",
      shop: "【店舗】",
      product: "【商品】",
      builder: "【Builder】",
    };
    return typeMap[type] || "";
  }

  function formatNotifyTitle(notification) {
    const raw = pickStr(notification?.title);
    if (!raw) return "";
    if (/^【[^】]+】/.test(raw)) return raw;
    const prefix = resolveCategoryPrefix(notification);
    if (!prefix) return raw;
    return `${prefix}${raw}`;
  }

  function isBuilderOpsTalkMirror(notification) {
    if (!notification || typeof notification !== "object") return false;
    if (notification?.audienceScope === "admin_ops") return true;
    if (String(notification?.source || "") === "builder-mvp") return true;
    const id = String(notification?.id || "");
    const opsTalkIds = global.TasuTalkBuilderNotifyMaster?.BUILDER_OPS_TALK_IDS;
    if (opsTalkIds?.has?.(id)) return true;
    return id.startsWith("builder-ops-");
  }

  function isAnpiTalkMirror(notification) {
    if (!notification || typeof notification !== "object") return false;
    return isAnpiTalkNotification(notification);
  }

  function isPlatformFeeTalkMirror(notification) {
    if (!notification || typeof notification !== "object") return false;
    if (String(notification?.source || "") === "platform_chat_demo_v1") return false;
    if (global.TasuTalkPlatformFeeNotify?.isPlatformFeeNotification?.(notification)) return true;
    if (global.TasuTalkNotifyActions?.isPlatformFeeMasterNotification?.(notification)) {
      return true;
    }
    if (notification?.minimalNotifyCard === true && notification?.sendTalkMessage === true) {
      return String(notification?.source || "").includes("platform_fee");
    }
    return (
      notification?.minimalNotifyCard === true &&
      String(notification?.source || "").includes("platform_fee")
    );
  }

  function buildNotifyMessage(notification) {
    const roomId = resolveOfficialRoomId(notification);
    const room = roomId ? ROOMS[roomId] : null;
    if (!room) return null;
    const displayTitle = formatNotifyTitle(notification);
    const notifyCard =
      global.TasuTalkOfficialNotifyCard?.buildPayload?.(notification, roomId) || {
        notificationId: String(notification.id || ""),
        title: displayTitle,
        body: pickStr(notification?.body),
        actionLabel: pickStr(notification?.actionLabel) || "詳細を見る",
        href: pickStr(notification?.href, notification?.targetUrl) || "#",
      };
    return {
      id: messageIdForNotification(notification.id),
      chatId: roomId,
      roomId,
      senderId: room.senderId,
      senderName: room.senderName,
      text: displayTitle,
      createdAt: pickStr(notification?.createdAt) || new Date().toISOString(),
      kind: "notify_card",
      notifyCard,
    };
  }

  function countUnread(roomId, messages) {
    const id = normalizeLegacyRoomId(roomId);
    const lastSeen = pickStr(readLastSeenMap()[id], readLastSeenMap()[roomId]);
    const room = ROOMS[id];
    if (!room) return 0;
    return (messages || []).filter((m) => {
      if (String(m.senderId) === room.senderId && lastSeen) {
        return String(m.createdAt) > lastSeen;
      }
      if (String(m.senderId) === room.senderId && !lastSeen) return true;
      return false;
    }).length;
  }

  function isOfficialMessageUnread(roomId, message) {
    const id = normalizeLegacyRoomId(roomId);
    const room = ROOMS[id];
    if (!room || !message) return false;
    if (String(message.senderId) !== room.senderId) return false;
    const lastSeen = pickStr(readLastSeenMap()[id], readLastSeenMap()[roomId]);
    if (!lastSeen) return true;
    return String(message.createdAt) > lastSeen;
  }

  function upsertRoomMessage(msg) {
    if (!msg?.roomId || !msg?.id) return false;
    const roomId = normalizeLegacyRoomId(msg.roomId);
    const map = readMessagesMap();
    const list = Array.isArray(map[roomId]) ? [...map[roomId]] : [];
    const idx = list.findIndex((m) => String(m.id) === String(msg.id));
    const nextMsg = { ...msg, chatId: roomId, roomId };
    if (idx >= 0) list[idx] = { ...list[idx], ...nextMsg };
    else list.push(nextMsg);
    list.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    writeMessagesMap({ [roomId]: list });
    upsertOfficialThread(roomId);
    return true;
  }

  function resolveOfficialRoomBadge(roomId) {
    const id = normalizeLegacyRoomId(roomId);
    if (id === OFFICIAL_PLATFORM) return { label: "プラット", tone: "platform" };
    if (id === OFFICIAL_ANPI) return { label: "安否", tone: "anpi" };
    if (id === OFFICIAL_TASFUL) return { label: "運営", tone: "tasful" };
    return { label: "公式", tone: "official" };
  }

  function formatRoomListPreview(roomId, last) {
    const id = normalizeLegacyRoomId(roomId);
    const room = ROOMS[id];
    if (!last) return room?.defaultPreview || "";
    const card = last.notifyCard || {};
    let listingTitle = pickStr(card.listingTitle);
    if (!listingTitle && card.notificationId) {
      const n =
        global.TasuTalkNotifications?.findById?.(card.notificationId) ||
        global.TasuTalkData?.findNotificationById?.(card.notificationId);
      listingTitle = pickStr(n?.notifyListingTitle);
    }
    const eventTitle = pickStr(card.eventTitle, card.title, last.text);
    if (id === OFFICIAL_PLATFORM && listingTitle) {
      return `${listingTitle} — ${eventTitle}`.slice(0, 96);
    }
    if (id === OFFICIAL_TASFUL && pickStr(card.body)) {
      return String(card.body).slice(0, 96);
    }
    return pickStr(eventTitle, last.text, room?.defaultPreview).slice(0, 96);
  }

  function getRoomPreview(roomId) {
    const id = normalizeLegacyRoomId(roomId);
    const room = ROOMS[id];
    if (!room) {
      return { lastMessagePreview: "", unreadCount: 0, updatedAt: new Date().toISOString() };
    }
    const messages = getRoomMessages(id);
    const last = messages[messages.length - 1];
    const preview = formatRoomListPreview(id, last);
    return {
      lastMessagePreview: String(preview).slice(0, 80),
      unreadCount: countUnread(id, messages),
      updatedAt: pickStr(last?.createdAt) || new Date().toISOString(),
    };
  }

  function buildOfficialRoomCard(roomId) {
    const id = normalizeLegacyRoomId(roomId);
    const room = ROOMS[id];
    if (!room) return null;
    const preview = getRoomPreview(id);
    const now = preview.updatedAt || new Date().toISOString();
    return {
      id,
      _officialRoom: true,
      chatDomain: "friend",
      threadKind: "official",
      _talkChannel: room._talkChannel,
      partner: {
        id: room.senderId,
        displayName: room.displayName,
        avatarUrl: "",
        category: "公式",
      },
      partnerUserId: room.senderId,
      listing: { title: room.displayName, category: "公式" },
      lastMessagePreview: preview.lastMessagePreview || room.defaultPreview,
      unreadCount: preview.unreadCount,
      status: "active",
      remainingLabel: "",
      updatedAt: now,
      _sortAt: now,
      source: "talk-official-rooms",
    };
  }

  function isOfficialRoomAlwaysVisible(roomId) {
    return ALWAYS_VISIBLE_OFFICIAL_ROOMS.has(normalizeLegacyRoomId(roomId));
  }

  function ensureAlwaysVisibleOfficialRooms() {
    NOTIFICATION_CENTER_ROOM_ORDER.forEach((roomId) => upsertOfficialThread(roomId));
  }

  function shouldShowOfficialRoomInList(roomId) {
    const id = normalizeLegacyRoomId(roomId);
    if (id === OFFICIAL_BUILDER) return false;
    return isOfficialRoomAlwaysVisible(id) || getRoomMessages(id).length > 0;
  }

  function getOfficialRoomCards() {
    ensureAlwaysVisibleOfficialRooms();
    if (global.TasuTalkWorkerReviewMode?.isWorkerReviewMode?.()) {
      global.TasuTalkWorkerReviewMode.ensureWorkerReviewTalkMessages?.();
      const card = buildOfficialRoomCard(OFFICIAL_PLATFORM);
      return card ? [card] : [];
    }
    if (global.TasuTalkJobFullReviewMode?.isJobFullReviewMode?.()) {
      global.TasuTalkJobFullReviewMode.ensureJobFullReviewTalkMessages?.();
      const card = buildOfficialRoomCard(OFFICIAL_PLATFORM);
      return card ? [card] : [];
    }
    if (global.TasuTalkJobReviewMode?.isJobReviewMode?.()) {
      global.TasuTalkJobReviewMode.ensureJobReviewTalkMessages?.();
      const card = buildOfficialRoomCard(OFFICIAL_PLATFORM);
      return card ? [card] : [];
    }
    return NOTIFICATION_CENTER_ROOM_ORDER.map(buildOfficialRoomCard).filter(Boolean);
  }

  function shouldMirrorNotification(n) {
    if (!n || typeof n !== "object") return false;
    if (n.sendTalkMessage !== true) return false;
    return Boolean(resolveOfficialRoomId(n));
  }

  function shouldShowInNotifyTab(n) {
    if (!n || typeof n !== "object") return true;
    return n.sendNotification !== false;
  }

  function attachTalkFields(row) {
    const explicitFalse = row?.sendTalkMessage === false;
    let sendTalkMessage = row?.sendTalkMessage === true;
    if (!explicitFalse && sendTalkMessage !== true) {
      if (
        isAnpiTalkNotification(row) ||
        isOpsTalkNotification(row) ||
        isBuilderTalkNotification(row) ||
        isPlatformTalkNotification(row)
      ) {
        sendTalkMessage = true;
      }
    }
    const officialRoomId = sendTalkMessage ? resolveOfficialRoomId(row) : null;
    return {
      ...row,
      sendNotification: row?.sendNotification !== false,
      sendTalkMessage,
      officialRoomId,
    };
  }

  function syncNotification(notification) {
    const routed = {
      ...notification,
      officialRoomId: resolveOfficialRoomId(notification),
    };
    if (!shouldMirrorNotification(routed)) return false;
    const msg = buildNotifyMessage(routed);
    if (!msg) return false;
    return upsertRoomMessage(msg);
  }

  function syncFromNotifications(notifications) {
    let synced = 0;
    const touchedRooms = new Set();
    (notifications || []).forEach((n) => {
      if (!syncNotification(n)) return;
      synced += 1;
      const roomId = resolveOfficialRoomId(n);
      if (roomId) touchedRooms.add(roomId);
    });
    touchedRooms.forEach((roomId) => upsertOfficialThread(roomId));
    try {
      global.dispatchEvent(new CustomEvent("tasful-chat-threads-changed"));
    } catch {
      /* ignore */
    }
    return synced;
  }

  function mergeLegacyBuilderMessages() {
    const map = readMessagesMap();
    const legacy = Array.isArray(map[OFFICIAL_BUILDER]) ? map[OFFICIAL_BUILDER] : [];
    if (!legacy.length) return false;
    const platform = Array.isArray(map[OFFICIAL_PLATFORM]) ? map[OFFICIAL_PLATFORM] : [];
    const byId = new Map();
    [...platform, ...legacy].forEach((m) => {
      if (m?.id) byId.set(String(m.id), { ...m, chatId: OFFICIAL_PLATFORM, roomId: OFFICIAL_PLATFORM });
    });
    map[OFFICIAL_PLATFORM] = [...byId.values()].sort((a, b) =>
      String(a.createdAt).localeCompare(String(b.createdAt))
    );
    map[OFFICIAL_BUILDER] = [];
    writeMessagesMap(map);
    return true;
  }

  function rebuildTalkMirrorPhase3(notifications) {
    mergeLegacyBuilderMessages();
    const map = readMessagesMap();
    NOTIFICATION_CENTER_ROOM_ORDER.forEach((roomId) => {
      map[roomId] = [];
    });
    writeMessagesMap(map);
    syncFromNotifications(notifications || []);
    try {
      global.localStorage.setItem(PHASE3_MARKER, "1");
    } catch {
      /* ignore */
    }
  }

  function ensurePhase3Migration(notifications) {
    try {
      if (global.localStorage.getItem(PHASE3_MARKER) === "1") {
        mergeLegacyBuilderMessages();
        return false;
      }
    } catch {
      /* ignore */
    }
    rebuildTalkMirrorPhase3(notifications);
    return true;
  }

  function ensureNotifyCardMigration(notifications) {
    try {
      if (global.localStorage.getItem(NOTIFY_CARD_MARKER) === "1") return;
      syncFromNotifications(notifications || []);
      global.localStorage.setItem(NOTIFY_CARD_MARKER, "1");
    } catch {
      /* ignore */
    }
  }

  function syncAllFromStore() {
    const list = global.TasuTalkNotifications?.getAll?.() || [];
    ensurePhase3Migration(list);
    ensureNotifyCardMigration(list);
    const synced = syncFromNotifications(list);
    ensureAlwaysVisibleOfficialRooms();
    return synced;
  }

  function markRoomRead(roomId) {
    const id = normalizeLegacyRoomId(roomId);
    if (!ROOMS[id]) return;
    const messages = getRoomMessages(id);
    const last = messages[messages.length - 1];
    const map = readLastSeenMap();
    map[id] = pickStr(last?.createdAt) || new Date().toISOString();
    writeLastSeenMap(map);
    upsertOfficialThread(id);
    try {
      global.dispatchEvent(new CustomEvent("tasful-official-room-read", { detail: { roomId: id } }));
    } catch {
      /* ignore */
    }
  }

  function loadMessagesForRoom(roomId) {
    return getRoomMessages(roomId);
  }

  function isOfficialRoomId(roomId) {
    const id = normalizeLegacyRoomId(roomId);
    return Boolean(ROOMS[id]);
  }

  function purgeNotificationMessages(notificationIds) {
    const ids = new Set((notificationIds || []).map((id) => messageIdForNotification(id)));
    if (!ids.size) return;
    const map = readMessagesMap();
    let changed = false;
    Object.keys(map).forEach((roomId) => {
      const list = Array.isArray(map[roomId]) ? map[roomId] : [];
      const next = list.filter((m) => !ids.has(String(m.id)));
      if (next.length !== list.length) {
        map[roomId] = next;
        changed = true;
      }
    });
    if (changed) {
      writeMessagesMap(map);
      NOTIFICATION_CENTER_ROOM_ORDER.forEach((roomId) => upsertOfficialThread(roomId));
    }
  }

  function repairOfficialThreadsFromMessages() {
    mergeLegacyBuilderMessages();
    return upsertOfficialThreadsForRooms(NOTIFICATION_CENTER_ROOM_ORDER);
  }

  global.TasuTalkOfficialRooms = {
    OFFICIAL_PLATFORM,
    OFFICIAL_TASFUL,
    OFFICIAL_ANPI,
    OFFICIAL_BUILDER,
    NOTIFICATION_CENTER_ROOM_ORDER,
    ALWAYS_VISIBLE_OFFICIAL_ROOMS,
    ROOMS,
    BUILDER_TALK_IDS,
    SYNC_MARKER,
    PHASE3_MARKER,
    attachTalkFields,
    resolveOfficialRoomId,
    resolveOfficialRoomBadge,
    formatNotifyTitle,
    shouldMirrorNotification,
    shouldShowInNotifyTab,
    getOfficialRoomCards,
    ensureAlwaysVisibleOfficialRooms,
    isOfficialRoomAlwaysVisible,
    shouldShowOfficialRoomInList,
    getRoomPreview,
    buildOfficialRoomCard,
    syncNotification,
    syncFromNotifications,
    syncAllFromStore,
    markRoomRead,
    isOfficialMessageUnread,
    loadMessagesForRoom,
    isOfficialRoomId,
    getRoomMessages,
    purgeNotificationMessages,
    readThreads,
    writeThreads,
    upsertOfficialThread,
    upsertOfficialThreadsForRooms,
    repairOfficialThreadsFromMessages,
    rebuildTalkMirrorPhase3,
    THREADS_KEY,
    MESSAGES_KEY,
  };
})(typeof window !== "undefined" ? window : globalThis);
