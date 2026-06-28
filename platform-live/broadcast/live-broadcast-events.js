/**
 * Live Platform Broadcast — Event 定数（SDK 非依存）
 * Phase B · platform-live/broadcast
 */
(function (global) {
  "use strict";

  /** @readonly */
  const LIVE_BROADCAST_EVENTS = Object.freeze({
    BROADCAST_CREATED: "BROADCAST_CREATED",
    BROADCAST_STARTING: "BROADCAST_STARTING",
    BROADCAST_STARTED: "BROADCAST_STARTED",
    BROADCAST_STOPPING: "BROADCAST_STOPPING",
    BROADCAST_STOPPED: "BROADCAST_STOPPED",
    BROADCAST_FAILED: "BROADCAST_FAILED",
    BROADCAST_HEALTH: "BROADCAST_HEALTH",
    VIEWER_COUNT_UPDATED: "VIEWER_COUNT_UPDATED",
    STATE_CHANGED: "STATE_CHANGED",
    ERROR: "ERROR",
  });

  global.TasuLivePlatformBroadcastEvents = LIVE_BROADCAST_EVENTS;
  global.PLATFORM_LIVE_BROADCAST_EVENTS = LIVE_BROADCAST_EVENTS;
})(typeof window !== "undefined" ? window : globalThis);
