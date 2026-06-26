/**
 * TASFUL TALK — 公式通知ルーム内カード（プラット / 安否 / 運営）
 */
(function (global) {
  "use strict";

  const OFFICIAL_PLATFORM = "official_platform";
  const OFFICIAL_ANPI = "official_anpi";
  const OFFICIAL_TASFUL = "official_tasful";

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function splitPrefixedTitle(raw) {
    const text = pickStr(raw);
    const m = text.match(/^(【[^】]+】)\s*(.*)$/);
    if (!m) return { prefix: "", eventTitle: text };
    return { prefix: m[1], eventTitle: pickStr(m[2]) || text };
  }

  function formatCardDateTime(iso) {
    try {
      const d = new Date(iso);
      if (!Number.isFinite(d.getTime())) return "";
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return `${y}/${m}/${day} ${hh}:${mm}`;
    } catch {
      return "";
    }
  }

  function resolveRoomKind(roomId) {
    const id = String(roomId || "").trim();
    if (id === OFFICIAL_ANPI) return "anpi";
    if (id === OFFICIAL_TASFUL) return "tasful";
    return "platform";
  }

  function resolvePlatformActionLabel(notification) {
    const n = notification || {};
    const title = pickStr(n.title);
    const supplement = pickStr(n.notifySupplementLine, n.body);
    const explicit = pickStr(n.actionLabel);
    if (explicit && explicit !== "確認する") return explicit;

    const resolver = global.TasuPlatformNotifyActionLabels?.resolvePlatformNotifyActionLabel;
    if (resolver) {
      const resolved = resolver(n);
      if (resolved && resolved !== "確認する") return resolved;
    }

    if (/応募がありました/.test(title)) return "応募者を確認する";
    if (/購入されました|が購入され|商品が購入/.test(title)) return "購入を確認する";
    if (/相談が届きました|相談\/依頼が届き|相談が届き/.test(title)) return "相談内容を見る";
    if (/完了報告|完了の申請|完了.*届き|完了報告が届き/.test(title)) return "完了報告を確認する";
    if (/新しいメッセージ|メッセージが届き/.test(title + supplement)) return "やりとりを開く";
    if (/やりとりを開始|チャットを開始|やり取りチャット/.test(title)) return "やりとりを開く";
    if (/レビュー|評価/.test(title)) return "評価を見る";
    if (/発送/.test(title)) return "配送状況を確認する";
    return "詳細を見る";
  }

  function resolveAnpiActionLabel(notification) {
    return "安否状況を見る";
  }

  function resolveTasfulActionLabel(notification) {
    const n = notification || {};
    const title = pickStr(n.title);
    const body = pickStr(n.body);
    const explicit = pickStr(n.actionLabel);
    if (explicit && explicit !== "確認する") return explicit;
    if (/サポート|返信|お問い合わせ/.test(title + body)) return "サポート返信を見る";
    if (/お知らせ|メンテナンス|規約|重要/.test(title + body)) return "お知らせを確認する";
    return "詳細を見る";
  }

  function resolveActionLabel(notification, roomId) {
    const kind = resolveRoomKind(roomId);
    if (kind === "anpi") return resolveAnpiActionLabel(notification);
    if (kind === "tasful") return resolveTasfulActionLabel(notification);
    return resolvePlatformActionLabel(notification);
  }

  function resolveMetaLine(notification, roomKind) {
    const supplement = pickStr(notification?.notifySupplementLine);
    if (!supplement) return "";
    if (/^(相手|応募者|購入者|依頼者|掲載者|利用者)[：:]/.test(supplement)) {
      return supplement.replace(/^相手[：:]/, "相手: ");
    }
    if (roomKind === "platform" && supplement && !/承認|支払|完了|お疲れ/.test(supplement)) {
      return supplement;
    }
    return "";
  }

  function excerptBody(text, maxLen) {
    const limit = Number(maxLen) > 0 ? Number(maxLen) : 100;
    const t = pickStr(text).replace(/\s+/g, " ");
    if (!t) return "";
    return t.length > limit ? `${t.slice(0, limit)}…` : t;
  }

  function lookupNotification(notificationId) {
    const id = pickStr(notificationId);
    if (!id) return null;
    return (
      global.TasuTalkNotifications?.findById?.(id) ||
      global.TasuTalkData?.findNotificationById?.(id) ||
      null
    );
  }

  function resolveCategoryTag(prefix) {
    const label = pickStr(prefix)
      .replace(/^【|】$/g, "")
      .replace(/[【】]/g, "");
    if (!label) return { label: "", tone: "" };
    const exact = {
      求人: "job",
      ワーカー: "worker",
      業務: "business",
      業務サービス: "business",
      店舗: "shop",
      店舗販売: "shop",
      安否: "anpi",
      商品: "product",
      スキル: "skill",
      Connect: "connect",
      運営: "tasful",
      Builder: "builder",
    };
    if (exact[label]) return { label, tone: exact[label] };
    if (/求人/.test(label)) return { label, tone: "job" };
    if (/ワーカー/.test(label)) return { label, tone: "worker" };
    if (/業務/.test(label)) return { label, tone: "business" };
    if (/店舗/.test(label)) return { label, tone: "shop" };
    if (/安否/.test(label)) return { label, tone: "anpi" };
    return { label, tone: "default" };
  }

  function isNotifyCardUnread(message, roomId) {
    const card = message?.notifyCard || {};
    const notification = lookupNotification(card.notificationId);
    const store = global.TasuTalkNotifications;
    if (notification && store?.isUnread) return store.isUnread(notification);
    if (notification?.readAt) return false;
    return global.TasuTalkOfficialRooms?.isOfficialMessageUnread?.(roomId, message) || false;
  }

  function enrichCardPayload(card, notification) {
    const next = { ...(card || {}) };
    const n = notification || lookupNotification(next.notificationId);
    if (!n) return next;
    if (!next.listingTitle) next.listingTitle = pickStr(n.notifyListingTitle);
    if (!next.metaLine) next.metaLine = resolveMetaLine(n, next.roomKind || "platform");
    if (!next.body) {
      next.body = resolveBodyLine(n, next.roomKind || "platform", next.eventTitle || next.title);
    }
    return next;
  }

  function resolveBodyLine(notification, roomKind, eventTitle) {
    const body = pickStr(notification?.body);
    const supplement = pickStr(notification?.notifySupplementLine);
    if (roomKind === "anpi") {
      if (body) return body;
      if (/安否確認/.test(eventTitle)) return "対象者の安否確認が必要です。";
      return "安否に関するお知らせです。";
    }
    if (roomKind === "tasful") {
      return excerptBody(body) || excerptBody(supplement) || "";
    }
    if (body && body !== eventTitle) return body;
    if (supplement && !resolveMetaLine(notification, roomKind)) return supplement;
    return "";
  }

  function resolveHref(notification) {
    const nav = global.TasuTalkNotifyActions?.buildNotifyNavigateAction?.(notification);
    if (nav?.href && nav.href !== "#") return nav.href;
    return pickStr(notification?.href, notification?.targetUrl, notification?.actionUrl, "#");
  }

  /**
   * @param {object} notification
   * @param {string} roomId
   */
  function buildPayload(notification, roomId) {
    const Rooms = global.TasuTalkOfficialRooms;
    const displayTitle = Rooms?.formatNotifyTitle?.(notification) || pickStr(notification?.title);
    const { prefix, eventTitle } = splitPrefixedTitle(displayTitle);
    const roomKind = resolveRoomKind(roomId);
    const listingTitle = pickStr(notification?.notifyListingTitle);
    const metaLine = resolveMetaLine(notification, roomKind);
    const bodyLine = resolveBodyLine(notification, roomKind, eventTitle);
    const createdAt = pickStr(notification?.notifyEventAt, notification?.createdAt);
    const dateTimeLabel = formatCardDateTime(createdAt);
    const href = resolveHref(notification);
    const actionLabel = resolveActionLabel(notification, roomId);

    return {
      notificationId: String(notification?.id || ""),
      roomKind,
      categoryPrefix: prefix,
      listingTitle,
      eventTitle: eventTitle || pickStr(notification?.title),
      body: bodyLine,
      metaLine,
      dateTimeLabel,
      createdAt,
      title: displayTitle,
      actionLabel,
      href,
      layout: "rich-v1",
    };
  }

  function renderHtml(message, options) {
    const escapeHtml = options?.escapeHtml || ((s) => String(s ?? ""));
    const roomId = pickStr(options?.roomId);
    const card = enrichCardPayload(message?.notifyCard || {});
    const hrefRaw = card.href || "#";
    const hrefResolved =
      global.TasuTalkNotifyActions?.appendFromTalkParam?.(hrefRaw) || hrefRaw;
    const href = escapeHtml(hrefResolved);
    const actionLabel = escapeHtml(card.actionLabel || "詳細を見る");
    const roomKind = card.roomKind || "platform";
    const isUnread = options?.isUnread ?? isNotifyCardUnread(message, roomId);
    const notification = lookupNotification(card.notificationId);
    const contentType =
      global.TasuTalkNotifyContentType?.resolveFromNotifyCard?.(
        { ...card, notificationId: card.notificationId || notification?.id },
        roomId
      ) ||
      global.TasuTalkNotifyContentType?.resolve?.(notification, roomId) ||
      resolveCategoryTag(card.categoryPrefix || "");
    const tagLabel = contentType?.label || "";
    const tagTone = contentType?.tone || "";
    const tagBlock = tagLabel
      ? `<span class="talk-line-room-notify-card__tag talk-line-room-notify-card__tag--${escapeHtml(tagTone || "default")}">${escapeHtml(tagLabel)}</span>`
      : "";
    const unreadDot = isUnread
      ? `<span class="talk-line-room-notify-card__unread-dot" aria-label="未読"></span>`
      : "";
    const listing = escapeHtml(card.listingTitle || "");
    const eventTitle = escapeHtml(card.eventTitle || card.title || message?.text || "");
    const body = escapeHtml(card.body || "");
    const meta = escapeHtml(card.metaLine || "");
    const dateTime = escapeHtml(card.dateTimeLabel || formatCardDateTime(card.createdAt || message?.createdAt));
    const notifId = escapeHtml(card.notificationId || "");

    const cta =
      card.href && card.href !== "#"
        ? `<a class="talk-line-room-notify-card__cta" href="${href}">${actionLabel}</a>`
        : `<span class="talk-line-room-notify-card__cta talk-line-room-notify-card__cta--muted">${actionLabel}</span>`;

    const unreadClass = isUnread ? " talk-line-room-notify-card--unread" : "";

    return `
      <article class="talk-line-room-notify-card talk-line-room-notify-card--${escapeHtml(roomKind)}${unreadClass}" aria-label="${eventTitle}"${notifId ? ` data-notification-id="${notifId}"` : ""}>
        ${unreadDot}
        ${tagBlock}
        ${listing ? `<p class="talk-line-room-notify-card__listing">${listing}</p>` : ""}
        <p class="talk-line-room-notify-card__event">${eventTitle}</p>
        ${body ? `<p class="talk-line-room-notify-card__body${roomKind === "tasful" ? " talk-line-room-notify-card__body--tasful-excerpt" : ""}">${body}</p>` : ""}
        ${meta ? `<p class="talk-line-room-notify-card__meta">${meta}</p>` : ""}
        ${dateTime ? `<time class="talk-line-room-notify-card__time" datetime="${escapeHtml(card.createdAt || message?.createdAt || "")}">日時: ${dateTime}</time>` : ""}
        ${cta}
      </article>`;
  }

  global.TasuTalkOfficialNotifyCard = {
    buildPayload,
    renderHtml,
    resolveActionLabel,
    formatCardDateTime,
    isNotifyCardUnread,
    resolveCategoryTag,
  };
})(typeof window !== "undefined" ? window : globalThis);
