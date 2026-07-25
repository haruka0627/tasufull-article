/**
 * TLV Live — Provider 抽象 signal 定数（SDK 非依存 · 入力のみ）
 * Phase2-05 · ZEGO / Provider 本接続前 · Manager が受信して状態遷移
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

  global.TlvLiveProviderSignals = LIVE_PROVIDER_SIGNALS;
  global.LIVE_PROVIDER_SIGNALS = LIVE_PROVIDER_SIGNALS;
})(typeof window !== "undefined" ? window : globalThis);
