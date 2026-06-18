/**
 * TASFUL TALK — ホーム UI（チャット / 通知 / AI）
 */
(function () {
  "use strict";

  const global = globalThis;

  const TAB_IDS = ["chat", "notify", "ai"];

  let activeTab = "chat";
  /** @type {string} LINE左ナビ — talk | project | job | … */
  let activeLineNav = "talk";
  /** @type {string} 中央一覧クイックフィルタ */
  let lineListFilterId = "all";
  let chatSearchQuery = "";
  /** @type {Set<string>} */
  let chatFilterChannels = new Set();
  let chatFilterUnread = false;
  let chatFilterImportant = false;
  let notifySearchQuery = "";
  /** @type {Set<string>} */
  let notifyFilterTypes = new Set();
  let notifyFilterUnread = false;
  let notifyFilterUrgent = false;
  let notifyFilterImportant = false;
  let notifyFilterAnpi = false;
  let notifyFilterFollow = false;
  /** @type {string} today | 7d | 30d | all */
  let notifyFilterPeriod = "all";
  /** @type {Set<string>} 運営用 — ops_watch | ops_contact | anpi | report */
  let notifyFilterAdminSpecial = new Set();
  /** @type {Set<string>} */
  let unifiedFilterKinds = new Set();
  /** @type {Set<string>} */
  let unifiedFilterCategories = new Set();
  /** @type {Set<string>} */
  let unifiedFilterReads = new Set();
  let unifiedFilterUrgent = false;
  let unifiedFilterImportant = false;
  let unifiedFilterAnpi = false;
  let unifiedFilterFollow = false;
  let chatThreadsLoaded = false;
  let chatThreadsLoading = false;

  const FILTER_SCOPE_CHAT = "chat";
  const FILTER_SCOPE_NOTIFY = "notify";
  const FILTER_SCOPE_UNIFIED = "unified";

  /** トークタブ — クイックフィルター表示順（Phase 4） */
  const CHAT_QUICK_TAG_ORDER = ["platform", "anpi", "tasful", "friend"];

  /** 通知タブ — クイックフィルター表示順 */
  const NOTIFY_QUICK_TAG_ORDER = [
    "job",
    "skill",
    "builder",
    "business",
    "shop",
    "product",
    "anpi",
    "system",
    "worker",
    "ops_watch",
  ];

  function sortOptionsByOrder(options, orderIds) {
    const order = orderIds || [];
    const rank = new Map(order.map((id, i) => [id, i]));
    return (options || []).slice().sort((a, b) => {
      const ra = rank.has(a.id) ? rank.get(a.id) : 999;
      const rb = rank.has(b.id) ? rank.get(b.id) : 999;
      if (ra !== rb) return ra - rb;
      return String(a.label).localeCompare(String(b.label), "ja");
    });
  }
  /** @type {Record<string, number>} */
  let lastDashboardStats = {};
  const FOLLOW_FILTER_STORAGE_KEY = "tasful_talk_notify_follow_only";
  const TALK_LAST_TAB_STORAGE_KEY = "tasful_talk_last_tab";
  const TALK_RETURN_STATE_KEYS = Object.freeze({
    scroll: "talkScrollPosition",
    tab: "talkActiveTab",
    lineNav: "talkActiveLineNav",
    notifyId: "talkSelectedNotificationId",
    cardOffset: "talkNotifyCardOffset",
    cardIndex: "talkNotifyCardIndex",
    restore: "talkRestoreOnLoad",
  });
  let activeAiMode = "qa";
  /** @type {{ mode: string, input: string, output: string, draftId: string|null }} */
  let aiSession = {
    mode: "qa",
    input: "",
    output: "",
    draftId: null,
    resultHtml: "",
    isSearchResult: false,
  };
  /** @type {string|null} */
  let pendingBroadcastSendId = null;
  /** @type {number|null} */
  let broadcastBannerTimer = null;
  /** @type {string} */
  let pendingHighlightBroadcastId = "";
  /** @type {Array<object>} */
  let threadsCache = [];

  const AI_MODE_HINTS = {
    qa: "探したい内容を入力してください。条件整理・候補表示・FAQ案内までお手伝いします。",
    ad: "キャンペーン・掲載告知の広告文案を下書きします（モック）。",
    notice: "会員向けお知らせ・運営通知の文案を下書きします（モック）。",
    project: "Builder 案件掲載向けの文案を下書きします（モック）。",
    job: "求人掲載（post.html?type=job）向けの文案を下書きします（モック）。",
    business: "業務サービス掲載（post.html?scope=business）向けの文案を下書きします（モック）。",
    shop: "店舗掲載（post.html?scope=business）向けの文案を下書きします（モック）。",
  };

  const AI_MODE_LABELS = {
    qa: "AI相談",
    ad: "文章作成",
    ad_copy: "広告文作成",
    notice: "通知作成",
    project: "案件作成",
    job: "求人作成",
    business: "業務サービス掲載",
    shop: "店舗掲載",
    vendor_search: "AI業者検索",
  };

  let aiComposerVisible = false;

  const DASHBOARD_STAT_ITEMS = Object.freeze([
    { key: "unread", label: "未読通知", tone: "amber" },
    { key: "anpiUnread", label: "安否未読", tone: "rose" },
    { key: "opsWatchUnread", label: "OPS WATCH", tone: "amber", adminOnly: true },
    { key: "followUnread", label: "フォロー未読", tone: "teal" },
    { key: "urgent", label: "緊急", tone: "rose" },
    { key: "important", label: "重要", tone: "blue" },
    { key: "aiDraftCount", label: "AI下書き", tone: "slate" },
    { key: "broadcastUnsent", label: "配信下書き", tone: "purple" },
  ]);

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function escapeHtml(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getMeId() {
    if (window.TasuChatUserIdentity?.getEffectiveUserId) {
      return window.TasuChatUserIdentity.getEffectiveUserId();
    }
    return window.TASU_CHAT_SUPABASE_CONFIG?.currentUserId || "u_me";
  }

  function formatUnreadBadge(unreadCount) {
    if (!unreadCount || unreadCount <= 0) return "";
    if (unreadCount === 1) {
      return `<span class="chat-unread" aria-label="未読 1件">NEW</span>`;
    }
    const label = unreadCount > 99 ? "99+" : String(unreadCount);
    return `<span class="chat-unread" aria-label="未読 ${unreadCount}件">${label}</span>`;
  }

  function formatLocalUpdatedAt(iso) {
    try {
      const d = new Date(iso);
      if (!Number.isFinite(d.getTime())) return "";
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return `更新 ${y}/${m}/${day} ${hh}:${mm}`;
    } catch {
      return "";
    }
  }

  function formatNotifyTime(iso) {
    try {
      const d = new Date(iso);
      if (!Number.isFinite(d.getTime())) return "";
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return `${m}/${day} ${hh}:${mm}`;
    } catch {
      return "";
    }
  }

  function formatNotifyDisplayTime(n) {
    if (n?.notifyEventAtLabel) return String(n.notifyEventAtLabel);
    if (n?.createdAtLabel) return String(n.createdAtLabel);
    return formatNotifyTime(n?.notifyEventAt || n?.createdAt);
  }

  function formatJobNotifyCardTime(n) {
    if (n?.notifyEventAtLabel) return String(n.notifyEventAtLabel);
    const iso = n?.notifyEventAt || n?.createdAt;
    try {
      const d = new Date(iso);
      if (!Number.isFinite(d.getTime())) return "";
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return `${y}/${m}/${day} ${hh}:${mm}`;
    } catch {
      return "";
    }
  }

  function isPlatformChatDemoNotification(n) {
    return String(n?.source || "") === "platform_chat_demo_v1";
  }

  function isPlatformChatReviewNotification(n) {
    return (
      window.TasuPlatformChatReviewFlow?.isPlatformReviewNotification?.(n) === true ||
      String(n?.source || "") === "platform_chat_review_v1"
    );
  }

  const SKILL_MASTER_NOTIFY_CATEGORY_LABELS = new Set([
    "スキル",
    "商品",
    "業務サービス",
    "店舗販売",
    "店舗・販売",
    "ワーカー",
    "一般案件",
    "求人",
  ]);

  const SKILL_MASTER_NOTIFY_TYPES = new Set([
    "skill",
    "product",
    "business",
    "shop",
    "worker",
    "general",
  ]);

  function usesSkillMasterNotifyLayout(n) {
    if (!n || typeof n !== "object") return false;
    if (isPlatformChatDemoNotification(n)) return true;
    if (isPlatformChatReviewNotification(n)) return true;
    const cat = String(n.category || "").trim();
    const type = String(n.type || "").toLowerCase();
    if (SKILL_MASTER_NOTIFY_CATEGORY_LABELS.has(cat) || SKILL_MASTER_NOTIFY_TYPES.has(type)) {
      return Boolean(pickStr(n.notifyListingTitle, n.notifySupplementLine, n.title));
    }
    if (n.minimalNotifyCard === true && pickStr(n.listingId, n.listing_id, n.threadId, n.thread_id)) {
      return Boolean(pickStr(n.notifyListingTitle, n.notifySupplementLine, n.title));
    }
    return false;
  }

  function isCategoryNotifyCardWithDetails(n) {
    return usesSkillMasterNotifyLayout(n);
  }

  /** @deprecated use isCategoryNotifyCardWithDetails */
  function isJobNotifyCardWithDetails(n) {
    return isCategoryNotifyCardWithDetails(n);
  }

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function isShopStorePurchaseNotifyRow(n) {
    if (window.TasfulMarketNotify?.isShopStorePurchaseNotification?.(n) === true) return true;
    const id = String(n?.id || "");
    if (!id.includes("market-order-purchase-")) return false;
    const source = String(n?.source || "").toLowerCase();
    if (source && source !== "shop_market_order_v1" && !id.startsWith("market-order-")) return false;
    const channel = pickStr(n?.channel);
    const category = pickStr(n?.category);
    return channel === "shop_store" || category === "店舗販売";
  }

  function formatShopStoreOrderNumberDisplay(orderNumber) {
    const raw = pickStr(orderNumber);
    if (!raw) return "";
    return raw.startsWith("#") ? raw : `#${raw}`;
  }

  function renderShopStorePurchaseHeadRowHtml(options) {
    const parts = [];
    if (options?.isLatest) {
      parts.push(
        '<span class="talk-notify-card__market-badge talk-notify-card__market-badge--new">NEW</span>'
      );
    }
    parts.push(
      '<span class="talk-notify-card__category-chip talk-notify-card__type talk-notify-card__scope-chip talk-notify-card__type--gold">店舗販売</span>'
    );
    return `<div class="talk-notify-card__shop-store-head">${parts.join("")}</div>`;
  }

  function renderShopStorePurchaseNotifyBodyHtml(n) {
    const market = window.TasfulMarketNotify;
    if (market?.renderShopStorePurchaseDetailsHtml) {
      return market.renderShopStorePurchaseDetailsHtml(n);
    }
    const shopName = pickStr(n?.shopName, n?.notifyListingTitle, "店舗");
    const productName = pickStr(n?.productName, "商品");
    const resolvedAmount =
      n?.amount != null && Number(n.amount) > 0
        ? Math.round(Number(n.amount))
        : market?.resolvePurchaseAmount?.(n) ?? 0;
    const amount =
      resolvedAmount > 0
        ? `¥${resolvedAmount.toLocaleString("ja-JP")}`
        : "¥0";
    const orderNumber = formatShopStoreOrderNumberDisplay(
      pickStr(n?.orderNumber, n?.orderId, String(n?.id || "").replace(/^market-order-purchase-/, ""))
    );
    return `
      <div class="talk-notify-card__shop-store-details">
        <p class="talk-notify-card__shop-name">${escapeHtml(shopName)}</p>
        <p class="talk-notify-card__product-name">${escapeHtml(productName)}</p>
        <p class="talk-notify-card__amount">${escapeHtml(amount)}</p>
        <p class="talk-notify-card__order-number">${escapeHtml(orderNumber)}</p>
      </div>`;
  }

  function renderShopStorePurchaseNotifyCardHtml(n, options) {
    return `${renderShopStorePurchaseHeadRowHtml(options)}${renderShopStorePurchaseNotifyBodyHtml(n)}`;
  }

  function resolveShopStorePurchaseNotifyAria(n, actionLabel) {
    const market = window.TasfulMarketNotify;
    if (market?.resolveShopStorePurchaseAriaLabel) {
      return market.resolveShopStorePurchaseAriaLabel(n, actionLabel);
    }
    const shopName = pickStr(n?.shopName, n?.notifyListingTitle);
    const productName = pickStr(n?.productName);
    const amount =
      n?.amount != null
        ? `¥${Math.max(0, Math.round(Number(n.amount))).toLocaleString("ja-JP")}`
        : "";
    const orderNumber = pickStr(n?.orderNumber, n?.orderId);
    return ["店舗販売", pickStr(n?.title), shopName, productName, amount, orderNumber ? formatShopStoreOrderNumberDisplay(orderNumber) : "", pickStr(actionLabel, "注文を確認する")]
      .filter(Boolean)
      .join(" ");
  }

  function isTalkDebugLogging() {
    try {
      if (global.localStorage?.getItem("tasu_talk_debug") === "1") return true;
      return new URLSearchParams(global.location?.search || "").get("talkDebug") === "1";
    } catch {
      return false;
    }
  }

  function isTalkPerfLogging() {
    try {
      return new URLSearchParams(global.location?.search || "").get("talkPerf") === "1";
    } catch {
      return false;
    }
  }

  let notifyFilterCountsCacheKey = "";
  let notifyFilterCountsCache = null;

  function invalidateNotifyFilterCountsCache() {
    notifyFilterCountsCacheKey = "";
    notifyFilterCountsCache = null;
  }

  function getCachedNotifyFilterCounts(options) {
    const data = window.TasuTalkData;
    if (!data?.countNotificationsForFilters) {
      return { types: {}, flags: {}, admin: { ops_watch: 0, ops_contact: 0, anpi: 0, report: 0 } };
    }
    const key = JSON.stringify(options || {});
    if (notifyFilterCountsCacheKey === key && notifyFilterCountsCache) {
      return notifyFilterCountsCache;
    }
    notifyFilterCountsCache = data.countNotificationsForFilters(options);
    notifyFilterCountsCacheKey = key;
    return notifyFilterCountsCache;
  }

  function renderJobNotifyCategoryChipHtml(n) {
    if (!isCategoryNotifyCardWithDetails(n)) return "";
    const content =
      window.TasuTalkNotifyContentType?.resolve?.(n, n.officialRoomId) ||
      { label: pickStr(n.category) || "通知", tone: "default" };
    return `<div class="talk-notify-card__job-head"><span class="talk-notify-card__category-chip talk-notify-card__type talk-notify-card__scope-chip ${toneClass(content.tone || "default")}">${escapeHtml(content.label)}</span></div>`;
  }

  function renderJobNotifyCardDetailsHtml(n) {
    if (!isCategoryNotifyCardWithDetails(n)) return "";
    const jobTitle = escapeHtml(pickStr(n.notifyListingTitle));
    const eventTitle = escapeHtml(pickStr(n.title));
    const body = escapeHtml(pickStr(n.body));
    const supplement = escapeHtml(pickStr(n.notifySupplementLine));
    const eventIso = pickStr(n.notifyEventAt, n.createdAt);
    const time = escapeHtml(formatJobNotifyCardTime(n));
    return `
            <div class="talk-notify-card__job-details">
              ${jobTitle ? `<p class="talk-notify-card__job-title">${jobTitle}</p>` : ""}
              ${eventTitle ? `<p class="talk-notify-card__title talk-notify-card__title--job-event">${eventTitle}</p>` : ""}
              ${body ? `<p class="talk-notify-card__text talk-notify-card__text--details">${body}</p>` : ""}
              ${supplement ? `<p class="talk-notify-card__job-supplement">${supplement}</p>` : ""}
              ${
                time
                  ? `<p class="talk-notify-card__job-time"><time datetime="${escapeHtml(eventIso)}">${time}</time></p>`
                  : ""
              }
            </div>`;
  }

  function isPlatformMasterNotification(n) {
    return (
      window.TasuTalkNotifyActions?.isPlatformMasterNotification?.(n) ||
      window.TasuTalkData?.isPlatformMasterNotification?.(n) ||
      false
    );
  }

  function isBuilderMasterNotification(n) {
    return (
      window.TasuTalkNotifyActions?.isBuilderMasterNotification?.(n) ||
      window.TasuTalkData?.isBuilderMasterNotification?.(n) ||
      false
    );
  }

  function isAnpiMasterNotification(n) {
    return (
      window.TasuTalkNotifyActions?.isAnpiMasterNotification?.(n) ||
      window.TasuTalkData?.isAnpiMasterNotification?.(n) ||
      false
    );
  }

  function isPlatformFeeMasterNotification(n) {
    return (
      window.TasuTalkNotifyActions?.isPlatformFeeMasterNotification?.(n) ||
      false
    );
  }

  function isMinimalPlatformNotifyCard(n) {
    if (!n || typeof n !== "object") return false;
    if (window.TasuTalkPlatformFeeNotify?.isPlatformFeeNotification?.(n)) return true;
    if (isPlatformFeeMasterNotification(n)) return true;
    return n.minimalNotifyCard === true;
  }

  function isTalkMasterNotification(n) {
    return (
      window.TasuTalkNotifyActions?.isTalkMasterNotification?.(n) ||
      window.TasuTalkData?.isTalkMasterNotification?.(n) ||
      isPlatformMasterNotification(n) ||
      isPlatformFeeMasterNotification(n) ||
      isBuilderMasterNotification(n) ||
      isAnpiMasterNotification(n)
    );
  }

  /** カテゴリチップ + 遷移URL 付き通知（マスター以外の統一カード） */
  function isNotifyNavigateCard(n) {
    if (isTalkMasterNotification(n)) return true;
    const category = String(n?.category || "").trim();
    const href = String(n?.href || n?.targetUrl || "").trim();
    return Boolean(category && href && href !== "#");
  }

  function masterSubTypeLabel(n) {
    if (isBuilderMasterNotification(n)) {
      return "";
    }
    if (isAnpiMasterNotification(n)) {
      return window.TasuTalkAnpiNotifyMaster?.getSubTypeLabel?.(n?.subType) || "";
    }
    return "";
  }

  function notifyTagTone(tag) {
    const tones = window.TasuTalkBuilderNotifyMaster?.NOTIFY_TAG_TONES || {};
    return tones[String(tag || "")] || "slate";
  }

  function renderNotifyTagsHtml(n) {
    const tags = Array.isArray(n?.notifyTags) ? n.notifyTags.filter(Boolean) : [];
    if (!tags.length) return "";
    return `<span class="talk-notify-card__tags" aria-label="通知タグ">${tags
      .map(
        (tag) =>
          `<span class="talk-notify-card__tag talk-notify-card__tag--${escapeHtml(notifyTagTone(tag))}">${escapeHtml(tag)}</span>`
      )
      .join("")}</span>`;
  }

  function builderNotifyScopeMeta(n) {
    const master = window.TasuTalkBuilderNotifyMaster;
    if (!master) return null;
    const isBuilder =
      isBuilderMasterNotification(n) ||
      (String(n?.type || "").toLowerCase() === "builder" &&
        Boolean(n?.audienceScope || n?.projectKind || master.getScopeLabel?.(n)));
    if (!isBuilder) return null;
    const scopeLabel = master.getScopeLabel?.(n) || "";
    const projectTitle = master.getProjectTitle?.(n) || "";
    if (!scopeLabel) return null;
    return {
      scopeLabel,
      projectTitle,
      tone: master.getScopeTone?.(n) || "slate",
    };
  }

  function platformCategoryTone(category) {
    const meta = window.TasuTalkData?.PLATFORM_CATEGORY_META || {};
    return meta[category]?.tone || "slate";
  }

  function getChatChannels() {
    return window.TasuTalkData?.CHAT_CHANNELS || [{ id: "all", label: "すべて" }];
  }

  /** @param {object} thread */
  function resolveTalkChannel(thread) {
    return window.TasuTalkData?.resolveChatChannel?.(thread) || "personal";
  }

  function getChatChannelLabel(channelId) {
    return (
      window.TasuTalkData?.getChatChannelLabel?.(channelId) ||
      getChatChannels().find((c) => c.id === channelId)?.label ||
      "チャット"
    );
  }

  function normalizeTalkTabParam(tab) {
    const t = String(tab || "").toLowerCase();
    if (t === "notifications") return "notify";
    return t;
  }

  function readFromNotifyContext() {
    try {
      return String(new URLSearchParams(window.location.search).get("from") || "").toLowerCase() === "notify";
    } catch {
      return false;
    }
  }

  function readReturnTabFromSession() {
    try {
      if (global.sessionStorage.getItem(TALK_RETURN_STATE_KEYS.restore) !== "1") return "";
      return normalizeTalkTabParam(global.sessionStorage.getItem(TALK_RETURN_STATE_KEYS.tab) || "");
    } catch {
      return "";
    }
  }

  function readReturnTabFromReturnUrl() {
    try {
      const stored = String(global.sessionStorage.getItem("tasu_talk_return_url") || "").trim();
      if (!stored) return "";
      const u = stored.startsWith("http")
        ? new URL(stored)
        : new URL(stored, global.location.href);
      return normalizeTalkTabParam(u.searchParams.get("tab") || "");
    } catch {
      return "";
    }
  }

  function readLastSelectedTab() {
    try {
      return normalizeTalkTabParam(
        global.sessionStorage.getItem(TALK_RETURN_STATE_KEYS.tab) ||
          global.localStorage.getItem(TALK_LAST_TAB_STORAGE_KEY) ||
          ""
      );
    } catch {
      return "";
    }
  }

  /** 初期タブ: URL tab → from=notify → session return → last tab → chat */
  function resolveInitialTalkTab() {
    const params = new URLSearchParams(window.location.search);
    const urlTab = normalizeTalkTabParam(params.get("tab") || "");
    if (TAB_IDS.includes(urlTab)) return urlTab;

    const hashTab = normalizeTalkTabParam(String(window.location.hash || "").replace("#", ""));
    if (TAB_IDS.includes(hashTab)) return hashTab;

    if (readFromNotifyContext()) return "notify";

    const returnUrlTab = readReturnTabFromReturnUrl();
    if (TAB_IDS.includes(returnUrlTab)) return returnUrlTab;

    const sessionReturnTab = readReturnTabFromSession();
    if (TAB_IDS.includes(sessionReturnTab)) return sessionReturnTab;

    const lastTab = readLastSelectedTab();
    if (TAB_IDS.includes(lastTab)) return lastTab;

    return "chat";
  }

  function readTabFromUrl() {
    return resolveInitialTalkTab();
  }

  function persistTalkTabSelection(tab) {
    const t = normalizeTalkTabParam(tab);
    if (!TAB_IDS.includes(t)) return;
    try {
      global.sessionStorage.setItem(TALK_RETURN_STATE_KEYS.tab, t);
      global.localStorage.setItem(TALK_LAST_TAB_STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
  }

  function normalizeNotifyTabInUrl() {
    try {
      const url = new URL(window.location.href);
      const rawTab = String(url.searchParams.get("tab") || "").toLowerCase();
      if (rawTab === "notifications") {
        url.searchParams.set("tab", "notify");
        global.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
        return;
      }
      if (activeTab === "notify" && !url.searchParams.get("tab")) {
        url.searchParams.set("tab", "notify");
        global.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
      }
    } catch {
      /* ignore */
    }
  }

  function normalizeNotifyTabRedirect(pushUrl) {
    normalizeNotifyTabInUrl();
  }

  function ensureNotifyTabPainted() {
    if (activeTab !== "notify") return;
    const host = $("[data-talk-notify-list]");
    if (!host) return;
    if (host.querySelectorAll("article[data-talk-notify-id]").length === 0) {
      renderNotifications();
    }
  }

  function scheduleNotifyTabPaintRetries() {
    if (activeTab !== "notify") return;
    [0, 80, 200, 400].forEach((delay) => {
      global.setTimeout(() => {
        if (activeTab === "notify") ensureNotifyTabPainted();
      }, delay);
    });
  }

  function syncLineRailActive() {
    let navForTab = "talk";
    if (activeTab === "ai") {
      navForTab = "ai";
    } else if (activeTab === "chat") {
      if (activeLineNav === "platform" || activeLineNav === "anpi") {
        navForTab = activeLineNav;
      } else if (lineListFilterId === "platform") {
        navForTab = "platform";
      } else if (lineListFilterId === "anpi") {
        navForTab = "anpi";
      } else {
        navForTab = activeLineNav || "talk";
      }
    }
    document.querySelectorAll("[data-talk-line-nav]").forEach((el) => {
      if (el.tagName === "A" && el.getAttribute("href") && el.getAttribute("href") !== "#") {
        return;
      }
      const id = el.getAttribute("data-talk-line-nav");
      el.classList.toggle("is-active", id === navForTab);
    });
  }

  function setLineListTitle(label) {
    const title = $("[data-talk-line-list-title]");
    if (title && label) title.textContent = label;
  }

  function syncChatAppChrome() {
    const isChat = activeTab === "chat";
    document.body.classList.toggle("talk-home--chat-app", isChat);
  }

  /**
   * LINE 3カラム — 左ナビ（ページ遷移なしでビュー切替）
   * @param {string} navId
   */
  function setLineNav(navId) {
    const NAV = {
      talk: { tab: "chat", title: "トーク", filterId: "all" },
      platform: { tab: "chat", title: "プラット", filterId: "platform", openRoom: "official_platform" },
      anpi: { tab: "chat", title: "安否", filterId: "anpi", openRoom: "official_anpi" },
      ai: { tab: "ai", title: "AI" },
    };
    const cfg = NAV[navId] || NAV.talk;
    activeLineNav = navId in NAV ? navId : "talk";

    if (cfg.tab === "chat") {
      if (cfg.filterId === "all") {
        clearChatCategoryFilter();
      } else {
        applyChatCategoryFilter(cfg.filterId);
      }
      setLineListTitle(cfg.title);
      renderLineListFilters();
      setTab("chat", true);
      renderChatThreads(threadsCache);
      if (cfg.openRoom && global.TasuTalkLineRoom?.openThreadById) {
        global.TasuTalkLineRoom.openThreadById(cfg.openRoom);
      } else if (global.TasuTalkLineRoom?.showEmpty) {
        global.TasuTalkLineRoom.showEmpty();
      }
      syncLineRailActive();
      return;
    }

    setTab(cfg.tab, true);
    syncLineRailActive();
  }

  function setTab(tab, pushUrl, options) {
    tab = normalizeTalkTabParam(tab);
    if (!TAB_IDS.includes(tab)) tab = "chat";
    const skipSurfaceRender = options?.skipSurfaceRender === true;
    activeTab = tab;
    persistTalkTabSelection(tab);

    document.querySelectorAll("[data-talk-tab]").forEach((btn) => {
      const id = btn.getAttribute("data-talk-tab");
      const on = id === tab;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });

    document.querySelectorAll("[data-talk-panel]").forEach((panel) => {
      const id = panel.getAttribute("data-talk-panel");
      const show = id === tab;
      panel.hidden = !show;
      if (id === "chat") {
        panel.classList.toggle("is-active", show);
      }
    });

    syncLineRailActive();
    syncMobileTabbar(tab);
    window.TasufulAppMobile?.syncTabbar?.(tab);

    document.body.classList.toggle("talk-home--tab-chat", tab === "chat");
    document.body.classList.toggle("talk-home--tab-notify", tab === "notify");
    document.body.classList.toggle("talk-home--tab-ai", tab === "ai");
    document.querySelectorAll("[data-talk-open-notify]").forEach((el) => {
      el.classList.toggle("is-active", tab === "notify");
    });
    syncChatAppChrome();

    if (pushUrl) {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      if (tab !== "chat") url.searchParams.delete("thread");
      url.hash = "";
      history.replaceState(null, "", url.pathname + url.search);
    }

    if (tab === "chat") {
      const tid = String(
        new URLSearchParams(window.location.search).get("thread") ||
          new URLSearchParams(window.location.search).get("roomId") ||
          ""
      ).trim();
      if (!tid && !window.TasuTalkLineRoom?.getActiveThreadId?.()) {
        window.TasuTalkLineRoom?.showEmpty?.();
        resetListScrollPosition("chat");
      }
    }

    if (tab === "chat" && !chatThreadsLoaded && !chatThreadsLoading) {
      void ensureChatThreadsLoaded();
    }

    if (!skipSurfaceRender) {
      if (tab === "notify") {
        renderNotifyFilterPanel();
        renderNotifications();
        resetListScrollPosition("notify");
      }
      if (tab === "ai") {
        if (!aiComposerVisible) showAiHub();
        syncAiModeUi();
        renderSavedAiDrafts();
        renderBroadcastDrafts();
      }
    }
  }

  function getLayoutCaps() {
    return window.TasuTalkHomeLayout?.getCapabilities?.() || { admin: false, builder: false, simple: true };
  }

  function applyTalkHomeLayout() {
    const layout = window.TasuTalkHomeLayout;
    if (!layout) return getLayoutCaps();
    const caps = layout.applyBodyLayoutClasses();
    const power = caps.admin || caps.builder;
    document.querySelectorAll("[data-talk-power-only]").forEach((el) => {
      el.hidden = !power;
    });
    const showOpsNav = isTalkAdminForFilters();
    document.querySelectorAll("[data-talk-ops-nav]").forEach((el) => {
      el.hidden = !showOpsNav;
    });
    document.querySelectorAll('[data-talk-line-nav="ops"]').forEach((el) => {
      el.hidden = !showOpsNav;
    });
    const leadSimple = $("[data-talk-simple-lead]");
    if (leadSimple) leadSimple.hidden = !caps.simple;
    const chatSubSimple = $("[data-talk-chat-sub-simple]");
    const chatSubPower = $("[data-talk-chat-sub-power]");
    if (chatSubSimple) chatSubSimple.hidden = !caps.simple;
    if (chatSubPower) chatSubPower.hidden = caps.simple;
    const aiPower = $("[data-talk-ai-power]");
    if (aiPower) aiPower.hidden = !caps.admin;
    renderAiConsultHub();
    sanitizeFilterStateForCaps();
    renderChatFilterPanel();
    renderNotifyFilterPanel();
    return caps;
  }

  function aiModeDisplayLabel(mode) {
    const id = normalizeAiMode(mode);
    const primary = window.TasuTalkHomeLayout?.AI_PRIMARY_MODES?.find((m) => m.id === id);
    if (primary) return primary.label;
    const admin = window.TasuTalkHomeLayout?.AI_ADMIN_MODES?.find((m) => m.id === id);
    if (admin) return admin.label;
    return AI_MODE_LABELS[id] || id;
  }

  function updateAiModeLabel() {
    const el = $("[data-talk-ai-mode-label]");
    if (el) el.textContent = aiModeDisplayLabel(activeAiMode);
  }

  function showAiHub() {
    aiComposerVisible = false;
    const hub = $("[data-talk-ai-hub]");
    const composer = $("[data-talk-ai-composer]");
    const vendorSearch = $("[data-talk-ai-vendor-search]");
    if (hub) hub.hidden = false;
    if (composer) composer.hidden = true;
    if (vendorSearch) vendorSearch.hidden = true;
    renderAiUsageHistory();
  }

  function showAiComposer() {
    aiComposerVisible = true;
    const hub = $("[data-talk-ai-hub]");
    const composer = $("[data-talk-ai-composer]");
    const vendorSearch = $("[data-talk-ai-vendor-search]");
    if (hub) hub.hidden = true;
    if (composer) composer.hidden = false;
    if (vendorSearch) vendorSearch.hidden = true;
    updateAiModeLabel();
    syncAiModeUi();
  }

  function showAiVendorSearch() {
    aiComposerVisible = false;
    const hub = $("[data-talk-ai-hub]");
    const composer = $("[data-talk-ai-composer]");
    const vendorSearch = $("[data-talk-ai-vendor-search]");
    if (hub) hub.hidden = true;
    if (composer) composer.hidden = true;
    if (vendorSearch) vendorSearch.hidden = false;
    hideAiResult();
    window.TasuTalkAiVendorSearch?.renderPanel?.();
  }

  function renderAiUsageHistory() {
    const host = $("[data-talk-ai-history-list]");
    const hist = window.TasuTalkAiHistory;
    if (!host || !hist) return;

    const rows = hist.listRecent?.(5) || [];
    if (!rows.length) {
      host.innerHTML = `<p class="talk-ai-history-empty">まだAI利用履歴はありません</p>`;
      return;
    }

    host.innerHTML = `<ul class="talk-ai-history-items">${rows
      .map((row) => {
        const time = hist.formatRelative?.(row.usedAt) || "";
        const seed = row.promptPreview ? ` data-talk-ai-seed="${escapeHtml(row.promptPreview)}"` : "";
        return `<li>
          <button type="button" class="talk-ai-history-item" data-talk-ai-pick="${escapeHtml(row.mode)}"${seed}>
            <span class="talk-ai-history-item__label">${escapeHtml(row.label)}</span>
            <span class="talk-ai-history-item__time">${escapeHtml(time)}</span>
          </button>
        </li>`;
      })
      .join("")}</ul>`;
  }

  function renderAiConsultHub() {
    const layout = window.TasuTalkHomeLayout;
    const adminHost = $("[data-talk-ai-admin-grid]");
    const moreBlock = $("[data-talk-ai-more]");
    if (moreBlock) moreBlock.hidden = true;

    if (adminHost && layout) {
      adminHost.innerHTML = (layout.AI_ADMIN_MODES || [])
        .map(
          (m) => `
          <button type="button" class="talk-ai-primary__btn talk-ai-primary__btn--admin" data-talk-ai-pick="${escapeHtml(m.id)}">
            <span class="talk-ai-primary__icon" aria-hidden="true">${escapeHtml(m.icon)}</span>
            <span class="talk-ai-primary__label">${escapeHtml(m.label)}</span>
            <span class="talk-ai-primary__hint">${escapeHtml(m.hint)}</span>
          </button>`
        )
        .join("");
    }

    renderAiUsageHistory();

    const hub = $("[data-talk-ai-hub]");
    if (hub && !hub.dataset.aiHubWired) {
      hub.dataset.aiHubWired = "1";
      hub.addEventListener("click", (e) => {
        const btn = /** @type {HTMLElement|null} */ (
          e.target instanceof Element ? e.target.closest("[data-talk-ai-pick]") : null
        );
        if (!btn || btn.closest("[data-talk-ai-composer]")) return;
        const mode = btn.getAttribute("data-talk-ai-pick") || "qa";
        const seed = btn.getAttribute("data-talk-ai-seed") || "";
        const historyLabel =
          btn.classList.contains("talk-ai-tool-card") || btn.classList.contains("talk-ai-suggest-item")
            ? (btn.textContent || "").trim()
            : "";
        goToAiMode(mode, { seedPrompt: seed, historyLabel: historyLabel || undefined });
      });
    }
  }

  function wireTabs() {
    document.querySelectorAll("[data-talk-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        setTab(btn.getAttribute("data-talk-tab") || "chat", true);
      });
    });
  }

  /**
   * AI相談・検索は ai-workspace.html へ（TALKは入口のみ）
   * @param {{ q?: string, seedPrompt?: string, mode?: string, send?: boolean, recordHistory?: boolean, historyLabel?: string }} [options]
   */
  function openAiWorkspaceConsult(options) {
    const q = String(options?.q || options?.seedPrompt || "").trim();
    const mode = String(options?.mode || window.TasuAiWorkspaceLinks?.DEFAULT_MODE || "cross-matching");
    const Links = window.TasuAiWorkspaceLinks;
    const url = Links?.buildUrl
      ? Links.buildUrl({
          mode,
          q: q || undefined,
          send: options?.send === true || Boolean(q && options?.autoSend !== false),
        })
      : `ai-workspace.html?mode=${encodeURIComponent(mode)}${q ? `&q=${encodeURIComponent(q)}&send=1` : ""}`;

    if (options?.recordHistory !== false) {
      window.TasuTalkAiHistory?.record?.({
        mode: "qa",
        label: options?.historyLabel || "AI相談",
        promptPreview: q,
      });
    }
    window.location.assign(url);
  }

  /**
   * @param {string} mode
   * @param {{ seedPrompt?: string, recordHistory?: boolean, historyLabel?: string, send?: boolean }} [options]
   */
  function goToAiMode(mode, options) {
    activeAiMode = normalizeAiMode(mode);
    if (activeAiMode === "qa" || activeAiMode === "vendor_search") {
      openAiWorkspaceConsult({
        q: options?.seedPrompt || (activeAiMode === "vendor_search" ? "業者を探したい" : ""),
        send: Boolean(options?.seedPrompt) || options?.send === true,
        historyLabel:
          options?.historyLabel ||
          (activeAiMode === "vendor_search" ? "AI業者検索" : aiModeDisplayLabel("qa")),
        recordHistory: options?.recordHistory,
      });
      return;
    }
    setTab("ai", true);
    const seed = String(options?.seedPrompt || "").trim();

    showAiComposer();
    const input = /** @type {HTMLTextAreaElement|null} */ ($("[data-talk-ai-input]"));
    if (input && seed) input.value = seed;
    if (options?.recordHistory !== false) {
      window.TasuTalkAiHistory?.record?.({
        mode: activeAiMode,
        label: options?.historyLabel || aiModeDisplayLabel(activeAiMode),
        promptPreview: seed || input?.value?.trim() || "",
      });
      renderAiUsageHistory();
    }
    input?.focus();
  }

  function goToChatSearch() {
    setTab("chat", true);
    renderChatThreads(threadsCache);
    window.setTimeout(() => {
      const input = /** @type {HTMLInputElement|null} */ ($("[data-talk-chat-search]"));
      input?.focus();
      try {
        input?.select();
      } catch {
        /* ignore */
      }
    }, 80);
  }

  function goToBroadcastSection() {
    setTab("ai", true);
    showAiComposer();
    syncAiModeUi();
    renderSavedAiDrafts();
    renderBroadcastDrafts();
    window.setTimeout(() => {
      document.getElementById("talkBroadcastSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  /** @type {Record<string, () => void>} */
  const QUICK_ACTION_HANDLERS = {
    chatSearch: () => goToChatSearch(),
    notify: () => setTab("notify", true),
    ai: () => goToAiMode("qa"),
    createJob: () => goToAiMode("job"),
    createProject: () => goToAiMode("project"),
    createAd: () => goToAiMode("ad"),
    createNotice: () => goToAiMode("notice"),
    broadcastDrafts: () => goToBroadcastSection(),
  };

  /**
   * @param {string} actionId
   * @param {{ record?: boolean }} [options]
   */
  function runQuickAction(actionId, options) {
    const id = String(actionId || "").trim();
    const handler = QUICK_ACTION_HANDLERS[id];
    if (!handler) return false;
    handler();
    if (options?.record !== false) {
      try {
        window.TasuTalkData?.pushRecentAction?.(id);
      } catch (err) {
        console.warn("[talk-home] pushRecentAction failed:", err);
      }
      renderRecentActions();
    }
    return true;
  }

  function readActionFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return String(params.get("action") || "").trim();
  }

  function clearActionFromUrl() {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("action")) return;
    url.searchParams.delete("action");
    history.replaceState(null, "", url.pathname + url.search + url.hash);
  }

  function applyUrlAction() {
    const action = readActionFromUrl();
    if (!action) return;
    const ok = runQuickAction(action, { record: true });
    if (ok) clearActionFromUrl();
  }

  function renderQuickActions() {
    const grid = $("[data-talk-quick-actions]");
    if (!grid) return;
    const actions = window.TasuTalkData?.QUICK_ACTIONS || [];
    grid.innerHTML = actions
      .map(
        (a) =>
          `<button type="button" class="talk-quick-actions__btn" data-talk-quick-action="${escapeHtml(a.id)}">${escapeHtml(a.label)}</button>`
      )
      .join("");
  }

  function renderRecentActions() {
    const section = $("[data-talk-recent-section]");
    const track = $("[data-talk-recent-actions]");
    if (!track) return;
    let list = [];
    try {
      list = window.TasuTalkData?.readRecentActions?.() || [];
    } catch (err) {
      console.warn("[talk-home] readRecentActions failed:", err);
      list = [];
    }
    if (!list.length) {
      if (section) section.hidden = true;
      track.innerHTML = "";
      return;
    }
    if (section) section.hidden = false;
    track.innerHTML = list
      .map((row) => {
        const time = escapeHtml(formatNotifyTime(row.at) || "—");
        return `
        <article class="talk-recent-actions__card">
          <p class="talk-recent-actions__name">${escapeHtml(row.label)}</p>
          <p class="talk-recent-actions__time">${time}</p>
          <button type="button" class="talk-recent-actions__rerun" data-talk-recent-rerun="${escapeHtml(row.id)}">再実行</button>
        </article>`;
      })
      .join("");
    track.querySelectorAll("[data-talk-recent-rerun]").forEach((btn) => {
      btn.addEventListener("click", () => {
        runQuickAction(btn.getAttribute("data-talk-recent-rerun") || "");
      });
    });
  }

  function wireQuickActions() {
    const grid = $("[data-talk-quick-actions]");
    if (!grid || grid.dataset.wired) return;
    grid.dataset.wired = "1";
    renderQuickActions();
    grid.addEventListener("click", (e) => {
      const btn = /** @type {HTMLElement|null} */ (e.target)?.closest?.("[data-talk-quick-action]");
      if (!btn) return;
      runQuickAction(btn.getAttribute("data-talk-quick-action") || "");
    });
  }

  function resolveRecentChatHref(thread) {
    const path = window.TasuTalkData?.resolveChatTalkHref?.(thread) || "#";
    return window.TasuChatUserIdentity?.appendUserIdToUrl?.(path) || path;
  }

  function appendUserUrl(path) {
    return window.TasuChatUserIdentity?.appendUserIdToUrl?.(path) || path;
  }

  function refreshTalkSurfaces(options) {
    const notifyOnly = options?.notifyOnly === true;
    invalidateNotifyFilterCountsCache();
    if (!notifyOnly) {
      renderDashboard();
      renderChatFilterPanel();
      renderUnifiedFilterPanel();
      renderUnifiedInbox();
      renderRecentActions();
    }
    if (activeTab === "notify") {
      if (notifyOnly) {
        renderNotifications();
      } else {
        renderNotifyFilterPanel();
        renderNotifications();
      }
    }
    if (activeTab === "ai" && !notifyOnly) {
      renderSavedAiDrafts();
      renderBroadcastDrafts();
    }
  }

  function isBenchNotifyEmbedContext() {
    if (document.body?.dataset?.benchEmbed === "1") return true;
    try {
      return new URLSearchParams(window.location.search).get("benchEmbed") === "1";
    } catch {
      return false;
    }
  }

  let benchNotifyRenderSeq = 0;

  function applyBenchNotifyRowFallbacks(listOpts, filterActive, talkData, rows) {
    if (!isBenchNotifyEmbedContext() || filterActive) return rows;
    let out = rows;
    if (!out.length) {
      const relaxed =
        talkData?.getNotifications?.({
          filter: "all",
          applySettings: false,
          showMuted: true,
        }) || [];
      if (relaxed.length) out = relaxed;
    }
    if (!out.length) {
      const storeRows = resolveBenchNotifyRowsFromStore();
      if (storeRows.length) out = storeRows;
    }
    return out;
  }

  function ensureBenchNotifyDomPainted(host, rows, renderCtx) {
    if (!isBenchNotifyEmbedContext() || !host || !Array.isArray(rows) || !rows.length) return false;
    if (notifyListDomMatchesRows(host, rows)) return false;
    host.dataset.notifyRenderSig = "";
    host.classList.remove("talk-notify-list--empty", "talk-notify-list--empty-pure", "talk-notify-list--scrollable");
    return paintNotifyListCards(host, rows, renderCtx);
  }

  function forceBenchNotifyListPaint(host, rows, renderCtx) {
    if (!isBenchNotifyEmbedContext() || !host || !Array.isArray(rows) || !rows.length) return false;
    host.dataset.notifyRenderSig = "";
    host.classList.remove("talk-notify-list--empty", "talk-notify-list--empty-pure", "talk-notify-list--scrollable");
    paintNotifyListCards(host, rows, renderCtx);
    return notifyListDomMatchesRows(host, rows);
  }

  function isNotifyPointerOnAction() {
    return benchNotifyPointerOnAction === true;
  }

  function wireBenchNotifyPointerGuard(host) {
    if (!host || host.dataset.benchNotifyPointerGuard === "1") return;
    host.dataset.benchNotifyPointerGuard = "1";
    host.addEventListener(
      "pointerenter",
      (ev) => {
        if (ev.target.closest("[data-talk-notify-action]")) {
          benchNotifyPointerOnAction = true;
          host.dataset.notifyPointerOnAction = "1";
        }
      },
      true
    );
    host.addEventListener(
      "pointerleave",
      (ev) => {
        const btn = ev.target.closest?.("[data-talk-notify-action]");
        if (!btn) return;
        if (!btn.contains(ev.relatedTarget)) {
          benchNotifyPointerOnAction = false;
          delete host.dataset.notifyPointerOnAction;
        }
      },
      true
    );
  }

  function scheduleBenchNotifyDomReconcile(host, listOpts, visibleAll) {
    if (!isBenchNotifyEmbedContext() || !host) return;
    if (isNotifyPointerOnAction()) return;
    const filterActive =
      isNotifyFilterActive() || String(notifySearchQuery || "").trim().length > 0;
    if (filterActive) return;

    const run = () => {
      if (isNotifyPointerOnAction()) return;
      const talkData = window.TasuTalkData;
      const types = window.TasuTalkData?.NOTIFICATION_TYPES || {};
      const priorities = window.TasuTalkData?.PRIORITY_META || {};
      const renderCtx = {
        types,
        priorities,
        talkData,
        opsUi: window.TasuTalkOpsWatchNotifyUi,
      };
      let rows = resolveBenchNotifyRowsFromStore();
      if (!rows.length) {
        rows = applyBenchNotifyRowFallbacks(listOpts, false, talkData, talkData?.getNotifications?.({
          filter: "all",
          applySettings: false,
          showMuted: true,
        }) || []);
      }
      if (!rows.length) return;
      if (notifyListDomMatchesRows(host, rows)) return;
      forceBenchNotifyListPaint(host, rows, renderCtx);
      wireNotificationCardActions(host);
      traceBenchNotifyRenderDiagnostics(listOpts, visibleAll, rows);
      syncBenchNotifyEmbedHeightFromContext();
      syncNotifyListLayoutVars();
    };

    global.setTimeout(run, 0);
  }

  function refreshBenchNotifyList(options) {
    const opts = options || {};
    if (isNotifyPointerOnAction() && opts.force !== true) {
      benchNotifyRefreshQueued = true;
      return;
    }
    window.TasuPlatformChatInteractionTrace?.bumpCounter?.("notifyRefresh");
    window.TasuPlatformChatInteractionTrace?.logEvent?.("notify_refresh", {
      counter: "notifyRefresh",
      queued: benchNotifyRefreshQueued,
    });
    if (benchNotifyRefreshTimer) {
      benchNotifyRefreshQueued = true;
      return;
    }
    benchNotifyRefreshQueued = false;
    const host = $("[data-talk-notify-list]");
    if (host) wireBenchNotifyPointerGuard(host);
    renderNotifications();
    syncBenchNotifyEmbedHeightFromContext();
    benchNotifyRefreshTimer = global.setTimeout(() => {
      benchNotifyRefreshTimer = 0;
      if (benchNotifyRefreshQueued && !isNotifyPointerOnAction()) {
        benchNotifyRefreshQueued = false;
        refreshBenchNotifyList({ force: true });
      }
    }, 180);
  }

  function handleBenchNotifyStorageRefresh() {
    if (!isBenchNotifyEmbedContext()) return;
    refreshBenchNotifyList();
  }

  function recordInboxAction(actionId, label) {
    try {
      window.TasuTalkData?.pushRecentAction?.(actionId, { label: String(label || actionId) });
    } catch (err) {
      console.warn("[talk-home] recordInboxAction failed:", err);
    }
    renderRecentActions();
  }

  function filterUi() {
    return window.TasuTalkFilterUi;
  }

  function loadFilterStatesFromStorage() {
    const F = filterUi();
    if (!F) return;
    const chat = F.loadScope(FILTER_SCOPE_CHAT, { channels: [], unread: false, open: false });
    chatFilterChannels = F.toSet(chat.channels || chat.category);
    chatFilterUnread = Boolean(chat.unread);
    chatFilterImportant = Boolean(chat.important);

    const notify = F.loadScope(FILTER_SCOPE_NOTIFY, {
      types: [],
      unread: false,
      urgent: false,
      important: false,
      anpi: false,
      follow: false,
      period: "all",
      open: false,
    });
    notifyFilterTypes = F.toSet(notify.types || notify.category);
    notifyFilterUnread = Boolean(notify.unread);
    notifyFilterPeriod = String(notify.period || "all");
    notifyFilterUrgent = Boolean(notify.urgent);
    notifyFilterImportant = Boolean(notify.important);
    notifyFilterAnpi = Boolean(notify.anpi);
    notifyFilterFollow = Boolean(notify.follow);
    notifyFilterAdminSpecial = F.toSet(
      window.TasuTalkData?.normalizeAdminSpecialIds?.(notify.adminSpecial) ||
        notify.adminSpecial
    );
    if (notifyFilterAdminSpecial.has("ops_watch") || notifyFilterAdminSpecial.has("daily_info")) {
      notifyFilterTypes.add("ops_watch");
      notifyFilterAdminSpecial.delete("ops_watch");
      notifyFilterAdminSpecial.delete("daily_info");
    }
    try {
      if (global.localStorage?.getItem(FOLLOW_FILTER_STORAGE_KEY) === "1") {
        notifyFilterFollow = true;
      }
    } catch {
      /* ignore */
    }

    const unified = F.loadScope(FILTER_SCOPE_UNIFIED, {
      kinds: [],
      categories: [],
      reads: [],
      urgent: false,
      important: false,
      anpi: false,
      follow: false,
      open: false,
    });
    unifiedFilterKinds = F.toSet(unified.kinds);
    unifiedFilterCategories = F.toSet(unified.categories || unified.tag);
    unifiedFilterReads = F.toSet(unified.reads);
    unifiedFilterUrgent = Boolean(unified.urgent);
    unifiedFilterImportant = Boolean(unified.important);
    unifiedFilterAnpi = Boolean(unified.anpi);
    unifiedFilterFollow = Boolean(unified.follow);

    sanitizeFilterStateForCaps();
    if (lineListFilterId === "project") lineListFilterId = "builder";
  }

  /** 権限外の保存済みフィルタをクリア（表示だけ整理） */
  function sanitizeFilterStateForCaps() {
    const layout = window.TasuTalkHomeLayout;
    const caps = layout?.getCapabilities?.() || getLayoutCaps();
    const mode = layout?.getFilterUiMode?.(caps) || (caps.admin ? "admin" : caps.builder ? "builder" : "simple");

    if (mode !== "admin") {
      notifyFilterAdminSpecial = new Set();
      notifyFilterFollow = false;
      notifyFilterUrgent = false;
      notifyFilterAnpi = false;
      notifyFilterTypes = new Set(
        [...notifyFilterTypes].filter((id) => id !== "ops_watch")
      );
      unifiedFilterCategories = new Set(
        [...unifiedFilterCategories].filter((id) => id !== "ops_watch")
      );
    }

    if (mode === "simple") {
      const allowedNotify = new Set([
        "builder",
        "builder_admin_ops",
        "builder_board",
        "skill",
        "job",
        "business",
        "shop",
        "product",
        "anpi",
        "system",
        "connect",
      ]);
      notifyFilterTypes = new Set([...notifyFilterTypes].filter((id) => allowedNotify.has(id)));
      const allowedChat = new Set(layout?.SIMPLE_CHAT_FILTER_IDS || ["personal", "job", "business", "shop"]);
      chatFilterChannels = new Set(
        [...chatFilterChannels].filter((id) => allowedChat.has(id))
      );
    } else if (mode === "builder") {
      const allowedNotify = new Set([
        "builder",
        "builder_admin_ops",
        "builder_board",
        "skill",
        "job",
        "business",
        "shop",
        "product",
        "anpi",
        "system",
        "connect",
      ]);
      notifyFilterTypes = new Set([...notifyFilterTypes].filter((id) => allowedNotify.has(id)));
      const allowedChat = new Set([
        ...(layout?.SIMPLE_CHAT_FILTER_IDS || []),
        ...(layout?.BUILDER_CHAT_FILTER_IDS || ["builder"]),
      ]);
      chatFilterChannels = new Set(
        [...chatFilterChannels].filter((id) => allowedChat.has(id))
      );
    }
  }

  function persistChatFilterState() {
    const F = filterUi();
    if (!F) return;
    F.saveScope(FILTER_SCOPE_CHAT, {
      channels: F.setToArray(chatFilterChannels),
      unread: chatFilterUnread,
      important: chatFilterImportant,
    });
  }

  function persistNotifyFilterState() {
    const F = filterUi();
    if (!F) return;
    F.saveScope(FILTER_SCOPE_NOTIFY, {
      types: F.setToArray(notifyFilterTypes),
      unread: notifyFilterUnread,
      urgent: notifyFilterUrgent,
      important: notifyFilterImportant,
      anpi: notifyFilterAnpi,
      follow: notifyFilterFollow,
      period: notifyFilterPeriod,
      adminSpecial: F.setToArray(notifyFilterAdminSpecial),
    });
    try {
      global.localStorage?.setItem(FOLLOW_FILTER_STORAGE_KEY, notifyFilterFollow ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  function persistUnifiedFilterState() {
    const F = filterUi();
    if (!F) return;
    F.saveScope(FILTER_SCOPE_UNIFIED, {
      kinds: F.setToArray(unifiedFilterKinds),
      categories: F.setToArray(unifiedFilterCategories),
      reads: F.setToArray(unifiedFilterReads),
      urgent: unifiedFilterUrgent,
      important: unifiedFilterImportant,
      anpi: unifiedFilterAnpi,
      follow: unifiedFilterFollow,
    });
  }

  function resetChatFilters() {
    chatFilterChannels = new Set();
    chatFilterUnread = false;
    chatFilterImportant = false;
    persistChatFilterState();
    renderChatFilterPanel();
    renderChatThreads(threadsCache);
  }

  function resetNotifyFilters() {
    notifyMobileChipId = "";
    notifyFilterTypes = new Set();
    notifyFilterUnread = false;
    notifyFilterUrgent = false;
    notifyFilterImportant = false;
    notifyFilterAnpi = false;
    notifyFilterFollow = false;
    notifyFilterPeriod = "all";
    notifyFilterAdminSpecial = new Set();
    persistNotifyFilterState();
    renderNotifyFilterPanel();
    renderNotifications();
  }

  function resetUnifiedFilters() {
    unifiedFilterKinds = new Set();
    unifiedFilterCategories = new Set();
    unifiedFilterReads = new Set();
    unifiedFilterUrgent = false;
    unifiedFilterImportant = false;
    unifiedFilterAnpi = false;
    unifiedFilterFollow = false;
    persistUnifiedFilterState();
    renderUnifiedFilterPanel();
    renderUnifiedInbox();
  }

  function getChatFilterOptions() {
    return {
      listFilter: lineListFilterId,
      channels: filterUi()?.setToArray(chatFilterChannels) || [],
      unreadOnly: chatFilterUnread || lineListFilterId === "unread",
      importantOnly: chatFilterImportant || lineListFilterId === "important",
      query: chatSearchQuery,
    };
  }

  async function refreshChatThreads() {
    await loadChatThreads();
  }

  function markAllNotificationCenterReadUi() {
    window.TasuTalkData?.markAllNotificationCenterRead?.();
    chatFilterUnread = false;
    chatFilterImportant = false;
    persistChatFilterState();
    void refreshChatThreads();
    try {
      window.TasuTalkLineRoom?.openThreadById?.(window.TasuTalkLineRoom?.getActiveThreadId?.() || "");
    } catch {
      /* ignore */
    }
  }

  function getNotifyFilterOptions() {
    const settings = window.TasuTalkData?.getNotificationSettings?.();
    const benchRelax = isBenchNotifyEmbedContext();
    return {
      types: filterUi()?.setToArray(notifyFilterTypes) || [],
      filter: "all",
      applySettings: benchRelax ? false : true,
      showMuted: benchRelax ? true : settings?.showMuted === true,
      unreadOnly: notifyFilterUnread,
      followOnly: notifyFilterFollow,
      urgentOnly: notifyFilterUrgent,
      importantOnly: notifyFilterImportant,
      anpiOnly: notifyFilterAnpi,
      adminSpecial: filterUi()?.setToArray(notifyFilterAdminSpecial) || [],
      period: notifyFilterPeriod,
    };
  }

  function isNotifyFilterActive() {
    return Boolean(
      notifyFilterUnread ||
        notifyFilterFollow ||
        notifyFilterUrgent ||
        notifyFilterImportant ||
        notifyFilterAnpi ||
        notifyFilterTypes.size ||
        notifyFilterAdminSpecial.size ||
        (notifyFilterPeriod && notifyFilterPeriod !== "all") ||
        String(notifySearchQuery || "").trim()
    );
  }

  function isBenchNotifyCompactLayout() {
    return (
      document.body?.dataset?.benchEmbed === "1" &&
      document.body.classList.contains("talk-bench-notify-compact")
    );
  }

  function syncBenchNotifyEmbedHeightFromContext(forcedHeight) {
    const forced = Math.round(Number(forcedHeight) || benchNotifyFrameHeight || 0);
    global.TasuTalkChatDemoReviewMode?.syncBenchNotifyEmbedHeight?.(forced > 0 ? forced : 0);
  }

  let benchNotifyListScrollTop = 0;
  let benchNotifyFrameHeight = 0;
  let benchNotifyUserScrolling = false;
  let benchNotifyScrollQuietUntil = 0;
  let benchNotifyPointerOnAction = false;
  let benchNotifyRefreshTimer = 0;
  let benchNotifyRefreshQueued = false;

  function bindBenchNotifyScrollPreserve() {
    if (!isBenchNotifyCompactLayout()) return;
    const list = document.querySelector("[data-talk-notify-list]");
    if (!list || list.dataset.benchNotifyScrollWired === "1") return;
    list.dataset.benchNotifyScrollWired = "1";
    const onScroll = () => {
      benchNotifyListScrollTop = Math.round(list.scrollTop || 0);
      if (benchNotifyListScrollTop > 4) {
        benchNotifyUserScrolling = true;
        benchNotifyScrollQuietUntil = Date.now() + 2600;
      }
      try {
        const params = new URLSearchParams(window.location.search);
        const side = String(params.get("benchSide") || params.get("side") || "").trim();
        const frameId =
          side === "B" || side === "b" ? "frame-b-notify" : side === "A" || side === "a" ? "frame-a-notify" : "";
        window.parent?.postMessage?.(
          {
            type: "tasu-bench-preview-scroll",
            frameId,
            scrollTop: benchNotifyListScrollTop,
            isUserScrolling: benchNotifyUserScrolling || Date.now() < benchNotifyScrollQuietUntil,
          },
          "*"
        );
      } catch {
        /* ignore */
      }
    };
    list.addEventListener("scroll", onScroll, { passive: true });
    list.addEventListener("wheel", () => {
      benchNotifyScrollQuietUntil = Date.now() + 2600;
      onScroll();
    }, { passive: true });
    list.addEventListener("touchmove", () => {
      benchNotifyScrollQuietUntil = Date.now() + 2600;
      onScroll();
    }, { passive: true });
  }

  function syncNotifyListLayoutVars() {
    const panel = document.querySelector('[data-talk-panel="notify"]');
    const list = document.querySelector("[data-talk-notify-list]");
    if (!panel || !list) return;
    bindBenchNotifyScrollPreserve();

    const listTop = Math.max(0, Math.round(list.getBoundingClientRect().top));
    panel.style.setProperty("--talk-notify-list-offset-top", `${listTop}px`);

    if (isBenchNotifyCompactLayout()) {
      const savedScrollTop = Math.round(list.scrollTop || benchNotifyListScrollTop || 0);
      const viewportH = Math.max(
        96,
        Math.round(
          benchNotifyFrameHeight ||
            window.innerHeight ||
            document.documentElement.clientHeight ||
            0
        )
      );
      syncBenchNotifyEmbedHeightFromContext(viewportH);
      panel.style.setProperty("--talk-mobile-tabbar-total", "0px");
      panel.style.setProperty("--talk-notify-list-gap-bottom", "4px");
      const toolbar = panel.querySelector(".talk-notify-toolbar");
      const toolbarH = Math.round(toolbar?.getBoundingClientRect()?.height || 24);
      const available = Math.max(72, Math.round(viewportH - toolbarH - 10));
      panel.style.setProperty("--talk-notify-list-max-height", `${available}px`);
      list.style.height = `${available}px`;
      list.style.maxHeight = `${available}px`;
      list.style.minHeight = "0";
      list.classList.add("talk-notify-list--scrollable");
      const maxScroll = Math.max(0, list.scrollHeight - list.clientHeight);
      const targetScroll = Math.min(Math.max(0, savedScrollTop), maxScroll);
      const applyScroll = () => {
        list.scrollTop = targetScroll;
        benchNotifyListScrollTop = targetScroll;
      };
      applyScroll();
      requestAnimationFrame(applyScroll);
      return;
    }

    const tabBar = document.querySelector("[data-talk-mobile-tabbar]");
    const tabRect = tabBar?.getBoundingClientRect();
    const tabBarHeight = Math.round(tabRect?.height || 52);
    const gap = 12;
    const viewportH = window.innerHeight || document.documentElement.clientHeight || 844;
    const available = Math.max(120, Math.round(viewportH - listTop - tabBarHeight - gap));
    panel.style.setProperty("--talk-notify-list-max-height", `${available}px`);
    panel.style.setProperty("--talk-mobile-tabbar-total", `${tabBarHeight}px`);

    list.classList.remove("talk-notify-list--tabbar-pad");
    const baseScrollHeight = list.scrollHeight;
    const scrollable = baseScrollHeight > available + 2;
    list.classList.toggle("talk-notify-list--scrollable", scrollable);
  }

  function getNotifyCategoryChipDefs() {
    return window.TasuTalkData?.NOTIFY_CATEGORY_CHIP_DEFS || [];
  }

  function isNotifyCategoryChipActive(chip) {
    const types = chip?.filterTypes || [];
    if (!types.length) return false;
    return types.every((t) => notifyFilterTypes.has(t));
  }

  function clearNotifyCategoryFilter() {
    notifyFilterTypes = new Set();
    notifyMobileChipId = "";
  }

  function applyNotifyCategoryChip(chipId) {
    const chip = getNotifyCategoryChipDefs().find((c) => c.id === chipId);
    if (!chip) return;
    notifyFilterTypes = new Set(chip.filterTypes || [chipId]);
    notifyMobileChipId = chipId;
  }

  function toggleNotifyCategoryChip(chipId, active) {
    const chip = getNotifyCategoryChipDefs().find((c) => c.id === chipId);
    if (!chip) return;
    if (active) {
      (chip.filterTypes || []).forEach((t) => notifyFilterTypes.add(t));
      notifyMobileChipId = chipId;
    } else {
      (chip.filterTypes || []).forEach((t) => notifyFilterTypes.delete(t));
      if (notifyMobileChipId === chipId) notifyMobileChipId = "";
    }
  }

  function getTalkCategoryBarDefs() {
    const defs = window.TasuTalkData?.TALK_CATEGORY_BAR_DEFS;
    if (defs?.length) return defs;
    return (window.TasuTalkData?.NOTIFY_CATEGORY_CHIP_DEFS || []).map((chip) => ({
      id: chip.id,
      label: chip.label,
      notifyTypes: chip.filterTypes,
      chatChannels: chip.filterTypes || [chip.id],
    }));
  }

  function getLineCategoryTabs() {
    return window.TasuTalkData?.LINE_CATEGORY_TABS || [];
  }

  function getChatCategoryFilterOptions(counts) {
    return getLineCategoryTabs()
      .filter((row) => row.id !== "all")
      .map((row) => ({
        id: row.id,
        label: row.label,
        count: Number(counts?.[row.id]) || 0,
      }));
  }

  function isChatCategoryFilterActive(def) {
    return Boolean(def?.id && lineListFilterId === def.id);
  }

  function applyChatCategoryFilter(categoryId) {
    const def = getLineCategoryTabs().find((d) => d.id === categoryId);
    if (!def || def.id === "all") return;
    chatFilterChannels = new Set();
    chatFilterUnread = false;
    lineListFilterId = categoryId;
  }

  function toggleChatCategoryFilter(categoryId, active) {
    if (active) {
      applyChatCategoryFilter(categoryId);
    } else if (lineListFilterId === categoryId) {
      clearChatCategoryFilter();
    }
  }

  function clearChatCategoryFilter() {
    chatFilterChannels = new Set();
    chatFilterUnread = false;
    lineListFilterId = "all";
  }

  function buildNotifyCategoryFilterOptions(counts) {
    return getNotifyCategoryChipDefs().map((chip) => ({
      id: chip.id,
      label: chip.label,
      count: (chip.filterTypes || []).reduce(
        (sum, typeId) => sum + (Number(counts?.types?.[typeId]) || 0),
        0
      ),
    }));
  }

  function buildNotifyPeriodOptions() {
    return (window.TasuTalkData?.NOTIFY_PERIOD_FILTERS || []).map((row) => ({
      id: row.id,
      label: row.label,
      count: 0,
    }));
  }

  function isTalkAdminForFilters() {
    return Boolean(
      window.TasuTalkRuntime?.isTalkAdmin?.() ||
        window.TasuTalkHomeLayout?.getCapabilities?.()?.admin
    );
  }

  /**
   * talk-home 権限・運営用フィルター描画条件（ページ読込時に必ず出力）
   * @param {object} [extra]
   */
  function logTalkHomePermissionState(extra) {
    if (!isTalkDebugLogging()) return;
    const runtime = window.TasuTalkRuntime;
    const snap = runtime?.getTalkPermissionSnapshot?.() || {};
    const caps =
      window.TasuTalkHomeLayout?.getCapabilities?.() ||
      snap.caps ||
      { admin: false, builder: false, simple: true };
    const isAdmin = Boolean(runtime?.isTalkAdmin?.() ?? snap.isAdmin);
    const isBuilder = Boolean(runtime?.isBuilderUser?.() ?? snap.isBuilder);
    const role = snap.role ?? runtime?.getTalkAuthRole?.() ?? "(unknown)";

    console.log({
      isAdmin,
      isBuilder,
      role,
      caps,
    });

    const showAdminFilters = isTalkAdminForFilters();
    const notifyHost = $("[data-talk-notify-filter-sections]");
    const notifyPanel = $("[data-talk-notify-filter-panel]");

    console.log({
      adminFiltersRender: {
        showAdminFilters,
        chipsWhenTrue: ["運営連絡", "毎日の情報"],
        talkAdminActive:
          snap.talkAdminActive === true ||
          new URLSearchParams(global.location?.search || "").get("talkAdmin") === "1",
        conditions: {
          "runtime.isTalkAdmin()": isAdmin,
          "caps.admin": caps.admin,
          "isTalkAdminForFilters()": showAdminFilters,
          talkAdminParam: snap.talkAdminParam ?? "",
          isTalkAdminPreviewActive: snap.isTalkAdminPreviewActive,
          isAdminFromAuth: snap.isAdminFromAuth,
          adminPreviewStorage: global.localStorage?.getItem("tasu_talk_admin_preview") || "",
          isTalkDevMode: snap.isTalkDevMode,
          hostname: snap.hostname,
          bodyClassAdmin: document.body?.classList?.contains("talk-home--admin"),
          notifyFilterHostFound: Boolean(notifyHost),
          notifyFilterPanelHidden: notifyPanel?.hidden ?? true,
        },
        ...extra,
      },
    });

    if (!showAdminFilters) {
      console.warn(
        "[TasuTalk] 運営用フィルター非表示 — talkAdmin=1 を付与するか JWT 運営ロールが必要です。例: talk-home.html?tab=notify&talkAdmin=1"
      );
    }
  }

  /** 運営用フィルター表示・権限・OPS WATCH 保存形式のデバッグログ */
  function logTalkAdminFilterDebug(panelCtx) {
    if (!isTalkDebugLogging()) return;
    logTalkHomePermissionState({
      hasAdminGroup: panelCtx?.hasAdminGroup ?? false,
      secondaryGroupCount: panelCtx?.secondaryGroupCount ?? 0,
      hostFound: panelCtx?.hostFound,
      filterUiReady: panelCtx?.filterUiReady,
      talkDataReady: panelCtx?.talkDataReady,
    });

    const runtime = window.TasuTalkRuntime;
    const data = window.TasuTalkData;
    const showAdminFilters = isTalkAdminForFilters();
    const counts = panelCtx?.counts || data?.countNotificationsForFilters?.({}) || {};
    const adminCounts = counts.admin || {
      ops_watch: 0,
      ops_contact: 0,
      anpi: 0,
      report: 0,
    };
    const opsInspect = data?.inspectOpsWatchNotificationStorage?.() || null;
    const opsWatchInList = (data?.getNotifications?.({ filter: "all", applySettings: false }) || []).filter(
      (n) => String(n?.source || "").toLowerCase() === "ops_watch"
    );

    const rawStore = data?.countRawOpsWatchInStore?.() || {};
    console.log("[TasuTalk] 保存 source=ops_watch 件数", rawStore.sourceOpsWatchCount ?? 0, rawStore);
    console.log("[TasuTalk] 運営用フィルター件数", adminCounts);
    console.log("[TasuTalk] OPS WATCH通知件数（getNotifications後）", {
      visibleToAdmin: opsWatchInList.length,
      storedRelated: opsInspect?.opsWatchRelatedCount ?? 0,
      totalNotifications: opsInspect?.totalNotifications ?? 0,
    });
    console.log("[TasuTalk] OPS WATCH 通知の保存形式（source / type / category）", opsInspect);
  }

  /** ベンチ embed — renderNotifications 描画診断（親ページ / console 確認用） */
  function traceBenchNotifyRenderDiagnostics(listOpts, visibleAll, rows) {
    if (!isBenchNotifyEmbedContext()) return null;
    const params = new URLSearchParams(window.location.search);

    const talkData = window.TasuTalkData;
    const urlUserId = String(params.get("userId") || "").trim();
    const currentUserId = String(getMeId() || "").trim();
    const uid = resolveBenchNotifyUserId();
    const store = window.TasuTalkNotifications;
    const storeKey = store?.STORAGE_KEY || "tasful_talk_notifications";
    const storeAll = store?.getAll?.() || [];
    const recipientRows = storeAll.filter((n) => storeNotificationMatchesRecipient(n, uid));
    const Review = window.TasuTalkChatDemoReviewMode;
    const Live = window.TasuPlatformChatLiveFlow;
    const filteredRecipient =
      Review?.filterChatDemoReviewNotifications?.(recipientRows) || recipientRows;

    const filterRejections = recipientRows
      .filter((n) => !filteredRecipient.some((f) => String(f.id) === String(n.id)))
      .map((n) => {
        const reasons = [];
        if (n?.sendNotification === false) reasons.push("sendNotification=false");
        if (Live?.isRuntimeLiveFlowNotification?.(n) !== true) reasons.push("not_runtime_live_flow");
        if (Review?.notificationMatchesDemoUser?.(n) === false) reasons.push("demo_user_mismatch");
        if (!reasons.length) reasons.push("chat_demo_review_filter");
        return { id: n.id, title: n.title, source: n.source, reasons };
      });

    const pipeline = talkData?.traceNotificationPipeline?.(listOpts) || {};
    const filterDiag = window.__tasuBenchNotifyFilterDiag || {};
    const paintDiag = window.__tasuBenchNotifyPaintDiag || {};
    const rowsLength = (rows || []).length;
    let aNotificationRenderDiff = "—";
    if (recipientRows.length < 1) {
      aNotificationRenderDiff = "NG store=0";
    } else if (rowsLength < 1) {
      const dropReason = pickStr(filterDiag.filterDropReason, paintDiag.filterDropReason);
      aNotificationRenderDiff = dropReason
        ? `NG store=${recipientRows.length} rows=0; filterDropReason: ${dropReason}`
        : `NG store=${recipientRows.length} rows=0`;
    } else {
      aNotificationRenderDiff = `OK store=${recipientRows.length} rows=${rowsLength}`;
    }
    const diag = {
      at: new Date().toISOString(),
      storeKey,
      userId: uid,
      urlUserId,
      currentUserId,
      storeFetchCount: storeAll.length,
      rowsLength,
      cardsRendered: document.querySelectorAll(".talk-notify-card").length,
      visibleAllLength: (visibleAll || []).length,
      storeAllCount: storeAll.length,
      recipientRowsCount: recipientRows.length,
      recipientTitles: recipientRows.map((n) => n.title),
      afterChatDemoFilterCount: filteredRecipient.length,
      filterRejections,
      listOpts,
      pipelineFinalCount: pipeline.finalCount ?? null,
      pipelineSteps: pipeline.steps || [],
      domCardCount: document.querySelectorAll(".talk-notify-card").length,
      domEmpty: Boolean(document.querySelector(".talk-notify-empty-state__title")),
      domEmptyText: document.querySelector(".talk-notify-empty-state__title")?.textContent?.trim() || "",
      domVisibleCardTitle:
        document.querySelector(".talk-notify-card__title, .talk-notify-card__title--job-event")?.textContent?.trim() ||
        "",
      notifyPanelHeight: Math.round(
        document.querySelector('[data-talk-panel="notify"]')?.getBoundingClientRect?.().height || 0
      ),
      notifyListHeight: Math.round(document.querySelector("[data-talk-notify-list]")?.getBoundingClientRect?.().height || 0),
      notifyRenderSig: document.querySelector("[data-talk-notify-list]")?.dataset?.notifyRenderSig || "",
      domNeedsRender: notifyListDomNeedsRender(document.querySelector("[data-talk-notify-list]"), rows),
      benchCompact: isBenchNotifyCompactLayout(),
      latestRowTitle: pickStr(rows?.[0]?.title),
      latestRowHref: pickStr(rows?.[0]?.href, rows?.[0]?.targetUrl),
      latestRowType: pickStr(rows?.[0]?.type),
      latestRowRecipient: pickStr(rows?.[0]?.recipientUserId),
      filterDropReason: pickStr(filterDiag.filterDropReason, paintDiag.filterDropReason),
      filterDropNgCode: pickStr(filterDiag.filterDropNgCode, paintDiag.filterDropNgCode),
      filterDropStage: pickStr(filterDiag.filterDropStage, paintDiag.filterDropStage),
      beforeFilterCount: filterDiag.beforeFilterCount ?? storeAll.length,
      afterRecipientFilterCount: filterDiag.afterRecipientFilterCount ?? null,
      afterCategoryFilterCount: filterDiag.afterCategoryFilterCount ?? null,
      afterStageFilterCount: filterDiag.afterStageFilterCount ?? null,
      finalRowsCount: filterDiag.finalRowsCount ?? rowsLength,
      perNotificationFilterLogs: filterDiag.perNotificationLogs || [],
      aNotificationRenderDiff,
    };

    window.__tasuBenchNotifyRenderDiag = diag;
    publishBenchNotifyDomDiag(rows);
    console.log("[TasuTalk:bench-notify-render]", diag);
    return diag;
  }

  function publishBenchNotifyDomDiag(rows) {
    try {
      const cards = document.querySelectorAll(".talk-notify-card");
      const firstCard = cards[0];
      const cta = firstCard?.querySelector(
        "[data-talk-notify-action], .talk-notify-card__minimal-action, .talk-notify-card__card-cta"
      );
      const emptyEl = document.querySelector(".talk-notify-empty-state__title");
      const errorEl = document.querySelector(
        ".talk-notify-error, [data-talk-notify-error], .talk-notify-load-error"
      );
      window.__tasuBenchNotifyDomDiag = {
        at: new Date().toISOString(),
        actualNotifyRowDomCount: cards.length,
        actualNotifyLatestRowText: pickStr(
          firstCard?.querySelector(".talk-notify-card__title, .talk-notify-card__title--job-event")
            ?.textContent
        ),
        actualNotifyLatestHref: pickStr(
          cta?.getAttribute("href"),
          cta?.dataset?.href,
          rows?.[0]?.href,
          rows?.[0]?.targetUrl
        ),
        actualNotifyErrorText: pickStr(errorEl?.textContent),
        actualNotifyErrorVisible: Boolean(errorEl && !errorEl.hidden),
        actualNotifyEmptyTextVisible: Boolean(emptyEl && pickStr(emptyEl.textContent)),
        actualNotifyEmptyText: pickStr(emptyEl?.textContent),
      };
    } catch {
      /* ignore */
    }
  }

  /** 通知一覧描画時 — ops_watch 除外の有無をパイプラインでログ */
  function logNotifyListRenderAudit(listOpts, rows) {
    if (!isTalkDebugLogging()) return;
    const data = window.TasuTalkData;
    if (!data) return;

    const raw = data.countRawOpsWatchInStore?.() || {};
    const counts = data.countNotificationsForFilters?.({
      applySettings: listOpts?.applySettings !== false,
      showMuted: listOpts?.showMuted === true,
    }) || {};
    const pipeline = data.traceNotificationPipeline?.(listOpts) || {};

    const renderedOps = (rows || []).filter(
      (n) => String(n?.source || "").toLowerCase() === "ops_watch"
    ).length;

    console.log("[TasuTalk] 保存 source=ops_watch 件数", raw.sourceOpsWatchCount ?? 0);
    console.log(
      "[TasuTalk] 運営用フィルター件数",
      counts.admin || { ops_watch: 0, ops_contact: 0, anpi: 0, report: 0 }
    );
    console.log("[TasuTalk] 通知一覧描画", {
      listOpts,
      renderedRowCount: (rows || []).length,
      renderedOpsWatchCount: renderedOps,
      pipelineFinalOpsWatch: pipeline.finalOpsWatch ?? 0,
      pipelineFinalTotal: pipeline.finalCount ?? 0,
      capsAdmin: pipeline.capsAdmin,
    });
    console.log("[TasuTalk] 通知一覧パイプライン（ops_watch 除外確認）", pipeline);

    const adminGate = pipeline.steps?.find((s) => String(s.name).startsWith("5_adminGate"));
    if (adminGate?.removed > 0) {
      console.warn(
        "[TasuTalk] ops_watch は adminGate で除外されました（運営権限 caps.admin=false）",
        adminGate
      );
    }
    const settingsStep = pipeline.steps?.find((s) => s.name === "4_applyInboxSettings");
    if (settingsStep?.removed > 0 && (raw.sourceOpsWatchCount || 0) > (pipeline.finalOpsWatch || 0)) {
      console.warn(
        "[TasuTalk] 受信設定 applyInboxSettings で通知が除外された可能性",
        settingsStep
      );
    }
    const typeStep = pipeline.steps?.find((s) => s.name === "2_typeFilter");
    if (typeStep?.removed > 0) {
      console.warn("[TasuTalk] カテゴリ type フィルターで除外", typeStep);
    }
  }

  function getUnifiedInboxFilterOptions() {
    return {
      kinds: filterUi()?.setToArray(unifiedFilterKinds) || [],
      categories: filterUi()?.setToArray(unifiedFilterCategories) || [],
      reads: filterUi()?.setToArray(unifiedFilterReads) || [],
      urgentOnly: unifiedFilterUrgent,
      importantOnly: unifiedFilterImportant,
      anpiOnly: unifiedFilterAnpi,
      followOnly: unifiedFilterFollow,
    };
  }

  function renderChatFilterPanel() {
    const host = $("[data-talk-chat-filter-sections]");
    const F = filterUi();
    const data = window.TasuTalkData;
    const layout = window.TasuTalkHomeLayout;
    if (!host || !F || !data) return;

    const caps = layout?.getCapabilities?.() || getLayoutCaps();
    const mode = layout?.getFilterUiMode?.(caps) || "simple";
    const counts = data.countChatThreadsByChannel?.(threadsCache) || {};
    let channels = data.CHAT_CHANNELS || [];
    if (layout?.filterChatChannels) {
      channels = layout.filterChatChannels(channels);
    }
    const categoryOptions = getChatCategoryFilterOptions(counts);

    if (mode !== "admin") {
      const categorySelected = new Set(
        getLineCategoryTabs()
          .filter((def) => isChatCategoryFilterActive(def))
          .map((def) => def.id)
      );

      F.renderTagPanel(host, {
        hint: "条件を選んで絞り込み（複数選択可）",
        primarySectionId: "read",
        primaryOptions: [
          { id: "unread", label: "未読のみ", count: counts.unread || 0 },
          { id: "important", label: "重要のみ", count: counts.important || 0 },
        ],
        secondaryGroups: [
          {
            id: "tag",
            label: "カテゴリ",
            scrollable: true,
            options: categoryOptions,
          },
        ],
        selected: {
          read: new Set([
            ...(chatFilterUnread ? ["unread"] : []),
            ...(chatFilterImportant ? ["important"] : []),
          ]),
          tag: categorySelected,
        },
        onToggle: (sectionId, optionId, active) => {
          if (sectionId === "read") {
            if (optionId === "unread") chatFilterUnread = active;
            if (optionId === "important") chatFilterImportant = active;
          }
          if (sectionId === "tag") {
            toggleChatCategoryFilter(optionId, active);
          }
          persistChatFilterState();
          renderChatFilterPanel();
          renderLineListFilters();
          renderChatThreads(threadsCache);
        },
        onReset: resetChatFilters,
      });
      return;
    }

    F.renderTagPanel(host, {
      hint: "カテゴリをタップしてトーク一覧を絞り込み（複数選択可）",
      primarySectionId: "tag",
      primaryOptions: sortOptionsByOrder(categoryOptions, CHAT_QUICK_TAG_ORDER),
      secondaryGroups: [
        {
          id: "read",
          label: "状態",
          options: [{ id: "unread", label: "未読", count: counts.unread || 0 }],
        },
      ],
      selected: {
        tag: new Set(lineListFilterId !== "all" ? [lineListFilterId] : []),
        read: chatFilterUnread ? new Set(["unread"]) : new Set(),
      },
      onToggle: (sectionId, optionId, active) => {
        if (sectionId === "tag") {
          if (active) applyChatCategoryFilter(optionId);
          else clearChatCategoryFilter();
        }
        if (sectionId === "read") chatFilterUnread = active && optionId === "unread";
        persistChatFilterState();
        renderChatFilterPanel();
        renderLineListFilters();
        renderChatThreads(threadsCache);
      },
      onReset: resetChatFilters,
    });
  }

  /** 通知タブ — 横スクロールカテゴリバー（すべて + カテゴリ） */
  let notifyMobileChipId = "";

  function renderNotifyCategoryBar() {
    const host = $("[data-talk-notify-mobile-chips]");
    const chipDefs = getNotifyCategoryChipDefs();
    const data = window.TasuTalkData;
    if (!host || !chipDefs.length || !data) return;

    const settings = data.getNotificationSettings?.();
    const counts = getCachedNotifyFilterCounts({
      applySettings: true,
      showMuted: settings?.showMuted === true,
    });
    const allActive =
      !notifyFilterUnread &&
      notifyFilterTypes.size === 0 &&
      notifyFilterPeriod === "all" &&
      !notifyMobileChipId;

    const allChip = `<button type="button" class="talk-notify-mobile-chip${allActive ? " is-active" : ""}" data-talk-notify-mobile-chip="all" aria-pressed="${allActive ? "true" : "false"}">すべて</button>`;

    const categoryHtml = chipDefs
      .map((chip) => {
        const types = chip.filterTypes || [chip.id];
        const count = types.reduce((sum, t) => sum + (Number(counts.types?.[t]) || 0), 0);
        const active = isNotifyCategoryChipActive(chip);
        const countLabel =
          count > 0 ? ` <span class="talk-notify-mobile-chip__count">${count}</span>` : "";
        return `<button type="button" class="talk-notify-mobile-chip${active ? " is-active" : ""}" data-talk-notify-mobile-chip="${escapeHtml(chip.id)}" aria-pressed="${active ? "true" : "false"}">${escapeHtml(chip.label)}${countLabel}</button>`;
      })
      .join("");

    host.innerHTML = allChip + categoryHtml;

    if (host.dataset.wired) return;
    host.dataset.wired = "1";
    host.addEventListener("click", (e) => {
      const btn = /** @type {HTMLElement|null} */ (
        e.target instanceof Element ? e.target.closest("[data-talk-notify-mobile-chip]") : null
      );
      if (!btn) return;
      const id = btn.getAttribute("data-talk-notify-mobile-chip") || "";
      if (id === "all") {
        notifyFilterUnread = false;
        clearNotifyCategoryFilter();
      } else {
        const chip = chipDefs.find((c) => c.id === id);
        if (!chip) return;
        if (isNotifyCategoryChipActive(chip)) {
          clearNotifyCategoryFilter();
        } else {
          applyNotifyCategoryChip(id);
          notifyFilterUnread = false;
          notifyFilterImportant = false;
        }
      }
      persistNotifyFilterState();
      renderNotifyFilterPanel();
      renderNotifications();
    });
  }

  function renderNotifyQuickRow() {
    /* すべては renderNotifyCategoryBar に統合 */
  }

  function renderNotifyFilterPanel() {
    renderNotifyQuickRow();
    renderNotifyCategoryBar();
    const host = $("[data-talk-notify-filter-sections]");
    const F = filterUi();
    const data = window.TasuTalkData;
    if (!host || !F || !data) {
      logTalkAdminFilterDebug({
        hostFound: Boolean(host),
        filterUiReady: Boolean(F),
        talkDataReady: Boolean(data),
        counts: {},
        secondaryGroupCount: 0,
        hasAdminGroup: false,
      });
      return;
    }

    const layout = window.TasuTalkHomeLayout;
    const caps = layout?.getCapabilities?.() || getLayoutCaps();
    const mode = layout?.getFilterUiMode?.(caps) || "simple";
    const settings = data.getNotificationSettings?.();
    const counts = getCachedNotifyFilterCounts({
      applySettings: true,
      showMuted: settings?.showMuted === true,
    });

    const categoryOptions = buildNotifyCategoryFilterOptions(counts);
    const periodOptions = buildNotifyPeriodOptions();
    const categorySelected = new Set(
      getNotifyCategoryChipDefs()
        .filter((chip) => isNotifyCategoryChipActive(chip))
        .map((chip) => chip.id)
    );
    const periodSelected = new Set(notifyFilterPeriod && notifyFilterPeriod !== "all" ? [notifyFilterPeriod] : []);

    const sharedGroups = [
      {
        id: "tag",
        label: "カテゴリ",
        scrollable: true,
        options: categoryOptions,
      },
      {
        id: "period",
        label: "期間",
        options: periodOptions,
      },
    ];

    const onSharedToggle = (sectionId, optionId, active) => {
      if (sectionId === "read") {
        notifyFilterUnread = active;
      }
      if (sectionId === "tag") {
        toggleNotifyCategoryChip(optionId, active);
      }
      if (sectionId === "period") {
        if (!active || optionId === "all") notifyFilterPeriod = "all";
        else notifyFilterPeriod = optionId;
      }
      persistNotifyFilterState();
      renderNotifyFilterPanel();
      renderNotifications();
    };

    if (mode !== "admin") {
      F.renderTagPanel(host, {
        hint: "条件を選んで絞り込み（複数選択可）",
        primarySectionId: "read",
        primaryOptions: [{ id: "unread", label: "未読のみ", count: counts.flags?.unread || 0 }],
        secondaryGroups: sharedGroups,
        selected: {
          read: new Set(notifyFilterUnread ? ["unread"] : []),
          tag: categorySelected,
          period: periodSelected,
        },
        onToggle: onSharedToggle,
        onReset: resetNotifyFilters,
      });
      return;
    }

    const admin = counts.admin || {};
    const adminPrimaryOptions = [
      { id: "ops_watch", label: "OPS WATCH", count: admin.ops_watch || 0 },
      { id: "ops_contact", label: "運営連絡", count: admin.ops_contact || 0 },
      { id: "anpi", label: "安否", count: admin.anpi || 0 },
      { id: "report", label: "通報", count: admin.report || 0 },
    ];

    const secondaryGroups = [
      {
        id: "read",
        label: "状態",
        options: [
          { id: "unread", label: "未読のみ", count: counts.flags?.unread || 0 },
          { id: "follow", label: "フォロー", count: counts.flags?.follow || 0 },
        ],
      },
      ...sharedGroups,
      {
        id: "priority",
        label: "重要度",
        options: [
          { id: "urgent", label: "緊急", count: counts.flags?.urgent || 0 },
          { id: "important", label: "重要", count: counts.flags?.important || 0 },
        ],
      },
    ];

    logTalkAdminFilterDebug({
      hostFound: true,
      filterUiReady: true,
      talkDataReady: true,
      counts,
      secondaryGroupCount: secondaryGroups.length,
      hasAdminGroup: true,
    });

    F.renderTagPanel(host, {
      hint: "OPS WATCH・運営連絡などをタップして絞り込み（複数選択可）",
      primarySectionId: "admin",
      primaryOptions: adminPrimaryOptions,
      secondaryGroups,
      selected: {
        tag: categorySelected,
        admin: notifyFilterAdminSpecial,
        read: new Set(
          [notifyFilterUnread && "unread", notifyFilterFollow && "follow"].filter(Boolean)
        ),
        priority: new Set(
          [
            notifyFilterUrgent && "urgent",
            notifyFilterImportant && "important",
            notifyFilterAnpi && "anpi",
          ].filter(Boolean)
        ),
        period: periodSelected,
      },
      onToggle: (sectionId, optionId, active) => {
        if (sectionId === "admin") {
          if (active) notifyFilterAdminSpecial.add(optionId);
          else notifyFilterAdminSpecial.delete(optionId);
        }
        if (sectionId === "read") {
          if (optionId === "unread") notifyFilterUnread = active;
          if (optionId === "follow") notifyFilterFollow = active;
        }
        if (sectionId === "priority") {
          if (optionId === "urgent") notifyFilterUrgent = active;
          if (optionId === "important") notifyFilterImportant = active;
          if (optionId === "anpi") notifyFilterAnpi = active;
        }
        if (sectionId === "tag" || sectionId === "period") {
          onSharedToggle(sectionId, optionId, active);
          return;
        }
        persistNotifyFilterState();
        renderNotifyFilterPanel();
        renderNotifications();
      },
      onReset: resetNotifyFilters,
    });
  }

  function renderUnifiedFilterPanel() {
    const host = $("[data-talk-unified-filter-sections]");
    const F = filterUi();
    const data = window.TasuTalkData;
    if (!host || !F || !data) return;

    const source = data.collectUnifiedInboxSourceItems?.() || [];
    const counts = data.countUnifiedInboxForFilters?.(source) || {
      kinds: {},
      categories: {},
      reads: {},
      flags: {},
    };

    const categoryOptions = (data.getUnifiedInboxCategoryFiltersForUi?.() || data.UNIFIED_INBOX_CATEGORY_FILTERS || [])
      .filter((r) => r.id !== "all")
      .map((r) => ({ id: r.id, label: r.label, count: counts.categories?.[r.id] || 0 }));

    const unifiedQuickOrder = [
      "job",
      "skill",
      "builder",
      "business",
      "shop",
      "ai_consult",
      "system",
      "ops_watch",
      "anpi",
      "ad",
      "notice",
      "worker",
      "product",
    ];

    F.renderTagPanel(host, {
      hint: "カテゴリをタップして統合ビューを絞り込み（複数選択可）",
      primarySectionId: "tag",
      primaryOptions: sortOptionsByOrder(categoryOptions, unifiedQuickOrder),
      secondaryGroups: [
        {
          id: "kind",
          label: "種別",
          options: (data.UNIFIED_INBOX_KIND_FILTERS || [])
            .filter((r) => r.id !== "all")
            .map((r) => ({ id: r.id, label: r.label, count: counts.kinds?.[r.id] || 0 })),
        },
        {
          id: "read",
          label: "状態",
          options: [
            { id: "unread", label: "未読", count: counts.reads?.unread || 0 },
            { id: "read", label: "既読", count: counts.reads?.read || 0 },
          ],
        },
        {
          id: "priority",
          label: "重要度",
          options: [
            { id: "urgent", label: "緊急", count: counts.flags?.urgent || 0 },
            { id: "important", label: "重要", count: counts.flags?.important || 0 },
            { id: "follow", label: "フォロー", count: counts.flags?.follow || 0 },
          ],
        },
      ],
      selected: {
        tag: unifiedFilterCategories,
        kind: unifiedFilterKinds,
        read: unifiedFilterReads,
        priority: new Set(
          [
            unifiedFilterUrgent && "urgent",
            unifiedFilterImportant && "important",
            unifiedFilterAnpi && "anpi",
            unifiedFilterFollow && "follow",
          ].filter(Boolean)
        ),
      },
      onToggle: (sectionId, optionId, active) => {
        if (sectionId === "tag") {
          if (active) unifiedFilterCategories.add(optionId);
          else unifiedFilterCategories.delete(optionId);
        }
        if (sectionId === "kind") {
          if (active) unifiedFilterKinds.add(optionId);
          else unifiedFilterKinds.delete(optionId);
        }
        if (sectionId === "read") {
          if (active) unifiedFilterReads.add(optionId);
          else unifiedFilterReads.delete(optionId);
        }
        if (sectionId === "priority") {
          if (optionId === "urgent") unifiedFilterUrgent = active;
          if (optionId === "important") unifiedFilterImportant = active;
          if (optionId === "anpi") unifiedFilterAnpi = active;
          if (optionId === "follow") unifiedFilterFollow = active;
        }
        persistUnifiedFilterState();
        renderUnifiedFilterPanel();
        renderUnifiedInbox();
      },
      onReset: resetUnifiedFilters,
    });
  }

  function initFilterPanels() {
    const F = filterUi();
    if (!F) return;
    F.bindCollapsible({
      scopeId: FILTER_SCOPE_CHAT,
      toggleBtn: $("[data-talk-chat-filter-toggle]"),
      panel: $("[data-talk-chat-filter-panel]"),
      defaultOpen: false,
    });
    F.bindCollapsible({
      scopeId: FILTER_SCOPE_NOTIFY,
      toggleBtn: $("[data-talk-notify-filter-toggle]"),
      panel: $("[data-talk-notify-filter-panel]"),
      defaultOpen: false,
    });
    F.bindCollapsible({
      scopeId: FILTER_SCOPE_UNIFIED,
      toggleBtn: $("[data-talk-unified-filter-toggle]"),
      panel: $("[data-talk-unified-filter-panel]"),
      defaultOpen: false,
    });
    renderChatFilterPanel();
    renderNotifyFilterPanel();
    renderUnifiedFilterPanel();
  }

  function renderUnifiedInboxActionButtons(item, actions) {
    if (!actions.length) return "";
    return `<div class="talk-unified-inbox-card__actions" data-talk-unified-actions>
      ${actions
        .map((a) => {
          const primary = a.kind === "primary" ? " talk-unified-inbox-card__action--primary" : "";
          const danger = a.kind === "danger" ? " talk-unified-inbox-card__action--danger" : "";
          const confirm = a.confirm
            ? ` data-talk-unified-action-confirm="${escapeHtml(a.confirm)}"`
            : "";
          return `<button type="button" class="talk-unified-inbox-card__action${primary}${danger}" data-talk-unified-action="${escapeHtml(a.id)}" data-talk-unified-item-kind="${escapeHtml(item.kind)}" data-talk-unified-item-id="${escapeHtml(item.id)}"${confirm}>${escapeHtml(a.label)}</button>`;
        })
        .join("")}
    </div>`;
  }

  function renderUnifiedInbox() {
    const listHost = $("[data-talk-unified-list]");
    const summaryHost = $("[data-talk-unified-summary]");
    if (!listHost) return;

    const data = window.TasuTalkData;
    let items = [];
    try {
      items = data?.getUnifiedInboxItems?.(getUnifiedInboxFilterOptions()) || [];
    } catch (err) {
      console.warn("[talk-home] unified inbox failed:", err);
      listHost.innerHTML = `<p class="talk-empty">統合ビューを読み込めませんでした</p>`;
      return;
    }

    if (summaryHost) {
      const stats = data?.getDashboardStats?.() || {};
      const unreadN = items.filter((i) => i.kind === "notification" && i.unread).length;
      const aiN = items.filter((i) => i.kind === "ai_draft").length;
      const bcN = items.filter((i) => i.kind === "broadcast_draft").length;
      const quickParts = [];
      if (unifiedFilterUrgent) quickParts.push("緊急");
      if (unifiedFilterImportant) quickParts.push("重要");
      if (unifiedFilterAnpi) quickParts.push("安否");
      if (unifiedFilterFollow) quickParts.push("フォロー");
      if (unifiedFilterKinds.size) quickParts.push(`種別${unifiedFilterKinds.size}`);
      if (unifiedFilterCategories.size) quickParts.push(`カテゴリ${unifiedFilterCategories.size}`);
      let text = `表示 ${items.length} 件（未読 ${unreadN}・安否 ${stats.anpiUnread ?? 0}・緊急 ${stats.urgent ?? 0}・AI ${aiN}・配信 ${bcN}）`;
      if (quickParts.length) text += ` · 絞り込み: ${quickParts.join("・")}`;
      summaryHost.textContent = text;
    }

    if (!items.length) {
      listHost.innerHTML = `<p class="talk-empty">該当する項目はありません。フィルタを変えるか、通知・AI・配信下書きを作成してください。</p>`;
      return;
    }

    const kindLabels = data?.UNIFIED_KIND_LABELS || {};

    const cardsHtml = items
      .map((item) => {
        const kindLabel = kindLabels[item.kind] || item.kind;
        const catLabel = data?.getUnifiedCategoryLabel?.(item.category) || item.category;
        const actions = data?.buildUnifiedItemActions?.(item) || [];
        const time = escapeHtml(formatNotifyTime(item.updatedAt) || "");
        const emphasis = escapeHtml(item.emphasis || "normal");
        const unreadClass = item.unread ? " talk-unified-inbox-card--unread" : "";
        const staticClass = item.kind === "static" ? " talk-unified-inbox-card--static" : "";
        const anpiClass = item.isAnpi ? " talk-unified-inbox-card--anpi" : "";
        const followBadge =
          item.kind === "notification" && isFollowNotification(item.raw) ? followBadgeHtml(item.raw) : "";
        return `
        <article class="talk-unified-inbox-card talk-unified-inbox-card--${emphasis}${unreadClass}${staticClass}${anpiClass}" data-talk-unified-card="${escapeHtml(item.kind)}" data-talk-unified-item-id="${escapeHtml(item.id)}">
          <div class="talk-unified-inbox-card__head">
            <div class="talk-unified-inbox-card__badges">
              <span class="talk-unified-inbox-card__kind talk-unified-inbox-card__kind--${escapeHtml(item.kind)}">${escapeHtml(kindLabel)}</span>
              <span class="talk-unified-inbox-card__category">${escapeHtml(catLabel)}</span>
              ${followBadge}
            </div>
            ${time ? `<time class="talk-unified-inbox-card__time" datetime="${escapeHtml(item.updatedAt)}">${time}</time>` : ""}
          </div>
          <h3 class="talk-unified-inbox-card__title">${escapeHtml(item.title)}</h3>
          <p class="talk-unified-inbox-card__summary">${escapeHtml(item.summary)}</p>
          ${renderUnifiedInboxActionButtons(item, actions)}
        </article>`;
      })
      .join("");

    listHost.innerHTML = cardsHtml;
  }

  async function handleUnifiedAiRegenerate(draftId) {
    const row = window.TasuTalkAiDrafts?.findById?.(draftId);
    if (!row) {
      setAiStatus("下書きが見つかりません", "error");
      return;
    }
    activeAiMode = normalizeAiMode(row.mode);
    aiSession = {
      mode: activeAiMode,
      input: row.input,
      output: row.output,
      draftId: row.id,
    };
    setTab("ai", true);
    const inputEl = /** @type {HTMLTextAreaElement|null} */ ($("[data-talk-ai-input]"));
    if (inputEl) inputEl.value = row.input;
    syncAiModeUi();
    setAiStatus("再生成中…", "");
    try {
      if (!window.TasuTalkAi?.generateTalkAiDraft) throw new Error("TasuTalkAi unavailable");
      const draft = await window.TasuTalkAi.generateTalkAiDraft(activeAiMode, {
        prompt: row.input,
        topic: "TASFUL TALK",
      });
      showAiResult(draft.text || "");
      setAiStatus("下書きを再生成しました", "ok");
      recordInboxAction("unified-ai-regenerate", "AI下書きを再生成");
      refreshTalkSurfaces();
    } catch (err) {
      console.warn(err);
      setAiStatus("再生成に失敗しました", "error");
    }
  }

  async function handleUnifiedInboxAction(btn) {
    const actionId = btn.getAttribute("data-talk-unified-action");
    const itemKind = btn.getAttribute("data-talk-unified-item-kind");
    const itemId = btn.getAttribute("data-talk-unified-item-id");
    const label = btn.textContent?.trim() || actionId;
    if (!actionId || !itemKind || !itemId) return;

    const confirmMsg = btn.getAttribute("data-talk-unified-action-confirm");
    const skipConfirm = global.__TASU_TALK_SKIP_ACTION_CONFIRM === true;
    if (confirmMsg && !skipConfirm && !global.confirm(confirmMsg)) return;

    if (itemKind === "static" && actionId === "static-run") {
      const items = window.TasuTalkData?.getUnifiedInboxItems?.({ kind: "all", read: "all", category: "all" }) || [];
      const row = items.find((i) => i.id === itemId);
      if (row?.quickAction) {
        runQuickAction(row.quickAction);
        recordInboxAction(`unified-static-${row.quickAction}`, label);
      }
      return;
    }

    if (itemKind === "notification") {
      const row =
        window.TasuTalkData?.findNotificationById?.(itemId) ||
        window.TasuTalkNotifications?.findById?.(itemId);
      if (!row) return;
      row.unread = window.TasuTalkNotifications?.isUnread?.(row) ?? !row.readAt;
      const result = window.TasuTalkNotifyActions?.executeNotificationAction?.(actionId, row) || {
        ok: false,
      };
      if (result.highlightBroadcastId) {
        pendingHighlightBroadcastId = String(result.highlightBroadcastId);
      }
      if (result.navigate) {
        if (String(result.navigate).includes("tab=ai")) {
          setTab("ai", true);
          renderBroadcastDrafts();
          global.setTimeout(() => goToBroadcastHighlight(pendingHighlightBroadcastId), 120);
          recordInboxAction(`unified-${actionId}`, label);
          refreshTalkSurfaces();
          return;
        }
        if (result.navigate.startsWith("http") || result.navigate.includes(".html")) {
          recordInboxAction(`unified-${actionId}`, label);
          navigateToAppPage(result.navigate);
          return;
        }
      }
      if (result.ok) {
        recordInboxAction(`unified-${actionId}`, label);
        refreshTalkSurfaces();
      }
      return;
    }

    if (itemKind === "ai_draft") {
      const row = window.TasuTalkAiDrafts?.findById?.(itemId);
      if (!row) return;

      if (actionId === "ai-copy") {
        try {
          const text = String(row.output || "");
          if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
          else {
            const ta = document.createElement("textarea");
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            ta.remove();
          }
          setAiStatus("クリップボードにコピーしました", "ok");
          recordInboxAction("unified-ai-copy", label);
        } catch (err) {
          console.warn(err);
          setAiStatus("コピーに失敗しました", "error");
        }
        return;
      }

      if (actionId === "ai-to-notify") {
        const result = window.TasuTalkAiDrafts?.pushAsNotification?.({
          mode: row.mode,
          input: row.input,
          output: row.output,
        });
        if (!result?.ok) {
          setAiStatus("通知の追加に失敗しました", "error");
          return;
        }
        window.TasuTalkAiDrafts?.markUsed?.(itemId);
        recordInboxAction("unified-ai-to-notify", label);
        refreshTalkSurfaces();
        return;
      }

      if (actionId === "ai-discard") {
        window.TasuTalkAiDrafts?.markDiscarded?.(itemId);
        recordInboxAction("unified-ai-discard", label);
        refreshTalkSurfaces();
        return;
      }

      if (actionId === "ai-regenerate") {
        await handleUnifiedAiRegenerate(itemId);
        return;
      }
    }

    if (itemKind === "broadcast_draft") {
      const store = window.TasuTalkBroadcastDrafts;
      const row = store?.findById?.(itemId);
      if (!row) return;

      if (actionId === "broadcast-view") {
        openBroadcastView(row);
        recordInboxAction("unified-broadcast-view", label);
        return;
      }
      if (actionId === "broadcast-send") {
        openBroadcastSendConfirm(row);
        recordInboxAction("unified-broadcast-send", label);
        return;
      }
      if (actionId === "broadcast-test") {
        const result = window.TasuTalkData?.addTestNotificationFromBroadcastDraft?.(row);
        if (!result?.ok) {
          setAiStatus("テスト通知の追加に失敗しました", "error");
          return;
        }
        recordInboxAction("unified-broadcast-test", label);
        refreshTalkSurfaces();
        return;
      }
      if (actionId === "broadcast-history") {
        goToBroadcastHighlight(itemId);
        recordInboxAction("unified-broadcast-history", label);
        return;
      }
      if (actionId === "broadcast-delete") {
        try {
          store?.remove?.(itemId);
          recordInboxAction("unified-broadcast-delete", label);
          refreshTalkSurfaces();
          setAiStatus("配信下書きを削除しました", "ok");
        } catch (err) {
          console.warn(err);
          setAiStatus("削除に失敗しました", "error");
        }
      }
    }
  }

  function wireUnifiedInbox() {
    if (window.__talkUnifiedInboxBound) return;
    window.__talkUnifiedInboxBound = true;

    document.addEventListener(
      "click",
      (e) => {
        const btn = /** @type {HTMLElement|null} */ (
          e.target
        )?.closest?.("[data-talk-unified-action]");
        if (!btn || !btn.closest("[data-talk-unified-list]")) return;
        e.preventDefault();
        e.stopPropagation();
        handleUnifiedInboxAction(btn);
      },
      true
    );

  }

  function renderDashboard() {
    const data = window.TasuTalkData;
    if (!data) return;

    if (getLayoutCaps().simple) return;

    const statsHost = $("[data-talk-dashboard-stats]");
    if (statsHost) {
      const stats = data.getDashboardStats?.() || {};
      const caps = getLayoutCaps();
      statsHost.innerHTML = DASHBOARD_STAT_ITEMS.filter(
        (item) => !item.adminOnly || caps.admin
      ).map((item) => {
        const value = Number(stats[item.key]) || 0;
        const prev = Number(lastDashboardStats[item.key]) || 0;
        const pulse = value > prev ? " talk-dashboard-stat--pulse" : "";
        lastDashboardStats[item.key] = value;
        return `
        <div class="talk-dashboard-stat talk-dashboard-stat--${escapeHtml(item.tone)}${pulse}" data-talk-stat-key="${escapeHtml(item.key)}">
          <span class="talk-dashboard-stat__value" data-talk-stat-value="${escapeHtml(item.key)}">${escapeHtml(String(value))}</span>
          <span class="talk-dashboard-stat__label">${escapeHtml(item.label)}</span>
        </div>`;
      }).join("");
    }

    const importantHost = $("[data-talk-dashboard-important]");
    if (importantHost) {
      const types = data.NOTIFICATION_TYPES || {};
      const priorities = data.PRIORITY_META || {};
      const rows = data.getImportantNotifications?.(3) || [];
      if (!rows.length) {
        importantHost.innerHTML = `<p class="talk-empty talk-dashboard-empty">重要な未読通知はありません</p>`;
      } else {
        importantHost.innerHTML = rows
          .map((n) => {
            const meta = types[n.type] || { label: n.type, tone: "slate" };
            const prio = priorities[n.priority] || priorities.normal;
            const targetUrl = escapeHtml(n.targetUrl || "#");
            return `
            <article class="talk-dashboard-alert talk-dashboard-alert--${escapeHtml(n.priority || "important")}" data-talk-dashboard-alert-id="${escapeHtml(n.id)}" data-talk-dashboard-alert-target="${targetUrl}" tabindex="0" role="button">
              <span class="talk-dashboard-alert__type talk-notify-card__type ${toneClass(meta.tone)}">${escapeHtml(meta.label)}</span>
              ${followBadgeHtml(n)}
              <span class="talk-notify-priority ${escapeHtml(prio.className || "")}">${escapeHtml(prio.label)}</span>
              <p class="talk-dashboard-alert__title">${escapeHtml(n.title)}</p>
              <p class="talk-dashboard-alert__meta"><time datetime="${escapeHtml(n.createdAt)}">${escapeHtml(formatNotifyTime(n.createdAt))}</time></p>
            </article>`;
          })
          .join("");

        importantHost.querySelectorAll("[data-talk-dashboard-alert-id]").forEach((el) => {
          const open = () => {
            const id = el.getAttribute("data-talk-dashboard-alert-id");
            const target = el.getAttribute("data-talk-dashboard-alert-target");
            openNotification(id, target);
          };
          el.addEventListener("click", open);
          el.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              open();
            }
          });
        });
      }
    }

    const recentHost = $("[data-talk-dashboard-recent]");
    if (recentHost) {
      const recent = data.getRecentChats?.(threadsCache, 3) || [];
      if (!recent.length) {
        recentHost.innerHTML = `<li class="talk-empty talk-dashboard-empty">最近のチャットはありません</li>`;
      } else {
        recentHost.innerHTML = recent
          .map((t) => {
            const channel = resolveTalkChannel(t);
            const channelLabel = getChatChannelLabel(channel);
            const href = escapeHtml(resolveRecentChatHref(t));
            const preview = escapeHtml(t.lastMessagePreview || "（メッセージなし）");
            const title = escapeHtml(t.listing?.title || "（案件名未設定）");
            const updated = escapeHtml(formatLocalUpdatedAt(t._sortAt || t.updatedAt) || formatNotifyTime(t.updatedAt));
            const unread = t.unreadCount > 0 ? formatUnreadBadge(t.unreadCount) : "";
            return `
            <li class="talk-dashboard-recent__item">
              <a class="talk-dashboard-recent__link" href="${href}">
                <span class="talk-dashboard-recent__channel">${escapeHtml(channelLabel)}</span>
                <span class="talk-dashboard-recent__title">${title}</span>
                <span class="talk-dashboard-recent__preview">${preview}</span>
                <span class="talk-dashboard-recent__meta">${updated} ${unread}</span>
              </a>
            </li>`;
          })
          .join("");
      }
    }

    renderRecentActions();
    renderUnifiedInbox();
  }

  function wireDashboard() {
    if (window.__talkDashboardBound) return;
    window.__talkDashboardBound = true;

    $("[data-talk-dashboard-view-all-notify]")?.addEventListener("click", () => {
      setTab("notify", true);
    });

    $("[data-talk-dashboard-go-chat]")?.addEventListener("click", () => {
      runQuickAction("chatSearch");
    });

    const scheduleRefresh = (detail) => {
      if (global.__tasuTalkSuppressNotifyRefresh === true) return;
      window.clearTimeout(window.__talkRealtimeRefreshTimer);
      const notifyOnly =
        detail?.notifyOnly === true ||
        String(detail?.source || "").includes("notification") ||
        String(detail?.eventName || "").includes("notifications-changed");
      window.__talkRealtimeRefreshTimer = window.setTimeout(() => {
        refreshTalkSurfaces({ notifyOnly });
      }, 120);
    };
    const events = [
      "tasful-talk-notifications-changed",
      "tasful-talk-anpi-arrived",
      "tasful-talk-notification-settings-changed",
      "tasful-talk-ai-drafts-changed",
      "tasful-talk-broadcast-drafts-changed",
      "tasful-talk-follow-changed",
    ];
    events.forEach((name) =>
      window.addEventListener(name, (ev) => scheduleRefresh(ev?.detail || { eventName: name }))
    );
    global.document?.addEventListener("tasu:anpi-notification-log-created", scheduleRefresh);
    global.document?.addEventListener("tasful:anpi-notification-created", scheduleRefresh);
  }

  function wireChatSearch() {
    const input = /** @type {HTMLInputElement|null} */ ($("[data-talk-chat-search]"));
    if (!input || input.dataset.wired) return;
    input.dataset.wired = "1";
    input.addEventListener("input", () => {
      chatSearchQuery = input.value || "";
      renderChatThreads(threadsCache);
    });
  }

  function wireNotifySearch() {
    const input = /** @type {HTMLInputElement|null} */ ($("[data-talk-notify-search]"));
    if (!input || input.dataset.wired) return;
    input.dataset.wired = "1";
    input.addEventListener("input", () => {
      notifySearchQuery = input.value || "";
      renderNotifications();
    });
  }

  function renderLineListFilters() {
    const host = $("[data-talk-line-list-filters]");
    const filters = window.TasuTalkData?.LINE_CATEGORY_TABS || window.TasuTalkData?.LINE_LIST_FILTERS || [];
    if (!host || !filters.length) return;

    host.innerHTML = filters
      .map((f) => {
        const on =
          lineListFilterId === f.id || (f.id === "all" && lineListFilterId === "all");
        return `<button type="button" class="talk-line-category-tab${on ? " is-active" : ""}" role="tab" aria-selected="${on ? "true" : "false"}" data-talk-line-filter="${escapeHtml(f.id)}">${escapeHtml(f.label)}</button>`;
      })
      .join("");

    host.querySelectorAll("[data-talk-line-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-talk-line-filter") || "all";
        lineListFilterId = id;
        if (id === "all") {
          clearChatCategoryFilter();
          activeLineNav = "talk";
        } else {
          applyChatCategoryFilter(id);
          activeLineNav = id === "platform" || id === "anpi" ? id : "talk";
        }
        persistChatFilterState();
        renderLineListFilters();
        renderChatFilterPanel();
        renderChatThreads(threadsCache);
        syncLineRailActive();
      });
    });
  }

  function openFriendAddModal() {
    const modal = $("[data-talk-friend-add-modal]");
    if (!modal) return;
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
  }

  function closeFriendAddModal() {
    const modal = $("[data-talk-friend-add-modal]");
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
  }

  function wireFriendAddModal() {
    if (window.__talkFriendAddBound) return;
    window.__talkFriendAddBound = true;
    document.querySelectorAll("[data-talk-friend-add-close]").forEach((el) => {
      el.addEventListener("click", closeFriendAddModal);
    });
  }

  function closeListOverflowMenu() {
    const menu = $("[data-talk-list-overflow-menu]");
    if (!menu) return;
    menu.hidden = true;
    menu.setAttribute("aria-hidden", "true");
    $("[data-talk-list-overflow-open]")?.setAttribute("aria-expanded", "false");
  }

  function toggleListOverflowMenu(anchor) {
    const menu = $("[data-talk-list-overflow-menu]");
    if (!menu) return;
    const open = menu.hidden;
    menu.hidden = !open;
    menu.setAttribute("aria-hidden", open ? "false" : "true");
    anchor?.setAttribute("aria-expanded", open ? "true" : "false");
    if (open && anchor) {
      const rect = anchor.getBoundingClientRect();
      menu.style.top = `${Math.round(rect.bottom + 6)}px`;
      menu.style.right = `${Math.max(8, Math.round(global.innerWidth - rect.right))}px`;
    }
  }

  function wireListOverflowMenu() {
    if (window.__talkListOverflowBound) return;
    window.__talkListOverflowBound = true;
    $("[data-talk-list-overflow-open]")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleListOverflowMenu(event.currentTarget);
    });
    document.addEventListener("click", (event) => {
      if (
        event.target instanceof Element &&
        (event.target.closest("[data-talk-list-overflow-menu]") ||
          event.target.closest("[data-talk-list-overflow-open]"))
      ) {
        return;
      }
      closeListOverflowMenu();
    });
    document.querySelectorAll("[data-talk-list-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-talk-list-action");
        closeListOverflowMenu();
        if (action === "unread-only") {
          lineListFilterId = "all";
          chatFilterUnread = true;
          chatFilterImportant = false;
          persistChatFilterState();
          renderLineListFilters();
          renderChatFilterPanel();
          renderChatThreads(threadsCache);
        }
        if (action === "important-only") {
          lineListFilterId = "all";
          chatFilterImportant = true;
          chatFilterUnread = false;
          persistChatFilterState();
          renderLineListFilters();
          renderChatFilterPanel();
          renderChatThreads(threadsCache);
        }
        if (action === "mark-all-read") {
          markAllNotificationCenterReadUi();
        }
        if (action === "open-notify") {
          setTab("notify", true);
        }
      });
    });
    document.querySelectorAll("[data-talk-open-notify]").forEach((btn) => {
      btn.addEventListener("click", () => {
        setTab("notify", true);
      });
    });
    global.addEventListener("tasful-talk-notification-center-read-all", () => {
      void refreshChatThreads();
    });
  }

  function wireLineRailNav() {
    if (window.__talkLineRailBound) return;
    window.__talkLineRailBound = true;
    document.querySelectorAll("[data-talk-line-nav]").forEach((el) => {
      el.addEventListener("click", (e) => {
        if (el.tagName === "A") {
          const href = el.getAttribute("href") || "";
          if (href && href !== "#" && !href.startsWith("javascript:")) return;
        }
        const nav = el.getAttribute("data-talk-line-nav");
        if (!nav || nav === "mypage" || nav === "ops") return;
        e.preventDefault();
        setLineNav(nav);
      });
    });
  }

  /** スマホ下部タブ — 現在地表示 */
  function syncMobileTabbar(tab) {
    const bar = document.querySelector("[data-talk-mobile-tabbar]");
    if (!bar) return;
    bar.querySelectorAll("[data-talk-mobile-tab]").forEach((el) => {
      const id = el.getAttribute("data-talk-mobile-tab");
      const on =
        (id === "chat" && (tab === "chat" || tab === "notify")) ||
        (id === "ai" && tab === "ai");
      el.classList.toggle("is-active", on);
      if (el.tagName === "A" || el.tagName === "BUTTON") {
        if (on) el.setAttribute("aria-current", "page");
        else el.removeAttribute("aria-current");
      }
    });
  }

  /** @param {object} t */
  function renderChatCardHtml(t) {
    const Model = window.TasuTalkChatThreadModel;
    if (Model?.renderTalkLineListItemHtml) {
      return Model.renderTalkLineListItemHtml(t, { escapeHtml });
    }
    if (Model?.renderTalkListItemHtml) {
      const channel = resolveTalkChannel(t);
      const caps = getLayoutCaps();
      return Model.renderTalkListItemHtml(t, {
        escapeHtml,
        appendUserUrl,
        showDomainBadge: !caps.simple,
        resolveTalkHref: () => "#",
        resolveRelatedHref: (row) => window.TasuTalkData?.resolveChatListingUrl?.(row) || "",
        builderSubtle: caps.simple && channel === "builder",
      });
    }
    return "";
  }

  function renderChatThreads(threads) {
    const list = $("#talkChatThreadList");
    if (!list) return;

    const data = window.TasuTalkData;
    const display = data?.buildChatDisplayList?.(threads) || threads || [];
    let filtered =
      data?.applyChatHubFilters?.(display, getChatFilterOptions()) || display;
    if (window.TasuTalkWorkerReviewMode?.isWorkerReviewMode?.()) {
      filtered = window.TasuTalkWorkerReviewMode.filterWorkerReviewChatThreads(filtered);
    } else if (window.TasuTalkJobFullReviewMode?.isJobFullReviewMode?.()) {
      filtered = window.TasuTalkJobFullReviewMode.filterJobFullReviewChatThreads(filtered);
    } else if (window.TasuTalkJobReviewMode?.isJobReviewMode?.()) {
      filtered = window.TasuTalkJobReviewMode.filterJobReviewChatThreads(filtered);
    }

    const dynamicOnly = (threads || []).filter((t) => !t._staticCard);
    const hasFilter =
      (lineListFilterId && lineListFilterId !== "all") ||
      chatFilterChannels.size > 0 ||
      chatFilterUnread ||
      chatFilterImportant ||
      String(chatSearchQuery || "").trim().length > 0;

    if (!filtered.length) {
      const emptyMsg =
        !hasFilter && dynamicOnly.length === 0
          ? data?.CHAT_EMPTY_MESSAGE ||
            "まだチャットはありません。求人・サービス・商品から問い合わせできます"
          : "該当するチャットはありません";
      const emptyClass =
        !hasFilter && dynamicOnly.length === 0 ? " talk-chat-empty" : "";
      list.innerHTML = `<li class="talk-empty${emptyClass}">${escapeHtml(emptyMsg)}</li>`;
      return;
    }

    list.innerHTML = filtered.map((t) => renderChatCardHtml(t)).join("");
  }

  async function hydratePreviews(threads) {
    if (window.TasuChatService?.isUsingSupabase?.()) return threads;
    const needsPreview = threads.some((t) => !t.lastMessagePreview);
    if (!needsPreview) return threads;

    return Promise.all(
      threads.map(async (t) => {
        if (t.lastMessagePreview) return t;
        const { messages } = await window.TasuChatService.loadMessages(t.id);
        const last = messages[messages.length - 1];
        return {
          ...t,
          lastMessagePreview: last?.attachment?.dataUrl ? "📎 画像" : last?.text || "",
        };
      })
    );
  }

  async function ensureChatThreadsLoaded() {
    if (chatThreadsLoaded || chatThreadsLoading) return;
    chatThreadsLoading = true;
    try {
      await loadChatThreads();
      chatThreadsLoaded = true;
      global.__tasuTalkChatThreadsLoadedProbe = true;
    } finally {
      chatThreadsLoading = false;
    }
  }

  async function loadChatThreads() {
    const list = $("#talkChatThreadList");
    if (list) {
      list.innerHTML = `<li class="talk-empty">読み込み中…</li>`;
    }

    if (!window.TasuChatService?.ensureInitialized) {
      threadsCache = [];
      if (window.TasuTalkChatThreadModel?.enrichThreads) {
        threadsCache = window.TasuTalkChatThreadModel.enrichThreads(threadsCache);
      }
      renderChatThreads(threadsCache);
      renderDashboard();
      return;
    }

    await window.TasuChatService.ensureInitialized();
    let threads = await window.TasuChatService.loadThreads();
    let localRows = [];
    try {
      localRows = window.TasuChatThreadStore?.getAllForChatList?.() || [];
    } catch (err) {
      console.warn("[talk-home] local thread store read failed:", err);
    }
    if (localRows.length) {
      const localIds = new Set(localRows.map((t) => String(t.id)));
      threads = [...localRows, ...threads.filter((t) => !localIds.has(String(t.id)))];
    }

    const enriched = await hydratePreviews(threads);
    let sorted = window.TasuTalkData?.sortChatThreads?.(enriched) || enriched;
    if (window.TasuTalkChatThreadModel?.enrichThreads) {
      sorted = window.TasuTalkChatThreadModel.enrichThreads(sorted);
    }
    if (window.TasuTalkData?.filterNotificationCenterThreads) {
      sorted = window.TasuTalkData.filterNotificationCenterThreads(sorted);
    }
    const Ops = window.TasuTalkOpsAssistant;
    if (Ops?.syncNotifications) {
      try {
        Ops.syncNotifications();
        const preview = Ops.getRoomPreview();
        const opsId = Ops.OPS_ROOM_ID;
        sorted = sorted.map((t) =>
          String(t.id) === opsId
            ? {
                ...t,
                lastMessagePreview: preview.lastMessagePreview,
                unreadCount: preview.unreadCount,
              }
            : t
        );
      } catch (err) {
        console.warn("[talk-home] ops assistant sync failed:", err);
      }
    }
    if (window.TasuTalkOfficialRooms?.syncAllFromStore) {
      try {
        window.TasuTalkOfficialRooms.syncAllFromStore();
        window.TasuTalkOfficialRooms.repairOfficialThreadsFromMessages?.();
      } catch (err) {
        console.warn("[talk-home] official rooms sync failed:", err);
      }
    }
    threadsCache = sorted.map((t) => ({ ...t }));
    renderChatThreads(threadsCache);
    renderDashboard();
  }

  function toneClass(tone) {
    return `talk-notify-card__type--${tone || "slate"}`;
  }

  function isFollowNotification(n) {
    if (window.TasuTalkData?.isFollowNotification) {
      return window.TasuTalkData.isFollowNotification(n);
    }
    if (window.TasuTalkNotifications?.isFollowSource) {
      return window.TasuTalkNotifications.isFollowSource(n);
    }
    return String(n?.source || "").toLowerCase() === "follow";
  }

  function followBadgeHtml(n) {
    if (!isFollowNotification(n)) return "";
    return `<span class="talk-notify-follow-badge" title="フォロー・お気に入り連動">フォロー</span>`;
  }

  function readFollowOnlyPref() {
    try {
      return global.localStorage.getItem(FOLLOW_FILTER_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  }

  function getTalkScrollPanel(tab) {
    const id = tab || activeTab;
    const panel =
      document.querySelector(`[data-talk-panel="${id}"]`) ||
      document.querySelector('[data-talk-panel="notify"]');
    if (panel && panel.scrollHeight > panel.clientHeight + 2) return panel;

    const roots = [
      panel,
      panel?.querySelector(".talk-card"),
      document.querySelector(".talk-home-main"),
      document.querySelector(".dash-content"),
      document.scrollingElement,
    ].filter(Boolean);

    for (const root of roots) {
      let el = root;
      while (el && el !== document.body) {
        const style = global.getComputedStyle(el);
        const scrollable =
          (style.overflowY === "auto" || style.overflowY === "scroll") &&
          el.scrollHeight > el.clientHeight + 2;
        if (scrollable) return el;
        el = el.parentElement;
      }
    }

    return panel || document.scrollingElement || document.documentElement;
  }

  function findNotifyCardById(notifyId) {
    const id = String(notifyId || "").trim();
    if (!id) return null;
    return document.querySelector(`[data-talk-notify-id="${CSS.escape(id)}"]`);
  }

  function captureNotifyCardPosition(notificationId, panel) {
    const scrollPanel = panel || getTalkScrollPanel(activeTab);
    const card = findNotifyCardById(notificationId);
    if (!card || !scrollPanel) {
      return { cardOffset: 0, cardIndex: -1 };
    }
    const cards = [...scrollPanel.querySelectorAll("[data-talk-notify-id]")];
    const cardIndex = cards.indexOf(card);
    const panelRect = scrollPanel.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const cardOffset = Math.max(
      0,
      Math.round(scrollPanel.scrollTop + (cardRect.top - panelRect.top))
    );
    return { cardOffset, cardIndex };
  }

  function ensureNavigationFromParam(href) {
    const raw = String(href || "").trim();
    if (!raw || raw === "#") return raw;
    try {
      const u = new URL(raw, window.location.href);
      const existingFrom = String(u.searchParams.get("from") || "").toLowerCase();
      const openReview = String(
        u.searchParams.get("openReview") || u.searchParams.get("reviewOpen") || ""
      ).toLowerCase();
      if (existingFrom === "notify" || openReview === "1" || openReview === "true") {
        return raw;
      }
      const from = activeTab === "chat" ? "talk" : activeTab === "notify" ? "notify" : "";
      if (!from) return raw;
      u.searchParams.set("from", from);
      return `${u.pathname}${u.search}${u.hash}`;
    } catch {
      return raw;
    }
  }

  function resetListScrollPosition(tab) {
    const id = tab || activeTab;
    const panel = getTalkScrollPanel(id);
    if (panel) {
      panel.scrollTop = 0;
      requestAnimationFrame(() => {
        panel.scrollTop = 0;
      });
    }
    if (global.scrollY !== 0) {
      global.scrollTo(0, 0);
    }
  }

  function saveTalkReturnState(notificationId) {
    try {
      global.sessionStorage.removeItem(TALK_RETURN_STATE_KEYS.scroll);
      global.sessionStorage.removeItem(TALK_RETURN_STATE_KEYS.cardOffset);
      global.sessionStorage.removeItem(TALK_RETURN_STATE_KEYS.cardIndex);
      global.sessionStorage.setItem(TALK_RETURN_STATE_KEYS.tab, activeTab);
      global.sessionStorage.setItem(TALK_RETURN_STATE_KEYS.lineNav, activeLineNav);
      if (notificationId) {
        global.sessionStorage.setItem(TALK_RETURN_STATE_KEYS.notifyId, String(notificationId));
      } else {
        global.sessionStorage.removeItem(TALK_RETURN_STATE_KEYS.notifyId);
      }
      global.sessionStorage.setItem(TALK_RETURN_STATE_KEYS.restore, "1");

      const returnUrl = new URL(window.location.href);
      returnUrl.searchParams.set("tab", activeTab);
      returnUrl.hash = "";
      const storedReturn = `${returnUrl.pathname}${returnUrl.search}`;
      global.sessionStorage.setItem("tasu_talk_return_url", storedReturn);
    } catch {
      /* ignore */
    }
  }

  let talkReturnRestoreToken = 0;

  function clearTalkReturnStateStorage() {
    global.sessionStorage.removeItem(TALK_RETURN_STATE_KEYS.restore);
    global.sessionStorage.removeItem(TALK_RETURN_STATE_KEYS.scroll);
    global.sessionStorage.removeItem(TALK_RETURN_STATE_KEYS.tab);
    global.sessionStorage.removeItem(TALK_RETURN_STATE_KEYS.lineNav);
    global.sessionStorage.removeItem(TALK_RETURN_STATE_KEYS.notifyId);
    global.sessionStorage.removeItem(TALK_RETURN_STATE_KEYS.cardOffset);
    global.sessionStorage.removeItem(TALK_RETURN_STATE_KEYS.cardIndex);
  }

  function restoreTalkReturnState() {
    try {
      const hasRestoreFlag = global.sessionStorage.getItem(TALK_RETURN_STATE_KEYS.restore) === "1";
      const urlTab = normalizeTalkTabParam(
        new URLSearchParams(window.location.search).get("tab") || ""
      );
      const urlTabExplicit = TAB_IDS.includes(urlTab);
      const sessionTab = normalizeTalkTabParam(
        global.sessionStorage.getItem(TALK_RETURN_STATE_KEYS.tab) || ""
      );
      const returnUrlTab = readReturnTabFromReturnUrl();
      const fromNotify = readFromNotifyContext();

      let targetTab = activeTab;
      if (urlTabExplicit) {
        targetTab = urlTab;
      } else if (fromNotify) {
        targetTab = "notify";
      } else if (hasRestoreFlag && TAB_IDS.includes(returnUrlTab)) {
        targetTab = returnUrlTab;
      } else if (hasRestoreFlag && TAB_IDS.includes(sessionTab)) {
        targetTab = sessionTab;
      }

      const lineNav = global.sessionStorage.getItem(TALK_RETURN_STATE_KEYS.lineNav) || activeLineNav;
      if (hasRestoreFlag && lineNav && lineNav !== activeLineNav) {
        activeLineNav = lineNav;
        syncLineRailActive();
      }
      if (TAB_IDS.includes(targetTab) && targetTab !== activeTab) {
        setTab(targetTab, !urlTabExplicit);
      } else if (targetTab === "notify") {
        renderNotifyFilterPanel();
        renderNotifications();
      }

      if (hasRestoreFlag) {
        clearTalkReturnStateStorage();
      }

      const token = ++talkReturnRestoreToken;
      const run = () => {
        if (token !== talkReturnRestoreToken) return;
        if (targetTab === "chat") {
          const threadId = String(
            new URLSearchParams(window.location.search).get("thread") ||
              new URLSearchParams(window.location.search).get("roomId") ||
              ""
          ).trim();
          if (!threadId) resetListScrollPosition("chat");
          return;
        }
        if (targetTab === "notify" || targetTab === "ai") {
          resetListScrollPosition(targetTab);
          if (targetTab === "notify") ensureNotifyTabPainted();
        }
      };

      [0, 80, 200, 400, 700].forEach((delay) => {
        global.setTimeout(run, delay);
      });
    } catch {
      /* ignore */
    }
  }

  function resolveNotifyActionElementId(btn) {
    if (!btn) return "";
    return (
      pickStr(btn.getAttribute("data-talk-notify-id")) ||
      pickStr(btn.closest("[data-talk-notify-id]")?.getAttribute("data-talk-notify-id"))
    );
  }

  function tryBenchParentFrameNavigate(url) {
    const Embed = window.TasuPlatformChatBenchEmbed;
    if (!Embed) return false;
    if (Embed.tryPostBenchFrameNavigate?.(url)) return true;
    if (!Embed.isBenchParentContext?.()) return false;
    return Embed.postBenchFrameNavigateMessage?.(url) === true;
  }

  function shouldDelegateBuilderBenchNotification(url) {
    if (!window.TasuBuilderBenchEmbed?.isBuilderBenchParent?.()) return false;
    const target = String(url || "");
    if (/builder\//i.test(target)) return true;
    return /(?:^|\/)(?:mvp-project-detail|mvp-thread|mvp-threads|mvp-projects|mvp-calendar|board-project-detail|board-thread|board-projects|partner-assignment|public-board-detail)\.html/i.test(
      target
    );
  }

  function navigateToAppPage(href, options) {
    const raw = ensureNavigationFromParam(href);
    if (!raw || raw === "#") return;
    let url = raw;
    try {
      url = new URL(raw, window.location.href).href;
    } catch {
      url = raw;
    }
    window.TasuPlatformChatReviewFlow?.stampReviewNotifyClickFromHref?.(url);
    const notifyRow =
      options?.notificationId &&
      (window.TasuTalkData?.findNotificationById?.(options.notificationId) ||
        window.TasuTalkNotifications?.findById?.(options.notificationId));
    const notificationType = pickStr(options?.notificationType, notifyRow?.type);
    if (
      shouldDelegateBuilderBenchNotification(url) &&
      window.TasuBuilderBenchEmbed?.followNotification?.(url, options?.notificationId, {
        type: notificationType,
        notificationType,
      })
    ) {
      saveTalkReturnState(options?.notificationId);
      return;
    }
    if (tryBenchParentFrameNavigate(url)) {
      saveTalkReturnState(options?.notificationId);
      return;
    }
    saveTalkReturnState(options?.notificationId);
    if (options?.notificationId) {
      window.TasuTalkData?.markNotificationRead?.(options.notificationId);
    }
    try {
      window.TasufulAppMobile?.markAppShellNavigation?.({
        returnUrl: global.sessionStorage.getItem("tasu_talk_return_url") || undefined,
      });
    } catch {
      /* ignore */
    }
    window.location.assign(url);
  }

  function openNotification(id, targetUrl) {
    if (id) markNotifyReadBeforeNavigate(id);
    const row =
      window.TasuTalkData?.findNotificationById?.(id) ||
      window.TasuTalkNotifications?.findById?.(id);
    const nav = row ? window.TasuTalkNotifyActions?.buildNotifyNavigateAction?.(row) : null;
    const href = nav?.href || (row ? window.TasuTalkNotifyActions?.resolveNotificationOpenHref?.(row) : targetUrl);
    navigateToAppPage(href || targetUrl, { notificationId: id });
  }

  function wireNotificationDetail() {
    window.TasuTalkNotifyDetail?.init?.({
      escapeHtml,
      formatNotifyTime,
      onAction: (actionId, notifyId, meta) => {
        runNotificationAction(actionId, notifyId, meta);
      },
    });
  }

  function renderNotificationActionsHtml() {
    return "";
  }

  function isBuilderGeneralFlowApplicationPosterNotify(n) {
    if (!n || typeof n !== "object") return false;
    const kind = pickStr(n.builderNotifyKind, n.builder_notify_kind);
    if (kind === "general_flow_application_poster") return true;
    const source = String(n.source || "").toLowerCase();
    const title = String(n.title || "");
    const type = String(n.type || "").toLowerCase();
    const href = String(n.href || n.targetUrl || "");
    return (
      source === "builder-mvp" &&
      type === "builder" &&
      /応募がありました/.test(title) &&
      /view=applications/.test(href)
    );
  }

  function renderBuilderApplicationPosterActionsHtml(n) {
    const notifyId = escapeHtml(n.id);
    const reviewHref = escapeHtml(
      window.TasuTalkNotifyActions?.resolveNotificationOpenHref?.(n) || pickStr(n.href, n.targetUrl, "#")
    );
    return (
      `<div class="talk-notify-card__dual-actions" role="group" aria-label="応募への対応">` +
      `<button type="button" class="talk-notify-card__action talk-notify-card__platform-action talk-notify-card__action--ghost talk-notify-card__card-cta talk-notify-card__minimal-action" data-talk-notify-action="builder-general-decline" data-talk-notify-id="${notifyId}">見送る</button>` +
      `<button type="button" class="talk-notify-card__action talk-notify-card__platform-action talk-notify-card__action--primary talk-notify-card__card-cta talk-notify-card__minimal-action" data-talk-notify-action="builder-general-start-chat" data-talk-notify-id="${notifyId}"${reviewHref && reviewHref !== "#" ? ` data-talk-notify-href="${reviewHref}"` : ""}>やりとりを開始する</button>` +
      `</div>`
    );
  }

  function handleBuilderGeneralFlowPosterNotifyAction(actionId, notifyId) {
    if (actionId !== "builder-general-decline" && actionId !== "builder-general-start-chat") {
      return false;
    }
    const row =
      window.TasuTalkData?.findNotificationById?.(notifyId) ||
      window.TasuTalkNotifications?.findById?.(notifyId);
    if (!row || !isBuilderGeneralFlowApplicationPosterNotify(row)) return false;
    const projectId = pickStr(row.projectId, row.project_id);
    const action = actionId === "builder-general-start-chat" ? "start_chat" : "decline";
    if (
      window.TasuBuilderBenchEmbed?.postGeneralFlowPosterAction?.(action, {
        projectId,
        notificationId: notifyId,
      })
    ) {
      window.TasuTalkData?.markNotificationRead?.(notifyId);
      refreshTalkSurfaces();
      return true;
    }
    return false;
  }

  function notifyTierApi() {
    return window.TasuTalkNotifyTier || {};
  }

  function resolveNotifyNavigateHref(n) {
    const nav = window.TasuTalkNotifyActions?.buildNotifyNavigateAction?.(n);
    if (nav?.href && nav.href !== "#") return nav.href;
    return pickStr(
      window.TasuTalkNotifyActions?.resolveNotificationOpenHref?.(n),
      n?.href,
      n?.targetUrl,
      "#"
    );
  }

  function markNotifyReadBeforeNavigate(notifyId) {
    const id = pickStr(notifyId);
    if (!id) return null;
    return window.TasuTalkData?.markNotificationRead?.(id) || null;
  }

  function renderImportantAnpiCtaHtml(n) {
    const href = escapeHtml(resolveNotifyNavigateHref(n));
    const sub = pickStr(n?.subType);
    const title = pickStr(n?.title);
    const isCheck =
      sub === "check" ||
      /安否確認をお願い|安否確認通知/.test(title) ||
      String(n?.id || "").includes("anpi-check") ||
      String(n?.id || "").includes("platform-verify-anpi");
    if (!isCheck) return renderNotifyCardPrimaryCtaHtml(n);
    return (
      `<div class="talk-notify-card__cta-row talk-notify-card__cta-row--anpi">` +
      `<button type="button" class="talk-notify-card__action talk-notify-card__action--primary talk-notify-card__card-cta talk-notify-card__minimal-action" data-anpi-notify-inline-safe data-talk-notify-id="${escapeHtml(n.id)}">無事です</button>` +
      `<button type="button" class="talk-notify-card__action talk-notify-card__action--ghost talk-notify-card__minimal-action" data-talk-notify-action="navigate" data-talk-notify-href="${href}">詳細を確認</button>` +
      `</div>`
    );
  }

  function renderNotifyCardPrimaryCtaHtml(n, options) {
    if (isBuilderGeneralFlowApplicationPosterNotify(n)) {
      return renderBuilderApplicationPosterActionsHtml(n);
    }
    const opsWatch = options?.opsWatch === true;
    if (opsWatch) {
      return `<button type="button" class="talk-notify-card__action talk-notify-card__platform-action talk-notify-card__action--primary talk-notify-card__card-cta talk-notify-card__minimal-action" data-talk-notify-action="ops-detail" data-talk-notify-id="${escapeHtml(n.id)}">詳細を見る</button>`;
    }
    if (n.notifyOnly === true) {
      const label = escapeHtml(pickStr(n.actionLabel, "内容を確認"));
      return `<button type="button" class="talk-notify-card__action talk-notify-card__platform-action talk-notify-card__action--primary talk-notify-card__card-cta talk-notify-card__minimal-action" data-talk-notify-action="mark-read" data-talk-notify-id="${escapeHtml(n.id)}">${label}</button>`;
    }
    const nav = window.TasuTalkNotifyActions?.buildNotifyNavigateAction?.(n);
    if (nav?.href && nav.href !== "#") {
      const href = escapeHtml(nav.href);
      const label = escapeHtml(nav.label || n.actionLabel || "確認する");
      return `<button type="button" class="talk-notify-card__action talk-notify-card__platform-action talk-notify-card__action--primary talk-notify-card__card-cta talk-notify-card__minimal-action" data-talk-notify-action="navigate" data-talk-notify-href="${href}">${label}</button>`;
    }
    if (isPlatformChatReviewNotification(n)) {
      return "";
    }
    return `<button type="button" class="talk-notify-card__action talk-notify-card__action--primary talk-notify-card__card-cta" data-talk-notify-action="open-detail" data-talk-notify-id="${escapeHtml(n.id)}">詳細を見る</button>`;
  }

  function renderMinimalPlatformNotifyInlineActionHtml(n, tier) {
    if (tier === "normal") return "";
    if (tier === "important" && notifyTierApi().isAnpiNotification?.(n)) {
      return renderImportantAnpiCtaHtml(n);
    }
    return renderNotifyCardPrimaryCtaHtml(n);
  }

  function renderPlatformNotifyCardHtml(n, { actionsHtml, emphasis, unread, tier, latestMarketNotifyId }) {
    const notifyTier = tier || notifyTierApi().getNotifyTier?.(n) || "default";
    const marketAccentClass = window.TasfulMarketNotify?.resolveMarketNotifyAccentClass?.(n) || "";
    const marketBadgesHtml =
      window.TasfulMarketNotify?.renderMarketNotifyBadgesHtml?.(n, {
        isLatest: Boolean(latestMarketNotifyId && latestMarketNotifyId === n.id),
      }) || "";
    const tierClass =
      notifyTier === "important"
        ? " talk-notify-card--tier-important"
        : notifyTier === "normal"
          ? " talk-notify-card--tier-normal talk-notify-card--tap"
          : "";
    const tapAttrs =
      notifyTier === "normal"
        ? ` data-talk-notify-tier="normal" role="link" tabindex="0"`
        : notifyTier === "important"
          ? ` data-talk-notify-tier="important"`
          : "";
    const connectDeadline =
      notifyTier === "important" && notifyTierApi().isConnectNotification?.(n)
        ? notifyTierApi().connectNotifyDeadlineLabel?.(n)
        : "";
    const displayTitle =
      notifyTierApi().isConnectNotification?.(n) && notifyTierApi().formatConnectNotifyTitle
        ? notifyTierApi().formatConnectNotifyTitle(n.title)
        : n.title;
    const shopStorePurchase = isShopStorePurchaseNotifyRow(n);
    const shopStoreClass = shopStorePurchase ? " talk-notify-card--shop-store-purchase" : "";
    const shopStoreIsLatest = Boolean(latestMarketNotifyId && latestMarketNotifyId === n.id);
    const shopStoreHeadHtml = shopStorePurchase
      ? renderShopStorePurchaseHeadRowHtml({ isLatest: shopStoreIsLatest })
      : "";
    const shopStoreDetailsHtml = shopStorePurchase ? renderShopStorePurchaseNotifyBodyHtml(n) : "";
    if (isMinimalPlatformNotifyCard(n)) {
      const href = escapeHtml(
        window.TasuTalkNotifyActions?.resolveTalkMasterHref?.(n) ||
          window.TasuTalkNotifyActions?.resolvePlatformHref?.(n) ||
          n.href ||
          n.targetUrl ||
          "#"
      );
      const actionLabel = String(n.actionLabel || "確認する").trim() || "確認する";
      const jobDetailsHtml = shopStorePurchase ? "" : renderJobNotifyCardDetailsHtml(n);
      const jobDetailsClass = jobDetailsHtml ? " talk-notify-card--job-details" : "";
      const ariaParts = shopStorePurchase
        ? [resolveShopStorePurchaseNotifyAria(n, actionLabel)]
        : [pickStr(n.category, "求人"), pickStr(n.notifyListingTitle), displayTitle, pickStr(n.notifySupplementLine), actionLabel].filter(Boolean);
      const ariaLabel = ariaParts.join(" ");
      const notifyBodyHtml = (() => {
        if (shopStoreDetailsHtml) return "";
        if (!pickStr(n.body)) return "";
        if (window.TasfulMarketNotify?.isMarketOrderNotification?.(n)) {
          return window.TasfulMarketNotify.renderMarketNotifyBodyHtml(n.body);
        }
        return `<p class="talk-notify-card__text">${escapeHtml(n.body)}</p>`;
      })();
      const cardBodyHtml = shopStoreDetailsHtml
        ? shopStoreDetailsHtml
        : jobDetailsHtml
          ? jobDetailsHtml
          : `<p class="talk-notify-card__title">${escapeHtml(displayTitle)}</p>${
              connectDeadline
                ? `<p class="talk-notify-card__deadline">${escapeHtml(connectDeadline)}</p>`
                : ""
            }${notifyBodyHtml}`;
      return `
        <article class="talk-notify-card talk-notify-card--platform talk-notify-card--minimal-inline talk-notify-card--cta-inline talk-notify-card--cta-only talk-notify-card--compact talk-notify-card--${emphasis}${tierClass}${marketAccentClass}${jobDetailsClass}${shopStoreClass}${unread ? " talk-notify-card--unread" : ""}" data-talk-notify-id="${escapeHtml(n.id)}" aria-label="${escapeHtml(ariaLabel)}"${tapAttrs}>
          <div class="talk-notify-card__body talk-notify-card__body--platform talk-notify-card__body--minimal-inline">
            ${shopStorePurchase ? shopStoreHeadHtml : renderJobNotifyCategoryChipHtml(n)}
            ${shopStorePurchase ? "" : marketBadgesHtml}
            ${cardBodyHtml}
            ${renderMinimalPlatformNotifyInlineActionHtml(n, notifyTier)}
          </div>
        </article>`;
    }

    const builderMeta = builderNotifyScopeMeta(n);
    const contentType =
      window.TasuTalkNotifyContentType?.resolve?.(n, n.officialRoomId) ||
      { label: builderMeta?.scopeLabel || String(n.category || "通知"), tone: builderMeta?.tone || platformCategoryTone(String(n.category || "通知")) };
    const category = shopStorePurchase ? "店舗販売" : contentType.label;
    const tone = shopStorePurchase ? "gold" : contentType.tone;
    const time = escapeHtml(formatNotifyDisplayTime(n));
    const href = escapeHtml(
      window.TasuTalkNotifyActions?.resolveTalkMasterHref?.(n) ||
        window.TasuTalkNotifyActions?.resolvePlatformHref?.(n) ||
        n.href ||
        n.targetUrl ||
        "#"
    );
    const subTypeRaw = masterSubTypeLabel(n);
    const subTypeHtml = subTypeRaw
      ? `<span class="talk-notify-card__subtype">${escapeHtml(subTypeRaw)}</span>`
      : "";
    const projectHtml = builderMeta?.projectTitle
      ? `<p class="talk-notify-card__project">${escapeHtml(builderMeta.projectTitle)}</p>`
      : "";
    const tagsHtml = renderNotifyTagsHtml(n);
    const ariaLabel = shopStorePurchase
      ? resolveShopStorePurchaseNotifyAria(n, n.actionLabel)
      : builderMeta?.projectTitle
        ? `${builderMeta.scopeLabel} ${builderMeta.projectTitle} ${n.title}`
        : n.title;
    const platformBodyHtml = shopStorePurchase
      ? shopStoreDetailsHtml
      : `<p class="talk-notify-card__title">${escapeHtml(displayTitle)}</p>${
          connectDeadline ? `<p class="talk-notify-card__deadline">${escapeHtml(connectDeadline)}</p>` : ""
        }${
          isMinimalPlatformNotifyCard(n)
            ? ""
            : window.TasfulMarketNotify?.isMarketOrderNotification?.(n) && pickStr(n.body)
              ? window.TasfulMarketNotify.renderMarketNotifyBodyHtml(n.body)
              : pickStr(n.body)
                ? `<p class="talk-notify-card__text">${escapeHtml(n.body)}</p>`
                : ""
        }`;

    return `
        <article class="talk-notify-card talk-notify-card--platform talk-notify-card--cta-only talk-notify-card--compact talk-notify-card--${emphasis}${tierClass}${marketAccentClass}${shopStoreClass}${unread ? " talk-notify-card--unread" : ""}${builderMeta ? " talk-notify-card--builder-scope" : ""}" data-talk-notify-id="${escapeHtml(n.id)}" aria-label="${escapeHtml(ariaLabel)}"${tapAttrs}>
          <div class="talk-notify-card__compact">
            <header class="talk-notify-card__head talk-notify-card__head--platform${shopStorePurchase ? " talk-notify-card__head--shop-store" : ""}">
              ${
                shopStorePurchase
                  ? shopStoreHeadHtml
                  : `<span class="talk-notify-card__head-chips">
                <span class="talk-notify-card__category-chip talk-notify-card__type talk-notify-card__scope-chip ${toneClass(tone)}">${escapeHtml(category)}</span>
                ${subTypeHtml}
              </span>`
              }
              <span class="talk-notify-card__time">${shopStorePurchase ? "" : time}</span>
            </header>
            <div class="talk-notify-card__body talk-notify-card__body--platform">
              ${tagsHtml}
              ${projectHtml}
              ${platformBodyHtml}
              ${renderMinimalPlatformNotifyInlineActionHtml(n, notifyTier)}
            </div>
          </div>
          ${notifyTier === "normal" ? "" : actionsHtml}
        </article>`;
  }

  /**
   * @param {string} actionId
   * @param {string} notifyId
   * @param {{ fromDetail?: boolean }} [meta]
   */
  function runNotificationAction(actionId, notifyId, meta) {
    if (!actionId || !notifyId) return;

    const row =
      window.TasuTalkData?.findNotificationById?.(notifyId) ||
      window.TasuTalkNotifications?.findById?.(notifyId);
    if (!row) return;
    row.unread = window.TasuTalkNotifications?.isUnread?.(row) ?? !row.readAt;

    const result = window.TasuTalkNotifyActions?.executeNotificationAction?.(actionId, row) || {
      ok: false,
    };

    if (result.highlightBroadcastId) {
      pendingHighlightBroadcastId = String(result.highlightBroadcastId);
    }

    if (result.navigate) {
      window.TasuTalkNotifyDetail?.close?.();
      if (String(result.navigate).includes("tab=ai")) {
        setTab("ai", true);
        renderBroadcastDrafts();
        global.setTimeout(() => {
          const card = document.querySelector(
            `[data-talk-broadcast-id="${escapeHtml(pendingHighlightBroadcastId)}"]`
          );
          card?.classList.add("is-highlight");
          card?.scrollIntoView({ behavior: "smooth", block: "center" });
          pendingHighlightBroadcastId = "";
        }, 120);
        return;
      }
      if (result.navigate.startsWith("http") || result.navigate.includes(".html")) {
        navigateToAppPage(result.navigate, { notificationId: notifyId });
        return;
      }
    }

    if (actionId === "hide") {
      window.TasuTalkNotifyDetail?.close?.();
    } else if (meta?.fromDetail) {
      window.TasuTalkNotifyDetail?.open?.(notifyId);
    }

    refreshTalkSurfaces();
  }

  function handleNotificationActionClick(btn) {
    const actionId = btn.getAttribute("data-talk-notify-action");
    const notifyId = btn.getAttribute("data-talk-notify-id");
    if (!actionId || !notifyId) return;

    const confirmMsg = btn.getAttribute("data-talk-notify-action-confirm");
    if (confirmMsg && !global.confirm(confirmMsg)) return;

    if (handleBuilderGeneralFlowPosterNotifyAction(actionId, notifyId)) return;

    runNotificationAction(actionId, notifyId, { fromDetail: false });
  }

  function openNotificationDetailCard(id) {
    if (!id) return;
    const opened = window.TasuTalkNotifyDetail?.open?.(id);
    if (opened) {
      markNotifyReadBeforeNavigate(id);
    }
  }

  let lastNotifyNavigateAt = 0;

  function navigateFromNotifyActionEl(btn) {
    if (!btn) return false;
    const now = Date.now();
    if (now - lastNotifyNavigateAt < 450) return true;
    const actionId = btn.getAttribute("data-talk-notify-action");
    const notifyId = resolveNotifyActionElementId(btn);
    let anchorHref = pickStr(
      btn.getAttribute("data-talk-notify-href"),
      btn.tagName === "A" ? btn.getAttribute("href") : ""
    );

    if (actionId === "ops-detail") {
      if (notifyId) markNotifyReadBeforeNavigate(notifyId);
      if (notifyId && window.TasuTalkOpsWatchNotifyUi?.openDetailModal?.(notifyId)) {
        return true;
      }
      openNotificationDetailCard(notifyId);
      return true;
    }

    if (actionId === "open-detail") {
      openNotificationDetailCard(notifyId);
      return true;
    }

    if (actionId === "navigate") {
      if (!anchorHref || anchorHref === "#") {
        const row =
          window.TasuTalkData?.findNotificationById?.(notifyId) ||
          window.TasuTalkNotifications?.findById?.(notifyId);
        const nav = row ? window.TasuTalkNotifyActions?.buildNotifyNavigateAction?.(row) : null;
        anchorHref = pickStr(nav?.href, row?.href, row?.targetUrl);
      }
      if (anchorHref && anchorHref !== "#") {
        markNotifyReadBeforeNavigate(notifyId);
        btn.classList.add("is-acting");
        window.TasuPlatformChatInteractionTrace?.stampClick?.("notify_navigate", {
          notifyId,
          href: anchorHref,
        });
        lastNotifyNavigateAt = now;
        navigateToAppPage(anchorHref, { notificationId: notifyId });
        return true;
      }
    }

    handleNotificationActionClick(btn);
    return true;
  }

  function isBenchNotifyNavigateAction(btn) {
    return (
      document.body?.dataset?.benchEmbed === "1" &&
      btn?.getAttribute?.("data-talk-notify-action") === "navigate"
    );
  }

  function handleNotifyListPointerDown(e) {
    const btn = e.target.closest("[data-talk-notify-action]");
    if (!btn || !isBenchNotifyNavigateAction(btn)) return;
    e.preventDefault();
    e.stopPropagation();
    if (isTalkDebugLogging()) {
      console.log("[TasuTalkNotify] CTA pointerdown", {
        action: btn.getAttribute("data-talk-notify-action"),
        id: resolveNotifyActionElementId(btn),
        href: btn.getAttribute("data-talk-notify-href"),
      });
    }
    navigateFromNotifyActionEl(btn);
  }

  function handleNotifyListActionEvent(e) {
    const anpiBtn = e.target.closest("[data-anpi-notify-inline-safe]");
    if (anpiBtn) {
      e.preventDefault();
      e.stopPropagation();
      handleAnpiNotifyInlineSafe(anpiBtn.getAttribute("data-talk-notify-id"));
      return;
    }
    const btn = e.target.closest("[data-talk-notify-action]");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    if (isTalkDebugLogging()) {
      console.log("[TasuTalkNotify] CTA tap", {
        action: btn.getAttribute("data-talk-notify-action"),
        id: resolveNotifyActionElementId(btn),
      });
    }
    navigateFromNotifyActionEl(btn);
  }

  function handleAnpiNotifyInlineSafe(notifyId) {
    const id = pickStr(notifyId);
    if (!id) return;
    try {
      const api = window.TasuAnpiNotifyCards;
      const storageKey = api?.STORAGE_KEY || "tasful_anpi_notify_demo_v1";
      const load = api?.loadState;
      const save = api?.saveState;
      if (typeof load === "function" && typeof save === "function") {
        const state = load();
        if (state?.check) {
          state.check.response = "safe";
          state.check.respondedAt = new Date().toISOString();
          save(state);
        }
      } else {
        const raw = global.localStorage.getItem(storageKey);
        const state = raw ? JSON.parse(raw) : {};
        if (state?.check) {
          state.check.response = "safe";
          state.check.respondedAt = new Date().toISOString();
          global.localStorage.setItem(storageKey, JSON.stringify(state));
        }
      }
      global.dispatchEvent(new CustomEvent("tasu:anpi-notify-state-changed"));
    } catch {
      /* ignore */
    }
    window.TasuTalkData?.markNotificationRead?.(id);
    refreshTalkSurfaces({ notifyOnly: activeTab === "notify" });
  }

  function activateNormalNotifyCard(card) {
    if (!card || card.getAttribute("data-talk-notify-tier") !== "normal") return false;
    const notifyId = pickStr(card.getAttribute("data-talk-notify-id"));
    const row =
      window.TasuTalkNotifications?.findById?.(notifyId) ||
      window.TasuTalkData?.getNotifications?.({ filter: "all" })?.find?.((n) => n.id === notifyId);
    const href = resolveNotifyNavigateHref(row);
    if (!href || href === "#") return false;
    window.TasuPlatformChatInteractionTrace?.stampClick?.("notify_card_tap", { notifyId, href });
    markNotifyReadBeforeNavigate(notifyId);
    navigateToAppPage(href, { notificationId: notifyId });
    return true;
  }

  function blockNotifyCardBodyActivation(e) {
    if (e.target.closest("[data-talk-notify-action], [data-anpi-notify-inline-safe]")) return;
    const card = e.target.closest("article[data-talk-notify-id]");
    if (!card) return;
    if (card.getAttribute("data-talk-notify-tier") === "normal") {
      e.preventDefault();
      e.stopPropagation();
      activateNormalNotifyCard(card);
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (isTalkDebugLogging()) {
      console.log("[TasuTalkNotify] card body tap blocked", card.getAttribute("data-talk-notify-id"));
    }
  }

  function handleNotifyListCardKeydown(e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    const card = e.target.closest('article[data-talk-notify-tier="normal"]');
    if (!card) return;
    e.preventDefault();
    activateNormalNotifyCard(card);
  }

  function wireNotificationCardActions(host) {
    if (!host) return;
    if (host.dataset.talkNotifyActionsWired === "1") return;
    host.dataset.talkNotifyActionsWired = "1";
    host.addEventListener("click", blockNotifyCardBodyActivation, true);
    host.addEventListener("keydown", handleNotifyListCardKeydown);
    host.addEventListener("pointerdown", handleNotifyListPointerDown, true);
    host.addEventListener("click", handleNotifyListActionEvent);
  }

  function buildNotifyListRenderSignature(rows) {
    return (Array.isArray(rows) ? rows : [])
      .map((n) =>
        [
          pickStr(n.id),
          pickStr(n.readAt),
          pickStr(n.href, n.targetUrl),
          pickStr(n.actionLabel),
          pickStr(n.title),
        ].join("|")
      )
      .join(";");
  }

  function notifyListDomMatchesRows(host, rows) {
    if (!host || !Array.isArray(rows) || !rows.length) return false;
    if (host.querySelector(".talk-notify-empty-state__title, .talk-empty")) return false;
    const cards = host.querySelectorAll(".talk-notify-card");
    return cards.length > 0 && cards.length === rows.length;
  }

  function notifyListDomNeedsRender(host, rows) {
    if (!host || !Array.isArray(rows) || !rows.length) return false;
    return !notifyListDomMatchesRows(host, rows);
  }

  function resolveNotifyRecipientUserId(row) {
    return pickStr(
      row?.recipientUserId,
      row?.recipient_user_id,
      row?.toUserId,
      row?.to_user_id
    );
  }

  function resolveBenchExpectedUserIds() {
    const profile = window.TasuPlatformChatDualWindowDemo?.getProfile?.();
    const sides = profile ? window.TasuPlatformChatDualWindowDemo?.getSideMeta?.(profile) : null;
    return {
      expectedAUserId: pickStr(sides?.A?.userId),
      expectedBUserId: pickStr(sides?.B?.userId),
    };
  }

  function resolveBenchNotifySideUserId(ctx) {
    const params = new URLSearchParams(window.location.search);
    const urlUid = pickStr(params.get("userId"), ctx?.currentUserId);
    if (urlUid && urlUid !== "u_me") return urlUid;
    const { expectedAUserId, expectedBUserId } = resolveBenchExpectedUserIds();
    const role = pickStr(params.get("benchRole")).toLowerCase();
    const side = pickStr(params.get("benchSide"));
    if (role === "poster" || side === "A") return pickStr(expectedAUserId, urlUid);
    if (role === "applicant" || side === "B") return pickStr(expectedBUserId, urlUid);
    return pickStr(expectedAUserId, expectedBUserId, urlUid, String(getMeId() || "").trim());
  }

  function resolveBenchNotifyUserId() {
    const urlUid = String(new URLSearchParams(window.location.search).get("userId") || "").trim();
    if (urlUid) return urlUid;
    if (isBenchNotifyEmbedContext()) {
      const benchUid = resolveBenchNotifySideUserId({ currentUserId: "" });
      if (benchUid) return benchUid;
    }
    return String(getMeId() || "").trim();
  }

  function notificationRecipientMatchesCurrentUser(n, uid, ctx) {
    const effectiveUid = pickStr(uid, ctx?.currentUserId);
    const recipient = resolveNotifyRecipientUserId(n);
    if (recipient && effectiveUid) {
      if (recipient === effectiveUid) return true;
      if (isBenchNotifyEmbedContext()) {
        const { expectedAUserId, expectedBUserId } = resolveBenchExpectedUserIds();
        const benchUid = resolveBenchNotifySideUserId(ctx);
        if (benchUid && recipient === benchUid) return true;
        if (
          (recipient === expectedAUserId || recipient === expectedBUserId) &&
          benchUid &&
          recipient === benchUid
        ) {
          return true;
        }
      }
      return false;
    }
    const source = String(n?.source || "").toLowerCase();
    const role = String(n?.recipientRole || "").toLowerCase();
    if (source === "builder-mvp" && role && effectiveUid && !recipient) {
      if ((role === "owner" || role === "ops") && effectiveUid === "demo-owner-001") return true;
      if (role === "partner" && /^demo-partner-\d+$/i.test(effectiveUid)) return true;
      if (role === "user" && /^demo-(builder-user|user-peer-\d+)$/i.test(effectiveUid)) return true;
      if (role === "vendor" && /^demo-vendor-/i.test(effectiveUid)) return true;
    }
    const Review = window.TasuTalkChatDemoReviewMode;
    if (Review?.notificationMatchesDemoUser) {
      return Review.notificationMatchesDemoUser(n) === true;
    }
    if (!effectiveUid) return true;
    return false;
  }

  function storeNotificationMatchesRecipient(n, uid) {
    if (String(n?.sendNotification) === "false") return false;
    const effectiveUid = pickStr(uid, resolveBenchNotifyUserId());
    if (!effectiveUid) return false;
    return notificationRecipientMatchesCurrentUser(n, effectiveUid, {
      currentUserId: effectiveUid,
    });
  }

  const NOTIFY_FILTER_DROP_CODES = Object.freeze({
    RECIPIENT_MISMATCH: "notify_filter_recipient_mismatch",
    CATEGORY_MISMATCH: "notify_filter_category_mismatch",
    STAGE_MISMATCH: "notify_filter_stage_mismatch",
    STATUS_HIDDEN: "notify_filter_status_hidden",
    SCOPE_HIDDEN: "notify_filter_scope_hidden",
    PAINT_FAILED: "notify_paint_failed_after_filter",
  });

  const PLATFORM_NOTIFY_TITLE_PATTERN =
    /やり取り完了が承認|レビューされました|やりとりが完了|やりとりが開始|やりとりを開始|応募がありました|応募者とのやりとり|掲載者とのやりとり|取引完了|評価をお願い|新しいメッセージが届き|商品が発送されました|発送通知が届きました|発送されました/;

  function isExplicitRecipientPlatformNotification(row, userId, ctx) {
    const uid = pickStr(userId, ctx?.currentUserId, resolveBenchNotifySideUserId(ctx));
    if (!uid) return false;
    if (!notificationRecipientMatchesCurrentUser(row, uid, { ...ctx, currentUserId: uid })) {
      return false;
    }
    const type = pickStr(row?.type).toLowerCase();
    const source = pickStr(row?.source).toLowerCase();
    const category = pickStr(row?.category);
    const title = String(row?.title || "");
    if (type === "job" || source === "job" || category === "求人") return true;
    if (type === "builder" || source === "builder-mvp" || category === "Builder") return true;
    if (["completion", "review", "chat", "hired", "apply", "skill", "product", "business", "worker", "shop"].includes(type)) {
      return true;
    }
    if (
      source === "platform_chat_review_v1" ||
      source === "platform_chat_demo_message_v1" ||
      source === "platform_chat_demo_chat_started_v1" ||
      source === "platform_chat_demo_product_shipped_v1" ||
      /^platform[-_](chat|job)/i.test(source)
    ) {
      return true;
    }
    if (PLATFORM_NOTIFY_TITLE_PATTERN.test(title)) return true;
    if (
      pickStr(row?.threadId, row?.thread_id, row?.listingId, row?.listing_id) &&
      (source.startsWith("platform") || source === "job" || category === "求人")
    ) {
      return true;
    }
    return false;
  }

  /** @deprecated use isExplicitRecipientPlatformNotification */
  function isExplicitRecipientJobNotification(row, userId) {
    return isExplicitRecipientPlatformNotification(row, userId, {
      currentUserId: pickStr(userId, resolveBenchNotifyUserId()),
    });
  }

  function resolveNotifyFilterDropStage(decision) {
    if (!decision || decision.passed === true) return "";
    if (!decision.isRecipientMatch) return "recipient";
    if (decision.isHiddenByStatus === true) return "status";
    if (decision.isHiddenByScope === true) return "scope";
    if (decision.isCategoryMatch === false) return "category";
    if (decision.isStageMatch === false) return "stage";
    if (decision.filterDropNgCode === NOTIFY_FILTER_DROP_CODES.PAINT_FAILED) return "paint";
    return "filter";
  }

  function formatNotifyFilterDropReason(stage, detail) {
    const body = pickStr(detail);
    return body ? `stage:${stage} — ${body}` : `stage:${stage}`;
  }

  function buildStoreRecipientFilterDropSummary(storeForUid, perNotificationLogs, counts) {
    const storeIds = new Set(storeForUid.map((n) => String(n.id)));
    const relevant = (perNotificationLogs || []).filter((log) =>
      storeIds.has(String(log.notificationId))
    );
    const dropped = relevant.filter((log) => log.passed !== true);
    if (dropped.length) {
      const first = dropped[0];
      const stage = resolveNotifyFilterDropStage(first);
      return {
        filterDropReason: formatNotifyFilterDropReason(stage, first.filterDropReason),
        filterDropNgCode: pickStr(first.filterDropNgCode),
        filterDropStage: stage,
      };
    }
    if (storeForUid.length > 0 && (counts.finalRowsCount || 0) === 0) {
      return {
        filterDropReason: formatNotifyFilterDropReason(
          "paint",
          `store=${storeForUid.length} passedFilter=0 recipient=${counts.afterRecipientFilterCount} category=${counts.afterCategoryFilterCount} stage=${counts.afterStageFilterCount}`
        ),
        filterDropNgCode: NOTIFY_FILTER_DROP_CODES.PAINT_FAILED,
        filterDropStage: "paint",
      };
    }
    return { filterDropReason: "", filterDropNgCode: "", filterDropStage: "" };
  }

  function buildNotifyFilterItemLog(n, ctx, decision) {
    return {
      notificationId: pickStr(n?.id),
      notificationType: pickStr(n?.type),
      notificationTitle: pickStr(n?.title),
      notificationRecipientUserId: resolveNotifyRecipientUserId(n) || pickStr(n?.recipientUserId),
      notificationToUserId: pickStr(n?.toUserId, n?.to_user_id),
      notificationUserId: pickStr(n?.userId),
      currentUserId: ctx.currentUserId,
      expectedAUserId: ctx.expectedAUserId,
      expectedBUserId: ctx.expectedBUserId,
      isRecipientMatch: decision.isRecipientMatch === true,
      isCategoryMatch: decision.isCategoryMatch !== false,
      isStageMatch: decision.isStageMatch !== false,
      isHiddenByStatus: decision.isHiddenByStatus === true,
      isHiddenByRead: decision.isHiddenByRead === true,
      isHiddenByScope: decision.isHiddenByScope === true,
      filterDropReason: pickStr(decision.filterDropReason),
      filterDropNgCode: pickStr(decision.filterDropNgCode),
      filterDropStage: resolveNotifyFilterDropStage(decision),
      passed: decision.passed === true,
    };
  }

  function evaluateNotifyRecipientMatch(n, ctx) {
    const uid = pickStr(ctx.currentUserId, resolveBenchNotifySideUserId(ctx));
    const recipient = resolveNotifyRecipientUserId(n);
    const toUserId = pickStr(n?.toUserId, n?.to_user_id);
    const notificationUserId = pickStr(n?.userId);
    const Review = window.TasuTalkChatDemoReviewMode;
    const matchCtx = { ...ctx, currentUserId: uid };

    if (String(n?.sendNotification) === "false") {
      return {
        passed: false,
        isRecipientMatch: false,
        isCategoryMatch: true,
        isStageMatch: true,
        isHiddenByStatus: true,
        isHiddenByRead: false,
        isHiddenByScope: false,
        filterDropReason: "sendNotification=false",
        filterDropNgCode: NOTIFY_FILTER_DROP_CODES.STATUS_HIDDEN,
      };
    }

    if (n?.hiddenBySettings === true && !ctx.showMuted) {
      return {
        passed: false,
        isRecipientMatch: true,
        isCategoryMatch: true,
        isStageMatch: true,
        isHiddenByStatus: true,
        isHiddenByRead: false,
        isHiddenByScope: false,
        filterDropReason: "hiddenBySettings",
        filterDropNgCode: NOTIFY_FILTER_DROP_CODES.STATUS_HIDDEN,
      };
    }

    if (n?.hiddenByUser === true && !ctx.showMuted) {
      return {
        passed: false,
        isRecipientMatch: true,
        isCategoryMatch: true,
        isStageMatch: true,
        isHiddenByStatus: false,
        isHiddenByRead: false,
        isHiddenByScope: true,
        filterDropReason: "hiddenByUser",
        filterDropNgCode: NOTIFY_FILTER_DROP_CODES.SCOPE_HIDDEN,
      };
    }

    const isRecipientMatch = notificationRecipientMatchesCurrentUser(n, uid, matchCtx);

    if (!isRecipientMatch) {
      const { expectedAUserId, expectedBUserId } = resolveBenchExpectedUserIds();
      const actualParts = [
        `currentUserId=${uid || "—"}`,
        `benchSideUserId=${resolveBenchNotifySideUserId(matchCtx) || "—"}`,
        `expectedAUserId=${expectedAUserId || "—"}`,
        `expectedBUserId=${expectedBUserId || "—"}`,
      ];
      if (recipient) actualParts.push(`notification.recipientUserId=${recipient}`);
      if (toUserId) actualParts.push(`notification.toUserId=${toUserId}`);
      if (pickStr(n?.recipientRole)) actualParts.push(`notification.recipientRole=${pickStr(n?.recipientRole)}`);
      if (notificationUserId) actualParts.push(`notification.userId=${notificationUserId}`);
      return {
        passed: false,
        isRecipientMatch: false,
        isCategoryMatch: true,
        isStageMatch: true,
        isHiddenByStatus: false,
        isHiddenByRead: false,
        isHiddenByScope: false,
        filterDropReason: formatNotifyFilterDropReason(
          "recipient",
          `recipientUserId mismatch\n\nexpected:\ncurrentUserId=${uid || "—"}\n\nactual:\n${actualParts.join(" / ")}`
        ),
        filterDropNgCode: NOTIFY_FILTER_DROP_CODES.RECIPIENT_MISMATCH,
      };
    }

    if (isExplicitRecipientPlatformNotification(n, uid, matchCtx)) {
      return {
        passed: true,
        isRecipientMatch: true,
        isCategoryMatch: true,
        isStageMatch: true,
        isHiddenByStatus: false,
        isHiddenByRead: false,
        isHiddenByScope: false,
        filterDropReason: "",
        filterDropNgCode: "",
      };
    }

    if (
      isRecipientMatch &&
      (pickStr(n?.source) === "platform_chat_review_v1" ||
        /やり取り完了が承認|レビューされました/.test(String(n?.title || ""))) &&
      (pickStr(n?.threadId, n?.thread_id) || pickStr(n?.listingId, n?.listing_id))
    ) {
      return {
        passed: true,
        isRecipientMatch: true,
        isCategoryMatch: true,
        isStageMatch: true,
        isHiddenByStatus: false,
        isHiddenByRead: false,
        isHiddenByScope: false,
        filterDropReason: "",
        filterDropNgCode: "",
      };
    }

    const reviewDecision = Review?.evaluateChatDemoReviewNotificationFilter?.(n, matchCtx);
    if (reviewDecision && reviewDecision.passed === false) {
      return {
        passed: false,
        isRecipientMatch: true,
        isCategoryMatch: reviewDecision.isCategoryMatch !== false,
        isStageMatch: reviewDecision.isStageMatch !== false,
        isHiddenByStatus: false,
        isHiddenByRead: reviewDecision.isHiddenByRead === true,
        isHiddenByScope: reviewDecision.isHiddenByScope === true,
        filterDropReason: pickStr(reviewDecision.filterDropReason),
        filterDropNgCode: pickStr(reviewDecision.filterDropNgCode),
      };
    }

    return {
      passed: true,
      isRecipientMatch: true,
      isCategoryMatch: reviewDecision?.isCategoryMatch !== false,
      isStageMatch: reviewDecision?.isStageMatch !== false,
      isHiddenByStatus: false,
      isHiddenByRead: false,
      isHiddenByScope: reviewDecision?.isHiddenByScope === true,
      filterDropReason: "",
      filterDropNgCode: "",
    };
  }

  function publishBenchNotifyFilterDiag(diag) {
    try {
      window.__tasuBenchNotifyFilterDiag = diag;
      if (isBenchNotifyEmbedContext()) {
        console.log("[TasuTalk:bench-notify-filter]", diag);
      }
    } catch {
      /* ignore */
    }
  }

  function filterNotificationsByRecipient(list, userId, options) {
    const opts = options || {};
    const sourceList = Array.isArray(list) ? list : [];
    const uid = pickStr(userId, resolveBenchNotifyUserId(), resolveBenchNotifySideUserId({ currentUserId: "" }));
    if (!uid && !opts.forceUserId) return sourceList;

    const { expectedAUserId, expectedBUserId } = resolveBenchExpectedUserIds();
    const ctx = {
      currentUserId: isBenchNotifyEmbedContext() ? resolveBenchNotifySideUserId({ currentUserId: uid }) : uid,
      expectedAUserId,
      expectedBUserId,
      showMuted: opts.showMuted === true,
    };

    const beforeFilterCount = sourceList.length;
    let afterRecipientFilterCount = 0;
    let afterCategoryFilterCount = 0;
    let afterStageFilterCount = 0;
    const perNotificationLogs = [];
    const filtered = [];

    for (const n of sourceList) {
      const decision = evaluateNotifyRecipientMatch(n, ctx);
      const log = buildNotifyFilterItemLog(n, ctx, decision);
      perNotificationLogs.push(log);

      if (decision.isRecipientMatch) afterRecipientFilterCount += 1;
      if (decision.isRecipientMatch && decision.isCategoryMatch !== false) afterCategoryFilterCount += 1;
      if (
        decision.isRecipientMatch &&
        decision.isCategoryMatch !== false &&
        decision.isStageMatch !== false
      ) {
        afterStageFilterCount += 1;
      }
      if (decision.passed) filtered.push(n);
    }

    const finalRowsCount = filtered.length;
    const storeForUid = sourceList.filter((n) => storeNotificationMatchesRecipient(n, ctx.currentUserId));

    const dropSummary = buildStoreRecipientFilterDropSummary(storeForUid, perNotificationLogs, {
      finalRowsCount,
      afterRecipientFilterCount,
      afterCategoryFilterCount,
      afterStageFilterCount,
    });
    let filterDropReason = dropSummary.filterDropReason;
    let filterDropNgCode = dropSummary.filterDropNgCode;
    if (!filterDropReason && beforeFilterCount > 0 && finalRowsCount === 0) {
      const dropped = perNotificationLogs.find((log) => !log.passed);
      const stage = resolveNotifyFilterDropStage(dropped);
      filterDropReason = formatNotifyFilterDropReason(
        stage || "filter",
        pickStr(dropped?.filterDropReason, "unknown filter drop")
      );
      filterDropNgCode = pickStr(dropped?.filterDropNgCode);
    }

    const diag = {
      at: new Date().toISOString(),
      currentUserId: uid,
      expectedAUserId,
      expectedBUserId,
      beforeFilterCount,
      afterRecipientFilterCount,
      afterCategoryFilterCount,
      afterStageFilterCount,
      finalRowsCount,
      perNotificationLogs,
      filterDropReason,
      filterDropNgCode,
      filterDropStage: pickStr(dropSummary.filterDropStage),
    };

    if (opts.publishDiag !== false) publishBenchNotifyFilterDiag(diag);
    return filtered;
  }

  function benchNotifyStoreHasRecipientRows(userId) {
    const uid = pickStr(userId, resolveBenchNotifyUserId(), resolveBenchNotifySideUserId({ currentUserId: "" }));
    if (!uid) return false;
    return (window.TasuTalkNotifications?.getAll?.() || []).some((n) =>
      storeNotificationMatchesRecipient(n, uid)
    );
  }

  function resolveBenchNotifyRowsFromStore() {
    try {
      const uid = resolveBenchNotifyUserId();
      const all = window.TasuTalkNotifications?.getAll?.() || [];
      const filtered = filterNotificationsByRecipient(all, uid, { publishDiag: true });
      if (filtered.length) return filtered;
      if (!isBenchNotifyEmbedContext()) return filtered;
      const storeMatched = all.filter((n) => storeNotificationMatchesRecipient(n, uid));
      if (!storeMatched.length) return filtered;
      const Review = window.TasuTalkChatDemoReviewMode;
      if (Review?.filterChatDemoReviewNotifications) {
        const reviewed = Review.filterChatDemoReviewNotifications(storeMatched);
        if (reviewed.length) return reviewed;
      }
      const explicit = storeMatched.filter((n) => isExplicitRecipientPlatformNotification(n, uid, { currentUserId: uid }));
      return explicit.length ? explicit : storeMatched;
    } catch {
      return [];
    }
  }

  function benchNotifyStoreNeedsPaint() {
    if (!isBenchNotifyEmbedContext()) return false;
    const uid = resolveBenchNotifyUserId();
    return benchNotifyStoreHasRecipientRows(uid);
  }

  function renderSingleNotifyListCardHtml(n, ctx) {
    const { types, priorities, talkData, opsUi } = ctx;
    const tier = notifyTierApi().getNotifyTier?.(n) || "default";
    const contentType = window.TasuTalkNotifyContentType?.resolve?.(n, n.officialRoomId);
    const meta = contentType?.label
      ? { label: contentType.label, tone: contentType.tone || "default" }
      : types[n.type] || { label: n.type, tone: "slate" };
    const unread = Boolean(n.unread);
    const readLabel = unread ? "未読" : "既読";
    const readClass = unread ? "talk-notify-read--unread" : "talk-notify-read--read";
    const prio = priorities[n.priority] || priorities.normal || { label: "通常", className: "" };
    const muted = n.hiddenBySettings === true;
    const userHidden = n.hiddenByUser === true;
    const mutedBadge = muted
      ? `<span class="talk-notify-muted-badge">${escapeHtml(n.hiddenReason || "受信設定で非表示")}</span>`
      : userHidden
        ? `<span class="talk-notify-muted-badge">一覧非表示</span>`
        : "";
    const followBadge = followBadgeHtml(n);
    const actionsHtml = renderNotificationActionsHtml(n);
    const emphasis = escapeHtml(n.emphasis || talkData?.getNotificationEmphasis?.(n) || "normal");
    const typeKey = escapeHtml(String(n.type || "system").toLowerCase());
    const tierClass =
      tier === "important"
        ? " talk-notify-card--tier-important"
        : tier === "normal"
          ? " talk-notify-card--tier-normal talk-notify-card--tap"
          : "";
    const tapAttrs =
      tier === "normal"
        ? ` data-talk-notify-tier="normal" role="link" tabindex="0"`
        : tier === "important"
          ? ` data-talk-notify-tier="important"`
          : "";
    const displayTitle =
      notifyTierApi().isConnectNotification?.(n) && notifyTierApi().formatConnectNotifyTitle
        ? notifyTierApi().formatConnectNotifyTitle(n.title)
        : n.title;
    const connectDeadline =
      tier === "important" && notifyTierApi().isConnectNotification?.(n)
        ? notifyTierApi().connectNotifyDeadlineLabel?.(n)
        : "";

    if (opsUi?.isOpsWatchNotification?.(n)) {
      return opsUi.renderOpsWatchCardHtml(n, {
        escapeHtml,
        formatNotifyTime,
        unread,
        readLabel,
        readClass,
        actionsHtml,
      });
    }

    if (isNotifyNavigateCard(n)) {
      return renderPlatformNotifyCardHtml(n, {
        actionsHtml,
        emphasis,
        unread,
        tier,
        latestMarketNotifyId: ctx?.latestMarketNotifyId,
      });
    }

    const legacyCtaHtml =
      tier === "normal"
        ? ""
        : tier === "important" && notifyTierApi().isAnpiNotification?.(n)
          ? renderImportantAnpiCtaHtml(n)
          : renderNotifyCardPrimaryCtaHtml(n);
    return `
        <article class="talk-notify-card talk-notify-card--cta-only talk-notify-card--compact talk-notify-card--${emphasis}${tierClass}${unread ? " talk-notify-card--unread" : ""}${typeKey === "anpi" ? " talk-notify-card--anpi" : ""}${muted || userHidden ? " talk-notify-card--muted" : ""}${isFollowNotification(n) ? " talk-notify-card--follow" : ""}" data-talk-notify-id="${escapeHtml(n.id)}" aria-label="${escapeHtml(displayTitle)}"${tapAttrs}>
          <div class="talk-notify-card__compact">
            <header class="talk-notify-card__head talk-notify-card__head--compact">
              <span class="talk-notify-card__type ${toneClass(meta.tone)}">${escapeHtml(meta.label)}</span>
              ${followBadge}
              <span class="talk-notify-card__head-extra">
                <span class="talk-notify-read ${readClass}">${readLabel}</span>
                <span class="talk-notify-priority ${escapeHtml(prio.className || "")}">${escapeHtml(prio.label)}</span>
                ${mutedBadge}
              </span>
              <span class="talk-notify-card__time">${escapeHtml(formatNotifyTime(n.createdAt))}</span>
            </header>
            <div class="talk-notify-card__body">
              <p class="talk-notify-card__title">${escapeHtml(displayTitle)}</p>
              ${
                connectDeadline
                  ? `<p class="talk-notify-card__deadline">${escapeHtml(connectDeadline)}</p>`
                  : ""
              }
              <p class="talk-notify-card__text">${escapeHtml(n.body)}</p>
              <p class="talk-notify-card__meta talk-notify-card__meta--legacy">
                <time datetime="${escapeHtml(n.createdAt)}">${escapeHtml(formatNotifyTime(n.createdAt))}</time>
                ${n.source ? `<span class="talk-notify-card__source">${escapeHtml(n.source)}</span>` : ""}
              </p>
              ${legacyCtaHtml}
            </div>
          </div>
          ${tier === "normal" ? "" : actionsHtml}
        </article>`;
  }

  function renderNotifySectionHtml(title, rows, ctx, sectionClass) {
    if (!rows?.length) return "";
    const cards = rows.map((n) => renderSingleNotifyListCardHtml(n, ctx)).join("");
    return (
      `<section class="talk-notify-section ${sectionClass}" aria-label="${escapeHtml(title)}">` +
      `<header class="talk-notify-section__head">` +
      `<h3 class="talk-notify-section__title">${escapeHtml(title)}</h3>` +
      `</header>` +
      `<div class="talk-notify-section__list">${cards}</div>` +
      `</section>`
    );
  }

  function buildNotifyListInnerHtml(rows, ctx) {
    const tierApi = notifyTierApi();
    const latestMarketNotifyId = window.TasfulMarketNotify?.findLatestMarketNotifyId?.(rows) || "";
    const renderCtx = { ...ctx, latestMarketNotifyId };
    const partitioned = tierApi.partitionNotifyRows?.(rows) || {
      important: [],
      normal: [],
      other: rows || [],
    };
    const { important, normal, other } = partitioned;
    const hasTierSplit = important.length > 0 || normal.length > 0;
    if (!hasTierSplit) {
      return (rows || []).map((n) => renderSingleNotifyListCardHtml(n, renderCtx)).join("");
    }
    let html = "";
    if (important.length) {
      html += renderNotifySectionHtml("重要な通知", important, renderCtx, "talk-notify-section--important");
    }
    if (normal.length) {
      html += renderNotifySectionHtml("通常の通知", normal, renderCtx, "talk-notify-section--normal");
    }
    if (other.length) {
      html += renderNotifySectionHtml("その他", other, renderCtx, "talk-notify-section--other");
    }
    return html;
  }

  function publishBenchNotifyPaintDiag(paintDiag) {
    try {
      window.__tasuBenchNotifyPaintDiag = paintDiag;
      if (isBenchNotifyEmbedContext()) {
        console.log("[TasuTalk:bench-notify-paint]", paintDiag);
      }
    } catch {
      /* ignore */
    }
  }

  function paintNotifyListCards(host, rows, ctx) {
    if (isNotifyPointerOnAction()) return false;
    const inputRowsCount = Array.isArray(rows) ? rows.length : 0;
    const filterDiag = window.__tasuBenchNotifyFilterDiag || {};
    const resolvedRecipientUserId = resolveBenchNotifyUserId();
    const paintDiag = {
      at: new Date().toISOString(),
      inputRowsCount,
      finalRowsCount: 0,
      painted: false,
      resolvedRecipientUserId: resolvedRecipientUserId || "—",
      inputRecipientUserIds: (rows || [])
        .map((n) => resolveNotifyRecipientUserId(n) || pickStr(n?.recipientRole) || "—")
        .join(", "),
      filterDropReason: "",
      filterDropNgCode: "",
    };

    if (!host || !rows?.length) {
      const paintStage = !host ? "paint" : inputRowsCount > 0 ? "paint" : pickStr(filterDiag.filterDropStage, "filter");
      paintDiag.filterDropReason = !host
        ? formatNotifyFilterDropReason("paint", "host missing (#host)")
        : inputRowsCount > 0
          ? formatNotifyFilterDropReason("paint", "rows empty after filter passed")
          : pickStr(
              filterDiag.filterDropReason,
              formatNotifyFilterDropReason(paintStage, "no rows to paint")
            );
      paintDiag.filterDropNgCode = pickStr(
        filterDiag.filterDropNgCode,
        inputRowsCount > 0 ? NOTIFY_FILTER_DROP_CODES.PAINT_FAILED : ""
      );
      paintDiag.filterDropStage = paintStage;
      publishBenchNotifyPaintDiag(paintDiag);
      return false;
    }

    host.classList.remove("talk-notify-list--empty", "talk-notify-list--empty-pure", "talk-notify-list--scrollable");
    host.innerHTML = buildNotifyListInnerHtml(rows, ctx);
    host.dataset.notifyRenderSig = buildNotifyListRenderSignature(rows);
    const domCount = host.querySelectorAll(".talk-notify-card").length;
    paintDiag.finalRowsCount = domCount;
    paintDiag.painted = domCount > 0;
    paintDiag.recipientMatchedRowsCount = (rows || []).filter((n) =>
      storeNotificationMatchesRecipient(n, resolvedRecipientUserId)
    ).length;

    if (inputRowsCount > 0 && domCount === 0) {
      paintDiag.filterDropReason = formatNotifyFilterDropReason(
        "paint",
        `innerHtml produced 0 cards resolvedRecipientUserId=${resolvedRecipientUserId || "—"}`
      );
      paintDiag.filterDropNgCode = NOTIFY_FILTER_DROP_CODES.PAINT_FAILED;
      paintDiag.filterDropStage = "paint";
    }

    publishBenchNotifyPaintDiag(paintDiag);
    return paintDiag.painted;
  }

  function goToBroadcastHighlight(draftId) {
    pendingHighlightBroadcastId = String(draftId || "").trim();
    setTab("ai", true);
    renderBroadcastDrafts();
    global.setTimeout(() => {
      if (!pendingHighlightBroadcastId) return;
      const card = document.querySelector(
        `[data-talk-broadcast-id="${CSS.escape(pendingHighlightBroadcastId)}"]`
      );
      card?.classList.add("is-highlight");
      card?.scrollIntoView({ behavior: "smooth", block: "center" });
      pendingHighlightBroadcastId = "";
    }, 150);
  }

  function renderNotifyFilters() {
    renderNotifyFilterPanel();
  }

  function wireNotifyChangeListener() {
    if (window.__talkNotifyChangeBound) return;
    window.__talkNotifyChangeBound = true;
    /* 再描画は wireDashboard の refreshTalkSurfaces に集約 */
  }

  function syncSettingsFormDisabled() {
    const enabled = /** @type {HTMLInputElement|null} */ ($("[data-talk-settings-enabled]"))?.checked;
    const on = enabled !== false;
    document.querySelectorAll("[data-talk-settings-types-fieldset], [data-talk-settings-priorities-fieldset]").forEach((fs) => {
      fs.querySelectorAll("input").forEach((inp) => {
        inp.disabled = !on;
      });
    });
    const quietTimes = $("[data-talk-settings-quiet-times]");
    if (quietTimes) quietTimes.classList.toggle("is-disabled", !on);
  }

  function populateNotificationSettingsForm() {
    const store = window.TasuTalkNotificationSettings;
    if (!store) return;
    const s = store.read();

    const enabledEl = /** @type {HTMLInputElement|null} */ ($("[data-talk-settings-enabled]"));
    const showMutedEl = /** @type {HTMLInputElement|null} */ ($("[data-talk-settings-show-muted]"));
    if (enabledEl) enabledEl.checked = s.enabled !== false;
    if (showMutedEl) showMutedEl.checked = s.showMuted === true;

    const typesHost = $("[data-talk-settings-types]");
    if (typesHost) {
      typesHost.innerHTML = store.TYPE_KEYS.map(
        (key) => `
        <label class="talk-notify-settings-toggle">
          <input type="checkbox" data-talk-settings-type="${escapeHtml(key)}" ${s.types[key] !== false ? "checked" : ""} />
          <span>${escapeHtml(store.TYPE_LABELS[key] || key)}</span>
        </label>`
      ).join("");
    }

    const prioHost = $("[data-talk-settings-priorities]");
    if (prioHost) {
      prioHost.innerHTML = store.PRIORITY_KEYS.map(
        (key) => `
        <label class="talk-notify-settings-toggle">
          <input type="checkbox" data-talk-settings-priority="${escapeHtml(key)}" ${s.priorities[key] !== false ? "checked" : ""} />
          <span>${escapeHtml(store.PRIORITY_LABELS[key] || key)}</span>
        </label>`
      ).join("");
    }

    const quietOn = /** @type {HTMLInputElement|null} */ ($("[data-talk-settings-quiet-enabled]"));
    const quietStart = /** @type {HTMLInputElement|null} */ ($("[data-talk-settings-quiet-start]"));
    const quietEnd = /** @type {HTMLInputElement|null} */ ($("[data-talk-settings-quiet-end]"));
    if (quietOn) quietOn.checked = s.quietHours?.enabled === true;
    if (quietStart) quietStart.value = s.quietHours?.start || "22:00";
    if (quietEnd) quietEnd.value = s.quietHours?.end || "07:00";

    updateUrgentSettingsWarn();
    syncSettingsFormDisabled();
  }

  function updateUrgentSettingsWarn() {
    const urgentEl = /** @type {HTMLInputElement|null} */ (
      document.querySelector("[data-talk-settings-priority='urgent']")
    );
    const warn = $("[data-talk-settings-urgent-warn]");
    if (!warn || !urgentEl) return;
    warn.hidden = urgentEl.checked !== false;
  }

  function collectNotificationSettingsFromForm() {
    const store = window.TasuTalkNotificationSettings;
    const base = store?.read?.() || store?.defaultSettings?.() || {};
    const types = { ...base.types };
    const priorities = { ...base.priorities };

    document.querySelectorAll("[data-talk-settings-type]").forEach((inp) => {
      const key = inp.getAttribute("data-talk-settings-type");
      if (key) types[key] = /** @type {HTMLInputElement} */ (inp).checked;
    });
    document.querySelectorAll("[data-talk-settings-priority]").forEach((inp) => {
      const key = inp.getAttribute("data-talk-settings-priority");
      if (key) priorities[key] = /** @type {HTMLInputElement} */ (inp).checked;
    });

    return {
      ...base,
      enabled: /** @type {HTMLInputElement|null} */ ($("[data-talk-settings-enabled]"))?.checked !== false,
      showMuted: /** @type {HTMLInputElement|null} */ ($("[data-talk-settings-show-muted]"))?.checked === true,
      types,
      priorities,
      quietHours: {
        enabled: /** @type {HTMLInputElement|null} */ ($("[data-talk-settings-quiet-enabled]"))?.checked === true,
        start: /** @type {HTMLInputElement|null} */ ($("[data-talk-settings-quiet-start]"))?.value || "22:00",
        end: /** @type {HTMLInputElement|null} */ ($("[data-talk-settings-quiet-end]"))?.value || "07:00",
      },
    };
  }

  function openNotificationSettingsModal() {
    populateNotificationSettingsForm();
    const modal = $("[data-talk-notify-settings-modal]");
    if (!modal) return;
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
  }

  function closeNotificationSettingsModal() {
    const modal = $("[data-talk-notify-settings-modal]");
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
  }

  function saveNotificationSettingsFromForm() {
    try {
      const payload = collectNotificationSettingsFromForm();
      window.TasuTalkData?.saveNotificationSettings?.(payload);
      closeNotificationSettingsModal();
      renderNotifications();
    } catch (err) {
      console.warn("[talk-home] save notification settings failed:", err);
    }
  }

  function resetNotificationSettingsFromForm() {
    try {
      window.TasuTalkData?.resetNotificationSettings?.();
      populateNotificationSettingsForm();
      renderNotifications();
    } catch (err) {
      console.warn("[talk-home] reset notification settings failed:", err);
    }
  }

  function wireNotificationSettings() {
    $("[data-talk-notify-settings-open]")?.addEventListener("click", () => openNotificationSettingsModal());

    document.querySelectorAll("[data-talk-notify-settings-close]").forEach((el) => {
      el.addEventListener("click", () => closeNotificationSettingsModal());
    });

    $("[data-talk-notify-settings-form]")?.addEventListener("submit", (e) => {
      e.preventDefault();
      saveNotificationSettingsFromForm();
    });

    $("[data-talk-settings-reset]")?.addEventListener("click", () => resetNotificationSettingsFromForm());

    $("[data-talk-settings-enabled]")?.addEventListener("change", () => syncSettingsFormDisabled());

    document.addEventListener("change", (e) => {
      const t = /** @type {HTMLElement} */ (e.target);
      if (t?.matches?.("[data-talk-settings-priority='urgent']")) {
        updateUrgentSettingsWarn();
      }
    });
  }

  function getNotifyListOptions() {
    return getNotifyFilterOptions();
  }

  function filterNotificationsBySearch(rows) {
    const q = String(notifySearchQuery || "").trim().toLowerCase();
    if (!q) return rows;
    return (rows || []).filter((n) => {
      const hay = `${n.title || ""} ${n.body || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }

  function renderNotifications() {
    try {
      global.TasuPlatformChatConnectChatFlow?.reconcilePendingConnectRequirementNotifications?.();
    } catch {
      /* ignore */
    }
    const host = $("[data-talk-notify-list]");
    const summary = $("[data-talk-notify-summary]");
    if (!host) return;

    const renderSeq = ++benchNotifyRenderSeq;
    const isStaleNotifyRender = () => renderSeq !== benchNotifyRenderSeq;

    const types = window.TasuTalkData?.NOTIFICATION_TYPES || {};
    const priorities = window.TasuTalkData?.PRIORITY_META || {};
    const talkData = window.TasuTalkData;
    const listOpts = getNotifyListOptions();
    const filterActive =
      isNotifyFilterActive() || String(notifySearchQuery || "").trim().length > 0;
    const allOpts = {
      filter: "all",
      applySettings: listOpts.applySettings,
      showMuted: listOpts.showMuted,
    };
    const visibleAll = talkData?.getNotifications?.(allOpts) || [];
    let rows;
    if (isBenchNotifyEmbedContext() && !filterActive) {
      rows = resolveBenchNotifyRowsFromStore();
      if (!rows.length) {
        rows = filterNotificationsBySearch(visibleAll);
        rows = applyBenchNotifyRowFallbacks(listOpts, filterActive, talkData, rows);
      }
    } else {
      rows = filterNotificationsBySearch(
        filterActive ? talkData?.getNotifications?.(listOpts) || [] : visibleAll
      );
      rows = applyBenchNotifyRowFallbacks(listOpts, filterActive, talkData, rows);
    }
    if (isTalkDebugLogging()) logNotifyListRenderAudit(listOpts, rows);
    const unreadTotal = visibleAll.filter((n) => n.unread).length;
    const hiddenCount = talkData?.countHiddenBySettings?.() ?? 0;
    const userHiddenCount = talkData?.countUserHiddenNotifications?.() ?? 0;

    if (summary) {
      const quickParts = [];
      if (notifyFilterUnread) quickParts.push("未読");
      if (notifyFilterFollow) quickParts.push("フォロー");
      if (notifyFilterUrgent) quickParts.push("緊急");
      if (notifyFilterImportant) quickParts.push("重要");
      if (notifyFilterAnpi) quickParts.push("安否");
      if (
        notifyFilterTypes.has("ops_watch") ||
        notifyFilterAdminSpecial.has("ops_watch") ||
        notifyFilterAdminSpecial.has("daily_info")
      ) {
        quickParts.push("OPS WATCH");
      }
      if (notifyFilterTypes.size) {
        const chipLabels = getNotifyCategoryChipDefs()
          .filter((chip) => isNotifyCategoryChipActive(chip))
          .map((chip) => chip.label);
        quickParts.push(chipLabels.length ? chipLabels.join("・") : `カテゴリ${notifyFilterTypes.size}`);
      }
      if (notifyFilterPeriod && notifyFilterPeriod !== "all") {
        const periodLabel =
          (window.TasuTalkData?.NOTIFY_PERIOD_FILTERS || []).find((p) => p.id === notifyFilterPeriod)
            ?.label || notifyFilterPeriod;
        quickParts.push(periodLabel);
      }
      if (notifyFilterAdminSpecial.has("ops_contact")) quickParts.push("運営連絡");
      if (notifyFilterAdminSpecial.has("anpi")) quickParts.push("安否");
      if (notifyFilterAdminSpecial.has("report")) quickParts.push("通報");
      if (String(notifySearchQuery || "").trim()) quickParts.push("検索");
      let text = `表示 ${rows.length} 件（全 ${visibleAll.length} 件中・未読 ${unreadTotal}）`;
      if (window.TasuTalkWorkerReviewMode?.isWorkerReviewMode?.()) {
        text = `ワーカーレビュー: ${rows.length} 件（依頼が届きました / 依頼を受諾しました / 取引が完了しました）`;
      } else if (window.TasuTalkJobFullReviewMode?.isJobFullReviewMode?.()) {
        const profile = window.TasuPlatformChatDualWindowDemo?.getProfile?.();
        const uid = new URLSearchParams(location.search).get("userId") || "";
        const side = uid ? window.TasuPlatformChatDualWindowDemo?.resolveSideForUserId?.(profile, uid) : null;
        const role = side ? `${side.role}` : "";
        text = `2窓通知デモ: ${rows.length} 件 — ${profile?.label || "求人"}${role ? ` / ${role}` : ""}`;
      } else if (window.TasuTalkJobReviewMode?.isJobReviewMode?.()) {
        text = `求人レビュー: ${rows.length} 件（この求人に応募がありました / やりとり開始）`;
      } else if (quickParts.length) text += ` · 絞り込み: ${quickParts.join("・")}`;
      if (hiddenCount > 0 || userHiddenCount > 0) {
        const parts = [];
        if (hiddenCount > 0) {
          parts.push(
            listOpts.showMuted
              ? `受信設定で非表示 ${hiddenCount} 件を含む`
              : `受信設定で非表示 ${hiddenCount} 件`
          );
        }
        if (userHiddenCount > 0) {
          parts.push(
            listOpts.showMuted
              ? `一覧非表示 ${userHiddenCount} 件を含む`
              : `一覧非表示 ${userHiddenCount} 件`
          );
        }
        text += ` · ${parts.join(" · ")}`;
      }
      summary.textContent = text;
    }

    const renderCtx = {
      types,
      priorities,
      talkData,
      opsUi: window.TasuTalkOpsWatchNotifyUi,
    };

    rows = applyBenchNotifyRowFallbacks(listOpts, filterActive, talkData, rows);

    if (!rows.length) {
      if (isBenchNotifyCompactLayout()) {
        const uid = resolveBenchNotifyUserId();
        if (benchNotifyStoreHasRecipientRows(uid)) {
          const retried = resolveBenchNotifyRowsFromStore();
          if (retried.length) {
            rows = retried;
          } else {
            scheduleBenchNotifyDomReconcile(host, listOpts, visibleAll);
            traceBenchNotifyRenderDiagnostics(listOpts, visibleAll, []);
            requestAnimationFrame(() => {
              syncNotifyListLayoutVars();
              syncBenchNotifyEmbedHeightFromContext();
            });
            return;
          }
        }
      }
    }

    if (!rows.length) {
      if (isStaleNotifyRender() && !benchNotifyStoreNeedsPaint()) return;
      host.classList.add("talk-notify-list--empty");
      const benchNotifyOnly = isBenchNotifyCompactLayout();
      const isPureEmpty = visibleAll.length === 0 && !isNotifyFilterActive();
      host.classList.toggle("talk-notify-list--empty-pure", isPureEmpty || benchNotifyOnly);
      const emptySig = `empty:${benchNotifyOnly ? "bench" : isPureEmpty ? "pure" : "filtered"}`;
      const domHasCards = host.querySelectorAll(".talk-notify-card").length > 0;
      if (host.dataset.notifyRenderSig !== emptySig || domHasCards) {
        host.dataset.notifyRenderSig = emptySig;
        if (benchNotifyOnly) {
          host.innerHTML =
            `<div class="talk-notify-empty-state talk-notify-empty-state--bench" role="status">` +
            `<p class="talk-notify-empty-state__title">該当する通知はありません</p>` +
            `</div>`;
        } else if (isPureEmpty) {
          host.innerHTML =
            `<div class="talk-notify-empty-state" role="status">` +
            `<p class="talk-notify-empty-state__title">通知はありません</p>` +
            `</div>`;
        } else {
          const hint = notifyFilterFollow
            ? "フォロー・お気に入り連動の通知はまだありません。詳細ページでお気に入り登録すると更新通知が届きます。"
            : hiddenCount > 0 && !listOpts.showMuted
              ? "受信設定により非表示の通知があります。「通知設定」で「非表示通知も見る」をONにできます。"
              : "該当する通知はありません";
          host.innerHTML = `<p class="talk-empty">${escapeHtml(hint)}</p>`;
        }
      }
      wireNotificationCardActions(host);
      traceBenchNotifyRenderDiagnostics(listOpts, visibleAll, rows);
      requestAnimationFrame(() => {
        syncNotifyListLayoutVars();
        global.setTimeout(syncNotifyListLayoutVars, 120);
      });
      return;
    }

    const benchForcePaint = isBenchNotifyEmbedContext() && !filterActive && rows.length > 0;
    if (benchForcePaint) {
      forceBenchNotifyListPaint(host, rows, renderCtx);
    } else {
      if (isStaleNotifyRender() && !benchNotifyStoreNeedsPaint()) return;
      const renderSig = buildNotifyListRenderSignature(rows);
      const canSkipRender =
        host.dataset.notifyRenderSig === renderSig && notifyListDomMatchesRows(host, rows);
      const benchDomMismatch =
        isBenchNotifyEmbedContext() && rows.length > 0 && !notifyListDomMatchesRows(host, rows);
      if (!canSkipRender || notifyListDomNeedsRender(host, rows) || benchDomMismatch) {
        if (notifyListDomNeedsRender(host, rows) || benchDomMismatch) {
          host.dataset.notifyRenderSig = "";
        }
        paintNotifyListCards(host, rows, renderCtx);
      }
      ensureBenchNotifyDomPainted(host, rows, renderCtx);
    }

    wireNotificationCardActions(host);
    traceBenchNotifyRenderDiagnostics(listOpts, visibleAll, rows);
    scheduleBenchNotifyDomReconcile(host, listOpts, visibleAll);
    requestAnimationFrame(() => {
      syncNotifyListLayoutVars();
      syncBenchNotifyEmbedHeightFromContext();
      if (benchForcePaint || !isStaleNotifyRender()) {
        forceBenchNotifyListPaint(host, rows, renderCtx);
        ensureBenchNotifyDomPainted(host, rows, renderCtx);
        traceBenchNotifyRenderDiagnostics(listOpts, visibleAll, rows);
      }
      global.setTimeout(() => {
        syncNotifyListLayoutVars();
        syncBenchNotifyEmbedHeightFromContext();
        if (isBenchNotifyEmbedContext() && !filterActive) {
          const freshRows = resolveBenchNotifyRowsFromStore();
          if (freshRows.length) {
            forceBenchNotifyListPaint(host, freshRows, renderCtx);
            traceBenchNotifyRenderDiagnostics(listOpts, visibleAll, freshRows);
          }
        } else if (!isStaleNotifyRender()) {
          ensureBenchNotifyDomPainted(host, rows, renderCtx);
          traceBenchNotifyRenderDiagnostics(listOpts, visibleAll, rows);
        }
      }, 120);
    });
  }

  function normalizeAiMode(mode) {
    return (
      window.TasuTalkAi?.normalizeMode?.(mode) ||
      window.TasuTalkAiDrafts?.normalizeMode?.(mode) ||
      String(mode || "qa")
    );
  }

  function setAiStatus(message, tone) {
    const el = $("[data-talk-ai-status]");
    if (!el) return;
    el.textContent = String(message || "");
    el.classList.remove("is-ok", "is-error");
    if (tone === "ok") el.classList.add("is-ok");
    if (tone === "error") el.classList.add("is-error");
  }

  function canApplyAiToForm(mode) {
    return (
      window.TasuTalkAiDrafts?.canApplyToPostForm?.(mode) === true ||
      window.TasuTalkAiDraftApply?.canApplyToPostForm?.(mode) === true
    );
  }

  function canSaveBroadcastDraft(mode) {
    return window.TasuTalkBroadcastDrafts?.canSaveFromAiMode?.(mode) === true;
  }

  function syncAiResultActions() {
    const notifyBtn = $("[data-talk-ai-to-notify]");
    const applyBtn = $("[data-talk-ai-apply-form]");
    const broadcastBtn = $("[data-talk-ai-save-broadcast]");
    const isSearch = aiSession.isSearchResult === true;
    const canNotify =
      !isSearch && window.TasuTalkAiDrafts?.canPushAsNotification?.(activeAiMode) === true;
    const canApply = !isSearch && canApplyAiToForm(activeAiMode);
    const canBroadcast = !isSearch && canSaveBroadcastDraft(activeAiMode);
    const saveBtn = $("[data-talk-ai-save]");
    if (saveBtn) saveBtn.hidden = isSearch;
    if (notifyBtn) notifyBtn.hidden = !canNotify || !aiSession.output;
    if (applyBtn) applyBtn.hidden = !canApply || !aiSession.output;
    if (broadcastBtn) broadcastBtn.hidden = !canBroadcast || !aiSession.output;
  }

  function defaultBroadcastTitle() {
    const kind = normalizeAiMode(activeAiMode);
    const text = String(aiSession.output || "");
    const lines = text
      .split("\n")
      .map((l) => l.replace(/^【[^】]+】\s*/, "").trim())
      .filter(Boolean);
    const first = lines[0] || "";
    if (first) return first.slice(0, 80);
    return kind === "ad" ? "広告配信のお知らせ" : "運営からのお知らせ";
  }

  function updateBroadcastSegmentHint() {
    const sel = /** @type {HTMLSelectElement|null} */ ($("[data-talk-broadcast-segment]"));
    const hint = $("[data-talk-broadcast-segment-hint]");
    if (!sel || !hint) return;
    const seg = window.TasuTalkBroadcastDrafts?.segmentById?.(sel.value);
    hint.textContent = seg
      ? `配信予定（モック）: ${seg.label} — ${seg.count.toLocaleString("ja-JP")} 名`
      : "—";
  }

  function populateBroadcastSegmentSelect() {
    const sel = /** @type {HTMLSelectElement|null} */ ($("[data-talk-broadcast-segment]"));
    if (!sel) return;
    const segments = window.TasuTalkBroadcastDrafts?.TARGET_SEGMENTS || [];
    sel.innerHTML = segments
      .map(
        (s) =>
          `<option value="${escapeHtml(s.id)}">${escapeHtml(s.label)}（${s.count.toLocaleString("ja-JP")}）</option>`
      )
      .join("");
    updateBroadcastSegmentHint();
  }

  function openBroadcastModal() {
    if (!aiSession.output) {
      setAiStatus("先に下書きを生成してください", "error");
      return;
    }
    const modal = $("[data-talk-broadcast-modal]");
    if (!modal) return;
    populateBroadcastSegmentSelect();
    const titleInput = /** @type {HTMLInputElement|null} */ ($("[data-talk-broadcast-title]"));
    if (titleInput) titleInput.value = defaultBroadcastTitle();
    const prioSel = /** @type {HTMLSelectElement|null} */ ($("[data-talk-broadcast-priority]"));
    if (prioSel) prioSel.value = activeAiMode === "notice" ? "important" : "normal";
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    titleInput?.focus();
  }

  function closeBroadcastModal() {
    const modal = $("[data-talk-broadcast-modal]");
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
  }

  function closeBroadcastView() {
    const view = $("[data-talk-broadcast-view]");
    if (!view) return;
    view.hidden = true;
    view.setAttribute("aria-hidden", "true");
  }

  function formatBroadcastSentTime(row) {
    const iso = row?.sentAt || (row?.status === "sent" ? row?.updatedAt : "");
    return iso ? formatDraftTime(iso) : "";
  }

  function showBroadcastSendBanner(message) {
    const errEl = $("[data-talk-broadcast-error-banner]");
    if (errEl) errEl.hidden = true;
    const el = $("[data-talk-broadcast-banner]");
    if (!el) return;
    el.textContent = String(message || "配信下書きを送信しました");
    el.hidden = false;
    if (broadcastBannerTimer) clearTimeout(broadcastBannerTimer);
    broadcastBannerTimer = setTimeout(() => {
      el.hidden = true;
      broadcastBannerTimer = null;
    }, 6000);
  }

  function showBroadcastErrorBanner(message) {
    const okEl = $("[data-talk-broadcast-banner]");
    if (okEl) okEl.hidden = true;
    const el = $("[data-talk-broadcast-error-banner]");
    if (!el) return;
    el.textContent = String(message || "配信の送信に失敗しました");
    el.hidden = false;
    if (broadcastBannerTimer) clearTimeout(broadcastBannerTimer);
    broadcastBannerTimer = setTimeout(() => {
      el.hidden = true;
      broadcastBannerTimer = null;
    }, 8000);
  }

  function closeBroadcastSendConfirm() {
    pendingBroadcastSendId = null;
    const modal = $("[data-talk-broadcast-send-modal]");
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
  }

  async function countBroadcastRecipients(segmentId) {
    try {
      const list = await window.TasuTalkBroadcastAudience?.resolveRecipients?.(segmentId);
      return Array.isArray(list) ? list.length : 0;
    } catch {
      return 0;
    }
  }

  function openBroadcastSendConfirm(row) {
    const store = window.TasuTalkBroadcastDrafts;
    if (!row?.id || !store?.canBroadcastSend?.(row)) {
      setAiStatus("この配信下書きは送信できません", "error");
      return;
    }

    const modal = $("[data-talk-broadcast-send-modal]");
    const metaEl = $("[data-talk-broadcast-send-meta]");
    if (!modal || !metaEl) return;

    pendingBroadcastSendId = row.id;
    const kindLabel = store?.KIND_LABELS?.[row.kind] || row.kind;
    const priorityLabel = store?.PRIORITY_LABELS?.[row.priority] || row.priority;
    const segmentLabel = store?.segmentLabel?.(row.targetSegment) || row.targetSegment;

    metaEl.innerHTML = `
      <dt>タイトル</dt><dd>${escapeHtml(row.title)}</dd>
      <dt>種別</dt><dd>${escapeHtml(kindLabel)}</dd>
      <dt>配信対象</dt><dd data-talk-send-meta-segment>${escapeHtml(segmentLabel)}（読み込み中…）</dd>
      <dt>重要度</dt><dd>${escapeHtml(priorityLabel)}</dd>`;

    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");

    void countBroadcastRecipients(row.targetSegment).then((count) => {
      if (pendingBroadcastSendId !== row.id) return;
      const targetDd = metaEl.querySelector("[data-talk-send-meta-segment]");
      if (targetDd) targetDd.textContent = `${segmentLabel}（${count} 名）`;
    });
  }

  async function runBroadcastSendConfirm() {
    const id = pendingBroadcastSendId;
    if (!id) return;

    const confirmBtn = $("[data-talk-broadcast-send-confirm]");
    if (confirmBtn) {
      confirmBtn.setAttribute("disabled", "true");
      confirmBtn.textContent = "送信中…";
    }

    let result = { ok: false, reason: "unknown" };
    try {
      result = (await window.TasuTalkData?.sendBroadcastDraft?.(id)) || result;
    } catch (err) {
      console.warn("[talk-home] broadcast send failed:", err);
      result = { ok: false, reason: String(err) };
    }

    if (confirmBtn) {
      confirmBtn.removeAttribute("disabled");
      confirmBtn.textContent = "送信する";
    }

    closeBroadcastSendConfirm();
    closeBroadcastView();

    if (!result?.ok) {
      const reason = result?.reason || "unknown";
      if (reason === "invalid_status") {
        showBroadcastErrorBanner("すでに送信済み、または送信できない状態です");
        setAiStatus("送信できない状態です", "error");
      } else if (reason === "offline") {
        showBroadcastErrorBanner("オフラインのため送信をキューに保存しました。オンライン復帰後に再試行されます。");
        setAiStatus("オフライン — 送信はキューに保存されました", "error");
      } else if (reason === "db_error") {
        showBroadcastErrorBanner(`データベースエラーのため送信を中止しました。${result.message || ""}`);
        setAiStatus("送信を中止しました（DBエラー）", "error");
      } else if (reason === "production_edge_required") {
        const msg =
          result.message ||
          "本番配信は未設定です。管理者用 Edge Function のデプロイ後に再度お試しください。";
        showBroadcastErrorBanner(msg);
        setAiStatus("本番配信は未設定", "error");
      } else if (reason === "production_fanout_forbidden") {
        showBroadcastErrorBanner(result.message || "本番ではクライアントから一斉配信できません。");
        setAiStatus("本番一斉配信は不可", "error");
      } else {
        showBroadcastErrorBanner("配信の送信に失敗しました。下書きは下書き状態に戻しています。");
        setAiStatus("配信の送信に失敗しました", "error");
      }
      console.warn("[talk-home] broadcast send failed:", result);
      refreshTalkSurfaces();
      return;
    }

    refreshTalkSurfaces();
    const count = result.delivered ?? result.recipients?.length ?? 0;
    showBroadcastSendBanner(`配信下書きを送信しました（${count} 件）`);
    setAiStatus(`配信を送信しました（${count} 名）`, "ok");
    if (activeTab === "notify") renderNotifications();
  }

  function openBroadcastView(row) {
    const view = $("[data-talk-broadcast-view]");
    const bodyEl = $("[data-talk-broadcast-view-body]");
    const metaEl = $("[data-talk-broadcast-view-meta]");
    const sendBtn = $("[data-talk-broadcast-view-send]");
    if (!view || !bodyEl || !metaEl || !row) return;

    const store = window.TasuTalkBroadcastDrafts;
    const kindLabel = store?.KIND_LABELS?.[row.kind] || row.kind;
    const statusLabel = store?.STATUS_LABELS?.[row.status] || row.status;
    const priorityLabel = store?.PRIORITY_LABELS?.[row.priority] || row.priority;
    const segmentLabel = store?.segmentLabel?.(row.targetSegment) || row.targetSegment;
    const sentLabel = formatBroadcastSentTime(row);
    const lastLog = Array.isArray(row.sendHistory) ? row.sendHistory[row.sendHistory.length - 1] : null;
    const historyHtml = lastLog
      ? `<dt>直近の配信</dt><dd>${escapeHtml(formatDraftTime(lastLog.sentAt))} · ${escapeHtml(String(lastLog.deliveredCount))}/${escapeHtml(String(lastLog.recipientCount))} 名（${escapeHtml(lastLog.deliveryMode || "")}）</dd>`
      : "";

    bodyEl.textContent = row.body || "（本文なし）";
    metaEl.innerHTML = `
      <dt>種別</dt><dd>${escapeHtml(kindLabel)}</dd>
      <dt>タイトル</dt><dd>${escapeHtml(row.title)}</dd>
      <dt>配信対象</dt><dd>${escapeHtml(segmentLabel)}（${escapeHtml(String(row.targetCount))} 名）</dd>
      <dt>重要度</dt><dd>${escapeHtml(priorityLabel)}</dd>
      <dt>ステータス</dt><dd>${escapeHtml(statusLabel)}</dd>
      <dt>作成</dt><dd>${escapeHtml(formatDraftTime(row.createdAt))}</dd>
      ${sentLabel ? `<dt>送信済み</dt><dd>${escapeHtml(sentLabel)}</dd>` : ""}
      ${historyHtml}`;

    if (sendBtn) {
      const canSend = store?.canBroadcastSend?.(row) === true;
      sendBtn.hidden = !canSend;
      sendBtn.onclick = () => openBroadcastSendConfirm(row);
    }

    view.hidden = false;
    view.setAttribute("aria-hidden", "false");
  }

  function saveBroadcastDraftFromModal() {
    const title = String($("[data-talk-broadcast-title]")?.value || "").trim();
    const segment = String($("[data-talk-broadcast-segment]")?.value || "all").trim();
    const priority = String($("[data-talk-broadcast-priority]")?.value || "normal").trim();

    if (!title) {
      setAiStatus("配信タイトルを入力してください", "error");
      return;
    }
    if (!aiSession.output) {
      setAiStatus("配信する本文がありません", "error");
      return;
    }

    try {
      const sourceDraftId = window.TasuTalkBroadcastDrafts?.ensureSourceDraftId?.({
        draftId: aiSession.draftId,
        mode: activeAiMode,
        input: aiSession.input,
        output: aiSession.output,
      });
      if (sourceDraftId && !aiSession.draftId) {
        aiSession.draftId = sourceDraftId;
        renderSavedAiDrafts();
      }

      const row = window.TasuTalkBroadcastDrafts?.add?.({
        sourceDraftId: sourceDraftId || "",
        kind: window.TasuTalkBroadcastDrafts?.kindFromAiMode?.(activeAiMode) || activeAiMode,
        title,
        body: aiSession.output,
        targetSegment: segment,
        status: "draft",
        priority,
      });

      if (!row?.id) {
        setAiStatus("配信下書きの保存に失敗しました", "error");
        return;
      }

      closeBroadcastModal();
      renderBroadcastDrafts();
      setAiStatus("配信下書きを保存しました", "ok");
    } catch (err) {
      console.warn(err);
      setAiStatus("配信下書きの保存に失敗しました", "error");
    }
  }

  function renderBroadcastDrafts() {
    const host = $("[data-talk-broadcast-list]");
    if (!host) return;

    let rows = [];
    try {
      rows = window.TasuTalkBroadcastDrafts?.listRecent?.({ limit: 5 }) || [];
    } catch (err) {
      console.warn("[talk-home] broadcast drafts read failed:", err);
      host.innerHTML = `<p class="talk-empty">配信下書きを読み込めませんでした</p>`;
      return;
    }

    if (!rows.length) {
      host.innerHTML = `<p class="talk-empty">配信下書きはまだありません</p>`;
      return;
    }

    const store = window.TasuTalkBroadcastDrafts;

    host.innerHTML = rows
      .map((r) => {
        const kindLabel = store?.KIND_LABELS?.[r.kind] || r.kind;
        const statusLabel = store?.STATUS_LABELS?.[r.status] || r.status;
        const priorityLabel = store?.PRIORITY_LABELS?.[r.priority] || r.priority;
        const segmentLabel = store?.segmentLabel?.(r.targetSegment) || r.targetSegment;
        const statusClass = r.status ? ` talk-broadcast-card__status--${escapeHtml(r.status)}` : "";
        const sentTime = formatBroadcastSentTime(r);
        const canSend = store?.canBroadcastSend?.(r) === true;
        const lastSend = Array.isArray(r.sendHistory) && r.sendHistory.length ? r.sendHistory[r.sendHistory.length - 1] : null;
        const sentBadge =
          r.status === "sent"
            ? `<p class="talk-broadcast-card__sent">送信済み ${escapeHtml(sentTime || formatDraftTime(r.updatedAt))}${lastSend ? ` · ${escapeHtml(String(lastSend.deliveredCount))}名` : ""}</p>`
            : "";
        const highlight =
          pendingHighlightBroadcastId && String(r.id) === pendingHighlightBroadcastId
            ? " talk-broadcast-card--highlight"
            : "";
        return `
        <article class="talk-broadcast-card${highlight}" data-talk-broadcast-id="${escapeHtml(r.id)}">
          <header class="talk-broadcast-card__head">
            <span class="talk-broadcast-card__kind">${escapeHtml(kindLabel)}</span>
            <time class="talk-broadcast-card__time" datetime="${escapeHtml(r.createdAt)}">${escapeHtml(formatDraftTime(r.createdAt))}</time>
            <span class="talk-broadcast-card__priority">${escapeHtml(priorityLabel)}</span>
            <span class="talk-broadcast-card__status${statusClass}">${escapeHtml(statusLabel)}</span>
          </header>
          ${sentBadge}
          <p class="talk-broadcast-card__title">${escapeHtml(r.title)}</p>
          <p class="talk-broadcast-card__meta">${escapeHtml(segmentLabel)} · ${escapeHtml(String(r.targetCount))} 名</p>
          <div class="talk-broadcast-card__actions">
            <button type="button" class="talk-ai-draft-card__btn" data-talk-broadcast-view="${escapeHtml(r.id)}">確認</button>
            ${
              canSend
                ? `<button type="button" class="talk-ai-draft-card__btn talk-ai-draft-card__btn--send" data-talk-broadcast-send="${escapeHtml(r.id)}">本番送信</button>`
                : ""
            }
            <button type="button" class="talk-ai-draft-card__btn" data-talk-broadcast-test="${escapeHtml(r.id)}">通知タブにテスト追加</button>
            <button type="button" class="talk-ai-draft-card__btn talk-ai-draft-card__btn--danger" data-talk-broadcast-delete="${escapeHtml(r.id)}">削除</button>
          </div>
        </article>`;
      })
      .join("");

    host.querySelectorAll("[data-talk-broadcast-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const row = store?.findById?.(btn.getAttribute("data-talk-broadcast-view"));
        if (row) openBroadcastView(row);
      });
    });

    host.querySelectorAll("[data-talk-broadcast-send]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-talk-broadcast-send");
        const row = store?.findById?.(id);
        if (row) openBroadcastSendConfirm(row);
      });
    });

    host.querySelectorAll("[data-talk-broadcast-test]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-talk-broadcast-test");
        const row = store?.findById?.(id);
        if (!row) {
          setAiStatus("配信下書きが見つかりません", "error");
          return;
        }
        const result = window.TasuTalkData?.addTestNotificationFromBroadcastDraft?.(row);
        if (!result?.ok) {
          setAiStatus("テスト通知の追加に失敗しました", "error");
          return;
        }
        setAiStatus("通知タブにテスト追加しました", "ok");
        if (activeTab === "notify") renderNotifications();
      });
    });

    host.querySelectorAll("[data-talk-broadcast-delete]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-talk-broadcast-delete");
        if (!id) return;
        try {
          store?.remove?.(id);
          renderBroadcastDrafts();
          setAiStatus("配信下書きを削除しました", "ok");
        } catch (err) {
          console.warn(err);
          setAiStatus("削除に失敗しました", "error");
        }
      });
    });
  }

  function wireBroadcastDraftsChangeListener() {
    if (window.__talkBroadcastDraftsChangeBound) return;
    window.__talkBroadcastDraftsChangeBound = true;
    window.addEventListener("tasful-talk-broadcast-drafts-changed", () => {
      refreshTalkSurfaces();
    });
  }

  function navigateAiDraftToPostForm(draftPayload) {
    const mode = normalizeAiMode(draftPayload?.mode || activeAiMode);
    if (!canApplyAiToForm(mode)) {
      setAiStatus("このモードは投稿フォームへ反映できません", "error");
      return;
    }
    const result = window.TasuTalkAiDraftApply?.navigateToPostForm?.({
      mode,
      draftId: draftPayload?.draftId || aiSession.draftId,
      input: draftPayload?.input ?? aiSession.input,
      output: draftPayload?.output ?? aiSession.output,
    });
    if (!result?.ok) {
      setAiStatus("投稿フォームへの遷移に失敗しました", "error");
    }
  }

  function showAiResult(textOrPayload) {
    const section = $("[data-talk-ai-result]");
    const out = $("[data-talk-ai-output]");
    const htmlHost = $("[data-talk-ai-output-html]");
    const titleEl = $("[data-talk-ai-result-title]");

    const payload =
      textOrPayload && typeof textOrPayload === "object"
        ? textOrPayload
        : { text: textOrPayload, html: "", isSearch: false };
    const text = String(payload.text || payload.plain || "").trim();
    const html = String(payload.html || "").trim();
    const isSearch = Boolean(payload.isSearch || html);

    aiSession.output = text;
    aiSession.resultHtml = html;
    aiSession.isSearchResult = isSearch;

    if (html && htmlHost) {
      htmlHost.innerHTML = html;
      htmlHost.hidden = false;
      if (out) out.hidden = true;
    } else {
      if (htmlHost) {
        htmlHost.innerHTML = "";
        htmlHost.hidden = true;
      }
      if (out) {
        out.hidden = false;
        out.textContent = text || "（空の応答）";
      }
    }

    if (titleEl) {
      titleEl.textContent = isSearch ? "AIの回答" : "生成結果";
    }
    if (section) section.hidden = false;
    if (htmlHost && global.TasuAiCallConsent?.init) {
      global.TasuAiCallConsent.init(htmlHost);
    }
    syncAiResultActions();
  }

  function hideAiResult() {
    const section = $("[data-talk-ai-result]");
    const htmlHost = $("[data-talk-ai-output-html]");
    if (section) section.hidden = true;
    aiSession.output = "";
    aiSession.resultHtml = "";
    aiSession.isSearchResult = false;
    aiSession.draftId = null;
    if (htmlHost) {
      htmlHost.innerHTML = "";
      htmlHost.hidden = true;
    }
    syncAiResultActions();
    setAiStatus("", "");
  }

  function syncAiModeUi() {
    activeAiMode = normalizeAiMode(activeAiMode);
    document.querySelectorAll("[data-talk-ai-mode]").forEach((btn) => {
      const mode = normalizeAiMode(btn.getAttribute("data-talk-ai-mode"));
      btn.classList.toggle("is-active", mode === activeAiMode);
    });
    const hint = $("[data-talk-ai-hint]");
    if (hint) hint.textContent = AI_MODE_HINTS[activeAiMode] || AI_MODE_HINTS.qa;
    const submitBtn = $("[data-talk-ai-generate]");
    if (submitBtn) {
      submitBtn.textContent = "下書きを生成";
    }
    const input = /** @type {HTMLTextAreaElement|null} */ ($("[data-talk-ai-input]"));
    if (input) {
      input.placeholder = "質問・告知したい内容・通知文案の要点を入力";
    }
    updateAiModeLabel();
    syncAiResultActions();
  }

  function formatDraftTime(iso) {
    return formatNotifyTime(iso) || "";
  }

  function renderSavedAiDrafts() {
    const host = $("[data-talk-ai-drafts-list]");
    if (!host) return;

    let rows = [];
    try {
      rows = window.TasuTalkAiDrafts?.listRecent?.({ limit: 5 }) || [];
    } catch (err) {
      console.warn("[talk-home] ai drafts read failed:", err);
      host.innerHTML = `<p class="talk-empty">下書きを読み込めませんでした</p>`;
      return;
    }

    if (!rows.length) {
      host.innerHTML = `<p class="talk-empty">保存済みの下書きはありません</p>`;
      return;
    }

    const statusLabels = { draft: "下書き", used: "使用済み", discarded: "破棄" };

    host.innerHTML = rows
      .map((d) => {
        const modeLabel =
          window.TasuTalkAiDrafts?.modeLabel?.(d.mode) ||
          AI_MODE_LABELS[d.mode] ||
          d.mode;
        const st = statusLabels[d.status] || d.status;
        const cardClass =
          d.status === "discarded" ? " talk-ai-draft-card--discarded" : "";
        return `
        <article class="talk-ai-draft-card${cardClass}" data-talk-ai-draft-id="${escapeHtml(d.id)}">
          <header class="talk-ai-draft-card__head">
            <span class="talk-ai-draft-card__mode">${escapeHtml(modeLabel)}</span>
            <time class="talk-ai-draft-card__time" datetime="${escapeHtml(d.createdAt)}">${escapeHtml(formatDraftTime(d.createdAt))}</time>
            <span class="talk-ai-draft-card__status">${escapeHtml(st)}</span>
          </header>
          <p class="talk-ai-draft-card__excerpt"><strong>入力:</strong> ${escapeHtml(window.TasuTalkAiDrafts?.excerpt?.(d.input, 48) || d.input.slice(0, 48))}</p>
          <p class="talk-ai-draft-card__excerpt talk-ai-draft-card__excerpt--out"><strong>出力:</strong> ${escapeHtml(window.TasuTalkAiDrafts?.excerpt?.(d.output, 56) || d.output.slice(0, 56))}</p>
          <div class="talk-ai-draft-card__actions">
            <button type="button" class="talk-ai-draft-card__btn" data-talk-ai-draft-reuse="${escapeHtml(d.id)}">再利用</button>
            ${
              canApplyAiToForm(d.mode)
                ? `<button type="button" class="talk-ai-draft-card__btn talk-ai-draft-card__btn--apply" data-talk-ai-draft-apply="${escapeHtml(d.id)}">投稿フォームへ反映</button>`
                : ""
            }
            <button type="button" class="talk-ai-draft-card__btn talk-ai-draft-card__btn--danger" data-talk-ai-draft-delete="${escapeHtml(d.id)}">削除</button>
          </div>
        </article>`;
      })
      .join("");

    host.querySelectorAll("[data-talk-ai-draft-reuse]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-talk-ai-draft-reuse");
        const row = window.TasuTalkAiDrafts?.findById?.(id);
        if (!row) return;
        activeAiMode = normalizeAiMode(row.mode);
        aiSession = {
          mode: activeAiMode,
          input: row.input,
          output: row.output,
          draftId: row.id,
        };
        const inputEl = /** @type {HTMLTextAreaElement|null} */ ($("[data-talk-ai-input]"));
        if (inputEl) inputEl.value = row.input;
        showAiComposer();
        syncAiModeUi();
        document.querySelectorAll("[data-talk-ai-mode]").forEach((modeBtn) => {
          modeBtn.classList.toggle(
            "is-active",
            normalizeAiMode(modeBtn.getAttribute("data-talk-ai-mode")) === activeAiMode
          );
        });
        showAiResult(row.output);
        setAiStatus("保存済み下書きを読み込みました", "ok");
      });
    });

    host.querySelectorAll("[data-talk-ai-draft-apply]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-talk-ai-draft-apply");
        const row = window.TasuTalkAiDrafts?.findById?.(id);
        if (!row) {
          setAiStatus("下書きが見つかりません", "error");
          return;
        }
        navigateAiDraftToPostForm({
          mode: row.mode,
          draftId: row.id,
          input: row.input,
          output: row.output,
        });
      });
    });

    host.querySelectorAll("[data-talk-ai-draft-delete]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-talk-ai-draft-delete");
        if (!id) return;
        try {
          window.TasuTalkAiDrafts?.remove?.(id);
          if (aiSession.draftId === id) aiSession.draftId = null;
          renderSavedAiDrafts();
          setAiStatus("下書きを削除しました", "ok");
        } catch (err) {
          console.warn(err);
          setAiStatus("削除に失敗しました", "error");
        }
      });
    });
  }

  async function runAiGenerate() {
    const input = /** @type {HTMLTextAreaElement|null} */ ($("[data-talk-ai-input]"));
    const form = $("[data-talk-ai-form]");
    const submit = form?.querySelector("[type=submit], [data-talk-ai-generate]");
    const prompt = String(input?.value || "").trim();

    if (normalizeAiMode(activeAiMode) === "qa") {
      openAiWorkspaceConsult({ q: prompt, send: Boolean(prompt), historyLabel: "AI相談" });
      return;
    }

    if (!prompt) {
      input?.focus();
      setAiStatus("入力内容を記入してください", "error");
      return;
    }

    activeAiMode = normalizeAiMode(activeAiMode);
    aiSession.input = prompt;
    aiSession.mode = activeAiMode;
    aiSession.draftId = null;

    submit?.setAttribute("disabled", "true");
    setAiStatus("生成中…", "");
    try {
      if (!window.TasuTalkAi?.generateTalkAiDraft) {
        throw new Error("TasuTalkAi が読み込まれていません");
      }
      const draft = await window.TasuTalkAi.generateTalkAiDraft(activeAiMode, {
        prompt,
        topic: "TASFUL TALK",
      });
      activeAiMode = normalizeAiMode(draft.mode || activeAiMode);
      const resultHtml = String(draft.meta?.html || "").trim();
      const isSearch =
        Boolean(resultHtml) ||
        /tasu-cross-search|tasu-faq-knowledge/.test(String(draft.meta?.provider || ""));
      showAiResult({
        text: draft.text || "（空の応答）",
        html: resultHtml,
        isSearch,
      });
      setAiStatus(
        isSearch
          ? "候補を表示しました。詳細ページからご確認ください。"
          : "下書きを生成しました。保存・通知追加ができます。",
        "ok"
      );
      window.TasuTalkAiHistory?.record?.({
        mode: activeAiMode,
        label: aiModeDisplayLabel(activeAiMode),
        promptPreview: prompt,
      });
      renderAiUsageHistory();
    } catch (err) {
      console.error(err);
      showAiResult("生成に失敗しました。しばらくしてから再度お試しください。");
      setAiStatus("生成に失敗しました", "error");
    } finally {
      submit?.removeAttribute("disabled");
    }
  }

  function wireAiDraftsChangeListener() {
    if (window.__talkAiDraftsChangeBound) return;
    window.__talkAiDraftsChangeBound = true;
    window.addEventListener("tasful-talk-ai-drafts-changed", () => {
      refreshTalkSurfaces();
    });
    window.addEventListener("tasful-talk-ai-usage-history-changed", () => {
      renderAiUsageHistory();
    });
  }

  function wireAiTab() {
    $("[data-talk-ai-back]")?.addEventListener("click", () => {
      hideAiResult();
      showAiHub();
    });

    $("[data-talk-ai-vendor-back]")?.addEventListener("click", () => {
      showAiHub();
    });

    document.querySelectorAll("[data-talk-ai-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeAiMode = normalizeAiMode(btn.getAttribute("data-talk-ai-mode") || "qa");
        syncAiModeUi();
      });
    });

    const form = $("[data-talk-ai-form]");
    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      if (normalizeAiMode(activeAiMode) === "qa") {
        const input = /** @type {HTMLTextAreaElement|null} */ ($("[data-talk-ai-input]"));
        openAiWorkspaceConsult({
          q: String(input?.value || "").trim(),
          send: true,
          historyLabel: "AI相談",
        });
        return;
      }
      runAiGenerate();
    });

    $("[data-talk-ai-regenerate]")?.addEventListener("click", () => runAiGenerate());

    $("[data-talk-ai-save]")?.addEventListener("click", () => {
      if (!aiSession.output) {
        setAiStatus("先に下書きを生成してください", "error");
        return;
      }
      try {
        const row = window.TasuTalkAiDrafts?.add?.({
          mode: activeAiMode,
          input: aiSession.input,
          output: aiSession.output,
          status: "draft",
        });
        if (row?.id) aiSession.draftId = row.id;
        renderSavedAiDrafts();
        setAiStatus("下書きを保存しました", "ok");
      } catch (err) {
        console.warn(err);
        setAiStatus("保存に失敗しました", "error");
      }
    });

    $("[data-talk-ai-copy]")?.addEventListener("click", async () => {
      const text = aiSession.output;
      if (!text) {
        setAiStatus("コピーする内容がありません", "error");
        return;
      }
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        setAiStatus("クリップボードにコピーしました", "ok");
      } catch (err) {
        console.warn(err);
        setAiStatus("コピーに失敗しました", "error");
      }
    });

    $("[data-talk-ai-apply-form]")?.addEventListener("click", () => {
      if (!aiSession.output) {
        setAiStatus("反映する下書きがありません", "error");
        return;
      }
      if (!aiSession.draftId) {
        try {
          const row = window.TasuTalkAiDrafts?.add?.({
            mode: activeAiMode,
            input: aiSession.input,
            output: aiSession.output,
            status: "draft",
          });
          if (row?.id) aiSession.draftId = row.id;
          renderSavedAiDrafts();
        } catch (err) {
          console.warn(err);
        }
      }
      navigateAiDraftToPostForm({
        mode: activeAiMode,
        draftId: aiSession.draftId,
        input: aiSession.input,
        output: aiSession.output,
      });
    });

    $("[data-talk-ai-to-notify]")?.addEventListener("click", () => {
      if (!aiSession.output) {
        setAiStatus("通知に追加する内容がありません", "error");
        return;
      }
      const result = window.TasuTalkAiDrafts?.pushAsNotification?.({
        mode: activeAiMode,
        input: aiSession.input,
        output: aiSession.output,
      });
      if (!result?.ok) {
        setAiStatus("通知の追加に失敗しました", "error");
        return;
      }
      if (aiSession.draftId) {
        window.TasuTalkAiDrafts?.markUsed?.(aiSession.draftId);
        renderSavedAiDrafts();
      }
      setAiStatus("通知タブに追加しました", "ok");
      if (activeTab === "notify") renderNotifications();
    });

    $("[data-talk-ai-save-broadcast]")?.addEventListener("click", () => openBroadcastModal());

    $("[data-talk-broadcast-form]")?.addEventListener("submit", (e) => {
      e.preventDefault();
      saveBroadcastDraftFromModal();
    });

    document.querySelectorAll("[data-talk-broadcast-close]").forEach((el) => {
      el.addEventListener("click", () => closeBroadcastModal());
    });

    $("[data-talk-broadcast-segment]")?.addEventListener("change", updateBroadcastSegmentHint);

    document.querySelectorAll("[data-talk-broadcast-view-close]").forEach((el) => {
      el.addEventListener("click", () => closeBroadcastView());
    });

    document.querySelectorAll("[data-talk-broadcast-send-close]").forEach((el) => {
      el.addEventListener("click", () => closeBroadcastSendConfirm());
    });

    $("[data-talk-broadcast-send-confirm]")?.addEventListener("click", () => runBroadcastSendConfirm());

    wireBroadcastDraftsChangeListener();

    $("[data-talk-ai-discard]")?.addEventListener("click", () => {
      if (aiSession.draftId) {
        try {
          window.TasuTalkAiDrafts?.markDiscarded?.(aiSession.draftId);
          renderSavedAiDrafts();
        } catch (err) {
          console.warn(err);
        }
      }
      hideAiResult();
      setAiStatus("下書きを破棄しました", "ok");
    });

    wireAiDraftsChangeListener();
  }

  async function initSupabaseTalkStores() {
    try {
      if (typeof window.TasuTalkSupabaseSync?.initAll === "function") {
        await window.TasuTalkSupabaseSync.initAll();
        return;
      }
      await Promise.all([
        window.TasuTalkNotifications?.init?.(),
        window.TasuTalkAiDrafts?.init?.(),
        window.TasuTalkBroadcastDrafts?.init?.(),
      ]);
    } catch (err) {
      console.warn("[talk-home] Supabase talk sync init failed:", err);
    }
  }

  async function init() {
    const perfOn = isTalkPerfLogging();
    if (perfOn) console.time("[TasuTalkPerf] talk-home init total");
    global.__tasuTalkSuppressNotifyRefresh = true;
    if (global.history?.scrollRestoration) {
      global.history.scrollRestoration = "manual";
    }
    activeTab = resolveInitialTalkTab();
    normalizeNotifyTabRedirect(true);
    persistTalkTabSelection(activeTab);
    if (perfOn) console.time("[TasuTalkPerf] applyTalkHomeLayout");
    applyTalkHomeLayout();
    if (perfOn) console.timeEnd("[TasuTalkPerf] applyTalkHomeLayout");
    logTalkHomePermissionState({ phase: "init-after-layout" });
    wireTabs();
    wireDashboard();
    loadFilterStatesFromStorage();
    wireUnifiedInbox();
    wireQuickActions();
    wireLineRailNav();
    wireFriendAddModal();
    wireListOverflowMenu();
    window.TasuTalkFriendHubUi?.init?.();
    renderLineListFilters();
    wireChatSearch();
    wireNotifySearch();
    wireNotifyChangeListener();
    wireNotificationSettings();
    wireNotificationDetail();
    initFilterPanels();
    wireAiTab();
    const notifyFirst = activeTab === "notify";
    setTab(activeTab, false, { skipSurfaceRender: true });
    document.body.classList.toggle("talk-home--tab-chat", activeTab === "chat");
    document.body.classList.toggle("talk-home--tab-notify", activeTab === "notify");
    document.body.classList.toggle("talk-home--tab-ai", activeTab === "ai");
    syncChatAppChrome();
    if (activeTab === "ai" && !aiComposerVisible) showAiHub();

    if (perfOn) console.time("[TasuTalkPerf] initSupabaseTalkStores");
    await initSupabaseTalkStores();
    if (perfOn) console.timeEnd("[TasuTalkPerf] initSupabaseTalkStores");

    if (!notifyFirst) {
      renderDashboard();
      syncAiModeUi();
      renderSavedAiDrafts();
      renderBroadcastDrafts();
      populateBroadcastSegmentSelect();
    }

    const threadFromUrl =
      activeTab === "chat"
        ? String(
            new URLSearchParams(window.location.search).get("thread") ||
              new URLSearchParams(window.location.search).get("roomId") ||
              ""
          ).trim()
        : "";

    if (activeTab === "chat") {
      if (perfOn) console.time("[TasuTalkPerf] loadChatThreads");
      try {
        await ensureChatThreadsLoaded();
      } catch (err) {
        console.error(err);
        const list = $("#talkChatThreadList");
        if (list) list.innerHTML = `<li class="talk-empty">チャットの読み込みに失敗しました</li>`;
      }
      if (perfOn) console.timeEnd("[TasuTalkPerf] loadChatThreads");
    }

    window.TasuTalkLineRoom?.init?.({
      getThreads: () =>
        window.TasuTalkData?.buildChatDisplayList?.(threadsCache) || threadsCache,
      threadIdFromUrl: threadFromUrl,
    });
    window.TasuTalkLineRoomMenu?.init?.();

    if (notifyFirst) {
      if (perfOn) console.time("[TasuTalkPerf] notify first paint");
      renderNotifyFilterPanel();
      renderNotifications();
      scheduleNotifyTabPaintRetries();
      if (perfOn) console.timeEnd("[TasuTalkPerf] notify first paint");
    } else if (activeTab === "ai") {
      syncAiModeUi();
      renderSavedAiDrafts();
      renderBroadcastDrafts();
    }

    global.__tasuTalkSuppressNotifyRefresh = false;
    if (isBenchNotifyEmbedContext()) {
      refreshBenchNotifyList();
    }
    applyUrlAction();
    renderRecentActions();
    restoreTalkReturnState();

    window.TasufulAppMobile?.init?.();

    if (!window.__tasuTalkPageShowWired) {
      window.__tasuTalkPageShowWired = true;
      window.addEventListener("pageshow", () => {
        const tab = resolveInitialTalkTab();
        if (tab !== activeTab && TAB_IDS.includes(tab)) {
          setTab(tab, false);
        }
        if (activeTab === "notify") {
          renderNotifyFilterPanel();
          renderNotifications();
          scheduleNotifyTabPaintRetries();
        }
      });
    }

    document.addEventListener("tasful-official-room-read", () => {
      void loadChatThreads();
    });
    document.addEventListener("tasful-chat-threads-changed", () => {
      void loadChatThreads();
    });

    global.TasuOpsWatchBrowser?.initOpsWatchAutoRunOnLoad?.({ surface: "talk-home" });
    if (perfOn) console.timeEnd("[TasuTalkPerf] talk-home init total");
  }

  window.TasuTalkHomeUi = {
    handleUnifiedInboxAction,
    refreshTalkSurfaces,
    refreshBenchNotifyList,
    renderUnifiedInbox,
    renderNotifyFilterPanel,
    setLineNav,
    saveTalkReturnState,
    restoreTalkReturnState,
    resetListScrollPosition,
    openFriendAddModal,
    closeFriendAddModal,
    refreshChatThreads,
    markAllNotificationCenterReadUi,
    logTalkHomePermissionState,
    logTalkAdminFilterDebug,
    logNotifyListRenderAudit,
    isTalkAdminForFilters,
  };

  function applyBenchEmbedUserFromMessage(detail) {
    const uid = String(detail?.userId || "").trim();
    if (!uid) return false;
    try {
      const params = new URLSearchParams(window.location.search);
      let changed = false;
      if (params.get("userId") !== uid) {
        params.set("userId", uid);
        changed = true;
      }
      const role = String(detail?.benchRole || "").trim();
      if (role && params.get("benchRole") !== role) {
        params.set("benchRole", role);
        changed = true;
      }
      if (changed) {
        history.replaceState(null, "", `${location.pathname}?${params.toString()}${location.hash || ""}`);
      }
      return changed || true;
    } catch {
      return false;
    }
  }

  window.addEventListener("message", (ev) => {
    if (!isBenchNotifyEmbedContext()) return;
    if (ev.data?.type === "tasu-bench-notify-frame-height") {
      const forced = Math.round(Number(ev.data?.height) || 0);
      const h = forced > 0 ? Math.max(96, forced) : 520;
      benchNotifyFrameHeight = h;
      syncBenchNotifyEmbedHeightFromContext(h);
      syncNotifyListLayoutVars();
      return;
    }
    if (ev.data?.type === "tasu-bench-embed-user") {
      if (applyBenchEmbedUserFromMessage(ev.data)) {
        refreshBenchNotifyList();
      }
      return;
    }
    if (ev.data?.type !== "tasu-bench-notify-refresh") return;
    refreshBenchNotifyList({
      force: ev.data?.immediate === true || ev.data?.force === true,
    });
  });
  global.__benchNotifyMessageListenerReady = true;

  window.addEventListener("tasful-talk-notifications-changed", (ev) => {
    if (global.__tasuTalkSuppressNotifyRefresh === true) return;
    const notifyOnly =
      ev?.detail?.notifyOnly === true ||
      String(ev?.detail?.source || "").includes("platform_chat_demo");
    refreshTalkSurfaces({ notifyOnly: notifyOnly || activeTab === "notify" });
    if (activeTab === "notify") renderNotifications();
  });

  window.addEventListener("storage", (ev) => {
    const key = String(ev.key || "");
    if (key === "tasful_talk_notifications") {
      if (isBenchNotifyEmbedContext()) {
        handleBenchNotifyStorageRefresh();
      } else {
        window.TasuTalkData?.invalidateNotificationsBootstrap?.();
        refreshTalkSurfaces({ notifyOnly: activeTab === "notify" });
      }
      return;
    }
    if (key === "tasful_chat_threads") {
      refreshTalkSurfaces();
    }
  });

  global.TasuTalkPermissionDebug = {
    log: logTalkHomePermissionState,
    snapshot: () => window.TasuTalkRuntime?.getTalkPermissionSnapshot?.(),
  };

  global.__TASU_TALK_NOTIFY_CTA_ONLY_V = "3";

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
