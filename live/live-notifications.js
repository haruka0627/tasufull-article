/**
 * TASFUL LIVE — 通知一覧（YouTube 通知ページ風）
 */
(function (global) {
  "use strict";

  const C = () => global.TasuLiveConfig;

  const FILTERS = Object.freeze([
    { id: "all", label: "すべて" },
    { id: "comment", label: "コメント" },
    { id: "video", label: "動画" },
    { id: "live", label: "ライブ" },
    { id: "follow", label: "フォロー" },
    { id: "system", label: "システム" },
  ]);

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isLoggedIn() {
    const dev = global.TasuTlvDevAuth;
    if (dev?.isAuthenticatedForTlv) return dev.isAuthenticatedForTlv();
    const auth = global.TasuAuthCurrentUser?.getCurrentUser?.();
    return Boolean(auth?.authenticated && auth?.talkUserId);
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

  function formatRelativeTime(iso) {
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
    const actorName = actorId ? cfg?.resolveDisplayName?.(actorId) || actorId : "TASFUL LIVE";
    const title = String(row.title || row.videoTitle || "").trim();
    const body = String(row.body || row.message || "").trim();
    const source = String(row.source || row.type || "").toLowerCase();
    let kind = "admin";
    if (source.includes("reply")) kind = "reply";
    else if (source.includes("live") || source.includes("broadcast")) kind = "live";
    else if (source.includes("video")) kind = "video";
    else if (source.includes("comment")) kind = "comment";
    else if (source.includes("follow")) kind = "follow";
    else if (source.includes("like")) kind = "like";
    else if (source.includes("monet") || source.includes("review") || source.includes("revenue")) kind = "monetization";
    else if (source === "system" || source.includes("admin")) kind = "admin";
    return {
      id: String(row.id || ""),
      kind,
      actorId,
      actorName,
      title: title || body.slice(0, 80) || "通知",
      href: String(row.href || row.target_url || row.targetUrl || "#"),
      thumb: row.thumb || row.thumbnail_url || "",
      createdAt: row.created_at || row.createdAt || new Date().toISOString(),
      unread: !row.read_at && !row.readAt,
    };
  }

  function matchesFilter(item, filterId) {
    if (filterId === "all") return true;
    if (filterId === "comment") return item.kind === "comment" || item.kind === "reply";
    if (filterId === "video") return item.kind === "video" || item.kind === "video_published";
    if (filterId === "live") return item.kind === "live" || item.kind === "live_started";
    if (filterId === "follow") return item.kind === "follow";
    if (filterId === "system") {
      return ["admin", "system", "like", "monetization"].includes(item.kind);
    }
    return true;
  }

  function renderItemText(item) {
    const name = esc(item.actorName);
    switch (item.kind) {
      case "live":
      case "live_started":
        if (item.kind === "live_started" || item.event === "live_started") {
          return `<strong>${name}</strong> がライブ配信を開始しました`;
        }
        return `<strong>${name}</strong> がライブ配信を開始しました: ${esc(item.title)}`;
      case "video":
        return `<strong>${name}</strong> が新しい動画を投稿しました: ${esc(item.title)}`;
      case "video_published":
        return `<strong>${name}</strong> が新しい動画を公開しました`;
      case "comment":
        return `<strong>${name}</strong> があなたの動画にコメントしました`;
      case "reply":
        return `<strong>${name}</strong> があなたのコメントに返信しました`;
      case "follow":
        return `<strong>${name}</strong> があなたをフォローしました`;
      case "like":
        return `<strong>${name}</strong> があなたの動画に高く評価しました`;
      case "monetization":
        return `<strong>${name}</strong>: ${esc(item.title)}`;
      case "system":
        if (global.TasuTlvNotificationService?.renderItemText && item.kind === "system") {
          return global.TasuTlvNotificationService.renderItemText(item);
        }
        return `<strong>${esc(item.systemTitle || item.title || "お知らせ")}</strong>${item.systemBody ? `<br>${esc(item.systemBody)}` : ""}`;
      case "admin":
      default:
        return `<strong>${name}</strong>: ${esc(item.title)}`;
    }
  }

  async function fetchNotifications() {
    if (global.TasuTlvNotificationService?.listNotifications) {
      return global.TasuTlvNotificationService.listNotifications();
    }
    if (global.TasuLiveNotificationsData?.fetchNotificationItems) {
      return global.TasuLiveNotificationsData.fetchNotificationItems();
    }

    const cfg = C();
    const userId = cfg?.getTalkUserId?.() || "";
    let rows = [];

    if (global.TasuTalkNotifications?.getAll) {
      try {
        rows = (global.TasuTalkNotifications.getAll() || []).filter((row) => {
          if (row?.hiddenAt || row?.hidden_at) return false;
          const recipient = String(row.recipientUserId || row.recipient_user_id || row.user_id || "").trim();
          return !recipient || recipient === userId;
        });
      } catch (err) {
        console.warn("[TasuLiveNotifications] local notifications skipped:", err.message || err);
      }
    }

    if (!rows.length) {
      try {
        const raw = global.localStorage?.getItem("tasful_talk_notifications");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) rows = parsed;
        }
      } catch (err) {
        console.warn("[TasuLiveNotifications] cache skipped:", err.message || err);
      }
    }

    if (!rows.length && userId && cfg?.getClient) {
      try {
        const session = await cfg.ensureSupabaseSession?.();
        if (!session?.access_token) return rows;
        const client = cfg.getClient();
        const { data, error } = await client
          .from("talk_notifications")
          .select("id, title, body, target_url, created_at, read_at, type, source")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(50);
        if (!error && Array.isArray(data)) rows = data;
      } catch (err) {
        console.warn("[TasuLiveNotifications] fetch skipped:", err.message || err);
      }
    }

    return rows.map((row) => mapRawNotificationRow(row, cfg)).filter((item) => item.id);
  }

  function renderGuestHtml() {
    return `
      <div class="tlv-notifications-guest">
        <div class="tlv-notifications-guest__icon" aria-hidden="true">🔔</div>
        <p class="tlv-notifications-guest__title">ログインすると通知を確認できます</p>
        <div class="tlv-notifications-guest__actions">
          <a class="live-btn live-btn--primary" href="${esc(tlvLoginHref())}">ログイン</a>
          <a class="live-btn live-btn--ghost" href="${esc(tlvSignupHref())}">アカウント作成</a>
        </div>
      </div>`;
  }

  function renderFilterChips(activeId) {
    return FILTERS.map((filter) => {
      const active = filter.id === activeId ? " is-active" : "";
      return `<button type="button" class="tlv-notifications-filter${active}" role="tab" aria-selected="${filter.id === activeId ? "true" : "false"}" data-tlv-notifications-filter="${esc(filter.id)}">${esc(filter.label)}</button>`;
    }).join("");
  }

  function renderEmptyHtml() {
    return `
      <div class="tlv-notifications-empty">
        <div class="tlv-notifications-empty__icon" aria-hidden="true">🔔</div>
        <p class="tlv-notifications-empty__title">通知はまだありません</p>
        <p class="tlv-notifications-empty__text">コメント、ライブ配信、フォローなどの更新がここに表示されます</p>
      </div>`;
  }

  function renderItemRow(item, cfg) {
    const avatarUrl =
      item.actorAvatar ||
      (item.actorId && cfg?.resolveAvatarUrl
        ? cfg.resolveAvatarUrl(item.actorId)
        : "https://placehold.co/80x80/1a1030/e879f9?text=TLV");
    const thumbStyle = item.thumb ? ` style="background-image:url('${esc(item.thumb)}')"` : "";
    const unreadClass = item.unread ? " tlv-notifications-row--unread" : "";
    return `
      <li class="tlv-notifications-row${unreadClass}">
        <a class="tlv-notifications-row__link" href="${esc(item.href)}" data-tlv-notification-id="${esc(item.id)}">
          ${item.unread ? '<span class="tlv-notifications-row__dot" aria-hidden="true"></span>' : '<span class="tlv-notifications-row__dot tlv-notifications-row__dot--read" aria-hidden="true"></span>'}
          <img class="tlv-notifications-row__avatar" src="${esc(avatarUrl)}" width="40" height="40" alt="" loading="lazy" decoding="async" />
          <span class="tlv-notifications-row__body">
            <span class="tlv-notifications-row__text">${renderItemText(item)}</span>
            <time class="tlv-notifications-row__time" datetime="${esc(item.createdAt)}">${esc(formatRelativeTime(item.createdAt))}</time>
          </span>
          <span class="tlv-notifications-row__thumb"${thumbStyle} aria-hidden="true"></span>
        </a>
      </li>`;
  }

  function renderListHtml(items, filterId) {
    const cfg = C();
    const filtered = items.filter((item) => matchesFilter(item, filterId));
    if (!filtered.length) return renderEmptyHtml();
    return `<ul class="tlv-notifications-list">${filtered.map((item) => renderItemRow(item, cfg)).join("")}</ul>`;
  }

  function renderPageHtml(items, filterId) {
    return `
      <div class="tlv-notifications-page" data-tlv-notifications-page>
        <header class="tlv-notifications-page__head">
          <h1 class="tlv-notifications-page__title">通知</h1>
        </header>
        <div class="tlv-notifications-page__filters" role="tablist" aria-label="通知の種類">
          ${renderFilterChips(filterId)}
        </div>
        <div class="tlv-notifications-page__body" data-tlv-notifications-body>
          ${renderListHtml(items, filterId)}
        </div>
      </div>`;
  }

  function bindPage(roots, items) {
    let filterId = "all";

    async function handleNotificationOpen(e) {
      const link = e.target.closest("[data-tlv-notification-id]");
      if (!link) return;
      const id = link.getAttribute("data-tlv-notification-id") || "";
      const item = items.find((row) => row.id === id);
      if (!item) return;
      if (item.unread && global.TasuTlvNotificationService?.markAsRead) {
        e.preventDefault();
        await global.TasuTlvNotificationService.markAsRead(id);
        item.unread = false;
        item.read = true;
        roots.filter(Boolean).forEach((root) => {
          const body = root.querySelector("[data-tlv-notifications-body]");
          if (body) body.innerHTML = renderListHtml(items, filterId);
        });
        const href = link.getAttribute("href");
        if (href && href !== "#") global.location.href = href;
      }
    }

    roots.filter(Boolean).forEach((root) => {
      root.addEventListener("click", handleNotificationOpen);
      root.querySelectorAll("[data-tlv-notifications-filter]").forEach((btn) => {
        btn.addEventListener("click", () => {
          filterId = btn.getAttribute("data-tlv-notifications-filter") || "all";
          root.querySelectorAll("[data-tlv-notifications-filter]").forEach((chip) => {
            const active = chip.getAttribute("data-tlv-notifications-filter") === filterId;
            chip.classList.toggle("is-active", active);
            chip.setAttribute("aria-selected", active ? "true" : "false");
          });
          const body = root.querySelector("[data-tlv-notifications-body]");
          if (body) body.innerHTML = renderListHtml(items, filterId);
        });
      });
    });
  }

  function writeToRoots(roots, html) {
    roots.filter(Boolean).forEach((root) => {
      root.innerHTML = html;
    });
  }

  async function mountNotificationsPage(root, options = {}) {
    const roots = (options.roots || [root]).filter(Boolean);
    writeToRoots(roots, '<p class="live-loading">読み込み中…</p>');

    if (!isLoggedIn()) {
      writeToRoots(roots, renderGuestHtml());
      return;
    }

    const items = await fetchNotifications();
    const html = renderPageHtml(items, "all");
    writeToRoots(roots, html);
    bindPage(roots, items);
  }

  global.TasuLiveNotifications = {
    mountNotificationsPage,
    FILTERS,
  };

  // 旧プレースホルダー API 互換
  global.TasuLiveNotificationsPage = global.TasuLiveNotifications;
})(typeof window !== "undefined" ? window : globalThis);
