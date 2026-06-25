/**
 * TASFUL LIVE — 長尺動画一覧（YouTube P1 Phase 4）
 */
(function (global) {
  "use strict";

  const C = () => global.TasuLiveConfig;

  const CATEGORY_MATCHERS = Object.freeze({
    "": () => true,
    "home-building": (v) => /住|建|リフォーム|施工|建築|住宅/.test(`${v.title || ""} ${v.description || ""}`),
    business: (v) => /ビジネス|仕事|営業|経営|現場/.test(`${v.title || ""} ${v.description || ""}`),
    howto: (v) => /ノウハウ|方法|やり方|解説|講座/.test(`${v.title || ""} ${v.description || ""}`),
    entertainment: (v) => /エンタメ|Vlog|vlog/.test(`${v.title || ""} ${v.description || ""}`),
    ai: (v) => /AI|人工知能|生成|ChatGPT|Gemini/.test(`${v.title || ""} ${v.description || ""}`),
    music: (v) => /音楽|楽曲|歌|ライブ配信|演奏/.test(`${v.title || ""} ${v.description || ""}`),
    game: (v) => /ゲーム|プレイ|実況|eスポーツ/.test(`${v.title || ""} ${v.description || ""}`),
    live: (v) => /ライブ|配信|LIVE|生放送/.test(`${v.title || ""} ${v.description || ""}`),
  });

  function filterByCategory(videos, categoryId) {
    const fn = CATEGORY_MATCHERS[categoryId] || CATEGORY_MATCHERS[""];
    return (videos || []).filter(fn);
  }

  function isAuthenticatedTalkUser() {
    const auth = global.TasuAuthCurrentUser?.getCurrentUser?.();
    return Boolean(auth?.authenticated && auth?.talkUserId);
  }

  function renderFollowingEmptyHtml() {
    const cfg = C();
    const loggedIn = isAuthenticatedTalkUser();
    const message = loggedIn
      ? "登録チャンネルはまだありません"
      : "ログインすると登録チャンネルを表示できます";
    return `
      <div class="tlv-videos-following-empty tlv-videos-following-empty--standalone" data-tlv-following-empty>
        <p class="tlv-videos-following-empty__message">${cfg.escapeHtml(message)}</p>
      </div>`;
  }

  function renderFollowingPageHeaderHtml(options = {}) {
    const cfg = C();
    const sortHtml = options.showSort
      ? `<p class="tlv-videos-following-sort">${cfg.escapeHtml("新しい順")}</p>`
      : "";
    return `
      <header class="tlv-videos-following-header">
        <h1 class="tlv-videos-following-title">${cfg.escapeHtml("登録チャンネル")}</h1>
        ${sortHtml}
      </header>`;
  }

  function renderFollowingEmptyPageHtml() {
    return `
      <div class="tlv-videos-home tlv-videos-home--following tlv-videos-home--subscriptions" data-live-videos-home>
        ${renderFollowingPageHeaderHtml()}
        ${renderFollowingEmptyHtml()}
      </div>`;
  }

  function renderFollowingChannelsStrip(creatorIds) {
    const cfg = C();
    const ids = (creatorIds || []).filter(Boolean);
    if (!ids.length) return "";
    const items = ids.slice(0, 24).map((id) => {
      const name = cfg.resolveDisplayName(id);
      const avatarUrl = cfg.resolveAvatarUrl(id);
      const profileHref = cfg.profileUrl(id);
      const initial = encodeURIComponent(String(name).slice(0, 2) || "LV");
      return `
        <a class="tlv-videos-following-channel" href="${cfg.escapeHtml(profileHref)}" title="${cfg.escapeHtml(name)}">
          <span class="tlv-videos-following-channel__avatar">
            <img src="${cfg.escapeHtml(avatarUrl)}" alt="" width="56" height="56" loading="lazy"
              onerror="this.src='https://placehold.co/56x56/1a1030/e879f9?text=${cfg.escapeHtml(initial)}'" />
          </span>
          <span class="tlv-videos-following-channel__name">${cfg.escapeHtml(name)}</span>
        </a>`;
    });
    return `
      <div class="tlv-videos-following-channels" role="list" aria-label="登録チャンネル">
        ${items.join("")}
      </div>`;
  }

  async function ensureSupabaseSessionSafe() {
    const cfg = C();
    try {
      return await Promise.race([
        cfg.ensureSupabaseSession(),
        new Promise((_, reject) => {
          global.setTimeout(() => reject(new Error("session timeout")), 8000);
        }),
      ]);
    } catch (err) {
      console.warn("[TasuLiveVideos] session skipped:", err.message || err);
      return null;
    }
  }

  async function fetchFollowingCreatorIds() {
    const cfg = C();
    if (!isAuthenticatedTalkUser()) return [];
    const userId = global.TasuAuthCurrentUser?.getCurrentUser?.()?.talkUserId || cfg.getTalkUserId();
    if (!userId) return [];
    try {
      const session = await ensureSupabaseSessionSafe();
      if (!session?.access_token) return [];
      const client = cfg.getClient();
      if (!client) return [];
      const { data, error } = await client
        .from(cfg.TABLES.follows)
        .select("creator_id")
        .eq("follower_id", userId);
      if (error) {
        console.warn("[TasuLiveVideos] follows fetch skipped:", error.message || error);
        return [];
      }
      return (data || []).map((r) => r.creator_id).filter(Boolean);
    } catch (err) {
      console.warn("[TasuLiveVideos] follows fetch skipped:", err.message || err);
      return [];
    }
  }

  function sanitizeSearchQuery(raw) {
    return String(raw || "")
      .trim()
      .replace(/[%_,]/g, "")
      .slice(0, 80);
  }

  async function fetchPublishedShorts(limit = 24) {
    const cfg = C();
    await cfg.ensureSupabaseSession();
    const { data, error } = await cfg
      .getClient()
      .from(cfg.TABLES.shorts)
      .select("id, creator_id, title, description, duration_sec, view_count, published_at, created_at")
      .eq("status", "published")
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  }

  async function fetchFollowingVideos(creatorIds, { limit = 48, offset = 0 } = {}) {
    const cfg = C();
    const ids = (creatorIds || []).filter(Boolean);
    if (!ids.length) return [];
    const safeLimit = Math.max(1, Math.min(Number(limit) || 48, 48));
    const safeOffset = Math.max(0, Number(offset) || 0);
    try {
      await ensureSupabaseSessionSafe();
      const client = cfg.getClient();
      if (!client) return [];
      const { data, error } = await client
        .from(cfg.TABLES.videos)
        .select(
          "id, talk_user_id, title, description, thumbnail_path, duration_sec, views_count, likes_count, published_at",
        )
        .eq("status", "published")
        .eq("visibility", "public")
        .in("talk_user_id", ids)
        .order("published_at", { ascending: false })
        .range(safeOffset, safeOffset + safeLimit - 1);
      if (error) {
        console.warn("[TasuLiveVideos] following videos fetch skipped:", error.message || error);
        return [];
      }
      return data || [];
    } catch (err) {
      console.warn("[TasuLiveVideos] following videos fetch skipped:", err.message || err);
      return [];
    }
  }

  async function fetchFollowingShorts(creatorIds, limit = 24) {
    const cfg = C();
    const ids = (creatorIds || []).filter(Boolean);
    if (!ids.length) return [];
    try {
      await ensureSupabaseSessionSafe();
      const client = cfg.getClient();
      if (!client) return [];
      const { data, error } = await client
        .from(cfg.TABLES.shorts)
        .select("id, creator_id, title, description, duration_sec, view_count, published_at, created_at")
        .eq("status", "published")
        .in("creator_id", ids)
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) {
        console.warn("[TasuLiveVideos] following shorts fetch skipped:", error.message || error);
        return [];
      }
      return data || [];
    } catch (err) {
      console.warn("[TasuLiveVideos] following shorts fetch skipped:", err.message || err);
      return [];
    }
  }

  async function fetchFollowingFeedData() {
    const creatorIds = await fetchFollowingCreatorIds();
    if (!creatorIds.length) {
      return { creatorIds: [], videos: [], shorts: [], hasMore: false, videoOffset: 0 };
    }
    const [videos, shorts] = await Promise.all([
      fetchFollowingVideos(creatorIds, { limit: FOLLOWING_PAGE_SIZE, offset: 0 }),
      fetchFollowingShorts(creatorIds, 24),
    ]);
    return {
      creatorIds,
      videos,
      shorts,
      hasMore: videos.length >= FOLLOWING_PAGE_SIZE,
      videoOffset: videos.length,
    };
  }

  async function fetchPublishedVideos({ limit = 48, query = "", feed = "recommended" } = {}) {
    const cfg = C();

    if (feed === "following") {
      const { videos } = await fetchFollowingFeedData();
      return videos;
    }

    await ensureSupabaseSessionSafe();

    let orderCol = "published_at";
    if (feed === "trending") orderCol = "views_count";

    const client = cfg.getClient();
    if (!client) return [];

    let q = client
      .from(cfg.TABLES.videos)
      .select(
        "id, talk_user_id, title, description, thumbnail_path, duration_sec, views_count, likes_count, published_at",
      )
      .eq("status", "published")
      .eq("visibility", "public")
      .order(orderCol, { ascending: false })
      .limit(limit);

    if (feed === "new") {
      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      q = q.gte("published_at", since);
    }

    const term = sanitizeSearchQuery(query);
    if (term) {
      const pattern = `%${term}%`;
      q = q.or(`title.ilike.${pattern},description.ilike.${pattern}`);
    }

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  async function fetchCreatorChannelVideos(creatorUserId, { isOwn = false, limit = 48, sort = "default" } = {}) {
    const cfg = C();
    await cfg.ensureSupabaseSession();
    const id = String(creatorUserId || "").trim();
    if (!id) return [];

    let q = cfg
      .getClient()
      .from(cfg.TABLES.videos)
      .select(
        "id, talk_user_id, title, thumbnail_path, duration_sec, views_count, likes_count, status, visibility, published_at, created_at",
      )
      .eq("talk_user_id", id)
      .limit(limit);

    if (sort === "popular") {
      q = q.order("views_count", { ascending: false }).order("likes_count", { ascending: false });
    } else if (sort === "new") {
      q = q.order("created_at", { ascending: false });
    } else {
      q = q
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
    }

    if (!isOwn) {
      q = q.eq("status", "published").eq("visibility", "public");
    } else {
      q = q.neq("status", "removed");
    }

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  async function fetchCreatorChannelShorts(creatorUserId, { isOwn = false, limit = 48 } = {}) {
    const cfg = C();
    await cfg.ensureSupabaseSession();
    const id = String(creatorUserId || "").trim();
    if (!id) return [];

    let q = cfg
      .getClient()
      .from(cfg.TABLES.shorts)
      .select(
        "id, creator_id, title, description, duration_sec, view_count, like_count, status, published_at, created_at",
      )
      .eq("creator_id", id)
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!isOwn) {
      q = q.eq("status", "published");
    } else {
      q = q.neq("status", "removed");
    }

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  async function fetchCreatorChannelBroadcasts(creatorUserId, { isOwn = false, limit = 48 } = {}) {
    const cfg = C();
    await cfg.ensureSupabaseSession();
    const id = String(creatorUserId || "").trim();
    if (!id) return [];

    let q = cfg
      .getClient()
      .from(cfg.TABLES.broadcasts)
      .select("id, creator_id, title, status, scheduled_at, started_at, created_at")
      .eq("creator_id", id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!isOwn) {
      q = q.in("status", ["live", "scheduled", "ended"]);
    }

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  async function fetchCreatorChannelStats(creatorUserId, { isOwn = false } = {}) {
    const videos = await fetchCreatorChannelVideos(creatorUserId, { isOwn, limit: 500, sort: "default" });
    const videoCount = videos.length;
    const totalViews = videos.reduce((sum, row) => sum + Number(row.views_count || 0), 0);
    return { videoCount, totalViews };
  }

  const CHANNEL_TYPE_LABELS = Object.freeze({
    video: "動画",
    short: "ショート",
    live: "ライブ",
  });

  function renderChannelTypeBadge(type) {
    const cfg = C();
    const label = CHANNEL_TYPE_LABELS[type] || type;
    return `<span class="tlv-channel-card__type">${cfg.escapeHtml(label)}</span>`;
  }

  function renderChannelVideoCard(video, options = {}) {
    const cfg = C();
    const showBadges = Boolean(options.showBadges);
    const thumbUrl = resolveThumbUrl(video);
    const watchUrl = cfg.watchVideoUrl(video.id);
    const views = Number(video.views_count ?? 0).toLocaleString("ja-JP");
    const date = cfg.formatVideoDate(video.published_at || video.created_at);

    const thumbInner = thumbUrl
      ? `<img class="live-video-grid-card__thumb-img" src="${cfg.escapeHtml(thumbUrl)}" alt="" loading="lazy" />`
      : `<div class="live-video-grid-card__thumb-placeholder" aria-hidden="true"><span>動画</span></div>`;

    return `
      <a class="live-video-grid-card tlv-channel-card" href="${cfg.escapeHtml(watchUrl)}" data-live-video-id="${cfg.escapeHtml(video.id)}">
        <div class="live-video-grid-card__thumb">
          ${thumbInner}
          ${renderChannelTypeBadge("video")}
          ${renderVideoStatusBadges(video, { showBadges })}
        </div>
        <div class="live-video-grid-card__body">
          <h3 class="live-video-grid-card__title">${cfg.escapeHtml(video.title)}</h3>
          <p class="live-video-grid-card__meta">
            <span>再生 ${views}</span>
            <span>${cfg.escapeHtml(date)}</span>
          </p>
        </div>
      </a>
    `;
  }

  function renderChannelShortCard(short) {
    const cfg = C();
    const views = Number(short.view_count ?? 0).toLocaleString("ja-JP");
    const date = cfg.formatVideoDate(short.published_at || short.created_at);
    const href = `shorts.html?creator=${encodeURIComponent(short.creator_id)}`;

    return `
      <a class="live-video-grid-card tlv-channel-card tlv-channel-card--short" href="${cfg.escapeHtml(href)}" data-live-short-id="${cfg.escapeHtml(short.id)}">
        <div class="live-video-grid-card__thumb live-video-grid-card__thumb--portrait">
          <div class="live-video-grid-card__thumb-placeholder" aria-hidden="true"><span>ショート</span></div>
          ${renderChannelTypeBadge("short")}
        </div>
        <div class="live-video-grid-card__body">
          <h3 class="live-video-grid-card__title">${cfg.escapeHtml(short.title)}</h3>
          <p class="live-video-grid-card__meta">
            <span>再生 ${views}</span>
            <span>${Number(short.duration_sec || 0)}秒</span>
            <span>${cfg.escapeHtml(date)}</span>
          </p>
        </div>
      </a>
    `;
  }

  function renderChannelBroadcastCard(broadcast) {
    const cfg = C();
    const status = cfg.labelBroadcastStatus(broadcast.status);
    const date = cfg.formatVideoDate(broadcast.started_at || broadcast.scheduled_at || broadcast.created_at);
    const isLive = broadcast.status === "live";

    return `
      <a class="live-video-grid-card tlv-channel-card tlv-channel-card--live${isLive ? " tlv-channel-card--live-now" : ""}" href="${cfg.escapeHtml(cfg.watchUrl(broadcast.id))}" data-live-broadcast-id="${cfg.escapeHtml(broadcast.id)}">
        <div class="live-video-grid-card__thumb">
          <div class="live-video-grid-card__thumb-placeholder" aria-hidden="true"><span>${isLive ? "LIVE" : "配信"}</span></div>
          ${renderChannelTypeBadge("live")}
          <span class="tlv-channel-card__live-status">${cfg.escapeHtml(status)}</span>
        </div>
        <div class="live-video-grid-card__body">
          <h3 class="live-video-grid-card__title">${cfg.escapeHtml(broadcast.title)}</h3>
          <p class="live-video-grid-card__meta">
            <span>${cfg.escapeHtml(status)}</span>
            <span>${cfg.escapeHtml(date)}</span>
          </p>
        </div>
      </a>
    `;
  }

  function renderChannelEmpty(tabId, { isOwn = false } = {}) {
    const cfg = C();
    const messages = {
      videos: { text: "まだ動画がありません", upload: true },
      shorts: { text: "まだショートがありません", upload: true, shortUpload: true },
      live: { text: "まだライブ配信がありません", upload: false },
      popular: { text: "まだ動画がありません", upload: true },
      new: { text: "まだ動画がありません", upload: true },
    };
    const msg = messages[tabId] || messages.videos;
    const actions = [];
    if (isOwn && msg.upload) {
      actions.push(`<a class="live-btn live-btn--primary" href="video-upload.html">動画を投稿する</a>`);
    }
    if (isOwn && msg.shortUpload) {
      actions.push(`<a class="live-btn live-btn--ghost" href="short-upload.html">ショートを投稿</a>`);
    }
    if (isOwn && tabId === "videos") {
      actions.push(`<a class="live-btn live-btn--ghost" href="${cfg.escapeHtml(cfg.myVideosUrl())}">マイページで管理</a>`);
    }

    return `
      <div class="live-empty live-empty--compact tlv-channel-empty">
        <p class="live-empty__title">${cfg.escapeHtml(msg.text)}</p>
        ${actions.length ? `<p class="tlv-channel-empty__actions">${actions.join("")}</p>` : ""}
      </div>
    `;
  }

  function renderChannelGridHtml(cardsHtml) {
    return `
      <div class="live-profile-videos-grid tlv-channel-grid" data-live-profile-videos-grid data-tlv-channel-grid>
        ${cardsHtml}
      </div>
    `;
  }

  async function renderChannelTabContent(tabId, creatorUserId, { isOwn = false } = {}) {
    const cfg = C();
    const id = String(creatorUserId || "").trim();
    if (!id) return `<p class="live-error">userId が不正です</p>`;

    if (tabId === "shorts") {
      const shorts = await fetchCreatorChannelShorts(id, { isOwn });
      if (!shorts.length) return renderChannelEmpty("shorts", { isOwn });
      return renderChannelGridHtml(shorts.map((s) => renderChannelShortCard(s)).join(""));
    }

    if (tabId === "live") {
      const broadcasts = await fetchCreatorChannelBroadcasts(id, { isOwn });
      if (!broadcasts.length) return renderChannelEmpty("live", { isOwn });
      return renderChannelGridHtml(broadcasts.map((b) => renderChannelBroadcastCard(b)).join(""));
    }

    const sort = tabId === "popular" ? "popular" : tabId === "new" ? "new" : "default";
    const videos = await fetchCreatorChannelVideos(id, { isOwn, sort });
    if (!videos.length) return renderChannelEmpty(tabId === "popular" ? "popular" : tabId === "new" ? "new" : "videos", { isOwn });
    return renderChannelGridHtml(videos.map((v) => renderChannelVideoCard(v, { showBadges: isOwn })).join(""));
  }

  const CHANNEL_TABS = Object.freeze([
    { id: "videos", label: "動画" },
    { id: "shorts", label: "ショート" },
    { id: "live", label: "ライブ" },
    { id: "popular", label: "人気" },
    { id: "new", label: "新着" },
  ]);

  function renderChannelTabs(activeTab = "videos") {
    const cfg = C();
    const tabs = CHANNEL_TABS.map((tab) => {
      const active = tab.id === activeTab ? " is-active" : "";
      return `<button type="button" class="tlv-channel-tab${active}" data-tlv-channel-tab="${cfg.escapeHtml(tab.id)}" role="tab" aria-selected="${tab.id === activeTab ? "true" : "false"}">${cfg.escapeHtml(tab.label)}</button>`;
    }).join("");
    return `<nav class="tlv-channel-tabs" data-tlv-channel-tabs role="tablist" aria-label="チャンネルコンテンツ">${tabs}</nav>`;
  }

  function bindChannelTabs(root, creatorUserId, isOwn) {
    const tabs = root.querySelector("[data-tlv-channel-tabs]");
    const content = root.querySelector("[data-tlv-channel-content]");
    if (!tabs || !content) return;

    async function loadTab(tabId) {
      tabs.querySelectorAll("[data-tlv-channel-tab]").forEach((btn) => {
        const id = btn.getAttribute("data-tlv-channel-tab");
        const active = id === tabId;
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-selected", active ? "true" : "false");
      });
      content.innerHTML = '<p class="live-loading live-loading--inline">読み込み中…</p>';
      try {
        content.innerHTML = await renderChannelTabContent(tabId, creatorUserId, { isOwn });
      } catch (err) {
        console.error("[TasuLiveVideos] channel tab", err);
        content.innerHTML = `<p class="live-error">読み込みに失敗しました: ${C().escapeHtml(err.message || err)}</p>`;
      }
    }

    tabs.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-tlv-channel-tab]");
      if (!btn) return;
      loadTab(String(btn.getAttribute("data-tlv-channel-tab") || "videos"));
    });

    return loadTab("videos");
  }

  function renderVideoStatusBadges(video, { showBadges = false } = {}) {
    const cfg = C();
    if (!showBadges) return "";
    const status = String(video?.status || "");
    const visibility = String(video?.visibility || "");
    const parts = [];
    if (status && status !== "published") {
      parts.push(
        `<span class="live-video-badge live-video-badge--status live-video-badge--status-${cfg.escapeHtml(status)}">${cfg.escapeHtml(cfg.labelVideoStatus(status))}</span>`,
      );
    }
    if (visibility && visibility !== "public") {
      parts.push(
        `<span class="live-video-badge live-video-badge--visibility">${cfg.escapeHtml(cfg.labelVideoVisibility(visibility))}</span>`,
      );
    }
    if (!parts.length) return "";
    return `<div class="live-video-badges">${parts.join("")}</div>`;
  }

  function renderVideoGridCard(video, options = {}) {
    const cfg = C();
    const showBadges = Boolean(options.showBadges);
    const thumbUrl = resolveThumbUrl(video);
    const watchUrl = cfg.watchVideoUrl(video.id);
    const views = Number(video.views_count ?? 0).toLocaleString("ja-JP");
    const date = cfg.formatVideoDate(video.published_at || video.created_at);
    const duration = video.duration_sec ? `${Number(video.duration_sec)}秒` : "";

    const thumbInner = thumbUrl
      ? `<img class="live-video-grid-card__thumb-img" src="${cfg.escapeHtml(thumbUrl)}" alt="" loading="lazy" />`
      : `<div class="live-video-grid-card__thumb-placeholder" aria-hidden="true"><span>動画</span></div>`;

    return `
      <a class="live-video-grid-card" href="${cfg.escapeHtml(watchUrl)}" data-live-video-id="${cfg.escapeHtml(video.id)}">
        <div class="live-video-grid-card__thumb">
          ${thumbInner}
          ${renderVideoStatusBadges(video, { showBadges })}
        </div>
        <div class="live-video-grid-card__body">
          <h3 class="live-video-grid-card__title">${cfg.escapeHtml(video.title)}</h3>
          <p class="live-video-grid-card__meta">
            <span>再生 ${views}</span>
            ${duration ? `<span>${duration}</span>` : ""}
            <span>${cfg.escapeHtml(date)}</span>
          </p>
        </div>
      </a>
    `;
  }

  function renderProfileVideosSection(videos, { isOwn = false, creatorUserId = "" } = {}) {
    const cfg = C();
    if (!videos.length) {
      return renderChannelEmpty("videos", { isOwn });
    }

    return `
      <section class="live-profile-section" aria-labelledby="live-profile-videos-heading">
        <div class="live-profile-section__head">
          <h2 class="live-profile-section__title" id="live-profile-videos-heading">動画</h2>
          ${
            isOwn
              ? `<a class="live-link" href="${cfg.escapeHtml(cfg.myVideosUrl())}">マイページで管理</a>`
              : ""
          }
        </div>
        ${renderChannelGridHtml(videos.map((v) => renderChannelVideoCard(v, { showBadges: isOwn })).join(""))}
      </section>
    `;
  }

  function resolveThumbUrl(video) {
    const cfg = C();
    const direct = String(video?.thumbnail_url || "").trim();
    if (/^https?:\/\//i.test(direct)) return direct;
    const path = String(video?.thumbnail_path || "").trim();
    if (!path) return null;
    return cfg.getPublicStorageUrl(cfg.STORAGE_BUCKET_VIDEO_THUMBS, path);
  }

  function formatDurationBadge(sec) {
    const total = Math.max(0, Math.floor(Number(sec) || 0));
    if (!total) return "";
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) {
      return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function formatViewCountLabel(count) {
    const v = Math.max(0, Number(count) || 0);
    if (v >= 100000000) {
      const n = (v / 100000000).toFixed(1).replace(/\.0$/, "");
      return `${n}億回視聴`;
    }
    if (v >= 10000) {
      const n = (v / 10000).toFixed(1).replace(/\.0$/, "");
      return `${n}万回視聴`;
    }
    if (v >= 1000) {
      const n = (v / 1000).toFixed(1).replace(/\.0$/, "");
      return `${n}千回視聴`;
    }
    return `${v.toLocaleString("ja-JP")}回視聴`;
  }

  function formatRelativePublishedDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    const diffMs = Date.now() - d.getTime();
    if (diffMs < 60_000) return "たった今";
    const min = Math.floor(diffMs / 60_000);
    if (min < 60) return `${min}分前`;
    const hour = Math.floor(min / 60);
    if (hour < 24) return `${hour}時間前`;
    const day = Math.floor(hour / 24);
    if (day < 7) return `${day}日前`;
    const week = Math.floor(day / 7);
    if (week < 5) return `${week}週間前`;
    const month = Math.floor(day / 30);
    if (month < 12) return `${month}ヶ月前`;
    const year = Math.floor(day / 365);
    return `${Math.max(1, year)}年前`;
  }

  const HOME_TOPICS = Object.freeze([
    { id: "game", label: "ゲーム", category: "entertainment" },
    { id: "music", label: "音楽", category: "entertainment" },
    { id: "live", label: "ライブ", category: "" },
    { id: "cooking", label: "料理", category: "howto" },
    { id: "sports", label: "スポーツ", category: "" },
    { id: "news", label: "ニュース", category: "" },
    { id: "learning", label: "学習", category: "howto" },
    { id: "entertainment", label: "エンタメ", category: "entertainment" },
  ]);

  const SHELF_META = Object.freeze({
    recommended: { title: "おすすめ", feed: "recommended" },
    popular: { title: "人気の動画", feed: "trending" },
    new: { title: "新着動画", feed: "new" },
  });

  const FOLLOWING_PAGE_SIZE = 24;

  function pickUniqueItems(pool, count, usedIds, idKey = "id") {
    const out = [];
    for (const item of pool || []) {
      const id = String(item?.[idKey] || "");
      if (!id || usedIds.has(id)) continue;
      usedIds.add(id);
      out.push(item);
      if (out.length >= count) break;
    }
    return out;
  }

  async function buildHomeFeedPayload({ query = "", feed = "recommended", category = "", shelf = "" } = {}) {
    const term = sanitizeSearchQuery(query);
    const shelfKey = String(shelf || "").trim();

    if (shelfKey && SHELF_META[shelfKey]) {
      const meta = SHELF_META[shelfKey];
      const videos = filterByCategory(
        await fetchPublishedVideos({ limit: 48, feed: meta.feed, query: term }),
        category,
      );
      return { mode: "shelf", shelf: shelfKey, title: meta.title, videos };
    }

    if (term) {
      const videos = filterByCategory(
        await fetchPublishedVideos({ limit: 48, query: term, feed }),
        category,
      );
      return { mode: "search", videos, query: term };
    }

    if (feed === "following") {
      const data = await fetchFollowingFeedData();
      return { mode: "following", ...data };
    }

    const feedKey = feed === "trending" ? "trending" : feed === "new" ? "new" : "recommended";
    const [recommendedPool, popularPool, latestPool, shortsResult] = await Promise.all([
      fetchPublishedVideos({ limit: 40, feed: feedKey }),
      fetchPublishedVideos({ limit: 40, feed: "trending" }),
      fetchPublishedVideos({ limit: 40, feed: "new" }),
      fetchPublishedShorts(24).catch((err) => {
        console.warn("[TasuLiveVideos] shorts fetch skipped:", err.message || err);
        return [];
      }),
    ]);
    const shortsPool = shortsResult;

    const recFiltered = filterByCategory(recommendedPool, category);
    const popFiltered = filterByCategory(popularPool, category);
    const latestFiltered = filterByCategory(latestPool, category);

    const usedVideoIds = new Set();
    const usedShortIds = new Set();

    const recommendedVideos = pickUniqueItems(recFiltered, 4, usedVideoIds);
    const popularVideos = pickUniqueItems(popFiltered, 4, usedVideoIds);
    const latestVideos = pickUniqueItems(latestFiltered, 9, usedVideoIds);

    const shortVideosA = pickUniqueItems(shortsPool, 6, usedShortIds);
    const shortVideosB = pickUniqueItems(shortsPool.slice(6), 6, usedShortIds);

    return {
      mode: "home",
      recommendedVideos,
      popularVideos,
      latestVideos,
      shortVideosA,
      shortVideosB,
    };
  }

  function renderHomeShortCard(short) {
    const cfg = C();
    const viewsLabel = formatViewCountLabel(short.view_count);
    const href =
      global.TasuLiveShorts?.shortWatchUrl?.(short.id) ||
      `/live/shorts/watch?id=${encodeURIComponent(short.id)}`;

    return `
      <a class="live-video-card live-video-card--yt live-video-card--short live-video-card--short-shelf" href="${cfg.escapeHtml(href)}" data-live-short-id="${cfg.escapeHtml(short.id)}">
        <div class="live-video-card__thumb live-video-card__thumb--portrait">
          <div class="live-video-card__thumb-placeholder" aria-hidden="true"></div>
        </div>
        <div class="live-video-card__info live-video-card__info--compact">
          <div class="live-video-card__details">
            <h3 class="live-video-card__title">${cfg.escapeHtml(short.title)}</h3>
            <p class="live-video-card__stats">${cfg.escapeHtml(viewsLabel)}</p>
          </div>
        </div>
      </a>
    `;
  }

  function renderVideoRow(videos, rowClass) {
    if (!videos?.length) return "";
    return `<div class="tlv-videos-section__row ${rowClass}">${videos.map((v) => renderVideoCard(v)).join("")}</div>`;
  }

  function renderShortRow(shorts) {
    if (!shorts?.length) return "";
    const renderCard = global.TasuLiveShorts?.renderShortGridCard;
    const cards = shorts.map((s) => (renderCard ? renderCard(s) : renderHomeShortCard(s)));
    return `<div class="tlv-videos-section__row tlv-shorts-tile-grid">${cards.join("")}</div>`;
  }

  function renderFollowingShortRow(shorts) {
    if (!shorts?.length) return "";
    const cards = shorts.map((s) => renderHomeShortCard(s));
    return `<div class="tlv-videos-section__row tlv-videos-section__row--shorts-scroll tlv-videos-following-shorts-scroll">${cards.join("")}</div>`;
  }

  function renderFeedSection(title, innerHtml, options = {}) {
    if (!innerHtml?.trim()) return "";
    const cfg = C();
    const extraClass = String(options.extraClass || "");
    const seeAllHref = String(options.seeAllHref || "");
    const seeAllShelf = String(options.seeAllShelf || "");
    let seeAllHtml = "";
    if (seeAllHref) {
      seeAllHtml = `<a class="tlv-videos-section__see-all" href="${cfg.escapeHtml(seeAllHref)}">すべて見る</a>`;
    } else if (seeAllShelf) {
      seeAllHtml = `<a class="tlv-videos-section__see-all" href="videos.html?shelf=${cfg.escapeHtml(seeAllShelf)}">すべて見る</a>`;
    }
    return `
      <section class="tlv-videos-section ${extraClass}">
        <div class="tlv-videos-section__head">
          <h2 class="tlv-videos-section__title">${cfg.escapeHtml(title)}</h2>
          ${seeAllHtml}
        </div>
        <div class="tlv-videos-section__body">
          ${innerHtml}
        </div>
      </section>`;
  }

  function renderTopicCards() {
    const cfg = C();
    const cards = HOME_TOPICS.map(
      (topic) => `
        <button type="button" class="tlv-videos-topic-card" data-tlv-home-topic="${cfg.escapeHtml(topic.category)}" data-tlv-topic-id="${cfg.escapeHtml(topic.id)}">
          <span class="tlv-videos-topic-card__label">${cfg.escapeHtml(topic.label)}</span>
        </button>`,
    ).join("");
    return `<div class="tlv-videos-section__topics" role="list">${cards}<span class="tlv-videos-topic-card tlv-videos-topic-card--more" aria-hidden="true">…</span></div>`;
  }

  function renderFollowingVideoGrid(videos) {
    if (!videos?.length) return "";
    return `<div class="tlv-videos-feed tlv-videos-following-grid" data-tlv-following-videos>${videos.map((v) => renderVideoCard(v)).join("")}</div>`;
  }

  function renderFollowingSubscriptionsHtml(payload) {
    const shorts = payload.shorts || [];
    const videos = payload.videos || [];
    const creatorIds = payload.creatorIds || [];
    const cfg = C();
    const hasMore = Boolean(payload.hasMore);

    const channelsStrip = renderFollowingChannelsStrip(creatorIds);

    const shortsSection = shorts.length
      ? renderFeedSection("ショート", renderFollowingShortRow(shorts), {
          extraClass: "tlv-videos-section--shorts tlv-videos-section--shorts-following",
          seeAllHref: "shorts.html",
        })
      : "";

    const videosSection = videos.length
      ? renderFollowingVideoGrid(videos)
      : creatorIds.length
        ? `<div class="tlv-videos-following-empty tlv-videos-following-empty--inline"><p class="tlv-videos-following-empty__message">${cfg.escapeHtml("登録チャンネルの新しい動画はまだありません")}</p></div>`
        : "";

    const loadSentinel = hasMore
      ? `<div class="tlv-videos-following-sentinel" data-tlv-following-sentinel aria-hidden="true"></div>`
      : "";

    return `
      <div class="tlv-videos-home tlv-videos-home--following tlv-videos-home--subscriptions" data-live-videos-home>
        ${renderFollowingPageHeaderHtml({ showSort: true })}
        ${channelsStrip}
        ${shortsSection}
        ${videosSection}
        ${loadSentinel}
      </div>`;
  }

  function renderHomeFeedHtml(payload, { feed = "recommended", category = "" } = {}) {
    const cfg = C();

    if (payload.mode === "shelf") {
      if (!payload.videos.length) {
        return renderFeedHtml([], { feed: SHELF_META[payload.shelf]?.feed || feed, category });
      }
      const rowClass =
        payload.shelf === "new"
          ? "tlv-videos-section__row--videos-9 tlv-videos-section__row--videos-list"
          : "tlv-videos-section__row--videos-list";
      return `
        <div class="tlv-videos-home tlv-videos-home--shelf" data-live-videos-home>
          <p class="tlv-videos-home__back"><a class="tlv-videos-section__see-all" href="videos.html">← ホームフィードへ</a></p>
          ${renderFeedSection(payload.title, renderVideoRow(payload.videos, rowClass))}
        </div>`;
    }

    if (payload.mode === "search") {
      if (!payload.videos.length) {
        return renderFeedHtml([], { currentQuery: payload.query, feed, category });
      }
      return `
        <div class="tlv-videos-home tlv-videos-home--search" data-live-videos-home>
          ${renderFeedSection("検索結果", renderVideoRow(payload.videos, "tlv-videos-section__row--videos-list"))}
        </div>`;
    }

    if (payload.mode === "following") {
      if (!payload.creatorIds?.length) {
        return renderFollowingEmptyPageHtml();
      }
      return renderFollowingSubscriptionsHtml(payload);
    }

    const sections = [
      renderFeedSection("おすすめ", renderVideoRow(payload.recommendedVideos, "tlv-videos-section__row--videos-4"), {
        seeAllShelf: "recommended",
      }),
      renderFeedSection("ショート", renderShortRow(payload.shortVideosA), {
        extraClass: "tlv-videos-section--shorts",
        seeAllHref: "shorts.html",
      }),
      renderFeedSection("人気の動画", renderVideoRow(payload.popularVideos, "tlv-videos-section__row--videos-4"), {
        seeAllShelf: "popular",
      }),
      renderFeedSection("ショート", renderShortRow(payload.shortVideosB), {
        extraClass: "tlv-videos-section--shorts tlv-videos-section--shorts-alt",
        seeAllHref: "shorts.html",
      }),
      renderFeedSection("新着動画", renderVideoRow(payload.latestVideos, "tlv-videos-section__row--videos-9"), {
        seeAllShelf: "new",
      }),
      renderFeedSection("その他のトピック", renderTopicCards(), {
        extraClass: "tlv-videos-section--topics",
      }),
    ].join("");

    const hasContent =
      payload.recommendedVideos.length ||
      payload.popularVideos.length ||
      payload.latestVideos.length ||
      payload.shortVideosA.length ||
      payload.shortVideosB.length;

    if (!hasContent) {
      return renderFeedHtml([], { feed, category });
    }

    return `<div class="tlv-videos-home" data-live-videos-home>${sections}</div>`;
  }

  function renderVideoCard(video) {
    const cfg = C();
    const videoId = String(video?.id || "").trim();
    if (!videoId) return "";
    const creatorId = String(video.talk_user_id || "").trim();
    const channelName = cfg.resolveDisplayName(creatorId);
    const avatarUrl = cfg.resolveAvatarUrl(creatorId);
    const profileHref = creatorId ? cfg.profileUrl(creatorId) : "#";
    const thumbUrl = resolveThumbUrl(video);
    const watchUrl = cfg.watchVideoUrl(videoId);
    const viewsLabel = formatViewCountLabel(video.views_count);
    const dateLabel = formatRelativePublishedDate(video.published_at || video.created_at);
    const duration = formatDurationBadge(video.duration_sec);

    const thumbInner = thumbUrl
      ? `<img class="live-video-card__thumb-img" src="${cfg.escapeHtml(thumbUrl)}" alt="" loading="lazy" />`
      : `<div class="live-video-card__thumb-placeholder" aria-hidden="true"></div>`;

    return `
      <article class="live-video-card live-video-card--yt" data-live-video-id="${cfg.escapeHtml(videoId)}" data-tlv-home-video-card="long">
        <a class="live-video-card__thumb-link" href="${cfg.escapeHtml(watchUrl)}">
        <div class="live-video-card__thumb">
          ${thumbInner}
          ${duration ? `<span class="live-video-card__duration">${cfg.escapeHtml(duration)}</span>` : ""}
        </div>
        </a>
        <div class="live-video-card__info">
          <a class="live-video-card__avatar" href="${cfg.escapeHtml(profileHref)}" aria-label="${cfg.escapeHtml(channelName)}のチャンネル">
            <img src="${cfg.escapeHtml(avatarUrl)}" alt="" loading="lazy" width="32" height="32" />
          </a>
          <div class="live-video-card__details">
            <a class="live-video-card__title" href="${cfg.escapeHtml(watchUrl)}">${cfg.escapeHtml(video.title)}</a>
            <a class="live-video-card__channel" href="${cfg.escapeHtml(profileHref)}">${cfg.escapeHtml(channelName)}</a>
            <p class="live-video-card__stats">${cfg.escapeHtml(viewsLabel)}・${cfg.escapeHtml(dateLabel)}</p>
          </div>
        </div>
      </article>
    `;
  }

  function renderFeedHtml(videos, { currentQuery = "", feed = "recommended", category = "" } = {}) {
    const cfg = C();
    if (!videos.length) {
      if (feed === "following") {
        return renderFollowingEmptyHtml();
      }
      const emptyTitle = currentQuery
        ? "該当する動画がありません"
        : category
          ? "このカテゴリの動画がありません"
          : "公開動画がありません";
      return `
        <div class="live-empty">
          <p class="live-empty__title">${cfg.escapeHtml(emptyTitle)}</p>
          <p class="live-empty__text">${currentQuery ? "別のキーワードで検索してください。" : "最初の長尺動画を投稿してみましょう。"}</p>
          <p style="margin-top:16px">
            <a class="live-btn live-btn--primary" href="video-upload.html">動画を投稿</a>
            <a class="live-btn live-btn--ghost" href="shorts.html">ショート一覧</a>
          </p>
        </div>`;
    }
    return `
      <div class="live-videos-feed tlv-videos-feed" data-live-videos-feed>
        ${videos.map((v) => renderVideoCard(v)).join("")}
      </div>`;
  }

  function writeToRoots(roots, html) {
    roots.filter(Boolean).forEach((root) => {
      root.innerHTML = html;
    });
  }

  function syncFollowingChrome(feed) {
    const isFollowing = feed === "following";
    const body = global.document?.body;
    if (body) {
      if (isFollowing) {
        body.setAttribute("data-tlv-feed", "following");
        body.dataset.tlvSidebarActive = "subscriptions";
      } else {
        body.removeAttribute("data-tlv-feed");
      }
    }
    global.document
      ?.querySelectorAll?.("[data-tlv-desktop-chips-mount], [data-tlv-mobile-chips-mount], [data-tlv-mobile-feed-tabs-mount]")
      ?.forEach((el) => {
        el.hidden = isFollowing;
      });
    if (isFollowing) {
      global.document.title = "登録チャンネル | TASFUL LIVE";
      global.document
        ?.querySelectorAll?.("[data-tlv-mini-nav='subscriptions']")
        ?.forEach((el) => {
          el.classList.add("is-active");
          el.closest(".tlv-videos-mini-nav")
            ?.querySelectorAll("[data-tlv-mini-nav]")
            ?.forEach((link) => {
              if (link !== el && link.getAttribute("data-tlv-mini-nav") !== "subscriptions") {
                link.classList.remove("is-active");
              }
            });
        });
    }
  }

  function bindFollowingInfiniteScroll(roots, creatorIds, initialState) {
    const ids = (creatorIds || []).filter(Boolean);
    if (!ids.length) return null;

    let loading = false;
    let offset = Number(initialState?.videoOffset) || 0;
    let hasMore = Boolean(initialState?.hasMore);

    const observer = new IntersectionObserver(
      async (entries) => {
        if (!entries.some((entry) => entry.isIntersecting) || loading || !hasMore) return;
        loading = true;
        try {
          const more = await fetchFollowingVideos(ids, {
            limit: FOLLOWING_PAGE_SIZE,
            offset,
          });
          if (!more.length) {
            hasMore = false;
            roots.forEach((root) => root.querySelector("[data-tlv-following-sentinel]")?.remove());
            return;
          }
          offset += more.length;
          if (more.length < FOLLOWING_PAGE_SIZE) {
            hasMore = false;
          }
          const cardsHtml = more.map((video) => renderVideoCard(video)).join("");
          roots.forEach((root) => {
            const grid = root.querySelector("[data-tlv-following-videos]");
            if (grid) grid.insertAdjacentHTML("beforeend", cardsHtml);
            if (!hasMore) root.querySelector("[data-tlv-following-sentinel]")?.remove();
          });
        } catch (err) {
          console.warn("[TasuLiveVideos] following load more skipped:", err.message || err);
        } finally {
          loading = false;
        }
      },
      { rootMargin: "600px" },
    );

    roots.forEach((root) => {
      const sentinel = root.querySelector("[data-tlv-following-sentinel]");
      if (sentinel) observer.observe(sentinel);
    });

    return observer;
  }

  async function mountVideosFeed(root, options = {}) {
    const cfg = C();
    const roots = (options.roots || [root]).filter(Boolean);
    const searchInputs = [...(options.searchInputs || []), options.searchInput].filter(Boolean);
    const searchForms = [...(options.searchForms || [])];
    let currentQuery = String(options.initialQuery || "");
    let currentFeed = String(options.initialFeed || "recommended");
    let currentCategory = String(options.initialCategory || "");
    let currentShelf = String(options.initialShelf || "");
    let followingScrollObserver = null;
    try {
      const urlParams = new URLSearchParams(global.location?.search || "");
      if (!currentShelf && urlParams.get("shelf")) currentShelf = String(urlParams.get("shelf"));
      if (!currentQuery && urlParams.get("q")) currentQuery = String(urlParams.get("q"));
      if (urlParams.get("feed")) currentFeed = String(urlParams.get("feed"));
    } catch {
      /* non-browser */
    }

    async function render(query, feed, category, shelf) {
      currentQuery = query;
      currentFeed = feed;
      currentCategory = category;
      currentShelf = shelf;
      if (followingScrollObserver) {
        followingScrollObserver.disconnect();
        followingScrollObserver = null;
      }
      writeToRoots(roots, '<p class="live-loading">動画を読み込み中…</p>');
      try {
        if (currentFeed === "following" && !isAuthenticatedTalkUser()) {
          writeToRoots(roots, renderFollowingEmptyPageHtml());
          syncFollowingChrome("following");
          return;
        }

        if (currentFeed !== "following") {
          await ensureSupabaseSessionSafe();
        }

        const payload = await buildHomeFeedPayload({
          query: currentQuery,
          feed: currentFeed,
          category: currentCategory,
          shelf: currentShelf,
        });
        writeToRoots(roots, renderHomeFeedHtml(payload, { feed: currentFeed, category: currentCategory }));
        syncFollowingChrome(currentFeed);
        if (currentFeed === "following" && payload.mode === "following" && payload.creatorIds?.length) {
          followingScrollObserver = bindFollowingInfiniteScroll(roots, payload.creatorIds, payload);
        }
        global.TasuTlvNav?.syncSearchInputs?.(searchInputs, currentQuery);
      } catch (err) {
        if (currentFeed === "following") {
          console.warn("[TasuLiveVideos] following feed skipped:", err.message || err);
          writeToRoots(roots, renderFollowingEmptyPageHtml());
          syncFollowingChrome("following");
          return;
        }
        console.error("[TasuLiveVideos]", err);
        writeToRoots(roots, `<p class="live-error">読み込みに失敗しました: ${cfg.escapeHtml(err.message || err)}</p>`);
      }
    }

    function runSearch(raw) {
      render(sanitizeSearchQuery(raw), currentFeed, currentCategory, "");
    }

    roots.forEach((root) => {
      root.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-tlv-home-topic]");
        if (!btn) return;
        const categoryId = String(btn.getAttribute("data-tlv-home-topic") || "");
        render(currentQuery, currentFeed, categoryId, "");
        document.querySelectorAll("[data-tlv-category]").forEach((chip) => {
          const id = chip.getAttribute("data-tlv-category") || "";
          chip.classList.toggle("is-active", id === categoryId);
        });
      });
    });

    searchInputs.forEach((input) => {
      input?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          runSearch(input.value);
        }
      });
    });

    const searchBtn = options.searchButton;
    if (searchBtn) {
      searchBtn.addEventListener("click", () => {
        const input = searchInputs[0] || options.searchInput;
        runSearch(input?.value || "");
      });
    }

    global.TasuTlvNav?.bindSearchForms?.(searchForms, runSearch);
    global.TasuTlvNav?.bindCategoryChips?.(options.categoryChips, (categoryId) => {
      render(currentQuery, currentFeed, categoryId, "");
    });
    global.TasuTlvNav?.bindFeedTabs?.(options.feedTabs, (feedId) => {
      render(currentQuery, feedId, currentCategory, "");
    });

    await render(currentQuery, currentFeed, currentCategory, currentShelf);
    syncFollowingChrome(currentFeed);
  }

  global.TasuLiveVideos = {
    fetchPublishedVideos,
    fetchCreatorChannelVideos,
    fetchCreatorChannelShorts,
    fetchCreatorChannelBroadcasts,
    fetchCreatorChannelStats,
    mountVideosFeed,
    resolveThumbUrl,
    renderVideoGridCard,
    renderChannelVideoCard,
    renderChannelTabs,
    renderChannelTabContent,
    bindChannelTabs,
    renderProfileVideosSection,
    renderVideoCard,
    filterByCategory,
    CHANNEL_TABS,
  };
})(typeof window !== "undefined" ? window : globalThis);
