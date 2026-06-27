/**
 * Voice Core — Mock STT adapter (no speech recognition · dummy transcript only)
 */
(function (global) {
  "use strict";

  const { ADAPTER_KIND } = global.TasuVoiceCoreEvents;

  const STT_EVENT = Object.freeze({
    RECOGNITION_STARTED: "stt_recognition_started_mock",
    PARTIAL: "stt_partial_mock",
    FINAL: "stt_final_mock",
    CANCELLED: "stt_cancelled_mock",
    ERROR: "stt_error_mock",
  });

  let activeJob = null;

  function createMockTranscript(label) {
    return `mock transcript: ${String(label || "audio")}`;
  }

  const sttMockAdapter = {
    id: "stt-mock-local",
    kind: ADAPTER_KIND.STT,
    provider: "mock",

    /**
     * @param {ArrayBuffer|Uint8Array|null} audioChunk
     * @param {object} [options]
     */
    recognize(audioChunk, options = {}) {
      const size = audioChunk?.byteLength ?? audioChunk?.length ?? 0;
      const jobId = `stt-mock-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      activeJob = jobId;

      const events = [
        {
          type: STT_EVENT.RECOGNITION_STARTED,
          jobId,
          provider: "mock",
          mock: true,
          ts: Date.now(),
        },
        {
          type: STT_EVENT.PARTIAL,
          jobId,
          text: createMockTranscript(`partial-${size}`),
          final: false,
          mock: true,
          ts: Date.now(),
        },
        {
          type: STT_EVENT.FINAL,
          jobId,
          text: createMockTranscript(`final-${size}`),
          final: true,
          confidence: 0.99,
          language: options.language || "ja-JP",
          mock: true,
          ts: Date.now(),
        },
      ];

      activeJob = null;
      return { jobId, events, text: events[2].text, mock: true };
    },

    cancel(jobId) {
      activeJob = null;
      return {
        type: STT_EVENT.CANCELLED,
        jobId: jobId || null,
        mock: true,
        ts: Date.now(),
      };
    },

    STT_EVENT,
  };

  global.TasuVoiceCoreSttMockAdapter = sttMockAdapter;
})(typeof window !== "undefined" ? window : globalThis);
