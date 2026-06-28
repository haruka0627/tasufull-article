/**
 * Live Platform Session — 状態定数（SDK 非依存）
 * Phase A · platform-live/core
 */
(function (global) {
  "use strict";

  /** @readonly */
  const LIVE_SESSION_STATES = Object.freeze({
    IDLE: "IDLE",
    INITIALIZING: "INITIALIZING",
    READY: "READY",
    STARTING: "STARTING",
    LIVE: "LIVE",
    JOINING: "JOINING",
    CONNECTED: "CONNECTED",
    LEAVING: "LEAVING",
    ENDED: "ENDED",
    RECONNECTING: "RECONNECTING",
    ERROR: "ERROR",
  });

  global.TasuLivePlatformSessionStates = LIVE_SESSION_STATES;
  global.PLATFORM_LIVE_SESSION_STATES = LIVE_SESSION_STATES;
})(typeof window !== "undefined" ? window : globalThis);
