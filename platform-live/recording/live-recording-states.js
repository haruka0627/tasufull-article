/**
 * Live Platform Recording — 状態定数（SDK 非依存）
 * Phase E · platform-live/recording
 */
(function (global) {
  "use strict";

  /** @readonly */
  const LIVE_RECORDING_STATES = Object.freeze({
    IDLE: "idle",
    STARTING: "starting",
    RECORDING: "recording",
    STOPPING: "stopping",
    COMPLETED: "completed",
    FAILED: "failed",
    EXPIRED: "expired",
  });

  global.TasuLivePlatformRecordingStates = LIVE_RECORDING_STATES;
  global.PLATFORM_LIVE_RECORDING_STATES = LIVE_RECORDING_STATES;
})(typeof window !== "undefined" ? window : globalThis);
