/**
 * Voice Core — Mock TTS adapter (no audio synthesis · dummy audio event only)
 */
(function (global) {
  "use strict";

  const { ADAPTER_KIND, EVENT } = global.TasuVoiceCoreEvents;

  const TTS_EVENT = Object.freeze({
    SYNTHESIS_STARTED: "tts_synthesis_started_mock",
    AUDIO_CHUNK: "tts_audio_chunk_mock",
    SYNTHESIS_DONE: "tts_synthesis_done_mock",
    CANCELLED: "tts_cancelled_mock",
    ERROR: "tts_error_mock",
  });

  function createMockAudioPayload(text) {
    const label = String(text || "mock-tts").slice(0, 32);
    const bytes = new TextEncoder().encode(label);
    return {
      format: "mock_pcm16",
      sampleRate: 24000,
      bytes: Array.from(bytes),
      durationMs: 180,
    };
  }

  const ttsMockAdapter = {
    id: "tts-mock-local",
    kind: ADAPTER_KIND.TTS,
    provider: "mock",

    /**
     * @param {string} text
     * @param {object} [options]
     */
    synthesize(text, options = {}) {
      const payload = String(text || "").trim();
      if (!payload) {
        return {
          type: TTS_EVENT.ERROR,
          code: "empty_text",
          message: "text is empty",
          mock: true,
          ts: Date.now(),
        };
      }

      const jobId = `tts-mock-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const events = [
        {
          type: TTS_EVENT.SYNTHESIS_STARTED,
          jobId,
          provider: "mock",
          mock: true,
          ts: Date.now(),
        },
        {
          type: TTS_EVENT.AUDIO_CHUNK,
          jobId,
          audio: createMockAudioPayload(payload),
          voiceCoreType: EVENT.AUDIO_DELTA_MOCK,
          mock: true,
          ts: Date.now(),
        },
        {
          type: TTS_EVENT.SYNTHESIS_DONE,
          jobId,
          text: payload,
          language: options.language || "ja-JP",
          mock: true,
          ts: Date.now(),
        },
      ];

      return { jobId, events, audio: events[1].audio, mock: true };
    },

    cancel(jobId) {
      return {
        type: TTS_EVENT.CANCELLED,
        jobId: jobId || null,
        mock: true,
        ts: Date.now(),
      };
    },

    TTS_EVENT,
  };

  global.TasuVoiceCoreTtsMockAdapter = ttsMockAdapter;
})(typeof window !== "undefined" ? window : globalThis);
