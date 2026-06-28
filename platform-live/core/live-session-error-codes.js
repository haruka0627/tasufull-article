/**
 * Live Platform Session — Error 分類（SDK 非依存）
 * Phase A · platform-live/core
 */
(function (global) {
  "use strict";

  /** @readonly */
  const LIVE_SESSION_ERROR_CODES = Object.freeze({
    VALIDATION_ERROR: "VALIDATION_ERROR",
    PROVIDER_ERROR: "PROVIDER_ERROR",
    CONNECTION_ERROR: "CONNECTION_ERROR",
    SESSION_STATE_ERROR: "SESSION_STATE_ERROR",
    PERMISSION_ERROR: "PERMISSION_ERROR",
    SURFACE_ERROR: "SURFACE_ERROR",
    UNKNOWN_ERROR: "UNKNOWN_ERROR",
  });

  global.TasuLivePlatformSessionErrorCodes = LIVE_SESSION_ERROR_CODES;
  global.PLATFORM_LIVE_SESSION_ERROR_CODES = LIVE_SESSION_ERROR_CODES;
})(typeof window !== "undefined" ? window : globalThis);
