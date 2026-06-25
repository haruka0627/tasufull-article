/**
 * TASFUL LIVE — 高く評価した動画（YouTube /playlist?list=LL 風）
 */
(function (global) {
  "use strict";

  const C = () => global.TasuLiveConfig;
  function isDemoMode() {
    return Boolean(global.TasuTlvDevAuth?.isLocalTlvDevHost?.());
  }
  let openMenuKey = "";
  let documentMenuBound = false;

  const DEMO_VIDEOS = Object.freeze([
    {
      id: "demo-liked-baseball",
      talk_user_id: "demo-sports",
      channelName: "スポーツ速報チャンネル",
      title: "野球ハイライト集",
      duration_sec: 720,
      views_count: 89000,
      published_at: "2026-06-22T10:00:00.000Z",
      collageTone: "sports",
    },
    {
      id: "demo-liked-invest",
      talk_user_id: "demo-finance",
      channelName: "マーケット解説TV",
      title: "投資の基本解説",
      duration_sec: 960,
      views_count: 54000,
      published_at: "2026-06-21T14:00:00.000Z",
      collageTone: "finance",
    },
    {
      id: "demo-liked-bgm",
      talk_user_id: "demo-music",
      channelName: "Night Drive Beats",
      title: "作業用BGM",
      duration_sec: 3600,
      views_count: 210000,
      published_at: "2026-06-21T09:00:00.000Z",
      collageTone: "music",
    },
    {
      id: "demo-liked-game",
      talk_user_id: "demo-stream",
      channelName: "配信切り抜き局",
      title: "ゲーム配信切り抜き",
      duration_sec: 1180,
      views_count: 156000,
      published_at: "2026-06-20T20:00:00.000Z",
      collageTone: "stream",
    },
    {
      id: "demo-liked-gadget",
      talk_user_id: "demo-tech",
      channelName: "ガジェット紹介ラボ",
      title: "便利グッズ紹介",
      duration_sec: 540,
      views_count: 32000,
      published_at: "2026-06-20T12:00:00.000Z",
      collageTone: "tech",
    },
    {
      id: "demo-liked-cooking",
      talk_user_id: "demo-food",
      channelName: "15分キッチン",
      title: "週末ランチの簡単レシピ",
      duration_sec: 680,
      views_count: 41000,
      published_at: "2026-06-19T11:00:00.000Z",
      collageTone: "food",
    },
    {
      id: "demo-liked-travel",
      talk_user_id: "demo-travel",
      channelName: "旅ログ Kyoto",
      title: "京都の隠れカフェ散歩",
      duration_sec: 840,
      views_count: 28000,
      published_at: "2026-06-19T08:00:00.000Z",
      collageTone: "travel",
    },
    {
      id: "demo-liked-movie",
      talk_user_id: "demo-movie",
      channelName: "シネマ予想局",
      title: "今週のおすすめ映画3選",
      duration_sec: 620,
      views_count: 67000,
      published_at: "2026-06-18T18:00:00.000Z",
      collageTone: "movie",
    },
    {
      id: "demo-liked-work",
      talk_user_id: "demo-tech",
      channelName: "AI Workflow Lab",
      title: "リモートワーク効率化Tips",
      duration_sec: 502,
      views_count: 19000,
      published_at: "2026-06-18T10:00:00.000Z",
      collageTone: "tech",
    },
  ]);

  const DEMO_SHORTS = Object.freeze([
    {
      id: "demo-liked-cat-short",
      creator_id: "demo-pets",
      channelName: "ねこ暮らしラボ",
      title: "猫の日常ショート",
      duration_sec: 42,
      view_count: 98000,
      published_at: "2026-06-22T08:00:00.000Z",
      collageTone: "pets",
    },
    {
      id: "demo-liked-dance-short",
      creator_id: "demo-music",
      channelName: "Short Beats",
      title: "15秒ダンスチャレンジ",
      duration_sec: 15,
      view_count: 45000,
      published_at: "2026-06-21T16:00:00.000Z",
      collageTone: "music",
    },
    {
      id: "demo-liked-recipe-short",
      creator_id: "demo-food",
      channelName: "15分キッチン",
      title: "60秒でできる味噌汁",
      duration_sec: 58,
      view_count: 22000,
      published_at: "2026-06-20T07:00:00.000Z",
      collageTone: "food",
    },
  ]);

  const FILTERS = Object.freeze([
    { id: "all", label: "すべて" },
    { id: "video", label: "動画" },
    { id: "short", label: "ショート" },
  ]);

  const MENU_ITEMS = Object.freeze([
    { id: "queue", label: "キューに追加", icon: "queue" },
    { id: "watch-later", label: "「後で見る」に保存", icon: "watch-later" },
    { id: "save", label: "再生リストに保存", icon: "save" },
    { id: "offline", label: "オフライン", icon: "offline" },
    { id: "share", label: "共有", icon: "share" },
    { id: "remove", label: "「高く評価した動画」から削除", icon: "remove" },
  ]);

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
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const diffMs = Date.now() - d.getTime();
    const min = Math.floor(diffMs / 60_000);
    if (min < 60) return `${Math.max(1, min)}分前`;
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

  function entryKey(entry) {
    return `${entry.type}:${entry.id}`;
  }

  function isDemoDisplayActive(entries) {
    return isDemoMode() && Array.isArray(entries) && entries.length > 0 && entries.every((entry) => entry.isDemo);
  }

  function buildDemoEntries() {
    const now = Date.now();
    const videoEntries = DEMO_VIDEOS.map((video, index) => ({
      id: video.id,
      type: "video",
      likedAt: new Date(now - index * 3 * 3600000).toISOString(),
      video: { ...video },
      isDemo: true,
    }));
    const shortEntries = DEMO_SHORTS.map((short, index) => ({
      id: short.id,
      type: "short",
      likedAt: new Date(now - (index + videoEntries.length) * 3 * 3600000).toISOString(),
      short: { ...short },
      isDemo: true,
    }));
    return [...videoEntries, ...shortEntries].sort(
      (a, b) => new Date(b.likedAt).getTime() - new Date(a.likedAt).getTime(),
    );
  }

  function resolveChannelName(entity, type = "video") {
    if (entity?.channelName) return String(entity.channelName);
    const cfg = C();
    if (type === "short") return cfg.resolveDisplayName(entity?.creator_id);
    return cfg.resolveDisplayName(entity?.talk_user_id);
  }

  async function fetchUserLikedVideos(userId) {
    const cfg = C();
    await cfg.ensureSupabaseSession();
    const client = cfg.getClient();
    if (!client) return [];

    const { data: likes, error } = await client
      .from(cfg.TABLES.videoLikes)
      .select("video_id, created_at")
      .eq("talk_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    if (!likes?.length) return [];

    const ids = likes.map((row) => String(row.video_id)).filter(Boolean);
    const { data: videos, error: videoError } = await client
      .from(cfg.TABLES.videos)
      .select(
        "id, talk_user_id, title, description, thumbnail_path, duration_sec, views_count, published_at, created_at, status",
      )
      .in("id", ids)
      .eq("status", "published");
    if (videoError) throw videoError;

    const videoMap = new Map((videos || []).map((video) => [String(video.id), video]));
    return likes
      .map((row) => {
        const id = String(row.video_id);
        const video = videoMap.get(id);
        if (!video) return null;
        return {
          id,
          type: "video",
          likedAt: String(row.created_at || ""),
          video,
        };
      })
      .filter(Boolean);
  }

  async function fetchUserLikedShorts(userId) {
    const cfg = C();
    await cfg.ensureSupabaseSession();
    const client = cfg.getClient();
    if (!client) return [];

    const { data: likes, error } = await client
      .from(cfg.TABLES.likes)
      .select("short_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    if (!likes?.length) return [];

    const ids = likes.map((row) => String(row.short_id)).filter(Boolean);
    const { data: shorts, error: shortError } = await client
      .from(cfg.TABLES.shorts)
      .select("id, creator_id, title, description, duration_sec, view_count, published_at, created_at, status")
      .in("id", ids)
      .eq("status", "published");
    if (shortError) throw shortError;

    const shortMap = new Map((shorts || []).map((short) => [String(short.id), short]));
    return likes
      .map((row) => {
        const id = String(row.short_id);
        const short = shortMap.get(id);
        if (!short) return null;
        return {
          id,
          type: "short",
          likedAt: String(row.created_at || ""),
          short,
        };
      })
      .filter(Boolean);
  }

  async function buildStubEntries() {
    const videosApi = global.TasuLiveVideos;
    const shortsApi = global.TasuLiveShorts;
    const now = Date.now();
    const [videos, shorts] = await Promise.all([
      videosApi?.fetchPublishedVideos?.({ limit: 8, feed: "recommended" }).catch(() => []),
      shortsApi?.fetchPublishedShorts?.(4).catch(() => []),
    ]);
    const videoEntries = (videos || []).slice(0, 6).map((video, index) => ({
      id: String(video.id),
      type: "video",
      likedAt: new Date(now - index * 3600000).toISOString(),
      video,
    }));
    const shortEntries = (shorts || []).slice(0, 3).map((short, index) => ({
      id: String(short.id),
      type: "short",
      likedAt: new Date(now - (index + 6) * 3600000).toISOString(),
      short,
    }));
    return [...videoEntries, ...shortEntries].sort(
      (a, b) => new Date(b.likedAt).getTime() - new Date(a.likedAt).getTime(),
    );
  }

  async function loadLikedItems() {
    const cfg = C();
    const userId = cfg.getTalkUserId();
    let entries = [];

    if (userId) {
      try {
        const session = await cfg.ensureSupabaseSession();
        if (session?.access_token) {
          const [videos, shorts] = await Promise.all([
            fetchUserLikedVideos(userId).catch((err) => {
              console.warn("[TasuLiveLikedVideos] video likes skipped:", err.message || err);
              return [];
            }),
            fetchUserLikedShorts(userId).catch((err) => {
              console.warn("[TasuLiveLikedVideos] short likes skipped:", err.message || err);
              return [];
            }),
          ]);
          entries = [...videos, ...shorts].sort(
            (a, b) => new Date(b.likedAt).getTime() - new Date(a.likedAt).getTime(),
          );
        }
      } catch (err) {
        console.warn("[TasuLiveLikedVideos] load skipped:", err.message || err);
      }
    }

    if (entries.length) return entries;
    if (isDemoMode()) return buildDemoEntries();
    if (cfg?.isTalkDevStubMode?.() === true) return buildStubEntries();
    return [];
  }

  function filterEntries(entries, filterId) {
    if (filterId === "video") return entries.filter((entry) => entry.type === "video");
    if (filterId === "short") return entries.filter((entry) => entry.type === "short");
    return entries;
  }

  function computePlaylistStats(entries, userId, { demo = false } = {}) {
    const cfg = C();
    const videosApi = global.TasuLiveVideos;
    if (demo) {
      const lastUpdated = entries.reduce((latest, entry) => {
        const t = new Date(entry.likedAt).getTime();
        return t > latest ? t : latest;
      }, 0);
      return {
        count: 24,
        totalViews: 0,
        lastUpdated: lastUpdated ? new Date(lastUpdated).toISOString() : new Date().toISOString(),
        lastUpdatedLabel: "今日",
        userName: "あなた",
        heroThumb: null,
        collageEntries: entries.slice(0, 4),
        privacy: "非公開",
      };
    }
    const count = entries.length;
    const totalViews = entries.reduce((sum, entry) => {
      if (entry.type === "video") return sum + Number(entry.video?.views_count ?? 0);
      return sum + Number(entry.short?.view_count ?? 0);
    }, 0);
    const lastUpdated = entries.reduce((latest, entry) => {
      const t = new Date(entry.likedAt).getTime();
      return t > latest ? t : latest;
    }, 0);
    const heroEntry = entries[0];
    let heroThumb = null;
    if (heroEntry?.type === "video" && heroEntry.video) {
      heroThumb = videosApi?.resolveThumbUrl?.(heroEntry.video) || null;
    }
    return {
      count,
      totalViews,
      lastUpdated: lastUpdated ? new Date(lastUpdated).toISOString() : null,
      lastUpdatedLabel: lastUpdated ? formatRelativePublishedDate(new Date(lastUpdated).toISOString()) : "—",
      userName: cfg.resolveDisplayName(userId),
      heroThumb,
      collageEntries: entries.slice(0, 4),
      privacy: "非公開",
    };
  }

  function renderHeroCollage(entries, stats) {
    const cfg = C();
    const videosApi = global.TasuLiveVideos;
    const cells = [...(stats?.collageEntries || entries).slice(0, 4)];
    while (cells.length < 4) {
      cells.push(cells[cells.length - 1] || { video: { collageTone: "default" }, short: { collageTone: "default" } });
    }

    const cellHtml = cells.slice(0, 4).map((entry) => {
      const entity = entry.type === "short" ? entry.short || {} : entry.video || {};
      const thumbUrl =
        entry.type === "short" ? "" : videosApi?.resolveThumbUrl?.(entity) || "";
      const tone = cfg.escapeHtml(String(entity.collageTone || "default"));
      if (thumbUrl) {
        return `<div class="tlv-liked-videos-card__collage-cell"><img src="${cfg.escapeHtml(thumbUrl)}" alt="" loading="lazy" /></div>`;
      }
      return `<div class="tlv-liked-videos-card__collage-cell tlv-liked-videos-card__collage-cell--${tone}" aria-hidden="true"></div>`;
    }).join("");

    return `<div class="tlv-liked-videos-card__collage">${cellHtml}</div>`;
  }

  function resolvePlayTarget(entries) {
    const playable = entries.filter((entry) => entry.type === "video" && entry.video);
    if (!playable.length) {
      const shortEntry = entries.find((entry) => entry.type === "short" && entry.short);
      if (shortEntry) {
        return { href: global.TasuLiveShorts?.shortWatchUrl?.(shortEntry.id) || "#", type: "short" };
      }
      return { href: "#", type: "none" };
    }
    const pick = playable[Math.floor(Math.random() * playable.length)];
    return { href: C().watchVideoUrl(pick.id), type: "video" };
  }

  function renderMenuIcon(type) {
    const icons = {
      queue:
        '<path fill="currentColor" d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/>',
      "watch-later":
        '<path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>',
      save: '<path fill="currentColor" d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>',
      offline:
        '<path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>',
      share:
        '<path fill="currentColor" d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/>',
      remove:
        '<path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>',
    };
    return `<svg class="tlv-liked-videos-dropdown__icon" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">${icons[type] || ""}</svg>`;
  }

  function renderDropdownMenu() {
    const cfg = C();
    const items = MENU_ITEMS.map((item) => {
      return `
        <li>
          <button type="button" class="tlv-liked-videos-dropdown__item" role="menuitem" data-tlv-liked-videos-action="${cfg.escapeHtml(item.id)}">
            ${renderMenuIcon(item.icon)}
            <span>${cfg.escapeHtml(item.label)}</span>
          </button>
        </li>`;
    }).join("");
    return `
      <div class="tlv-liked-videos-dropdown" data-tlv-liked-videos-dropdown hidden role="menu" aria-label="動画メニュー">
        <ul class="tlv-liked-videos-dropdown__list">${items}</ul>
      </div>`;
  }

  function renderPlaylistCard(stats, entries) {
    const cfg = C();
    const firstPlay = resolvePlayTarget(entries);
    const playHref = entries.length
      ? entries[0].type === "video"
        ? cfg.watchVideoUrl(entries[0].id)
        : global.TasuLiveShorts?.shortWatchUrl?.(entries[0].id) || "#"
      : "#";
    const shuffleHref = firstPlay.href;
    const updatedLabel = stats.lastUpdatedLabel || (stats.lastUpdated ? formatRelativePublishedDate(stats.lastUpdated) : "—");
    const heroInner = entries.length
      ? renderHeroCollage(entries, stats)
      : stats.heroThumb
        ? `<img class="tlv-liked-videos-card__hero-img" src="${cfg.escapeHtml(stats.heroThumb)}" alt="" loading="lazy" />`
        : `<div class="tlv-liked-videos-card__hero-placeholder" aria-hidden="true"></div>`;

    return `
      <aside class="tlv-liked-videos-card" aria-label="高く評価した動画">
        <div class="tlv-liked-videos-card__hero">${heroInner}</div>
        <div class="tlv-liked-videos-card__body">
          <h1 class="tlv-liked-videos-card__title">高く評価した動画</h1>
          <p class="tlv-liked-videos-card__owner">${cfg.escapeHtml(stats.userName)}</p>
          <p class="tlv-liked-videos-card__stats">
            <span>${cfg.escapeHtml(String(stats.count))} 本の動画</span>
            <span>${cfg.escapeHtml(String(stats.totalViews))} 回視聴</span>
            <span>更新: ${cfg.escapeHtml(updatedLabel)}</span>
          </p>
          <p class="tlv-liked-videos-card__privacy">${cfg.escapeHtml(stats.privacy)}</p>
          <button type="button" class="tlv-liked-videos-card__menu" data-tlv-liked-videos-card-menu aria-label="プレイリストの操作">
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
          </button>
          <div class="tlv-liked-videos-card__actions">
            <a class="tlv-liked-videos-card__play" href="${cfg.escapeHtml(playHref)}">
              <span aria-hidden="true">▶</span> すべて再生
            </a>
            <a class="tlv-liked-videos-card__shuffle" href="${cfg.escapeHtml(shuffleHref)}">
              <span aria-hidden="true">⤮</span> シャッフル
            </a>
          </div>
        </div>
      </aside>`;
  }

  function renderVideoRow(entry) {
    const cfg = C();
    const videosApi = global.TasuLiveVideos;
    const video = entry.video || {};
    const thumbUrl = videosApi?.resolveThumbUrl?.(video) || "";
    const watchUrl = cfg.watchVideoUrl(video.id);
    const channelName = resolveChannelName(video, "video");
    const viewsLabel = formatViewCountLabel(video.views_count);
    const dateLabel = formatRelativePublishedDate(video.published_at || video.created_at);
    const duration = formatDurationBadge(video.duration_sec);
    const tone = cfg.escapeHtml(String(video.collageTone || ""));
    const thumbInner = thumbUrl
      ? `<img src="${cfg.escapeHtml(thumbUrl)}" alt="" loading="lazy" />`
      : `<div class="tlv-liked-videos-row__thumb-placeholder${tone ? ` tlv-liked-videos-row__thumb-placeholder--${tone}` : ""}" aria-hidden="true"></div>`;
    const key = entryKey(entry);

    return `
      <article class="tlv-liked-videos-row" data-tlv-liked-videos-row data-entry-key="${cfg.escapeHtml(key)}">
        <a class="tlv-liked-videos-row__thumb" href="${cfg.escapeHtml(watchUrl)}">
          ${thumbInner}
          ${duration ? `<span class="tlv-liked-videos-row__duration">${cfg.escapeHtml(duration)}</span>` : ""}
        </a>
        <div class="tlv-liked-videos-row__body">
          <a class="tlv-liked-videos-row__title" href="${cfg.escapeHtml(watchUrl)}">${cfg.escapeHtml(video.title || "動画")}</a>
          <p class="tlv-liked-videos-row__meta">${cfg.escapeHtml(channelName)} · ${cfg.escapeHtml(viewsLabel)}${dateLabel ? ` · ${cfg.escapeHtml(dateLabel)}` : ""}</p>
        </div>
        <button type="button" class="tlv-liked-videos-row__menu" data-tlv-liked-videos-row-menu="${cfg.escapeHtml(key)}" aria-label="動画の操作" aria-haspopup="menu">
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
        </button>
      </article>`;
  }

  function renderShortRow(entry) {
    const cfg = C();
    const short = entry.short || {};
    const watchUrl = global.TasuLiveShorts?.shortWatchUrl?.(short.id) || "#";
    const channelName = resolveChannelName(short, "short");
    const viewsLabel = formatViewCountLabel(short.view_count);
    const dateLabel = formatRelativePublishedDate(short.published_at || short.created_at);
    const duration = formatDurationBadge(short.duration_sec);
    const tone = cfg.escapeHtml(String(short.collageTone || "default"));
    const key = entryKey(entry);

    return `
      <article class="tlv-liked-videos-row tlv-liked-videos-row--short" data-tlv-liked-videos-row data-entry-key="${cfg.escapeHtml(key)}">
        <a class="tlv-liked-videos-row__thumb" href="${cfg.escapeHtml(watchUrl)}">
          <div class="tlv-liked-videos-row__thumb-placeholder tlv-liked-videos-row__thumb-placeholder--short${tone ? ` tlv-liked-videos-row__thumb-placeholder--${tone}` : ""}" aria-hidden="true">Short</div>
          ${duration ? `<span class="tlv-liked-videos-row__duration">${cfg.escapeHtml(duration)}</span>` : ""}
        </a>
        <div class="tlv-liked-videos-row__body">
          <a class="tlv-liked-videos-row__title" href="${cfg.escapeHtml(watchUrl)}">${cfg.escapeHtml(short.title || "ショート")}</a>
          <p class="tlv-liked-videos-row__meta">${cfg.escapeHtml(channelName)} · ${cfg.escapeHtml(viewsLabel)}${dateLabel ? ` · ${cfg.escapeHtml(dateLabel)}` : ""}</p>
        </div>
        <button type="button" class="tlv-liked-videos-row__menu" data-tlv-liked-videos-row-menu="${cfg.escapeHtml(key)}" aria-label="動画の操作" aria-haspopup="menu">
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
        </button>
      </article>`;
  }

  function renderItemRow(entry) {
    if (entry.type === "short") return renderShortRow(entry);
    return renderVideoRow(entry);
  }

  function renderFilterChips(activeFilter) {
    const cfg = C();
    return FILTERS.map((filter) => {
      const active = filter.id === activeFilter ? " is-active" : "";
      return `<button type="button" class="tlv-liked-videos-filter${active}" data-tlv-liked-videos-filter="${cfg.escapeHtml(filter.id)}">${cfg.escapeHtml(filter.label)}</button>`;
    }).join("");
  }

  function renderVideoList(entries) {
    if (!entries.length) {
      return `
        <div class="tlv-liked-videos-empty">
          <p class="tlv-liked-videos-empty__title">高く評価した動画はありません</p>
        </div>`;
    }
    return `<div class="tlv-liked-videos-list" data-tlv-liked-videos-list>${entries.map((entry) => renderItemRow(entry)).join("")}</div>`;
  }

  function renderPageHtml(filteredEntries, allEntries, stats, filterId) {
    return `
      <div class="tlv-liked-videos-page" data-tlv-liked-videos-page>
        <div class="tlv-liked-videos-layout">
          ${renderPlaylistCard(stats, allEntries)}
          <section class="tlv-liked-videos-main">
            <div class="tlv-liked-videos-main__toolbar">
              <div class="tlv-liked-videos-filters">${renderFilterChips(filterId)}</div>
            </div>
            ${renderVideoList(filteredEntries)}
          </section>
        </div>
        ${renderDropdownMenu()}
      </div>`;
  }

  function positionDropdown(dropdown, anchor) {
    if (!dropdown || !anchor) return;
    const rect = anchor.getBoundingClientRect();
    const margin = 8;
    dropdown.hidden = false;
    dropdown.style.visibility = "hidden";
    dropdown.style.left = "0px";
    dropdown.style.top = "0px";
    const menuRect = dropdown.getBoundingClientRect();
    let left = rect.right - menuRect.width;
    let top = rect.bottom + margin;
    if (left < margin) left = margin;
    if (left + menuRect.width > global.innerWidth - margin) {
      left = global.innerWidth - menuRect.width - margin;
    }
    if (top + menuRect.height > global.innerHeight - margin) {
      top = rect.top - menuRect.height - margin;
    }
    if (top < margin) top = margin;
    dropdown.style.left = `${Math.round(left)}px`;
    dropdown.style.top = `${Math.round(top)}px`;
    dropdown.style.visibility = "";
  }

  function closeDropdown(dropdown) {
    if (!dropdown) return;
    dropdown.hidden = true;
    dropdown.dataset.activeEntryKey = "";
    openMenuKey = "";
  }

  function parseEntryKey(key) {
    const [type, ...rest] = String(key || "").split(":");
    return { type, id: rest.join(":") };
  }

  async function handleMenuAction(action, entryKeyValue, reload, entries) {
    const { type, id } = parseEntryKey(entryKeyValue);
    if (!id) return;

    if (isDemoDisplayActive(entries) && (action === "remove" || action === "watch-later")) {
      global.alert("デモ表示中のためこの操作はできません");
      return;
    }

    if (action === "remove") {
      if (type === "video") {
        await global.TasuLiveWatchVideo?.unlikeVideo?.(id);
      } else if (type === "short") {
        await global.TasuLiveShorts?.unlikeShort?.(id);
      }
      await reload();
      return;
    }

    if (action === "watch-later") {
      if (type === "video") {
        global.TasuLiveWatchLater?.addVideoToWatchLater?.(id);
        global.alert("「後で見る」に追加しました");
      } else {
        global.alert("この操作は今後追加予定です。");
      }
      return;
    }

    if (action === "share") {
      const cfg = C();
      const url =
        type === "short"
          ? global.TasuLiveShorts?.shortWatchUrl?.(id)
          : cfg.watchVideoUrl(id);
      try {
        const fullUrl = global.location.origin + "/" + String(url || "").replace(/^\//, "");
        if (global.navigator?.share) {
          await global.navigator.share({ title: "TASFUL LIVE", url: fullUrl });
        } else if (global.navigator?.clipboard?.writeText) {
          await global.navigator.clipboard.writeText(fullUrl);
          global.alert("リンクをコピーしました");
        }
      } catch {
        /* cancelled */
      }
      return;
    }

    if (action === "offline") {
      global.alert("オフライン再生は今後対応予定です");
      return;
    }

    global.alert("この操作は今後追加予定です。");
  }

  function bindLikedVideosPage(roots, state, reload) {
    roots.filter(Boolean).forEach((root) => {
      root.querySelectorAll("[data-tlv-liked-videos-filter]").forEach((btn) => {
        btn.addEventListener("click", () => {
          reload({ filterId: btn.getAttribute("data-tlv-liked-videos-filter") || "all" });
        });
      });

      root.querySelectorAll("[data-tlv-liked-videos-row-menu]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const key = String(btn.getAttribute("data-tlv-liked-videos-row-menu") || "");
          const menu = root.querySelector("[data-tlv-liked-videos-dropdown]");
          if (!menu || !key) return;
          if (!menu.hidden && openMenuKey === key) {
            closeDropdown(menu);
            return;
          }
          openMenuKey = key;
          menu.dataset.activeEntryKey = key;
          positionDropdown(menu, btn);
        });
      });

      root.querySelectorAll("[data-tlv-liked-videos-action]").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const action = btn.getAttribute("data-tlv-liked-videos-action");
          const menu = root.querySelector("[data-tlv-liked-videos-dropdown]");
          const key = String(menu?.dataset.activeEntryKey || openMenuKey || "");
          closeDropdown(menu);
          if (!action || !key) return;
          try {
            await handleMenuAction(action, key, reload, state.allEntries);
          } catch (err) {
            console.error("[TasuLiveLikedVideos]", err);
            global.alert(err.message || "操作に失敗しました");
          }
        });
      });

      root.querySelector("[data-tlv-liked-videos-card-menu]")?.addEventListener("click", () => {
        global.alert("プレイリストの操作メニューは今後追加予定です。");
      });
    });

    if (documentMenuBound) return;
    documentMenuBound = true;

    const closeAll = (e) => {
      roots.forEach((root) => {
        const menu = root.querySelector("[data-tlv-liked-videos-dropdown]");
        if (!menu || menu.hidden) return;
        if (e.target.closest("[data-tlv-liked-videos-dropdown]")) return;
        if (e.target.closest("[data-tlv-liked-videos-row-menu]")) return;
        closeDropdown(menu);
      });
    };

    global.document.addEventListener("click", closeAll);
    global.document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAll({ target: global.document.body });
    });
  }

  async function mountLikedVideosPage(root, options = {}) {
    const cfg = C();
    const roots = (options.roots || [root]).filter(Boolean);
    const state = { filterId: "all", allEntries: [] };

    const writeRoots = (html) => {
      roots.forEach((r) => {
        if (r) r.innerHTML = html;
      });
    };

    async function reload(opts = {}) {
      if (opts.filterId) state.filterId = opts.filterId;
      writeRoots('<p class="live-loading">読み込み中…</p>');
      try {
        if (!opts.filterId) {
          state.allEntries = await loadLikedItems();
        }
        const talkUserId = cfg.getTalkUserId();
        const demoActive = isDemoDisplayActive(state.allEntries);
        const stats = computePlaylistStats(state.allEntries, talkUserId || "guest", { demo: demoActive });
        const filtered = filterEntries(state.allEntries, state.filterId);
        writeRoots(renderPageHtml(filtered, state.allEntries, stats, state.filterId));
        bindLikedVideosPage(roots, state, reload);
      } catch (err) {
        console.error("[TasuLiveLikedVideos]", err);
        writeRoots(`<p class="live-error">読み込みに失敗しました: ${cfg.escapeHtml(err.message || err)}</p>`);
      }
    }

    await reload();
  }

  global.TasuLiveLikedVideos = {
    mountLikedVideosPage,
    loadLikedItems,
    isDemoMode,
  };
})(typeof window !== "undefined" ? window : globalThis);
