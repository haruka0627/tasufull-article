/**
 * Live Platform Recording — Event 定数（SDK 非依存）
 * Phase E · platform-live/recording
 */
(function (global) {
  "use strict";

  /** @readonly */
  const LIVE_RECORDING_EVENTS = Object.freeze({
    RECORDING_STARTING: "RECORDING_STARTING",
    RECORDING_STARTED: "RECORDING_STARTED",
    RECORDING_STOPPING: "RECORDING_STOPPING",
    RECORDING_STOPPED: "RECORDING_STOPPED",
    RECORDING_COMPLETED: "RECORDING_COMPLETED",
    RECORDING_FAILED: "RECORDING_FAILED",
    RECORDING_EXPIRED: "RECORDING_EXPIRED",
    ARCHIVE_CREATED: "ARCHIVE_CREATED",
    STATE_CHANGED: "STATE_CHANGED",
    ERROR: "ERROR",
  });

  global.TasuLivePlatformRecordingEvents = LIVE_RECORDING_EVENTS;
  global.PLATFORM_LIVE_RECORDING_EVENTS = LIVE_RECORDING_EVENTS;
})(typeof window !== "undefined" ? window : globalThis);
