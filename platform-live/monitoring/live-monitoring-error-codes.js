/**
 * Live Platform Monitoring — Error 分類（SDK 非依存）
 * Phase F · platform-live/monitoring
 */
(function (global) {
  "use strict";

  const BASE = global.PLATFORM_LIVE_RECORDING_ERROR_CODES || global.PLATFORM_LIVE_CHAT_ERROR_CODES || {};

  /** @readonly */
  const LIVE_MONITORING_ERROR_CODES = Object.freeze({
    ...BASE,
    MONITORING_STATE_ERROR: "MONITORING_STATE_ERROR",
    MONITORING_SMOKE_FAILED: "MONITORING_SMOKE_FAILED",
    MONITORING_SERVICE_ERROR: "MONITORING_SERVICE_ERROR",
  });

  global.TasuLivePlatformMonitoringErrorCodes = LIVE_MONITORING_ERROR_CODES;
  global.PLATFORM_LIVE_MONITORING_ERROR_CODES = LIVE_MONITORING_ERROR_CODES;
})(typeof window !== "undefined" ? window : globalThis);
