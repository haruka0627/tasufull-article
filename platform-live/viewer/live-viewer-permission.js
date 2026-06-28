/**
 * Live Platform Viewer — Permission チェック（MVP · Wallet/30分 非接続）
 * Phase C · platform-live/viewer
 */
(function (global) {
  "use strict";

  const CODES = global.PLATFORM_LIVE_VIEWER_ERROR_CODES || global.TasuLivePlatformViewerErrorCodes;
  const BROADCAST_LIVE = global.PLATFORM_LIVE_BROADCAST_STATES?.LIVE || "live";
  const VIEWER = global.PLATFORM_LIVE_VIEWER_STATES || global.TasuLivePlatformViewerStates;

  /**
   * @param {{
   *   surface: string,
   *   broadcastId: string,
   *   userId: string,
   *   action: 'join'|'reconnect',
   *   broadcastState?: string|null,
   *   viewerState?: string|null,
   *   bannedUserIds?: Set<string>|string[],
   *   kickedUserIds?: Set<string>|string[],
   * }} ctx
   */
  function checkViewerPermission(ctx) {
    const surface = String(ctx?.surface ?? "").trim().toLowerCase();
    const userId = String(ctx?.userId ?? "").trim();
    const broadcastId = String(ctx?.broadcastId ?? "").trim();
    const action = String(ctx?.action ?? "join").trim().toLowerCase();
    const broadcastState = String(ctx?.broadcastState ?? "").trim().toLowerCase();
    const viewerState = String(ctx?.viewerState ?? (VIEWER?.IDLE || "idle")).trim().toLowerCase();

    if (!surface) {
      return deny("surface", "surface が必要です", CODES?.SURFACE_ERROR || "SURFACE_ERROR");
    }
    if (!userId) {
      return deny("userId", "userId が必要です");
    }
    if (!broadcastId) {
      return deny("broadcastId", "broadcastId が必要です");
    }

    const banned = toSet(ctx?.bannedUserIds);
    const kicked = toSet(ctx?.kickedUserIds);

    if (banned.has(userId)) {
      return deny("userId", "viewer は banned です", CODES?.VIEWER_BANNED || "VIEWER_BANNED");
    }

    if (action === "join") {
      if (kicked.has(userId)) {
        return deny("userId", "viewer は kicked です", CODES?.VIEWER_KICKED || "VIEWER_KICKED");
      }
      if (broadcastState !== BROADCAST_LIVE) {
        return deny("broadcastState", "broadcast が live ではありません", CODES?.BROADCAST_NOT_LIVE || "BROADCAST_NOT_LIVE");
      }
      if (viewerState === VIEWER?.KICKED) {
        return deny("viewerState", "kicked viewer は join 不可", CODES?.VIEWER_KICKED || "VIEWER_KICKED");
      }
      return allow();
    }

    if (action === "reconnect") {
      if (viewerState === VIEWER?.EXPIRED) {
        return deny("viewerState", "expired viewer は reconnect 不可", CODES?.VIEWER_EXPIRED || "VIEWER_EXPIRED");
      }
      if (viewerState === VIEWER?.KICKED) {
        return deny("viewerState", "kicked viewer は reconnect 不可", CODES?.VIEWER_KICKED || "VIEWER_KICKED");
      }
      if (kicked.has(userId)) {
        return deny("userId", "viewer は kicked です", CODES?.VIEWER_KICKED || "VIEWER_KICKED");
      }
      if (broadcastState !== BROADCAST_LIVE) {
        return deny("broadcastState", "broadcast が live ではありません", CODES?.BROADCAST_NOT_LIVE || "BROADCAST_NOT_LIVE");
      }
      if (![VIEWER?.WATCHING, VIEWER?.RECONNECTING].includes(viewerState)) {
        return deny("viewerState", `reconnect 不可（現在: ${viewerState}）`, CODES?.PERMISSION_DENIED || "PERMISSION_DENIED");
      }
      return allow();
    }

    return deny("action", `未知の action: ${action}`, CODES?.PERMISSION_DENIED || "PERMISSION_DENIED");
  }

  /** @private */
  function toSet(value) {
    if (value instanceof Set) return value;
    if (Array.isArray(value)) return new Set(value.map((x) => String(x).trim()).filter(Boolean));
    return new Set();
  }

  /** @private */
  function allow() {
    return { ok: true, allowed: true };
  }

  /** @private */
  function deny(field, message, code) {
    return {
      ok: false,
      allowed: false,
      code: code || CODES?.PERMISSION_DENIED || "PERMISSION_DENIED",
      message: String(message),
      field,
    };
  }

  global.TasuLivePlatformViewerPermission = Object.freeze({
    checkViewerPermission,
  });
})(typeof window !== "undefined" ? window : globalThis);
