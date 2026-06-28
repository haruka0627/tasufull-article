/**
 * Live Platform Broadcast — Error 分類（SDK 非依存）
 * Phase B · platform-live/broadcast
 */
(function (global) {
  "use strict";

  const SESSION_CODES = global.PLATFORM_LIVE_SESSION_ERROR_CODES || global.TasuLivePlatformSessionErrorCodes;

  /** @readonly */
  const LIVE_BROADCAST_ERROR_CODES = Object.freeze({
    ...(SESSION_CODES || {}),
    BROADCAST_STATE_ERROR: "BROADCAST_STATE_ERROR",
  });

  global.TasuLivePlatformBroadcastErrorCodes = LIVE_BROADCAST_ERROR_CODES;
  global.PLATFORM_LIVE_BROADCAST_ERROR_CODES = LIVE_BROADCAST_ERROR_CODES;
})(typeof window !== "undefined" ? window : globalThis);
