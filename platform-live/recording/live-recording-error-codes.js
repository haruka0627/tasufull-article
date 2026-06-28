/**
 * Live Platform Recording — Error 分類（SDK 非依存）
 * Phase E · platform-live/recording
 */
(function (global) {
  "use strict";

  const BASE = global.PLATFORM_LIVE_CHAT_ERROR_CODES || global.PLATFORM_LIVE_VIEWER_ERROR_CODES || {};

  /** @readonly */
  const LIVE_RECORDING_ERROR_CODES = Object.freeze({
    ...BASE,
    RECORDING_STATE_ERROR: "RECORDING_STATE_ERROR",
    RECORDING_NOT_FOUND: "RECORDING_NOT_FOUND",
    RECORDING_PROVIDER_ERROR: "RECORDING_PROVIDER_ERROR",
  });

  global.TasuLivePlatformRecordingErrorCodes = LIVE_RECORDING_ERROR_CODES;
  global.PLATFORM_LIVE_RECORDING_ERROR_CODES = LIVE_RECORDING_ERROR_CODES;
})(typeof window !== "undefined" ? window : globalThis);
