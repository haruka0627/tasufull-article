/**
 * Voice Core — event type constants (provider-agnostic)
 */
(function (global) {
  "use strict";

  const EVENT = Object.freeze({
    SESSION_STARTED: "session_started",
    TEXT_DELTA: "text_delta",
    AUDIO_DELTA_MOCK: "audio_delta_mock",
    SESSION_STOPPED: "session_stopped",
    ERROR_MOCK: "error_mock",
  });

  const ADAPTER_KIND = Object.freeze({
    LIVE: "live",
    STT: "stt",
    TTS: "tts",
    MOCK: "mock",
  });

  global.TasuVoiceCoreEvents = {
    EVENT,
    ADAPTER_KIND,
  };
})(typeof window !== "undefined" ? window : globalThis);
