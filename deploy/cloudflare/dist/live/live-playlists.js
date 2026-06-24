/**
 * TASFUL LIVE — 再生リスト一覧（YouTube /feed/playlists 風）
 */
(function (global) {
  "use strict";

  const C = () => global.TasuLiveConfig;
  const profileApi = () => global.TasuLiveProfile;

  const FILTERS = Object.freeze([
    { id: "newest", label: "新しい順" },
    { id: "playlists", label: "再生リスト" },
    { id: "music", label: "音楽" },
    { id: "owned", label: "自分が所有" },
    { id: "saved", label: "保存済み" },
  ]);

  function filterPlaylists(playlists, filterId) {
    const id = String(filterId || "newest");
    if (id === "newest" || id === "playlists") return playlists;
    if (id === "music") return playlists.filter((item) => item.category === "music");
    if (id === "owned") return playlists.filter((item) => ["videos", "shorts", "live"].includes(item.id));
    if (id === "saved") return playlists.filter((item) => ["saved", "watch-later", "liked"].includes(item.id));
    return playlists;
  }

  function renderFilterChips(activeFilter) {
    const cfg = C();
    return FILTERS.map((filter) => {
      const active = filter.id === activeFilter ? " is-active" : "";
      return `<button type="button" class="tlv-playlists-filter${active}" data-tlv-playlists-filter="${cfg.escapeHtml(filter.id)}">${cfg.escapeHtml(filter.label)}</button>`;
    }).join("");
  }

  function renderMenuButton(playlistId) {
    const cfg = C();
    return `
      <button type="button" class="tlv-playlists-card__menu" data-tlv-playlists-menu="${cfg.escapeHtml(playlistId)}" aria-label="再生リストの操作">
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path fill="currentColor" d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
        </svg>
      </button>`;
  }

  function renderPlaylistCard(playlist, meta) {
    const cfg = C();
    const count = Number(meta?.count ?? 0);
    const countLabel = `${count.toLocaleString("ja-JP")} 本の動画`;
    const thumbUrl = String(meta?.thumbUrl || "").trim();
    const privacy = playlist.privacy || "非公開";
    const coverInner = thumbUrl
      ? `<img class="tlv-playlists-card__cover-img" src="${cfg.escapeHtml(thumbUrl)}" alt="" loading="lazy" />`
      : `<div class="tlv-playlists-card__cover-placeholder" aria-hidden="true"></div>`;

    return `
      <article class="tlv-playlists-card" data-tlv-playlists-card data-playlist-id="${cfg.escapeHtml(playlist.id)}">
        <a class="tlv-playlists-card__thumb-link" href="${cfg.escapeHtml(playlist.href || "#")}">
          <div class="tlv-playlists-card__thumb">
            <div class="tlv-playlists-card__stack" aria-hidden="true"></div>
            <div class="tlv-playlists-card__cover">${coverInner}</div>
            <span class="tlv-playlists-card__count">
              <span class="tlv-playlists-card__count-icon" aria-hidden="true">☰</span>
              ${cfg.escapeHtml(countLabel)}
            </span>
          </div>
        </a>
        <div class="tlv-playlists-card__body">
          <div class="tlv-playlists-card__head">
            <h3 class="tlv-playlists-card__title">
              <a href="${cfg.escapeHtml(playlist.href || "#")}">${cfg.escapeHtml(playlist.title)}</a>
            </h3>
            ${renderMenuButton(playlist.id)}
          </div>
          <p class="tlv-playlists-card__meta">${cfg.escapeHtml(privacy)} · プレイリスト</p>
          <a class="tlv-playlists-card__view-all" href="${cfg.escapeHtml(playlist.href || "#")}">再生リストの全体を見る</a>
        </div>
      </article>`;
  }

  function renderPlaylistsGrid(playlists, bundle) {
    const api = profileApi();
    const resolveMeta = api?.resolvePlaylistCountMeta || (() => ({ count: 0, thumbUrl: null }));
    const cards = playlists
      .map((playlist) => renderPlaylistCard(playlist, resolveMeta(playlist, bundle)))
      .join("");
    return `<div class="tlv-playlists-grid" data-tlv-playlists-grid>${cards}</div>`;
  }

  function renderEmptyFilterHint(filterId) {
    const cfg = C();
    if (filterId === "music") {
      return `<p class="tlv-playlists-empty-hint">音楽の再生リストはまだありません。</p>`;
    }
    return `<p class="tlv-playlists-empty-hint">${cfg.escapeHtml("該当する再生リストはありません。")}</p>`;
  }

  function renderPlaylistsPageHtml(playlists, bundle, { activeFilter = "newest" } = {}) {
    const filtered = filterPlaylists(playlists, activeFilter);
    const gridHtml = filtered.length
      ? renderPlaylistsGrid(filtered, bundle)
      : renderEmptyFilterHint(activeFilter);

    return `
      <div class="tlv-playlists-page" data-tlv-playlists-page>
        <h1 class="tlv-playlists-title">再生リスト</h1>
        <div class="tlv-playlists-filters" role="tablist" aria-label="再生リストフィルター">
          ${renderFilterChips(activeFilter)}
        </div>
        <div class="tlv-playlists-content" data-tlv-playlists-content>
          ${gridHtml}
        </div>
      </div>`;
  }

  function bindPlaylistsPage(roots, state, reload) {
    roots.filter(Boolean).forEach((root) => {
      root.querySelectorAll("[data-tlv-playlists-filter]").forEach((btn) => {
        btn.addEventListener("click", () => {
          reload({ filterId: btn.getAttribute("data-tlv-playlists-filter") || "newest" });
        });
      });

      root.querySelectorAll("[data-tlv-playlists-menu]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const id = String(btn.getAttribute("data-tlv-playlists-menu") || "");
          if (!id) return;
          global.alert("再生リストの操作メニューは今後追加予定です。");
        });
      });
    });
  }

  async function mountPlaylistsPage(root, options = {}) {
    const cfg = C();
    const api = profileApi();
    const roots = (options.roots || [root]).filter(Boolean);
    const writeRoots = (html) => {
      roots.forEach((r) => {
        if (r) r.innerHTML = html;
      });
    };

    const state = { filterId: "newest" };

    async function reload(partial = {}) {
      Object.assign(state, partial);
      writeRoots('<p class="live-loading">読み込み中…</p>');
      try {
        const talkUserId = cfg.getTalkUserId();
        if (!talkUserId) {
          writeRoots(`
            <div class="tlv-playlists-page">
              <h1 class="tlv-playlists-title">再生リスト</h1>
              <p class="tlv-playlists-empty-hint">ログインすると再生リストを表示できます。</p>
            </div>`);
          return;
        }

        const playlists = api?.buildLibraryPlaylists?.(talkUserId, true) || api?.buildChannelPlaylists?.(talkUserId, true) || [];
        const bundle = api?.fetchChannelPlaylistBundle
          ? await api.fetchChannelPlaylistBundle(talkUserId, true)
          : {};

        writeRoots(renderPlaylistsPageHtml(playlists, bundle, { activeFilter: state.filterId }));
        bindPlaylistsPage(roots, state, reload);
      } catch (err) {
        console.error("[TasuLivePlaylists]", err);
        writeRoots(`<p class="live-error">読み込みに失敗しました: ${cfg.escapeHtml(err.message || err)}</p>`);
      }
    }

    await reload();
  }

  global.TasuLivePlaylists = {
    mountPlaylistsPage,
    filterPlaylists,
    FILTERS,
  };
})(typeof window !== "undefined" ? window : globalThis);
