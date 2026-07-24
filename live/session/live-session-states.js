/**
 * TLV Live Session — 状態定数（SDK 非依存）
 * Phase2-01 Skeleton · Provider / UI 未接続
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

  global.TlvLiveSessionStates = LIVE_SESSION_STATES;
  global.LIVE_SESSION_STATES = LIVE_SESSION_STATES;
})(typeof window !== "undefined" ? window : globalThis);
