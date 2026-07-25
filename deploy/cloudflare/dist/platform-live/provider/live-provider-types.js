/**
 * Live Platform — Provider 共通型（SDK 非依存）
 * Phase A · platform-live/provider
 */
(function (global) {
  "use strict";

  /** @typedef {'idle'|'initializing'|'ready'|'live'|'watching'|'error'|'disposed'} LiveProviderState */

  /**
   * @typedef {Object} LiveProviderInitOptions
   * @property {number} [appId]
   * @property {string} [server]
   * @property {string} [surface]
   * @property {HTMLElement} [logContainer]
   */

  /**
   * @typedef {Object} LiveSessionOptions
   * @property {string} roomId
   * @property {string} userId
   * @property {string} [userName]
   * @property {string} [token]
   * @property {string} surface
   * @property {HTMLElement} [videoContainer]
   * @property {string} [streamId]
   */

  /**
   * @typedef {Object} LiveProviderResult
   * @property {boolean} ok
   * @property {string} [error]
   * @property {LiveProviderState} [state]
   * @property {string} [providerId]
   * @property {boolean} [stubFallback]
   */

  const LIVE_PROVIDER_IDS = Object.freeze({
    STUB: "stub",
    ZEGO: "zego",
    AGORA: "agora",
    LIVEKIT: "livekit",
    CLOUDFLARE_CALLS: "cloudflare_calls",
    CUSTOM_RTC: "custom_rtc",
  });

  global.TasuLivePlatformProviderTypes = Object.freeze({
    LIVE_PROVIDER_IDS,
  });
})(typeof window !== "undefined" ? window : globalThis);
