/**
 * Live Platform Viewer — Event 定数（SDK 非依存）
 * Phase C · platform-live/viewer
 */
(function (global) {
  "use strict";

  /** @readonly */
  const LIVE_VIEWER_EVENTS = Object.freeze({
    VIEWER_JOINING: "VIEWER_JOINING",
    VIEWER_JOINED: "VIEWER_JOINED",
    VIEWER_LEFT: "VIEWER_LEFT",
    VIEWER_RECONNECTING: "VIEWER_RECONNECTING",
    VIEWER_RECONNECTED: "VIEWER_RECONNECTED",
    VIEWER_HEARTBEAT: "VIEWER_HEARTBEAT",
    VIEWER_KICKED: "VIEWER_KICKED",
    VIEWER_EXPIRED: "VIEWER_EXPIRED",
    VIEWER_FAILED: "VIEWER_FAILED",
    CCU_UPDATED: "CCU_UPDATED",
    PERMISSION_DENIED: "PERMISSION_DENIED",
    STATE_CHANGED: "STATE_CHANGED",
    ERROR: "ERROR",
  });

  global.TasuLivePlatformViewerEvents = LIVE_VIEWER_EVENTS;
  global.PLATFORM_LIVE_VIEWER_EVENTS = LIVE_VIEWER_EVENTS;
})(typeof window !== "undefined" ? window : globalThis);
