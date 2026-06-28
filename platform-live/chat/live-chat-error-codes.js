/**
 * Live Platform Chat — Error 分類（SDK 非依存）
 * Phase D · platform-live/chat
 */
(function (global) {
  "use strict";

  const BASE = global.PLATFORM_LIVE_VIEWER_ERROR_CODES || global.PLATFORM_LIVE_BROADCAST_ERROR_CODES || {};

  /** @readonly */
  const LIVE_CHAT_ERROR_CODES = Object.freeze({
    ...BASE,
    CHAT_VALIDATION_ERROR: "CHAT_VALIDATION_ERROR",
    CHAT_STATE_ERROR: "CHAT_STATE_ERROR",
    VIEWER_NOT_WATCHING: "VIEWER_NOT_WATCHING",
    RATE_LIMIT_DENIED: "RATE_LIMIT_DENIED",
    RATE_LIMIT_THROTTLED: "RATE_LIMIT_THROTTLED",
    MODERATION_BLOCKED: "MODERATION_BLOCKED",
  });

  global.TasuLivePlatformChatErrorCodes = LIVE_CHAT_ERROR_CODES;
  global.PLATFORM_LIVE_CHAT_ERROR_CODES = LIVE_CHAT_ERROR_CODES;
})(typeof window !== "undefined" ? window : globalThis);
