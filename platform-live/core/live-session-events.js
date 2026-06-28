/**
 * Live Platform Session — Event 定数（SDK 非依存 · Business Logic なし）
 * Phase A · platform-live/core
 */
(function (global) {
  "use strict";

  /** @readonly */
  const LIVE_SESSION_EVENTS = Object.freeze({
    LIVE_CREATED: "LIVE_CREATED",
    LIVE_STARTED: "LIVE_STARTED",
    LIVE_JOINED: "LIVE_JOINED",
    LIVE_LEFT: "LIVE_LEFT",
    LIVE_ENDED: "LIVE_ENDED",
    HOST_CONNECTED: "HOST_CONNECTED",
    VIEWER_CONNECTED: "VIEWER_CONNECTED",
    RECONNECTING: "RECONNECTING",
    RECONNECTED: "RECONNECTED",
    PRESENCE_UPDATED: "PRESENCE_UPDATED",
    ERROR: "ERROR",
    STATE_CHANGED: "STATE_CHANGED",
  });

  global.TasuLivePlatformSessionEvents = LIVE_SESSION_EVENTS;
  global.PLATFORM_LIVE_SESSION_EVENTS = LIVE_SESSION_EVENTS;
})(typeof window !== "undefined" ? window : globalThis);
