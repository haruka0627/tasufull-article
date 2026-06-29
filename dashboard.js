/**
 * 会員ダッシュボード UI
 */
(function () {
  "use strict";

  const DASHBOARD_JS_BUILD = "2026-06-15-sidebar-mega";

  function dashLog(label, detail) {
    const msg = `[Dashboard] ${label}`;
    if (detail !== undefined) console.log(msg, detail);
    else console.log(msg);
  }

  function updateDashboardDebug(patch) {
    const base = window.__TASU_DASHBOARD_DEBUG__ || {
      build: DASHBOARD_JS_BUILD,
      href: location.href,
      origin: location.origin,
      protocol: location.protocol,
      scriptSrc: (document.currentScript && document.currentScript.src) || "",
      page: document.body?.dataset?.page || "",
      dom: {},
      phases: {},
      errors: [],
    };
    window.__TASU_DASHBOARD_DEBUG__ = {
      ...base,
      ...patch,
      dom: { ...base.dom, ...(patch.dom || {}) },
      phases: { ...base.phases, ...(patch.phases || {}) },
      errors: patch.errors ? [...base.errors, ...patch.errors] : base.errors,
      updatedAt: new Date().toISOString(),
    };
    return window.__TASU_DASHBOARD_DEBUG__;
  }

  function probeDashboardDom() {
    return {
      hasDashContent: Boolean(document.getElementById("dashContent")),
      hasDashStats: Boolean(document.getElementById("dashStats")),
      hasDashGrid: Boolean(document.querySelector(".dash-grid")),
      hasDashQuick: Boolean(document.querySelector("[data-dash-quick]")),
      sidebarMegaTriggers: document.querySelectorAll("[data-sidebar-mega-trigger]").length,
      statsCardCount: document.querySelectorAll("#dashStats .dash-stat-card").length,
      bodyClass: document.body?.className || "",
      welcomeText: document.querySelector("[data-dash-welcome]")?.textContent?.trim() || "",
    };
  }

  dashLog("dashboard.js loaded", {
    build: DASHBOARD_JS_BUILD,
    href: location.href,
    readyState: document.readyState,
  });
  updateDashboardDebug({ phases: { scriptLoadedAt: Date.now() } });

  const NAV_GROUPS = [
    {
      label: "ダッシュボード",
      items: [{ id: "home", label: "ダッシュボード", href: "dashboard.html", icon: "layout" }],
    },
    {
      label: "サービス",
      items: [
        { id: "search", label: "業務サービスを探す", href: "business.html", icon: "search" },
        { id: "favorites", label: "お気に入り", href: "favorites-list.html", icon: "heart" },
        { id: "talk", label: "TASFUL TALK", href: "talk-home.html", icon: "message" },
        { id: "chats", label: "すべてのやりとり", href: "talk-home.html?tab=chat", icon: "inbox" },
      ],
    },
    {
      label: "取引管理",
      items: [
        { id: "ongoing", label: "進行中の取引", href: "demo-progress.html", icon: "activity", badgeKey: "ongoing" },
        { id: "completed", label: "完了した取引", href: "demo-complete.html", icon: "check", badgeKey: "completed" },
        { id: "fee-unpaid", label: "手数料未払い", href: "demo-unpaid.html", icon: "alert", badgeKey: "feeUnpaid" },
        { id: "fee-paid", label: "支払い済み履歴", href: "demo-paid.html", icon: "receipt", badgeKey: "feePaid" },
      ],
    },
    {
      label: "掲載管理",
      items: [
        { id: "listed", label: "掲載中のサービス", href: "my-listings.html", icon: "briefcase" },
        { id: "manage", label: "掲載管理", href: "listing-management.html", icon: "settings" },
        { id: "sales", label: "売上・手数料管理", href: "sales-fees.html", icon: "wallet" },
      ],
    },
    {
      label: "店舗・業務掲載",
      items: [
        { id: "bd-owner", label: "掲載管理（店舗・業務）", href: "business-directory/index.html", icon: "briefcase" },
        { id: "bd-new", label: "店舗・業務を掲載する", href: "business-directory/new.html", icon: "sparkles" },
        { id: "bd-public", label: "掲載一覧を見る", href: "business-directory/public/list.html", icon: "search" },
      ],
    },
    {
      label: "安否",
      items: [
        {
          id: "anpi-dashboard",
          label: "安否ダッシュボード",
          href: "anpi-dashboard.html",
          icon: "layout",
        },
        {
          id: "anpi-register",
          label: "安否サービス登録",
          href: "anpi-register.html",
          icon: "user",
        },
        {
          id: "anpi",
          label: "安否通知センター",
          href: "anpi-notifications.html",
          icon: "bell",
        },
      ],
    },
    {
      label: "アカウント",
      items: [
        { id: "profile", label: "プロフィール設定", href: "profile-settings.html", icon: "user" },
        { id: "payment", label: "支払い方法・口座管理", href: "payment-settings.html", icon: "credit" },
        { id: "notify", label: "通知設定", href: "notification-settings.html", icon: "bell" },
        { id: "logout", label: "ログアウト", href: "index-top.html", icon: "log-out" },
      ],
    },
  ];

  const ICONS = {
    layout: '<path d="M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
    message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8H8"/><path d="M16 12H8"/><path d="M16 16H8"/>',
    briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>',
    inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    wallet: '<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    credit: '<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>',
    bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    "log-out": '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    store: '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M10 12h4"/>',
    package: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    shopping: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
    clipboard: '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
    sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>',
    grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
  };

  const SIDEBAR_SERVICE_GROUP_LABEL = "サービス";

  const SERVICE_MEGA_SECTIONS = [
    {
      id: "explore",
      label: "探す",
      items: [
        { label: "業務サービスを探す", href: "business.html", icon: "briefcase" },
        { label: "スキルを探す", href: "index.html?category=skill", icon: "sparkles" },
        { label: "ワーカーを探す", href: "index.html?category=worker", icon: "users" },
        { label: "商品を探す", href: "index.html?category=product", icon: "shopping" },
        { label: "TASFUL市場を見る", href: "shop-store.html", icon: "store" },
        { label: "店舗・専門店を探す", href: "shop-vendors.html", icon: "store" },
        { label: "求人を探す", href: "job-top.html", icon: "clipboard" },
        { label: "案件・求人ボード", href: "public-board.html", icon: "grid" },
      ],
    },
    {
      id: "publish",
      label: "掲載・出品",
      items: [
        { label: "掲載管理", href: "listing-management.html", icon: "settings" },
        { label: "業務サービス掲載", href: "post.html?scope=business", icon: "briefcase" },
        { label: "スキル等を掲載", href: "post.html", icon: "sparkles" },
        { label: "市場に出品", href: "shop-market-listing-new.html", icon: "upload" },
      ],
    },
    {
      id: "comms",
      label: "やりとり",
      items: [
        { label: "TASFUL TALK", href: "talk-home.html", icon: "message" },
        { label: "すべてのやりとり", href: "talk-home.html?tab=chat", icon: "inbox" },
        { label: "AI相談", href: "ai-workspace.html", icon: "sparkles" },
      ],
    },
  ];

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function icon(name) {
    const path = ICONS[name] || ICONS.layout;
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
  }

  function formatYen(n) {
    return window.TasuDashboardData?.formatYen?.(n) || `¥${n}`;
  }

  const MEMBER_PAGES = new Set([
    "dashboard",
    "profile-settings",
    "profile-edit",
    "tasful-notification-settings",
    "account-settings",
    "payment-settings",
    "notification-settings",
    "my-listings",
    "listing-management",
    "anpi-notifications",
    "anpi-register",
    "anpi-dashboard",
    "sales-fees",
    "demo-progress",
    "demo-complete",
    "demo-paid",
    "demo-unpaid",
  ]);

  const DEMO_PAGES = new Set([
    "demo-progress",
    "demo-complete",
    "demo-paid",
    "demo-unpaid",
  ]);

  const LOGOUT_REDIRECT = "index-top.html";

  function isNavItemActive(item, path, hash) {
    const rawHref = String(item.href || "");
    const hrefPath = rawHref.split("#")[0].split("?")[0].replace(/^\.\//, "") || "dashboard.html";
    const hrefHash = rawHref.includes("#") ? rawHref.slice(rawHref.indexOf("#")) : "";

    if (item.id === "home") {
      return path === "dashboard.html" && (!hash || hash === "#" || hash === "#dash-ongoing");
    }
    if (item.id === "profile") return path === "profile-settings.html";
    if (item.id === "payment") {
      return path === "payment-settings.html" || path === "account-settings.html";
    }
    if (item.id === "favorites") return path === "favorites-list.html";
    if (item.id === "talk") return path === "talk-home.html";
    if (item.id === "chats") {
      return path === "talk-home.html" || path === "chat-list.html";
    }
    if (item.id === "listed") return path === "my-listings.html";
    if (item.id === "manage") return path === "listing-management.html";
    if (item.id === "sales") return path === "sales-fees.html";
    if (item.id === "ongoing") return path === "demo-progress.html";
    if (item.id === "completed") return path === "demo-complete.html";
    if (item.id === "fee-unpaid") return path === "demo-unpaid.html";
    if (item.id === "fee-paid") return path === "demo-paid.html";
    if (item.id === "anpi-dashboard") return path === "anpi-dashboard.html";
    if (item.id === "anpi-register") return path === "anpi-register.html";
    if (item.id === "anpi") return path === "anpi-notifications.html";
    if (item.id === "notify") {
      return (
        path === "notification-settings.html" ||
        (path === "account-settings.html" && hash === "#notifications")
      );
    }
    if (hrefHash) {
      return path === hrefPath && hash === hrefHash;
    }
    return path === hrefPath;
  }

  const ANPI_NAV_GROUP_LABEL = "安否";

  function getAnpiBadgeState() {
    return window.TasuAnpiNotificationBadge?.getAnpiBadgeState?.() || {
      registered: false,
      unread_count: 0,
      urgent_count: 0,
      unread_urgent_count: 0,
    };
  }

  function renderAnpiNavBadges(anpiState) {
    const render = window.TasuAnpiNotificationBadge?.renderBadgeHtml;
    if (!render || !anpiState?.registered) return "";
    return render(anpiState, { forNav: true, prioritySingle: true });
  }

  function renderSidebar(stats, anpiState) {
    const nav = $("#dashSidebarNav");
    if (!nav) return;

    closeSidebarMegaMenu();

    const path = location.pathname.split("/").pop() || "dashboard.html";
    const hash = location.hash;
    const anpi = anpiState || getAnpiBadgeState();

    nav.innerHTML = NAV_GROUPS.map((group) => {
      const isAnpiGroup = group.label === ANPI_NAV_GROUP_LABEL;
      const isServiceGroup = group.label === SIDEBAR_SERVICE_GROUP_LABEL;
      const groupBadges = isAnpiGroup ? renderAnpiNavBadges(anpi) : "";

      const items = group.items
        .map((item) => {
          const isActive = isNavItemActive(item, path, hash);
          let badge =
            item.badgeKey && stats[item.badgeKey] > 0
              ? `<span class="dash-nav-badge">${stats[item.badgeKey] > 99 ? "99+" : stats[item.badgeKey]}</span>`
              : "";
          if (item.id === "anpi" || item.id === "anpi-dashboard") {
            const itemBadges = renderAnpiNavBadges(anpi);
            if (itemBadges) badge = itemBadges;
          }
          if (item.id === "logout") {
            return `<a class="dash-nav-link" href="${esc(LOGOUT_REDIRECT)}" data-dash-logout>${icon(item.icon)}<span>${esc(item.label)}</span></a>`;
          }
          const megaAttrs = isServiceGroup
            ? ` data-sidebar-mega-trigger aria-haspopup="true" aria-expanded="false" aria-controls="dashSidebarMegaPanel"`
            : "";
          return `<a class="dash-nav-link${isActive ? " is-active" : ""}" href="${esc(item.href)}" data-breadcrumb-label="${esc(item.label)}"${megaAttrs}>${icon(item.icon)}<span class="dash-nav-link__text">${esc(item.label)}</span>${badge}</a>`;
        })
        .join("");
      const groupAttrs = isServiceGroup ? ` data-sidebar-service-group` : "";
      const groupClass = isServiceGroup ? " dash-nav-group--service-mega" : "";
      return `<div class="dash-nav-group${groupClass}"${groupAttrs}><p class="dash-nav-group__label">${esc(group.label)}${groupBadges}</p>${items}</div>`;
    }).join("");
    bindLogout();
    if (isSidebarMegaHoverMode()) ensureSidebarMegaHoverSurface();
  }

  function bindLogout() {
    document.querySelectorAll("[data-dash-logout]").forEach((link) => {
      if (link.dataset.dashLogoutBound === "1") return;
      link.dataset.dashLogoutBound = "1";
      link.addEventListener("click", (event) => {
        event.preventDefault();
        void performLogout();
      });
    });
  }

  async function performLogout() {
    if (window.TasuMemberAuth?.logout) {
      await window.TasuMemberAuth.logout({ redirect: LOGOUT_REDIRECT });
      return;
    }
    location.replace(LOGOUT_REDIRECT);
  }

  function renderStats(stats) {
    const host = $("#dashStats");
    if (!host) return;

    const cards = [
      { key: "ongoing", label: "進行中の取引", tone: "blue", href: "demo-progress.html", icon: "activity" },
      { key: "completed", label: "完了した取引", tone: "green", href: "demo-complete.html", icon: "check" },
      { key: "feeUnpaid", label: "手数料未払い", tone: "amber", href: "demo-unpaid.html", icon: "alert" },
      { key: "feePaid", label: "支払い済み", tone: "purple", href: "demo-paid.html", icon: "receipt" },
    ];

    host.innerHTML = cards
      .map(
        (c) => `
      <a class="dash-stat-card dash-stat-card--${c.tone}" href="${esc(c.href)}">
        <div class="dash-stat-card__icon">${icon(c.icon)}</div>
        <p class="dash-stat-card__label">${esc(c.label)}</p>
        <p class="dash-stat-card__value">${stats[c.key] || 0}<small> 件</small></p>
        <span class="dash-stat-card__link">一覧を見る →</span>
      </a>`
      )
      .join("");
  }

  function renderOngoing(rows) {
    const host = $("[data-dash-ongoing-list]");
    if (!host) return;

    const list = Array.isArray(rows) ? rows : [];

    if (!list.length) {
      host.innerHTML =
        '<p class="dash-empty">現在進行中の取引はありません</p>';
      return;
    }

    host.innerHTML = list
      .slice(0, 8)
      .map(
        (r) => `
      <a class="dash-tx-row" href="${esc(r.href)}">
        <img class="dash-tx-row__thumb" src="${esc(r.image)}" alt="" width="72" height="72" loading="lazy">
        <div class="dash-tx-row__main">
          <p class="dash-tx-row__title">${esc(r.title)}</p>
          <p class="dash-tx-row__meta">${esc(r.category)} ・ ${esc(r.partnerName)}</p>
          <p class="dash-tx-row__meta">最終: ${esc(r.lastMessageAt || "—")}</p>
        </div>
        <div class="dash-tx-row__right">
          <span class="dash-badge ${esc(r.statusClass)}">${esc(r.statusLabel)}</span>
          <span class="dash-tx-row__chevron" aria-hidden="true">›</span>
        </div>
      </a>`
      )
      .join("");
  }

  function renderNotices(notices) {
    const host = $("[data-dash-notices]");
    if (!host) return;
    if (!notices?.length) {
      host.innerHTML = '<p class="dash-empty">現在お知らせはありません</p>';
      return;
    }
    host.innerHTML = (notices || [])
      .map(
        (n) => `
      <div class="dash-notice">
        <div class="dash-notice__content">
          <span class="dash-notice__tag ${esc(n.tagClass)}">${esc(n.tag)}</span>
          <p class="dash-notice__title">${esc(n.title)}</p>
        </div>
        <time class="dash-notice__date" datetime="">${esc(n.date)}</time>
      </div>`
      )
      .join("");
  }

  function renderFeePanel(data) {
    const host = $("[data-dash-fee-panel]");
    if (!host) return;

    const { stats, firstUnpaidPayUrl, unpaidDeals } = data;
    const unpaidLabel = formatYen(stats.unpaidTotal);
    const paidMonth = formatYen(stats.paidThisMonth);

    const payBtn = firstUnpaidPayUrl
      ? `<a class="dash-btn dash-btn--gold" href="${esc(firstUnpaidPayUrl)}">手数料を支払う</a>`
      : `<button type="button" class="dash-btn dash-btn--gold" disabled>手数料を支払う</button>`;

    host.innerHTML = `
      <div class="dash-fee-panel">
        <div class="dash-fee-top">
          <div class="dash-fee-top__amount">
            <p class="dash-fee-summary__label">未払い合計</p>
            <p class="dash-fee-summary__amount">${unpaidLabel}</p>
          </div>
          <div class="dash-fee-top__action">${payBtn}</div>
        </div>
        <p class="dash-fee-summary__sub">今月の支払い済み: ${esc(paidMonth)}</p>
        <div class="dash-fee-history-row">
          <a class="dash-fee-history-link" href="#dash-fees" data-dash-fee-history>支払い履歴を見る →</a>
        </div>
        ${
          Array.isArray(unpaidDeals) && unpaidDeals.length
            ? `<ul class="dash-fee-list">
            ${unpaidDeals
              .slice(0, 3)
              .map(
                (d) =>
                  `<li><a href="service-fee-pay.html?deal=${encodeURIComponent(d.id)}">${esc(d.id)}</a> — ${formatYen((window.TasuServiceDealsDb?.resolveDealFees?.(d) || d).platform_fee_amount)}</li>`
              )
              .join("")}
          </ul>`
            : ""
        }
      </div>`;
  }

  function renderSidebarMegaPanelHtml() {
    const columns = SERVICE_MEGA_SECTIONS.map(
      (section) => `
      <div class="dash-sidebar-mega__col">
        <h3 class="dash-sidebar-mega__heading">${esc(section.label)}</h3>
        <ul class="dash-sidebar-mega__list">
          ${section.items
            .map(
              (item) => `
            <li>
              <a class="dash-sidebar-mega__link" href="${esc(item.href)}" data-breadcrumb-label="${esc(item.label)}">
                <span class="dash-sidebar-mega__link-icon">${icon(item.icon)}</span>
                <span class="dash-sidebar-mega__link-label">${esc(item.label)}</span>
              </a>
            </li>`
            )
            .join("")}
        </ul>
      </div>`
    );

    return `<div class="dash-sidebar-mega__inner"><div class="dash-sidebar-mega__grid">${columns.join("")}</div></div>`;
  }

  function ensureSidebarMegaHost() {
    let host = document.querySelector("[data-sidebar-mega-host]");
    if (!host) {
      host = document.createElement("div");
      host.className = "dash-sidebar-mega-host";
      host.dataset.sidebarMegaHost = "";
      document.body.appendChild(host);
    } else if (host.parentElement !== document.body) {
      document.body.appendChild(host);
    }
    if (!host.querySelector("[data-sidebar-mega-panel]")) {
      host.innerHTML = `
        <div
          class="dash-sidebar-mega"
          id="dashSidebarMegaPanel"
          data-sidebar-mega-panel
          role="region"
          aria-label="サービスメニュー"
          aria-hidden="true"
          hidden
        ></div>`;
    }
    return host;
  }

  function getSidebarMegaPanelEl() {
    return document.querySelector("[data-sidebar-mega-panel]");
  }

  let sidebarMegaOpen = false;
  let sidebarMegaLastTrigger = null;

  let sidebarMegaCloseTimer = null;
  let sidebarMegaPointer = { x: 0, y: 0 };

  function isSidebarMegaHoverMode() {
    try {
      return window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 1025px)").matches;
    } catch {
      return window.innerWidth >= 1025;
    }
  }

  function getSidebarMegaHoverRoots() {
    return [
      document.querySelector("[data-sidebar-service-group]"),
      document.querySelector("[data-sidebar-mega-host]"),
    ].filter(Boolean);
  }

  function cancelSidebarMegaClose() {
    if (sidebarMegaCloseTimer) {
      clearTimeout(sidebarMegaCloseTimer);
      sidebarMegaCloseTimer = null;
    }
  }

  function isPointerInsideSidebarMega() {
    const el = document.elementFromPoint(sidebarMegaPointer.x, sidebarMegaPointer.y);
    if (!el) return false;
    return getSidebarMegaHoverRoots().some((root) => root.contains(el));
  }

  function scheduleSidebarMegaClose(forceClose = false) {
    cancelSidebarMegaClose();
    sidebarMegaCloseTimer = setTimeout(() => {
      sidebarMegaCloseTimer = null;
      if (!forceClose && isPointerInsideSidebarMega()) return;
      closeSidebarMegaMenu();
    }, forceClose ? 0 : 140);
  }

  function clearSidebarMegaActive() {
    document.querySelectorAll("[data-sidebar-mega-trigger]").forEach((el) => {
      el.classList.remove("is-mega-open");
      el.setAttribute("aria-expanded", "false");
    });
  }

  function positionSidebarMegaPanel(trigger, panel) {
    const sidebarW = 260;
    const rootStyles = getComputedStyle(document.documentElement);
    const cssSidebarW = parseInt(rootStyles.getPropertyValue("--dash-sidebar-w") || "260", 10);
    const baseLeft = (Number.isFinite(cssSidebarW) ? cssSidebarW : sidebarW) + 12;
    const panelWidth = Math.min(860, Math.max(720, window.innerWidth - baseLeft - 16));
    const rect = trigger.getBoundingClientRect();
    const feeTop = document.querySelector("#dash-fees")?.getBoundingClientRect()?.top;
    const disclaimerTop = document.querySelector(".dash-disclaimer")?.getBoundingClientRect()?.top;

    panel.style.width = `${panelWidth}px`;
    panel.style.left = `${baseLeft}px`;
    panel.style.top = `${Math.max(16, rect.top - 8)}px`;

    requestAnimationFrame(() => {
      const panelRect = panel.getBoundingClientRect();
      const height = panelRect.height || panel.offsetHeight || 320;
      let top = Math.max(16, rect.top - 8);
      const maxBottom = Math.min(
        feeTop ?? window.innerHeight - 16,
        disclaimerTop ?? window.innerHeight - 16,
        window.innerHeight - 16
      );
      if (top + height > maxBottom) {
        top = Math.max(16, maxBottom - height);
      }
      if (top + height > window.innerHeight - 16) {
        top = Math.max(16, window.innerHeight - height - 16);
      }
      panel.style.top = `${top}px`;
    });
  }

  function closeSidebarMegaMenu() {
    const panel = getSidebarMegaPanelEl();
    const host = document.querySelector("[data-sidebar-mega-host]");
    if (!panel) return;

    cancelSidebarMegaClose();
    panel.classList.remove("is-open");
    panel.setAttribute("hidden", "");
    panel.setAttribute("aria-hidden", "true");
    panel.innerHTML = "";
    if (host) host.classList.remove("is-open");
    clearSidebarMegaActive();
    sidebarMegaOpen = false;
    sidebarMegaLastTrigger = null;
  }

  function openSidebarMegaMenu(trigger) {
    if (!isSidebarMegaHoverMode()) return;
    const panel = getSidebarMegaPanelEl();
    const host = ensureSidebarMegaHost();
    if (!panel || !trigger) return;

    if (sidebarMegaOpen && sidebarMegaLastTrigger === trigger) return;

    sidebarMegaOpen = true;
    sidebarMegaLastTrigger = trigger;

    panel.innerHTML = renderSidebarMegaPanelHtml();
    panel.classList.add("is-open");
    panel.removeAttribute("hidden");
    panel.setAttribute("aria-hidden", "false");
    host.classList.add("is-open");

    clearSidebarMegaActive();
    trigger.classList.add("is-mega-open");
    trigger.setAttribute("aria-expanded", "true");

    positionSidebarMegaPanel(trigger, panel);
  }

  function ensureSidebarMegaHoverSurface() {
    const serviceGroup = document.querySelector("[data-sidebar-service-group]");
    const host = ensureSidebarMegaHost();
    [serviceGroup, host].forEach((surface) => {
      if (!surface || surface.dataset.sidebarMegaSurfaceBound) return;
      surface.dataset.sidebarMegaSurfaceBound = "1";
      surface.addEventListener("mouseenter", () => {
        if (!isSidebarMegaHoverMode()) return;
        cancelSidebarMegaClose();
      });
      surface.addEventListener("mouseleave", (event) => {
        if (!isSidebarMegaHoverMode()) return;
        const related = event.relatedTarget;
        if (related instanceof Node && getSidebarMegaHoverRoots().some((root) => root.contains(related))) {
          return;
        }
        sidebarMegaPointer = { x: event.clientX, y: event.clientY };
        scheduleSidebarMegaClose(true);
      });
    });
  }

  function bindSidebarMegaMenu() {
    if (window.__tasuDashSidebarMegaBound) return;
    window.__tasuDashSidebarMegaBound = true;
    ensureSidebarMegaHost();

    document.addEventListener(
      "mousemove",
      (event) => {
        sidebarMegaPointer = { x: event.clientX, y: event.clientY };
        if (!isSidebarMegaHoverMode() || !sidebarMegaOpen) return;
        if (isPointerInsideSidebarMega()) {
          cancelSidebarMegaClose();
          return;
        }
        scheduleSidebarMegaClose();
      },
      { passive: true }
    );

    document.addEventListener(
      "mouseover",
      (event) => {
        if (!isSidebarMegaHoverMode()) return;
        const trigger = event.target.closest("[data-sidebar-mega-trigger]");
        if (!trigger) return;
        cancelSidebarMegaClose();
        openSidebarMegaMenu(trigger);
      },
      false
    );

    document.addEventListener("focusin", (event) => {
      if (!isSidebarMegaHoverMode()) return;
      const trigger = event.target.closest?.("[data-sidebar-mega-trigger]");
      if (trigger) openSidebarMegaMenu(trigger);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && sidebarMegaOpen) {
        event.preventDefault();
        closeSidebarMegaMenu();
      }
    });

    window.addEventListener("resize", () => {
      if (!sidebarMegaOpen || !sidebarMegaLastTrigger) return;
      const panel = getSidebarMegaPanelEl();
      if (!panel || panel.hasAttribute("hidden")) return;
      if (isSidebarMegaHoverMode()) {
        positionSidebarMegaPanel(sidebarMegaLastTrigger, panel);
      } else {
        closeSidebarMegaMenu();
      }
    });
  }

  function safeBindSidebarMegaMenu() {
    try {
      bindSidebarMegaMenu();
      ensureSidebarMegaHoverSurface();
    } catch (err) {
      console.error("[Dashboard] bindSidebarMegaMenu failed:", err);
    }
  }

  function initDashboardServiceUi() {
    dashLog("initDashboardServiceUi start");
    updateDashboardDebug({ phases: { initDashboardServiceUiStart: Date.now() }, dom: probeDashboardDom() });
    safeBindSidebarMegaMenu();
    dashLog("initDashboardServiceUi end", probeDashboardDom());
    updateDashboardDebug({ phases: { initDashboardServiceUiEnd: Date.now() }, dom: probeDashboardDom() });
  }

  function isDashboardMobileShell() {
    try {
      return window.matchMedia("(max-width: 960px)").matches;
    } catch {
      return false;
    }
  }

  function syncDashboardLayout(data) {
    const mobileShell = isDashboardMobileShell();
    updateDashboardDebug({
      phases: { syncDashboardLayoutAt: Date.now() },
      mobileShell,
      bodyHasMobileClass: document.body.classList.contains("tasu-app-mobile-page"),
    });

    if (!mobileShell) {
      document.body.classList.remove("tasu-app-mobile-page");
      const mobileHome = $("[data-tasu-mobile-home]");
      if (mobileHome) mobileHome.classList.add("tasu-mobile-home--hidden");
    } else {
      void window.TasuDashboardMobileHome?.renderMobileHome?.(data, 0);
    }

    const statsCards = document.querySelectorAll("#dashStats .dash-stat-card").length;
    if (!mobileShell && statsCards === 0 && data) {
      dashLog("syncDashboardLayout retry renderDashboardMainContent");
      const navStats =
        window.TasuDemoDeals?.getNavStats?.() ||
        window.TasuDemoDealsData?.getNavStats?.() ||
        data.stats ||
        {};
      renderDashboardMainContent(data, navStats);
    }

    updateDashboardDebug({ dom: probeDashboardDom() });
  }

  function renderDashboardMainContent(data, navStats) {
    dashLog("renderDashboardMainContent start");
    updateDashboardDebug({ phases: { renderDashboardMainContentStart: Date.now() }, dom: probeDashboardDom() });

    const demoStats =
      window.TasuDemoDeals?.getNavStats?.() ||
      window.TasuDemoDealsData?.getNavStats?.() ||
      navStats ||
      data?.stats ||
      {};

    try {
      renderStats(demoStats);
    } catch (err) {
      console.error("[Dashboard] renderStats failed:", err);
      updateDashboardDebug({ errors: [{ phase: "renderStats", message: String(err) }] });
    }

    try {
      renderOngoing(data?.ongoingRows);
    } catch (err) {
      console.error("[Dashboard] renderOngoing failed:", err);
      updateDashboardDebug({ errors: [{ phase: "renderOngoing", message: String(err) }] });
    }

    try {
      renderNotices(data?.notices);
    } catch (err) {
      console.error("[Dashboard] renderNotices failed:", err);
      updateDashboardDebug({ errors: [{ phase: "renderNotices", message: String(err) }] });
    }

    try {
      renderFeePanel(data || { stats: demoStats, unpaidDeals: [] });
    } catch (err) {
      console.error("[Dashboard] renderFeePanel failed:", err);
      updateDashboardDebug({ errors: [{ phase: "renderFeePanel", message: String(err) }] });
    }

    dashLog("renderDashboardMainContent end", probeDashboardDom());
    updateDashboardDebug({ phases: { renderDashboardMainContentEnd: Date.now() }, dom: probeDashboardDom() });
  }

  function renderAnpiUrgentAlert(anpiState) {
    const host = $("[data-dash-anpi-urgent-host]");
    if (!host) return;
    const anpi = anpiState || getAnpiBadgeState();
    const render = window.TasuAnpiNotificationBadge?.renderUrgentAlertHtml;
    const html = render?.(anpi) || "";
    if (html) {
      host.innerHTML = html;
      host.hidden = false;
    } else {
      host.innerHTML = "";
      host.hidden = true;
    }
  }

  function renderAnpiLineFailureAlert() {
    const host = $("[data-dash-anpi-line-fail-host]");
    if (!host) return;
    const summary = window.TasuAnpiNotificationBadge?.getLineFailureSummary?.() || {
      failed_count: 0,
    };
    const html = window.TasuAnpiNotificationBadge?.renderLineFailureAlertHtml?.(summary) || "";
    if (html) {
      host.innerHTML = html;
      host.hidden = false;
    } else {
      host.innerHTML = "";
      host.hidden = true;
    }
  }

  function renderAnpiLineAdminUi() {
    void window.TasuAnpiLineAdmin?.renderInto?.(
      "[data-dash-anpi-line-admin]",
      "[data-dash-anpi-line-mode]"
    );
  }

  function refreshAnpiShellUi(navStats) {
    const anpiState = getAnpiBadgeState();
    try {
      renderSidebar(navStats, anpiState);
    } catch (err) {
      console.error("[Dashboard] renderSidebar failed:", err);
    }
    if (document.body?.dataset?.page !== "dashboard") return anpiState;

    try {
      renderAnpiUrgentAlert(anpiState);
      renderAnpiLineFailureAlert();
      renderAnpiLineAdminUi();
    } catch (err) {
      console.error("[Dashboard] anpi shell ui failed:", err);
    }
    return anpiState;
  }

  function refreshAnpiDashboardUi(navStats) {
    return refreshAnpiShellUi(navStats);
  }

  function bindAnpiNotificationListeners(navStats) {
    if (window.__tasuDashAnpiListenersBound) return;
    window.__tasuDashAnpiListenersBound = true;
    const refresh = () => refreshAnpiDashboardUi(navStats);
    [
      "tasu:anpi-notification-log-created",
      "tasu:anpi-notification-read",
      "tasu:anpi-notification-bulk-read",
      "tasful:anpi-notification-created",
      "tasful:anpi-notification-updated",
      "tasu:anpi-notification-line-sent",
      "tasful:anpi-notification-line-sent",
      "tasu:anpi-notification-updated",
      "tasu:anpi-line-send-failed",
      "tasful:anpi-line-send-failed",
      "tasu:anpi-line-send-retried",
      "tasful:anpi-line-send-retried",
      "tasu:anpi-line-oauth-unlinked",
      "tasful:anpi-line-oauth-unlinked",
    ].forEach((name) => {
      document.addEventListener(name, refresh);
      window.addEventListener(name, refresh);
    });
  }

  function bindDrawer() {
    const sidebar = $("#dashSidebar");
    const overlay = $("[data-dash-overlay]");
    const menuBtn = $("[data-dash-menu]");

    function close() {
      sidebar?.classList.remove("is-open");
      overlay?.classList.remove("is-visible");
    }
    function open() {
      sidebar?.classList.add("is-open");
      overlay?.classList.add("is-visible");
    }

    menuBtn?.addEventListener("click", () => {
      if (sidebar?.classList.contains("is-open")) close();
      else open();
    });
    overlay?.addEventListener("click", close);
    window.addEventListener("resize", () => {
      if (window.innerWidth > 768) close();
    });
  }

  function updateHeader(data) {
    const profile = data.profile || {};
    const welcomeName =
      profile.welcomeName ||
      window.TasuDashboardData?.pickWelcomeName?.({
        nickname: profile.nickname,
        display_name: profile.display_name || profile.displayName,
        name: profile.name,
      }) ||
      "";
    const label = welcomeName || "あなた";
    const headerName = welcomeName || "会員";
    const welcome = $("[data-dash-welcome]");
    if (welcome) {
      welcome.innerHTML = `<span class="dash-welcome__title">ようこそ、<strong>${esc(label)}</strong>さん</span><span class="dash-welcome__sub">あなたの取引状況を確認できます</span>`;
    }
    const avatarUrl =
      profile.avatarUrl ||
      window.TasuMemberProfile?.getStoredAvatarUrl?.() ||
      "";
    const avatar = $("[data-dash-avatar]");
    if (avatar) {
      avatar.src = window.TasuMemberProfile?.resolveDisplayUrl?.(avatarUrl) || avatarUrl || avatar.src;
      avatar.alt = headerName;
    }
    const userName = $("[data-dash-user-name]");
    if (userName) userName.textContent = headerName;

    const msgBadge = $("[data-dash-msg-badge]");
    if (msgBadge) {
      const n = data.unreadMessages || 0;
      if (n > 0) {
        msgBadge.hidden = false;
        msgBadge.textContent = n > 99 ? "99+" : String(n);
      } else {
        msgBadge.hidden = true;
      }
    }

    const noticeBadge = $("[data-dash-notice-badge]");
    if (noticeBadge) {
      const n = (data.notices || []).length;
      noticeBadge.textContent = String(n);
      noticeBadge.hidden = n === 0;
    }
  }

  async function initMemberShell() {
    dashLog("initMemberShell start", { href: location.href });
    updateDashboardDebug({ phases: { initMemberShellStart: Date.now() }, dom: probeDashboardDom() });
    bindDrawer();
    let data;
    try {
      data = await window.TasuDashboardData.loadDashboard();
    } catch (err) {
      console.error("[Dashboard] loadDashboard failed:", err);
      updateDashboardDebug({ errors: [{ phase: "loadDashboard", message: String(err) }] });
      throw err;
    }
    updateHeader(data);
    const navStats =
      window.TasuDemoDeals?.getNavStats?.() ||
      window.TasuDemoDealsData?.getNavStats?.() ||
      data.stats;
    bindAnpiNotificationListeners(navStats);
    window.TasuAnpiLineAdmin?.bindRefresh?.(
      "[data-dash-anpi-line-admin]",
      "[data-dash-anpi-line-mode]"
    );
    try {
      refreshAnpiShellUi(navStats);
    } catch (err) {
      console.error("[Dashboard] refreshAnpiShellUi failed:", err);
      updateDashboardDebug({ errors: [{ phase: "refreshAnpiShellUi", message: String(err) }] });
    }
    dashLog("initMemberShell end", probeDashboardDom());
    updateDashboardDebug({ phases: { initMemberShellEnd: Date.now() }, dom: probeDashboardDom() });
    return data;
  }

  async function initDashboardPage(data) {
    const navStats =
      window.TasuDemoDeals?.getNavStats?.() ||
      window.TasuDemoDealsData?.getNavStats?.() ||
      data?.stats ||
      {};

    renderDashboardMainContent(data, navStats);
    initDashboardServiceUi();

    try {
      await window.TasuDashboardMobileHome?.initMobileHome?.(data);
    } catch (err) {
      console.error("[Dashboard] initMobileHome failed:", err);
      updateDashboardDebug({ errors: [{ phase: "initMobileHome", message: String(err) }] });
    }

    try {
      window.TasufulAppMobile?.init?.({ active: "home" });
    } catch (err) {
      console.error("[Dashboard] TasufulAppMobile.init failed:", err);
      updateDashboardDebug({ errors: [{ phase: "TasufulAppMobile.init", message: String(err) }] });
    }

    syncDashboardLayout(data);
  }

  async function init() {
    const page = document.body?.dataset?.page;
    dashLog("init start", { page, build: DASHBOARD_JS_BUILD });
    updateDashboardDebug({ page, phases: { initStart: Date.now() }, dom: probeDashboardDom() });

    if (!MEMBER_PAGES.has(page)) {
      dashLog("init skipped — not a member page", page);
      return;
    }

    if (window.TasuMemberAuth?.isAuthenticatedSync?.()) {
      window.TasuMemberAuth.syncLastProfileFromSession?.();
    } else if (window.TasuMemberAuth?.isAuthenticated) {
      const authed = await window.TasuMemberAuth.isAuthenticated();
      if (!authed) {
        dashLog("init stopped — not authenticated");
        updateDashboardDebug({ phases: { initStoppedAuth: Date.now() } });
        return;
      }
      window.TasuMemberAuth.syncLastProfileFromSession?.();
    }

    let data = null;

    try {
      if (DEMO_PAGES.has(page)) {
        bindDrawer();
        data = await window.TasuDashboardData.loadDashboard();
        updateHeader(data);
        renderSidebar(
          window.TasuDemoDeals?.getNavStats?.() ||
            window.TasuDemoDealsData?.getNavStats?.() ||
            window.TasuDemoDealsData?.NAV_STATS ||
            {}
        );
        window.TasuDemoDeals?.init(page);
        return;
      }

      try {
        data = await initMemberShell();
      } catch (err) {
        console.error("[Dashboard] initMemberShell failed:", err);
        updateDashboardDebug({ errors: [{ phase: "initMemberShell", message: String(err) }] });
      }

      if (page === "dashboard") {
        await initDashboardPage(data || { stats: {}, ongoingRows: [], notices: [] });
      }
    } catch (err) {
      console.error("[Dashboard] init failed:", err);
      updateDashboardDebug({ errors: [{ phase: "init", message: String(err) }] });
      const welcome = $("[data-dash-welcome]");
      if (welcome) welcome.textContent = "ダッシュボードの読み込みに失敗しました。";
    } finally {
      if (page === "dashboard") {
        const dom = probeDashboardDom();
        if (!isDashboardMobileShell() && dom.statsCardCount === 0) {
          dashLog("init finally — main content empty, retrying");
          try {
            const fallback =
              data ||
              (await window.TasuDashboardData?.loadDashboard?.().catch(() => null)) ||
              { stats: {}, ongoingRows: [], notices: [] };
            renderDashboardMainContent(fallback, fallback.stats || {});
            syncDashboardLayout(fallback);
          } catch (err) {
            console.error("[Dashboard] init finally retry failed:", err);
          }
        }
      }
      dashLog("init end", probeDashboardDom());
      updateDashboardDebug({ phases: { initEnd: Date.now() }, dom: probeDashboardDom() });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void init());
  } else {
    void init();
  }

  window.TasuDashboardShell = {
    renderSidebar,
    refreshAnpiDashboardUi,
    refreshAnpiShellUi,
    renderDashboardMainContent,
    initDashboardServiceUi,
    initDashboardPage,
    syncDashboardLayout,
    getAnpiBadgeState,
    DASHBOARD_JS_BUILD,
    getDebugState: () => window.__TASU_DASHBOARD_DEBUG__,
  };
})();
