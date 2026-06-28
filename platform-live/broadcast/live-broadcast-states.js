/**
 * Live Platform Broadcast — 状態定数（SDK 非依存）
 * Phase B · platform-live/broadcast
 */
(function (global) {
  "use strict";

  /** @readonly */
  const LIVE_BROADCAST_STATES = Object.freeze({
    DRAFT: "draft",
    STARTING: "starting",
    LIVE: "live",
    STOPPING: "stopping",
    ENDED: "ended",
    FAILED: "failed",
  });

  global.TasuLivePlatformBroadcastStates = LIVE_BROADCAST_STATES;
  global.PLATFORM_LIVE_BROADCAST_STATES = LIVE_BROADCAST_STATES;
})(typeof window !== "undefined" ? window : globalThis);
