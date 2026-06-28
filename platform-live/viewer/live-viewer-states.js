/**
 * Live Platform Viewer — 状態定数（SDK 非依存）
 * Phase C · platform-live/viewer
 */
(function (global) {
  "use strict";

  /** @readonly */
  const LIVE_VIEWER_STATES = Object.freeze({
    JOINING: "joining",
    WATCHING: "watching",
    IDLE: "idle",
    RECONNECTING: "reconnecting",
    LEFT: "left",
    KICKED: "kicked",
    EXPIRED: "expired",
    FAILED: "failed",
  });

  global.TasuLivePlatformViewerStates = LIVE_VIEWER_STATES;
  global.PLATFORM_LIVE_VIEWER_STATES = LIVE_VIEWER_STATES;
})(typeof window !== "undefined" ? window : globalThis);
