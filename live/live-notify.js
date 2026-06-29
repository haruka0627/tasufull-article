/**
 * TASFUL LIVE — 通知（Phase 7 · live-notify Edge）
 *
 * talk_notifications RLS は本人 insert のみのため、
 * creator / フォロワー向け fanout は Edge（service_role）経由。
 */
(function (global) {
  "use strict";

  const LIVE_NOTIFY_FUNCTION = "live-notify";

  function getConfig() {
    return global.TasuLiveConfig;
  }

  function shouldSkipEdge() {
    const cfg = getConfig();
    return cfg?.isTalkDevStubMode?.() === true;
  }

  async function invokeLiveNotify(event, payload) {
    const cfg = getConfig();
    if (!cfg) return { ok: false, reason: "no_config" };

    if (shouldSkipEdge()) {
      return { ok: true, skipped: true, reason: "talkDev_stub" };
    }

    const base = cfg.getFunctionsBase?.();
    if (!base) return { ok: false, reason: "no_functions_base" };

    const supaCfg = global.TASU_CHAT_SUPABASE_CONFIG || {};
    const anonKey = String(supaCfg.anonKey || "").trim();
    let token = "";
    try {
      token = await cfg.getAccessTokenForEdge?.();
    } catch {
      token = "";
    }
    if (!token && !anonKey) return { ok: false, reason: "no_auth" };

    const res = await fetch(`${base}/${LIVE_NOTIFY_FUNCTION}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${token || anonKey}`,
      },
      body: JSON.stringify({ event, payload: payload || {} }),
    });

    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }

    if (!res.ok) {
      const msg = data?.error || data?.message || `HTTP ${res.status}`;
      return { ok: false, reason: "edge_error", message: msg, status: res.status };
    }

    return { ok: true, ...data };
  }

  /**
   * @param {{ creatorId: string, followerId: string, followerName?: string }} opts
   */
  async function notifyCreatorOnFollow(opts) {
    const creatorId = String(opts?.creatorId || "").trim();
    const followerId = String(opts?.followerId || "").trim();
    if (!creatorId || !followerId) {
      return { ok: false, reason: "missing_ids" };
    }

    const followerName = opts?.followerName || followerId;
    const followerAvatar = String(opts?.followerAvatar || "").trim();
    const result = await invokeLiveNotify("follow_created", {
      creator_id: creatorId,
      follower_id: followerId,
      follower_name: followerName,
      follower_avatar: followerAvatar || undefined,
    });

    if (
      result.skipped &&
      global.TasuTlvDevAuth?.shouldUseTlvNotifyLocalFallback?.()
    ) {
      const id = global.TasuTlvDevAuth.appendDevFollowNotification({
        creatorId,
        followerId,
        followerName,
        followerAvatar,
      });
      return { ok: true, dev_local: true, id };
    }

    return result;
  }

  /**
   * @param {{ videoId: string, commentId: string, creatorId: string, actorId?: string, actorName?: string }} opts
   */
  async function notifyCreatorOnComment(opts) {
    const videoId = String(opts?.videoId || "").trim();
    const commentId = String(opts?.commentId || "").trim();
    const creatorId = String(opts?.creatorId || "").trim();
    const actorId = String(opts?.actorId || opts?.commenterId || "").trim();
    if (!videoId || !commentId || !creatorId || !actorId) {
      return { ok: false, reason: "missing_ids" };
    }
    if (actorId === creatorId) {
      return { ok: true, skipped: true, reason: "self_comment" };
    }

    const actorName = opts?.actorName || actorId;
    const result = await invokeLiveNotify("comment_created", {
      video_id: videoId,
      comment_id: commentId,
      creator_id: creatorId,
      actor_name: actorName,
    });

    if (
      result.skipped &&
      global.TasuTlvDevAuth?.shouldUseTlvNotifyLocalFallback?.()
    ) {
      const id = global.TasuTlvDevAuth.appendDevCommentNotification({
        creatorId,
        actorId,
        actorName,
        videoId,
        commentId,
      });
      return { ok: true, dev_local: true, id };
    }

    return result;
  }

  /**
   * @param {{ tipId: string, creatorId?: string, tipperName?: string }} opts
   */
  async function notifyTipCreated(opts) {
    const tipId = String(opts?.tipId || "").trim();
    if (!tipId) return { ok: false, reason: "missing_tip_id" };

    return invokeLiveNotify("tip_created", {
      tip_id: tipId,
      creator_id: opts?.creatorId || undefined,
      tipper_name: opts?.tipperName || undefined,
    });
  }

  /**
   * @param {{ broadcastId?: string, liveId?: string, creatorId?: string, creatorName?: string, title?: string }} opts
   */
  async function notifyFollowersOnLiveStarted(opts) {
    const liveId = String(opts?.liveId || opts?.broadcastId || "").trim();
    const creatorId = String(opts?.creatorId || "").trim();
    if (!liveId) return { ok: false, reason: "missing_live_id" };

    const creatorName = String(opts?.creatorName || creatorId || "").trim();
    const title = String(opts?.title || "").trim();
    const targetUrl =
      String(opts?.targetUrl || "").trim() ||
      global.TasuTlvNotificationTypes?.liveStartedTargetUrl?.(liveId) ||
      global.TasuLiveConfig?.watchUrl?.(liveId) ||
      `watch.html?broadcast_id=${encodeURIComponent(liveId)}`;

    const result = await invokeLiveNotify("live_started", {
      live_id: liveId,
      broadcast_id: liveId,
      creator_id: creatorId || undefined,
      creator_name: creatorName || undefined,
      title: title || undefined,
      target_url: targetUrl,
    });

    if (
      result.skipped &&
      global.TasuTlvDevAuth?.shouldUseTlvNotifyLocalFallback?.()
    ) {
      const fanout = global.TasuTlvDevAuth.appendDevLiveStartedNotifications({
        broadcastId: liveId,
        liveId,
        creatorId,
        creatorName,
      });
      return { ok: true, dev_local: true, ...fanout };
    }

    return result;
  }

  /** @deprecated use notifyFollowersOnLiveStarted */
  async function notifyLiveStarted(opts) {
    return notifyFollowersOnLiveStarted(opts);
  }

  /**
   * @param {{ broadcastId: string, creatorName?: string }} opts
   */
  async function notifyBroadcastStarted(opts) {
    const broadcastId = String(opts?.broadcastId || "").trim();
    if (!broadcastId) return { ok: false, reason: "missing_broadcast_id" };

    return notifyFollowersOnLiveStarted({
      liveId: broadcastId,
      broadcastId,
      creatorName: opts?.creatorName,
    });
  }

  /**
   * @param {{ videoId: string, creatorId?: string, creatorName?: string, title?: string, targetUrl?: string }} opts
   */
  async function notifyVideoPublished(opts) {
    const videoId = String(opts?.videoId || "").trim();
    const creatorId = String(opts?.creatorId || "").trim();
    if (!videoId) return { ok: false, reason: "missing_video_id" };

    const creatorName = String(opts?.creatorName || creatorId || "").trim();
    const title = String(opts?.title || "").trim();
    const targetUrl =
      String(opts?.targetUrl || "").trim() ||
      global.TasuTlvNotificationTypes?.videoPublishedTargetUrl?.(videoId) ||
      `watch-video.html?id=${encodeURIComponent(videoId)}`;

    const result = await invokeLiveNotify("video_published", {
      video_id: videoId,
      creator_id: creatorId || undefined,
      creator_name: creatorName || undefined,
      title: title || undefined,
      target_url: targetUrl,
    });

    if (
      result.skipped &&
      global.TasuTlvDevAuth?.shouldUseTlvNotifyLocalFallback?.()
    ) {
      const fanout = global.TasuTlvDevAuth.appendDevVideoPublishedNotifications({
        videoId,
        creatorId,
        creatorName,
      });
      return { ok: true, dev_local: true, ...fanout };
    }

    return result;
  }

  /**
   * @param {{ targetUserId: string, title: string, body?: string, targetUrl?: string, priority?: string, creator?: string }} opts
   */
  async function notifySystem(opts) {
    const targetUserId = String(opts?.targetUserId || opts?.target_id || "").trim();
    const title = String(opts?.title || "").trim();
    const body = String(opts?.body || "").trim();
    if (!targetUserId || !title) {
      return { ok: false, reason: "missing_fields" };
    }

    const priority =
      global.TasuTlvNotificationTypes?.normalizeSystemPriority?.(opts?.priority) || "normal";
    const targetUrl = String(opts?.targetUrl || opts?.target_url || "#").trim() || "#";
    const creator = String(opts?.creator || "TLV運営").trim();
    const timestamp = Date.now();

    const result = await invokeLiveNotify("system", {
      target_user_id: targetUserId,
      title,
      body,
      priority,
      target_url: targetUrl,
      creator,
      timestamp,
    });

    if (
      result.skipped &&
      global.TasuTlvDevAuth?.shouldUseTlvNotifyLocalFallback?.()
    ) {
      const saved = global.TasuTlvDevAuth.appendDevSystemNotification({
        targetUserId,
        title,
        body,
        targetUrl,
        priority,
        creator,
      });
      return { ok: true, dev_local: true, ...saved };
    }

    return result;
  }

  /**
   * @param {{ shortId: string }} opts
   */
  async function refreshLikeCount(opts) {
    const shortId = String(opts?.shortId || "").trim();
    if (!shortId) return { ok: false, reason: "missing_short_id" };

    if (shouldSkipEdge()) {
      const cfg = getConfig();
      if (cfg?.getClient?.()) {
        try {
          await cfg.ensureSupabaseSession();
          await cfg.getClient().rpc("live_refresh_short_like_count", { p_short_id: shortId });
          return { ok: true, skipped: true, reason: "talkDev_rpc" };
        } catch (err) {
          console.warn("[TasuLiveNotify] like_count rpc failed:", err);
        }
      }
      return { ok: true, skipped: true, reason: "talkDev_stub" };
    }

    return invokeLiveNotify("like_changed", { short_id: shortId });
  }

  global.TasuLiveNotify = {
    invokeLiveNotify,
    notifyCreatorOnFollow,
    notifyCreatorOnComment,
    notifyTipCreated,
    notifyFollowersOnLiveStarted,
    notifyLiveStarted,
    notifyBroadcastStarted,
    notifyVideoPublished,
    notifySystem,
    refreshLikeCount,
  };
})(typeof window !== "undefined" ? window : globalThis);
