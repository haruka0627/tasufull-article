/**
 * TLV Live — Provider 共通型（SDK 非依存）
 * PoC · Phase 1 — Payment/Wallet とは分離
 */
(function (global) {
  "use strict";

  /** @typedef {'idle'|'initializing'|'ready'|'live'|'watching'|'error'|'disposed'} LiveProviderState */

  /**
   * @typedef {Object} LiveProviderInitOptions
   * @property {number} appId
   * @property {string} server
   * @property {HTMLElement} [logContainer]
   */

  /**
   * @typedef {Object} LiveSessionOptions
   * @property {string} roomId
   * @property {string} userId
   * @property {string} userName
   * @property {string} token
   * @property {HTMLElement} videoContainer
   * @property {string} [streamId]
   */

  /**
   * @typedef {Object} LiveProviderResult
   * @property {boolean} ok
   * @property {string} [error]
   * @property {LiveProviderState} [state]
   */

  /**
   * @typedef {Object} LiveBeautyProbeResult
   * @property {boolean} supported
   * @property {string} [reason]
   * @property {string[]} [features]
   */

  const LIVE_PROVIDER_IDS = Object.freeze({
    ZEGO: "zego",
    AGORA: "agora",
    LIVEKIT: "livekit",
    CLOUDFLARE_CALLS: "cloudflare_calls",
    CUSTOM_RTC: "custom_rtc",
  });

  global.TlvLiveProviderTypes = Object.freeze({
    LIVE_PROVIDER_IDS,
  });
})(typeof window !== "undefined" ? window : globalThis);
