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

  const MAIN_NAV = Object.freeze([
    { id: "home", label: "ホーム", href: "videos.html", icon: "⌂" },
    { id: "videos", label: "動画", href: "videos.html", icon: "▶" },
    { id: "shorts", label: "ショート", href: "shorts.html", icon: "▮" },
    { id: "live", label: "ライブ配信", href: "index.html#live-broadcasts", icon: "●" },
  ]);

  const VIDEOS_MINI_NAV = Object.freeze([
    { id: "home", label: "ホーム", href: "videos.html", icon: "⌂" },
    { id: "videos", label: "動画", href: "videos.html", icon: "▶" },
    { id: "shorts", label: "ショート", href: "shorts.html", icon: "▮" },
    { id: "live", label: "ライブ配信", href: "index.html#live-broadcasts", icon: "●" },
    {
      id: "subscriptions",
      label: "登録チャンネル",
      miniLabel: "登録チャンネル",
      href: "videos.html?feed=following",
      icon: "▦",
    },
    { id: "mypage", label: "マイページ", href: "profile.html", icon: "◎" },
    { id: "creator", label: "収益・分析", href: "creator-dashboard.html", icon: "¥" },
    { id: "upload", label: "投稿", href: "video-upload.html", icon: "＋" },
  ]);

  const MYPAGE_ITEMS = Object.freeze([
    { id: "channel", label: "チャンネル", href: "profile.html", iconKey: "channel", dynamic: "channel" },
    { id: "history", label: "履歴", href: "history.html", iconKey: "history" },
    { id: "playlists", label: "再生リスト", href: "playlists.html", iconKey: "playlists" },
    { id: "watch-later", label: "後で見る", href: "watch-later.html", iconKey: "watch-later" },
    { id: "liked", label: "高く評価した動画", href: "liked-videos.html", iconKey: "liked" },
    { id: "uploaded", label: "作成した動画", href: "channel-content.html", iconKey: "uploaded" },
    { id: "offline", label: "オフライン", href: "offline.html", iconKey: "offline" },
  ]);

  const CREATOR_NAV = Object.freeze([
    { id: "creator", label: "収益・分析", href: "creator-dashboard.html", icon: "¥" },
    { id: "upload", label: "投稿", href: "video-upload.html", icon: "＋" },
  ]);

  const OPERATIONS_NAV = Object.freeze([
    { id: "ops-ads", label: "広告掲載", href: "../company/services.html", icon: "▣" },
    { id: "ops-contact", label: "お問い合わせ", href: "../company/contact.html", icon: "✉" },
    { id: "ops-terms", label: "利用規約", href: "../company/legal/terms.html", icon: "📄" },
    { id: "ops-privacy", label: "プライバシーポリシー", href: "../company/legal/privacy.html", icon: "🔒" },
  ]);

  const TLV_MORE_SERVICES = Object.freeze([
    { id: "creator", label: "収益・分析", href: "creator-dashboard.html", icon: "¥" },
    { id: "upload", label: "投稿", href: "video-upload.html", icon: "＋" },
    { id: "ops-ads", label: "広告掲載", href: "../company/services.html", icon: "▣" },
    { id: "ops-contact", label: "お問い合わせ", href: "../company/contact.html", icon: "✉" },
  ]);

  const EXPLORE_NAV = Object.freeze([
    { id: "explore-videos", label: "動画", href: "videos.html", icon: "▶" },
    { id: "explore-shorts", label: "ショート", href: "shorts.html", icon: "▮" },
    { id: "explore-live", label: "ライブ配信", href: "index.html#live-broadcasts", icon: "●" },
    { id: "explore-following", label: "登録チャンネル", href: "videos.html?feed=following", icon: "▦" },
  ]);

  const DRAWER_SECTIONS = Object.freeze([
    { type: "links", title: "", items: MAIN_NAV, dividerAfter: true },
    { type: "subscriptions", title: "登録チャンネル", dividerAfter: true },
    { type: "links", title: "マイページ", items: MYPAGE_ITEMS, dividerAfter: true },
    { type: "links", title: "TLV の他のサービス", items: TLV_MORE_SERVICES, dividerAfter: true },
    { type: "links", title: "探索", items: EXPLORE_NAV },
  ]);

  const WATCH_DRAWER_MYPAGE_ITEMS = Object.freeze([
    { id: "channel", label: "チャンネル", href: "profile.html", iconKey: "channel", dynamic: "channel" },
    { id: "history", label: "履歴", href: "history.html", iconKey: "history" },
    { id: "playlists", label: "再生リスト", href: "playlists.html", iconKey: "playlists" },
    { id: "watch-later", label: "後で見る", href: "watch-later.html", iconKey: "watch-later" },
    { id: "liked", label: "高く評価した動画", href: "liked-videos.html", iconKey: "liked" },
    { id: "uploaded", label: "作成した動画", href: "channel-content.html", iconKey: "uploaded" },
    { id: "offline", label: "オフライン", href: "offline.html", iconKey: "offline" },
  ]);

  const WATCH_DRAWER_OTHER_ITEMS = Object.freeze([
    { id: "creator", label: "収益・分析", href: "creator-dashboard.html", icon: "¥" },
    { id: "upload", label: "投稿", href: "video-upload.html", icon: "＋" },
    { id: "settings", label: "設定", href: "settings.html", icon: "⚙" },
  ]);

  const WATCH_DRAWER_SECTIONS = Object.freeze([
    { type: "links", title: "", items: MAIN_NAV, dividerAfter: true },
    { type: "subscriptions", title: "登録チャンネル", dividerAfter: true },
    { type: "links", title: "マイページ", items: WATCH_DRAWER_MYPAGE_ITEMS, dividerAfter: true },
    { type: "links", title: "", items: WATCH_DRAWER_OTHER_ITEMS },
  ]);

  const WATCH_PLACEHOLDER_CHANNELS = Object.freeze([
    { name: "premium_home", profileHref: "videos.html?feed=following", initial: "P" },
    { name: "TLV公式", profileHref: "videos.html", initial: "T" },
    { name: "test_channel", profileHref: "videos.html", initial: "t" },
  ]);

  const MYPAGE_FLYOUT_ITEMS = MYPAGE_ITEMS;

  const MINI_FLYOUT_PANELS = Object.freeze({
    subscriptions: { title: "登録チャンネル", moreHref: "videos.html?feed=following" },
    mypage: { title: "マイページ", moreHref: null },
  });

  const MINI_FLYOUT_DESKTOP_MQ = "(min-width: 1024px)";

  const MYPAGE_ACTIVE_IDS = Object.freeze([
    "mypage",
    "channel",
    "history",
    "playlists",
    "watch-later",
    "liked",
    "uploaded",
    "offline",
  ]);

  const CREATE_MENU_ITEMS = Object.freeze([
    {
      id: "video-upload",
      label: "動画をアップロード",
      href: "video-upload.html",
      iconClass: "tlv-create-menu__icon--video",
      icon: "▶",
      useUploadHref: true,
    },
    {
      id: "live-start",
      label: "ライブ配信を開始",
      href: "studio.html",
      iconClass: "tlv-create-menu__icon--live",
      icon: "●",
    },
    {
      id: "post-create",
      label: "投稿を作成",
      href: null,
      iconClass: "tlv-create-menu__icon--post",
      icon: "✎",
      comingSoon: true,
    },
  ]);

  let closeMiniFlyoutFn = null;
  let closeCreateMenuFn = null;
  let closeNotificationsMenuFn = null;
  let closeAccountMenuFn = null;

  function closeMiniFlyout() {
    closeMiniFlyoutFn?.();
  }

  function closeCreateMenu() {
    closeCreateMenuFn?.();
  }

  function closeNotificationsMenu() {
    closeNotificationsMenuFn?.();
  }

  function closeAccountMenu() {
    closeAccountMenuFn?.();
    global.TasuTlvViewAccountMenu?.close?.();
    global.TasuTlvStudioAccountMenu?.close?.();
  }

  function resolveAccountMenuApi() {
    const ctx = global.TasuTlvAccountContext?.resolveContext?.() || "view";
    if (ctx === "studio") return global.TasuTlvStudioAccountMenu;
    return global.TasuTlvViewAccountMenu;
  }

  function accountMenuBeforeOpen() {
    closeCreateMenu();
    closeNotificationsMenu();
    closeMiniFlyout();
    const ctx = global.TasuTlvAccountContext?.resolveContext?.() || "view";
    if (ctx === "studio") {
      global.TasuTlvViewAccountMenu?.close?.();
    } else {
      global.TasuTlvStudioAccountMenu?.close?.();
    }
  }

  function tlvReturnToParam() {
    const loc = global.location;
    return encodeURIComponent(`${loc?.pathname || ""}${loc?.search || ""}${loc?.hash || ""}`);
  }

  function tlvLoginHref() {
    return `../login.html?returnTo=${tlvReturnToParam()}`;
  }

  function tlvSignupHref() {
    return `../signup.html?returnTo=${tlvReturnToParam()}`;
  }

  function formatNotificationRelativeTime(iso) {
    if (!iso) return "";
    const ms = Date.now() - new Date(iso).getTime();
    if (!Number.isFinite(ms) || ms < 0) return "";
    const min = Math.floor(ms / 60000);
    if (min < 1) return "たった今";
    if (min < 60) return `${min} 分前`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} 時間前`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day} 日前`;
    return new Date(iso).toLocaleDateString("ja-JP");
  }

  function mapRawNotificationRow(row, cfg) {
    if (global.TasuLiveNotificationsData?.mapRawNotificationRow) {
      return global.TasuLiveNotificationsData.mapRawNotificationRow(row, cfg);
    }
    const actorId = String(row.sender_user_id || row.senderUserId || row.actorId || "").trim();
    const actorName = actorId ? cfg?.resolveDisplayName?.(actorId) || actorId : "TASFUL";
    const title = String(row.title || row.videoTitle || "").trim();
    const body = String(row.body || row.message || "").trim();
    const source = String(row.source || row.type || "").toLowerCase();
    let kind = "admin";
    if (source.includes("live") || source.includes("broadcast")) kind = "live";
    else if (source.includes("video")) kind = "video";
    else if (source.includes("comment")) kind = "comment";
    else if (source.includes("follow")) kind = "follow";
    else if (source.includes("like")) kind = "like";
    else if (source === "system" || source.includes("admin")) kind = "admin";
    return {
      id: String(row.id || ""),
      kind,
      actorId,
      actorName,
      title: title || body.slice(0, 48) || "通知",
      href: String(row.href || row.target_url || row.targetUrl || "#"),
      thumb: row.thumb || row.thumbnail_url || "",
      createdAt: row.created_at || row.createdAt || new Date().toISOString(),
      unread: !row.read_at && !row.readAt,
    };
  }

  function getDemoNotificationItems(cfg) {
    const now = Date.now();
    const thumb = (text) =>
      `https://placehold.co/168x94/1a1030/e879f9?text=${encodeURIComponent(text)}`;
    return [
      {
        id: "demo-live",
        kind: "live",
        actorId: "u_creator",
        actorName: cfg?.resolveDisplayName?.("u_creator") || "LIVEクリエイター",
        title: "住まいづくり相談ライブ",
        href: "watch.html?broadcast_id=stub&talkDev=1",
        thumb: thumb("LIVE"),
        createdAt: new Date(now - 2 * 3600000).toISOString(),
        unread: true,
      },
      {
        id: "demo-video",
        kind: "video",
        actorId: "u_store",
        actorName: cfg?.resolveDisplayName?.("u_store") || "premium_home",
        title: "新築工事の現場ツアー",
        href: "videos.html",
        thumb: thumb("VIDEO"),
        createdAt: new Date(now - 5 * 3600000).toISOString(),
        unread: true,
      },
      {
        id: "demo-comment",
        kind: "comment",
        actorId: "u_creator",
        actorName: cfg?.resolveDisplayName?.("u_creator") || "LIVEクリエイター",
        title: "コメントへの返信",
        href: "videos.html",
        thumb: thumb("REPLY"),
        createdAt: new Date(now - 9 * 3600000).toISOString(),
        unread: false,
      },
      {
        id: "demo-follow",
        kind: "follow",
        actorId: "u_store",
        actorName: cfg?.resolveDisplayName?.("u_store") || "premium_home",
        title: "",
        href: "profile.html?userId=u_store",
        thumb: "",
        createdAt: new Date(now - 20 * 3600000).toISOString(),
        unread: false,
      },
      {
        id: "demo-like",
        kind: "like",
        actorId: "u_creator",
        actorName: cfg?.resolveDisplayName?.("u_creator") || "LIVEクリエイター",
        title: "外構工事のポイント解説",
        href: "videos.html",
        thumb: thumb("LIKE"),
        createdAt: new Date(now - 28 * 3600000).toISOString(),
        unread: false,
      },
      {
        id: "demo-admin",
        kind: "admin",
        actorId: "",
        actorName: "TASFUL LIVE 運営",
        title: "クリエイター向けガイドラインを更新しました",
        href: "../company/legal/terms.html",
        thumb: thumb("INFO"),
        createdAt: new Date(now - 48 * 3600000).toISOString(),
        unread: false,
      },
    ];
  }

  async function fetchNotificationPanelData() {
    if (!isAuthenticatedTalkUser()) {
      return { state: "login", items: [] };
    }

    const cfg = liveCfg();
    let items = [];

    if (global.TasuLiveNotificationsData?.fetchNotificationItems) {
      items = await global.TasuLiveNotificationsData.fetchNotificationItems();
    } else if (global.TasuTlvNotificationService?.listNotifications) {
      items = await global.TasuTlvNotificationService.listNotifications();
    } else {
      const userId = cfg?.getTalkUserId?.() || "";
      let rows = [];
      try {
        const raw = global.localStorage?.getItem("tasful_talk_notifications");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) rows = parsed;
        }
      } catch {
        /* ignore */
      }
      items = rows.map((row) => mapRawNotificationRow(row, cfg)).filter((item) => item.id);
    }

    if (!items.length && cfg?.isTalkDevStubMode?.() && !global.TasuTlvDevAuth?.shouldUseTlvNotifyLocalFallback?.()) {
      items = getDemoNotificationItems(cfg);
    }

    if (!items.length) {
      return { state: "empty", items: [] };
    }

    return { state: "ok", items: items.slice(0, 12) };
  }

  function renderNotificationItemText(item) {
    const name = esc(item.actorName);
    switch (item.kind) {
      case "live":
      case "live_started":
        if (item.kind === "live_started" || item.event === "live_started") {
          return `<strong>${name}</strong> がライブ配信を開始しました`;
        }
        return `<strong>${name}</strong> がライブ配信中: ${esc(item.title)}`;
      case "video":
        return `<strong>${name}</strong> が新しい動画を投稿しました: ${esc(item.title)}`;
      case "video_published":
        return `<strong>${name}</strong> が新しい動画を公開しました`;
      case "comment":
        return `<strong>${name}</strong> があなたの動画にコメントしました`;
      case "follow":
        return `<strong>${name}</strong> があなたをフォローしました`;
      case "system":
        if (global.TasuTlvNotificationService?.renderItemText) {
          return global.TasuTlvNotificationService.renderItemText(item);
        }
        return `<strong>${esc(item.systemTitle || item.title || "お知らせ")}</strong>${item.systemBody ? `<br>${esc(item.systemBody)}` : ""}`;
      case "like":
        return `<strong>${name}</strong> があなたの動画「${esc(item.title)}」に高く評価しました`;
      case "admin":
      default:
        return `<strong>${name}</strong>: ${esc(item.title)}`;
    }
  }

  function renderNotificationItemRow(item, cfg) {
    const avatarUrl =
      item.actorAvatar ||
      (item.actorId && cfg?.resolveAvatarUrl
        ? cfg.resolveAvatarUrl(item.actorId)
        : `https://placehold.co/80x80/1a1030/e879f9?text=TLV`);
    const thumbStyle = item.thumb
      ? ` style="background-image:url('${esc(item.thumb)}')"`
      : ` style="background-image:url('https://placehold.co/168x94/1a1030/6d28d9?text=TLV')"`;

    return `
      <li class="tlv-notify-menu__item">
        <a class="tlv-notify-menu__item-link" href="${esc(item.href)}" data-tlv-notification-id="${esc(item.id)}">
          ${item.unread ? '<span class="tlv-notify-menu__dot" aria-hidden="true"></span>' : '<span class="tlv-notify-menu__dot tlv-notify-menu__dot--read" aria-hidden="true"></span>'}
          <img class="tlv-notify-menu__avatar" src="${esc(avatarUrl)}" width="40" height="40" alt="" loading="lazy" decoding="async" />
          <span class="tlv-notify-menu__content">
            <span class="tlv-notify-menu__text">${renderNotificationItemText(item)}</span>
            <time class="tlv-notify-menu__time" datetime="${esc(item.createdAt)}">${esc(formatNotificationRelativeTime(item.createdAt))}</time>
          </span>
          <span class="tlv-notify-menu__thumb"${thumbStyle} aria-hidden="true"></span>
        </a>
        <button type="button" class="tlv-notify-menu__kebab" aria-label="通知のオプション" data-tlv-notify-kebab>⋮</button>
      </li>`;
  }

  function renderNotificationPanelBody(data) {
    const cfg = liveCfg();
    if (data.state === "login") {
      return `
        <div class="tlv-notify-menu__empty">
          <p class="tlv-notify-menu__empty-text">ログインすると通知を確認できます</p>
          <a class="live-btn live-btn--primary" href="${esc(tlvLoginHref())}">ログイン</a>
        </div>`;
    }
    if (data.state === "empty") {
      return `
        <div class="tlv-notify-menu__empty">
          <p class="tlv-notify-menu__empty-text">新しい通知はありません</p>
        </div>`;
    }
    const rows = (data.items || []).map((item) => renderNotificationItemRow(item, cfg)).join("");
    return `
      <section class="tlv-notify-menu__section" aria-label="重要">
        <h3 class="tlv-notify-menu__section-title">重要</h3>
        <ul class="tlv-notify-menu__list">${rows}</ul>
      </section>`;
  }

  function renderNotificationPanelShell(bodyHtml, showMore) {
    const moreHtml = showMore
      ? `<div class="tlv-notify-menu__foot">
          <a class="tlv-notify-menu__more" href="notifications.html">通知をもっと見る</a>
        </div>`
      : "";
    return `
      <div class="tlv-notify-menu__head">
        <h2 class="tlv-notify-menu__title">通知</h2>
        <a class="tlv-notify-menu__settings" href="settings.html" title="通知設定" aria-label="通知設定">
          <span aria-hidden="true">⚙</span>
        </a>
      </div>
      <div class="tlv-notify-menu__body">${bodyHtml}</div>
      ${moreHtml}`;
  }

  function renderNotificationsMenuHtml(options = {}) {
    const compact = Boolean(options.compact);
    const panelId = compact ? "tlv-notify-menu-panel-mobile" : "tlv-notify-menu-panel-desktop";
    return `
      <div class="tlv-notify-menu${compact ? " tlv-notify-menu--compact" : ""}" data-tlv-notify-menu>
        <button type="button" class="tlv-videos-action tlv-videos-action--icon tlv-notify-menu__trigger" data-tlv-notify-menu-toggle aria-haspopup="dialog" aria-expanded="false" aria-controls="${panelId}" title="通知" aria-label="通知">
          <span aria-hidden="true">🔔</span>
        </button>
        <div class="tlv-notify-menu__panel" id="${panelId}" data-tlv-notify-menu-panel hidden role="dialog" aria-label="通知" aria-modal="false">
          <p class="tlv-notify-menu__loading">読み込み中…</p>
        </div>
      </div>`;
  }

  function positionNotifyPanel(panel, trigger) {
    if (!panel || !trigger) return;
    const mqMobile = global.matchMedia("(max-width: 1023px)");
    if (mqMobile.matches) {
      const rect = trigger.getBoundingClientRect();
      const margin = 8;
      const width = Math.min(480, global.innerWidth - margin * 2);
      const left = Math.max(margin, global.innerWidth - width - margin);
      const maxHeight = Math.min(global.innerHeight * 0.8, global.innerHeight - rect.bottom - margin * 2);
      panel.style.position = "fixed";
      panel.style.width = `${width}px`;
      panel.style.left = `${Math.round(left)}px`;
      panel.style.top = `${Math.round(rect.bottom + 8)}px`;
      panel.style.right = "auto";
      panel.style.maxHeight = `${Math.max(220, maxHeight)}px`;
    } else {
      panel.style.position = "";
      panel.style.width = "";
      panel.style.left = "";
      panel.style.top = "";
      panel.style.right = "";
      panel.style.maxHeight = "";
    }
  }

  function initNotificationsMenu() {
    if (global.document.body.dataset.tlvNotifyMenuBound === "1") {
      return;
    }
    global.document.body.dataset.tlvNotifyMenuBound = "1";

    const mqMobile = global.matchMedia("(max-width: 1023px)");
    let openMenu = null;
    let panelCache = null;

    function setOpen(trigger, panel, open) {
      if (!trigger || !panel) return;
      panel.hidden = !open;
      trigger.setAttribute("aria-expanded", open ? "true" : "false");
      trigger.classList.toggle("is-open", open);
      global.document.body.classList.toggle("tlv-notify-menu-open", open);
      openMenu = open ? { trigger, panel } : null;
      if (!open) panelCache = null;
    }

    function closeMenu() {
      if (!openMenu) return;
      setOpen(openMenu.trigger, openMenu.panel, false);
    }

    async function renderPanel(panel) {
      panel.innerHTML = `<p class="tlv-notify-menu__loading">読み込み中…</p>`;
      const data = await fetchNotificationPanelData();
      panelCache = data;
      if (!openMenu || openMenu.panel !== panel) return;
      const bodyHtml = renderNotificationPanelBody(data);
      const showMore = data.state === "ok";
      panel.innerHTML = renderNotificationPanelShell(bodyHtml, showMore);
      refreshNotifyTriggerLabels(data);
    }

    function refreshNotifyTriggerLabels(data) {
      const unread =
        data?.state === "ok"
          ? (data.items || []).filter((item) => item.unread).length
          : 0;
      const label = unread > 0 ? `通知（未読${unread}件）` : "通知";
      global.document.querySelectorAll("[data-tlv-notify-menu-toggle]").forEach((btn) => {
        btn.setAttribute("aria-label", label);
        btn.setAttribute("title", label);
      });
    }

    async function prefetchNotifyUnreadLabels() {
      if (!isAuthenticatedTalkUser()) return;
      try {
        const data = await fetchNotificationPanelData();
        refreshNotifyTriggerLabels(data);
      } catch {
        /* ignore */
      }
    }

    async function openMenuFrom(trigger) {
      const menu = trigger.closest("[data-tlv-notify-menu]");
      const panel = menu?.querySelector("[data-tlv-notify-menu-panel]");
      if (!panel) return;
      closeCreateMenu();
      closeAccountMenu();
      closeMiniFlyout();
      if (openMenu?.trigger === trigger && !panel.hidden) {
        closeMenu();
        return;
      }
      if (openMenu) closeMenu();
      setOpen(trigger, panel, true);
      positionNotifyPanel(panel, trigger);
      await renderPanel(panel);
      if (openMenu?.trigger === trigger) {
        positionNotifyPanel(panel, trigger);
      }
    }

    global.document.addEventListener(
      "click",
      async (e) => {
        const notifyLink = e.target.closest("[data-tlv-notification-id]");
        if (notifyLink && e.target.closest("[data-tlv-notify-menu]")) {
          const id = notifyLink.getAttribute("data-tlv-notification-id") || "";
          const item = panelCache?.items?.find((row) => row.id === id);
          if (item?.unread && global.TasuTlvNotificationService?.markAsRead) {
            await global.TasuTlvNotificationService.markAsRead(id);
            item.unread = false;
            item.read = true;
            if (openMenu?.panel) {
              const bodyHtml = renderNotificationPanelBody(panelCache);
              const showMore = panelCache.state === "ok";
              openMenu.panel.innerHTML = renderNotificationPanelShell(bodyHtml, showMore);
              refreshNotifyTriggerLabels(panelCache);
            }
          }
        }

        const toggle = e.target.closest("[data-tlv-notify-menu-toggle]");
        if (toggle) {
          e.preventDefault();
          e.stopPropagation();
          openMenuFrom(toggle);
          return;
        }
        if (e.target.closest("[data-tlv-notify-kebab]")) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (openMenu && !e.target.closest("[data-tlv-notify-menu]")) {
          closeMenu();
        }
      },
      true,
    );

    global.document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && openMenu) closeMenu();
    });

    mqMobile.addEventListener("change", () => {
      if (openMenu) positionNotifyPanel(openMenu.panel, openMenu.trigger);
    });

    global.addEventListener("resize", () => {
      if (openMenu) positionNotifyPanel(openMenu.panel, openMenu.trigger);
    });

    closeNotificationsMenuFn = closeMenu;
    prefetchNotifyUnreadLabels();
  }

  function renderCreateMenuItem(item, uploadHref) {
    const iconHtml = `<span class="tlv-create-menu__icon ${esc(item.iconClass)}" aria-hidden="true">${esc(item.icon)}</span>`;
    if (item.comingSoon) {
      return `
        <div class="tlv-create-menu__item tlv-create-menu__item--disabled" role="menuitem" aria-disabled="true">
          ${iconHtml}
          <span class="tlv-create-menu__text">
            <span class="tlv-create-menu__label">${esc(item.label)}</span>
            <span class="tlv-create-menu__hint">準備中</span>
          </span>
        </div>`;
    }
    const href = item.useUploadHref ? uploadHref : item.href;
    return `
      <a class="tlv-create-menu__item" href="${esc(href)}" role="menuitem" data-tlv-create-menu-item="${esc(item.id)}">
        ${iconHtml}
        <span class="tlv-create-menu__label">${esc(item.label)}</span>
      </a>`;
  }

  function renderCreateMenuHtml(options = {}) {
    const uploadHref = String(options.uploadHref || "video-upload.html");
    const compact = Boolean(options.compact);
    const triggerClass = compact
      ? "tlv-videos-action tlv-videos-action--icon tlv-videos-action--upload tlv-create-menu__trigger tlv-create-menu__trigger--icon"
      : "tlv-videos-action tlv-videos-action--upload tlv-create-menu__trigger";
    const items = CREATE_MENU_ITEMS.map((item) => renderCreateMenuItem(item, uploadHref)).join("");
    const panelId = compact ? "tlv-create-menu-panel-mobile" : "tlv-create-menu-panel-desktop";

    return `
      <div class="tlv-create-menu${compact ? " tlv-create-menu--compact" : ""}" data-tlv-create-menu>
        <button type="button" class="${triggerClass}" data-tlv-create-menu-toggle aria-haspopup="menu" aria-expanded="false" aria-controls="${panelId}" title="作成" aria-label="作成メニューを開く">
          <span class="tlv-videos-action__icon" aria-hidden="true">＋</span>
          ${compact ? "" : '<span class="tlv-videos-action__label">投稿</span>'}
        </button>
        <div class="tlv-create-menu__panel" id="${panelId}" data-tlv-create-menu-panel hidden role="menu" aria-label="作成メニュー">
          ${items}
        </div>
      </div>`;
  }

  function initCreateMenu() {
    if (global.document.body.dataset.tlvCreateMenuBound === "1") {
      return;
    }
    global.document.body.dataset.tlvCreateMenuBound = "1";

    let openMenu = null;

    function setOpen(trigger, panel, open) {
      if (!trigger || !panel) return;
      panel.hidden = !open;
      trigger.setAttribute("aria-expanded", open ? "true" : "false");
      trigger.classList.toggle("is-open", open);
      global.document.body.classList.toggle("tlv-create-menu-open", open);
      openMenu = open ? { trigger, panel } : null;
    }

    function closeMenu() {
      if (!openMenu) return;
      setOpen(openMenu.trigger, openMenu.panel, false);
    }

    function openMenuFrom(trigger) {
      const menu = trigger.closest("[data-tlv-create-menu]");
      const panel = menu?.querySelector("[data-tlv-create-menu-panel]");
      if (!panel) return;
      closeMiniFlyout();
      closeNotificationsMenu();
      closeAccountMenu();
      if (openMenu?.trigger === trigger && !panel.hidden) {
        closeMenu();
        return;
      }
      if (openMenu) closeMenu();
      setOpen(trigger, panel, true);
    }

    global.document.addEventListener(
      "click",
      (e) => {
        const toggle = e.target.closest("[data-tlv-create-menu-toggle]");
        if (toggle) {
          e.preventDefault();
          e.stopPropagation();
          openMenuFrom(toggle);
          return;
        }
        if (openMenu && !e.target.closest("[data-tlv-create-menu]")) {
          closeMenu();
        }
      },
      true,
    );

    global.document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && openMenu) closeMenu();
    });

    closeCreateMenuFn = closeMenu;
  }

  function renderAccountMenuHtml(options = {}) {
    const api = resolveAccountMenuApi();
    if (api === global.TasuTlvStudioAccountMenu) {
      return api.renderHtml?.({ variant: options.compact ? "mobile" : "topbar", compact: options.compact }) || "";
    }
    return api?.renderHtml?.(options) || "";
  }

  function initAccountMenu() {
    const ctx = global.TasuTlvAccountContext?.resolveContext?.() || "view";
    if (ctx === "studio") {
      global.TasuTlvStudioAccountMenu?.init?.({ beforeOpen: accountMenuBeforeOpen });
      closeAccountMenuFn = () => global.TasuTlvStudioAccountMenu?.close?.();
      return;
    }
    global.TasuTlvViewAccountMenu?.init?.({ beforeOpen: accountMenuBeforeOpen });
    closeAccountMenuFn = () => global.TasuTlvViewAccountMenu?.close?.();
  }

  function isNavItemActive(itemId, activeId) {
    if (!itemId || !activeId) return false;
    if (itemId === activeId) return true;
    if (itemId === "subscriptions" && (activeId === "subscriptions" || activeId === "following")) return true;
    if (itemId === "mypage" && MYPAGE_ACTIVE_IDS.includes(activeId)) return true;
    return false;
  }

  function miniNavDisplayLabel(item) {
    return item.miniLabel || item.label;
  }

  function renderMypageIcon(iconKey) {
    const icons = {
      channel:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg>',
      history:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>',
      playlists:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 12H3"/><path d="M16 6H3"/><path d="M16 18H3"/><path d="m16 12 4 2-4 2z"/></svg>',
      "watch-later":
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
      liked:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/></svg>',
      uploaded:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 8 6 4-6 4Z"/></svg>',
      offline:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/></svg>',
    };
    return icons[iconKey] || "";
  }

  function getSidebarActiveId() {
    return (
      global.document.body?.dataset?.tlvSidebarActive ||
      global.document.body?.dataset?.tlvPage ||
      ""
    );
  }

  function isMypageItemActive(itemId, activeId) {
    return itemId === activeId;
  }

  function resolveDrawerItemHref(item) {
    const cfg = liveCfg();
    if (item.dynamic === "channel") {
      const userId = cfg?.getTalkUserId?.();
      return userId ? cfg.profileUrl(userId) : item.href;
    }
    if (item.shelf) {
      return `${item.href}${item.href.includes("?") ? "&" : "?"}shelf=${encodeURIComponent(item.shelf)}`;
    }
    return item.href;
  }

  function renderVideosBrandHtml(compact = false) {
    const nameClass = compact ? " tlv-videos-brand__name--compact" : "";
    return `
      <a class="tlv-videos-brand${compact ? " tlv-videos-brand--compact" : ""}" href="videos.html" aria-label="TalkLiveView LIVE">
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
        ${renderCreateMenuHtml({ uploadHref })}
        ${renderNotificationsMenuHtml()}
        ${renderAccountMenuHtml()}
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
      const active = isNavItemActive(item.id, activeId);
      const hasFlyout = item.id === "mypage" && Boolean(MINI_FLYOUT_PANELS[item.id]);
      const label = miniNavDisplayLabel(item);
      const labelClass =
        item.id === "subscriptions" ? " tlv-videos-mini-nav__label--subscriptions" : "";
      if (hasFlyout) {
        return `
        <button type="button" class="tlv-videos-mini-nav__link tlv-videos-mini-nav__link--flyout${active ? " is-active" : ""}" data-tlv-mini-nav="${esc(item.id)}" data-tlv-mini-flyout="${esc(item.id)}" data-tlv-flyout-href="${esc(item.href)}" title="${esc(item.label)}" aria-haspopup="true" aria-expanded="false">
          <span class="tlv-videos-mini-nav__icon" aria-hidden="true">${esc(item.icon)}</span>
          <span class="tlv-videos-mini-nav__label${labelClass}">${esc(label)}</span>
        </button>`;
      }
      return `
        <a class="tlv-videos-mini-nav__link${active ? " is-active" : ""}" href="${esc(item.href)}" data-tlv-mini-nav="${esc(item.id)}" title="${esc(item.label)}">
          <span class="tlv-videos-mini-nav__icon" aria-hidden="true">${esc(item.icon)}</span>
          <span class="tlv-videos-mini-nav__label${labelClass}">${esc(label)}</span>
        </a>`;
    }).join("");

    return `
      <aside class="tlv-desktop-sidebar tlv-videos-mini-sidebar" aria-label="TLV ナビゲーション">
        <nav class="tlv-videos-mini-nav" aria-label="クイックナビ">${items}</nav>
      </aside>`;
  }

  function formatSubscriberCount(count) {
    const n = Number(count ?? 0);
    if (!Number.isFinite(n) || n < 0) return "0人";
    return `${n.toLocaleString("ja-JP")}人`;
  }

  function buildMypageSidebarProfileData(userId) {
    const cfg = liveCfg();
    const id = String(userId || "").trim();
    if (!id) return null;
    const displayName = cfg?.resolveDisplayName?.(id) || truncateIdFallback(id);
    const handle = cfg?.resolveChannelHandle?.(id) || `@${id.slice(0, 8)}`;
    const avatar = cfg?.resolveAvatarUrl?.(id) || "";
    const profileHref = cfg?.profileUrl?.(id) || "profile.html";
    const initial = encodeURIComponent(String(displayName).slice(0, 2) || "ME");
    return {
      userId: id,
      displayName,
      handle,
      avatar,
      profileHref,
      initial,
      subscribers: null,
    };
  }

  function truncateIdFallback(userId) {
    const cfg = liveCfg();
    if (cfg?.truncateIdFallback) return cfg.truncateIdFallback(userId);
    const id = String(userId || "").trim();
    if (!id) return "ユーザー";
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return `${id.slice(0, 8)}…`;
    }
    return id;
  }

  function renderMypageSidebarProfileHtml(data, options = {}) {
    if (!data) return "";
    const variant = options.variant === "flyout" ? "flyout" : "drawer";
    const blockClass =
      variant === "flyout" ? "tlv-videos-mini-flyout__profile" : "tlv-videos-drawer__profile";
    const subscribers =
      data.subscribers == null
        ? '<span class="tlv-sidebar-channel-profile__subs" data-tlv-mypage-profile-subs>—</span>'
        : `<span class="tlv-sidebar-channel-profile__subs" data-tlv-mypage-profile-subs>登録者 ${esc(formatSubscriberCount(data.subscribers))}</span>`;
    return `
      <a class="${blockClass} tlv-sidebar-channel-profile" href="${esc(data.profileHref)}" data-tlv-mypage-sidebar-profile>
        <img
          class="tlv-sidebar-channel-profile__avatar"
          src="${esc(data.avatar)}"
          alt=""
          width="96"
          height="96"
          loading="lazy"
          decoding="async"
          onerror="this.src='https://placehold.co/96x96/1a1030/e879f9?text=${esc(data.initial)}'"
        />
        <div class="tlv-sidebar-channel-profile__text">
          <span class="tlv-sidebar-channel-profile__label">チャンネル</span>
          <span class="tlv-sidebar-channel-profile__name" data-tlv-mypage-profile-name>${esc(data.displayName)}</span>
          <span class="tlv-sidebar-channel-profile__handle" data-tlv-mypage-profile-handle>${esc(data.handle)}</span>
          ${subscribers}
        </div>
      </a>`;
  }

  function canShowMypageSidebarProfile() {
    const userId = liveCfg()?.getTalkUserId?.();
    return Boolean(String(userId || "").trim());
  }

  function renderDrawerMypageProfileShell() {
    if (!canShowMypageSidebarProfile()) return "";
    const cfg = liveCfg();
    const userId = cfg?.getTalkUserId?.();
    const data = buildMypageSidebarProfileData(userId);
    if (!data) return "";
    return renderMypageSidebarProfileHtml(data, { variant: "drawer" });
  }

  async function hydrateMypageSidebarProfiles() {
    const cfg = liveCfg();
    const userId = cfg?.getTalkUserId?.();
    if (!userId) return;

    let subscribers = 0;
    try {
      const profile = await cfg.fetchCreatorProfile?.(userId);
      subscribers = Number(profile?.follower_count ?? 0);
    } catch (err) {
      console.warn("[TasuTlvVideosSidebar] mypage profile subs skipped:", err.message || err);
    }

    const subsText = `登録者 ${formatSubscriberCount(subscribers)}`;
    global.document.querySelectorAll("[data-tlv-mypage-profile-subs]").forEach((el) => {
      el.textContent = subsText;
    });
  }

  function initDrawerMypageProfile() {
    hydrateMypageSidebarProfiles();
  }

  function renderDrawerLink(item, activeId) {
    const active = item.id === activeId || isNavItemActive(item.id, activeId);
    const href = resolveDrawerItemHref(item);
    const iconHtml = item.iconKey
      ? `<span class="tlv-videos-drawer__icon tlv-mypage-icon">${renderMypageIcon(item.iconKey)}</span>`
      : `<span class="tlv-videos-drawer__icon" aria-hidden="true">${esc(item.icon || "")}</span>`;
    return `
      <a class="tlv-videos-drawer__link${active ? " is-active" : ""}" href="${esc(href)}">
        ${iconHtml}
        <span class="tlv-videos-drawer__text">${esc(item.label)}</span>
      </a>`;
  }

  function renderDrawerLinksSection(section, activeId) {
    const links = (section.items || []).map((item) => renderDrawerLink(item, activeId)).join("");
    const title = section.title
      ? `<h3 class="tlv-videos-drawer__section-title">${esc(section.title)}</h3>`
      : "";
    const divider = section.dividerAfter ? `<div class="tlv-videos-drawer__divider" aria-hidden="true"></div>` : "";
    return `
      <section class="tlv-videos-drawer__section">
        ${title}
        <div class="tlv-videos-drawer__section-links">${links}</div>
      </section>
      ${divider}`;
  }

  function renderDrawerSubscriptionsSection(section, activeId) {
    const active = activeId === "subscriptions" || activeId === "following";
    const divider = section.dividerAfter ? `<div class="tlv-videos-drawer__divider" aria-hidden="true"></div>` : "";
    return `
      <section class="tlv-videos-drawer__section tlv-videos-drawer__section--subscriptions">
        <a class="tlv-videos-drawer__section-heading${active ? " is-active" : ""}" href="videos.html?feed=following">
          <h3 class="tlv-videos-drawer__section-title">${esc(section.title)}</h3>
          <span class="tlv-videos-drawer__section-chevron" aria-hidden="true">›</span>
        </a>
        <div class="tlv-videos-drawer__subscriptions" data-tlv-drawer-subscriptions>
          <p class="tlv-videos-drawer__subscriptions-placeholder">読み込み中…</p>
        </div>
      </section>
      ${divider}`;
  }

  function renderDrawerSection(section, activeId) {
    if (section.type === "subscriptions") {
      return renderDrawerSubscriptionsSection(section, activeId);
    }
    return renderDrawerLinksSection(section, activeId);
  }

  function renderWatchDrawerSubscriptionsSection(section, activeId) {
    const active = activeId === "subscriptions" || activeId === "following";
    const divider = section.dividerAfter ? `<div class="tlv-videos-drawer__divider" aria-hidden="true"></div>` : "";
    const rows = WATCH_PLACEHOLDER_CHANNELS.map(
      (channel) => `
        <a class="tlv-videos-drawer__creator-row" href="${esc(channel.profileHref)}">
          <img class="tlv-videos-mini-flyout__avatar" src="https://placehold.co/36x36/1a1030/e879f9?text=${esc(channel.initial)}" alt="" width="36" height="36" loading="lazy" />
          <span class="tlv-videos-mini-flyout__label">${esc(channel.name)}</span>
        </a>`,
    ).join("");
    return `
      <section class="tlv-videos-drawer__section tlv-videos-drawer__section--subscriptions">
        <a class="tlv-videos-drawer__section-heading${active ? " is-active" : ""}" href="videos.html?feed=following">
          <h3 class="tlv-videos-drawer__section-title">${esc(section.title)}</h3>
          <span class="tlv-videos-drawer__section-chevron" aria-hidden="true">›</span>
        </a>
        <div class="tlv-videos-drawer__subscriptions">
          <div class="tlv-videos-drawer__subscriptions-list">${rows}</div>
        </div>
      </section>
      ${divider}`;
  }

  function renderWatchDrawerSection(section, activeId) {
    if (section.type === "subscriptions") {
      return renderWatchDrawerSubscriptionsSection(section, activeId);
    }
    return renderDrawerLinksSection(section, activeId);
  }

  function renderWatchDrawerPanel(activeId = "videos") {
    const id = "tlv-watch-drawer";
    const sections = WATCH_DRAWER_SECTIONS.map((s) => renderWatchDrawerSection(s, activeId)).join("");
    return `
      <aside class="tlv-videos-drawer tlv-videos-drawer--mobile-overlay tlv-side-drawer" id="${id}" data-tlv-watch-drawer role="dialog" aria-label="ナビゲーションメニュー" aria-hidden="true">
        <div class="tlv-videos-drawer__head">
          <button type="button" class="tlv-videos-drawer__menu-btn" data-tlv-drawer-toggle aria-label="メニューを閉じる" aria-expanded="false" aria-controls="${id}">
            <span aria-hidden="true">☰</span>
          </button>
          <a class="tlv-videos-drawer__brand" href="videos.html">
            <span class="tlv-videos-drawer__brand-mark">TLV</span>
            <span class="tlv-videos-drawer__brand-text">TalkLiveView LIVE</span>
          </a>
        </div>
        <div class="tlv-videos-drawer__scroll">
          ${sections}
        </div>
      </aside>`;
  }

  function renderWatchOverlayDrawer(activeId = "videos") {
    return `
      <div class="tlv-videos-drawer-backdrop tlv-drawer-backdrop" data-tlv-watch-drawer-backdrop hidden></div>
      ${renderWatchDrawerPanel(activeId)}`;
  }

  function renderVideosDrawerPanel(activeId = "home", options = {}) {
    const variant = options.variant || "mobile-overlay";
    const id = variant === "desktop-rail" ? "tlv-videos-drawer-desktop" : "tlv-videos-drawer";
    const dataAttr =
      variant === "desktop-rail"
        ? "data-tlv-videos-drawer-desktop"
        : "data-tlv-videos-drawer-mobile";
    const sections = DRAWER_SECTIONS.map((s) => renderDrawerSection(s, activeId)).join("");
    const profileHtml = renderDrawerMypageProfileShell();

    return `
      <aside class="tlv-videos-drawer tlv-videos-drawer--${variant}" id="${id}" ${dataAttr} aria-label="TLV メニュー" aria-hidden="true">
        <div class="tlv-videos-drawer__head">
          <button type="button" class="tlv-videos-drawer__menu-btn" data-tlv-drawer-toggle aria-label="メニューを閉じる" aria-expanded="false" aria-controls="${id}">
            <span aria-hidden="true">☰</span>
          </button>
          <a class="tlv-videos-drawer__brand" href="videos.html">
            <span class="tlv-videos-drawer__brand-mark">TLV</span>
            <span class="tlv-videos-drawer__brand-text">TASFUL LIVE</span>
          </a>
        </div>
        ${profileHtml}
        <div class="tlv-videos-drawer__scroll">
          ${sections}
        </div>
      </aside>`;
  }

  function renderVideosDesktopSidebarRail(activeId = "home") {
    return `
      <div class="tlv-videos-sidebar-rail" data-tlv-videos-sidebar-rail>
        ${renderVideosCompactSidebar(activeId)}
        ${renderVideosDrawerPanel(activeId, { variant: "desktop-rail" })}
      </div>`;
  }

  function ensureMiniFlyoutPortal() {
    let flyout = global.document.querySelector("[data-tlv-mini-flyout-portal]");
    if (!flyout) {
      flyout = global.document.createElement("div");
      flyout.className = "tlv-videos-mini-flyout";
      flyout.setAttribute("data-tlv-mini-flyout-portal", "");
      flyout.hidden = true;
      flyout.setAttribute("aria-hidden", "true");
      global.document.body.appendChild(flyout);
    }
    return flyout;
  }

  function ensureMiniFlyoutBackdrop() {
    let backdrop = global.document.querySelector("[data-tlv-mini-flyout-backdrop]");
    if (!backdrop) {
      backdrop = global.document.createElement("div");
      backdrop.className = "tlv-videos-mini-flyout-backdrop";
      backdrop.setAttribute("data-tlv-mini-flyout-backdrop", "");
      backdrop.hidden = true;
      global.document.body.appendChild(backdrop);
    }
    return backdrop;
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
      const drawerId = String(options.drawerControlsId || "tlv-videos-drawer-desktop");
      return `
        <header class="tlv-desktop-topbar tlv-desktop-topbar--videos tlv-desktop-topbar--youtube">
          <div class="tlv-videos-topbar__start">
            <button type="button" class="tlv-videos-topbar__menu" data-tlv-drawer-toggle aria-label="メニューを開く" aria-expanded="false" aria-controls="${esc(drawerId)}">
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
    const drawerId = String(options.drawerControlsId || "tlv-videos-drawer");

    if (useYoutube) {
      return `
        <header class="tlv-mobile-header tlv-mobile-header--videos tlv-mobile-header--videos-youtube">
          <div class="tlv-mobile-videos-toprow">
            <button type="button" class="tlv-videos-mobile-menu" data-tlv-drawer-toggle aria-label="メニューを開く" aria-expanded="false" aria-controls="${esc(drawerId)}">
              <span aria-hidden="true">☰</span>
            </button>
            ${renderVideosBrandHtml(true)}
            <div class="tlv-mobile-videos-toprow__actions">
              ${renderCreateMenuHtml({ uploadHref, compact: true })}
              ${renderNotificationsMenuHtml({ compact: true })}
              ${renderAccountMenuHtml({ compact: true })}
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
        <button type="button" class="tlv-videos-mobile-menu" data-tlv-drawer-toggle aria-label="メニューを開く" aria-expanded="false" aria-controls="${esc(drawerId)}"><span aria-hidden="true">☰</span></button>
        ${back}
        <div class="tlv-mobile-header__text">
          <h1 class="tlv-mobile-header__title">${esc(title)}</h1>
          ${sub}
        </div>
        ${upload}
      </header>`;
  }

  function liveCfg() {
    return global.TasuLiveConfig;
  }

  function isAuthenticatedTalkUser() {
    const dev = global.TasuTlvDevAuth;
    if (dev?.isAuthenticatedForTlv) return dev.isAuthenticatedForTlv();
    const auth = global.TasuAuthCurrentUser?.getCurrentUser?.();
    return Boolean(auth?.authenticated && auth?.talkUserId);
  }

  async function ensureSupabaseSessionSafe() {
    const cfg = liveCfg();
    if (!cfg?.ensureSupabaseSession) return null;
    try {
      return await Promise.race([
        cfg.ensureSupabaseSession(),
        new Promise((_, reject) => {
          global.setTimeout(() => reject(new Error("session timeout")), 8000);
        }),
      ]);
    } catch (err) {
      console.warn("[TasuTlvVideosSidebar] session skipped:", err.message || err);
      return null;
    }
  }

  async function fetchFollowingCreatorIds() {
    const cfg = liveCfg();
    if (!cfg || !isAuthenticatedTalkUser()) return [];
    const userId = global.TasuAuthCurrentUser?.getCurrentUser?.()?.talkUserId;
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
        console.warn("[TasuTlvVideosSidebar] follows fetch skipped:", error.message || error);
        return [];
      }
      return (data || []).map((r) => r.creator_id).filter(Boolean);
    } catch (err) {
      console.warn("[TasuTlvVideosSidebar] follows fetch skipped:", err.message || err);
      return [];
    }
  }

  async function fetchLiveCreatorIds(creatorIds) {
    const cfg = liveCfg();
    if (!cfg || !creatorIds.length) return new Set();
    try {
      const client = cfg.getClient();
      if (!client) return new Set();
      const { data, error } = await client
        .from(cfg.TABLES.broadcasts)
        .select("creator_id")
        .eq("status", "live")
        .in("creator_id", creatorIds.slice(0, 50));
      if (error) {
        console.warn("[TasuTlvVideosSidebar] live creators fetch skipped:", error.message || error);
        return new Set();
      }
      return new Set((data || []).map((r) => r.creator_id).filter(Boolean));
    } catch (err) {
      console.warn("[TasuTlvVideosSidebar] live creators fetch skipped:", err.message || err);
      return new Set();
    }
  }

  async function fetchSubscriptionsFlyoutData() {
    if (!isAuthenticatedTalkUser()) {
      return { state: "login", creators: [] };
    }
    const creatorIds = await fetchFollowingCreatorIds();
    if (!creatorIds.length) {
      return { state: "empty", creators: [] };
    }
    const cfg = liveCfg();
    const liveIds = await fetchLiveCreatorIds(creatorIds);
    const creators = creatorIds.slice(0, 12).map((id) => {
      const name = cfg?.resolveDisplayName?.(id) || id;
      const avatar = cfg?.resolveAvatarUrl?.(id) || "";
      const profileHref = cfg?.profileUrl?.(id) || `profile.html?user=${encodeURIComponent(id)}`;
      const initial = encodeURIComponent(String(name).slice(0, 2) || "LV");
      return {
        id,
        name,
        avatar,
        profileHref,
        isLive: liveIds.has(id),
        initial,
      };
    });
    return { state: "ok", creators, total: creatorIds.length };
  }

  function renderFlyoutLiveIcon() {
    return `<span class="tlv-videos-mini-flyout__live" aria-label="ライブ配信中"><span class="tlv-videos-mini-flyout__live-waves" aria-hidden="true"></span></span>`;
  }

  function renderSubscriptionsListBody(data, options = {}) {
    const listClass = options.listClass || "tlv-videos-mini-flyout__list";
    const rowClass = options.rowClass || "tlv-videos-mini-flyout__row tlv-videos-mini-flyout__row--creator";
    const emptyClass = options.emptyClass || "tlv-videos-mini-flyout__empty";
    const moreClass = options.moreClass || "tlv-videos-mini-flyout__more";

    if (data.state === "login") {
      return `<p class="${emptyClass}">ログインすると登録チャンネルを表示できます</p>`;
    }
    if (data.state === "empty") {
      return `<p class="${emptyClass}">登録チャンネルはまだありません</p>`;
    }
    if (data.state === "loading") {
      return `<p class="${emptyClass}">読み込み中…</p>`;
    }
    const rows = (data.creators || [])
      .map((creator) => {
        const liveHtml = creator.isLive ? renderFlyoutLiveIcon() : "";
        return `
          <a class="${rowClass}" href="${esc(creator.profileHref)}">
            <img class="tlv-videos-mini-flyout__avatar" src="${esc(creator.avatar)}" alt="" width="36" height="36" loading="lazy"
              onerror="this.src='https://placehold.co/36x36/1a1030/e879f9?text=${esc(creator.initial)}'" />
            <span class="tlv-videos-mini-flyout__label">${esc(creator.name)}</span>
            ${liveHtml}
          </a>`;
      })
      .join("");
    const moreHref = MINI_FLYOUT_PANELS.subscriptions.moreHref;
    const more =
      data.total > 0
        ? `<a class="${moreClass}" href="${esc(moreHref)}"><span>もっと見る</span><span class="tlv-videos-mini-flyout__more-icon" aria-hidden="true">⌄</span></a>`
        : "";
    return `<div class="${listClass}">${rows}</div>${more}`;
  }

  function renderSubscriptionsFlyoutBody(data) {
    return renderSubscriptionsListBody(data);
  }

  function resolveMypageItemHref(item) {
    return resolveDrawerItemHref(item);
  }

  function renderMypageNavListHtml(items, options = {}) {
    const activeId = options.activeId ?? getSidebarActiveId();
    const rowClass = options.rowClass || "tlv-mypage-nav__row";
    const activeRowClass = options.activeRowClass || "tlv-mypage-nav__row--active";
    const iconClass = options.iconClass || "tlv-mypage-nav__icon";
    const labelClass = options.labelClass || "tlv-mypage-nav__label";
    const list = Array.isArray(items) ? items : MYPAGE_ITEMS;

    return list
      .map((item) => {
        const href = resolveMypageItemHref(item);
        const active = isMypageItemActive(item.id, activeId) ? ` ${activeRowClass}` : "";
        return `
        <a class="${rowClass}${active}" href="${esc(href)}">
          <span class="${iconClass} tlv-mypage-icon">${renderMypageIcon(item.iconKey)}</span>
          <span class="${labelClass}">${esc(item.label)}</span>
        </a>`;
      })
      .join("");
  }

  function renderMypageNavPanelHtml(activeId = "") {
    const rows = renderMypageNavListHtml(MYPAGE_ITEMS, { activeId: activeId || getSidebarActiveId() });
    return `
      <nav class="tlv-mypage-nav" aria-label="マイページ">
        <div class="tlv-mypage-nav__list">${rows}</div>
      </nav>`;
  }

  async function hydrateDrawerSubscriptions() {
    const mounts = global.document.querySelectorAll("[data-tlv-drawer-subscriptions]");
    if (!mounts.length) return;
    mounts.forEach((mount) => {
      mount.innerHTML = `<p class="tlv-videos-drawer__subscriptions-placeholder">読み込み中…</p>`;
    });
    try {
      const data = await fetchSubscriptionsFlyoutData();
      const html = renderSubscriptionsListBody(data, {
        listClass: "tlv-videos-drawer__subscriptions-list",
        rowClass: "tlv-videos-drawer__creator-row",
        emptyClass: "tlv-videos-drawer__subscriptions-empty",
        moreClass: "tlv-videos-drawer__subscriptions-more",
      });
      mounts.forEach((mount) => {
        mount.innerHTML = html;
      });
    } catch (err) {
      console.warn("[TasuTlvVideosSidebar] drawer subscriptions skipped:", err.message || err);
      mounts.forEach((mount) => {
        mount.innerHTML = `<p class="tlv-videos-drawer__subscriptions-empty">登録チャンネルはありません</p>`;
      });
    }
  }

  function initDrawerSubscriptions() {
    hydrateDrawerSubscriptions();
  }

  function renderMypageFlyoutBody() {
    const cfg = liveCfg();
    const profileData = canShowMypageSidebarProfile()
      ? buildMypageSidebarProfileData(cfg?.getTalkUserId?.())
      : null;
    const profileHtml = profileData
      ? renderMypageSidebarProfileHtml(profileData, { variant: "flyout" })
      : "";
    const rows = renderMypageNavListHtml(MYPAGE_FLYOUT_ITEMS, {
      rowClass: "tlv-videos-mini-flyout__row",
      activeRowClass: "tlv-videos-mini-flyout__row--active",
      iconClass: "tlv-videos-mini-flyout__icon",
      labelClass: "tlv-videos-mini-flyout__label",
      activeId: getSidebarActiveId(),
    });
    return `${profileHtml}<div class="tlv-videos-mini-flyout__list">${rows}</div>`;
  }

  function renderMiniFlyoutShell(panelId, bodyHtml) {
    const meta = MINI_FLYOUT_PANELS[panelId];
    if (!meta) return "";
    return `
      <div class="tlv-videos-mini-flyout__panel" data-tlv-mini-flyout-panel="${esc(panelId)}">
        <h2 class="tlv-videos-mini-flyout__title">${esc(meta.title)}</h2>
        <div class="tlv-videos-mini-flyout__body">${bodyHtml}</div>
      </div>`;
  }

  function positionMiniFlyout(flyout, trigger, panelId = "") {
    if (!flyout || !trigger) return;
    const rect = trigger.getBoundingClientRect();
    const isMypage = panelId === "mypage";
    const minHeight = isMypage ? 420 : 220;
    const maxCap = isMypage ? 580 : 520;
    const maxHeight = Math.min(maxCap, Math.max(minHeight, global.innerHeight - 24));
    let top = rect.top - 8;
    if (top + maxHeight > global.innerHeight - 12) {
      top = Math.max(12, global.innerHeight - maxHeight - 12);
    }
    flyout.style.top = `${Math.round(top)}px`;
    flyout.style.left = `${Math.round(rect.right + 6)}px`;
    flyout.style.maxHeight = `${maxHeight}px`;
    if (panelId) {
      flyout.dataset.flyoutPanel = panelId;
    } else {
      delete flyout.dataset.flyoutPanel;
    }
  }

  function initMiniFlyouts() {
    const flyout = ensureMiniFlyoutPortal();
    const backdrop = ensureMiniFlyoutBackdrop();
    const mqDesktop = global.matchMedia(MINI_FLYOUT_DESKTOP_MQ);

    if (global.document.body.dataset.tlvMiniFlyoutBound === "1") {
      return;
    }
    global.document.body.dataset.tlvMiniFlyoutBound = "1";

    let openPanelId = null;
    let openTrigger = null;
    let hoverCloseTimer = null;
    let subscriptionsCache = null;
    let subscriptionsLoading = false;

    function isFlyoutTrigger(el) {
      return el?.matches?.("[data-tlv-mini-flyout]") && el.closest("[data-tlv-videos-sidebar-rail]");
    }

    function isDesktopFlyoutEnabled() {
      return mqDesktop.matches && !global.document.body.classList.contains("tlv-videos-sidebar-expanded");
    }

    function allFlyoutTriggers() {
      return global.document.querySelectorAll("[data-tlv-videos-sidebar-rail] [data-tlv-mini-flyout]");
    }

    function setTriggerExpanded(trigger, expanded) {
      allFlyoutTriggers().forEach((el) => {
        el.classList.toggle("is-flyout-open", expanded && el === trigger);
        el.setAttribute("aria-expanded", expanded && el === trigger ? "true" : "false");
      });
    }

    function closeFlyout() {
      openPanelId = null;
      openTrigger = null;
      flyout.hidden = true;
      flyout.setAttribute("aria-hidden", "true");
      flyout.innerHTML = "";
      backdrop.hidden = true;
      global.document.body.classList.remove("tlv-videos-mini-flyout-open");
      setTriggerExpanded(null, false);
    }

    async function loadSubscriptionsBody() {
      if (subscriptionsCache) return subscriptionsCache;
      if (subscriptionsLoading) {
        return { state: "loading", creators: [] };
      }
      subscriptionsLoading = true;
      try {
        subscriptionsCache = await fetchSubscriptionsFlyoutData();
        return subscriptionsCache;
      } finally {
        subscriptionsLoading = false;
      }
    }

    async function renderFlyout(panelId) {
      let bodyHtml = "";
      if (panelId === "subscriptions") {
        bodyHtml = `<p class="tlv-videos-mini-flyout__loading">読み込み中…</p>`;
        flyout.innerHTML = renderMiniFlyoutShell(panelId, bodyHtml);
        const data = await loadSubscriptionsBody();
        bodyHtml = renderSubscriptionsFlyoutBody(data);
      } else if (panelId === "mypage") {
        bodyHtml = renderMypageFlyoutBody();
      } else {
        return;
      }
      if (openPanelId !== panelId) return;
      flyout.innerHTML = renderMiniFlyoutShell(panelId, bodyHtml);
    }

    async function openFlyout(panelId, trigger) {
      if (!isDesktopFlyoutEnabled()) return;
      if (openPanelId === panelId && openTrigger === trigger && !flyout.hidden) return;
      openPanelId = panelId;
      openTrigger = trigger;
      if (panelId === "subscriptions") subscriptionsCache = null;
      flyout.hidden = false;
      flyout.setAttribute("aria-hidden", "false");
      backdrop.hidden = false;
      global.document.body.classList.add("tlv-videos-mini-flyout-open");
      setTriggerExpanded(trigger, true);
      positionMiniFlyout(flyout, trigger, panelId);
      await renderFlyout(panelId);
      if (openPanelId === panelId && openTrigger === trigger) {
        positionMiniFlyout(flyout, trigger, panelId);
      }
      if (panelId === "mypage") {
        hydrateMypageSidebarProfiles();
      }
    }

    function scheduleHoverClose() {
      global.clearTimeout(hoverCloseTimer);
      hoverCloseTimer = global.setTimeout(() => {
        closeFlyout();
      }, 220);
    }

    function cancelHoverClose() {
      global.clearTimeout(hoverCloseTimer);
    }

    global.document.addEventListener(
      "mouseover",
      (e) => {
        if (!isDesktopFlyoutEnabled()) return;
        const trigger = e.target.closest("[data-tlv-mini-flyout]");
        if (trigger && trigger.closest("[data-tlv-videos-sidebar-rail]")) {
          cancelHoverClose();
          const panelId = trigger.getAttribute("data-tlv-mini-flyout");
          if (panelId) openFlyout(panelId, trigger);
          return;
        }
        if (flyout.contains(e.target)) {
          cancelHoverClose();
        }
      },
      true,
    );

    global.document.addEventListener(
      "mouseout",
      (e) => {
        if (!openPanelId || flyout.hidden) return;
        const to = e.relatedTarget;
        if (openTrigger?.contains(to) || flyout.contains(to)) return;
        if (isFlyoutTrigger(e.target) || flyout.contains(e.target)) {
          scheduleHoverClose();
        }
      },
      true,
    );

    global.document.addEventListener(
      "click",
      (e) => {
        const trigger = e.target.closest("[data-tlv-mini-flyout]");
        if (trigger && trigger.closest("[data-tlv-videos-sidebar-rail]")) {
          if (isDesktopFlyoutEnabled()) {
            e.preventDefault();
            e.stopPropagation();
            cancelHoverClose();
            const panelId = trigger.getAttribute("data-tlv-mini-flyout");
            if (openPanelId === panelId && openTrigger === trigger && !flyout.hidden) {
              closeFlyout();
              return;
            }
            openFlyout(panelId, trigger);
            return;
          }
          const href = trigger.getAttribute("data-tlv-flyout-href");
          if (href) global.location.href = href;
          return;
        }
        if (!openPanelId || flyout.hidden) return;
        if (flyout.contains(e.target) || openTrigger?.contains(e.target)) return;
        closeFlyout();
      },
      true,
    );

    backdrop.addEventListener("click", closeFlyout);

    global.document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && openPanelId) closeFlyout();
    });

    mqDesktop.addEventListener("change", () => {
      if (!isDesktopFlyoutEnabled()) closeFlyout();
    });

    global.addEventListener("resize", () => {
      if (!openPanelId || flyout.hidden || !openTrigger) return;
      if (!isDesktopFlyoutEnabled()) {
        closeFlyout();
        return;
      }
      positionMiniFlyout(flyout, openTrigger);
    });

    global.addEventListener(
      "scroll",
      () => {
        if (!openPanelId || flyout.hidden || !openTrigger) return;
        positionMiniFlyout(flyout, openTrigger);
      },
      true,
    );

    closeMiniFlyoutFn = closeFlyout;
  }

  function initWatchOverlayDrawer() {
    const drawer = global.document.querySelector("[data-tlv-watch-drawer]");
    const backdrop = global.document.querySelector("[data-tlv-watch-drawer-backdrop]");
    if (!drawer || !backdrop || drawer.dataset.tlvWatchDrawerBound === "true") return;
    drawer.dataset.tlvWatchDrawerBound = "true";

    let menuOpen = false;
    const toggles = global.document.querySelectorAll("[data-tlv-drawer-toggle]");

    function isWatchDrawerToggle(btn) {
      const controls = btn.getAttribute("aria-controls") || "tlv-watch-drawer";
      return controls === "tlv-watch-drawer";
    }

    function setOpen(open) {
      menuOpen = open;
      closeMiniFlyout();
      closeCreateMenu();
      closeNotificationsMenu();
      closeAccountMenu();
      global.document.body.classList.toggle("tlv-drawer-open", open);
      drawer.classList.toggle("is-open", open);
      drawer.setAttribute("aria-hidden", open ? "false" : "true");
      backdrop.hidden = !open;
      toggles.forEach((btn) => {
        if (!isWatchDrawerToggle(btn)) return;
        btn.setAttribute("aria-expanded", open ? "true" : "false");
        btn.setAttribute("aria-label", open ? "メニューを閉じる" : "メニューを開く");
      });
      if (open) {
        drawer.querySelector(".tlv-videos-drawer__menu-btn")?.focus?.();
      }
    }

    function toggle() {
      setOpen(!menuOpen);
    }

    toggles.forEach((btn) => {
      if (!isWatchDrawerToggle(btn)) return;
      btn.addEventListener("click", toggle);
    });
    backdrop.addEventListener("click", () => setOpen(false));
    global.document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && menuOpen) setOpen(false);
    });
  }

  function initVideosDrawer() {
    const desktopDrawer = global.document.querySelector("[data-tlv-videos-drawer-desktop]");
    const mobileDrawer = global.document.querySelector("[data-tlv-videos-drawer-mobile]");
    const backdrop = global.document.querySelector("[data-tlv-videos-drawer-backdrop]");
    if (!desktopDrawer && !mobileDrawer) return;

    const toggles = global.document.querySelectorAll("[data-tlv-drawer-toggle]");
    const mqMobile = global.matchMedia("(max-width: 1023px)");
    const defaultExpanded =
      global.document.body.classList.contains("tlv-videos-sidebar-expanded") ||
      global.document.body.dataset.tlvDefaultSidebarExpanded === "true";
    let menuOpen = defaultExpanded;

    function setOpen(open) {
      menuOpen = open;
      const mobile = mqMobile.matches;
      if (open) {
        closeMiniFlyout();
        hydrateDrawerSubscriptions();
        hydrateMypageSidebarProfiles();
      }
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

    if (defaultExpanded) {
      setOpen(!mqMobile.matches);
    }
  }

  function syncYoutubeDesktopShellLayout(useYoutube) {
    const shell = global.document.querySelector("[data-tlv-desktop-shell]");
    const topbarMount = global.document.querySelector("[data-tlv-desktop-topbar-mount]");
    if (!shell || !topbarMount) return;

    if (useYoutube) {
      shell.classList.add("tlv-desktop-shell--youtube");
      if (topbarMount.parentElement !== shell) {
        shell.insertBefore(topbarMount, shell.firstChild);
      }
    } else {
      shell.classList.remove("tlv-desktop-shell--youtube");
      const main = shell.querySelector(".tlv-desktop-main");
      if (main && topbarMount.parentElement === shell) {
        main.insertBefore(topbarMount, main.firstChild);
      }
    }
  }

  function mountVideosPageChrome(config = {}) {
    const params = new URLSearchParams(global.location?.search || "");
    const activeId =
      config.activeId ||
      (params.get("feed") === "following" ? "subscriptions" : null) ||
      "videos";
    const sidebarMount = global.document.querySelector("[data-tlv-desktop-sidebar-mount]");
    const topbarMount = global.document.querySelector("[data-tlv-desktop-topbar-mount]");
    const headerMount = global.document.querySelector("[data-tlv-mobile-header-mount]");

    global.document.body.classList.add("tlv-videos-page-chrome");
    global.document.body.dataset.tlvSidebarActive = activeId;
    if (config.defaultSidebarExpanded) {
      global.document.body.dataset.tlvDefaultSidebarExpanded = "true";
      global.document.body.classList.add("tlv-videos-sidebar-expanded");
    }

    const useYoutubeHeader =
      config.headerLayout === "youtube" || (config.showSearch !== false && !config.topbarTitle);
    syncYoutubeDesktopShellLayout(useYoutubeHeader);

    if (sidebarMount) sidebarMount.innerHTML = renderVideosDesktopSidebarRail(activeId);

    const existingMobileDrawer = global.document.querySelector("[data-tlv-videos-drawer-mobile]");
    if (existingMobileDrawer) {
      existingMobileDrawer.outerHTML = renderVideosDrawerPanel(activeId, { variant: "mobile-overlay" });
    } else if (!global.document.querySelector("[data-tlv-videos-drawer-mobile]")) {
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
    initMiniFlyouts();
    initDrawerSubscriptions();
    initDrawerMypageProfile();
    initCreateMenu();
    initNotificationsMenu();
    initAccountMenu();
    global.TasuTlvTasfulAiEntry?.mountVideosChrome?.();
  }

  const api = {
    renderVideosCompactSidebar,
    renderVideosDrawerPanel,
    renderVideosDesktopSidebarRail,
    renderVideosMobileDrawer,
    renderVideosDesktopTopbar,
    renderVideosMobileHeader,
    renderCreateMenuHtml,
    renderNotificationsMenuHtml,
    renderAccountMenuHtml,
    renderWatchOverlayDrawer,
    renderWatchDrawerPanel,
    initWatchOverlayDrawer,
    initVideosDrawer,
    initMiniFlyouts,
    closeMiniFlyout,
    initCreateMenu,
    closeCreateMenu,
    initNotificationsMenu,
    closeNotificationsMenu,
    initAccountMenu,
    closeAccountMenu,
    syncYoutubeDesktopShellLayout,
    mountVideosPageChrome,
    VIDEOS_MINI_NAV,
    MAIN_NAV,
    MYPAGE_ITEMS,
    DRAWER_SECTIONS,
    MYPAGE_FLYOUT_ITEMS,
    renderMypageNavPanelHtml,
    renderMypageNavListHtml,
    renderMypageIcon,
    resolveMypageItemHref,
    getSidebarActiveId,
    initDrawerSubscriptions,
    initDrawerMypageProfile,
    hydrateMypageSidebarProfiles,
  };

  global.TasuTlvVideosSidebar = api;
  if (global.TasuTlvNav) {
    Object.assign(global.TasuTlvNav, api);
  }
})(typeof window !== "undefined" ? window : globalThis);
