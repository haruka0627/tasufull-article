/**
 * TASFUL LIVE / TLV — PC・スマホ別ナビ（Phase 7）
 * MATCH / MARKET の汎用モバイルタブとは別実装。
 */
(function (global) {
  "use strict";

  const MOBILE_TABS = Object.freeze([
    { id: "home", label: "ホーム", href: "../dashboard.html", icon: "⌂" },
    { id: "talk", label: "トーク", href: "../talk-home.html?tab=chat", icon: "💬" },
    { id: "live", label: "ライブ", href: "index.html", icon: "▶" },
    { id: "view", label: "動画", href: "videos.html", icon: "▦" },
    { id: "my", label: "マイ", href: "my-videos.html", icon: "◎" },
  ]);

  const DESKTOP_NAV = Object.freeze([
    { id: "home", label: "ホーム", href: "index.html", icon: "⌂" },
    { id: "videos", label: "動画", href: "videos.html", icon: "▦" },
    { id: "shorts", label: "ショート", href: "shorts.html", icon: "▮" },
    { id: "live", label: "ライブ配信", href: "index.html#live-broadcasts", icon: "●" },
    { id: "subscriptions", label: "登録チャンネル", href: "videos.html?feed=following", icon: "▦" },
    { id: "mypage", label: "マイページ", href: "my-videos.html", icon: "◎" },
    { id: "creator", label: "収益・分析", href: "creator-dashboard.html", icon: "¥" },
    { id: "upload", label: "投稿", href: "video-upload.html", icon: "＋" },
  ]);

  const FEED_TABS = Object.freeze([
    { id: "recommended", label: "おすすめ" },
    { id: "trending", label: "急上昇" },
    { id: "following", label: "フォロー中" },
    { id: "new", label: "新着" },
  ]);

  const CATEGORY_CHIPS = Object.freeze([
    { id: "", label: "すべて" },
    { id: "home-building", label: "住まい・建築" },
    { id: "business", label: "ビジネス" },
    { id: "howto", label: "ノウハウ" },
    { id: "entertainment", label: "エンタメ" },
    { id: "ai", label: "AI" },
    { id: "music", label: "音楽" },
    { id: "game", label: "ゲーム" },
    { id: "live", label: "ライブ" },
  ]);

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isDesktopNavActive(itemId, activeId) {
    if (itemId === activeId) return true;
    if (itemId === "subscriptions" && activeId === "following") return true;
    return false;
  }

  function renderDesktopSidebar(activeId) {
    const items = DESKTOP_NAV.map((item) => {
      const active = isDesktopNavActive(item.id, activeId);
      const ariaCurrent = active ? ' aria-current="page"' : "";
      return `
        <a class="tlv-desktop-nav__link${active ? " is-active" : ""}" href="${esc(item.href)}" data-tlv-desktop-nav="${esc(item.id)}"${ariaCurrent}>
          <span class="tlv-desktop-nav__icon" aria-hidden="true">${esc(item.icon)}</span>
          <span>${esc(item.label)}</span>
        </a>`;
    }).join("");
    return `
      <aside class="tlv-desktop-sidebar" aria-label="TLV メニュー">
        <a class="tlv-desktop-brand" href="index.html">
          <span class="tlv-desktop-brand__mark">TLV</span>
          <span class="tlv-desktop-brand__text">TASFUL LIVE</span>
        </a>
        <nav class="tlv-desktop-nav">${items}</nav>
        <div class="tlv-desktop-sidebar__foot">
          <a class="tlv-desktop-nav__link" href="admin-videos.html">運営管理</a>
          <a class="tlv-desktop-nav__link" href="../dashboard.html">TASFUL へ</a>
        </div>
      </aside>`;
  }

  function renderDesktopTopbar(options = {}) {
    const title = options.title || "動画";
    const showSearch = options.showSearch !== false;
    const searchHtml = showSearch
      ? `
        <form class="tlv-desktop-search" data-tlv-desktop-search-form role="search">
          <input class="tlv-desktop-search__input" type="search" name="q" placeholder="動画を検索" data-tlv-desktop-search-input aria-label="動画を検索" />
          <button type="submit" class="tlv-desktop-search__btn">検索</button>
        </form>`
      : "";
    return `
      <header class="tlv-desktop-topbar">
        <h1 class="tlv-desktop-topbar__title">${esc(title)}</h1>
        ${searchHtml}
        <a class="live-btn live-btn--primary live-btn--sm" href="video-upload.html">投稿</a>
      </header>`;
  }

  function renderCategoryChips(activeCategory = "", options = {}) {
    const scroll = options.scroll !== false;
    const chips = CATEGORY_CHIPS.map((chip) => {
      const active = chip.id === activeCategory ? " is-active" : "";
      return `<button type="button" class="tlv-category-chip${active}" data-tlv-category="${esc(chip.id)}">${esc(chip.label)}</button>`;
    }).join("");
    const scrollClass = scroll ? " tlv-category-chips--scroll" : "";
    return `<div class="tlv-category-chips${scrollClass}" data-tlv-category-chips role="tablist" aria-label="カテゴリ">${chips}</div>`;
  }

  function renderMobileTabbar(activeTabId) {
    const items = MOBILE_TABS.map((tab) => {
      const active = tab.id === activeTabId ? " is-active" : "";
      return `
        <a class="tlv-mobile-tabbar__item${active}" href="${esc(tab.href)}" data-tlv-mobile-tab="${esc(tab.id)}" aria-current="${tab.id === activeTabId ? "page" : "false"}">
          <span class="tlv-mobile-tabbar__icon" aria-hidden="true">${esc(tab.icon)}</span>
          <span class="tlv-mobile-tabbar__label">${esc(tab.label)}</span>
        </a>`;
    }).join("");
    return `<nav class="tlv-mobile-tabbar" data-tlv-mobile-tabbar aria-label="TLV アプリメニュー">${items}</nav>`;
  }

  function renderMobileFeedTabs(activeFeed = "recommended") {
    const tabs = FEED_TABS.map((tab) => {
      const active = tab.id === activeFeed ? " is-active" : "";
      return `<button type="button" class="tlv-mobile-feed-tab${active}" data-tlv-feed="${esc(tab.id)}" role="tab" aria-selected="${tab.id === activeFeed ? "true" : "false"}">${esc(tab.label)}</button>`;
    }).join("");
    return `<div class="tlv-mobile-feed-tabs" data-tlv-feed-tabs role="tablist" aria-label="VIEW フィード">${tabs}</div>`;
  }

  function renderMobileHeader(title, options = {}) {
    const upload = options.showUpload
      ? `<a class="tlv-mobile-header__action" href="video-upload.html">投稿</a>`
      : "";
    const sub = options.subtitle
      ? `<p class="tlv-mobile-header__sub" data-tlv-profile-subtitle>${esc(options.subtitle)}</p>`
      : `<p class="tlv-mobile-header__sub" data-tlv-profile-subtitle hidden></p>`;
    const back = options.backHref
      ? `<a class="tlv-mobile-header__back" href="${esc(options.backHref)}">${esc(options.backLabel || "← 戻る")}</a>`
      : "";
    return `
      <header class="tlv-mobile-header${options.backHref ? " tlv-mobile-header--back" : ""}">
        ${back}
        <div class="tlv-mobile-header__text">
          <h1 class="tlv-mobile-header__title">${esc(title)}</h1>
          ${sub}
        </div>
        ${upload}
      </header>`;
  }

  function bindDesktopSearchRedirect(forms) {
    const list = forms ? (Array.isArray(forms) ? forms : [forms]) : [];
    list.forEach((form) => {
      if (!form) return;
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const input = form.querySelector("[data-tlv-desktop-search-input]");
        const term = String(input?.value || "").trim();
        global.location.href = term ? `videos.html?q=${encodeURIComponent(term)}` : "videos.html";
      });
    });
  }

  function pickContentRoot(desktopSelector, mobileSelector) {
    const mobile = global.matchMedia("(max-width: 1023px)").matches;
    return global.document.querySelector(mobile ? mobileSelector : desktopSelector);
  }

  function initPageShell(config = {}) {
    const {
      desktopNavId = "home",
      mobileTabId = "live",
      topbarTitle = "TLV",
      showSearch = true,
      mobileHeaderTitle = topbarTitle,
      mobileHeaderOptions = {},
    } = config;

    const sidebarMount = global.document.querySelector("[data-tlv-desktop-sidebar-mount]");
    const topbarMount = global.document.querySelector("[data-tlv-desktop-topbar-mount]");
    const headerMount = global.document.querySelector("[data-tlv-mobile-header-mount]");
    const tabbarMount = global.document.querySelector("[data-tlv-mobile-tabbar-mount]");

    if (sidebarMount) sidebarMount.innerHTML = renderDesktopSidebar(desktopNavId);
    if (topbarMount) {
      topbarMount.innerHTML = renderDesktopTopbar({ title: topbarTitle, showSearch });
      if (showSearch) {
        bindDesktopSearchRedirect(topbarMount.querySelector("[data-tlv-desktop-search-form]"));
      }
    }
    if (headerMount) headerMount.innerHTML = renderMobileHeader(mobileHeaderTitle, mobileHeaderOptions);
    if (tabbarMount) tabbarMount.innerHTML = renderMobileTabbar(mobileTabId);
  }

  function setProfileSubtitle(text) {
    global.document.querySelectorAll("[data-tlv-profile-subtitle]").forEach((el) => {
      if (text) {
        el.textContent = text;
        el.hidden = false;
      } else {
        el.textContent = "";
        el.hidden = true;
      }
    });
  }

  function bindSearchForms(forms, onSearch) {
    const list = !forms ? [] : forms instanceof Element ? [forms] : [...forms].filter(Boolean);
    list.forEach((form) => {
      if (!form) return;
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const input = form.querySelector("input[type=search], input[name=q]");
        onSearch(String(input?.value || "").trim());
      });
    });
  }

  function bindCategoryChips(container, onSelect) {
    const containers = !container
      ? []
      : container instanceof Element
        ? [container]
        : [...container].filter(Boolean);
    if (!containers.length) return;
    containers.forEach((root) => {
      root.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-tlv-category]");
        if (!btn) return;
        const categoryId = String(btn.getAttribute("data-tlv-category") || "");
        containers.forEach((c) => {
          c.querySelectorAll("[data-tlv-category]").forEach((el) => {
            el.classList.toggle("is-active", String(el.getAttribute("data-tlv-category") || "") === categoryId);
          });
        });
        onSelect(categoryId);
      });
    });
  }

  function bindFeedTabs(container, onSelect) {
    if (!container) return;
    container.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-tlv-feed]");
      if (!btn) return;
      container.querySelectorAll("[data-tlv-feed]").forEach((el) => {
        el.classList.remove("is-active");
        el.setAttribute("aria-selected", "false");
      });
      btn.classList.add("is-active");
      btn.setAttribute("aria-selected", "true");
      onSelect(String(btn.getAttribute("data-tlv-feed") || "recommended"));
    });
  }

  function syncSearchInputs(inputs, value) {
    inputs.forEach((input) => {
      if (input) input.value = value;
    });
  }

  global.TasuTlvNav = {
    MOBILE_TABS,
    DESKTOP_NAV,
    FEED_TABS,
    CATEGORY_CHIPS,
    renderDesktopSidebar,
    renderDesktopTopbar,
    renderCategoryChips,
    renderMobileTabbar,
    renderMobileFeedTabs,
    renderMobileHeader,
    bindSearchForms,
    bindCategoryChips,
    bindFeedTabs,
    syncSearchInputs,
    bindDesktopSearchRedirect,
    pickContentRoot,
    initPageShell,
    setProfileSubtitle,
  };
})(typeof window !== "undefined" ? window : globalThis);
