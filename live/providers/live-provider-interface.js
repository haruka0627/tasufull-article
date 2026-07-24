/**
 * TLV Live — Provider 抽象境界
 * UI / Service 層は本 Interface のみ参照（SDK 型を漏らさない）
 */
(function (global) {
  "use strict";

  const PROVIDER_IDS = global.TlvLiveProviderTypes?.LIVE_PROVIDER_IDS || {
    ZEGO: "zego",
    AGORA: "agora",
    LIVEKIT: "livekit",
    CLOUDFLARE_CALLS: "cloudflare_calls",
    CUSTOM_RTC: "custom_rtc",
  };

  class LiveProviderInterface {
    /** @returns {string} */
    get providerId() {
      throw new Error("LiveProviderInterface: providerId not implemented");
    }

    /** @returns {string} */
    get state() {
      return "idle";
    }

    /** @param {import('./live-provider-types.js').LiveProviderInitOptions} _options */
    async initialize(_options) {
      throw new Error("LiveProviderInterface: initialize not implemented");
    }

    /** @param {import('./live-provider-types.js').LiveSessionOptions} _options */
    async startLive(_options) {
      throw new Error("LiveProviderInterface: startLive not implemented");
    }

    /** @param {import('./live-provider-types.js').LiveSessionOptions} _options */
    async joinLive(_options) {
      throw new Error("LiveProviderInterface: joinLive not implemented");
    }

    async leaveLive() {
      throw new Error("LiveProviderInterface: leaveLive not implemented");
    }

    async endLive() {
      throw new Error("LiveProviderInterface: endLive not implemented");
    }

    async toggleCamera() {
      throw new Error("LiveProviderInterface: toggleCamera not implemented");
    }

    async toggleMic() {
      throw new Error("LiveProviderInterface: toggleMic not implemented");
    }

    async switchCamera() {
      throw new Error("LiveProviderInterface: switchCamera not implemented");
    }

    async dispose() {
      throw new Error("LiveProviderInterface: dispose not implemented");
    }

    /**
     * PoC 用 — Basic Beauty 可否（Interface 拡張 · SDK 非露出）
     * @returns {Promise<import('./live-provider-types.js').LiveBeautyProbeResult>}
     */
    async probeBasicBeauty() {
      return { supported: false, reason: "not implemented" };
    }
  }

  /**
   * @param {string} providerId
   * @returns {LiveProviderInterface}
   */
  function createLiveProvider(providerId) {
    const id = String(providerId || "").trim().toLowerCase();
    switch (id) {
      case PROVIDER_IDS.ZEGO:
        if (!global.TlvZegoLiveProvider) {
          throw new Error("TlvZegoLiveProvider が未ロードです");
        }
        return new global.TlvZegoLiveProvider();
      case PROVIDER_IDS.AGORA:
      case PROVIDER_IDS.LIVEKIT:
      case PROVIDER_IDS.CLOUDFLARE_CALLS:
      case PROVIDER_IDS.CUSTOM_RTC:
        throw new Error(`Provider "${id}" は Future です（PoC 未実装）`);
      default:
        throw new Error(`未知の Live Provider: ${id}`);
    }
  }

  global.LiveProviderInterface = LiveProviderInterface;
  global.createTlvLiveProvider = createLiveProvider;
})(typeof window !== "undefined" ? window : globalThis);
