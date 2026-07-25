/**
 * TLV Live Session — Error 分類（Phase2-06 · SDK 非依存）
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
    UNKNOWN_ERROR: "UNKNOWN_ERROR",
  });

  global.TlvLiveSessionErrorCodes = LIVE_SESSION_ERROR_CODES;
  global.LIVE_SESSION_ERROR_CODES = LIVE_SESSION_ERROR_CODES;
})(typeof window !== "undefined" ? window : globalThis);
