/**
 * Live Platform — Provider 状態正規化（SDK / PoC → Platform canonical）
 * Phase 3 · platform-live/core
 */
(function (global) {
  "use strict";

  /** @readonly Platform canonical provider states */
  const CANONICAL_PROVIDER_STATES = Object.freeze({
    IDLE: "idle",
    INITIALIZING: "initializing",
    READY: "ready",
    LIVE: "live",
    RECONNECTING: "reconnecting",
    STOPPED: "stopped",
    FAILED: "failed",
  });

  /**
   * @param {string} rawState
   * @param {{ reconnecting?: boolean, role?: 'host'|'viewer'|null }} [meta]
   * @returns {string}
   */
  function mapProviderState(rawState, meta = {}) {
    if (meta.reconnecting) return CANONICAL_PROVIDER_STATES.RECONNECTING;
    const s = String(rawState || "idle").trim().toLowerCase();
    switch (s) {
      case "idle":
        return CANONICAL_PROVIDER_STATES.IDLE;
      case "initializing":
        return CANONICAL_PROVIDER_STATES.INITIALIZING;
      case "ready":
        return CANONICAL_PROVIDER_STATES.READY;
      case "live":
        return CANONICAL_PROVIDER_STATES.LIVE;
      case "watching":
        return CANONICAL_PROVIDER_STATES.LIVE;
      case "disposed":
        return CANONICAL_PROVIDER_STATES.STOPPED;
      case "error":
        return CANONICAL_PROVIDER_STATES.FAILED;
      default:
        return CANONICAL_PROVIDER_STATES.READY;
    }
  }

  global.TasuLivePlatformProviderStateMap = {
    CANONICAL_PROVIDER_STATES,
    mapProviderState,
  };
  global.PLATFORM_LIVE_CANONICAL_PROVIDER_STATES = CANONICAL_PROVIDER_STATES;
})(typeof window !== "undefined" ? window : globalThis);
