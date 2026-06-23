/**
 * TASFUL パンくず設定 — pathname ラベル / 静的フォールバック
 */
(function (global) {
  "use strict";

  const INDEX = "index-top.html";
  const BUSINESS = "business.html";
  const SHOP_STORE = "shop-store.html";
  const DASHBOARD = "dashboard.html";
  const BUILDER_HOME = "builder-top.html";

  /** @typedef {{ label: string, href?: string }} BreadcrumbItem */

  /**
   * @param {Location|string} loc
   * @returns {string}
   */
  function normalizePageKey(loc) {
    const location = typeof loc === "string" ? { pathname: loc } : loc || global.location;
    const path = String(location.pathname || loc || "").replace(/\\/g, "/");
    const parts = path.split("/").filter(Boolean);
    if (!parts.length) return "index.html";
    let file = parts[parts.length - 1];
    if (!/\.[a-z0-9]+$/i.test(file)) {
      file = `${file}.html`;
    }
    if (parts.length >= 2 && parts[parts.length - 2] === "builder") {
      return `builder/${file}`;
    }
    if (parts.length >= 2 && parts[parts.length - 2] === "builder-admin") {
      return `builder-admin/${file}`;
    }
    if (parts.length >= 2 && parts[parts.length - 2] === "live") {
      return `live/${file}`;
    }
    return file;
  }

  /**
   * @param {string} href
   * @returns {string}
   */
  function pageKeyFromHref(href) {
    try {
      const url = new URL(String(href || "").trim(), global.location?.href || "http://localhost/");
      const pk = normalizePageKey({ pathname: url.pathname });
      const id =
        url.searchParams.get("id") ||
        url.searchParams.get("listingId") ||
        url.searchParams.get("shopId") ||
        url.searchParams.get("productId") ||
        url.searchParams.get("thread") ||
        url.searchParams.get("project_id");
      return id ? `${pk}::${id}` : pk;
    } catch {
      return String(href || "").trim();
    }
  }

  /**
   * @param {Record<string, string>} params
   * @returns {BreadcrumbItem[]}
   */
  function businessListTrail(params) {
    const cat = String(params.business_category || params.cat || "").trim();
    const catLabel = String(params.catLabel || "").trim();
    if (cat && catLabel) {
      return [
        { label: "TASFUL", href: INDEX },
        { label: "法人・業者・店舗", href: BUSINESS },
        { label: catLabel },
      ];
    }
    return [
      { label: "TASFUL", href: INDEX },
      { label: "法人・業者・店舗" },
    ];
  }

  /** @type {Record<string, string>} */
  const PAGE_LABELS = {
    "index-top.html": "TASFUL",
    "index.html": "TASFUL",
    "dashboard.html": "ダッシュボード",
    "business.html": "法人・業者・店舗",
    "shop-store.html": "TASFUL市場",
    "shop-search.html": "商品を探す",
    "shop-vendors.html": "店舗・販売",
    "shop-products.html": "商品一覧",
    "detail-shop-store.html": "店舗詳細",
    "detail-shop.html": "店舗詳細",
    "detail-shop-product.html": "商品詳細",
    "detail-shop-store-product.html": "商品詳細",
    "detail-business-service.html": "詳細",
    "detail-business.html": "詳細",
    "detail-general.html": "詳細",
    "ai-workspace.html": "TASFUL AI",
    "gen-ai-workspace.html": "TASFUL AI",
    "post.html": "掲載する",
    "edit-post.html": "掲載を編集",
    "chat-detail.html": "チャット",
    "chat-list.html": "TASFUL TALK",
    "talk-home.html": "TALK",
    "favorites-list.html": "お気に入り",
    "listing-management.html": "掲載管理",
    "my-listings.html": "マイ掲載",
    "builder/index.html": "Builder",
    "builder/builder-top.html": "Builder",
    "builder/user-dashboard.html": "ダッシュボード",
    "builder/board-projects.html": "案件を探す",
    "builder/mvp-projects.html": "案件を探す",
    "builder/board-project-detail.html": "案件詳細",
    "builder/mvp-project-detail.html": "案件詳細",
    "builder/board-thread.html": "スレッド",
    "builder/mvp-thread.html": "スレッド",
    "builder/board-threads.html": "やりとり一覧",
    "builder/mvp-threads.html": "やりとり一覧",
    "builder/mvp-project-new.html": "案件を投稿",
    "builder/construction-tools.html": "建設ツール",
    "builder/tool-manpower-calculator.html": "人工計算",
    "builder/tool-profit-calculator.html": "粗利計算",
    "builder/tool-material-calculator.html": "材料計算",
    "builder/tool-estimate-helper.html": "見積補助",
    "builder/tool-ai-estimate.html": "AI見積作成",
    "builder/tool-ai-cost-analysis.html": "AI原価分析",
    "builder/tool-ai-quantity-support.html": "AI積算補助",
    "builder/tool-ai-schedule-suggest.html": "AI工程提案",
    "builder/find-workers.html": "職人を探す",
    "builder/partner-management.html": "協力パートナー管理",
    "builder/partner-detail.html": "パートナー詳細",
    "builder-admin/admin-index.html": "運営ダッシュボード",
    "live/index.html": "LIVE",
    "live/profile.html": "クリエイタープロフィール",
    "live/settings.html": "クリエイター設定",
    "live/shorts.html": "ショートフィード",
    "live/shorts/watch.html": "ショート視聴",
    "live/short-upload.html": "ショート投稿",
    "live/videos.html": "動画一覧",
    "live/my-videos.html": "マイ動画",
    "live/admin-videos.html": "長尺動画管理",
    "live/video-upload.html": "長尺動画投稿",
    "live/watch-video.html": "動画を視聴",
    "live/watch.html": "ライブ視聴",
    "live/create.html": "配信作成",
    "live/studio.html": "配信スタジオ",
    "live/gifts.html": "ギフト",
    "live/tips.html": "応援履歴",
    "shop-market-cart.html": "カート",
    "shop-market-checkout.html": "購入手続き",
    "shop-market-order-history.html": "注文履歴",
  };

  /**
   * @param {string} href
   * @param {{ link?: Element }} [ctx]
   * @returns {string}
   */
  function resolveLabelForHref(href, ctx) {
    const full = (() => {
      try {
        const url = new URL(String(href || "").trim(), global.location?.href || "http://localhost/");
        return `${url.pathname.replace(/^\//, "")}${url.search || ""}`;
      } catch {
        return String(href || "").trim();
      }
    })();

    const linkLabel = ctx?.link?.dataset?.breadcrumbLabel;
    if (linkLabel) return String(linkLabel).trim();

    try {
      const url = new URL(String(href || "").trim(), global.location?.href || "http://localhost/");
      const pk = normalizePageKey({ pathname: url.pathname });
      const params = Object.fromEntries(url.searchParams.entries());

      if (pk === "business.html") {
        const catLabel = String(params.catLabel || "").trim();
        if (catLabel) return catLabel;
        return PAGE_LABELS[pk] || "法人・業者・店舗";
      }
      if (pk === "talk-home.html") {
        const tab = String(params.tab || "chat").toLowerCase();
        if (tab === "notify" || tab === "notifications") return "通知";
        return "TALK";
      }
      if (pk === "post.html" && params.scope === "business") return "掲載する";
      if (pk === "shop-products.html") return "商品一覧";
      if (PAGE_LABELS[pk]) return PAGE_LABELS[pk];
    } catch {
      /* ignore */
    }

    const pk = pageKeyFromHref(href).split("::")[0];
    return PAGE_LABELS[pk] || "次へ";
  }

  /**
   * @param {Location} [loc]
   */
  function resolveCurrentMeta(loc) {
    const location = loc || global.location;
    const route = resolveRoute(location);
    const pageKey = normalizePageKey(location);
    const params = new URLSearchParams(location?.search || "");
    let label = PAGE_LABELS[pageKey] || "現在地";

    if (pageKey === "business.html") {
      const catLabel = params.get("catLabel");
      if (catLabel) label = catLabel;
      else label = "法人・業者・店舗";
    } else if (pageKey === "talk-home.html") {
      const tab = String(params.get("tab") || "chat").toLowerCase();
      label = tab === "notify" || tab === "notifications" ? "通知" : "TALK";
    } else if (pageKey === "post.html" && params.get("scope") === "business") {
      label = "掲載する";
    } else if (pageKey === "shop-search.html") {
      const kw = String(params.get("keyword") || "").trim();
      label = kw ? `「${kw}」の検索結果` : "商品を探す";
    } else if (
      pageKey === "detail-business-service.html" ||
      pageKey === "detail-business.html" ||
      pageKey === "detail-general.html" ||
      pageKey === "detail-shop-product.html" ||
      pageKey === "detail-shop-store-product.html"
    ) {
      label = route?.defaultLabel || "詳細";
    } else if (pageKey === "shop-products.html") {
      label = "商品一覧";
    }

  return {
      pageKey,
      label,
      defaultLabel: route?.defaultLabel || label,
      theme: route?.theme || "platform",
      dynamic: Boolean(route?.dynamic),
      staticTrail: route?.trail || null,
    };
  }

  /** @type {Array<{ paths: string[], theme?: string, dynamic?: boolean, defaultLabel?: string, trail?: (ctx: { pageKey: string, params: URLSearchParams, loc: Location }) => BreadcrumbItem[] | null }>} */
  const ROUTES = [
    {
      paths: ["dashboard.html"],
      theme: "platform",
      defaultLabel: "ダッシュボード",
      trail: () => [{ label: "ダッシュボード" }],
    },
    {
      paths: ["favorites-list.html"],
      theme: "platform",
      defaultLabel: "お気に入り",
      trail: () => [{ label: "お気に入り", href: "favorites-list.html" }],
    },
    {
      paths: ["index-top.html", "index.html"],
      theme: "platform",
      defaultLabel: "TASFUL",
      trail: () => [{ label: "TASFUL" }],
    },
    {
      paths: ["business.html"],
      theme: "platform",
      defaultLabel: "法人・業者・店舗",
      trail: ({ params }) => businessListTrail(Object.fromEntries(params.entries())),
    },
    {
      paths: ["shop-store.html"],
      theme: "market",
      defaultLabel: "TASFUL市場",
      trail: () => [{ label: "TASFUL市場" }],
    },
    {
      paths: ["shop-search.html"],
      theme: "market",
      defaultLabel: "商品を探す",
      trail: ({ params }) => {
        const kw = String(params.get("keyword") || "").trim();
        return [
          { label: "TASFUL市場", href: SHOP_STORE },
          { label: kw ? `「${kw}」の検索結果` : "商品を探す" },
        ];
      },
    },
    {
      paths: ["shop-products.html"],
      theme: "shop",
      dynamic: true,
      defaultLabel: "商品一覧",
    },
    {
      paths: ["detail-shop-store.html", "detail-shop.html"],
      theme: "biz-detail",
      dynamic: true,
      defaultLabel: "店舗詳細",
    },
    {
      paths: ["detail-shop-product.html"],
      theme: "market",
      dynamic: true,
      defaultLabel: "商品詳細",
    },
    {
      paths: ["detail-shop-store-product.html"],
      theme: "shop",
      dynamic: true,
      defaultLabel: "商品詳細",
    },
    {
      paths: ["detail-business.html", "detail-business-service.html", "detail-general.html"],
      theme: "biz-detail",
      dynamic: true,
      defaultLabel: "詳細",
    },
    {
      paths: ["ai-workspace.html", "gen-ai-workspace.html"],
      theme: "ai",
      defaultLabel: "TASFUL AI",
      trail: () => [
        { label: "TASFUL", href: INDEX },
        { label: "TASFUL AI" },
      ],
    },
    {
      paths: ["post.html", "edit-post.html"],
      theme: "post",
      trail: ({ params }) => {
        const scope = String(params.get("scope") || "").trim();
        if (scope === "business") {
          return [
            { label: "法人・業者・店舗", href: BUSINESS },
            { label: "掲載する" },
          ];
        }
        return [{ label: "掲載する" }];
      },
    },
    {
      paths: ["chat-detail.html"],
      theme: "talk",
      dynamic: true,
      defaultLabel: "チャット",
      trail: () => [
        { label: "TALK", href: "talk-home.html?tab=chat" },
        { label: "チャット" },
      ],
    },
    {
      paths: ["chat-list.html"],
      theme: "talk",
      trail: () => [{ label: "TALK", href: "talk-home.html?tab=chat" }],
    },
    {
      paths: ["talk-home.html"],
      theme: "talk",
      trail: ({ params }) => {
        const tab = String(params.get("tab") || "chat").toLowerCase();
        if (tab === "notify" || tab === "notifications") {
          return [
            { label: "TALK", href: "talk-home.html?tab=chat" },
            { label: "通知" },
          ];
        }
        return [{ label: "TALK" }];
      },
    },
    {
      paths: ["builder/index.html", "builder/builder-top.html"],
      theme: "builder",
      trail: () => [
        { label: "TASFUL", href: "../index-top.html" },
        { label: "Builder" },
      ],
    },
    {
      paths: ["builder/user-dashboard.html"],
      theme: "builder",
      trail: () => [
        { label: "Builder", href: BUILDER_HOME },
        { label: "ダッシュボード" },
      ],
    },
    {
      paths: ["builder/board-projects.html", "builder/mvp-projects.html"],
      theme: "builder",
      trail: () => [
        { label: "Builder", href: BUILDER_HOME },
        { label: "案件を探す" },
      ],
    },
    {
      paths: ["builder/board-project-detail.html", "builder/mvp-project-detail.html"],
      theme: "builder",
      dynamic: true,
      defaultLabel: "案件詳細",
      trail: () => [
        { label: "Builder", href: BUILDER_HOME },
        { label: "案件を探す", href: "board-projects.html" },
        { label: "案件詳細" },
      ],
    },
    {
      paths: ["builder/board-thread.html", "builder/mvp-thread.html"],
      theme: "builder",
      dynamic: true,
      defaultLabel: "スレッド",
      trail: () => [
        { label: "Builder", href: BUILDER_HOME },
        { label: "やりとり", href: "board-threads.html" },
        { label: "スレッド" },
      ],
    },
    {
      paths: ["builder/board-threads.html", "builder/mvp-threads.html"],
      theme: "builder",
      trail: () => [
        { label: "Builder", href: BUILDER_HOME },
        { label: "やりとり一覧" },
      ],
    },
    {
      paths: ["builder/mvp-project-new.html"],
      theme: "builder",
      trail: () => [
        { label: "Builder", href: BUILDER_HOME },
        { label: "案件を投稿" },
      ],
    },
    {
      paths: ["builder/construction-tools.html"],
      theme: "builder",
      trail: () => [
        { label: "Builder", href: BUILDER_HOME },
        { label: "建設ツール" },
      ],
    },
    {
      paths: ["builder/tool-manpower-calculator.html"],
      theme: "builder",
      trail: () => [
        { label: "Builder", href: BUILDER_HOME },
        { label: "建設ツール", href: "construction-tools.html" },
        { label: "人工計算" },
      ],
    },
    {
      paths: ["builder/tool-profit-calculator.html"],
      theme: "builder",
      trail: () => [
        { label: "Builder", href: BUILDER_HOME },
        { label: "建設ツール", href: "construction-tools.html" },
        { label: "粗利計算" },
      ],
    },
    {
      paths: ["builder/tool-material-calculator.html"],
      theme: "builder",
      trail: () => [
        { label: "Builder", href: BUILDER_HOME },
        { label: "建設ツール", href: "construction-tools.html" },
        { label: "材料計算" },
      ],
    },
    {
      paths: ["builder/tool-estimate-helper.html"],
      theme: "builder",
      trail: () => [
        { label: "Builder", href: BUILDER_HOME },
        { label: "建設ツール", href: "construction-tools.html" },
        { label: "見積補助" },
      ],
    },
    {
      paths: ["builder/tool-ai-estimate.html"],
      theme: "builder",
      trail: () => [
        { label: "Builder", href: BUILDER_HOME },
        { label: "建設ツール", href: "construction-tools.html" },
        { label: "AI見積作成" },
      ],
    },
    {
      paths: ["builder/tool-ai-cost-analysis.html"],
      theme: "builder",
      trail: () => [
        { label: "Builder", href: BUILDER_HOME },
        { label: "建設ツール", href: "construction-tools.html" },
        { label: "AI原価分析" },
      ],
    },
    {
      paths: ["builder/tool-ai-quantity-support.html"],
      theme: "builder",
      trail: () => [
        { label: "Builder", href: BUILDER_HOME },
        { label: "建設ツール", href: "construction-tools.html" },
        { label: "AI積算補助" },
      ],
    },
    {
      paths: ["builder/tool-ai-schedule-suggest.html"],
      theme: "builder",
      trail: () => [
        { label: "Builder", href: BUILDER_HOME },
        { label: "建設ツール", href: "construction-tools.html" },
        { label: "AI工程提案" },
      ],
    },
    {
      paths: ["builder/partner-management.html"],
      theme: "builder",
      trail: () => [
        { label: "運営ダッシュボード", href: "../builder-admin/admin-index.html" },
        { label: "協力パートナー管理" },
      ],
    },
    {
      paths: ["builder/partner-detail.html"],
      theme: "builder",
      trail: ({ loc }) => {
        const mock = String(loc?.search || "").includes("mock=1") ? "?mock=1" : "";
        return [
          { label: "運営ダッシュボード", href: "../builder-admin/admin-index.html" },
          { label: "協力パートナー管理", href: `partner-management.html${mock}` },
          { label: "パートナー詳細" },
        ];
      },
    },
    {
      paths: ["live/index.html"],
      theme: "live",
      trail: () => [
        { label: "TASFUL", href: INDEX },
        { label: "LIVE" },
      ],
    },
    {
      paths: ["live/profile.html"],
      theme: "live",
      trail: () => [
        { label: "TASFUL", href: INDEX },
        { label: "LIVE", href: "index.html" },
        { label: "クリエイタープロフィール" },
      ],
    },
    {
      paths: ["live/settings.html"],
      theme: "live",
      trail: () => [
        { label: "TASFUL", href: INDEX },
        { label: "LIVE", href: "index.html" },
        { label: "クリエイター設定" },
      ],
    },
    {
      paths: ["live/shorts.html"],
      theme: "live",
      trail: () => [
        { label: "TASFUL", href: INDEX },
        { label: "LIVE", href: "index.html" },
        { label: "ショートフィード" },
      ],
    },
    {
      paths: ["live/short-upload.html"],
      theme: "live",
      trail: () => [
        { label: "TASFUL", href: INDEX },
        { label: "LIVE", href: "index.html" },
        { label: "ショートフィード", href: "shorts.html" },
        { label: "ショート投稿" },
      ],
    },
    {
      paths: ["live/videos.html", "live/watch-video.html"],
      theme: "live",
      trail: () => [
        { label: "TASFUL", href: INDEX },
        { label: "LIVE", href: "index.html" },
        { label: "動画一覧", href: "videos.html" },
      ],
    },
    {
      paths: ["live/admin-videos.html"],
      theme: "live",
      trail: () => [
        { label: "TASFUL", href: INDEX },
        { label: "LIVE", href: "index.html" },
        { label: "長尺動画管理" },
      ],
    },
    {
      paths: ["live/my-videos.html"],
      theme: "live",
      trail: () => [
        { label: "TASFUL", href: INDEX },
        { label: "LIVE", href: "index.html" },
        { label: "マイ動画" },
      ],
    },
    {
      paths: ["live/video-upload.html"],
      theme: "live",
      trail: () => [
        { label: "TASFUL", href: INDEX },
        { label: "LIVE", href: "index.html" },
        { label: "マイ動画", href: "my-videos.html" },
        { label: "長尺動画投稿" },
      ],
    },
    {
      paths: ["live/watch.html"],
      theme: "live",
      trail: () => [
        { label: "TASFUL", href: INDEX },
        { label: "LIVE", href: "index.html" },
        { label: "ライブ視聴" },
      ],
    },
    {
      paths: ["live/create.html"],
      theme: "live",
      trail: () => [
        { label: "TASFUL", href: INDEX },
        { label: "LIVE", href: "index.html" },
        { label: "配信作成" },
      ],
    },
    {
      paths: ["live/studio.html"],
      theme: "live",
      trail: () => [
        { label: "TASFUL", href: INDEX },
        { label: "LIVE", href: "index.html" },
        { label: "配信スタジオ" },
      ],
    },
    {
      paths: ["live/gifts.html"],
      theme: "live",
      trail: () => [
        { label: "TASFUL", href: INDEX },
        { label: "LIVE", href: "index.html" },
        { label: "ギフト" },
      ],
    },
    {
      paths: ["live/tips.html"],
      theme: "live",
      trail: () => [
        { label: "TASFUL", href: INDEX },
        { label: "LIVE", href: "index.html" },
        { label: "応援履歴" },
      ],
    },
    {
      paths: ["shop-market-cart.html", "shop-market-checkout.html"],
      theme: "market",
      trail: () => [
        { label: "TASFUL市場", href: SHOP_STORE },
        { label: "カート" },
      ],
    },
    {
      paths: ["shop-market-order-history.html"],
      theme: "market",
      trail: () => [
        { label: "TASFUL市場", href: SHOP_STORE },
        { label: "注文履歴" },
      ],
    },
  ];

  function resolveRoute(loc) {
    const pageKey = normalizePageKey(loc);
    const params = new URLSearchParams(loc?.search || "");
    for (const route of ROUTES) {
      if (!route.paths.includes(pageKey)) continue;
      const ctx = { pageKey, params, loc: loc || global.location };
      let trail = null;
      if (typeof route.trail === "function") {
        try {
          trail = route.trail(ctx);
        } catch {
          trail = null;
        }
      }
      return {
        pageKey,
        theme: route.theme || "platform",
        dynamic: Boolean(route.dynamic),
        defaultLabel: route.defaultLabel || PAGE_LABELS[pageKey] || null,
        trail: Array.isArray(trail) ? trail : null,
      };
    }
    return null;
  }

  global.TasuBreadcrumbConfig = {
    ROUTES,
    PAGE_LABELS,
    normalizePageKey,
    pageKeyFromHref,
    resolveRoute,
    resolveCurrentMeta,
    resolveLabelForHref,
    businessListTrail,
    INDEX,
    BUSINESS,
    SHOP_STORE,
    DASHBOARD,
  };
})(typeof window !== "undefined" ? window : globalThis);
