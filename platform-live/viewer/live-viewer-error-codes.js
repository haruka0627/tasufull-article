/**
 * Live Platform Viewer — Error 分類（SDK 非依存）
 * Phase C · platform-live/viewer
 */
(function (global) {
  "use strict";

  const BASE = global.PLATFORM_LIVE_BROADCAST_ERROR_CODES || global.PLATFORM_LIVE_SESSION_ERROR_CODES || {};

  /** @readonly */
  const LIVE_VIEWER_ERROR_CODES = Object.freeze({
    ...BASE,
    VIEWER_STATE_ERROR: "VIEWER_STATE_ERROR",
    PERMISSION_DENIED: "PERMISSION_DENIED",
    VIEWER_BANNED: "VIEWER_BANNED",
    VIEWER_KICKED: "VIEWER_KICKED",
    VIEWER_EXPIRED: "VIEWER_EXPIRED",
    BROADCAST_NOT_LIVE: "BROADCAST_NOT_LIVE",
  });

  global.TasuLivePlatformViewerErrorCodes = LIVE_VIEWER_ERROR_CODES;
  global.PLATFORM_LIVE_VIEWER_ERROR_CODES = LIVE_VIEWER_ERROR_CODES;
})(typeof window !== "undefined" ? window : globalThis);
