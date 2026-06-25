/**
 * TASFUL LIVE — クリエイターチャンネル / プロフィール（Phase 9）
 */
(function (global) {
  "use strict";

  const C = () => global.TasuLiveConfig;

  /** UI確認用デモ（localhost のみ。本番は実データ） */
  function isProfileDemoMode() {
    return Boolean(global.TasuTlvDevAuth?.isLocalTlvDevHost?.());
  }

  const DEMO_PLAYLIST_META = Object.freeze({
    "watch-later": { count: 28, collageTones: ["finance", "sports", "music", "tech"] },
    liked: { count: 154, collageTones: ["movie", "food", "travel", "stream"] },
    videos: { count: 12, collageTones: ["tech", "game", "pets", "music"] },
    shorts: { count: 48, collageTones: ["sports", "food", "music", "travel"], unit: "shorts" },
    live: { count: 9, collageTones: ["stream", "finance", "tech", "game"] },
  });

  const DEMO_POSTS_SECTIONS = Object.freeze({
    videos: [
      { id: "demo-v1", title: "【解説】TLV クリエイター入門", collageTone: "tech", views: 12400 },
      { id: "demo-v2", title: "週末ライブ振り返り", collageTone: "stream", views: 8200 },
      { id: "demo-v3", title: "おすすめ機材まとめ 2026", collageTone: "finance", views: 5100 },
    ],
    shorts: [
      { id: "demo-s1", title: "30秒でわかる配信設定", collageTone: "music" },
      { id: "demo-s2", title: "今日のハイライト", collageTone: "sports" },
      { id: "demo-s3", title: "裏側メイキング", collageTone: "food" },
    ],
    live: [
      { id: "demo-l1", title: "金曜ナイトライブ #42", collageTone: "stream" },
      { id: "demo-l2", title: "新作お披露目配信", collageTone: "game" },
    ],
  });

  function requireConfig() {
    const cfg = C();
    if (!cfg?.getClient?.()) {
      throw new Error("Supabase が未設定です。chat-supabase-config.js を確認してください。");
    }
    return cfg;
  }

  async function fetchProfile(userId) {
    const id = String(userId || "").trim();
    if (!id) return null;

    const devStub = global.TasuTlvDevAuth?.getDevStubProfile?.(id);
    if (devStub) return devStub;

    const cfg = requireConfig();
    await cfg.ensureSupabaseSession();

    const { data, error } = await cfg.getClient()
      .from(cfg.TABLES.profiles)
      .select("*")
      .eq("user_id", id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async function upsertOwnProfile(payload) {
    const cfg = requireConfig();
    await cfg.ensureSupabaseSession();
    const talkUserId = cfg.getTalkUserId();
    if (!talkUserId) throw new Error("ログインが必要です（talk_user_id）");

    const row = {
      user_id: talkUserId,
      bio: payload.bio ?? null,
      live_notify_default: Boolean(payload.live_notify_default),
      tip_message_enabled: Boolean(payload.tip_message_enabled),
    };

    if (payload.creator_status) {
      row.creator_status = payload.creator_status;
    }

    const { data, error } = await cfg.getClient()
      .from(cfg.TABLES.profiles)
      .upsert(row, { onConflict: "user_id" })
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }

  function renderStatusBadges(profile) {
    const cfg = C();
    const creator = cfg.labelCreatorStatus(profile?.creator_status);
    const permission = cfg.labelPermissionStatus(profile?.live_permission_status);
    return `
      <div class="live-badges" aria-label="ステータス">
        <span class="live-badge live-badge--creator" data-live-creator-status>${cfg.escapeHtml(creator)}</span>
        <span class="live-badge live-badge--permission" data-live-permission-status>${cfg.escapeHtml(permission)}</span>
      </div>
    `;
  }

  async function fetchReceivedTipsTotal(userId) {
    const cfg = requireConfig();
    await cfg.ensureSupabaseSession();
    const id = String(userId || "").trim();
    if (!id) return 0;
    const { data, error } = await cfg
      .getClient()
      .from(cfg.TABLES.tips)
      .select("amount_yen")
      .eq("creator_id", id);
    if (error) throw error;
    return (data || []).reduce((sum, row) => sum + Number(row.amount_yen || 0), 0);
  }

  const CHANNEL_TABS = Object.freeze([
    { id: "playlists", label: "再生リスト" },
    { id: "posts", label: "投稿" },
  ]);

  const USER_PLAYLISTS_STORAGE_KEY = "tlv_user_playlists_v1";

  const SYSTEM_PLAYLIST_ORDER = Object.freeze([
    "watch-later",
    "liked",
    "videos",
    "shorts",
    "live",
  ]);

  function readUserCreatedPlaylists(userId) {
    try {
      const raw = global.localStorage?.getItem(USER_PLAYLISTS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      const byUser = parsed?.[userId] || parsed?.items || parsed;
      if (!Array.isArray(byUser)) return [];
      return byUser
        .map((item) => ({
          id: String(item?.id || "").trim(),
          title: String(item?.title || "再生リスト").trim(),
          privacy: String(item?.privacy || "非公開").trim(),
          href: String(item?.href || "#").trim(),
          kind: "user",
          updatedAt: String(item?.updatedAt || item?.updated_at || ""),
          count: Number(item?.count ?? 0),
          thumbUrl: item?.thumbUrl || null,
        }))
        .filter((item) => item.id && item.title);
    } catch {
      return [];
    }
  }

  function buildSystemChannelPlaylists(userId, isOwn) {
    const cfg = C();
    const encodedId = encodeURIComponent(userId);
    const ownOnly = (item) => !item.ownOnly || isOwn;
    return [
      {
        id: "watch-later",
        title: "あとで見る",
        privacy: "非公開",
        href: "watch-later.html",
        ownOnly: true,
        kind: "system",
      },
      {
        id: "liked",
        title: "高く評価した動画",
        privacy: "非公開",
        href: "liked-videos.html",
        ownOnly: true,
        kind: "system",
      },
      {
        id: "videos",
        title: "作成した動画",
        privacy: "公開",
        href: isOwn ? "channel-content.html" : `${cfg.profileUrl(userId)}?tab=posts`,
        countKey: "videos",
        kind: "system",
      },
      {
        id: "shorts",
        title: "作成したショート",
        privacy: "公開",
        href: `shorts.html?creator=${encodedId}`,
        countKey: "shorts",
        kind: "system",
      },
      {
        id: "live",
        title: "ライブ配信",
        privacy: "公開",
        href: "broadcasts.html",
        countKey: "live",
        kind: "system",
      },
    ].filter(ownOnly);
  }

  function sortChannelPlaylists(playlists) {
    const userItems = playlists
      .filter((item) => item.kind === "user")
      .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
    const systemItems = playlists
      .filter((item) => item.kind !== "user")
      .sort(
        (a, b) =>
          SYSTEM_PLAYLIST_ORDER.indexOf(a.id) - SYSTEM_PLAYLIST_ORDER.indexOf(b.id),
      );
    return [...userItems, ...systemItems];
  }

  function buildChannelPlaylists(userId, isOwn) {
    const userPlaylists = isOwn ? readUserCreatedPlaylists(userId) : [];
    return sortChannelPlaylists([...userPlaylists, ...buildSystemChannelPlaylists(userId, isOwn)]);
  }

  function buildLibraryPlaylists(userId, isOwn) {
    const cfg = C();
    const playlists = buildChannelPlaylists(userId, isOwn);
    if (!isOwn) return playlists;
    return [
      ...playlists,
      {
        id: "saved",
        title: "保存済み",
        privacy: "非公開",
        href: "my-videos.html?shelf=saved",
        kind: "system",
      },
    ];
  }

  async function fetchFollowingCount(userId) {
    const cfg = C();
    const id = String(userId || "").trim();
    if (!id) return 0;
    try {
      await cfg.ensureSupabaseSession();
      const client = cfg.getClient();
      if (!client || !cfg.TABLES?.follows) return 0;
      const { count, error } = await client
        .from(cfg.TABLES.follows)
        .select("creator_id", { count: "exact", head: true })
        .eq("follower_id", id);
      if (error) {
        console.warn("[TasuLiveProfile] following count skipped:", error.message || error);
        return 0;
      }
      return Number(count) || 0;
    } catch (err) {
      console.warn("[TasuLiveProfile] following count skipped:", err.message || err);
      return 0;
    }
  }

  async function fetchChannelPlaylistBundle(creatorUserId, isOwn) {
    const videosApi = global.TasuLiveVideos;
    const emptyBundle = {
      videos: { count: 0, thumbUrl: null },
      shorts: { count: 0, thumbUrl: null },
      live: { count: 0, thumbUrl: null },
      watchLater: { count: 0, thumbUrl: null },
      liked: { count: 0, thumbUrl: null },
      saved: { count: 0, thumbUrl: null },
    };
    if (!videosApi) return emptyBundle;

    try {
      const [videos, shorts, broadcasts] = await Promise.all([
        videosApi.fetchCreatorChannelVideos(creatorUserId, { isOwn, limit: 500 }).catch(() => []),
        videosApi.fetchCreatorChannelShorts(creatorUserId, { isOwn, limit: 500 }).catch(() => []),
        videosApi.fetchCreatorChannelBroadcasts(creatorUserId, { isOwn, limit: 500 }).catch(() => []),
      ]);
      const firstVideo = videos[0] || null;
      return {
        videos: {
          count: videos.length,
          thumbUrl: firstVideo ? videosApi.resolveThumbUrl?.(firstVideo) : null,
        },
        shorts: { count: shorts.length, thumbUrl: null },
        live: { count: broadcasts.length, thumbUrl: null },
        watchLater: { count: 0, thumbUrl: null },
        liked: { count: 0, thumbUrl: null },
        saved: { count: 0, thumbUrl: null },
      };
    } catch (err) {
      console.warn("[TasuLiveProfile] playlist bundle skipped:", err.message || err);
      return emptyBundle;
    }
  }

  function formatPlaylistCountLabel(count, playlistId) {
    const n = Number(count ?? 0).toLocaleString("ja-JP");
    if (playlistId === "shorts") return `${n}本のショート`;
    return `${n}本の動画`;
  }

  function buildDemoPlaylistBundle() {
    return {
      videos: { count: DEMO_PLAYLIST_META.videos.count, thumbUrl: null, collageTones: DEMO_PLAYLIST_META.videos.collageTones },
      shorts: { count: DEMO_PLAYLIST_META.shorts.count, thumbUrl: null, collageTones: DEMO_PLAYLIST_META.shorts.collageTones },
      live: { count: DEMO_PLAYLIST_META.live.count, thumbUrl: null, collageTones: DEMO_PLAYLIST_META.live.collageTones },
      watchLater: { count: DEMO_PLAYLIST_META["watch-later"].count, thumbUrl: null, collageTones: DEMO_PLAYLIST_META["watch-later"].collageTones },
      liked: { count: DEMO_PLAYLIST_META.liked.count, thumbUrl: null, collageTones: DEMO_PLAYLIST_META.liked.collageTones },
      saved: { count: 0, thumbUrl: null, collageTones: null },
    };
  }

  function applyDemoPlaylistMeta(playlist, meta) {
    if (!isProfileDemoMode()) return meta;
    const demo = DEMO_PLAYLIST_META[playlist.id];
    if (!demo) return meta;
    return {
      count: demo.count,
      thumbUrl: meta?.thumbUrl || null,
      collageTones: demo.collageTones,
      unit: demo.unit || "videos",
    };
  }

  function resolvePlaylistCountMeta(playlist, bundle) {
    if (playlist.kind === "user") {
      return {
        count: Number(playlist.count ?? 0),
        thumbUrl: playlist.thumbUrl || null,
      };
    }
    const map = {
      "watch-later": bundle.watchLater,
      liked: bundle.liked,
      videos: bundle.videos,
      shorts: bundle.shorts,
      live: bundle.live,
      saved: bundle.saved,
    };
    const base = map[playlist.id] || { count: 0, thumbUrl: null };
    return applyDemoPlaylistMeta(playlist, base);
  }

  function renderChannelHeader(profile, userId, stats, { isOwn = false } = {}) {
    const cfg = C();
    const name = cfg.resolveDisplayName(userId);
    const avatar = cfg.resolveAvatarUrl(userId);
    const bioRaw = String(profile?.bio || "").trim();
    const bioHtml = bioRaw
      ? cfg.escapeHtml(bioRaw).replace(/\n/g, "<br>")
      : '<span class="tlv-channel-header__bio-empty">自己紹介はまだありません</span>';
    const followers = Number(profile?.follower_count ?? 0);
    const videoCount = Number(stats?.videoCount ?? 0);

    return `
      <header class="tlv-channel-header" data-tlv-channel-header>
        <div class="tlv-channel-header__main">
          <img class="tlv-channel-header__avatar" src="${cfg.escapeHtml(avatar)}" width="128" height="128" alt="" loading="lazy" />
          <div class="tlv-channel-header__info">
            <div class="tlv-channel-header__headline">
              <h1 class="tlv-channel-header__name">${cfg.escapeHtml(name)}</h1>
              <p class="tlv-channel-header__handle">@${cfg.escapeHtml(userId)}</p>
            </div>
            <p class="tlv-channel-header__bio">${bioHtml}</p>
            <dl class="tlv-channel-header__stats">
              <div class="tlv-channel-header__stat">
                <dt>登録者数</dt>
                <dd data-live-follower-count>${followers.toLocaleString("ja-JP")}</dd>
              </div>
              <div class="tlv-channel-header__stat">
                <dt>動画数</dt>
                <dd data-channel-stat-videos>${videoCount.toLocaleString("ja-JP")}</dd>
              </div>
            </dl>
            <div class="tlv-channel-header__actions" data-live-profile-actions></div>
          </div>
        </div>
      </header>
    `;
  }

  function renderChannelTabs(activeTab = "playlists") {
    const cfg = C();
    const tabs = CHANNEL_TABS.map((tab) => {
      const active = tab.id === activeTab ? " is-active" : "";
      return `<button type="button" class="tlv-channel-tab${active}" data-tlv-channel-tab="${cfg.escapeHtml(tab.id)}" role="tab" aria-selected="${tab.id === activeTab ? "true" : "false"}">${cfg.escapeHtml(tab.label)}</button>`;
    }).join("");
    return `
      <div class="tlv-channel-tabs-wrap">
        <div class="tlv-channel-tabs-row">
          <nav class="tlv-channel-tabs" data-tlv-channel-tabs role="tablist" aria-label="チャンネルコンテンツ">
            ${tabs}
          </nav>
          <button type="button" class="tlv-channel-tabs__search" data-tlv-channel-search-toggle aria-label="チャンネル内を検索">
            <svg class="tlv-channel-tabs__search-icon" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C8.01 14 6 11.99 6 9.5S8.01 5 10.5 5 15 7.01 15 9.5 12.99 14 10.5 14z"/>
            </svg>
          </button>
        </div>
        <div class="tlv-channel-search" data-tlv-channel-search-panel hidden>
          <input type="search" class="tlv-channel-search__input" data-tlv-channel-search-input placeholder="チャンネル内を検索" autocomplete="off" />
        </div>
      </div>`;
  }

  function renderPlaylistCollageCover(collageTones) {
    const cfg = C();
    const tones = Array.isArray(collageTones) ? collageTones.slice(0, 4) : [];
    while (tones.length < 4) tones.push(tones[tones.length - 1] || "default");
    const cells = tones
      .map(
        (tone) =>
          `<div class="tlv-channel-playlist-card__collage-cell tlv-channel-playlist-card__collage-cell--${cfg.escapeHtml(tone)}" aria-hidden="true"></div>`,
      )
      .join("");
    return `<div class="tlv-channel-playlist-card__collage">${cells}</div>`;
  }

  function renderChannelPlaylistCard(playlist, meta) {
    const cfg = C();
    const count = Number(meta?.count ?? 0);
    const countLabel = formatPlaylistCountLabel(count, playlist.id);
    const thumbUrl = String(meta?.thumbUrl || "").trim();
    const href = String(playlist.href || "#").trim();
    const collageTones = meta?.collageTones;
    let coverInner = "";
    if (thumbUrl) {
      coverInner = `<img class="tlv-channel-playlist-card__cover-img" src="${cfg.escapeHtml(thumbUrl)}" alt="" loading="lazy" />`;
    } else if (Array.isArray(collageTones) && collageTones.length) {
      coverInner = renderPlaylistCollageCover(collageTones);
    } else {
      coverInner = `<div class="tlv-channel-playlist-card__cover-placeholder" aria-hidden="true"></div>`;
    }

    return `
      <article class="tlv-channel-playlist-card" data-tlv-channel-playlist="${cfg.escapeHtml(playlist.id)}">
        <a class="tlv-channel-playlist-card__media" href="${cfg.escapeHtml(href)}">
          <div class="tlv-channel-playlist-card__thumb">
            <div class="tlv-channel-playlist-card__stack tlv-channel-playlist-card__stack--back" aria-hidden="true"></div>
            <div class="tlv-channel-playlist-card__stack tlv-channel-playlist-card__stack--front" aria-hidden="true"></div>
            <div class="tlv-channel-playlist-card__cover">${coverInner}</div>
            <span class="tlv-channel-playlist-card__count">
              <span class="tlv-channel-playlist-card__count-icon" aria-hidden="true">≡</span>
              ${cfg.escapeHtml(countLabel)}
            </span>
          </div>
        </a>
        <div class="tlv-channel-playlist-card__body">
          <div class="tlv-channel-playlist-card__title-row">
            <a class="tlv-channel-playlist-card__title" href="${cfg.escapeHtml(href)}">${cfg.escapeHtml(playlist.title)}</a>
            <button type="button" class="tlv-channel-playlist-card__menu" data-tlv-channel-playlist-menu="${cfg.escapeHtml(playlist.id)}" aria-label="再生リストの操作">
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path fill="currentColor" d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
              </svg>
            </button>
          </div>
          <p class="tlv-channel-playlist-card__privacy">${cfg.escapeHtml(playlist.privacy || "非公開")}</p>
          <a class="tlv-channel-playlist-card__link" href="${cfg.escapeHtml(href)}">再生リストの全体を見る</a>
        </div>
      </article>`;
  }

  function renderPlaylistsTabHtml(playlists, bundle) {
    const cards = playlists
      .map((playlist) => renderChannelPlaylistCard(playlist, resolvePlaylistCountMeta(playlist, bundle)))
      .join("");
    return `<div class="tlv-channel-playlist-grid" data-tlv-channel-playlist-grid>${cards}</div>`;
  }

  function renderPostsDemoCard(item, { kind = "video" } = {}) {
    const cfg = C();
    const tone = cfg.escapeHtml(String(item.collageTone || "default"));
    const href = kind === "short" ? "shorts.html" : kind === "live" ? "broadcasts.html" : "videos.html";
    const viewsHtml =
      kind === "video" && item.views != null
        ? `<p class="tlv-channel-post-card__meta">${Number(item.views).toLocaleString("ja-JP")} 回視聴</p>`
        : "";
    return `
      <article class="tlv-channel-post-card">
        <a class="tlv-channel-post-card__media" href="${href}">
          <div class="tlv-channel-post-card__thumb tlv-channel-post-card__thumb--${tone}">
            ${kind === "live" ? '<span class="tlv-channel-post-card__live-badge">LIVE</span>' : ""}
            ${kind === "short" ? '<span class="tlv-channel-post-card__short-badge">SHORT</span>' : ""}
          </div>
        </a>
        <a class="tlv-channel-post-card__title" href="${href}">${cfg.escapeHtml(item.title || "無題")}</a>
        ${viewsHtml}
      </article>`;
  }

  function renderPostsSection(title, items, kind) {
    const cfg = C();
    const cards = items.map((item) => renderPostsDemoCard(item, { kind })).join("");
    return `
      <section class="tlv-channel-posts-section">
        <h2 class="tlv-channel-posts-section__title">${cfg.escapeHtml(title)}</h2>
        <div class="tlv-channel-posts-section__grid">${cards}</div>
      </section>`;
  }

  function renderPostsSectionsHtml(sections, { showEmpty = false } = {}) {
    const hasItems = sections.videos.length || sections.shorts.length || sections.live.length;
    const body = [
      sections.videos.length ? renderPostsSection("動画", sections.videos, "video") : "",
      sections.shorts.length ? renderPostsSection("ショート", sections.shorts, "short") : "",
      sections.live.length ? renderPostsSection("ライブ", sections.live, "live") : "",
    ].join("");

    if (!hasItems && showEmpty) {
      return `
        <div class="tlv-channel-posts-sections tlv-channel-posts-sections--empty" data-tlv-channel-posts-grid>
          <section class="tlv-channel-posts-section tlv-channel-posts-section--placeholder">
            <h2 class="tlv-channel-posts-section__title">動画</h2>
          </section>
          <section class="tlv-channel-posts-section tlv-channel-posts-section--placeholder">
            <h2 class="tlv-channel-posts-section__title">ショート</h2>
          </section>
          <section class="tlv-channel-posts-section tlv-channel-posts-section--placeholder">
            <h2 class="tlv-channel-posts-section__title">ライブ</h2>
          </section>
          <p class="tlv-channel-posts-empty">投稿はまだありません</p>
        </div>`;
    }

    return `<div class="tlv-channel-posts-sections" data-tlv-channel-posts-grid>${body}</div>`;
  }

  function filterDemoPostsSections(query) {
    const term = String(query || "").trim().toLowerCase();
    if (!term) return DEMO_POSTS_SECTIONS;
    const match = (item) => String(item.title || "").toLowerCase().includes(term);
    return {
      videos: DEMO_POSTS_SECTIONS.videos.filter(match),
      shorts: DEMO_POSTS_SECTIONS.shorts.filter(match),
      live: DEMO_POSTS_SECTIONS.live.filter(match),
    };
  }

  async function renderPostsTabHtml(creatorUserId, isOwn, query = "") {
    if (isProfileDemoMode()) {
      const sections = filterDemoPostsSections(query);
      return renderPostsSectionsHtml(sections, { showEmpty: false });
    }

    const videosApi = global.TasuLiveVideos;
    if (!videosApi?.fetchCreatorChannelVideos) {
      return renderPostsSectionsHtml({ videos: [], shorts: [], live: [] }, { showEmpty: true });
    }

    const [videos, shorts, broadcasts] = await Promise.all([
      videosApi.fetchCreatorChannelVideos(creatorUserId, { isOwn, limit: 48 }).catch(() => []),
      videosApi.fetchCreatorChannelShorts?.(creatorUserId, { isOwn, limit: 48 }).catch(() => []) || [],
      videosApi.fetchCreatorChannelBroadcasts?.(creatorUserId, { isOwn, limit: 48 }).catch(() => []) || [],
    ]);

    const term = String(query || "").trim().toLowerCase();
    const filterByTitle = (items) => {
      if (!term) return items;
      return items.filter((item) => String(item?.title || "").toLowerCase().includes(term));
    };

    const filteredVideos = filterByTitle(videos);
    const filteredShorts = filterByTitle(shorts);
    const filteredLive = filterByTitle(broadcasts);

    if (!filteredVideos.length && !filteredShorts.length && !filteredLive.length) {
      return renderPostsSectionsHtml({ videos: [], shorts: [], live: [] }, { showEmpty: true });
    }

    const cfg = C();
    const renderVideoCards = (items, kind) => {
      if (!items.length) return "";
      const cards = items
        .map((item) => {
          if (kind === "video" && videosApi.renderVideoCard) return videosApi.renderVideoCard(item);
          return renderPostsDemoCard(
            {
              id: item.id,
              title: item.title,
              collageTone: "default",
              views: item.views_count ?? item.view_count,
            },
            { kind: kind === "short" ? "short" : kind === "live" ? "live" : "video" },
          );
        })
        .join("");
      const title = kind === "short" ? "ショート" : kind === "live" ? "ライブ" : "動画";
      return `
        <section class="tlv-channel-posts-section">
          <h2 class="tlv-channel-posts-section__title">${cfg.escapeHtml(title)}</h2>
          <div class="tlv-channel-posts-section__grid tlv-channel-posts-grid">${cards}</div>
        </section>`;
    };

    return `<div class="tlv-channel-posts-sections" data-tlv-channel-posts-grid>${renderVideoCards(filteredVideos, "video")}${renderVideoCards(filteredShorts, "short")}${renderVideoCards(filteredLive, "live")}</div>`;
  }

  function renderChannelPageShell(profile, userId, stats, { isOwn = false } = {}) {
    return `
      <div class="tlv-channel" data-tlv-channel data-creator-id="${C().escapeHtml(userId)}">
        ${renderChannelHeader(profile, userId, stats, { isOwn })}
        ${renderChannelTabs("playlists")}
        <div class="tlv-channel-content" data-tlv-channel-content>
          <p class="live-loading live-loading--inline">コンテンツを読み込み中…</p>
        </div>
      </div>
    `;
  }

  function renderTalkCtaButton() {
    const bridge = global.TasuLiveTalkBridge;
    if (bridge?.renderTalkCtaButton) return bridge.renderTalkCtaButton();
    return `
      <button type="button" class="live-btn live-btn--secondary" data-live-talk-cta>
        TALKで相談
      </button>
    `;
  }

  async function refreshFollowerCountDisplay(creatorUserId, root) {
    const id = String(creatorUserId || "").trim();
    const host = root || global.document;
    const el = host.querySelector?.("[data-live-follower-count]");
    if (!el) return null;
    try {
      const profile = await fetchProfile(id);
      if (!profile) return null;
      el.textContent = Number(profile.follower_count ?? 0).toLocaleString("ja-JP");
      return profile;
    } catch (err) {
      console.warn("[TasuLiveProfile] follower_count refresh failed:", err);
      return null;
    }
  }

  async function bindProfileActions(root, targetId, isOwn) {
    const cfg = C();
    const actions = root.querySelector("[data-live-profile-actions]");
    if (!actions) return;

    if (isOwn) {
      actions.innerHTML = `
        <a class="live-btn live-btn--ghost tlv-channel-header__btn" href="settings.html">チャンネルをカスタマイズ</a>
        <a class="live-btn live-btn--ghost tlv-channel-header__btn" href="channel-content.html">動画を管理</a>
      `;
      return;
    }

    actions.innerHTML = "";
    if (global.TasuLiveFollow?.mountFollowButton) {
      await global.TasuLiveFollow.mountFollowButton(actions, targetId, root, { channelMode: true });
    }

    actions.insertAdjacentHTML("beforeend", renderTalkCtaButton());
    const talkBtn = actions.querySelector("[data-live-talk-cta]");
    global.TasuLiveTalkBridge?.bindTalkCtaButton?.(talkBtn, targetId);
  }

  function setProfileSubtitleText(text) {
    global.TasuTlvNav?.setProfileSubtitle?.(text);
  }

  async function renderChannelTabContent(tabId, creatorUserId, isOwn, { query = "", bundle = null, playlists = [] } = {}) {
    if (tabId === "posts") {
      return renderPostsTabHtml(creatorUserId, isOwn, query);
    }
    const playlistBundle = bundle || (await fetchChannelPlaylistBundle(creatorUserId, isOwn));
    const playlistItems = playlists.length ? playlists : buildChannelPlaylists(creatorUserId, isOwn);
    return renderPlaylistsTabHtml(playlistItems, playlistBundle);
  }

  function bindChannelTabs(root, creatorUserId, isOwn, bundle, playlists, initialTab = "playlists") {
    const tabs = root.querySelector("[data-tlv-channel-tabs]");
    const content = root.querySelector("[data-tlv-channel-content]");
    const searchToggle = root.querySelector("[data-tlv-channel-search-toggle]");
    const searchPanel = root.querySelector("[data-tlv-channel-search-panel]");
    const searchInput = root.querySelector("[data-tlv-channel-search-input]");
    if (!tabs || !content) return Promise.resolve();

    let activeTab = initialTab === "posts" ? "posts" : "playlists";
    let searchQuery = "";
    let searchTimer = null;

    async function loadTab(tabId, query = searchQuery) {
      activeTab = tabId;
      tabs.querySelectorAll("[data-tlv-channel-tab]").forEach((btn) => {
        const id = btn.getAttribute("data-tlv-channel-tab");
        const active = id === tabId;
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-selected", active ? "true" : "false");
      });
      content.innerHTML = '<p class="live-loading live-loading--inline">読み込み中…</p>';
      try {
        content.innerHTML = await renderChannelTabContent(tabId, creatorUserId, isOwn, {
          query,
          bundle,
          playlists,
        });
        content.querySelectorAll("[data-tlv-channel-playlist-menu]").forEach((btn) => {
          btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            global.alert("再生リストメニューは今後追加予定です。");
          });
        });
      } catch (err) {
        console.error("[TasuLiveProfile] channel tab", err);
        content.innerHTML = `<p class="live-error">読み込みに失敗しました: ${C().escapeHtml(err.message || err)}</p>`;
      }
    }

    tabs.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-tlv-channel-tab]");
      if (!btn) return;
      loadTab(String(btn.getAttribute("data-tlv-channel-tab") || "playlists"));
    });

    searchToggle?.addEventListener("click", () => {
      const nextHidden = !searchPanel?.hidden;
      if (searchPanel) searchPanel.hidden = nextHidden;
      searchToggle.classList.toggle("is-active", !nextHidden);
      if (!nextHidden) {
        searchInput?.focus();
        if (activeTab !== "posts") loadTab("posts");
      }
    });

    searchInput?.addEventListener("input", () => {
      searchQuery = String(searchInput.value || "");
      global.clearTimeout(searchTimer);
      searchTimer = global.setTimeout(() => {
        if (activeTab !== "posts") {
          loadTab("posts");
          return;
        }
        loadTab("posts", searchQuery);
      }, 220);
    });

    return loadTab(activeTab);
  }

  async function mountChannelTabsOnRoot(root, creatorUserId, isOwn) {
    const params = new URLSearchParams(global.location?.search || "");
    const tabParam = String(params.get("tab") || "").trim();
    const initialTab = tabParam === "posts" ? "posts" : "playlists";
    const bundle = isProfileDemoMode()
      ? buildDemoPlaylistBundle()
      : await fetchChannelPlaylistBundle(creatorUserId, isOwn);
    const playlists = buildChannelPlaylists(creatorUserId, isOwn);
    return bindChannelTabs(root, creatorUserId, isOwn, bundle, playlists, initialTab);
  }

  async function mountProfilePage(root, options = {}) {
    const cfg = C();
    const params = new URLSearchParams(global.location?.search || "");
    const viewerId = global.TasuTlvDevAuth?.getTlvViewerTalkUserId
      ? global.TasuTlvDevAuth.getTlvViewerTalkUserId()
      : cfg.getTalkUserId();
    const targetId = String(params.get("userId") || viewerId || "").trim();

    const roots = (options.roots || [root]).filter(Boolean);
    const writeRoots = (html) => {
      roots.filter(Boolean).forEach((r) => {
        r.innerHTML = html;
      });
    };

    if (!targetId) {
      writeRoots('<p class="live-error">userId を指定してください。</p>');
      return;
    }

    writeRoots('<p class="live-loading">読み込み中…</p>');

    try {
      const profile = await fetchProfile(targetId);
      const isOwn = Boolean(viewerId && viewerId === targetId);
      const videosApi = global.TasuLiveVideos;

      let stats = { videoCount: 0, totalViews: 0 };
      try {
        if (videosApi?.fetchCreatorChannelStats) {
          stats = await videosApi.fetchCreatorChannelStats(targetId, { isOwn });
        }
      } catch (statsErr) {
        console.warn("[TasuLiveProfile] channel stats skipped:", statsErr);
      }

      if (isProfileDemoMode()) {
        stats = { ...stats, videoCount: DEMO_PLAYLIST_META.videos.count };
      }

      writeRoots(renderChannelPageShell(profile, targetId, stats, { isOwn }));

      for (const r of roots) {
        await bindProfileActions(r, targetId, isOwn);
        await mountChannelTabsOnRoot(r, targetId, isOwn);
      }

      setProfileSubtitleText(
        isOwn ? "自分のチャンネル" : `${cfg.resolveDisplayName(targetId)} のチャンネル`,
      );
    } catch (err) {
      const msg = String(err?.message || err);
      if (msg.includes("未設定")) {
        writeRoots(`<p class="live-error">${cfg.escapeHtml(msg)}</p>`);
      } else {
        console.error("[TasuLiveProfile]", err);
        writeRoots(`<p class="live-error">読み込みに失敗しました: ${cfg.escapeHtml(msg)}</p>`);
      }
    }
  }

  async function mountProfileVideosSection(root, creatorUserId, isOwn) {
    const videosApi = global.TasuLiveVideos;
    if (!videosApi?.fetchCreatorChannelVideos || !videosApi?.renderProfileVideosSection) return;

    let host = root.querySelector("[data-tlv-channel-content]") || root.querySelector("[data-live-profile-videos-host]");
    if (!host) {
      root.insertAdjacentHTML("beforeend", '<div data-tlv-channel-content></div>');
      host = root.querySelector("[data-tlv-channel-content]");
    }
    if (!host) return;

    host.innerHTML = '<p class="live-loading live-loading--inline">動画を読み込み中…</p>';

    try {
      const videos = await videosApi.fetchCreatorChannelVideos(creatorUserId, { isOwn });
      host.innerHTML = videosApi.renderProfileVideosSection(videos, {
        isOwn,
        creatorUserId,
      });
    } catch (err) {
      console.warn("[TasuLiveProfile] channel videos skipped:", err);
      host.innerHTML = `<p class="live-muted">動画一覧の読み込みに失敗しました。</p>`;
    }
  }

  async function mountSettingsPage(root) {
    const cfg = C();
    const talkUserId = cfg.getTalkUserId();

    if (!talkUserId) {
      root.innerHTML = '<p class="live-error">ログインが必要です。</p>';
      return;
    }

    root.innerHTML = '<p class="live-loading">読み込み中…</p>';

    let profile = null;
    try {
      profile = await fetchProfile(talkUserId);
    } catch (err) {
      console.error("[TasuLiveProfile]", err);
      root.innerHTML = `<p class="live-error">読み込みに失敗しました: ${cfg.escapeHtml(err.message || err)}</p>`;
      return;
    }

    const isNew = !profile;
    root.innerHTML = `
      <form class="live-settings-form" data-live-settings-form novalidate>
        <section class="live-panel">
          <h2 class="live-panel__title">公開ステータス</h2>
          ${profile ? renderStatusBadges(profile) : ""}
          ${
            isNew
              ? `
          <fieldset class="live-fieldset">
            <legend class="live-fieldset__legend">初回作成時の公開設定</legend>
            <label class="live-radio">
              <input type="radio" name="creator_status" value="draft" checked />
              <span>下書き（自分だけ閲覧）</span>
            </label>
            <label class="live-radio">
              <input type="radio" name="creator_status" value="active" />
              <span>公開する（フォロー可能）</span>
            </label>
          </fieldset>`
              : `<p class="live-hint">creator_status は作成後は運営・本人確認フローで更新されます（自分では変更不可）。</p>`
          }
        </section>
        <section class="live-panel">
          <h2 class="live-panel__title">プロフィール</h2>
          <label class="live-field">
            <span class="live-field__label">自己紹介（500文字以内）</span>
            <textarea class="live-textarea" name="bio" rows="5" maxlength="500" placeholder="配信・ショートの紹介文">${cfg.escapeHtml(profile?.bio || "")}</textarea>
          </label>
        </section>
        <section class="live-panel">
          <h2 class="live-panel__title">通知</h2>
          <label class="live-check">
            <input type="checkbox" name="live_notify_default" ${profile?.live_notify_default !== false ? "checked" : ""} />
            <span>LIVE 通知を受け取る</span>
          </label>
          <label class="live-check">
            <input type="checkbox" name="tip_message_enabled" ${profile?.tip_message_enabled !== false ? "checked" : ""} />
            <span>投げ銭メッセージを受け付ける（P0 スタブ）</span>
          </label>
        </section>
        <div class="live-settings-form__actions">
          <button type="submit" class="live-btn live-btn--primary">保存する</button>
          <a class="live-btn live-btn--ghost" href="${cfg.profileUrl(talkUserId)}">プロフィールを見る</a>
        </div>
        <p class="live-form-status" data-live-form-status role="status" aria-live="polite"></p>
      </form>
    `;

    const form = root.querySelector("[data-live-settings-form]");
    const statusEl = root.querySelector("[data-live-form-status]");

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      statusEl.textContent = "保存中…";
      statusEl.className = "live-form-status live-form-status--pending";

      const fd = new FormData(form);
      const payload = {
        bio: String(fd.get("bio") || "").trim() || null,
        live_notify_default: fd.get("live_notify_default") === "on",
        tip_message_enabled: fd.get("tip_message_enabled") === "on",
      };
      if (isNew) {
        payload.creator_status = String(fd.get("creator_status") || "draft");
      }

      try {
        await upsertOwnProfile(payload);
        statusEl.textContent = "保存しました";
        statusEl.className = "live-form-status live-form-status--ok";
        setTimeout(() => {
          global.location.href = cfg.profileUrl(talkUserId);
        }, 600);
      } catch (err) {
        console.error("[TasuLiveProfile]", err);
        statusEl.textContent = `保存に失敗しました: ${err.message || err}`;
        statusEl.className = "live-form-status live-form-status--error";
      }
    });
  }

  global.TasuLiveProfile = {
    fetchProfile,
    upsertOwnProfile,
    mountProfilePage,
    mountProfileVideosSection,
    mountSettingsPage,
    renderStatusBadges,
    renderChannelHeader,
    refreshFollowerCountDisplay,
    buildChannelPlaylists,
    buildLibraryPlaylists,
    sortChannelPlaylists,
    readUserCreatedPlaylists,
    fetchChannelPlaylistBundle,
    resolvePlaylistCountMeta,
    isProfileDemoMode,
  };
})(typeof window !== "undefined" ? window : globalThis);
