/**
 * Live Platform — Provider ファクトリ（stub fallback · ZEGO optional）
 * Phase A · ZEGO credentials なしでも lifecycle PASS
 */
(function (global) {
  "use strict";

  const PROVIDER_IDS = global.TasuLivePlatformProviderTypes?.LIVE_PROVIDER_IDS || {
    STUB: "stub",
    ZEGO: "zego",
  };

  /**
   * @param {string} providerId
   * @param {{ allowStubFallback?: boolean }} [opts]
   * @returns {import('./live-provider-interface.js').PlatformLiveProviderInterface}
   */
  function createPlatformLiveProvider(providerId, opts = {}) {
    const id = String(providerId || PROVIDER_IDS.STUB).trim().toLowerCase();
    const allowStubFallback = opts.allowStubFallback !== false;

    if (id === PROVIDER_IDS.STUB) {
      if (!global.StubLiveProvider) {
        throw new Error("StubLiveProvider が未ロードです");
      }
      return new global.StubLiveProvider();
    }

    if (id === PROVIDER_IDS.ZEGO) {
      if (global.ZegoLiveProviderAdapter && global.TlvZegoLiveProvider) {
        try {
          return new global.ZegoLiveProviderAdapter(opts);
        } catch (err) {
          if (!allowStubFallback) {
            throw err;
          }
        }
      }
      if (allowStubFallback && global.StubLiveProvider) {
        const stub = new global.StubLiveProvider();
        stub._stubFallbackFrom = PROVIDER_IDS.ZEGO;
        return stub;
      }
      throw new Error("ZegoLiveProviderAdapter / TlvZegoLiveProvider が未ロードです（stub fallback 無効）");
    }

    if (allowStubFallback && global.StubLiveProvider) {
      const stub = new global.StubLiveProvider();
      stub._stubFallbackFrom = id;
      return stub;
    }

    throw new Error(`未知の Live Provider: ${id}`);
  }

  /**
   * @param {string} providerId
   * @returns {boolean}
   */
  function isStubFallbackProvider(provider) {
    return Boolean(provider && provider._stubFallbackFrom);
  }

  global.createPlatformLiveProvider = createPlatformLiveProvider;
  global.isPlatformLiveStubFallback = isStubFallbackProvider;
})(typeof window !== "undefined" ? window : globalThis);
