/**
 * TASFUL LIVE — チャンネルのコンテンツ（YouTube Studio 風）
 */
(function (global) {
  "use strict";

  const C = () => global.TasuLiveConfig;

  const STUDIO_ROUTES = Object.freeze({
    dashboard: "studio-dashboard.html",
    content: "channel-content.html",
    analytics: "analytics.html",
    earnings: "creator-dashboard.html",
  });

  const STUDIO_NAV = Object.freeze([
    { id: "dashboard", label: "ダッシュボード", href: STUDIO_ROUTES.dashboard, icon: "▣" },
    { id: "content", label: "コンテンツ", href: STUDIO_ROUTES.content, icon: "▶" },
    { id: "analytics", label: "アナリティクス", href: STUDIO_ROUTES.analytics, icon: "◔" },
    { id: "community", label: "コミュニティ", href: null, comingSoon: true, icon: "◉" },
    { id: "subtitles", label: "字幕", href: null, comingSoon: true, icon: "CC" },
    { id: "content-id", label: "コンテンツ検出", href: null, comingSoon: true, icon: "◎" },
    { id: "monetization", label: "収益化", href: STUDIO_ROUTES.earnings, icon: "¥" },
    { id: "customization", label: "カスタマイズ", href: "profile.html", icon: "✎" },
    { id: "audio", label: "オーディオライブラリ", href: null, comingSoon: true, icon: "♪" },
  ]);

  const STUDIO_SETTINGS_NAV = Object.freeze([
    { id: "settings", label: "設定", href: "profile.html", icon: "⚙" },
  ]);

  const CONTENT_TABS = Object.freeze([
    { id: "inspiration", label: "インスピレーション", comingSoon: true },
    { id: "videos", label: "動画" },
    { id: "shorts", label: "ショート" },
    { id: "live", label: "ライブ配信" },
    { id: "posts", label: "投稿" },
    { id: "playlists", label: "再生リスト" },
    { id: "podcasts", label: "ポッドキャスト", comingSoon: true },
    { id: "promotions", label: "プロモーション", comingSoon: true },
    { id: "collaborations", label: "コラボレーション", comingSoon: true },
  ]);

  function writeToRoots(roots, html) {
    roots.filter(Boolean).forEach((root) => {
      root.innerHTML = html;
    });
  }

  function resolveThumbUrl(video) {
    return global.TasuLiveVideos?.resolveThumbUrl?.(video) || null;
  }

  function formatNumber(n) {
    return Number(n ?? 0).toLocaleString("ja-JP");
  }

  function renderNotificationCell(video) {
    const status = String(video?.status || "");
    if (status === "removed") return "—";
    return "—";
  }

  function renderStudioNavLinks(items, activeId) {
    const cfg = C();
    return items
      .map((item) => {
        const active = item.id === activeId ? " is-active" : "";
        if (item.comingSoon) {
          return `
          <button type="button" class="tlv-studio-sidebar__link tlv-studio-sidebar__link--soon${active}" data-tlv-studio-nav-soon="${cfg.escapeHtml(item.id)}">
            <span class="tlv-studio-sidebar__link-icon" aria-hidden="true">${item.icon}</span>
            <span class="tlv-studio-sidebar__link-label">${cfg.escapeHtml(item.label)}</span>
          </button>`;
        }
        return `
        <a class="tlv-studio-sidebar__link${active}" href="${cfg.escapeHtml(item.href)}">
          <span class="tlv-studio-sidebar__link-icon" aria-hidden="true">${item.icon}</span>
          <span class="tlv-studio-sidebar__link-label">${cfg.escapeHtml(item.label)}</span>
        </a>`;
      })
      .join("");
  }

  function renderStudioSidebar(activeId = "content") {
    const mainLinks = renderStudioNavLinks(STUDIO_NAV, activeId);
    const settingsLinks = renderStudioNavLinks(STUDIO_SETTINGS_NAV, activeId);
    return `${mainLinks}<div class="tlv-studio-sidebar__nav-spacer"></div>${settingsLinks}`;
  }

  function renderStudioChannelProfile(userId) {
    const cfg = C();
    const name = cfg.resolveDisplayName(userId);
    const avatar = cfg.resolveAvatarUrl(userId);
    return `
      <img class="tlv-studio-sidebar__channel-avatar" src="${cfg.escapeHtml(avatar)}" alt="" width="40" height="40" />
      <div class="tlv-studio-sidebar__channel-text">
        <span class="tlv-studio-sidebar__channel-label">チャンネル</span>
        <span class="tlv-studio-sidebar__channel-name">${cfg.escapeHtml(name)}</span>
      </div>`;
  }

  function initStudioChrome(options = {}) {
    const cfg = C();
    const userId = cfg.getTalkUserId();
    const activeId = options.activeId || document.body.getAttribute("data-studio-nav") || "dashboard";

    const brandLink = document.querySelector(".tlv-studio-sidebar__brand-link");
    if (brandLink) {
      brandLink.href = STUDIO_ROUTES.dashboard;
      brandLink.setAttribute("aria-label", "TLV Studio トップへ");
    }

    const channelMount = document.querySelector("[data-tlv-studio-sidebar-channel]");
    if (channelMount) {
      channelMount.innerHTML = userId
        ? renderStudioChannelProfile(userId)
        : `
        <span class="tlv-studio-sidebar__channel-avatar tlv-studio-sidebar__channel-avatar--placeholder" aria-hidden="true">—</span>
        <div class="tlv-studio-sidebar__channel-text">
          <span class="tlv-studio-sidebar__channel-label">チャンネル</span>
          <span class="tlv-studio-sidebar__channel-name">—</span>
        </div>`;
    }

    const navMount = document.querySelector("[data-tlv-studio-sidebar-nav]");
    if (navMount) navMount.innerHTML = renderStudioSidebar(activeId);

    const avatarEl = document.querySelector("[data-tlv-studio-topbar-avatar]");
    if (avatarEl && userId) {
      avatarEl.href = cfg.profileUrl(userId);
      avatarEl.style.backgroundImage = `url("${cfg.resolveAvatarUrl(userId)}")`;
    }

    document.querySelectorAll("[data-tlv-studio-nav-soon]").forEach((btn) => {
      btn.addEventListener("click", () => {
        global.alert("この機能は今後追加予定です。");
      });
    });

    document.querySelectorAll("[data-tlv-studio-topbar-help], [data-tlv-studio-topbar-notify]").forEach((btn) => {
      btn.addEventListener("click", () => {
        global.alert("この機能は今後追加予定です。");
      });
    });

    const backdrop = document.querySelector("[data-tlv-studio-sidebar-backdrop]");
    const body = document.body;
    document.querySelectorAll("[data-tlv-studio-menu-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        body.classList.toggle("tlv-studio-shell--sidebar-open");
        if (backdrop) backdrop.hidden = !body.classList.contains("tlv-studio-shell--sidebar-open");
      });
    });
    backdrop?.addEventListener("click", () => {
      body.classList.remove("tlv-studio-shell--sidebar-open");
      backdrop.hidden = true;
    });
  }

  function renderVisibilityLabel(video) {
    const cfg = C();
    const status = String(video.status || "");
    if (status === "removed") return "削除済み";
    if (status === "hidden") return "非表示";
    if (status === "draft") return "下書き";
    return cfg.labelVideoVisibility(video.visibility);
  }

  function renderTabs(activeTab) {
    const cfg = C();
    return CONTENT_TABS.map((tab) => {
      const active = tab.id === activeTab ? " is-active" : "";
      const soon = tab.comingSoon ? ' data-tlv-studio-tab-soon="1"' : "";
      return `<button type="button" class="tlv-studio-tab${active}" data-tlv-studio-tab="${cfg.escapeHtml(tab.id)}"${soon}>${cfg.escapeHtml(tab.label)}</button>`;
    }).join("");
  }

  function renderVideoTableRow(video) {
    const cfg = C();
    const myVideos = global.TasuLiveMyVideos;
    const thumbUrl = resolveThumbUrl(video);
    const status = String(video.status || "");
    const thumbInner = thumbUrl
      ? `<img src="${cfg.escapeHtml(thumbUrl)}" alt="" loading="lazy" />`
      : `<span class="tlv-studio-table__thumb-placeholder">動画</span>`;
    const visibilityCell =
      status !== "removed" && myVideos?.renderVisibilitySelect
        ? myVideos.renderVisibilitySelect(video)
        : `<span class="tlv-studio-table__visibility">${cfg.escapeHtml(renderVisibilityLabel(video))}</span>`;

    return `
      <tr class="tlv-studio-table__row" data-live-my-video-row data-video-id="${cfg.escapeHtml(video.id)}">
        <td class="tlv-studio-table__cell tlv-studio-table__cell--check">
          <input type="checkbox" class="tlv-studio-table__check" data-tlv-studio-row-check aria-label="選択" />
        </td>
        <td class="tlv-studio-table__cell tlv-studio-table__cell--video">
          <a class="tlv-studio-table__video" href="${cfg.escapeHtml(cfg.watchVideoUrl(video.id))}">
            <span class="tlv-studio-table__thumb">${thumbInner}</span>
            <span class="tlv-studio-table__video-text">
              <span class="tlv-studio-table__title">${cfg.escapeHtml(video.title || "無題")}</span>
              <span class="tlv-studio-table__status">${cfg.escapeHtml(cfg.labelVideoStatus(video.status))}</span>
            </span>
          </a>
          <p class="tlv-studio-table__row-status" data-live-my-video-status role="status" aria-live="polite"></p>
        </td>
        <td class="tlv-studio-table__cell tlv-studio-table__cell--notify">${cfg.escapeHtml(renderNotificationCell(video))}</td>
        <td class="tlv-studio-table__cell tlv-studio-table__cell--visibility">${visibilityCell}</td>
        <td class="tlv-studio-table__cell tlv-studio-table__cell--date">${cfg.escapeHtml(cfg.formatVideoDate(video.published_at || video.created_at))}</td>
        <td class="tlv-studio-table__cell tlv-studio-table__cell--num">${formatNumber(video.views_count)}</td>
        <td class="tlv-studio-table__cell tlv-studio-table__cell--num">—</td>
      </tr>`;
  }

  function renderGenericTableRow({ title, href, date, views, visibility, notify = "—" }) {
    const cfg = C();
    return `
      <tr class="tlv-studio-table__row">
        <td class="tlv-studio-table__cell tlv-studio-table__cell--check">
          <input type="checkbox" class="tlv-studio-table__check" aria-label="選択" />
        </td>
        <td class="tlv-studio-table__cell tlv-studio-table__cell--video">
          <a class="tlv-studio-table__video" href="${cfg.escapeHtml(href || "#")}">
            <span class="tlv-studio-table__thumb"><span class="tlv-studio-table__thumb-placeholder">—</span></span>
            <span class="tlv-studio-table__video-text">
              <span class="tlv-studio-table__title">${cfg.escapeHtml(title || "無題")}</span>
            </span>
          </a>
        </td>
        <td class="tlv-studio-table__cell tlv-studio-table__cell--notify">${cfg.escapeHtml(notify)}</td>
        <td class="tlv-studio-table__cell tlv-studio-table__cell--visibility">${cfg.escapeHtml(visibility || "—")}</td>
        <td class="tlv-studio-table__cell tlv-studio-table__cell--date">${cfg.escapeHtml(date || "—")}</td>
        <td class="tlv-studio-table__cell tlv-studio-table__cell--num">${formatNumber(views)}</td>
        <td class="tlv-studio-table__cell tlv-studio-table__cell--num">—</td>
      </tr>`;
  }

  function renderTableHead() {
    return `
      <thead class="tlv-studio-table__head">
        <tr>
          <th class="tlv-studio-table__cell tlv-studio-table__cell--check" scope="col">
            <input type="checkbox" class="tlv-studio-table__check" data-tlv-studio-check-all aria-label="すべて選択" />
          </th>
          <th class="tlv-studio-table__cell tlv-studio-table__cell--video" scope="col">動画</th>
          <th class="tlv-studio-table__cell tlv-studio-table__cell--notify" scope="col">通知</th>
          <th class="tlv-studio-table__cell tlv-studio-table__cell--visibility" scope="col">公開設定</th>
          <th class="tlv-studio-table__cell tlv-studio-table__cell--date" scope="col">日付 <span aria-hidden="true">↓</span></th>
          <th class="tlv-studio-table__cell tlv-studio-table__cell--num" scope="col">視聴回数</th>
          <th class="tlv-studio-table__cell tlv-studio-table__cell--num" scope="col">コメント</th>
        </tr>
      </thead>`;
  }

  function renderEmptyState(tabId) {
    const cfg = C();
    const uploadBtn =
      tabId === "videos"
        ? `<a class="tlv-studio-empty__btn" href="video-upload.html">動画をアップロード</a>`
        : tabId === "shorts"
          ? `<a class="tlv-studio-empty__btn" href="video-upload.html">ショートを投稿</a>`
          : tabId === "live"
            ? `<a class="tlv-studio-empty__btn" href="studio.html">ライブ配信を開始</a>`
            : "";
    return `
      <div class="tlv-studio-empty">
        <div class="tlv-studio-empty__illus" aria-hidden="true">
          <svg width="136" height="136" viewBox="0 0 136 136" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="68" cy="118" rx="40" ry="6" fill="rgba(109,40,217,0.2)"/>
            <rect x="34" y="72" width="68" height="8" rx="4" fill="rgba(168,85,247,0.35)"/>
            <rect x="28" y="80" width="12" height="32" rx="4" fill="rgba(109,40,217,0.45)"/>
            <rect x="96" y="80" width="12" height="32" rx="4" fill="rgba(109,40,217,0.45)"/>
            <circle cx="68" cy="44" r="22" fill="rgba(232,121,249,0.5)"/>
            <rect x="52" y="62" width="32" height="28" rx="14" fill="rgba(196,181,253,0.35)"/>
            <rect x="44" y="48" width="10" height="18" rx="5" fill="rgba(232,121,249,0.45)"/>
            <rect x="82" y="48" width="10" height="18" rx="5" fill="rgba(232,121,249,0.45)"/>
          </svg>
        </div>
        <p class="tlv-studio-empty__title">コンテンツがありません</p>
        ${uploadBtn}
      </div>`;
  }

  function filterVideos(videos, query) {
    const term = String(query || "").trim().toLowerCase();
    if (!term) return videos;
    return videos.filter((video) => String(video.title || "").toLowerCase().includes(term));
  }

  async function loadTabItems(tabId, userId) {
    const cfg = C();
    const videosApi = global.TasuLiveVideos;

    if (tabId === "videos") {
      return { type: "videos", items: await global.TasuLiveMyVideos.fetchOwnVideos() };
    }
    if (tabId === "shorts") {
      const items = await videosApi?.fetchCreatorChannelShorts?.(userId, { isOwn: true, limit: 200 }).catch(() => []);
      return { type: "shorts", items: items || [] };
    }
    if (tabId === "live") {
      const items = await videosApi?.fetchCreatorChannelBroadcasts?.(userId, { isOwn: true, limit: 200 }).catch(() => []);
      return { type: "live", items: items || [] };
    }
    if (tabId === "playlists") {
      return { type: "playlists", items: [] };
    }
    return { type: "posts", items: [] };
  }

  function renderTableBody(tabId, payload, cfg) {
    const { type, items } = payload;

    if (type === "videos") {
      if (!items.length) return "";
      return `<tbody class="tlv-studio-table__body">${items.map((video) => renderVideoTableRow(video)).join("")}</tbody>`;
    }

    if (type === "shorts") {
      if (!items.length) return "";
      return `<tbody class="tlv-studio-table__body">${items
        .map((short) =>
          renderGenericTableRow({
            title: short.title,
            href: global.TasuLiveShorts?.shortWatchUrl?.(short.id) || "#",
            date: cfg.formatVideoDate(short.published_at || short.created_at),
            views: short.view_count,
            visibility: short.status === "published" ? "公開" : cfg.labelVideoStatus?.(short.status) || short.status,
          }),
        )
        .join("")}</tbody>`;
    }

    if (type === "live") {
      if (!items.length) return "";
      return `<tbody class="tlv-studio-table__body">${items
        .map((broadcast) =>
          renderGenericTableRow({
            title: broadcast.title,
            href: cfg.watchUrl(broadcast.id),
            date: cfg.formatVideoDate(broadcast.started_at || broadcast.scheduled_at || broadcast.created_at),
            views: 0,
            visibility: cfg.labelBroadcastStatus?.(broadcast.status) || broadcast.status,
          }),
        )
        .join("")}</tbody>`;
    }

    return "";
  }

  function renderTableSection(tabId, payload, searchQuery) {
    const cfg = C();
    let items = payload.items || [];
    if (payload.type === "videos") items = filterVideos(items, searchQuery);
    const filteredPayload = { ...payload, items };
    const body = renderTableBody(tabId, filteredPayload, cfg);
    const head = renderTableHead();

    if (!body) {
      return `
        <div class="tlv-studio-table-wrap tlv-studio-table-wrap--empty">
          <table class="tlv-studio-table">${head}</table>
          ${renderEmptyState(tabId)}
        </div>`;
    }

    return `<div class="tlv-studio-table-wrap"><table class="tlv-studio-table">${head}${body}</table></div>`;
  }

  function renderPageHtml({ tabId, payload, searchQuery }) {
    const cfg = C();
    const tableHtml = renderTableSection(tabId, payload, searchQuery);

    return `
      <div class="tlv-studio-page" data-tlv-studio-page>
        <header class="tlv-studio-page__header">
          <h1 class="tlv-studio-page__title">チャンネルのコンテンツ</h1>
        </header>
        <div class="tlv-studio-page__tabs" role="tablist" aria-label="コンテンツ種別">${renderTabs(tabId)}</div>
        <div class="tlv-studio-page__toolbar">
          <button type="button" class="tlv-studio-filter" data-tlv-studio-filter>
            <span class="tlv-studio-filter__icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"/></svg>
            </span>
            フィルタ
          </button>
        </div>
        ${tableHtml}
      </div>`;
  }

  function bindPage(roots, state, reload) {
    roots.filter(Boolean).forEach((root) => {
      root.querySelectorAll("[data-tlv-studio-tab]").forEach((btn) => {
        btn.addEventListener("click", () => {
          if (btn.hasAttribute("data-tlv-studio-tab-soon")) {
            global.alert("この機能は今後追加予定です。");
            return;
          }
          reload({ tabId: btn.getAttribute("data-tlv-studio-tab") || "videos" });
        });
      });

      root.querySelector("[data-tlv-studio-filter]")?.addEventListener("click", () => {
        global.alert("フィルタ機能は今後追加予定です。");
      });

      root.querySelector("[data-tlv-studio-check-all]")?.addEventListener("change", (e) => {
        const checked = e.target.checked;
        root.querySelectorAll("[data-tlv-studio-row-check]").forEach((box) => {
          box.checked = checked;
        });
      });

      if (state.tabId === "videos" && global.TasuLiveMyVideos?.bindRowActionsOnRoots) {
        global.TasuLiveMyVideos.bindRowActionsOnRoots([root], reload);
      }
    });

    const searchInput = document.querySelector("[data-tlv-studio-search-input]");
    if (searchInput && !searchInput.dataset.bound) {
      searchInput.dataset.bound = "1";
      searchInput.value = state.searchQuery || "";
      searchInput.addEventListener("input", () => {
        reload({ searchQuery: String(searchInput.value || ""), skipFetch: true });
      });
    }
  }

  async function mountChannelContentPage(root, options = {}) {
    const cfg = C();
    const roots = (options.roots || [root]).filter(Boolean);
    const state = {
      tabId: new URLSearchParams(global.location.search).get("tab") || "videos",
      searchQuery: "",
      cache: {},
    };

    const talkUserId = cfg.getTalkUserId();
    if (!talkUserId) {
      writeToRoots(
        roots,
        `
        <div class="tlv-studio-page">
          <div class="tlv-studio-empty">
            <p class="tlv-studio-empty__title">ログインが必要です</p>
            <p class="tlv-studio-empty__text">作成した動画を管理するには TALK ログインしてください。</p>
          </div>
        </div>`,
      );
      return;
    }

    async function reload(opts = {}) {
      if (opts.tabId) state.tabId = opts.tabId;
      if (opts.searchQuery !== undefined) state.searchQuery = opts.searchQuery;

      if (!opts.skipFetch) {
        writeToRoots(roots, '<p class="live-loading">読み込み中…</p>');
        try {
          state.cache[state.tabId] = await loadTabItems(state.tabId, talkUserId);
        } catch (err) {
          console.error("[TasuLiveChannelContent]", err);
          writeToRoots(roots, `<p class="live-error">読み込みに失敗しました: ${cfg.escapeHtml(err.message || err)}</p>`);
          return;
        }
      }

      const payload = state.cache[state.tabId] || { type: state.tabId, items: [] };
      writeToRoots(roots, renderPageHtml({ tabId: state.tabId, payload, searchQuery: state.searchQuery }));
      bindPage(roots, state, reload);
    }

    await reload();
  }

  global.TasuLiveChannelContent = {
    mountChannelContentPage,
    initStudioChrome,
    STUDIO_ROUTES,
    renderStudioSidebar,
  };
})(typeof window !== "undefined" ? window : globalThis);
