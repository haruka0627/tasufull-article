/**
 * Voice Core — Realtime connect policy (feature flag / env guard)
 * No network I/O. Live connect requires explicit mockCompatible:false + flag.
 */
(function (global) {
  "use strict";

  const LIVE_FLAG_ENV = "VOICE_CORE_OPENAI_LIVE_ENABLED";
  const LIVE_FLAG_WINDOW = "__TASU_VOICE_CORE_OPENAI_LIVE__";

  let runtimeInjectors = null;

  function setRuntimeInjectors(injectors) {
    runtimeInjectors = injectors && typeof injectors === "object" ? injectors : null;
  }

  function getRuntimeInjectors() {
    return runtimeInjectors;
  }

  /**
   * @param {object} [injectors]
   * @returns {boolean}
   */
  function readLiveFlag(injectors) {
    const src = injectors || runtimeInjectors || {};
    if (typeof src.isLiveEnabled === "function") return Boolean(src.isLiveEnabled());
    if (typeof src.isLiveEnabled === "boolean") return src.isLiveEnabled;

    try {
      if (typeof process !== "undefined" && process.env && process.env[LIVE_FLAG_ENV] === "1") {
        return true;
      }
    } catch {
      /* non-node */
    }

    try {
      if (typeof global !== "undefined" && global[LIVE_FLAG_WINDOW] === true) return true;
    } catch {
      /* ignore */
    }

    return false;
  }

  /**
   * @param {object} [options]
   * @param {object} [injectors]
   * @returns {{ mode: 'mock'|'live', allowLive: boolean, mockCompatible: boolean, liveFlag: boolean, reason: string }}
   */
  function resolveConnectPolicy(options = {}, injectors) {
    const mockCompatible = options.mockCompatible !== false;
    const liveFlag = readLiveFlag(injectors);
    const allowLive = liveFlag && !mockCompatible;

    let reason = "mock_compatible";
    if (!mockCompatible && !liveFlag) reason = "live_disabled";
    else if (allowLive) reason = "live_allowed";

    return {
      mode: allowLive ? "live" : "mock",
      allowLive,
      mockCompatible,
      liveFlag,
      liveRequested: !mockCompatible,
      reason,
    };
  }

  function isLiveConnectionEnabled(injectors) {
    return readLiveFlag(injectors);
  }

  global.TasuVoiceCoreRealtimeConnectPolicy = {
    LIVE_FLAG_ENV,
    LIVE_FLAG_WINDOW,
    setRuntimeInjectors,
    getRuntimeInjectors,
    readLiveFlag,
    resolveConnectPolicy,
    isLiveConnectionEnabled,
  };
})(typeof window !== "undefined" ? window : globalThis);
