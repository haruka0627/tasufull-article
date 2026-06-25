/**
 * TLV — 通知サービス（作成・取得・既読）
 * 本番: talk_notifications + live-notify Edge（RLS 変更なし）
 * dev: localhost + talkDev=1 のみ localStorage fallback
 */
(function (global) {
  "use strict";

  const C = () => global.TasuLiveConfig;
  const T = () => global.TasuTlvNotificationTypes;

  function resolveViewerUserId() {
    const dev = global.TasuTlvDevAuth;
    if (dev?.getTlvViewerTalkUserId) {
      return String(dev.getTlvViewerTalkUserId() || "").trim();
    }
    return String(C()?.getTalkUserId?.() || "").trim();
  }

  function shouldUseDevFallback() {
    return Boolean(global.TasuTlvDevAuth?.shouldUseTlvNotifyLocalFallback?.());
  }

  function rowRecipientId(row) {
    return String(row?.user_id || row?.recipientUserId || row?.recipient_user_id || "").trim();
  }

  function mergeRows(into, rows, userId) {
    const uid = String(userId || "").trim();
    for (const row of rows || []) {
      if (!row || typeof row !== "object") continue;
      if (row.hiddenAt || row.hidden_at) continue;
      const recipient = rowRecipientId(row);
      if (recipient && uid && recipient !== uid) continue;
      const id = String(row.id || "").trim();
      if (!id) continue;
      into.set(id, row);
    }
  }

  async function fetchRows(userId) {
    const uid = String(userId || resolveViewerUserId() || "").trim();
    const byId = new Map();

    if (uid && global.TasuTlvDevAuth?.getDevNotificationsForUser) {
      mergeRows(byId, global.TasuTlvDevAuth.getDevNotificationsForUser(uid), uid);
    }

    if (global.TasuTalkNotifications?.getAll) {
      try {
        mergeRows(byId, global.TasuTalkNotifications.getAll(), uid);
      } catch (err) {
        console.warn("[TasuTlvNotificationService] TasuTalkNotifications skipped:", err.message || err);
      }
    }

    try {
      const raw = global.localStorage?.getItem("tasful_talk_notifications");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) mergeRows(byId, parsed, uid);
      }
    } catch (err) {
      console.warn("[TasuTlvNotificationService] cache skipped:", err.message || err);
    }

    const cfg = C();
    if (uid && cfg?.getClient && !shouldUseDevFallback()) {
      try {
        const session = await cfg.ensureSupabaseSession?.();
        if (session?.access_token) {
          const { data, error } = await cfg.getClient()
            .from("talk_notifications")
            .select("id, title, body, target_url, created_at, read_at, type, source")
            .eq("user_id", uid)
            .order("created_at", { ascending: false })
            .limit(50);
          if (!error && Array.isArray(data)) mergeRows(byId, data, uid);
        }
      } catch (err) {
        console.warn("[TasuTlvNotificationService] supabase skipped:", err.message || err);
      }
    }

    return [...byId.values()].sort(
      (a, b) => new Date(b.created_at || b.createdAt || 0) - new Date(a.created_at || a.createdAt || 0),
    );
  }

  async function listNotifications(userId) {
    const cfg = C();
    const types = T();
    const rows = await fetchRows(userId);
    const mapFn = types?.rowToItem || global.TasuLiveNotificationsData?.mapRawNotificationRow;
    if (!mapFn) return [];
    return rows.map((row) => mapFn(row, cfg)).filter((item) => item.id);
  }

  /**
   * フォロー通知を作成（Edge または dev fallback）
   * @param {{ actorId: string, actorName?: string, actorAvatar?: string, targetUserId: string }} opts
   */
  async function createFollowNotification(opts) {
    const actorId = String(opts?.actorId || "").trim();
    const targetUserId = String(opts?.targetUserId || opts?.creatorId || "").trim();
    const actorName = String(opts?.actorName || actorId).trim();
    const actorAvatar = String(opts?.actorAvatar || "").trim();

    if (!actorId || !targetUserId) {
      return { ok: false, reason: "missing_ids" };
    }

    if (global.TasuLiveNotify?.notifyCreatorOnFollow) {
      return global.TasuLiveNotify.notifyCreatorOnFollow({
        creatorId: targetUserId,
        followerId: actorId,
        followerName: actorName,
        followerAvatar: actorAvatar,
      });
    }

    if (shouldUseDevFallback() && global.TasuTlvDevAuth?.appendDevFollowNotification) {
      const id = global.TasuTlvDevAuth.appendDevFollowNotification({
        creatorId: targetUserId,
        followerId: actorId,
        followerName: actorName,
        followerAvatar: actorAvatar,
      });
      return { ok: true, dev_local: true, id };
    }

    return { ok: false, reason: "notify_unavailable" };
  }

  /**
   * 動画コメント通知を作成（Edge または dev fallback）
   */
  async function createCommentNotification(opts) {
    const videoId = String(opts?.videoId || "").trim();
    const commentId = String(opts?.commentId || "").trim();
    const creatorId = String(opts?.creatorId || opts?.targetId || "").trim();
    const actorId = String(opts?.actorId || opts?.commenterId || "").trim();
    const actorName = String(opts?.actorName || actorId).trim();

    if (!videoId || !commentId || !creatorId || !actorId) {
      return { ok: false, reason: "missing_ids" };
    }
    if (actorId === creatorId) {
      return { ok: true, skipped: true, reason: "self_comment" };
    }

    if (global.TasuLiveNotify?.notifyCreatorOnComment) {
      return global.TasuLiveNotify.notifyCreatorOnComment({
        videoId,
        commentId,
        creatorId,
        actorId,
        actorName,
      });
    }

    if (shouldUseDevFallback() && global.TasuTlvDevAuth?.appendDevCommentNotification) {
      const id = global.TasuTlvDevAuth.appendDevCommentNotification({
        videoId,
        commentId,
        creatorId,
        actorId,
        actorName,
      });
      return { ok: Boolean(id), dev_local: true, id };
    }

    return { ok: false, reason: "notify_unavailable" };
  }

  /**
   * ライブ開始通知をフォロワーへ fanout（Edge または dev fallback）
   * @param {{ broadcastId: string, creatorId: string, creatorName?: string, creatorAvatar?: string }} opts
   */
  async function createLiveStartedNotification(opts) {
    const broadcastId = String(opts?.broadcastId || opts?.liveId || "").trim();
    const creatorId = String(opts?.creatorId || "").trim();
    const creatorName = String(opts?.creatorName || creatorId).trim();

    if (!creatorId || !broadcastId) {
      return { ok: false, reason: "missing_ids" };
    }

    if (global.TasuLiveNotify?.notifyFollowersOnLiveStarted) {
      try {
        return await global.TasuLiveNotify.notifyFollowersOnLiveStarted({
          liveId: broadcastId,
          broadcastId,
          creatorId,
          creatorName,
        });
      } catch (err) {
        console.warn("[TasuTlvNotificationService] live_started notify failed:", err.message || err);
        return { ok: false, reason: "notify_error" };
      }
    }

    if (shouldUseDevFallback() && global.TasuTlvDevAuth?.appendDevLiveStartedNotifications) {
      return global.TasuTlvDevAuth.appendDevLiveStartedNotifications({
        broadcastId,
        creatorId,
        creatorName,
        creatorAvatar: opts?.creatorAvatar,
      });
    }

    return { ok: false, reason: "notify_unavailable" };
  }

  /**
   * 動画公開通知をフォロワーへ fanout（Edge または dev fallback）
   * @param {{ videoId: string, creatorId: string, creatorName?: string, title?: string }} opts
   */
  async function createVideoPublishedNotification(opts) {
    const videoId = String(opts?.videoId || "").trim();
    const creatorId = String(opts?.creatorId || "").trim();
    if (!videoId) return { ok: false, reason: "missing_video_id" };

    const creatorName = String(opts?.creatorName || creatorId).trim();

    if (!creatorId || !videoId) {
      return { ok: false, reason: "missing_ids" };
    }

    if (global.TasuLiveNotify?.notifyVideoPublished) {
      try {
        return await global.TasuLiveNotify.notifyVideoPublished({
          videoId,
          creatorId,
          creatorName,
          title: opts?.title,
        });
      } catch (err) {
        console.warn("[TasuTlvNotificationService] video_published notify failed:", err.message || err);
        return { ok: false, reason: "notify_error" };
      }
    }

    if (shouldUseDevFallback() && global.TasuTlvDevAuth?.appendDevVideoPublishedNotifications) {
      return global.TasuTlvDevAuth.appendDevVideoPublishedNotifications({
        videoId,
        creatorId,
        creatorName,
        creatorAvatar: opts?.creatorAvatar,
      });
    }

    return { ok: false, reason: "notify_unavailable" };
  }

  /**
   * システム通知（運営 → 指定ユーザー）
   * @param {{ targetUserId: string, title: string, body?: string, targetUrl?: string, priority?: string, creator?: string }} opts
   */
  async function createSystemNotification(opts) {
    const targetUserId = String(opts?.targetUserId || opts?.targetId || "").trim();
    const title = String(opts?.title || "").trim();
    const body = String(opts?.body || "").trim();

    if (!targetUserId || !title) {
      return { ok: false, reason: "missing_fields" };
    }

    if (global.TasuLiveNotify?.notifySystem) {
      try {
        return await global.TasuLiveNotify.notifySystem({
          targetUserId,
          title,
          body,
          targetUrl: opts?.targetUrl,
          priority: opts?.priority,
          creator: opts?.creator,
        });
      } catch (err) {
        console.warn("[TasuTlvNotificationService] system notify failed:", err.message || err);
        return { ok: false, reason: "notify_error" };
      }
    }

    if (shouldUseDevFallback() && global.TasuTlvDevAuth?.appendDevSystemNotification) {
      return global.TasuTlvDevAuth.appendDevSystemNotification({
        targetUserId,
        title,
        body,
        targetUrl: opts?.targetUrl,
        priority: opts?.priority,
        creator: opts?.creator,
      });
    }

    return { ok: false, reason: "notify_unavailable" };
  }

  async function markAsRead(notificationId, userId) {
    const id = String(notificationId || "").trim();
    const uid = String(userId || resolveViewerUserId() || "").trim();
    if (!id || !uid) return { ok: false, reason: "missing_id" };

    if (shouldUseDevFallback() && global.TasuTlvDevAuth?.markDevNotificationRead) {
      return { ok: global.TasuTlvDevAuth.markDevNotificationRead(id, uid) };
    }

    const cfg = C();
    const client = cfg?.getClient?.();
    if (!client) return { ok: false, reason: "no_client" };

    try {
      await cfg.ensureSupabaseSession?.();
      const readAt = new Date().toISOString();
      const { error } = await client
        .from("talk_notifications")
        .update({ read_at: readAt })
        .eq("id", id)
        .eq("user_id", uid);
      if (error) throw error;
      return { ok: true, read_at: readAt };
    } catch (err) {
      console.warn("[TasuTlvNotificationService] markAsRead failed:", err.message || err);
      return { ok: false, reason: "update_failed" };
    }
  }

  function renderItemText(item) {
    const esc = (s) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    const name = esc(item.actorName);
    const kind = item.kind || item.type;
    if (kind === "follow") {
      return `<strong>${name}</strong> があなたをフォローしました`;
    }
    if (kind === "comment") {
      return `<strong>${name}</strong> があなたの動画にコメントしました`;
    }
    if (kind === "live_started") {
      return `<strong>${name}</strong> がライブ配信を開始しました`;
    }
    if (kind === "video_published") {
      return `<strong>${name}</strong> が新しい動画を公開しました`;
    }
    if (kind === "system") {
      const pri =
        item.priority === "high"
          ? '<span class="tlv-notify-priority tlv-notify-priority--high">重要</span> '
          : "";
      const sysTitle = esc(item.systemTitle || item.title || "お知らせ");
      const sysBody = esc(item.systemBody || "");
      return `${pri}<strong>${sysTitle}</strong>${sysBody ? `<br>${sysBody}` : ""}`;
    }
    return `<strong>${name}</strong>: ${esc(item.title)}`;
  }

  async function countUnread(userId) {
    const uid = String(userId || resolveViewerUserId() || "").trim();
    if (!uid) return 0;

    if (shouldUseDevFallback() && global.TasuTlvDevAuth?.countDevUnreadNotifications) {
      return global.TasuTlvDevAuth.countDevUnreadNotifications(uid);
    }

    const items = await listNotifications(uid);
    return items.filter((item) => item.unread).length;
  }

  global.TasuTlvNotificationService = {
    resolveViewerUserId,
    shouldUseDevFallback,
    fetchRows,
    listNotifications,
    countUnread,
    createFollowNotification,
    createCommentNotification,
    createLiveStartedNotification,
    createVideoPublishedNotification,
    createSystemNotification,
    markAsRead,
    renderItemText,
  };
})(typeof window !== "undefined" ? window : globalThis);
