/**
 * TASFUL TALK — 表示レイアウト（一般 / Builder / 運営）
 */
(function (global) {
  "use strict";

  function getCapabilities() {
    if (global.TasuTalkRuntime?.getTalkCapabilities) {
      return global.TasuTalkRuntime.getTalkCapabilities();
    }
    return { admin: false, builder: false, simple: true };
  }

  /** メイン AI メニュー（タブ内） */
  const AI_PRIMARY_MODES = Object.freeze([
    { id: "qa", label: "AI相談", hint: "使い方・掲載・料金の相談", icon: "💬" },
    { id: "ad", label: "文章作成", hint: "告知・広告・掲載文の下書き", icon: "✍️" },
    { id: "job", label: "求人作成", hint: "求人掲載向けの文案", icon: "👔" },
    { id: "project", label: "案件作成", hint: "Builder 案件掲載向け", icon: "📋" },
  ]);

  /** トップ階層に出さない生成系（その他・折りたたみ） */
  const AI_OTHER_TOOLS = Object.freeze([
    { id: "image", label: "画像生成", href: "gen-ai-workspace.html", icon: "🖼️" },
    { id: "music", label: "音楽生成", href: "gen-ai-workspace.html", icon: "🎵" },
    { id: "video", label: "動画生成", href: "gen-ai-workspace.html", icon: "🎬" },
    { id: "3d", label: "3D生成", href: "gen-ai-workspace.html", icon: "🧊" },
    { id: "translate", label: "翻訳", href: "ai-workspace.html", icon: "🌐" },
    { id: "program", label: "プログラム支援", href: "ai-workspace.html", icon: "⌨️" },
  ]);

  /** 運営向け AI（折りたたみ内） */
  const AI_ADMIN_MODES = Object.freeze([
    { id: "notice", label: "通知作成", hint: "会員向けお知らせ文案", icon: "📢" },
  ]);

  /** 一般ユーザー — トークフィルター */
  const SIMPLE_CHAT_FILTER_IDS = Object.freeze([
    "all",
    "personal",
    "job",
    "business",
    "shop",
  ]);

  /** Builder 追加 — トーク */
  const BUILDER_CHAT_FILTER_IDS = Object.freeze(["builder"]);

  /** 一般ユーザー — 通知クイックフィルター */
  const SIMPLE_NOTIFY_QUICK_IDS = Object.freeze(["all", "unread", "important"]);

  /** Builder 追加 — 通知カテゴリ */
  const BUILDER_NOTIFY_TYPE_IDS = Object.freeze(["builder"]);

  const SIMPLE_CHAT_LABEL_OVERRIDES = Object.freeze({
    shop: "店舗販売",
  });

  function isAdminCaps(caps) {
    return caps?.admin === true;
  }

  function isBuilderOnlyCaps(caps) {
    return caps?.builder === true && caps?.admin !== true;
  }

  function isSimpleCaps(caps) {
    return caps?.simple === true;
  }

  function getFilterUiMode(caps) {
    const c = caps || getCapabilities();
    if (isAdminCaps(c)) return "admin";
    if (isBuilderOnlyCaps(c)) return "builder";
    return "simple";
  }

  function filterChatChannels(channels) {
    const caps = getCapabilities();
    const mode = getFilterUiMode(caps);
    const list = channels || [];

    if (mode === "admin") return list;

    const allowed = new Set(SIMPLE_CHAT_FILTER_IDS);
    if (mode === "builder") {
      BUILDER_CHAT_FILTER_IDS.forEach((id) => allowed.add(id));
    }

    return list
      .filter((c) => allowed.has(c.id))
      .map((c) => ({
        ...c,
        label: SIMPLE_CHAT_LABEL_OVERRIDES[c.id] || c.label,
      }));
  }

  function filterStaticHubCards(cards) {
    const caps = getCapabilities();
    return (cards || []).filter((card) => {
      if (card._notificationCenterHub) return true;
      if (card._opsRoom && !caps.admin) return false;
      if (card._talkChannel === "builder" && !caps.builder) return false;
      if (card._talkChannel === "ai_consult" && caps.simple) return false;
      if (card._talkChannel === "system" && !caps.admin) return false;
      return true;
    });
  }

  /** 運営向け — 通知カテゴリチップ（NOTIFICATION_FILTERS 用） */
  function filterNotifyFilters(filters) {
    const caps = getCapabilities();
    const mode = getFilterUiMode(caps);
    if (mode === "admin") {
      const hideCategory = new Set(["system", "anpi"]);
      return (filters || []).filter((f) => {
        if (f.id === "ops_watch" && !caps.admin) return false;
        if (hideCategory.has(f.id)) return false;
        return true;
      });
    }
    if (mode === "builder") {
      return (filters || []).filter((f) =>
        ["all", "unread", ...BUILDER_NOTIFY_TYPE_IDS].includes(f.id)
      );
    }
    return (filters || []).filter((f) => ["all", "unread"].includes(f.id));
  }

  /**
   * 通知タブ — クイックフィルター行（一般 / Builder）
   * @param {{ types?: Record<string, number>, flags?: Record<string, number> }} counts
   * @param {number} [visibleTotal]
   */
  function buildSimpleNotifyQuickOptions(counts, visibleTotal) {
    const caps = getCapabilities();
    const mode = getFilterUiMode(caps);
    const flags = counts?.flags || {};
    const types = counts?.types || {};
    const total = Number(visibleTotal) >= 0 ? Number(visibleTotal) : 0;

    const options = [
      { id: "all", label: "すべて", count: total },
      { id: "unread", label: "未読", count: flags.unread || 0 },
      { id: "important", label: "重要", count: flags.important || 0 },
    ];

    if (mode === "builder") {
      options.push({
        id: "builder",
        label: "Builder",
        count: types.builder || 0,
      });
    }

    return options;
  }

  /** 統合ビュー — カテゴリチップ（OPS WATCH は運営のみ） */
  function filterUnifiedInboxCategoryFilters(filters) {
    const caps = getCapabilities();
    return (filters || []).filter((f) => {
      if (f.id === "ops_watch" && !caps.admin) return false;
      return true;
    });
  }

  function applyBodyLayoutClasses() {
    const caps = getCapabilities();
    const body = global.document?.body;
    if (!body) return caps;
    body.classList.toggle("talk-home--simple", caps.simple === true);
    body.classList.toggle("talk-home--admin", caps.admin === true);
    body.classList.toggle("talk-home--builder", caps.builder === true);
    body.classList.add("talk-home--line");
    return caps;
  }

  global.TasuTalkHomeLayout = {
    getCapabilities,
    getFilterUiMode,
    isAdminCaps,
    isBuilderOnlyCaps,
    isSimpleCaps,
    AI_PRIMARY_MODES,
    AI_OTHER_TOOLS,
    AI_ADMIN_MODES,
    SIMPLE_CHAT_FILTER_IDS,
    BUILDER_CHAT_FILTER_IDS,
    SIMPLE_NOTIFY_QUICK_IDS,
    BUILDER_NOTIFY_TYPE_IDS,
    filterChatChannels,
    filterStaticHubCards,
    filterNotifyFilters,
    filterUnifiedInboxCategoryFilters,
    buildSimpleNotifyQuickOptions,
    applyBodyLayoutClasses,
  };
})(typeof window !== "undefined" ? window : globalThis);
