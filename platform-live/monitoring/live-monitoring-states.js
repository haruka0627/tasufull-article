/**
 * Live Platform Monitoring — Health 状態定数（SDK 非依存）
 * Phase F · platform-live/monitoring
 */
(function (global) {
  "use strict";

  /** @readonly */
  const LIVE_MONITORING_HEALTH_STATES = Object.freeze({
    HEALTHY: "healthy",
    DEGRADED: "degraded",
    FAILED: "failed",
    UNKNOWN: "unknown",
  });

  global.TasuLivePlatformMonitoringHealthStates = LIVE_MONITORING_HEALTH_STATES;
  global.PLATFORM_LIVE_MONITORING_HEALTH_STATES = LIVE_MONITORING_HEALTH_STATES;
})(typeof window !== "undefined" ? window : globalThis);
