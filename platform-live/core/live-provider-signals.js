/**
 * Live Platform — Provider 抽象 signal 定数（SDK 非依存）
 * Phase A · platform-live/core
 */
(function (global) {
  "use strict";

  /** @readonly Provider → Session Manager 入力 signal */
  const LIVE_PROVIDER_SIGNALS = Object.freeze({
    PROVIDER_CONNECTING: "PROVIDER_CONNECTING",
    PROVIDER_CONNECTED: "PROVIDER_CONNECTED",
    PROVIDER_DISCONNECTED: "PROVIDER_DISCONNECTED",
    PROVIDER_RECONNECTING: "PROVIDER_RECONNECTING",
    PROVIDER_RECONNECTED: "PROVIDER_RECONNECTED",
    PROVIDER_CONNECTION_LOST: "PROVIDER_CONNECTION_LOST",
    PROVIDER_ERROR: "PROVIDER_ERROR",
  });

  global.TasuLivePlatformProviderSignals = LIVE_PROVIDER_SIGNALS;
  global.PLATFORM_LIVE_PROVIDER_SIGNALS = LIVE_PROVIDER_SIGNALS;
})(typeof window !== "undefined" ? window : globalThis);
