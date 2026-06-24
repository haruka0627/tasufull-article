/**
 * TASFUL LIVE — 再生履歴（YouTube /feed/history 風）
 */
(function (global) {
  "use strict";

  const C = () => global.TasuLiveConfig;
  const HISTORY_STORAGE_KEY = "tlv_watch_history_v1";
  const HISTORY_PAUSED_KEY = "tlv_watch_history_paused";
  const MOCK_SESSION_HIDDEN_KEY = "tlv_watch_history_hidden_mock_v1";

  const MOCK_VIDEOS = Object.freeze([
    {
      id: "mock-history-video-1",
      talk_user_id: "demo-creator-alpha",
      title: "【入門】ライブ配信の準備から本番まで完全ガイド",
      description: "初めて配信する方向けに、機材選びから画面構成まで解説します。",
      duration_sec: 754,
      views_count: 128400,
      published_at: "2026-06-20T09:00:00.000Z",
      created_at: "2026-06-20T09:00:00.000Z",
    },
    {
      id: "mock-history-video-2",
      talk_user_id: "demo-creator-beta",
      title: "週末の作業配信アーカイブ — 新機能のUI調整",
      description: "ダークテーマの微調整とモバイル表示の改善を記録した配信ログです。",
      duration_sec: 4821,
      views_count: 5620,
      published_at: "2026-06-19T14:30:00.000Z",
      created_at: "2026-06-19T14:30:00.000Z",
    },
    {
      id: "mock-history-video-3",
      talk_user_id: "demo-creator-gamma",
      title: "ショート動画の編集テクニック10選",
      description: "テンポの良いカットと字幕配置のコツを実例で紹介します。",
      duration_sec: 612,
      views_count: 89300,
      published_at: "2026-06-18T11:15:00.000Z",
      created_at: "2026-06-18T11:15:00.000Z",
    },
    {
      id: "mock-history-video-4",
      talk_user_id: "demo-creator-alpha",
      title: "視聴者参加型クイズ配信 — ハイライト",
      description: "コメント欄と連動したクイズ企画のベストモーメント集。",
      duration_sec: 936,
      views_count: 24100,
      published_at: "2026-06-17T18:00:00.000Z",
      created_at: "2026-06-17T18:00:00.000Z",
    },
    {
      id: "mock-history-video-5",
      talk_user_id: "demo-creator-delta",
      title: "音質改善のためのマイク設定講座",
      description: "OBSとマイクゲインの基本設定をデモしながら解説します。",
      duration_sec: 1180,
      views_count: 15700,
      published_at: "2026-06-16T08:45:00.000Z",
      created_at: "2026-06-16T08:45:00.000Z",
    },
    {
      id: "mock-history-video-6",
      talk_user_id: "demo-creator-beta",
      title: "TLV 新UIプレビュー — 履歴ページの改善ポイント",
      description: "YouTube 風レイアウトを参考にした履歴画面のデザインメモ。",
      duration_sec: 845,
      views_count: 3200,
      published_at: "2026-06-15T16:20:00.000Z",
      created_at: "2026-06-15T16:20:00.000Z",
    },
    {
      id: "mock-history-video-7",
      talk_user_id: "demo-creator-gamma",
      title: "モバイル視聴体験を良くする5つのチェック項目",
      description: "390px 幅での表示崩れを防ぐための実践的な確認リスト。",
      duration_sec: 503,
      views_count: 9800,
      published_at: "2026-06-14T12:00:00.000Z",
      created_at: "2026-06-14T12:00:00.000Z",
    },
  ]);

  const MOCK_SHORTS = Object.freeze([
    {
      id: "mock-history-short-1",
      creator_id: "demo-creator-alpha",
      title: "30秒でわかるサムネイルのコツ",
      description: "",
      duration_sec: 28,
      view_count: 45200,
      published_at: "2026-06-16T10:00:00.000Z",
      created_at: "2026-06-16T10:00:00.000Z",
    },
    {
      id: "mock-history-short-2",
      creator_id: "demo-creator-beta",
      title: "縦型動画の冒頭3秒が大事な理由",
      description: "",
      duration_sec: 35,
      view_count: 31800,
      published_at: "2026-06-16T09:30:00.000Z",
      created_at: "2026-06-16T09:30:00.000Z",
    },
    {
      id: "mock-history-short-3",
      creator_id: "demo-creator-gamma",
      title: "履歴ページのモックデータ確認用ショート",
      description: "",
      duration_sec: 42,
      view_count: 12400,
      published_at: "2026-06-15T20:15:00.000Z",
      created_at: "2026-06-15T20:15:00.000Z",
    },
    {
      id: "mock-history-short-4",
      creator_id: "demo-creator-delta",
      title: "配信前チェックリスト（60秒版）",
      description: "",
      duration_sec: 58,
      view_count: 8700,
      published_at: "2026-06-15T19:00:00.000Z",
      created_at: "2026-06-15T19:00:00.000Z",
    },
  ]);

  const MOCK_SCHEDULE = Object.freeze([
    { type: "video", videoIndex: 0, hoursAgo: 1 },
    { type: "video", videoIndex: 1, hoursAgo: 2 },
    { type: "short", shortIndex: 0, hoursAgo: 3 },
    { type: "short", shortIndex: 1, hoursAgo: 4 },
    { type: "video", videoIndex: 2, hoursAgo: 5 },
    { type: "video", videoIndex: 3, hoursAgo: 27 },
    { type: "video", videoIndex: 4, hoursAgo: 31 },
    { type: "short", shortIndex: 2, hoursAgo: 74 },
    { type: "short", shortIndex: 3, hoursAgo: 76 },
    { type: "video", videoIndex: 5, hoursAgo: 82 },
    { type: "video", videoIndex: 6, hoursAgo: 96 },
  ]);

  const FILTERS = Object.freeze([
    { id: "all", label: "すべて" },
    { id: "video", label: "動画" },
    { id: "short", label: "ショート" },
    { id: "live", label: "ライブ" },
  ]);

  const GROUP_ORDER = Object.freeze([
    { id: "today", label: "今日" },
    { id: "yesterday", label: "昨日" },
    { id: "thisWeek", label: "今週" },
    { id: "earlier", label: "それ以前" },
  ]);

  function readStoredHistory() {
    try {
      const raw = global.localStorage?.getItem(HISTORY_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed?.items) ? parsed.items : [];
    } catch {
      return [];
    }
  }

  function writeStoredHistory(items) {
    try {
      global.localStorage?.setItem(HISTORY_STORAGE_KEY, JSON.stringify({ items }));
    } catch (err) {
      console.warn("[TasuLiveHistory] storage write skipped:", err.message || err);
    }
  }

  function isHistoryPaused() {
    try {
      return global.localStorage?.getItem(HISTORY_PAUSED_KEY) === "1";
    } catch {
      return false;
    }
  }

  function setHistoryPaused(paused) {
    try {
      global.localStorage?.setItem(HISTORY_PAUSED_KEY, paused ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  function readHiddenMockKeys() {
    try {
      const raw = global.sessionStorage?.getItem(MOCK_SESSION_HIDDEN_KEY);
      const parsed = JSON.parse(raw || "[]");
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
      return new Set();
    }
  }

  function hideMockKey(key) {
    try {
      const next = readHiddenMockKeys();
      next.add(String(key || "").trim());
      global.sessionStorage?.setItem(MOCK_SESSION_HIDDEN_KEY, JSON.stringify([...next]));
    } catch {
      /* ignore */
    }
  }

  function clearHiddenMockKeys() {
    try {
      global.sessionStorage?.removeItem(MOCK_SESSION_HIDDEN_KEY);
    } catch {
      /* ignore */
    }
  }

  function entryKey(entry) {
    return `${entry.type}:${entry.id}`;
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

  function formatWatchedAtLabel(iso) {
    if (!iso) return "";
    const watched = new Date(iso);
    if (Number.isNaN(watched.getTime())) return "";
    const today = startOfDay(new Date());
    const watchedDay = startOfDay(watched);
    const diffDays = Math.floor((today - watchedDay) / 86400000);
    const timeStr = watched.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
    if (diffDays === 0) return timeStr;
    if (diffDays === 1) return `昨日 ${timeStr}`;
    if (diffDays < 7) return `${diffDays}日前`;
    return watched.toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
  }

  function formatRelativePublishedDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
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

  function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function resolveDateGroupId(watchedAt) {
    const watched = new Date(watchedAt);
    if (Number.isNaN(watched.getTime())) return "earlier";
    const today = startOfDay(new Date());
    const watchedDay = startOfDay(watched);
    const diffDays = Math.floor((today - watchedDay) / 86400000);
    if (diffDays === 0) return "today";
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return "thisWeek";
    return "earlier";
  }

  async function fetchShortsSample(limit = 12) {
    const cfg = C();
    try {
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
    } catch (err) {
      console.warn("[TasuLiveHistory] shorts fetch skipped:", err.message || err);
      return [];
    }
  }

  async function fetchBroadcastsSample(limit = 6) {
    const cfg = C();
    try {
      await cfg.ensureSupabaseSession();
      const { data, error } = await cfg
        .getClient()
        .from(cfg.TABLES.broadcasts)
        .select("id, creator_id, title, status, scheduled_at, started_at, created_at")
        .in("status", ["live", "scheduled", "ended"])
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.warn("[TasuLiveHistory] broadcasts fetch skipped:", err.message || err);
      return [];
    }
  }

  function pickMockVideos(apiVideos) {
    const merged = [...MOCK_VIDEOS];
    (apiVideos || []).forEach((video, index) => {
      if (!video?.id) return;
      if (index < merged.length) {
        merged[index] = { ...merged[index], ...video, id: String(video.id) };
      } else {
        merged.push(video);
      }
    });
    return merged;
  }

  function pickMockShorts(apiShorts) {
    const merged = [...MOCK_SHORTS];
    (apiShorts || []).forEach((short, index) => {
      if (!short?.id) return;
      if (index < merged.length) {
        merged[index] = { ...merged[index], ...short, id: String(short.id) };
      } else {
        merged.push(short);
      }
    });
    return merged;
  }

  function buildMockHistoryEntriesFromCatalog(videos, shorts) {
    const now = Date.now();
    const entries = MOCK_SCHEDULE.map((slot) => {
      const watchedAt = new Date(now - slot.hoursAgo * 3600000).toISOString();
      if (slot.type === "short") {
        const short = shorts[slot.shortIndex];
        if (!short) return null;
        return {
          type: "short",
          id: String(short.id),
          watchedAt,
          short,
          isMock: true,
        };
      }
      const video = videos[slot.videoIndex];
      if (!video) return null;
      return {
        type: "video",
        id: String(video.id),
        watchedAt,
        video,
        isMock: true,
      };
    }).filter(Boolean);

    return entries.sort((a, b) => new Date(b.watchedAt) - new Date(a.watchedAt));
  }

  async function buildMockHistoryEntries() {
    const videosApi = global.TasuLiveVideos;
    const [apiVideos, apiShorts] = await Promise.all([
      videosApi?.fetchPublishedVideos?.({ limit: 7, feed: "recommended" }).catch(() => []) || [],
      fetchShortsSample(4),
    ]);

    const videos = pickMockVideos(apiVideos);
    const shorts = pickMockShorts(apiShorts);
    const entries = buildMockHistoryEntriesFromCatalog(videos, shorts);
    const hidden = readHiddenMockKeys();
    return entries.filter((entry) => !hidden.has(entryKey(entry)));
  }

  async function buildStubHistoryEntries() {
    return buildMockHistoryEntries();
  }

  async function resolveHistoryEntries(rawItems) {
    const cfg = C();
    const videosApi = global.TasuLiveVideos;
    const entries = [];

    for (const item of rawItems) {
      const type = String(item?.type || "video");
      const id = String(item?.id || "").trim();
      const watchedAt = String(item?.watchedAt || item?.watched_at || "").trim() || new Date().toISOString();
      if (!id) continue;

      if (type === "short" && item.short) {
        entries.push({ type, id, watchedAt, short: item.short });
        continue;
      }
      if (type === "video" && item.video) {
        entries.push({ type, id, watchedAt, video: item.video });
        continue;
      }
      if (type === "live" && item.broadcast) {
        entries.push({ type, id, watchedAt, broadcast: item.broadcast });
        continue;
      }

      try {
        if (type === "video") {
          await cfg.ensureSupabaseSession();
          const { data } = await cfg
            .getClient()
            .from(cfg.TABLES.videos)
            .select(
              "id, talk_user_id, title, description, thumbnail_path, duration_sec, views_count, published_at, created_at",
            )
            .eq("id", id)
            .eq("status", "published")
            .maybeSingle();
          if (data) entries.push({ type, id, watchedAt, video: data });
        } else if (type === "short") {
          await cfg.ensureSupabaseSession();
          const { data } = await cfg
            .getClient()
            .from(cfg.TABLES.shorts)
            .select("id, creator_id, title, description, duration_sec, view_count, published_at, created_at")
            .eq("id", id)
            .eq("status", "published")
            .maybeSingle();
          if (data) entries.push({ type, id, watchedAt, short: data });
        } else if (type === "live") {
          await cfg.ensureSupabaseSession();
          const { data } = await cfg
            .getClient()
            .from(cfg.TABLES.broadcasts)
            .select("id, creator_id, title, status, scheduled_at, started_at, created_at")
            .eq("id", id)
            .maybeSingle();
          if (data) entries.push({ type, id, watchedAt, broadcast: data });
        }
      } catch (err) {
        console.warn("[TasuLiveHistory] resolve skipped:", err.message || err);
      }
    }

    return entries.sort((a, b) => new Date(b.watchedAt) - new Date(a.watchedAt));
  }

  async function loadHistoryEntries() {
    const stored = readStoredHistory();
    if (stored.length) {
      return resolveHistoryEntries(stored);
    }
    return buildMockHistoryEntries();
  }

  function filterEntries(entries, filterId) {
    if (filterId === "all") return entries;
    return entries.filter((entry) => entry.type === filterId);
  }

  function groupEntries(entries) {
    const map = new Map(GROUP_ORDER.map((g) => [g.id, { ...g, shorts: [], videos: [], lives: [] }]));
    entries.forEach((entry) => {
      const groupId = resolveDateGroupId(entry.watchedAt);
      const group = map.get(groupId);
      if (!group) return;
      if (entry.type === "short") group.shorts.push(entry);
      else if (entry.type === "live") group.lives.push(entry);
      else group.videos.push(entry);
    });
    return GROUP_ORDER.map((g) => map.get(g.id)).filter(
      (group) => group.shorts.length || group.videos.length || group.lives.length,
    );
  }

  function renderMenuButton(entryKey) {
    const cfg = C();
    return `
      <button type="button" class="tlv-history-item__menu" data-tlv-history-menu="${cfg.escapeHtml(entryKey)}" aria-label="履歴の操作">
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path fill="currentColor" d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
        </svg>
      </button>`;
  }

  function renderShortShelfCard(entry) {
    const cfg = C();
    const short = entry.short || {};
    const href =
      global.TasuLiveShorts?.shortWatchUrl?.(short.id) ||
      `shorts.html?creator=${encodeURIComponent(short.creator_id || "")}`;
    const viewsLabel = formatViewCountLabel(short.view_count);

    return `
      <article class="tlv-history-short-card" data-tlv-history-item data-history-type="short" data-history-id="${cfg.escapeHtml(entry.id)}">
        <a class="tlv-history-short-card__link" href="${cfg.escapeHtml(href)}">
          <div class="tlv-history-short-card__thumb">
            <div class="tlv-history-short-card__thumb-placeholder" aria-hidden="true"></div>
          </div>
          <div class="tlv-history-short-card__body">
            <h3 class="tlv-history-short-card__title">${cfg.escapeHtml(short.title || "ショート")}</h3>
            <p class="tlv-history-short-card__meta">${cfg.escapeHtml(viewsLabel)}</p>
          </div>
        </a>
        ${renderMenuButton(`short:${entry.id}`)}
      </article>`;
  }

  function renderVideoRow(entry) {
    const cfg = C();
    const videosApi = global.TasuLiveVideos;
    const video = entry.video || {};
    const thumbUrl = videosApi?.resolveThumbUrl?.(video) || "";
    const watchUrl = cfg.watchVideoUrl(video.id);
    const channelName = cfg.resolveDisplayName(video.talk_user_id);
    const viewsLabel = formatViewCountLabel(video.views_count);
    const watchedLabel = formatWatchedAtLabel(entry.watchedAt);
    const duration = formatDurationBadge(video.duration_sec);

    const thumbInner = thumbUrl
      ? `<img src="${cfg.escapeHtml(thumbUrl)}" alt="" loading="lazy" />`
      : `<div class="tlv-history-video-row__thumb-placeholder" aria-hidden="true"></div>`;

    return `
      <article class="tlv-history-video-row" data-tlv-history-item data-history-type="video" data-history-id="${cfg.escapeHtml(entry.id)}">
        <a class="tlv-history-video-row__thumb" href="${cfg.escapeHtml(watchUrl)}">
          ${thumbInner}
          ${duration ? `<span class="tlv-history-video-row__duration">${cfg.escapeHtml(duration)}</span>` : ""}
        </a>
        <div class="tlv-history-video-row__body">
          <a class="tlv-history-video-row__title" href="${cfg.escapeHtml(watchUrl)}">${cfg.escapeHtml(video.title || "動画")}</a>
          <p class="tlv-history-video-row__channel">${cfg.escapeHtml(channelName)}</p>
          <p class="tlv-history-video-row__stats">${cfg.escapeHtml(viewsLabel)}</p>
          ${watchedLabel ? `<p class="tlv-history-video-row__watched">${cfg.escapeHtml(watchedLabel)}</p>` : ""}
        </div>
        ${renderMenuButton(`video:${entry.id}`)}
      </article>`;
  }

  function renderLiveRow(entry) {
    const cfg = C();
    const broadcast = entry.broadcast || {};
    const href = cfg.watchUrl(broadcast.id);
    const channelName = cfg.resolveDisplayName(broadcast.creator_id);
    const status = cfg.labelBroadcastStatus(broadcast.status);
    const dateLabel = formatRelativePublishedDate(
      broadcast.started_at || broadcast.scheduled_at || broadcast.created_at,
    );

    return `
      <article class="tlv-history-video-row tlv-history-video-row--live" data-tlv-history-item data-history-type="live" data-history-id="${cfg.escapeHtml(entry.id)}">
        <a class="tlv-history-video-row__thumb" href="${cfg.escapeHtml(href)}">
          <div class="tlv-history-video-row__thumb-placeholder tlv-history-video-row__thumb-placeholder--live" aria-hidden="true">LIVE</div>
          <span class="tlv-history-video-row__live-badge">${cfg.escapeHtml(status)}</span>
        </a>
        <div class="tlv-history-video-row__body">
          <a class="tlv-history-video-row__title" href="${cfg.escapeHtml(href)}">${cfg.escapeHtml(broadcast.title || "ライブ配信")}</a>
          <p class="tlv-history-video-row__meta">
            <span>${cfg.escapeHtml(channelName)}</span>
            <span>${cfg.escapeHtml(status)}</span>
            ${dateLabel ? `<span>${cfg.escapeHtml(dateLabel)}</span>` : ""}
          </p>
        </div>
        ${renderMenuButton(`live:${entry.id}`)}
      </article>`;
  }

  function renderShortsShelf(shorts) {
    if (!shorts.length) return "";
    const cfg = C();
    return `
      <section class="tlv-history-shorts-shelf" aria-label="ショート">
        <h3 class="tlv-history-shorts-shelf__title">
          <span class="tlv-history-shorts-shelf__icon" aria-hidden="true">▶</span>
          ${cfg.escapeHtml("ショート")}
        </h3>
        <div class="tlv-history-shorts-shelf__track">${shorts.map((entry) => renderShortShelfCard(entry)).join("")}</div>
      </section>`;
  }

  function partitionGroupEntries(group) {
    const shorts = [...group.shorts].sort(
      (a, b) => new Date(b.watchedAt) - new Date(a.watchedAt)
    );
    const rows = [...group.videos, ...group.lives].sort(
      (a, b) => new Date(b.watchedAt) - new Date(a.watchedAt)
    );

    if (!shorts.length) {
      return { before: rows, shorts: [], after: [] };
    }

    const newestShortAt = Math.max(
      ...shorts.map((entry) => new Date(entry.watchedAt).getTime())
    );
    const before = [];
    const after = [];

    rows.forEach((entry) => {
      if (new Date(entry.watchedAt).getTime() > newestShortAt) before.push(entry);
      else after.push(entry);
    });

    return { before, shorts, after };
  }

  function renderTimelineRows(entries) {
    return entries
      .map((entry) => {
        if (entry.type === "live") return renderLiveRow(entry);
        if (entry.type === "short") return "";
        return renderVideoRow(entry);
      })
      .join("");
  }

  function renderHistoryGroup(group) {
    const cfg = C();
    const { before, shorts, after } = partitionGroupEntries(group);
    const beforeHtml = renderTimelineRows(before);
    const afterHtml = renderTimelineRows(after);

    return `
      <section class="tlv-history-group" data-tlv-history-group="${cfg.escapeHtml(group.id)}">
        <h2 class="tlv-history-group__title">${cfg.escapeHtml(group.label)}</h2>
        ${beforeHtml ? `<div class="tlv-history-video-list">${beforeHtml}</div>` : ""}
        ${renderShortsShelf(shorts)}
        ${afterHtml ? `<div class="tlv-history-video-list">${afterHtml}</div>` : ""}
      </section>`;
  }

  function renderFilterChips(activeFilter) {
    const cfg = C();
    return FILTERS.map((filter) => {
      const active = filter.id === activeFilter ? " is-active" : "";
      return `<button type="button" class="tlv-history-filter${active}" data-tlv-history-filter="${cfg.escapeHtml(filter.id)}">${cfg.escapeHtml(filter.label)}</button>`;
    }).join("");
  }

  function renderPanelIcon(type) {
    const icons = {
      search: '<path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C8.01 14 6 11.99 6 9.5S8.01 5 10.5 5 15 7.01 15 9.5 12.99 14 10.5 14z"/>',
      clear: '<path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>',
      pause: '<path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>',
      settings: '<path fill="currentColor" d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96a7.02 7.02 0 0 0-1.63-.94l-.36-2.54A.484.484 0 0 0 14.06 2h-3.12c-.24 0-.45.17-.49.41l-.36 2.54c-.59.24-1.13.57-1.63.94l-2.39-.96a.488.488 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.04.71 1.63.94l.36 2.54c.05.24.25.41.49.41h3.12c.24 0 .44-.17.49-.41l.36-2.54c.59-.24 1.13-.56 1.63-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.03-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z"/>',
    };
    return `<svg class="tlv-history-panel__icon" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">${icons[type] || ""}</svg>`;
  }

  function renderManagementPanel({ paused = false, searchQuery = "" } = {}) {
    const cfg = C();
    const pauseLabel = paused ? "再生履歴を保存する" : "再生履歴を保存しない";
    return `
      <aside class="tlv-history-panel" aria-label="履歴の管理">
        <label class="tlv-history-panel__search">
          ${renderPanelIcon("search")}
          <input type="search" class="tlv-history-panel__search-input" data-tlv-history-panel-search placeholder="再生履歴を検索します" value="${cfg.escapeHtml(searchQuery)}" autocomplete="off" />
        </label>
        <ul class="tlv-history-panel__actions">
          <li>
            <button type="button" class="tlv-history-panel__action" data-tlv-history-action="clear-all">
              ${renderPanelIcon("clear")}
              <span>すべての再生履歴を削除</span>
            </button>
          </li>
          <li>
            <button type="button" class="tlv-history-panel__action" data-tlv-history-action="toggle-pause">
              ${renderPanelIcon("pause")}
              <span data-tlv-history-pause-label>${cfg.escapeHtml(pauseLabel)}</span>
            </button>
          </li>
          <li>
            <button type="button" class="tlv-history-panel__action" data-tlv-history-action="manage">
              ${renderPanelIcon("settings")}
              <span>すべての履歴を管理</span>
            </button>
          </li>
        </ul>
        <ul class="tlv-history-panel__links">
          <li><a href="my-videos.html">コメント</a></li>
          <li><a href="profile.html?userId=${encodeURIComponent(cfg.getTalkUserId() || "")}">投稿</a></li>
          <li><a href="../chat-list.html">チャット</a></li>
        </ul>
      </aside>`;
  }

  function renderMobileTools({ paused = false } = {}) {
    const cfg = C();
    const pauseLabel = paused ? "再生履歴を保存する" : "再生履歴を保存しない";
    return `
      <details class="tlv-history-mobile-tools">
        <summary>履歴の管理</summary>
        <div class="tlv-history-mobile-tools__body">
          <label class="tlv-history-panel__search tlv-history-panel__search--mobile">
            ${renderPanelIcon("search")}
            <input type="search" class="tlv-history-panel__search-input" data-tlv-history-panel-search-mobile placeholder="再生履歴を検索します" autocomplete="off" />
          </label>
          <button type="button" class="tlv-history-panel__action" data-tlv-history-action="clear-all">すべての再生履歴を削除</button>
          <button type="button" class="tlv-history-panel__action" data-tlv-history-action="toggle-pause">
            <span data-tlv-history-pause-label>${cfg.escapeHtml(pauseLabel)}</span>
          </button>
        </div>
      </details>`;
  }

  function renderEmptyState() {
    return `
      <div class="tlv-history-empty">
        <p class="tlv-history-empty__title">該当する履歴がありません</p>
        <p class="tlv-history-empty__text">検索条件やフィルターを変更してみてください。</p>
      </div>`;
  }

  function renderHistoryPageHtml(groups, { activeFilter = "all", searchQuery = "", paused = false } = {}) {
    const hasContent = groups.length > 0;
    const groupsHtml = hasContent ? groups.map((group) => renderHistoryGroup(group)).join("") : renderEmptyState();

    return `
      <div class="tlv-history-page" data-tlv-history-page>
        <div class="tlv-history-layout">
          <div class="tlv-history-main">
            <h1 class="tlv-history-title">再生履歴</h1>
            <div class="tlv-history-filters" role="tablist" aria-label="履歴フィルター">
              ${renderFilterChips(activeFilter)}
            </div>
            ${renderMobileTools({ paused })}
            <div class="tlv-history-content" data-tlv-history-content>
              ${groupsHtml}
            </div>
          </div>
          ${renderManagementPanel({ paused, searchQuery })}
        </div>
      </div>`;
  }

  function removeHistoryItem(type, id) {
    const stored = readStoredHistory();
    const key = `${type}:${id}`;
    if (stored.length) {
      writeStoredHistory(stored.filter((item) => !(String(item.type) === type && String(item.id) === id)));
      return;
    }
    hideMockKey(key);
  }

  function bindHistoryPage(roots, state, reload) {
    roots.filter(Boolean).forEach((root) => {
      root.querySelectorAll("[data-tlv-history-filter]").forEach((btn) => {
        btn.addEventListener("click", () => {
          reload({ filterId: btn.getAttribute("data-tlv-history-filter") || "all" });
        });
      });

      const syncSearch = (value) => {
        state.searchQuery = value;
        reload({ searchQuery: value });
      };

      root.querySelectorAll("[data-tlv-history-panel-search], [data-tlv-history-panel-search-mobile]").forEach((input) => {
        input.addEventListener("input", () => syncSearch(String(input.value || "")));
      });

      root.querySelectorAll("[data-tlv-history-action]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const action = btn.getAttribute("data-tlv-history-action");
          if (action === "clear-all") {
            if (!global.confirm("すべての再生履歴を削除しますか？")) return;
            const hadStored = readStoredHistory().length > 0;
            writeStoredHistory([]);
            if (hadStored) {
              clearHiddenMockKeys();
            } else {
              const allMock = buildMockHistoryEntriesFromCatalog(pickMockVideos([]), pickMockShorts([]));
              try {
                global.sessionStorage?.setItem(
                  MOCK_SESSION_HIDDEN_KEY,
                  JSON.stringify(allMock.map((entry) => entryKey(entry))),
                );
              } catch {
                /* ignore */
              }
            }
            await reload();
            return;
          }
          if (action === "toggle-pause") {
            const next = !isHistoryPaused();
            setHistoryPaused(next);
            await reload({ paused: next });
            return;
          }
          if (action === "manage") {
            global.alert("履歴の詳細管理は今後追加予定です。");
          }
        });
      });

      root.querySelectorAll("[data-tlv-history-menu]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const key = String(btn.getAttribute("data-tlv-history-menu") || "");
          const [type, id] = key.split(":");
          if (!type || !id) return;
          if (global.confirm("この履歴を削除しますか？")) {
            removeHistoryItem(type, id);
            reload();
          }
        });
      });
    });
  }

  function filterBySearch(entries, query) {
    const term = String(query || "").trim().toLowerCase();
    if (!term) return entries;
    return entries.filter((entry) => {
      if (entry.type === "video") {
        const title = String(entry.video?.title || "").toLowerCase();
        const channel = C().resolveDisplayName(entry.video?.talk_user_id).toLowerCase();
        return title.includes(term) || channel.includes(term);
      }
      if (entry.type === "short") {
        return String(entry.short?.title || "").toLowerCase().includes(term);
      }
      if (entry.type === "live") {
        return String(entry.broadcast?.title || "").toLowerCase().includes(term);
      }
      return false;
    });
  }

  function recordWatchHistory(item) {
    if (isHistoryPaused()) return;
    const type = String(item?.type || "video");
    const id = String(item?.id || "").trim();
    if (!id) return;
    const watchedAt = new Date().toISOString();
    const stored = readStoredHistory().filter((row) => !(String(row.type) === type && String(row.id) === id));
    stored.unshift({ type, id, watchedAt, ...item });
    writeStoredHistory(stored.slice(0, 200));
  }

  async function mountHistoryPage(root, options = {}) {
    const cfg = C();
    const roots = (options.roots || [root]).filter(Boolean);
    const writeRoots = (html) => {
      roots.forEach((r) => {
        if (r) r.innerHTML = html;
      });
    };

    const state = {
      filterId: "all",
      searchQuery: "",
      paused: isHistoryPaused(),
    };

    async function reload(partial = {}) {
      Object.assign(state, partial);
      writeRoots('<p class="live-loading">読み込み中…</p>');
      try {
        let entries = await loadHistoryEntries();
        entries = filterEntries(entries, state.filterId);
        entries = filterBySearch(entries, state.searchQuery);
        const groups = groupEntries(entries);
        writeRoots(
          renderHistoryPageHtml(groups, {
            activeFilter: state.filterId,
            searchQuery: state.searchQuery,
            paused: state.paused,
          }),
        );
        bindHistoryPage(roots, state, reload);
        roots.forEach((r) => {
          r.querySelectorAll("[data-tlv-history-panel-search]").forEach((input) => {
            input.value = state.searchQuery;
          });
        });
      } catch (err) {
        console.error("[TasuLiveHistory]", err);
        writeRoots(`<p class="live-error">読み込みに失敗しました: ${cfg.escapeHtml(err.message || err)}</p>`);
      }
    }

    await reload();
  }

  global.TasuLiveHistory = {
    mountHistoryPage,
    recordWatchHistory,
    readStoredHistory,
    HISTORY_STORAGE_KEY,
  };
})(typeof window !== "undefined" ? window : globalThis);
