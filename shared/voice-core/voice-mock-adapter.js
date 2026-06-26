/**
 * Voice Core — local mock adapter (no external API)
 */
(function (global) {
  "use strict";

  const { EVENT, ADAPTER_KIND } = global.TasuVoiceCoreEvents;

  function createMockAudioPayload(label) {
    const text = String(label || "mock-audio");
    const bytes = new TextEncoder().encode(text);
    return {
      format: "mock_pcm16",
      sampleRate: 16000,
      bytes: Array.from(bytes),
      durationMs: 120,
    };
  }

  const mockAdapter = {
    id: "mock-local",
    kind: ADAPTER_KIND.MOCK,

    /**
     * @param {object} options
     * @param {(event: object) => void} emit
     * @returns {{ sessionId: string }}
     */
    startSession(options, emit) {
      const sessionId = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const surface = String(options?.surface || "default");
      emit({
        type: EVENT.SESSION_STARTED,
        sessionId,
        surface,
        provider: "mock",
        adapterId: mockAdapter.id,
        ts: Date.now(),
      });
      return { sessionId };
    },

    sendAudio(sessionId, chunk) {
      if (!sessionId) {
        return {
          type: EVENT.ERROR_MOCK,
          code: "no_session",
          message: "session not active",
        };
      }
      const size = chunk?.byteLength ?? chunk?.length ?? 0;
      return {
        type: EVENT.AUDIO_DELTA_MOCK,
        sessionId,
        audio: createMockAudioPayload(`audio-${size}`),
        transcriptHint: size > 0 ? "mock audio received" : "empty audio chunk",
        ts: Date.now(),
      };
    },

    sendText(sessionId, text) {
      if (!sessionId) {
        return {
          type: EVENT.ERROR_MOCK,
          code: "no_session",
          message: "session not active",
        };
      }
      const payload = String(text || "").trim();
      if (!payload) {
        return {
          type: EVENT.ERROR_MOCK,
          code: "empty_text",
          message: "text is empty",
        };
      }
      return {
        type: EVENT.TEXT_DELTA,
        sessionId,
        text: `mock: ${payload}`,
        final: true,
        ts: Date.now(),
      };
    },

    stopSession(sessionId) {
      return {
        type: EVENT.SESSION_STOPPED,
        sessionId: sessionId || null,
        reason: "user_stop",
        ts: Date.now(),
      };
    },
  };

  global.TasuVoiceCoreMockAdapter = mockAdapter;
})(typeof window !== "undefined" ? window : globalThis);
