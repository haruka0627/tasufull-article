/**
 * TASFUL LIVE — 後で見るプレイリスト（YouTube /playlist?list=WL 風）
 */
(function (global) {
  "use strict";

  const C = () => global.TasuLiveConfig;
  const WATCH_LATER_STORAGE_KEY = "tlv_watch_later_v1";
  const DEMO_MODE = true;
  let openMenuVideoId = "";
  let documentMenuBound = false;

  const DEMO_VIDEOS = Object.freeze([
    {
      id: "demo-wl-stock",
      talk_user_id: "demo-finance",
      channelName: "マーケット解説TV",
      title: "【株式投資】投資の神の駆け出し1万円から",
      duration_sec: 842,
      views_count: 245000,
      published_at: "2026-06-22T09:00:00.000Z",
      collageTone: "finance",
    },
    {
      id: "demo-wl-baseball",
      talk_user_id: "demo-sports",
      channelName: "スポーツ速報チャンネル",
      title: "【野球】WBC世界一に貢献した名セカンド",
      duration_sec: 612,
      views_count: 89000,
      published_at: "2026-06-21T14:00:00.000Z",
      collageTone: "sports",
    },
    {
      id: "demo-wl-cat",
      talk_user_id: "demo-pets",
      channelName: "ねこ暮らしラボ",
      title: "【猫】ボンベイ猫の魅力にハマる理由",
      duration_sec: 480,
      views_count: 156000,
      published_at: "2026-06-21T11:30:00.000Z",
      collageTone: "pets",
    },
    {
      id: "demo-wl-music",
      talk_user_id: "demo-music",
      channelName: "Night Drive Beats",
      title: "【音楽】Initial D Soundtrack",
      duration_sec: 214,
      views_count: 1200000,
      published_at: "2026-06-20T20:00:00.000Z",
      collageTone: "music",
    },
    {
      id: "demo-wl-stream",
      talk_user_id: "demo-stream",
      channelName: "配信ダイジェスト",
      title: "【配信】加藤純一ダイジェスト",
      duration_sec: 3720,
      views_count: 430000,
      published_at: "2026-06-20T18:00:00.000Z",
      collageTone: "stream",
    },
    {
      id: "demo-wl-cooking",
      talk_user_id: "demo-food",
      channelName: "15分キッチン",
      title: "【料理】15分でできる本格パスタ",
      duration_sec: 905,
      views_count: 78000,
      published_at: "2026-06-19T12:00:00.000Z",
      collageTone: "food",
    },
    {
      id: "demo-wl-game",
      talk_user_id: "demo-game",
      channelName: "ゲーム攻略研究所",
      title: "【ゲーム】ゼルダ最新作の裏技まとめ",
      duration_sec: 1180,
      views_count: 312000,
      published_at: "2026-06-19T08:00:00.000Z",
      collageTone: "game",
    },
    {
      id: "demo-wl-travel",
      talk_user_id: "demo-travel",
      channelName: "旅ログ Kyoto",
      title: "【旅行】京都の隠れ名所散歩",
      duration_sec: 1340,
      views_count: 54000,
      published_at: "2026-06-18T16:00:00.000Z",
      collageTone: "travel",
    },
    {
      id: "demo-wl-tech",
      talk_user_id: "demo-tech",
      channelName: "AI Workflow Lab",
      title: "【テック】AI活用ワークフロー解説",
      duration_sec: 960,
      views_count: 67000,
      published_at: "2026-06-18T10:00:00.000Z",
      collageTone: "tech",
    },
    {
      id: "demo-wl-movie",
      talk_user_id: "demo-movie",
      channelName: "シネマ予想局",
      title: "【映画】今年の Oscar 候補を予想",
      duration_sec: 720,
      views_count: 92000,
      published_at: "2026-06-17T21:00:00.000Z",
      collageTone: "movie",
    },
  ]);

  const MENU_ITEMS = Object.freeze([
    { id: "queue", label: "キューに追加", icon: "queue" },
    { id: "save", label: "再生リストに保存", icon: "save" },
    { id: "remove", label: "「後で見る」から削除", icon: "remove" },
    { id: "offline", label: "オフライン", icon: "offline" },
    { id: "share", label: "共有", icon: "share" },
    { id: "divider", divider: true },
    { id: "top", label: "一番上に移動", icon: "top" },
    { id: "bottom", label: "一番下に移動", icon: "bottom" },
  ]);

  function readStoredItems() {
    try {
      const raw = global.localStorage?.getItem(WATCH_LATER_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed?.items) ? parsed.items : [];
    } catch {
      return [];
    }
  }

  function writeStoredItems(items) {
    try {
      global.localStorage?.setItem(WATCH_LATER_STORAGE_KEY, JSON.stringify({ items }));
    } catch (err) {
      console.warn("[TasuLiveWatchLater] storage write skipped:", err.message || err);
    }
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

  function formatDateLabel(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}/${m}/${day}`;
  }

  function formatLastUpdatedLabel(iso, { demoToday = false } = {}) {
    if (demoToday) return "今日";
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(d);
    target.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today - target) / 86400000);
    if (diffDays === 0) return "今日";
    if (diffDays === 1) return "昨日";
    return formatDateLabel(iso);
  }

  function isDemoDisplayActive() {
    return DEMO_MODE && readStoredItems().length === 0;
  }

  function buildDemoItems() {
    const now = Date.now();
    return DEMO_VIDEOS.map((video, index) => ({
      id: video.id,
      addedAt: new Date(now - index * 2 * 3600000).toISOString(),
      video: { ...video },
      isDemo: true,
    }));
  }

  async function buildStubItems() {
    const videosApi = global.TasuLiveVideos;
    const videos = await videosApi?.fetchPublishedVideos?.({ limit: 12, feed: "recommended" }).catch(() => []);
    const now = Date.now();
    return (videos || []).slice(0, 10).map((video, index) => ({
      id: String(video.id),
      addedAt: new Date(now - index * 3600000).toISOString(),
      video,
    }));
  }

  async function resolveItems(rawItems) {
    const cfg = C();
    const entries = [];
    for (const item of rawItems) {
      const id = String(item?.id || "").trim();
      const addedAt = String(item?.addedAt || item?.added_at || "").trim() || new Date().toISOString();
      if (!id) continue;
      if (item.video) {
        entries.push({ id, addedAt, video: item.video });
        continue;
      }
      try {
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
        if (data) entries.push({ id, addedAt, video: data });
      } catch (err) {
        console.warn("[TasuLiveWatchLater] resolve skipped:", err.message || err);
      }
    }
    return entries;
  }

  async function loadWatchLaterItems() {
    const stored = readStoredItems();
    if (stored.length) return resolveItems(stored);
    if (DEMO_MODE) return buildDemoItems();
    const cfg = C();
    if (cfg?.isTalkDevStubMode?.() === true) {
      const stub = await buildStubItems();
      writeStoredItems(stub.map(({ id, addedAt }) => ({ id, addedAt })));
      return stub;
    }
    return [];
  }

  function persistFromEntries(entries) {
    writeStoredItems(
      (entries || []).map((entry) => ({
        id: entry.id,
        addedAt: entry.addedAt,
      })),
    );
  }

  function removeItem(entries, videoId) {
    return entries.filter((entry) => String(entry.id) !== String(videoId));
  }

  function moveItem(entries, videoId, position) {
    const list = [...entries];
    const idx = list.findIndex((entry) => String(entry.id) === String(videoId));
    if (idx < 0) return list;
    const [item] = list.splice(idx, 1);
    if (position === "top") list.unshift(item);
    else list.push(item);
    return list;
  }

  function computePlaylistStats(entries, userId, { demo = false } = {}) {
    const cfg = C();
    if (demo) {
      const lastUpdated = entries.reduce((latest, entry) => {
        const t = new Date(entry.addedAt).getTime();
        return t > latest ? t : latest;
      }, 0);
      return {
        count: 27,
        totalViews: entries.reduce((sum, entry) => sum + Number(entry.video?.views_count ?? 0), 0),
        lastUpdated: lastUpdated ? new Date(lastUpdated).toISOString() : new Date().toISOString(),
        lastUpdatedLabel: "今日",
        userName: "あなた",
        heroThumb: null,
        collageEntries: entries.slice(0, 4),
      };
    }
    const count = entries.length;
    const totalViews = entries.reduce((sum, entry) => sum + Number(entry.video?.views_count ?? 0), 0);
    const lastUpdated = entries.reduce((latest, entry) => {
      const t = new Date(entry.addedAt).getTime();
      return t > latest ? t : latest;
    }, 0);
    return {
      count,
      totalViews,
      lastUpdated: lastUpdated ? new Date(lastUpdated).toISOString() : null,
      lastUpdatedLabel: formatLastUpdatedLabel(lastUpdated ? new Date(lastUpdated).toISOString() : null),
      userName: cfg.resolveDisplayName(userId),
      heroThumb: entries[0] ? global.TasuLiveVideos?.resolveThumbUrl?.(entries[0].video) : null,
      collageEntries: entries.slice(0, 4),
    };
  }

  function resolveChannelName(video) {
    if (video?.channelName) return String(video.channelName);
    return C().resolveDisplayName(video?.talk_user_id);
  }

  function renderHeroCollage(entries, stats) {
    const cfg = C();
    const videosApi = global.TasuLiveVideos;
    const cells = (stats?.collageEntries || entries).slice(0, 4);
    while (cells.length < 4) {
      cells.push(cells[cells.length - 1] || { video: { collageTone: "default" } });
    }

    const cellHtml = cells.slice(0, 4).map((entry) => {
      const video = entry?.video || {};
      const thumbUrl = videosApi?.resolveThumbUrl?.(video) || "";
      const tone = cfg.escapeHtml(String(video.collageTone || "default"));
      if (thumbUrl) {
        return `<div class="tlv-watch-later-card__collage-cell"><img src="${cfg.escapeHtml(thumbUrl)}" alt="" loading="lazy" /></div>`;
      }
      return `<div class="tlv-watch-later-card__collage-cell tlv-watch-later-card__collage-cell--${tone}" aria-hidden="true"></div>`;
    }).join("");

    return `<div class="tlv-watch-later-card__collage">${cellHtml}</div>`;
  }

  function renderPlaylistCard(stats, entries) {
    const cfg = C();
    const heroInner = entries.length
      ? renderHeroCollage(entries, stats)
      : stats.heroThumb
        ? `<img class="tlv-watch-later-card__hero-img" src="${cfg.escapeHtml(stats.heroThumb)}" alt="" loading="lazy" />`
        : `<div class="tlv-watch-later-card__hero-placeholder" aria-hidden="true"></div>`;
    const playHref = entries[0]?.video?.id ? cfg.watchVideoUrl(entries[0].video.id) : "videos.html";
    const shuffleHref = entries.length
      ? cfg.watchVideoUrl(entries[Math.floor(Math.random() * entries.length)].video.id)
      : playHref;
    const updatedLabel = stats.lastUpdatedLabel || formatLastUpdatedLabel(stats.lastUpdated);

    return `
      <aside class="tlv-watch-later-card" aria-label="後で見る">
        <div class="tlv-watch-later-card__hero">${heroInner}</div>
        <div class="tlv-watch-later-card__body">
          <h1 class="tlv-watch-later-card__title">後で見る</h1>
          <p class="tlv-watch-later-card__owner">${cfg.escapeHtml(stats.userName)}</p>
          <p class="tlv-watch-later-card__count">${cfg.escapeHtml(String(stats.count))} 本の動画</p>
          <p class="tlv-watch-later-card__updated">最終更新: ${cfg.escapeHtml(updatedLabel)}</p>
          <button type="button" class="tlv-watch-later-card__menu" data-tlv-watch-later-card-menu aria-label="プレイリストの操作">
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
          </button>
          <div class="tlv-watch-later-card__actions">
            <a class="tlv-watch-later-card__play" href="${cfg.escapeHtml(playHref)}">
              <span aria-hidden="true">▶</span> すべて再生
            </a>
            <a class="tlv-watch-later-card__shuffle" href="${cfg.escapeHtml(shuffleHref)}">
              <span aria-hidden="true">⤮</span> シャッフル
            </a>
          </div>
        </div>
      </aside>`;
  }

  function renderMenuIcon(type) {
    const icons = {
      queue:
        '<path fill="currentColor" d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/>',
      save: '<path fill="currentColor" d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>',
      remove:
        '<path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>',
      offline:
        '<path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>',
      share:
        '<path fill="currentColor" d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/>',
      top: '<path fill="currentColor" d="M7.41 15.41 12 10.83l4.59 4.58L18 14l-6-6-6 6z"/>',
      bottom: '<path fill="currentColor" d="m7.41 8.59 4.59 4.58 4.59-4.58L18 10l-6 6-6-6z"/>',
    };
    return `<svg class="tlv-watch-later-dropdown__icon" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">${icons[type] || ""}</svg>`;
  }

  function renderDropdownMenu() {
    const cfg = C();
    const items = MENU_ITEMS.map((item) => {
      if (item.divider) {
        return `<li class="tlv-watch-later-dropdown__divider" role="separator"></li>`;
      }
      return `
        <li>
          <button type="button" class="tlv-watch-later-dropdown__item" role="menuitem" data-tlv-watch-later-action="${cfg.escapeHtml(item.id)}">
            ${renderMenuIcon(item.icon)}
            <span>${cfg.escapeHtml(item.label)}</span>
          </button>
        </li>`;
    }).join("");

    return `
      <div class="tlv-watch-later-dropdown" data-tlv-watch-later-dropdown hidden role="menu" aria-label="動画メニュー">
        <ul class="tlv-watch-later-dropdown__list">${items}</ul>
      </div>`;
  }

  function renderVideoRow(entry) {
    const cfg = C();
    const videosApi = global.TasuLiveVideos;
    const video = entry.video || {};
    const thumbUrl = videosApi?.resolveThumbUrl?.(video) || "";
    const watchUrl = cfg.watchVideoUrl(video.id);
    const channelName = resolveChannelName(video);
    const viewsLabel = formatViewCountLabel(video.views_count);
    const addedLabel = formatRelativePublishedDate(entry.addedAt);
    const duration = formatDurationBadge(video.duration_sec);
    const tone = cfg.escapeHtml(String(video.collageTone || ""));
    const thumbInner = thumbUrl
      ? `<img src="${cfg.escapeHtml(thumbUrl)}" alt="" loading="lazy" />`
      : `<div class="tlv-watch-later-row__thumb-placeholder${tone ? ` tlv-watch-later-row__thumb-placeholder--${tone}` : ""}" aria-hidden="true"></div>`;

    return `
      <article class="tlv-watch-later-row" data-tlv-watch-later-row data-video-id="${cfg.escapeHtml(entry.id)}">
        <span class="tlv-watch-later-row__handle" aria-hidden="true">≡</span>
        <a class="tlv-watch-later-row__thumb" href="${cfg.escapeHtml(watchUrl)}">
          ${thumbInner}
          ${duration ? `<span class="tlv-watch-later-row__duration">${cfg.escapeHtml(duration)}</span>` : ""}
        </a>
        <div class="tlv-watch-later-row__body">
          <a class="tlv-watch-later-row__title" href="${cfg.escapeHtml(watchUrl)}">${cfg.escapeHtml(video.title || "動画")}</a>
          <p class="tlv-watch-later-row__meta">${cfg.escapeHtml(channelName)} · ${cfg.escapeHtml(viewsLabel)}${addedLabel ? ` · ${cfg.escapeHtml(addedLabel)}` : ""}</p>
        </div>
        <button type="button" class="tlv-watch-later-row__menu" data-tlv-watch-later-row-menu="${cfg.escapeHtml(entry.id)}" aria-label="動画の操作" aria-haspopup="menu">
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
        </button>
      </article>`;
  }

  function renderVideoList(entries) {
    if (!entries.length) {
      return `
        <div class="tlv-watch-later-empty">
          <p class="tlv-watch-later-empty__title">後で見る動画はありません</p>
          <p class="tlv-watch-later-empty__text">動画のメニューから「後で見る」に追加すると、ここに表示されます。</p>
        </div>`;
    }
    return `<div class="tlv-watch-later-list" data-tlv-watch-later-list>${entries.map((entry) => renderVideoRow(entry)).join("")}</div>`;
  }

  function renderPageHtml(entries, stats) {
    return `
      <div class="tlv-watch-later-page" data-tlv-watch-later-page>
        <div class="tlv-watch-later-layout">
          ${renderPlaylistCard(stats, entries)}
          <section class="tlv-watch-later-main">
            <div class="tlv-watch-later-main__toolbar">
              <span class="tlv-watch-later-main__sort">手動設定</span>
            </div>
            ${renderVideoList(entries)}
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
    dropdown.dataset.activeVideoId = "";
    openMenuVideoId = "";
  }

  function bindWatchLaterPage(roots, reload) {
    roots.filter(Boolean).forEach((root) => {
      root.querySelectorAll("[data-tlv-watch-later-row-menu]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const videoId = String(btn.getAttribute("data-tlv-watch-later-row-menu") || "");
          const menu = root.querySelector("[data-tlv-watch-later-dropdown]");
          if (!menu || !videoId) return;
          if (!menu.hidden && openMenuVideoId === videoId) {
            closeDropdown(menu);
            return;
          }
          openMenuVideoId = videoId;
          menu.dataset.activeVideoId = videoId;
          positionDropdown(menu, btn);
        });
      });

      root.querySelectorAll("[data-tlv-watch-later-action]").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const action = btn.getAttribute("data-tlv-watch-later-action");
          const menu = root.querySelector("[data-tlv-watch-later-dropdown]");
          const videoId = String(menu?.dataset.activeVideoId || openMenuVideoId || "");
          closeDropdown(menu);

          if (!videoId) return;

          if (action === "remove") {
            if (isDemoDisplayActive()) {
              global.alert("デモ表示中のため削除できません");
              return;
            }
            const items = readStoredItems().filter((item) => String(item.id) !== videoId);
            writeStoredItems(items);
            await reload();
            return;
          }
          if (action === "top" || action === "bottom") {
            if (isDemoDisplayActive()) {
              global.alert("デモ表示中のため並べ替えできません");
              return;
            }
            const entries = await loadWatchLaterItems();
            const next = moveItem(entries, videoId, action === "top" ? "top" : "bottom");
            persistFromEntries(next);
            await reload();
            return;
          }
          if (action === "share") {
            const cfg = C();
            const url = cfg.watchVideoUrl(videoId);
            try {
              if (global.navigator?.share) {
                await global.navigator.share({ title: "TASFUL LIVE", url: global.location.origin + "/" + url });
              } else if (global.navigator?.clipboard?.writeText) {
                await global.navigator.clipboard.writeText(global.location.origin + "/" + url);
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
        });
      });

      root.querySelector("[data-tlv-watch-later-card-menu]")?.addEventListener("click", () => {
        global.alert("プレイリストの操作メニューは今後追加予定です。");
      });
    });

    if (documentMenuBound) return;
    documentMenuBound = true;

    const closeAll = (e) => {
      roots.forEach((root) => {
        const menu = root.querySelector("[data-tlv-watch-later-dropdown]");
        if (!menu || menu.hidden) return;
        if (e.target.closest("[data-tlv-watch-later-dropdown]")) return;
        if (e.target.closest("[data-tlv-watch-later-row-menu]")) return;
        closeDropdown(menu);
      });
    };

    global.document.addEventListener("click", closeAll);
    global.document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAll({ target: global.document.body });
    });
  }

  function addVideoToWatchLater(videoId) {
    const id = String(videoId || "").trim();
    if (!id) return;
    const items = readStoredItems().filter((item) => String(item.id) !== id);
    items.unshift({ id, addedAt: new Date().toISOString() });
    writeStoredItems(items.slice(0, 500));
  }

  async function mountWatchLaterPage(root, options = {}) {
    const cfg = C();
    const roots = (options.roots || [root]).filter(Boolean);
    const writeRoots = (html) => {
      roots.forEach((r) => {
        if (r) r.innerHTML = html;
      });
    };

    async function reload() {
      writeRoots('<p class="live-loading">読み込み中…</p>');
      try {
        const talkUserId = cfg.getTalkUserId();
        const demoActive = isDemoDisplayActive();
        const entries = await loadWatchLaterItems();
        const stats = computePlaylistStats(entries, talkUserId || "guest", { demo: demoActive });
        writeRoots(renderPageHtml(entries, stats));
        bindWatchLaterPage(roots, reload);
      } catch (err) {
        console.error("[TasuLiveWatchLater]", err);
        writeRoots(`<p class="live-error">読み込みに失敗しました: ${cfg.escapeHtml(err.message || err)}</p>`);
      }
    }

    await reload();
  }

  global.TasuLiveWatchLater = {
    mountWatchLaterPage,
    addVideoToWatchLater,
    readStoredItems,
    WATCH_LATER_STORAGE_KEY,
    DEMO_MODE,
  };
})(typeof window !== "undefined" ? window : globalThis);
