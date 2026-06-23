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

    return invokeLiveNotify("follow_created", {
      creator_id: creatorId,
      follower_id: followerId,
      follower_name: opts?.followerName || followerId,
    });
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
   * @param {{ broadcastId: string, creatorName?: string }} opts
   */
  async function notifyBroadcastStarted(opts) {
    const broadcastId = String(opts?.broadcastId || "").trim();
    if (!broadcastId) return { ok: false, reason: "missing_broadcast_id" };

    return invokeLiveNotify("broadcast_started", {
      broadcast_id: broadcastId,
      creator_name: opts?.creatorName || undefined,
    });
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
    notifyTipCreated,
    notifyBroadcastStarted,
    refreshLikeCount,
  };
})(typeof window !== "undefined" ? window : globalThis);
