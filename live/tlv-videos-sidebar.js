/**
 * TLV /live/videos — YouTube-style compact sidebar + expandable drawer
 */
(function (global) {
  "use strict";

  const nav = () => global.TasuTlvNav;

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  const VIDEOS_MINI_NAV = Object.freeze([
    { id: "home", label: "ホーム", href: "videos.html", icon: "⌂" },
    { id: "shorts", label: "ショート", href: "shorts.html", icon: "▮" },
    { id: "subscriptions", label: "登録チャン…", href: "videos.html?feed=following", icon: "▦" },
    { id: "mypage", label: "マイページ", href: "my-videos.html", icon: "◎" },
    { id: "history", label: "履歴", href: "videos.html", icon: "↺" },
    { id: "creator", label: "収益", href: "creator-dashboard.html", icon: "¥" },
    { id: "upload", label: "作成", href: "video-upload.html", icon: "＋" },
  ]);

  const DRAWER_SECTIONS = Object.freeze([
    {
      title: "",
      items: [
        { id: "home", label: "ホーム", href: "videos.html", icon: "⌂" },
        { id: "shorts", label: "ショート", href: "shorts.html", icon: "▮" },
        { id: "subscriptions", label: "登録チャンネル", href: "videos.html?feed=following", icon: "▦" },
      ],
    },
    {
      title: "マイページ",
      items: [
        { id: "channel", label: "チャンネル", href: "profile.html", icon: "◎" },
        { id: "history", label: "履歴", href: "videos.html", icon: "↺" },
        { id: "playlists", label: "再生リスト", href: "my-videos.html", icon: "≡" },
        { id: "watch-later", label: "後で見る", href: "my-videos.html", icon: "🕒" },
        { id: "liked", label: "高く評価した動画", href: "my-videos.html", icon: "👍" },
        { id: "uploaded", label: "作成した動画", href: "my-videos.html", icon: "▶" },
      ],
    },
    {
      title: "TLVのサービス",
      items: [
        { id: "premium", label: "TLV Premium", href: "index.html", icon: "◆" },
        { id: "music", label: "TLV Music", href: "index.html", icon: "♪" },
        { id: "kids", label: "TLV Kids", href: "index.html", icon: "▣" },
      ],
    },
    {
      title: "探索",
      items: [
        { id: "explore-music", label: "音楽", href: "videos.html?shelf=recommended", icon: "♪" },
        { id: "explore-movies", label: "映画とテレビ番組", href: "videos.html", icon: "🎬" },
        { id: "explore-live", label: "ライブ", href: "index.html#live-broadcasts", icon: "●" },
        { id: "explore-game", label: "ゲーム", href: "videos.html", icon: "🎮" },
        { id: "explore-news", label: "ニュース", href: "videos.html", icon: "📰" },
        { id: "explore-sports", label: "スポーツ", href: "videos.html", icon: "⚽" },
        { id: "explore-learning", label: "学び", href: "videos.html", icon: "📚" },
      ],
    },
    {
      title: "その他",
      items: [
        { id: "reports", label: "報告履歴", href: "admin-videos.html", icon: "⚑" },
        { id: "settings", label: "設定", href: "settings.html", icon: "⚙" },
        { id: "help", label: "ヘルプ", href: "../company/faq.html", icon: "?" },
      ],
    },
  ]);

  const DRAWER_FOOTER_LINKS = Object.freeze([
    ["概要", "../company/about.html"],
    ["プレスルーム", "../company/contact.html"],
    ["著作権", "../company/legal/terms.html"],
    ["お問い合わせ", "../company/contact.html"],
    ["クリエイター向け", "creator-dashboard.html"],
    ["広告掲載", "../company/services.html"],
    ["開発者向け", "../company/services.html"],
    ["利用規約", "../company/legal/terms.html"],
    ["プライバシー", "../company/legal/privacy.html"],
    ["ポリシーとセキュリティ", "../company/legal/privacy.html"],
    ["TLVの仕組み", "../company/about.html"],
    ["新機能を試してみる", "videos.html"],
  ]);

  function renderVideosBrandHtml(compact = false) {
    const nameClass = compact ? " tlv-videos-brand__name--compact" : "";
    return `
      <a class="tlv-videos-brand${compact ? " tlv-videos-brand--compact" : ""}" href="index.html" aria-label="TalkLiveView LIVE">
        <span class="tlv-videos-brand__mark">TLV</span>
        <span class="tlv-videos-brand__text">
          <span class="tlv-videos-brand__name${nameClass}">TalkLiveView</span>
          <span class="tlv-videos-brand__badge">LIVE</span>
        </span>
      </a>`;
  }

  function renderVideosTopbarActions(uploadHref = "video-upload.html") {
    return `
      <div class="tlv-videos-topbar__actions">
        <a class="tlv-videos-action tlv-videos-action--upload" href="${esc(uploadHref)}" title="動画投稿">
          <span class="tlv-videos-action__icon" aria-hidden="true">＋</span>
          <span class="tlv-videos-action__label">投稿</span>
        </a>
        <button type="button" class="tlv-videos-action tlv-videos-action--icon" title="通知" aria-label="通知（準備中）" disabled>
          <span aria-hidden="true">🔔</span>
        </button>
        <a class="tlv-videos-action tlv-videos-action--profile" href="profile.html" title="プロフィール" aria-label="プロフィール">
          <span class="tlv-videos-action__avatar" aria-hidden="true">◎</span>
        </a>
      </div>`;
  }

  function renderVideosYoutubeSearchHtml() {
    return `
      <div class="tlv-videos-search-wrap" data-tlv-videos-search-wrap>
        <form class="tlv-videos-search" data-tlv-desktop-search-form role="search">
          <div class="tlv-videos-search__field">
            <input
              class="tlv-videos-search__input"
              type="search"
              name="q"
              placeholder="動画・ショート・ライブを検索"
              data-tlv-desktop-search-input
              autocomplete="off"
              enterkeyhint="search"
              aria-label="動画・ショート・ライブを検索"
            />
          </div>
          <button type="submit" class="tlv-videos-search__submit" aria-label="検索">
            <span aria-hidden="true">⌕</span>
          </button>
        </form>
        <div class="tlv-videos-search__suggest" data-tlv-videos-search-suggest hidden aria-hidden="true"></div>
      </div>`;
  }

  function renderVideosCompactSidebar(activeId = "home") {
    const items = VIDEOS_MINI_NAV.map((item) => {
      const active = item.id === activeId || (activeId === "videos" && item.id === "home");
      return `
        <a class="tlv-videos-mini-nav__link${active ? " is-active" : ""}" href="${esc(item.href)}" data-tlv-mini-nav="${esc(item.id)}" title="${esc(item.label)}">
          <span class="tlv-videos-mini-nav__icon" aria-hidden="true">${esc(item.icon)}</span>
          <span class="tlv-videos-mini-nav__label">${esc(item.label)}</span>
        </a>`;
    }).join("");

    return `
      <aside class="tlv-desktop-sidebar tlv-videos-mini-sidebar" aria-label="TLV ナビゲーション">
        <nav class="tlv-videos-mini-nav" aria-label="クイックナビ">${items}</nav>
      </aside>`;
  }

  function renderDrawerSection(section, activeId) {
    const links = section.items
      .map((item) => {
        const active = item.id === activeId || (activeId === "videos" && item.id === "home");
        return `
          <a class="tlv-videos-drawer__link${active ? " is-active" : ""}" href="${esc(item.href)}">
            <span class="tlv-videos-drawer__icon" aria-hidden="true">${esc(item.icon)}</span>
            <span class="tlv-videos-drawer__text">${esc(item.label)}</span>
          </a>`;
      })
      .join("");
    const title = section.title
      ? `<h3 class="tlv-videos-drawer__section-title">${esc(section.title)}</h3>`
      : "";
    return `
      <section class="tlv-videos-drawer__section">
        ${title}
        <div class="tlv-videos-drawer__section-links">${links}</div>
      </section>`;
  }

  function renderVideosDrawerPanel(activeId = "home", options = {}) {
    const variant = options.variant || "mobile-overlay";
    const id = variant === "desktop-rail" ? "tlv-videos-drawer-desktop" : "tlv-videos-drawer";
    const dataAttr =
      variant === "desktop-rail"
        ? "data-tlv-videos-drawer-desktop"
        : "data-tlv-videos-drawer-mobile";
    const sections = DRAWER_SECTIONS.map((s) => renderDrawerSection(s, activeId)).join("");
    const footer = DRAWER_FOOTER_LINKS.map(
      ([label, href]) => `<a class="tlv-videos-drawer__footer-link" href="${esc(href)}">${esc(label)}</a>`,
    ).join("");

    return `
      <aside class="tlv-videos-drawer tlv-videos-drawer--${variant}" id="${id}" ${dataAttr} aria-label="TLV メニュー" aria-hidden="true">
        <div class="tlv-videos-drawer__head">
          <button type="button" class="tlv-videos-drawer__menu-btn" data-tlv-drawer-toggle aria-label="メニューを閉じる" aria-expanded="false" aria-controls="${id}">
            <span aria-hidden="true">☰</span>
          </button>
          <a class="tlv-videos-drawer__brand" href="index.html">
            <span class="tlv-videos-drawer__brand-mark">TLV</span>
            <span class="tlv-videos-drawer__brand-text">TASFUL LIVE</span>
          </a>
        </div>
        <div class="tlv-videos-drawer__scroll">
          ${sections}
          <footer class="tlv-videos-drawer__footer" aria-label="フッターリンク">
            ${footer}
          </footer>
        </div>
      </aside>`;
  }

  function renderVideosDesktopSidebarRail(activeId = "home") {
    return `
      <div class="tlv-videos-sidebar-rail">
        ${renderVideosCompactSidebar(activeId)}
        ${renderVideosDrawerPanel(activeId, { variant: "desktop-rail" })}
      </div>`;
  }

  function renderVideosMobileDrawer(activeId = "home") {
    return `
      <div class="tlv-videos-drawer-backdrop" data-tlv-videos-drawer-backdrop hidden></div>
      ${renderVideosDrawerPanel(activeId, { variant: "mobile-overlay" })}`;
  }

  function renderVideosDesktopTopbar(options = {}) {
    const uploadHref = String(options.uploadHref || "video-upload.html");
    const useYoutube = options.headerLayout === "youtube" || (options.showSearch !== false && !options.title);

    if (!useYoutube && options.showSearch === false) {
      const title = options.title || "ショート";
      return `
        <header class="tlv-desktop-topbar tlv-desktop-topbar--videos">
          <h1 class="tlv-desktop-topbar__title">${esc(title)}</h1>
          <a class="live-btn live-btn--primary live-btn--sm" href="${esc(uploadHref)}">投稿</a>
        </header>`;
    }

    if (useYoutube) {
      return `
        <header class="tlv-desktop-topbar tlv-desktop-topbar--videos tlv-desktop-topbar--youtube">
          <div class="tlv-videos-topbar__start">
            <button type="button" class="tlv-videos-topbar__menu" data-tlv-drawer-toggle aria-label="メニューを開く" aria-expanded="false" aria-controls="tlv-videos-drawer-desktop">
              <span aria-hidden="true">☰</span>
            </button>
            ${renderVideosBrandHtml(false)}
          </div>
          <div class="tlv-videos-topbar__center">
            ${renderVideosYoutubeSearchHtml()}
          </div>
          <div class="tlv-videos-topbar__end">
            ${renderVideosTopbarActions(uploadHref)}
          </div>
        </header>`;
    }

    const title = options.title || "動画";
    const searchHtml = options.showSearch !== false ? renderVideosYoutubeSearchHtml() : "";
    return `
      <header class="tlv-desktop-topbar tlv-desktop-topbar--videos">
        <h1 class="tlv-desktop-topbar__title">${esc(title)}</h1>
        ${searchHtml}
        <a class="live-btn live-btn--primary live-btn--sm" href="${esc(uploadHref)}">投稿</a>
      </header>`;
  }

  function renderVideosMobileHeader(title, options = {}) {
    const uploadHref = String(options.uploadHref || "video-upload.html");
    const useYoutube = options.headerLayout === "youtube";

    if (useYoutube) {
      return `
        <header class="tlv-mobile-header tlv-mobile-header--videos tlv-mobile-header--videos-youtube">
          <div class="tlv-mobile-videos-toprow">
            <button type="button" class="tlv-videos-mobile-menu" data-tlv-drawer-toggle aria-label="メニューを開く" aria-expanded="false" aria-controls="tlv-videos-drawer">
              <span aria-hidden="true">☰</span>
            </button>
            ${renderVideosBrandHtml(true)}
            <div class="tlv-mobile-videos-toprow__actions">
              <a class="tlv-videos-action tlv-videos-action--icon" href="${esc(uploadHref)}" title="投稿" aria-label="投稿">
                <span aria-hidden="true">＋</span>
              </a>
              <button type="button" class="tlv-videos-action tlv-videos-action--icon" title="通知" aria-label="通知（準備中）" disabled>
                <span aria-hidden="true">🔔</span>
              </button>
              <a class="tlv-videos-action tlv-videos-action--profile tlv-videos-action--icon" href="profile.html" title="プロフィール" aria-label="プロフィール">
                <span aria-hidden="true">◎</span>
              </a>
            </div>
          </div>
          <div class="tlv-mobile-videos-search-wrap">
            ${renderVideosYoutubeSearchHtml()}
          </div>
        </header>`;
    }

    const upload = options.showUpload
      ? `<a class="tlv-mobile-header__action" href="${esc(uploadHref)}">投稿</a>`
      : "";
    const sub = options.subtitle
      ? `<p class="tlv-mobile-header__sub" data-tlv-profile-subtitle>${esc(options.subtitle)}</p>`
      : `<p class="tlv-mobile-header__sub" data-tlv-profile-subtitle hidden></p>`;
    const back = options.backHref
      ? `<a class="tlv-mobile-header__back" href="${esc(options.backHref)}">${esc(options.backLabel || "← 戻る")}</a>`
      : "";
    return `
      <header class="tlv-mobile-header tlv-mobile-header--videos${options.backHref ? " tlv-mobile-header--back" : ""}">
        <button type="button" class="tlv-videos-mobile-menu" data-tlv-drawer-toggle aria-label="メニューを開く" aria-expanded="false" aria-controls="tlv-videos-drawer"><span aria-hidden="true">☰</span></button>
        ${back}
        <div class="tlv-mobile-header__text">
          <h1 class="tlv-mobile-header__title">${esc(title)}</h1>
          ${sub}
        </div>
        ${upload}
      </header>`;
  }

  function initVideosDrawer() {
    const desktopDrawer = global.document.querySelector("[data-tlv-videos-drawer-desktop]");
    const mobileDrawer = global.document.querySelector("[data-tlv-videos-drawer-mobile]");
    const backdrop = global.document.querySelector("[data-tlv-videos-drawer-backdrop]");
    if (!desktopDrawer && !mobileDrawer) return;

    const toggles = global.document.querySelectorAll("[data-tlv-drawer-toggle]");
    const mqMobile = global.matchMedia("(max-width: 1023px)");
    let menuOpen = false;

    function setOpen(open) {
      menuOpen = open;
      const mobile = mqMobile.matches;
      global.document.body.classList.toggle("tlv-videos-sidebar-expanded", open && !mobile);
      global.document.body.classList.toggle("tlv-videos-drawer-open", open && mobile);
      mobileDrawer?.classList.toggle("is-open", open && mobile);
      if (backdrop) backdrop.hidden = !(open && mobile);
      desktopDrawer?.setAttribute("aria-hidden", open && !mobile ? "false" : "true");
      mobileDrawer?.setAttribute("aria-hidden", open && mobile ? "false" : "true");
      toggles.forEach((btn) => {
        btn.setAttribute("aria-expanded", open ? "true" : "false");
        btn.setAttribute("aria-label", open ? "メニューを閉じる" : "メニューを開く");
      });
      if (open) {
        const activeDrawer = mobile ? mobileDrawer : desktopDrawer;
        const first = activeDrawer?.querySelector(".tlv-videos-drawer__link, .tlv-videos-drawer__menu-btn");
        first?.focus?.();
      }
    }

    function toggle() {
      setOpen(!menuOpen);
    }

    toggles.forEach((btn) => btn.addEventListener("click", toggle));
    backdrop?.addEventListener("click", () => {
      if (mqMobile.matches) setOpen(false);
    });
    global.document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && menuOpen) setOpen(false);
    });

    mqMobile.addEventListener("change", () => {
      setOpen(menuOpen);
    });
  }

  function mountVideosPageChrome(config = {}) {
    const activeId = config.activeId || "videos";
    const sidebarMount = global.document.querySelector("[data-tlv-desktop-sidebar-mount]");
    const topbarMount = global.document.querySelector("[data-tlv-desktop-topbar-mount]");
    const headerMount = global.document.querySelector("[data-tlv-mobile-header-mount]");

    if (sidebarMount) sidebarMount.innerHTML = renderVideosDesktopSidebarRail(activeId);

    if (!global.document.querySelector("[data-tlv-videos-drawer-mobile]")) {
      global.document.body.insertAdjacentHTML("beforeend", renderVideosMobileDrawer(activeId));
    }

    if (topbarMount) {
      topbarMount.innerHTML = renderVideosDesktopTopbar({
        title: config.topbarTitle,
        showSearch: config.showSearch !== false,
        uploadHref: config.uploadHref,
        headerLayout: config.headerLayout,
      });
      nav()?.bindDesktopSearchRedirect?.(topbarMount.querySelector("[data-tlv-desktop-search-form]"));
    }

    if (headerMount) {
      headerMount.innerHTML = renderVideosMobileHeader(config.mobileHeaderTitle || "VIEW", {
        showUpload: true,
        uploadHref: config.uploadHref,
        headerLayout: config.headerLayout,
        ...config.mobileHeaderOptions,
      });
    }

    initVideosDrawer();
  }

  const api = {
    renderVideosCompactSidebar,
    renderVideosDrawerPanel,
    renderVideosDesktopSidebarRail,
    renderVideosMobileDrawer,
    renderVideosDesktopTopbar,
    renderVideosMobileHeader,
    initVideosDrawer,
    mountVideosPageChrome,
    VIDEOS_MINI_NAV,
    DRAWER_SECTIONS,
  };

  global.TasuTlvVideosSidebar = api;
  if (global.TasuTlvNav) {
    Object.assign(global.TasuTlvNav, api);
  }
})(typeof window !== "undefined" ? window : globalThis);
