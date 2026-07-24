/**
 * TLV Live Session — Event 定数（SDK 非依存 · Business Logic なし）
 * Phase2-01 Skeleton · 定義のみ
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
    ERROR: "ERROR",
    STATE_CHANGED: "STATE_CHANGED",
  });

  global.TlvLiveSessionEvents = LIVE_SESSION_EVENTS;
  global.LIVE_SESSION_EVENTS = LIVE_SESSION_EVENTS;
})(typeof window !== "undefined" ? window : globalThis);
