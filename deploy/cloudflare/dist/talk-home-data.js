/**
 * TASFUL TALK — データ API（通知集約・チャットモック）
 */
(function (global) {
  "use strict";

  /** @type {Record<string, { id: string, label: string, tone: string, filterId: string }>} */
  const TYPE_LABELS = global.TasuTalkCategory?.TYPE_LABELS || {
    skill: "スキル",
    worker: "ワーカー",
    job: "求人",
    product: "商品",
    shop: "店舗・販売",
    business: "業務サービス",
    builder: "Builder",
    anpi: "安否",
    system: "運営",
  };

  const NOTIFICATION_TYPES = Object.freeze({
    skill: { id: "skill", label: TYPE_LABELS.skill, tone: "blue", filterId: "skill" },
    worker: { id: "worker", label: TYPE_LABELS.worker, tone: "teal", filterId: "worker" },
    job: { id: "job", label: TYPE_LABELS.job, tone: "green", filterId: "job" },
    product: { id: "product", label: TYPE_LABELS.product, tone: "cyan", filterId: "product" },
    shop: { id: "shop", label: TYPE_LABELS.shop, tone: "purple", filterId: "shop" },
    business: { id: "business", label: TYPE_LABELS.business, tone: "amber", filterId: "business" },
    builder: { id: "builder", label: TYPE_LABELS.builder, tone: "indigo", filterId: "builder" },
    anpi: { id: "anpi", label: TYPE_LABELS.anpi, tone: "rose", filterId: "anpi" },
    system: { id: "system", label: TYPE_LABELS.system, tone: "slate", filterId: "system" },
  });

  const PRIORITY_META = Object.freeze({
    normal: { label: "通常", className: "talk-notify-priority--normal" },
    important: { label: "重要", className: "talk-notify-priority--important" },
    urgent: { label: "緊急", className: "talk-notify-priority--urgent" },
    high: { label: "高", className: "talk-notify-priority--high" },
    medium: { label: "中", className: "talk-notify-priority--medium" },
    low: { label: "低", className: "talk-notify-priority--low" },
  });

  const PLATFORM_CATEGORY_META =
    global.TasuTalkPlatformNotifyMaster?.PLATFORM_CATEGORY_META ||
    Object.freeze({
      運営: { tone: "slate" },
      求人: { tone: "green" },
      スキル: { tone: "blue" },
      ワーカー: { tone: "teal" },
      業務サービス: { tone: "amber" },
      店舗販売: { tone: "purple" },
      取引: { tone: "indigo" },
    レビュー: { tone: "cyan" },
    Builder: { tone: "indigo" },
    安否: { tone: "rose" },
  });

  /** 通知タブ用フィルタ定義 */
  const NOTIFICATION_FILTERS = Object.freeze([
    { id: "all", label: "すべて" },
    { id: "unread", label: "未読" },
    { id: "skill", label: TYPE_LABELS.skill },
    { id: "worker", label: TYPE_LABELS.worker },
    { id: "job", label: TYPE_LABELS.job },
    { id: "product", label: TYPE_LABELS.product },
    { id: "shop", label: TYPE_LABELS.shop },
    { id: "business", label: TYPE_LABELS.business },
    { id: "builder", label: TYPE_LABELS.builder },
    { id: "anpi", label: TYPE_LABELS.anpi },
    { id: "system", label: TYPE_LABELS.system },
    { id: "ops_watch", label: "OPS WATCH" },
  ]);

  const FUTURE_CAPABILITIES = Object.freeze([
    "broadcast",
    "ad_delivery",
    "ai_secretary",
    "safety_check",
  ]);

  const now = Date.now();

  function listingRoute(type, id) {
    const R = global.TasuListingRouteResolver;
    if (R?.buildDetailUrl) return R.buildDetailUrl(type, id);
    return "#";
  }

  /** @deprecated v3 検証シード投入後は空（旧 Phase1 モックは不使用） */
  const PRESERVED_SPECIAL_NOTIFICATIONS = Object.freeze([]);

  const PLATFORM_NOTIFICATION_MASTER_V1 =
    global.TasuTalkPlatformNotifyMaster?.buildMaster?.(now) || [];

  const BUILDER_NOTIFICATION_MASTER_V1 =
    global.TasuTalkBuilderNotifyMaster?.buildMaster?.(now) || [];

  const ANPI_NOTIFICATION_MASTER_V1 =
    global.TasuTalkAnpiNotifyMaster?.buildMaster?.(now) || [];

  const SEED_NOTIFICATIONS = [...PLATFORM_NOTIFICATION_MASTER_V1];

  /** 通知・TALK 共通カテゴリ（横スクロールバー・⚙詳細フィルター） */
  const TALK_CATEGORY_BAR_DEFS = Object.freeze([
    { id: "personal", label: "個人", notifyTypes: ["connect"], chatChannels: ["personal"] },
    { id: "job", label: "求人", notifyTypes: ["job"], chatChannels: ["job"] },
    { id: "worker", label: "ワーカー", notifyTypes: ["worker"], chatChannels: ["worker"] },
    { id: "skill", label: "スキル", notifyTypes: ["skill"], chatChannels: ["skill"] },
    { id: "product", label: "商品", notifyTypes: ["product"], chatChannels: ["product"] },
    { id: "business", label: "業務", notifyTypes: ["business"], chatChannels: ["business"] },
    { id: "shop", label: "店舗", notifyTypes: ["shop"], chatChannels: ["shop"] },
    {
      id: "builder",
      label: "Builder",
      notifyTypes: ["builder", "builder_admin_ops", "builder_board"],
      chatChannels: ["builder"],
    },
    { id: "anpi", label: "安否", notifyTypes: ["anpi"], chatChannels: ["anpi"] },
    { id: "ai", label: "AI", notifyTypes: ["ai"], chatChannels: ["ai_consult"] },
    { id: "official", label: "公式", notifyTypes: ["official"], chatChannels: ["official"] },
    { id: "system", label: "運営", notifyTypes: ["system", "ops_watch"], chatChannels: ["system"] },
  ]);

  /** 通知タブ — カテゴリチップ（横スクロール行・フィルターパネル共通） */
  const NOTIFY_CATEGORY_CHIP_DEFS = Object.freeze(
    TALK_CATEGORY_BAR_DEFS.map(({ id, label, notifyTypes }) => ({
      id,
      label,
      filterTypes: notifyTypes,
    }))
  );

  /** @deprecated NOTIFY_CATEGORY_CHIP_DEFS を使用 */
  const NOTIFY_MOBILE_CATEGORY_CHIPS = NOTIFY_CATEGORY_CHIP_DEFS;

  const NOTIFY_PERIOD_FILTERS = Object.freeze([
    { id: "today", label: "今日", days: 1 },
    { id: "7d", label: "7日", days: 7 },
    { id: "30d", label: "30日", days: 30 },
    { id: "all", label: "全期間", days: 0 },
  ]);

  /** Phase 4+ — TALK 一覧カテゴリ（通知センター + 友達） */
  const LINE_CATEGORY_TABS = Object.freeze([
    { id: "all", label: "すべて" },
    { id: "unread", label: "未読", filterKind: "unread" },
    { id: "important", label: "重要", filterKind: "important" },
    {
      id: "platform",
      label: "プラット",
      roomIds: ["official_platform"],
    },
    {
      id: "tasful",
      label: "運営",
      roomIds: ["official_tasful"],
    },
    {
      id: "anpi",
      label: "安否",
      roomIds: ["official_anpi"],
    },
    {
      id: "friend",
      label: "友達",
      hubIds: ["talk-hub-friend"],
      friendOnly: true,
    },
  ]);

  const DEMO_SOCIAL_THREADS = Object.freeze([
    {
      id: "talk-mock-friend-001",
      chatDomain: "friend",
      threadKind: "direct",
      partnerUserId: "u_demo_friend_001",
      partnerProfile: {
        user_id: "u_demo_friend_001",
        display_name: "田中 一郎",
        status_message: "よろしくお願いします",
      },
      partner: { id: "u_demo_friend_001", displayName: "田中 一郎" },
      lastMessagePreview: "場所はいつものカフェで。",
      unreadCount: 1,
      updatedAt: new Date().toISOString(),
      lastMessageAt: new Date().toISOString(),
      _sortAt: new Date().toISOString(),
    },
    {
      id: "talk-mock-group-001",
      chatDomain: "friend",
      threadKind: "group",
      groupName: "現場チーム",
      partnerProfile: { display_name: "現場チーム", user_id: "grp_demo_001" },
      partner: { displayName: "現場チーム" },
      lastMessagePreview: "明日の集合時間を確認してください",
      unreadCount: 0,
      updatedAt: new Date(Date.now() - 3600000).toISOString(),
      lastMessageAt: new Date(Date.now() - 3600000).toISOString(),
      _sortAt: new Date(Date.now() - 3600000).toISOString(),
    },
  ]);

  /** @deprecated LINE_CATEGORY_TABS を使用 */
  const LINE_LIST_FILTERS = LINE_CATEGORY_TABS;

  const CHAT_CHANNELS = Object.freeze([
    { id: "all", label: "すべて" },
    ...TALK_CATEGORY_BAR_DEFS.map(({ id, label, chatChannels }) => ({
      id: chatChannels[0] || id,
      label,
    })),
  ]);

  const CHAT_CHANNEL_ALIASES = Object.freeze({
    business_service: "business",
    field_service: "business",
    shop_store: "shop",
    store: "shop",
    "business-service": "business",
    "shop-store": "shop",
  });

  const CHAT_EMPTY_MESSAGE =
    "プラット・安否・運営の通知はこちらに届きます。取引のやりとりは取引チャット一覧から確認できます。";

  const NOTIFICATION_CENTER_OFFICIAL_IDS = Object.freeze([
    "official_platform",
    "official_anpi",
    "official_tasful",
  ]);

  const NOTIFICATION_CENTER_OFFICIAL_ORDER =
    global.TasuTalkOfficialRooms?.NOTIFICATION_CENTER_ROOM_ORDER || NOTIFICATION_CENTER_OFFICIAL_IDS;

  const TRANSACTION_CHAT_CHANNELS = new Set([
    "job",
    "worker",
    "skill",
    "product",
    "shop",
    "business",
    "builder",
    "anpi",
  ]);

  /** 運営通知センター — トークタブに常時出す静的ハブ */
  const STATIC_CHAT_HUB_CARDS = Object.freeze([
    {
      id: "talk-hub-ai",
      _staticCard: true,
      _notificationCenterHub: true,
      _talkChannel: "ai_consult",
      listing: { title: "AI相談" },
      partner: { displayName: "TASFUL AI" },
      lastMessagePreview: "使い方・下書き・告知文案を AI タブで相談できます",
      unreadCount: 0,
      updatedAt: new Date(now - 1000 * 60 * 2).toISOString(),
      _sortAt: new Date(now - 1000 * 60 * 2).toISOString(),
      _hubHref: "ai-workspace.html",
      _relatedHref: "ai-workspace.html",
    },
    {
      id: "talk-hub-support",
      _staticCard: true,
      _notificationCenterHub: true,
      _talkChannel: "system",
      listing: { title: "サポート" },
      partner: { displayName: "TASFULサポート" },
      lastMessagePreview: "お問い合わせ・トラブル対応はこちら",
      unreadCount: 0,
      updatedAt: new Date(now - 1000 * 60 * 3).toISOString(),
      _sortAt: new Date(now - 1000 * 60 * 3).toISOString(),
      _hubHref: "support-trouble-center.html",
    },
    {
      id: "talk-hub-friend",
      _staticCard: true,
      _notificationCenterHub: true,
      _talkChannel: "personal",
      chatDomain: "friend",
      threadKind: "direct",
      listing: { title: "友達" },
      partner: { displayName: "友達" },
      lastMessagePreview: "友達とのトーク（準備中）",
      unreadCount: 0,
      updatedAt: new Date(now - 1000 * 60 * 4).toISOString(),
      _sortAt: new Date(now - 1000 * 60 * 4).toISOString(),
    },
  ]);

  /** @deprecated 取引 mock は廃止（運営通知センター化） */
  const MOCK_EXTRA_CHATS = Object.freeze([]);

  const BUILDER_HUB = Object.freeze({
    label: "Builder 案件チャット",
    description: "工事・協力会社との案件スレッドは Builder 側で管理します（TASFUL TALK から遷移）。",
    href: "builder/mvp-threads.html",
  });

  function normalizeChatChannelId(id) {
    const k = String(id || "")
      .trim()
      .toLowerCase();
    if (!k || k === "all") return k || "personal";
    return CHAT_CHANNEL_ALIASES[k] || k;
  }

  function getChatChannelLabel(channelId) {
    const id = normalizeChatChannelId(channelId);
    return CHAT_CHANNELS.find((c) => c.id === id)?.label || "チャット";
  }

  /** @param {object} thread */
  function resolveChatChannel(thread) {
    if (!thread || typeof thread !== "object") return "personal";
    if (thread._talkChannel) return normalizeChatChannelId(thread._talkChannel);
    if (thread._localConsult && !thread.listing?.type && !thread._listingType) {
      return "personal";
    }
    const listing = thread.listing || {};
    const record = {
      type: listing.type || thread._listingType,
      listingType: listing.type || thread._listingType,
      category: thread._category || listing.category,
      title: listing.title,
      targetUrl: thread.targetUrl || listing.targetUrl,
      _localRecord: listing._localRecord || listing,
    };
    const fromCat = global.TasuTalkCategory?.resolveListingCategoryType?.(record);
    if (fromCat && fromCat !== "anpi" && fromCat !== "system") {
      const mapped = normalizeChatChannelId(fromCat);
      if (CHAT_CHANNELS.some((c) => c.id === mapped)) return mapped;
    }
    const cat = String(thread._category || listing.category || "");
    if (/求人/.test(cat)) return "job";
    if (/業務/.test(cat)) return "business";
    const lt = String(listing.type || thread._listingType || "").toLowerCase();
    if (lt) {
      const mapped = normalizeChatChannelId(lt);
      if (CHAT_CHANNELS.some((c) => c.id === mapped)) return mapped;
    }
    return "personal";
  }

  /** @param {object} row @param {string} query */
  function matchesChatSearch(row, query) {
    const q = String(query || "")
      .trim()
      .toLowerCase();
    if (!q) return true;
    const channel = resolveChatChannel(row);
    const parts = [
      row.partner?.displayName,
      row.listing?.title,
      row.lastMessagePreview,
      row._category,
      row.listing?.category,
      getChatChannelLabel(channel),
      row._caseName,
      row.listing?.id,
    ];
    const hay = parts.filter(Boolean).join(" ").toLowerCase();
    return hay.includes(q);
  }

  /** @param {Array<object>} threads */
  function sortChatThreads(threads) {
    const list = Array.isArray(threads) ? threads.slice() : [];
    return list.sort((a, b) => {
      const au = Number(a.unreadCount) > 0 ? 1 : 0;
      const bu = Number(b.unreadCount) > 0 ? 1 : 0;
      if (bu !== au) return bu - au;
      return String(b._sortAt || b.updatedAt || b.lastMessageAt || "").localeCompare(
        String(a._sortAt || a.updatedAt || a.lastMessageAt || "")
      );
    });
  }

  function getStaticChatHubCards() {
    const cards = STATIC_CHAT_HUB_CARDS.map((t) => ({ ...t }));
    if (global.TasuTalkHomeLayout?.filterStaticHubCards) {
      return global.TasuTalkHomeLayout.filterStaticHubCards(cards);
    }
    return cards;
  }

  function getNotificationFiltersForUi() {
    const list = [...NOTIFICATION_FILTERS];
    if (global.TasuTalkHomeLayout?.filterNotifyFilters) {
      return global.TasuTalkHomeLayout.filterNotifyFilters(list);
    }
    return list;
  }

  /**
   * @param {Array<object>} threads
   * @param {{ channel?: string, channels?: string[], unreadOnly?: boolean, query?: string }} [options]
   */
  function resolveLineCategoryTab(filterId) {
    const id = String(filterId || "all");
    if (!id || id === "all") return null;
    return LINE_CATEGORY_TABS.find((row) => row.id === id) || null;
  }

  function matchesLineCategoryFilter(row, tabDef) {
    if (!tabDef || !row) return false;
    if (tabDef.filterKind) return matchesListFilterKind(row, tabDef);
    const roomIds = tabDef.roomIds || [];
    if (roomIds.length) {
      return Boolean(row._officialRoom && roomIds.includes(String(row.id)));
    }
    if (tabDef.friendOnly) {
      if (String(row.id) === "talk-hub-friend") return true;
      return isNotificationCenterFriendThread(row);
    }
    const hubIds = tabDef.hubIds || [];
    if (hubIds.length) return hubIds.includes(String(row.id));
    return false;
  }

  function applyLineCategoryListFilter(list, listFilter) {
    const tabDef = resolveLineCategoryTab(listFilter);
    if (!tabDef) return list;
    return list.filter((row) => matchesLineCategoryFilter(row, tabDef));
  }

  function applyChatHubFilters(threads, options) {
    const query = String(options?.query || "");
    const listFilter = String(options?.listFilter || "all");
    const channelSet = new Set(
      (Array.isArray(options?.channels) ? options.channels : [])
        .map((id) => String(id))
        .filter((id) => id && id !== "all")
    );
    const legacyChannel = String(options?.channel || "all");
    if (!channelSet.size && legacyChannel !== "all") channelSet.add(legacyChannel);

    let list = Array.isArray(threads) ? threads.slice() : [];
    if (listFilter && listFilter !== "all") {
      list = applyLineCategoryListFilter(list, listFilter);
    }
    if (channelSet.size > 0) {
      list = list.filter((r) => {
        if (r._officialRoom) {
          if (channelSet.has("official")) return true;
          const ch = normalizeChatChannelId(r._talkChannel || resolveChatChannel(r));
          return channelSet.has(ch);
        }
        if (r._staticCard) {
          const ch = normalizeChatChannelId(r._talkChannel || resolveChatChannel(r));
          return channelSet.has(ch);
        }
        return channelSet.has(resolveChatChannel(r));
      });
    }
    if (options?.unreadOnly === true) {
      list = list.filter((r) => r._officialRoom || Number(r?.unreadCount) > 0);
    }
    if (options?.importantOnly === true) {
      list = list.filter((r) => threadHasImportantUnread(r));
    }
    if (query.trim()) {
      list = list.filter((r) => matchesChatSearch(r, query));
    }
    const staticRows = list.filter((r) => r._staticCard);
    const officialRows = sortChatThreads(list.filter((r) => r._officialRoom));
    const dynamic = sortChatThreads(list.filter((r) => !r._staticCard && !r._officialRoom));
    return [...officialRows, ...staticRows, ...dynamic];
  }

  /** @param {Array<object>} threads */
  function countChatThreadsByChannel(threads) {
    const display = buildChatDisplayList(threads || []);
    const counts = { unread: 0, all: display.length };
    LINE_CATEGORY_TABS.forEach((tab) => {
      if (tab.id === "all") return;
      counts[tab.id] = applyLineCategoryListFilter(display, tab.id).length;
    });
    display.forEach((row) => {
      const ch = resolveChatChannel(row);
      counts[ch] = (counts[ch] || 0) + 1;
      if (row._officialRoom) counts.official = (counts.official || 0) + 1;
      if (Number(row?.unreadCount) > 0) counts.unread += 1;
      if (threadHasImportantUnread(row)) counts.important = (counts.important || 0) + 1;
    });
    return counts;
  }

  function isNotificationCenterStaticCard(thread) {
    return Boolean(thread?._staticCard && thread?._notificationCenterHub);
  }

  function isNotificationCenterOfficialThread(thread) {
    return Boolean(
      thread?._officialRoom &&
        NOTIFICATION_CENTER_OFFICIAL_IDS.includes(String(thread.id))
    );
  }

  function isNotificationCenterFriendThread(thread) {
    if (!thread || thread._staticCard || thread._officialRoom) return false;
    const kind = String(thread.threadKind || thread.thread_kind || "direct").toLowerCase();
    return thread.chatDomain === "friend" && (kind === "direct" || kind === "group");
  }

  function threadHasImportantUnread(thread) {
    if (!thread) return false;
    const Safety = global.TasuTalkRoomSafetyStore;
    if (Safety?.isPinned?.(thread.id)) return true;
    if (thread._officialRoom) {
      const Rooms = global.TasuTalkOfficialRooms;
      const messages = Rooms?.loadMessagesForRoom?.(thread.id) || [];
      return messages.some((m) => {
        if (Rooms?.isOfficialMessageUnread && !Rooms.isOfficialMessageUnread(thread.id, m)) {
          return false;
        }
        const nid = m?.notifyCard?.notificationId;
        const n = nid ? findNotificationById(nid) : null;
        if (n && global.TasuTalkNotifications?.isUnread?.(n) && matchesNotifyImportantFilter(n)) {
          return true;
        }
        return false;
      });
    }
    if (isNotificationCenterFriendThread(thread)) {
      return Number(thread.unreadCount) > 0;
    }
    return false;
  }

  function matchesListFilterKind(row, tabDef) {
    const kind = tabDef?.filterKind;
    if (!kind) return false;
    if (kind === "unread") return Number(row?.unreadCount) > 0;
    if (kind === "important") return threadHasImportantUnread(row);
    return false;
  }

  /** 取引相手との会話スレッド（TALK 一覧から除外） */
  function isTransactionPartnerThread(thread) {
    if (!thread || typeof thread !== "object") return false;
    if (isNotificationCenterOfficialThread(thread)) return false;
    if (isNotificationCenterStaticCard(thread)) return false;
    if (isNotificationCenterFriendThread(thread)) return false;
    if (thread._officialRoom) return true;
    if (thread._opsRoom) return true;
    if (thread.chatDomain === "work") return true;
    if (thread.threadKind === "listing_inquiry") return true;
    const ch = normalizeChatChannelId(resolveChatChannel(thread));
    if (TRANSACTION_CHAT_CHANNELS.has(ch)) return true;
    if (thread._mockTalk) return true;
    const listingId = String(thread.listingId || thread.listing?.id || "").trim();
    const listingType = String(thread.listing?.type || "").trim();
    if (listingId || listingType) return true;
    if (thread.partner?.displayName && thread.chatDomain !== "friend") return true;
    if (thread.partnerUserId && thread.chatDomain !== "friend") return true;
    return false;
  }

  function isNotificationCenterListItem(thread) {
    if (!thread || typeof thread !== "object") return false;
    if (isNotificationCenterOfficialThread(thread)) return true;
    if (isNotificationCenterStaticCard(thread)) return true;
    if (isNotificationCenterFriendThread(thread)) return true;
    return false;
  }

  function getNotificationCenterOfficialCards() {
    const Rooms = global.TasuTalkOfficialRooms;
    if (!Rooms) return [];
    const order = Rooms.NOTIFICATION_CENTER_ROOM_ORDER || NOTIFICATION_CENTER_OFFICIAL_ORDER;
    const cards = (Rooms.getOfficialRoomCards?.() || []).filter((c) =>
      NOTIFICATION_CENTER_OFFICIAL_IDS.includes(String(c.id))
    );
    const byId = new Map(cards.map((c) => [String(c.id), c]));
    return order
      .map((roomId) => byId.get(String(roomId)) || Rooms.buildOfficialRoomCard?.(roomId))
      .filter(Boolean);
  }

  /** @param {Array<object>} threads */
  function filterNotificationCenterThreads(threads) {
    return (threads || []).filter(isNotificationCenterListItem);
  }

  function getDemoSocialThreads(existingIds) {
    const ids = existingIds || new Set();
    return DEMO_SOCIAL_THREADS.filter((row) => !ids.has(String(row.id))).map((row) => ({ ...row }));
  }

  /** @param {Array<object>} threads */
  function buildChatDisplayList(threads) {
    const hub = getStaticChatHubCards().filter(isNotificationCenterStaticCard);
    const official = getNotificationCenterOfficialCards();
    const officialIds = new Set(official.map((t) => String(t.id)));
    const friendThreads = sortChatThreads(
      (threads || []).filter(
        (t) =>
          isNotificationCenterFriendThread(t) &&
          !officialIds.has(String(t.id)) &&
          !isTransactionPartnerThread(t)
      )
    );
    const dynamicIds = new Set(friendThreads.map((t) => String(t.id)));
    const demoSocial = getDemoSocialThreads(dynamicIds);
    const Safety = global.TasuTalkRoomSafetyStore;
    const merged = [...official, ...hub, ...demoSocial, ...friendThreads];
    if (!Safety?.isPinned) return merged;
    return merged.sort((a, b) => {
      const ap = Safety.isPinned(a.id) ? 1 : 0;
      const bp = Safety.isPinned(b.id) ? 1 : 0;
      if (bp !== ap) return bp - ap;
      return 0;
    });
  }

  function markAllNotificationCenterRead() {
    const Rooms = global.TasuTalkOfficialRooms;
    NOTIFICATION_CENTER_OFFICIAL_IDS.forEach((roomId) => {
      Rooms?.markRoomRead?.(roomId);
    });
    const store = global.TasuTalkNotifications;
    (store?.getAll?.() || []).forEach((n) => {
      if (!n?.id || !store?.isUnread?.(n)) return;
      store.markRead(n.id);
      global.TasuTalkData?.markNotificationRead?.(n.id);
    });
    try {
      global.dispatchEvent(new CustomEvent("tasful-official-room-read", { detail: { all: true } }));
      global.dispatchEvent(new CustomEvent("tasful-talk-notification-center-read-all"));
    } catch {
      /* ignore */
    }
    return true;
  }

  /** @param {object} thread */
  function resolveChatListingUrl(thread) {
    if (thread._relatedHref) return String(thread._relatedHref);
    if (thread._staticCard) return "";
    const listing = thread.listing || {};
    const listingId = String(listing.id || thread.listingId || "").trim();
    const record = { ...listing, id: listingId || listing.id, type: listing.type || thread._listingType };
    try {
      const fromStore = global.TasuListingLocalStore?.buildDetailPageUrl?.(
        listing._localRecord || record
      );
      if (fromStore && fromStore !== "#") return fromStore;
    } catch (err) {
      console.warn("[TasuTalkData] buildDetailPageUrl failed:", err);
    }
    const channel = resolveChatChannel(thread);
    const R = global.TasuListingRouteResolver;
    if (R?.buildDetailUrl) {
      if (channel === "personal") return listingId ? R.buildDetailUrl("general", listingId) : "";
      if (channel === "builder") return R.buildDetailUrl("deal", listingId);
      const typeMap = {
        job: "job",
        business: "business_service",
        skill: "skill",
        worker: "worker",
        product: "product",
        shop: "shop",
      };
      const routeType = typeMap[channel];
      if (routeType) return R.buildDetailUrl(routeType, listingId);
    }
    return listingId ? listingRoute(channel === "business" ? "business_service" : channel, listingId) : "#";
  }

  /** 右ペイン内で開く通常チャットか（取引相手との会話は除外） */
  function shouldOpenInlineRoom(thread) {
    if (!thread || typeof thread !== "object") return false;
    if (isTransactionPartnerThread(thread)) return false;
    if (thread._officialRoom) return isNotificationCenterOfficialThread(thread);
    if (thread._hubHref || thread._staticCard || thread._opsRoom) return false;
    if (isNotificationCenterFriendThread(thread)) return true;
    return false;
  }

  /**
   * ページ遷移を許可する外部リンク（Builder / 運営秘書 / 管理系）
   * @param {object} thread
   * @returns {string}
   */
  function resolveThreadExternalHref(thread) {
    if (!thread) return "";
    if (thread._hubHref) return String(thread._hubHref);
    if (thread._staticCard && thread._hubHref) return String(thread._hubHref);
    const channel = resolveChatChannel(thread);
    if (channel === "builder" && thread._hubHref) return String(thread._hubHref);
    if (thread._opsRoom) return "admin-operations-dashboard.html#ops-ai-secretary";
    return "";
  }

  /** @param {object} thread */
  function resolveChatTalkHref(thread) {
    const external = resolveThreadExternalHref(thread);
    if (external) return external;
    if (shouldOpenInlineRoom(thread)) {
      return `#thread=${encodeURIComponent(thread.id)}`;
    }
    const isLocal = Boolean(thread._localConsult);
    const base =
      global.TasuChatService?.chatDetailUrl?.(thread.id) ||
      (isLocal
        ? `chat-detail.html?thread=${encodeURIComponent(thread.id)}`
        : `chat-detail.html?roomId=${encodeURIComponent(thread.id)}`);
    return global.TasuChatThreadStore?.appendChatDetailFromParam?.(base, "talk") || base;
  }

  const BUILDER_BENCH_TALK_FLOWS = new Set(["ops_partner", "partner_user", "user_user", "vendor_user"]);

  function isBuilderBenchTalkNotifySession() {
    try {
      if (global.sessionStorage?.getItem("tasu:builder:ops-bench") === "1") return true;
      const sp = new URLSearchParams(global.location?.search || "");
      if (sp.get("benchEmbed") !== "1") return false;
      return BUILDER_BENCH_TALK_FLOWS.has(String(sp.get("builderFlow") || "").trim());
    } catch {
      return false;
    }
  }

  function isOpsPartnerBenchSession() {
    return isBuilderBenchTalkNotifySession();
  }

  function store() {
    return global.TasuTalkNotifications;
  }

  function readNotificationList() {
    const s = store();
    return s?.getAll?.() || [];
  }

  function ensureNotifications() {
    const s = store();
    if (!s) return [];
    if (global.__tasuTalkNotificationsBootstrapped === true) {
      return readNotificationList();
    }
    try {
      if (isBuilderBenchTalkNotifySession()) {
        global.__tasuTalkNotificationsBootstrapped = true;
        return readNotificationList();
      }
      const liveFlow = global.TasuPlatformChatLiveFlow?.isLiveFlowMode?.() === true;
      const chatDemoReview = global.TasuTalkChatDemoReviewMode?.isChatDemoReviewMode?.() === true;
      let list =
        liveFlow || chatDemoReview
          ? s.getAll?.() || []
          : s.seedIfEmpty(SEED_NOTIFICATIONS);
      const platformVersion = global.TasuTalkPlatformNotifyMaster?.VERSION || "";
      if (chatDemoReview && typeof s.saveAll === "function") {
        const pruned = (list || []).filter((n) => {
          const src = String(n?.source || "");
          return src !== "platform_chat_demo_v1";
        });
        if (pruned.length !== (list || []).length) {
          s.saveAll(pruned, { localOnly: true, silent: true });
          list = pruned;
        }
        const profile = global.TasuPlatformChatDualWindowDemo?.getProfile?.();
        if (profile) {
          const benchEmbed = global.TasuTalkChatDemoReviewMode?.isBenchEmbedMode?.() === true;
          const benchPrePurchase = benchEmbed && liveFlow && profile.connect !== true;
          const flowKey = profile.categoryKey || profile.id;
          const marketplaceConnectEntry =
            profile.connect === true &&
            global.TasuPlatformChatCategoryFlow?.isMarketplaceConnectCategory?.(flowKey) &&
            global.TasuPlatformChatCategoryFlow?.isWorkerFlowCategory?.(flowKey) !== true &&
            global.TasuPlatformChatCategoryFlow?.isProductPurchaseFlowEnabled?.(profile) !== true;
          if (!benchPrePurchase && !marketplaceConnectEntry) {
            global.TasuPlatformChatDualWindowDemo?.ensureInitialDemoChainState?.(profile);
            list = global.TasuPlatformChatDualWindowFlow?.syncInitialDemoNotification?.(profile) || list;
          }
        }
      }
      if (
        typeof s.applyPlatformMasterV1 === "function" &&
        PLATFORM_NOTIFICATION_MASTER_V1.length &&
        !liveFlow &&
        !chatDemoReview
      ) {
        list = s.applyPlatformMasterV1(PLATFORM_NOTIFICATION_MASTER_V1);
        if (/^v3/.test(platformVersion)) {
          global.TasuPlatformChatDemoSeed?.ensureVerifyFeeDemoThreads?.();
          global.TasuPlatformChatConnectDemoSeed?.ensureConnectCompleteDemos?.();
        }
      }
      if (typeof s.applyBuilderMasterV1 === "function" && BUILDER_NOTIFICATION_MASTER_V1.length) {
        list = s.applyBuilderMasterV1(BUILDER_NOTIFICATION_MASTER_V1);
      }
      if (!/^v3/.test(platformVersion)) {
        if (typeof s.applyAnpiMasterV1 === "function" && ANPI_NOTIFICATION_MASTER_V1.length) {
          list = s.applyAnpiMasterV1(ANPI_NOTIFICATION_MASTER_V1);
        }
      }
      if (typeof s.applyOfficialTalkFieldsV1 === "function") {
        list = s.applyOfficialTalkFieldsV1(PLATFORM_NOTIFICATION_MASTER_V1);
      } else {
        global.TasuTalkOfficialRooms?.syncAllFromStore?.();
      }
      global.__tasuTalkNotificationsBootstrapped = true;
      return readNotificationList();
    } catch (err) {
      console.warn("[TasuTalkData] ensureNotifications failed:", err);
      return [];
    }
  }

  function invalidateNotificationsBootstrap() {
    global.__tasuTalkNotificationsBootstrapped = false;
  }

  /** Supabase 同期後にシード（talk-home の init 後を想定） */
  async function ensureNotificationsSynced() {
    try {
      await store()?.init?.();
    } catch (err) {
      console.warn("[TasuTalkData] notifications init failed:", err);
    }
    return ensureNotifications();
  }

  function settingsStore() {
    return global.TasuTalkNotificationSettings;
  }

  /**
   * @param {Array<object>} list
   * @param {{ applySettings?: boolean, showMuted?: boolean }} [options]
   */
  function applyUserHiddenFilter(list, options) {
    const showHidden =
      options?.showMuted === true ||
      options?.showHidden === true ||
      settingsStore()?.read?.()?.showMuted === true;

    return list
      .map((n) => ({
        ...n,
        hiddenByUser: Boolean(n.hiddenAt),
      }))
      .filter((n) => showHidden || !n.hiddenAt);
  }

  function applyInboxSettings(list, options) {
    const ss = settingsStore();
    if (!ss || options?.applySettings === false) {
      return applyUserHiddenFilter(
        list.map((n) => ({ ...n, hiddenBySettings: false, hiddenByUser: Boolean(n.hiddenAt) })),
        options
      );
    }

    const settings = ss.read?.() || ss.defaultSettings?.();
    const showMuted =
      options?.showMuted === true || (options?.showMuted !== false && settings?.showMuted === true);

    const caps = global.TasuTalkHomeLayout?.getCapabilities?.();
    const withSettings = list
      .map((n) => {
        const isOpsWatch = String(n?.source || "").toLowerCase() === "ops_watch";
        if (isOpsWatch && caps?.admin) {
          return { ...n, hiddenBySettings: false, hiddenReason: "" };
        }
        const visible = ss.isVisibleInInbox?.(n, settings) !== false;
        return {
          ...n,
          hiddenBySettings: !visible,
          hiddenReason: visible ? "" : ss.getHiddenReason?.(n, settings) || "非表示",
        };
      })
      .filter((n) => showMuted || !n.hiddenBySettings);

    return applyUserHiddenFilter(withSettings, { ...options, showMuted });
  }

  /** 運営通知 — 最上段フィルタ ID */
  const ADMIN_NOTIFY_SPECIAL_IDS = Object.freeze([
    "ops_watch",
    "ops_contact",
    "anpi",
    "report",
  ]);

  /** 運営向けカテゴリ行から除外（system / anpi は最上段・別行へ） */
  const ADMIN_NOTIFY_TYPE_CHIP_HIDE = Object.freeze(["system", "anpi"]);

  function resolveNotifyCategoryKey(n) {
    return String(n?.category || n?.notifyCategory || "")
      .trim()
      .toLowerCase();
  }

  /** OPS WATCH — source / category / type のいずれかが ops_watch */
  function isOpsWatchNotification(n) {
    if (String(n?.source || "").toLowerCase() === "ops_watch") return true;
    if (resolveNotifyCategoryKey(n) === "ops_watch") return true;
    if (normalizeNotifyFilterType(n?.type, n) === "ops_watch") return true;
    return false;
  }

  /** @alias isOpsWatchNotification */
  function isAdminOpsWatchNotification(n) {
    return isOpsWatchNotification(n);
  }

  /** @deprecated — isAdminOpsWatchNotification */
  function isAdminDailyInfoNotification(n) {
    return isAdminOpsWatchNotification(n);
  }

  /** 運営連絡 — source = admin または category = operation */
  function isAdminOpsContactNotification(n) {
    if (isAdminOpsWatchNotification(n)) return false;
    const src = String(n?.source || "").toLowerCase();
    if (src === "admin") return true;
    const cat = resolveNotifyCategoryKey(n);
    return cat === "operation" || cat === "operations";
  }

  /** 安否 — category = anpi（type フォールバック） */
  function isAdminAnpiCategoryNotification(n) {
    const cat = resolveNotifyCategoryKey(n);
    if (cat === "anpi") return true;
    return normalizeNotifyFilterType(n?.type, n) === "anpi" && !isAdminOpsWatchNotification(n);
  }

  /** 通報 — category = abuse | report */
  function isAdminReportNotification(n) {
    const cat = resolveNotifyCategoryKey(n);
    return cat === "abuse" || cat === "report";
  }

  function matchesAdminNotifySpecial(n, filterId) {
    const id = String(filterId);
    if (id === "ops_watch" || id === "daily_info") return isAdminOpsWatchNotification(n);
    if (id === "ops_contact") return isAdminOpsContactNotification(n);
    if (id === "anpi") return isAdminAnpiCategoryNotification(n);
    if (id === "report") return isAdminReportNotification(n);
    return false;
  }

  function normalizeAdminSpecialIds(adminSpecial) {
    return (Array.isArray(adminSpecial) ? adminSpecial : [])
      .map((id) => (String(id) === "daily_info" ? "ops_watch" : String(id)))
      .filter((id) => ADMIN_NOTIFY_SPECIAL_IDS.includes(id));
  }

  /**
   * @param {Array<object>} list
   * @param {string[]} adminSpecial — ops_watch | ops_contact | anpi | report
   */
  function applyAdminNotifySpecialFilter(list, adminSpecial) {
    const ids = normalizeAdminSpecialIds(adminSpecial);
    if (!ids.length) return list;
    return list.filter((n) => ids.some((id) => matchesAdminNotifySpecial(n, id)));
  }

  function countAdminNotifySpecialBuckets(notifications) {
    const admin = { ops_watch: 0, ops_contact: 0, anpi: 0, report: 0 };
    (notifications || []).forEach((n) => {
      if (isAdminOpsWatchNotification(n)) admin.ops_watch += 1;
      if (isAdminOpsContactNotification(n)) admin.ops_contact += 1;
      if (isAdminAnpiCategoryNotification(n)) admin.anpi += 1;
      if (isAdminReportNotification(n)) admin.report += 1;
    });
    return admin;
  }

  function matchesNotifyImportantFilter(n) {
    const src = String(n?.source || "").toLowerCase();
    if (src === "ops_watch") {
      return String(n?.opsWatchImportance || "").toLowerCase() === "high";
    }
    const p = String(n?.priority || "").toLowerCase();
    return p === "important" || p === "urgent";
  }

  function isOpsWatchDailySummary(n) {
    if (String(n?.source || "").toLowerCase() !== "ops_watch") return false;
    return (
      n?.opsWatchKind === "daily_summary" ||
      n?.opsWatchPinned === true ||
      String(n?.title || "").includes("日次サマリー")
    );
  }

  function getOpsWatchImportanceRank(n) {
    const imp = String(n?.opsWatchImportance || "").toLowerCase();
    if (imp === "high") return 1;
    if (imp === "medium") return 2;
    if (imp === "low") return 3;
    return 4;
  }

  function getPlatformPriorityRank(n) {
    if (global.TasuTalkPlatformNotifyMaster?.getPlatformPriorityRank) {
      return global.TasuTalkPlatformNotifyMaster.getPlatformPriorityRank(n?.priority);
    }
    const p = String(n?.priority || "normal").toLowerCase();
    if (p === "high" || p === "urgent") return 0;
    if (p === "medium" || p === "important") return 1;
    if (p === "low" || p === "normal") return 2;
    return 3;
  }

  function isPlatformMasterNotification(n) {
    return global.TasuTalkPlatformNotifyMaster?.isPlatformMasterNotification?.(n) === true;
  }

  function isBuilderMasterNotification(n) {
    return global.TasuTalkBuilderNotifyMaster?.isBuilderMasterNotification?.(n) === true;
  }

  function isAnpiMasterNotification(n) {
    return global.TasuTalkAnpiNotifyMaster?.isAnpiMasterNotification?.(n) === true;
  }

  function isTalkMasterNotification(n) {
    return (
      isPlatformMasterNotification(n) ||
      isBuilderMasterNotification(n) ||
      isAnpiMasterNotification(n)
    );
  }

  function getNotificationPriorityRank(n) {
    if (isOpsWatchDailySummary(n)) return -2;
    if (isTalkMasterNotification(n)) {
      return getPlatformPriorityRank(n);
    }
    const type = normalizeNotifyFilterType(n?.type, n);
    const p = String(n?.priority || "normal").toLowerCase();
    const unread = n?.unread !== undefined ? Boolean(n.unread) : !n?.readAt;
    if (type === "anpi" || p === "urgent") return 0;
    if (p === "important" || p === "high") return 1;
    if (p === "medium") return 2;
    if (unread) return 3;
    return 4;
  }

  /** @param {Array<object>} list */
  function sortNotificationsForDisplay(list) {
    return (list || []).slice().sort((a, b) => {
      const dailyA = isOpsWatchDailySummary(a);
      const dailyB = isOpsWatchDailySummary(b);
      if (dailyA !== dailyB) return dailyA ? -1 : 1;

      const ta = new Date(a?.createdAt || a?.created_at || 0).getTime();
      const tb = new Date(b?.createdAt || b?.created_at || 0).getTime();
      if (Number.isFinite(tb) && Number.isFinite(ta) && tb !== ta) return tb - ta;

      return String(a?.id || "").localeCompare(String(b?.id || ""));
    });
  }

  function getNotificationEmphasis(n) {
    const type = normalizeNotifyFilterType(n?.type, n);
    const p = String(n?.priority || "normal").toLowerCase();
    if (type === "anpi" || p === "urgent") return "urgent";
    if (p === "important") return "important";
    if (n?.unread) return "unread";
    return "normal";
  }

  /**
   * @param {{ filter?: string, types?: string[], adminSpecial?: string[], applySettings?: boolean, showMuted?: boolean, followOnly?: boolean, unreadOnly?: boolean, urgentOnly?: boolean, importantOnly?: boolean, anpiOnly?: boolean }} [options]
   */
  function getNotifications(options) {
    const filterId = String(options?.filter || "all");
    const typeSet = new Set(
      (Array.isArray(options?.types) ? options.types : [])
        .map((id) => String(id))
        .filter((id) => id && id !== "all")
    );
    let list = ensureNotifications();
    list = list.filter((n) => n?.sendNotification !== false);
    const s = store();

    if (typeSet.size > 0) {
      list = list.filter((n) => notificationMatchesTypeFilter(n, typeSet));
    } else if (filterId === "unread") {
      list = list.filter((n) => s?.isUnread(n));
    } else if (filterId === "ops_watch") {
      list = list.filter((n) => isOpsWatchNotification(n));
    } else if (filterId !== "all") {
      list = list.filter((n) => resolveNotifyFilterTypeId(n) === filterId);
    }

    if (options?.unreadOnly === true) {
      list = list.filter((n) => s?.isUnread(n));
    }

    list = applyInboxSettings(list, options);
    const caps = global.TasuTalkHomeLayout?.getCapabilities?.();
    if (caps && !caps.admin) {
      list = list.filter((n) => !isOpsWatchNotification(n));
      if (global.TasuTalkBuilderNotifyMaster?.isAdminOpsBuilderNotification) {
        const isFlowDemo = global.TasuTalkBuilderNotifyMaster.isBuilderOpsFlowDemoNotification;
        list = list.filter((n) => {
          if (typeof isFlowDemo === "function" && isFlowDemo(n)) return true;
          if (String(n?.source || "") === "builder-mvp") return true;
          return !global.TasuTalkBuilderNotifyMaster.isAdminOpsBuilderNotification(n);
        });
      }
    }
    list = applyFollowOnlyFilter(list, options?.followOnly === true);

    if (options?.urgentOnly === true) {
      list = list.filter((n) => String(n.priority || "").toLowerCase() === "urgent");
    }
    if (options?.importantOnly === true) {
      list = list.filter((n) => matchesNotifyImportantFilter(n));
    }
    if (options?.anpiOnly === true) {
      list = list.filter((n) => normalizeNotifyFilterType(n.type, n) === "anpi");
    }

    list = applyAdminNotifySpecialFilter(list, options?.adminSpecial);
    list = applyNotifyPeriodFilter(list, options?.period);

    const mapped = list.map((n) => ({
      ...n,
      unread: s ? s.isUnread(n) : !n.readAt,
      isFollow: isFollowNotification(n),
      emphasis: getNotificationEmphasis({
        ...n,
        unread: s ? s.isUnread(n) : !n.readAt,
      }),
    }));

    const sorted = sortNotificationsForDisplay(mapped);
    if (global.TasuTalkWorkerReviewMode?.isWorkerReviewMode?.()) {
      return global.TasuTalkWorkerReviewMode.filterWorkerReviewNotifications(sorted);
    }
    if (global.TasuTalkJobFullReviewMode?.isJobFullReviewMode?.()) {
      return global.TasuTalkJobFullReviewMode.filterJobFullReviewNotifications(sorted);
    }
    if (global.TasuTalkJobReviewMode?.isJobReviewMode?.()) {
      return global.TasuTalkJobReviewMode.filterJobReviewNotifications(sorted);
    }
    return sorted;
  }

  /** 通知フィルタ用件数（受信設定適用前の母集団） */
  function countNotificationsForFilters(options) {
    const base = getNotifications({
      filter: "all",
      applySettings: options?.applySettings !== false,
      showMuted: options?.showMuted === true,
      followOnly: false,
      unreadOnly: false,
      urgentOnly: false,
      importantOnly: false,
      anpiOnly: false,
    });
    const counts = { unread: 0, urgent: 0, important: 0, anpi: 0, follow: 0 };
    const types = {};
    base.forEach((n) => {
      const t = resolveNotifyFilterTypeId(n);
      types[t] = (types[t] || 0) + 1;
      const builderScope = resolveBuilderScopeFilterId(n);
      if (builderScope) types[builderScope] = (types[builderScope] || 0) + 1;
      if (isOfficialMirrorNotification(n)) types.official = (types.official || 0) + 1;
      if (isAiNotification(n)) types.ai = (types.ai || 0) + 1;
      if (n.unread) counts.unread += 1;
      if (String(n.priority || "").toLowerCase() === "urgent" || t === "anpi") counts.urgent += 1;
      if (matchesNotifyImportantFilter(n)) counts.important += 1;
      if (t === "anpi") counts.anpi += 1;
      if (isFollowNotification(n)) counts.follow += 1;
    });
    const admin = countAdminNotifySpecialBuckets(base);
    return { types, flags: counts, admin };
  }

  function normalizeNotifyFilterType(type, data) {
    if (global.TasuTalkCategory?.normalizeTalkNotificationType) {
      return global.TasuTalkCategory.normalizeTalkNotificationType(type, data);
    }
    return String(type || "").toLowerCase();
  }

  function isOfficialMirrorNotification(n) {
    return String(n?.category || "").trim() === "公式";
  }

  function isAiNotification(n) {
    const t = String(n?.type || "").toLowerCase();
    if (t === "ai" || t === "ai_consult") return true;
    const cat = String(n?.category || "").trim();
    if (/^ai$/i.test(cat) || /AI相談/.test(cat)) return true;
    return false;
  }

  /** フィルタ・件数用（OPS WATCH は id ops_watch として扱う） */
  function resolveNotifyFilterTypeId(n) {
    if (isOpsWatchNotification(n)) return "ops_watch";
    if (isConnectNotification(n)) return "connect";
    if (global.TasuTalkPlatformFeeNotify?.isPlatformFeeNotification?.(n)) return "platform_fee";
    return normalizeNotifyFilterType(n?.type, n);
  }

  function countRawOpsWatchInStore() {
    const all = store()?.getAll?.() || ensureNotifications();
    const opsRows = all.filter((n) => String(n?.source || "").toLowerCase() === "ops_watch");
    return {
      totalStored: all.length,
      sourceOpsWatchCount: opsRows.length,
      samples: opsRows.slice(0, 8).map((n) => ({
        id: n.id,
        source: n.source,
        type: n.type,
        category: n.category || "",
        title: String(n.title || "").slice(0, 60),
      })),
    };
  }

  function isConnectNotification(n) {
    const src = String(n?.source || "").toLowerCase();
    const cat = String(n?.category || "").toLowerCase();
    const type = String(n?.type || "").toLowerCase();
    return (
      type === "connect" ||
      type === "connect_issue" ||
      src.includes("connect") ||
      cat.includes("connect") ||
      src.includes("stripe_connect") ||
      cat.includes("stripe")
    );
  }

  /** Builder通知 — audienceScope 別フィルタ ID（builder_admin_ops | builder_board） */
  function resolveBuilderScopeFilterId(n) {
    const master = global.TasuTalkBuilderNotifyMaster;
    if (!master) return "";
    if (master.isAdminOpsBuilderNotification?.(n)) return "builder_admin_ops";
    if (master.isBuilderBoardNotification?.(n)) return "builder_board";
    if (String(n?.type || "").toLowerCase() === "builder") return "builder_board";
    return "";
  }

  function notificationMatchesTypeFilter(n, typeSet) {
    if (!typeSet || typeSet.size === 0) return true;
    if (typeSet.has("official") && isOfficialMirrorNotification(n)) return true;
    if (typeSet.has("ai") && isAiNotification(n)) return true;
    const filterId = resolveNotifyFilterTypeId(n);
    if (typeSet.has(filterId)) return true;
    const builderScope = resolveBuilderScopeFilterId(n);
    if (builderScope && typeSet.has(builderScope)) return true;
    return false;
  }

  function applyNotifyPeriodFilter(list, periodId) {
    const pid = String(periodId || "all");
    if (!pid || pid === "all") return list;
    const row = NOTIFY_PERIOD_FILTERS.find((p) => p.id === pid);
    if (!row?.days) return list;
    const cutoff = Date.now() - row.days * 24 * 60 * 60 * 1000;
    return (list || []).filter((n) => {
      const ts = new Date(n?.createdAt || n?.created_at || 0).getTime();
      return Number.isFinite(ts) && ts >= cutoff;
    });
  }

  function countNotificationsForCategoryChips(options) {
    const counts = countNotificationsForFilters(options);
    return NOTIFY_CATEGORY_CHIP_DEFS.map((chip) => ({
      ...chip,
      count: (chip.filterTypes || []).reduce(
        (sum, typeId) => sum + (Number(counts.types?.[typeId]) || 0),
        0
      ),
    }));
  }

  /**
   * 通知一覧パイプライン監査（ops_watch 除外箇所の特定）
   * @param {object} [options] — getNotifications と同じ
   */
  function traceNotificationPipeline(options) {
    const opts = options || {};
    const typeSet = new Set(
      (Array.isArray(opts.types) ? opts.types : [])
        .map((id) => String(id))
        .filter((id) => id && id !== "all")
    );
    const filterId = String(opts.filter || "all");
    const caps = global.TasuTalkHomeLayout?.getCapabilities?.() || {};
    const s = store();

    let list = ensureNotifications();
    const step = (name, rows, extra) => {
      const ops = rows.filter((n) => String(n?.source || "").toLowerCase() === "ops_watch");
      return { name, total: rows.length, sourceOpsWatch: ops.length, ...extra };
    };

    const audit = {
      rawStore: countRawOpsWatchInStore(),
      capsAdmin: Boolean(caps.admin),
      steps: [],
    };

    audit.steps.push(step("1_ensureNotifications", list));

    if (typeSet.size > 0) {
      const before = list.length;
      list = list.filter((n) => notificationMatchesTypeFilter(n, typeSet));
      audit.steps.push(
        step("2_typeFilter", list, {
          typeSet: [...typeSet],
          removed: before - list.length,
        })
      );
    } else if (filterId === "unread") {
      list = list.filter((n) => s?.isUnread(n));
      audit.steps.push(step("2_unreadFilter", list));
    } else if (filterId === "ops_watch") {
      list = list.filter((n) => isOpsWatchNotification(n));
      audit.steps.push(step("2_ops_watchFilter", list));
    } else if (filterId !== "all") {
      list = list.filter((n) => resolveNotifyFilterTypeId(n) === filterId);
      audit.steps.push(step("2_legacyFilterId", list, { filterId }));
    } else {
      audit.steps.push(step("2_noTypeFilter", list));
    }

    if (opts.unreadOnly === true) {
      list = list.filter((n) => s?.isUnread(n));
      audit.steps.push(step("3_unreadOnly", list));
    }

    const beforeSettings = list.length;
    list = applyInboxSettings(list, opts);
    const hiddenBySettings = beforeSettings - list.length;
    audit.steps.push(
      step("4_applyInboxSettings", list, {
        applySettings: opts.applySettings !== false,
        showMuted: opts.showMuted === true,
        removed: hiddenBySettings,
      })
    );

    const beforeAdminGate = list.length;
    if (caps && !caps.admin) {
      list = list.filter((n) => !isOpsWatchNotification(n));
      audit.steps.push(
        step("5_adminGate_removed_ops_watch", list, {
          removed: beforeAdminGate - list.length,
          reason: "!caps.admin",
        })
      );
    } else {
      audit.steps.push(step("5_adminGate_pass", list, { admin: true }));
    }

    list = applyAdminNotifySpecialFilter(list, opts.adminSpecial);
    audit.steps.push(step("6_adminSpecialFilter", list, {
      adminSpecial: opts.adminSpecial || [],
    }));

    const beforeModeFilter = list.length;
    let modeFilterName = "none";
    if (global.TasuTalkWorkerReviewMode?.isWorkerReviewMode?.()) {
      list = global.TasuTalkWorkerReviewMode.filterWorkerReviewNotifications(list);
      modeFilterName = "worker_review";
    } else if (global.TasuTalkJobFullReviewMode?.isJobFullReviewMode?.()) {
      list = global.TasuTalkJobFullReviewMode.filterJobFullReviewNotifications(list);
      modeFilterName = "chat_demo_review";
    } else if (global.TasuTalkJobReviewMode?.isJobReviewMode?.()) {
      list = global.TasuTalkJobReviewMode.filterJobReviewNotifications(list);
      modeFilterName = "job_review";
    }
    audit.steps.push(
      step(`7_modeFilter_${modeFilterName}`, list, {
        removed: beforeModeFilter - list.length,
      })
    );

    audit.finalCount = list.length;
    audit.finalOpsWatch = list.filter(
      (n) => String(n?.source || "").toLowerCase() === "ops_watch"
    ).length;
    audit.adminFilterCounts = countAdminNotifySpecialBuckets(list);
    return audit;
  }

  function isFollowNotification(notification) {
    return String(notification?.source || "").trim().toLowerCase() === "follow";
  }

  /** OPS WATCH 通知の保存フィールド調査（console デバッグ用） */
  function inspectOpsWatchNotificationStorage() {
    const all = ensureNotifications();
    const opsRows = all.filter(
      (n) =>
        String(n?.source || "").toLowerCase() === "ops_watch" ||
        isAdminOpsWatchNotification(n)
    );
    const byKey = {};
    opsRows.forEach((n) => {
      const src = String(n?.source || "");
      const type = String(n?.type || "");
      const category = String(n?.category || n?.notifyCategory || "");
      const key = `${src}|${type}|${category}`;
      byKey[key] = (byKey[key] || 0) + 1;
    });
    return {
      totalNotifications: all.length,
      opsWatchRelatedCount: opsRows.length,
      breakdownBySourceTypeCategory: byKey,
      samples: opsRows.slice(0, 20).map((n) => ({
        id: n.id,
        source: n.source,
        type: n.type,
        category: n.category || n.notifyCategory || "",
        title: String(n.title || "").slice(0, 80),
        opsWatchCategoryId: n.opsWatchCategoryId || "",
        opsWatchKind: n.opsWatchKind || "",
        opsWatchImportance: n.opsWatchImportance || "",
      })),
      expectedOnDeliver: {
        source: "ops_watch",
        type: "system",
        category: "(未設定 — talk-notifications-store に category は通常空)",
      },
    };
  }

  /**
   * @param {Array<object>} list
   * @param {boolean} followOnly
   */
  function applyFollowOnlyFilter(list, followOnly) {
    if (!followOnly) return list;
    return list.filter(isFollowNotification);
  }

  function countHiddenBySettings() {
    const ss = settingsStore();
    if (!ss) return 0;
    const settings = ss.read();
    const all = ensureNotifications();
    return all.filter((n) => !ss.isVisibleInInbox(n, settings)).length;
  }

  function countUserHiddenNotifications() {
    return ensureNotifications().filter((n) => Boolean(n.hiddenAt)).length;
  }

  function markNotificationRead(id) {
    return store()?.markRead(id) || null;
  }

  function markNotificationUnread(id) {
    return store()?.markUnread?.(id) || null;
  }

  function hideNotification(id) {
    return store()?.hideNotification?.(id) || null;
  }

  function unhideNotification(id) {
    return store()?.unhideNotification?.(id) || null;
  }

  function findNotificationById(id) {
    return (
      global.TasuTalkNotifications?.findById?.(id) ||
      store()?.findById?.(id) ||
      null
    );
  }

  /**
   * 外部から通知を追加
   * @param {object} input
   */
  function addNotification(input) {
    const s = store();
    if (!s) {
      throw new Error("[TasuTalkData] TasuTalkNotifications store is not loaded");
    }
    ensureNotifications();
    return s.add(input);
  }

  /** AI 下書き → 通知（TasuTalkAiDrafts に委譲） */
  function addNotificationFromAiDraft(draft) {
    try {
      return global.TasuTalkAiDrafts?.pushAsNotification?.(draft) || { ok: false };
    } catch (err) {
      console.warn("[TasuTalkData] addNotificationFromAiDraft failed:", err);
      return { ok: false, reason: String(err) };
    }
  }

  /** 配信下書き → テスト通知（ステータス変更なし） */
  function addTestNotificationFromBroadcastDraft(row) {
    try {
      return global.TasuTalkBroadcastDrafts?.pushTestNotification?.(row) || { ok: false };
    } catch (err) {
      console.warn("[TasuTalkData] addTestNotificationFromBroadcastDraft failed:", err);
      return { ok: false, reason: String(err) };
    }
  }

  /** 配信下書き → 本番一斉送信 */
  async function sendBroadcastDraft(id) {
    try {
      const fn = global.TasuTalkBroadcastDrafts?.sendBroadcastDraft;
      if (typeof fn !== "function") {
        return { ok: false, reason: "store_missing" };
      }
      return await fn(id);
    } catch (err) {
      console.warn("[TasuTalkData] sendBroadcastDraft failed:", err);
      return { ok: false, reason: String(err) };
    }
  }

  /** @deprecated 互換 */
  function sendBroadcastDraftMock(id) {
    return sendBroadcastDraft(id);
  }

  function getInboxNotifications() {
    return getNotifications({
      filter: "all",
      applySettings: true,
      showMuted: false,
      showHidden: false,
    });
  }

  function getUnreadCount() {
    return getInboxNotifications().filter((n) => n.unread).length;
  }

  /**
   * フォロー通知の集計（Phase9 受信設定・showMuted OFF）
   */
  function getFollowNotificationStats() {
    const list = getInboxNotifications().filter(isFollowNotification);
    let unread = 0;
    let urgent = 0;
    let important = 0;

    list.forEach((n) => {
      if (n.unread) unread += 1;
      const p = String(n.priority || "normal").toLowerCase();
      if (p === "urgent") urgent += 1;
      else if (p === "important") important += 1;
    });

    return {
      total: list.length,
      unread,
      urgent,
      important,
    };
  }

  /**
   * ダッシュボード用サマリー（Phase9 受信設定反映・showMuted OFF）
   */
  function getDashboardStats() {
    try {
      return computeDashboardStats();
    } catch (err) {
      console.warn("[TasuTalkData] getDashboardStats failed:", err);
      return emptyDashboardStats();
    }
  }

  function emptyDashboardStats() {
    return {
      unread: 0,
      urgent: 0,
      important: 0,
      anpiUnread: 0,
      anpiUrgent: 0,
      followUnread: 0,
      followUrgent: 0,
      followImportant: 0,
      followTotal: 0,
      aiDraftCount: 0,
      broadcastCount: 0,
      broadcastUnsent: 0,
      opsWatchUnread: 0,
    };
  }

  function getUnifiedInboxCategoryFiltersForUi() {
    const list = [...UNIFIED_INBOX_CATEGORY_FILTERS];
    if (global.TasuTalkHomeLayout?.filterUnifiedInboxCategoryFilters) {
      return global.TasuTalkHomeLayout.filterUnifiedInboxCategoryFilters(list);
    }
    const caps = global.TasuTalkHomeLayout?.getCapabilities?.() || {};
    if (!caps.admin) return list.filter((f) => f.id !== "ops_watch");
    return list;
  }

  function computeDashboardStats() {
    const list = getInboxNotifications();
    let unread = 0;
    let urgent = 0;
    let important = 0;

    list.forEach((n) => {
      if (n.unread) unread += 1;
      const p = String(n.priority || "normal").toLowerCase();
      if (p === "urgent") urgent += 1;
      else if (p === "important") important += 1;
    });

    const follow = getFollowNotificationStats();

    let aiDraftCount = 0;
    try {
      const drafts = global.TasuTalkAiDrafts?.readAll?.() || [];
      aiDraftCount = drafts.filter((d) => d.status !== "discarded").length;
    } catch (err) {
      console.warn("[TasuTalkData] ai draft count failed:", err);
    }

    let broadcastCount = 0;
    let broadcastUnsent = 0;
    try {
      const rows = global.TasuTalkBroadcastDrafts?.readAll?.() || [];
      broadcastCount = rows.filter((r) => r.status !== "discarded").length;
      broadcastUnsent = rows.filter((r) => r.status === "draft" || r.status === "scheduled").length;
    } catch (err) {
      console.warn("[TasuTalkData] broadcast count failed:", err);
    }

    let anpiUnread = 0;
    let anpiUrgent = 0;
    let opsWatchUnread = 0;
    list.forEach((n) => {
      if (!n.unread) return;
      if (normalizeNotifyFilterType(n.type, n) === "anpi") {
        anpiUnread += 1;
        anpiUrgent += 1;
      }
      if (isOpsWatchNotification(n)) opsWatchUnread += 1;
    });

    return {
      unread,
      urgent,
      important,
      anpiUnread,
      anpiUrgent,
      opsWatchUnread,
      followUnread: follow.unread,
      followUrgent: follow.urgent,
      followImportant: follow.important,
      followTotal: follow.total,
      aiDraftCount,
      broadcastCount,
      broadcastUnsent,
    };
  }

  /**
   * 重要なお知らせ（urgent / important かつ未読、最大 limit 件）
   * @param {number} [limit]
   */
  function getImportantNotifications(limit) {
    const max = Math.min(Number(limit) || 3, 10);
    const s = store();
    const rows = getInboxNotifications()
      .filter((n) => {
        const p = String(n.priority || "normal").toLowerCase();
        const unread = s ? s.isUnread(n) : !n.readAt;
        return unread && (p === "urgent" || p === "important");
      })
      .map((n) => ({
        ...n,
        unread: s ? s.isUnread(n) : !n.readAt,
        emphasis: getNotificationEmphasis({
          ...n,
          unread: s ? s.isUnread(n) : !n.readAt,
        }),
      }));
    return sortNotificationsForDisplay(rows).slice(0, max);
  }

  /**
   * @param {Array<object>} threads
   * @param {number} [limit]
   */
  function getRecentChats(threads, limit) {
    const max = Math.min(Number(limit) || 3, 10);
    const list = filterNotificationCenterThreads(
      Array.isArray(threads) ? threads.filter((t) => !t._staticCard) : []
    );
    return sortChatThreads(list).slice(0, max);
  }

  function getBroadcastDraftSummary() {
    try {
      const rows = global.TasuTalkBroadcastDrafts?.readAll?.() || [];
      const active = rows.filter((r) => r.status !== "discarded");
      const unsent = active.filter((r) => r.status === "draft" || r.status === "scheduled");
      return {
        total: active.length,
        unsent: unsent.length,
      };
    } catch {
      return { total: 0, unsent: 0 };
    }
  }

  function getNotificationSettings() {
    return settingsStore()?.read?.() || settingsStore()?.defaultSettings?.() || null;
  }

  function saveNotificationSettings(settings) {
    return settingsStore()?.write?.(settings) || null;
  }

  function resetNotificationSettings() {
    return settingsStore()?.reset?.() || null;
  }

  const RECENT_ACTIONS_KEY = "tasful_talk_recent_actions";
  const RECENT_ACTIONS_MAX = 5;

  const QUICK_ACTIONS = Object.freeze([
    { id: "chatSearch", label: "チャットを探す" },
    { id: "notify", label: "通知を見る" },
    { id: "ai", label: "AIで作成" },
    { id: "createJob", label: "求人を作る" },
    { id: "createProject", label: "案件を作る" },
    { id: "createAd", label: "広告文を作る" },
    { id: "createNotice", label: "通知文を作る" },
    { id: "broadcastDrafts", label: "配信下書きを見る" },
  ]);

  function getQuickAction(actionId) {
    const id = String(actionId || "").trim();
    return QUICK_ACTIONS.find((a) => a.id === id) || null;
  }

  function readRecentActions() {
    try {
      const raw = global.localStorage.getItem(RECENT_ACTIONS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((r) => r && typeof r.id === "string")
        .map((r) => {
          const id = String(r.id);
          const def = getQuickAction(id);
          return {
            id,
            label: String(r.label || def?.label || id),
            at: String(r.at || ""),
          };
        })
        .slice(0, RECENT_ACTIONS_MAX);
    } catch (err) {
      console.warn("[TasuTalkData] readRecentActions failed:", err);
      return [];
    }
  }

  function pushRecentAction(actionId, meta) {
    const id = String(actionId || "").trim();
    const def = getQuickAction(id);
    const label = String(meta?.label || def?.label || id).trim();
    if (!label) return readRecentActions();
    const row = {
      id: def?.id || id,
      label,
      at: new Date().toISOString(),
    };
    let list = readRecentActions().filter((r) => r.id !== row.id);
    list.unshift(row);
    list = list.slice(0, RECENT_ACTIONS_MAX);
    try {
      global.localStorage.setItem(RECENT_ACTIONS_KEY, JSON.stringify(list));
    } catch (err) {
      console.warn("[TasuTalkData] pushRecentAction failed:", err);
    }
    return list;
  }

  const UNIFIED_KIND_LABELS = Object.freeze({
    notification: "通知",
    ai_draft: "AI下書き",
    broadcast_draft: "配信下書き",
    static: "ショートカット",
  });

  const UNIFIED_INBOX_KIND_FILTERS = Object.freeze([
    { id: "all", label: "すべて" },
    { id: "notification", label: "通知" },
    { id: "ai_draft", label: "AI下書き" },
    { id: "broadcast_draft", label: "配信下書き" },
  ]);

  const UNIFIED_INBOX_READ_FILTERS = Object.freeze([
    { id: "all", label: "すべて" },
    { id: "unread", label: "未読のみ" },
    { id: "read", label: "既読のみ" },
  ]);

  const UNIFIED_INBOX_CATEGORY_FILTERS = Object.freeze([
    { id: "all", label: "すべて" },
    { id: "skill", label: "スキル" },
    { id: "worker", label: "ワーカー" },
    { id: "job", label: "求人" },
    { id: "product", label: "商品" },
    { id: "shop", label: "店舗・販売" },
    { id: "business", label: "業務サービス" },
    { id: "builder", label: "Builder" },
    { id: "ai_consult", label: "AI相談" },
    { id: "system", label: "運営" },
    { id: "ops_watch", label: "OPS WATCH" },
    { id: "ad", label: "広告" },
    { id: "notice", label: "通知文" },
    { id: "anpi", label: "安否" },
  ]);

  const UNIFIED_STATIC_ITEMS = Object.freeze([
    {
      kind: "static",
      id: "unified-static-builder",
      staticType: "builder",
      category: "builder",
      title: "Builder 案件チャット",
      summary: "工事・協力会社との案件スレッドは Builder で管理します",
      updatedAt: new Date(now - 1000 * 60 * 3).toISOString(),
      unread: false,
      quickAction: "broadcastDrafts",
      quickActionLabel: "Builderを開く",
    },
    {
      kind: "static",
      id: "unified-static-ai",
      staticType: "ai",
      category: "system",
      title: "AIで作成",
      summary: "求人・案件・広告・通知文の下書きを AI タブで作成",
      updatedAt: new Date(now - 1000 * 60 * 2).toISOString(),
      unread: false,
      quickAction: "ai",
      quickActionLabel: "AIタブへ",
    },
    {
      kind: "static",
      id: "unified-static-broadcast",
      staticType: "broadcast",
      category: "system",
      title: "配信下書き一覧",
      summary: "未送信・予約中の配信を確認・送信",
      updatedAt: new Date(now - 1000 * 60).toISOString(),
      unread: false,
      quickAction: "broadcastDrafts",
      quickActionLabel: "配信を見る",
    },
  ]);

  function normalizeUnifiedCategory(item) {
    if (!item) return "system";
    if (item.kind === "ai_draft") {
      const mode = global.TasuTalkAiDrafts?.normalizeMode?.(item.raw?.mode) || item.raw?.mode;
      if (mode === "ad") return "ad";
      if (mode === "notice") return "notice";
      if (mode === "job") return "job";
      if (mode === "project") return "skill";
      return "system";
    }
    if (item.kind === "broadcast_draft") {
      const k = String(item.raw?.kind || "system").toLowerCase();
      if (k === "project") return "skill";
      return k;
    }
    if (item.kind === "notification") {
      return resolveNotifyFilterTypeId(item.raw);
    }
    return String(item.category || "system").toLowerCase();
  }

  function notificationToUnifiedItem(n) {
    const unread = Boolean(n.unread);
    const emphasis = n.emphasis || getNotificationEmphasis(n);
    return {
      kind: "notification",
      id: String(n.id),
      category: resolveNotifyFilterTypeId(n),
      title: String(n.title || "（無題）"),
      summary: String(n.body || "").slice(0, 120),
      updatedAt: String(n.createdAt || n.updatedAt || ""),
      unread,
      priority: String(n.priority || "normal"),
      emphasis,
      isAnpi: normalizeNotifyFilterType(n.type, n) === "anpi",
      raw: n,
    };
  }

  function aiDraftToUnifiedItem(d) {
    const modeLabel = global.TasuTalkAiDrafts?.modeLabel?.(d.mode) || d.mode;
    const excerpt =
      global.TasuTalkAiDrafts?.excerpt?.(d.output, 80) || String(d.output || "").slice(0, 80);
    return {
      kind: "ai_draft",
      id: String(d.id),
      category: normalizeUnifiedCategory({ kind: "ai_draft", raw: d }),
      title: `${modeLabel}の下書き`,
      summary: excerpt || "（出力なし）",
      updatedAt: String(d.updatedAt || d.createdAt || ""),
      unread: d.status === "draft",
      raw: d,
    };
  }

  function broadcastToUnifiedItem(r) {
    const store = global.TasuTalkBroadcastDrafts;
    const kindLabel = store?.KIND_LABELS?.[r.kind] || r.kind;
    const statusLabel = store?.STATUS_LABELS?.[r.status] || r.status;
    return {
      kind: "broadcast_draft",
      id: String(r.id),
      category: normalizeUnifiedCategory({ kind: "broadcast_draft", raw: r }),
      title: String(r.title || "（無題）"),
      summary: `${kindLabel} · ${statusLabel} · ${store?.segmentLabel?.(r.targetSegment) || r.targetSegment}`,
      updatedAt: String(r.updatedAt || r.createdAt || ""),
      unread: r.status === "draft" || r.status === "scheduled",
      raw: r,
    };
  }

  function collectUnifiedInboxSourceItems() {
    const items = [];
    UNIFIED_STATIC_ITEMS.forEach((s) => items.push({ ...s }));

    try {
      const notifyRows = sortNotificationsForDisplay(
        getInboxNotifications().filter((n) => Boolean(n.unread))
      ).slice(0, 15);
      notifyRows.forEach((n) => items.push(notificationToUnifiedItem(n)));
    } catch (err) {
      console.warn("[TasuTalkData] unified notifications failed:", err);
    }

    try {
      const aiRows = global.TasuTalkAiDrafts?.listRecent?.({ limit: 5 }) || [];
      aiRows.forEach((d) => items.push(aiDraftToUnifiedItem(d)));
    } catch (err) {
      console.warn("[TasuTalkData] unified ai drafts failed:", err);
    }

    try {
      const bcRows = global.TasuTalkBroadcastDrafts?.listPending?.({ limit: 5 }) || [];
      bcRows.forEach((r) => items.push(broadcastToUnifiedItem(r)));
    } catch (err) {
      console.warn("[TasuTalkData] unified broadcast drafts failed:", err);
    }

    return items;
  }

  /**
   * @param {Array<object>} items
   * @param {{
   *   kind?: string,
   *   kinds?: string[],
   *   read?: string,
   *   reads?: string[],
   *   category?: string,
   *   categories?: string[],
   *   urgentOnly?: boolean,
   *   followOnly?: boolean,
   *   importantOnly?: boolean,
   *   anpiOnly?: boolean,
   * }} [options]
   */
  function applyUnifiedInboxFilters(items, options) {
    const kindSet = new Set(
      (Array.isArray(options?.kinds) ? options.kinds : [])
        .map((id) => String(id))
        .filter((id) => id && id !== "all")
    );
    const readSet = new Set(
      (Array.isArray(options?.reads) ? options.reads : [])
        .map((id) => String(id))
        .filter((id) => id && id !== "all")
    );
    const categorySet = new Set(
      (Array.isArray(options?.categories) ? options.categories : [])
        .map((id) => String(id))
        .filter((id) => id && id !== "all")
    );
    const kind = kindSet.size ? "" : String(options?.kind || "all");
    const read = readSet.size ? "" : String(options?.read || "all");
    const category = categorySet.size ? "" : String(options?.category || "all");

    function matchRead(item) {
      if (readSet.size > 0) {
        if (readSet.has("unread") && item.unread) return true;
        if (readSet.has("read") && !item.unread) return true;
        return false;
      }
      if (read === "unread" && !item.unread) return false;
      if (read === "read" && item.unread) return false;
      return true;
    }

    const staticRows = (items || []).filter((item) => item.kind === "static");
    const dynamic = (items || []).filter((item) => {
      if (item.kind === "static") return false;
      if (kindSet.size > 0 && !kindSet.has(item.kind)) return false;
      if (kind !== "all" && item.kind !== kind) return false;
      if (!matchRead(item)) return false;
      if (categorySet.size > 0 && !categorySet.has(normalizeUnifiedCategory(item))) return false;
      if (category !== "all" && normalizeUnifiedCategory(item) !== category) return false;
      if (options?.urgentOnly === true) {
        const urgent =
          item.emphasis === "urgent" ||
          item.isAnpi === true ||
          String(item.priority || "").toLowerCase() === "urgent";
        if (!urgent) return false;
      }
      if (options?.importantOnly === true) {
        if (item.emphasis !== "important" && String(item.priority || "").toLowerCase() !== "important") {
          return false;
        }
      }
      if (options?.anpiOnly === true && !item.isAnpi) return false;
      if (options?.followOnly === true && item.kind === "notification") {
        if (!isFollowNotification(item.raw)) return false;
      }
      return true;
    });
    const showStatic = kindSet.size === 0 && (kind === "all" || kind === "static");
    const filteredStatic = showStatic
      ? staticRows.filter((item) => {
          if (categorySet.size > 0 && !categorySet.has(normalizeUnifiedCategory(item))) return false;
          if (category !== "all" && normalizeUnifiedCategory(item) !== category) return false;
          return true;
        })
      : kindSet.has("static")
        ? staticRows.filter((item) => {
            if (categorySet.size > 0 && !categorySet.has(normalizeUnifiedCategory(item))) return false;
            return true;
          })
        : [];
    return [...filteredStatic, ...dynamic];
  }

  function countUnifiedInboxForFilters(items) {
    const all = items || [];
    const kinds = {};
    const categories = {};
    const reads = { unread: 0, read: 0 };
    const flags = { urgent: 0, important: 0, anpi: 0, follow: 0 };
    all.forEach((item) => {
      kinds[item.kind] = (kinds[item.kind] || 0) + 1;
      const cat = normalizeUnifiedCategory(item);
      categories[cat] = (categories[cat] || 0) + 1;
      if (item.unread) reads.unread += 1;
      else reads.read += 1;
      if (
        item.emphasis === "urgent" ||
        item.isAnpi ||
        String(item.priority || "").toLowerCase() === "urgent"
      ) {
        flags.urgent += 1;
      }
      if (item.emphasis === "important" || String(item.priority || "").toLowerCase() === "important") {
        flags.important += 1;
      }
      if (item.isAnpi) flags.anpi += 1;
      if (item.kind === "notification" && isFollowNotification(item.raw)) flags.follow += 1;
    });
    return { kinds, categories, reads, flags };
  }

  function getUnifiedItemSortRank(item) {
    if (item.kind === "notification") {
      if (item.isAnpi || item.emphasis === "urgent") return 0;
      if (item.emphasis === "important") return 1;
      if (item.unread) return 2;
      return 3;
    }
    if (item.unread) return 2;
    return 4;
  }

  function sortUnifiedInboxItems(items) {
    const staticRows = (items || []).filter((i) => i.kind === "static");
    const dynamic = (items || []).filter((i) => i.kind !== "static");
    dynamic.sort((a, b) => {
      const ra = getUnifiedItemSortRank(a);
      const rb = getUnifiedItemSortRank(b);
      if (ra !== rb) return ra - rb;
      const au = a.unread ? 1 : 0;
      const bu = b.unread ? 1 : 0;
      if (bu !== au) return bu - au;
      return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
    });
    return [...staticRows, ...dynamic];
  }

  /**
   * @param {{ kind?: string, read?: string, category?: string, urgentOnly?: boolean, followOnly?: boolean, importantOnly?: boolean, anpiOnly?: boolean }} [options]
   */
  function getUnifiedInboxItems(options) {
    const filtered = applyUnifiedInboxFilters(collectUnifiedInboxSourceItems(), options);
    return sortUnifiedInboxItems(filtered);
  }

  function buildUnifiedAiDraftActions(draft) {
    const actions = [
      { id: "ai-copy", label: "コピー", kind: "default" },
      { id: "ai-to-notify", label: "通知追加", kind: "secondary" },
      { id: "ai-regenerate", label: "再生成", kind: "default" },
      { id: "ai-discard", label: "破棄", kind: "danger", confirm: "このAI下書きを破棄しますか？" },
    ];
    const mode = global.TasuTalkAiDrafts?.normalizeMode?.(draft?.mode) || draft?.mode;
    if (global.TasuTalkAiDrafts?.canPushAsNotification?.(mode) === false) {
      return actions.filter((a) => a.id !== "ai-to-notify");
    }
    return actions;
  }

  function buildUnifiedBroadcastActions(row) {
    const store = global.TasuTalkBroadcastDrafts;
    const actions = [
      { id: "broadcast-view", label: "確認", kind: "default" },
      { id: "broadcast-test", label: "テスト送信", kind: "secondary" },
    ];
    if (store?.canBroadcastSend?.(row)) {
      actions.push({ id: "broadcast-send", label: "本番送信", kind: "primary" });
    }
    if (Array.isArray(row?.sendHistory) && row.sendHistory.length) {
      actions.push({ id: "broadcast-history", label: "履歴確認", kind: "secondary" });
    }
    actions.push({
      id: "broadcast-delete",
      label: "削除",
      kind: "danger",
      confirm: "この配信下書きを削除しますか？",
    });
    return actions;
  }

  /**
   * @param {object} item
   */
  function buildUnifiedItemActions(item) {
    if (!item) return [];
    if (item.kind === "static") {
      return [
        {
          id: "static-run",
          label: item.quickActionLabel || "開く",
          kind: "primary",
          quickAction: item.quickAction,
        },
      ];
    }
    if (item.kind === "notification") {
      return global.TasuTalkNotifyActions?.buildNotificationActions?.(item.raw) || [];
    }
    if (item.kind === "ai_draft") {
      return buildUnifiedAiDraftActions(item.raw);
    }
    if (item.kind === "broadcast_draft") {
      return buildUnifiedBroadcastActions(item.raw);
    }
    return [];
  }

  function getUnifiedCategoryLabel(categoryId) {
    const id = String(categoryId || "system");
    return (
      NOTIFICATION_TYPES[id]?.label ||
      UNIFIED_INBOX_CATEGORY_FILTERS.find((c) => c.id === id)?.label ||
      id
    );
  }

  function getMockExtraChats() {
    return MOCK_EXTRA_CHATS.map((t) => ({ ...t }));
  }

  function getBuilderHub() {
    return { ...BUILDER_HUB };
  }

  global.TasuTalkData = {
    TALK_CATEGORY_BAR_DEFS,
    NOTIFY_MOBILE_CATEGORY_CHIPS,
    NOTIFY_CATEGORY_CHIP_DEFS,
    NOTIFY_PERIOD_FILTERS,
    LINE_CATEGORY_TABS,
    LINE_LIST_FILTERS,
    CHAT_CHANNELS,
    CHAT_EMPTY_MESSAGE,
    QUICK_ACTIONS,
    RECENT_ACTIONS_KEY,
    RECENT_ACTIONS_MAX,
    getQuickAction,
    readRecentActions,
    pushRecentAction,
    UNIFIED_KIND_LABELS,
    UNIFIED_INBOX_KIND_FILTERS,
    UNIFIED_INBOX_READ_FILTERS,
    UNIFIED_INBOX_CATEGORY_FILTERS,
    getUnifiedInboxItems,
    collectUnifiedInboxSourceItems,
    sortNotificationsForDisplay,
    getNotificationEmphasis,
    buildUnifiedItemActions,
    getUnifiedCategoryLabel,
    NOTIFICATION_TYPES,
    NOTIFICATION_FILTERS,
    getNotificationFiltersForUi,
    PRIORITY_META,
    FUTURE_CAPABILITIES,
    SEED_NOTIFICATIONS,
    PLATFORM_NOTIFICATION_MASTER_V1,
    BUILDER_NOTIFICATION_MASTER_V1,
    ANPI_NOTIFICATION_MASTER_V1,
    PLATFORM_CATEGORY_META,
    PRESERVED_SPECIAL_NOTIFICATIONS,
    isPlatformMasterNotification,
    isBuilderMasterNotification,
    isAnpiMasterNotification,
    isTalkMasterNotification,
    getPlatformPriorityRank,
    getNotifications,
    countHiddenBySettings,
    countUserHiddenNotifications,
    markNotificationUnread,
    hideNotification,
    unhideNotification,
    findNotificationById,
    getNotificationSettings,
    saveNotificationSettings,
    resetNotificationSettings,
    ensureNotificationsSynced,
    invalidateNotificationsBootstrap,
    readNotificationList,
    markNotificationRead,
    addNotification,
    addNotificationFromAiDraft,
    addTestNotificationFromBroadcastDraft,
    sendBroadcastDraft,
    sendBroadcastDraftMock,
    getUnreadCount,
    getInboxNotifications,
    isFollowNotification,
    getFollowNotificationStats,
    getDashboardStats,
    getImportantNotifications,
    getRecentChats,
    getBroadcastDraftSummary,
    getMockExtraChats,
    getBuilderHub,
    getStaticChatHubCards,
    normalizeChatChannelId,
    getChatChannelLabel,
    resolveChatChannel,
    matchesChatSearch,
    sortChatThreads,
    applyChatHubFilters,
    applyLineCategoryListFilter,
    resolveLineCategoryTab,
    matchesLineCategoryFilter,
    countChatThreadsByChannel,
    countNotificationsForFilters,
    countNotificationsForCategoryChips,
    ADMIN_NOTIFY_SPECIAL_IDS,
    ADMIN_NOTIFY_TYPE_CHIP_HIDE,
    isOpsWatchNotification,
    isAdminOpsWatchNotification,
    getUnifiedInboxCategoryFiltersForUi,
    isAdminOpsContactNotification,
    isAdminAnpiCategoryNotification,
    isAdminReportNotification,
    isAdminDailyInfoNotification,
    countAdminNotifySpecialBuckets,
    normalizeAdminSpecialIds,
    applyAdminNotifySpecialFilter,
    inspectOpsWatchNotificationStorage,
    countRawOpsWatchInStore,
    traceNotificationPipeline,
    resolveNotifyFilterTypeId,
    countUnifiedInboxForFilters,
    buildChatDisplayList,
    markAllNotificationCenterRead,
    threadHasImportantUnread,
    filterNotificationCenterThreads,
    isNotificationCenterListItem,
    isTransactionPartnerThread,
    resolveChatListingUrl,
    resolveChatTalkHref,
    shouldOpenInlineRoom,
    resolveThreadExternalHref,
  };
})(typeof window !== "undefined" ? window : globalThis);
