/**
 * Live Platform Monitoring — Event 定数（SDK 非依存）
 * Phase F · platform-live/monitoring
 */
(function (global) {
  "use strict";

  /** @readonly */
  const LIVE_MONITORING_EVENTS = Object.freeze({
    HEALTH_CHANGED: "HEALTH_CHANGED",
    METRICS_UPDATED: "METRICS_UPDATED",
    ERROR_RECORDED: "ERROR_RECORDED",
    SMOKE_STARTED: "SMOKE_STARTED",
    SMOKE_STEP: "SMOKE_STEP",
    SMOKE_COMPLETED: "SMOKE_COMPLETED",
    SMOKE_FAILED: "SMOKE_FAILED",
  });

  global.TasuLivePlatformMonitoringEvents = LIVE_MONITORING_EVENTS;
  global.PLATFORM_LIVE_MONITORING_EVENTS = LIVE_MONITORING_EVENTS;
})(typeof window !== "undefined" ? window : globalThis);
