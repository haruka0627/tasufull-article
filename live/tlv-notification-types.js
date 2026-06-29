/**
 * TLV — 通知型定義（フォロー通知を含む共通基盤）
 */
(function (global) {
  "use strict";

  const NOTIFICATION_TYPE = Object.freeze({
    follow: "follow",
    live: "live",
    live_started: "live_started",
    video_published: "video_published",
    video: "video",
    comment: "comment",
    reply: "reply",
    like: "like",
    monetization: "monetization",
    system: "system",
    admin: "admin",
  });

  const LIVE_EVENTS = Object.freeze({
    follow_created: "follow_created",
    comment_created: "comment_created",
    live_started: "live_started",
    video_published: "video_published",
    system: "system",
    broadcast_started: "broadcast_started",
    tip_created: "tip_created",
    like_changed: "like_changed",
  });

  const LIVE_SOURCE = "tasful_live";

  function buildLivePayload(extra) {
    return {
      service_type: "live",
      ...extra,
    };
  }

  function formatLiveBody(displayText, payload) {
    return `${displayText}\n${JSON.stringify(payload)}`;
  }

  function parseLiveBody(body) {
    const text = String(body || "");
    const nl = text.indexOf("\n");
    const displayText = nl >= 0 ? text.slice(0, nl).trim() : text.trim();
    let payload = {};
    if (nl >= 0) {
      try {
        payload = JSON.parse(text.slice(nl + 1));
      } catch {
        payload = {};
      }
    }
    return { displayText, payload };
  }

  function normalizeTlvHref(url) {
    const raw = String(url || "#").trim();
    if (!raw) return "#";
    if (raw.startsWith("live/")) return raw.slice(5);
    return raw;
  }

  function resolveKind(event, row, displayText) {
    const source = String(row?.source || "").toLowerCase();
    const title = String(row?.title || "").toLowerCase();
    const type = String(row?.type || "").toLowerCase();
    const ev = String(event || "").trim();

    if (ev === LIVE_EVENTS.follow_created) return NOTIFICATION_TYPE.follow;
    if (ev === LIVE_EVENTS.comment_created) return NOTIFICATION_TYPE.comment;
    if (ev === LIVE_EVENTS.live_started) return NOTIFICATION_TYPE.live_started;
    if (ev === LIVE_EVENTS.video_published) return NOTIFICATION_TYPE.video_published;
    if (ev === LIVE_EVENTS.system) return NOTIFICATION_TYPE.system;
    if (ev === LIVE_EVENTS.broadcast_started) return NOTIFICATION_TYPE.live_started;
    if (ev === LIVE_EVENTS.tip_created) return NOTIFICATION_TYPE.monetization;
    if (source.includes("reply")) return NOTIFICATION_TYPE.reply;
    if (source.includes("live") || source.includes("broadcast") || type === "live") return NOTIFICATION_TYPE.live;
    if (source.includes("video")) return NOTIFICATION_TYPE.video;
    if (source.includes("comment")) return NOTIFICATION_TYPE.comment;
    if (source.includes("follow") || title.includes("フォロー")) return NOTIFICATION_TYPE.follow;
    if (source.includes("like")) return NOTIFICATION_TYPE.like;
    if (source.includes("monet") || source.includes("review") || source.includes("revenue")) {
      return NOTIFICATION_TYPE.monetization;
    }
    if (source === "system" || type === "system") return NOTIFICATION_TYPE.system;
    if (source.includes("admin")) return NOTIFICATION_TYPE.admin;
    return NOTIFICATION_TYPE.admin;
  }

  function normalizeSystemPriority(priority) {
    const p = String(priority || "normal").trim().toLowerCase();
    if (p === "high" || p === "important" || p === "urgent") return "high";
    return "normal";
  }

  /**
   * DB / dev store row → UI item
   * @param {object} row
   * @param {object} cfg TasuLiveConfig
   */
  function rowToItem(row, cfg) {
    const body = String(row?.body || row?.message || "");
    const { displayText, payload } = parseLiveBody(body);
    const event = String(payload.event || "").trim();
    const actorId = String(
      payload.actor_id || row?.sender_user_id || row?.senderUserId || row?.actorId || "",
    ).trim();
    const actorName = String(
      payload.actor_name || (actorId ? cfg?.resolveDisplayName?.(actorId) : "") || actorId || "TASFUL LIVE",
    ).trim();
    const targetUserId = String(
      row?.user_id || row?.recipientUserId || row?.recipient_user_id || payload.target_user_id || "",
    ).trim();
    const kind = resolveKind(event, row, displayText);
    const readAt = row?.read_at || row?.readAt || null;
    const priority = normalizeSystemPriority(payload.priority || row?.priority);

    if (kind === NOTIFICATION_TYPE.system || event === LIVE_EVENTS.system) {
      const systemTitle = String(payload.title || row?.title || displayText || "お知らせ").trim();
      const systemBody = String(payload.body || displayText || "").trim();
      return {
        id: String(row?.id || ""),
        type: NOTIFICATION_TYPE.system,
        kind: NOTIFICATION_TYPE.system,
        actorId: String(payload.actor_id || payload.creator || "").trim(),
        actorName: String(payload.actor_name || payload.creator || "TLV運営").trim(),
        actorAvatar: "",
        targetUserId,
        title: systemTitle,
        systemTitle,
        systemBody,
        priority,
        href: normalizeTlvHref(row?.target_url || row?.href || row?.targetUrl || payload.target_url || "#"),
        thumb: row?.thumb || row?.thumbnail_url || "",
        createdAt: row?.created_at || row?.createdAt || new Date().toISOString(),
        read: Boolean(readAt),
        unread: !readAt,
        event: LIVE_EVENTS.system,
      };
    }

    return {
      id: String(row?.id || ""),
      type: kind,
      kind,
      actorId,
      actorName,
      actorAvatar:
        String(payload.actor_avatar || "").trim() ||
        (actorId && cfg?.resolveAvatarUrl ? cfg.resolveAvatarUrl(actorId) : "") ||
        "",
      targetUserId,
      title: displayText || String(row?.title || "").trim() || body.slice(0, 80) || "通知",
      href: normalizeTlvHref(row?.target_url || row?.href || row?.targetUrl),
      thumb: row?.thumb || row?.thumbnail_url || "",
      createdAt: row?.created_at || row?.createdAt || new Date().toISOString(),
      read: Boolean(readAt),
      unread: !readAt,
      event,
    };
  }

  function followDisplayText(actorName) {
    const name = String(actorName || "ユーザー").trim();
    return `${name}さんがあなたをフォローしました`;
  }

  function commentDisplayText(actorName) {
    const name = String(actorName || "ユーザー").trim();
    return `${name}さんがあなたの動画にコメントしました`;
  }

  function liveStartedDisplayText(actorName) {
    const name = String(actorName || "ユーザー").trim();
    return `${name}さんがライブ配信を開始しました`;
  }

  function liveStartedTargetUrl(liveId) {
    const raw = String(liveId || "").trim();
    if (!raw) return "#";
    const cfg = global.TasuLiveConfig;
    if (cfg?.watchUrl) return cfg.watchUrl(raw);
    return `watch.html?broadcast_id=${encodeURIComponent(raw)}`;
  }

  function videoPublishedDisplayText(actorName) {
    const name = String(actorName || "ユーザー").trim();
    return `${name}さんが新しい動画を公開しました`;
  }

  function videoPublishedTargetUrl(videoId) {
    const id = encodeURIComponent(String(videoId || "").trim());
    return id ? `watch-video.html?id=${id}` : "#";
  }

  function systemDisplayText(title, body) {
    const t = String(title || "").trim();
    const b = String(body || "").trim();
    if (t && b) return `${t}\n${b}`;
    return t || b || "お知らせ";
  }

  global.TasuTlvNotificationTypes = {
    NOTIFICATION_TYPE,
    LIVE_EVENTS,
    LIVE_SOURCE,
    buildLivePayload,
    formatLiveBody,
    parseLiveBody,
    normalizeTlvHref,
    rowToItem,
    followDisplayText,
    commentDisplayText,
    liveStartedDisplayText,
    liveStartedTargetUrl,
    videoPublishedDisplayText,
    videoPublishedTargetUrl,
    systemDisplayText,
    normalizeSystemPriority,
  };
})(typeof window !== "undefined" ? window : globalThis);
