/**
 * Voice Core — Gemini Live adapter skeleton (mock-compatible · no wire connect)
 * provider: gemini_live · kind: live
 */
(function (global) {
  "use strict";

  const { EVENT, ADAPTER_KIND } = global.TasuVoiceCoreEvents;
  const { normalizeGeminiLiveOptions } = global.TasuVoiceCoreGeminiLiveOptions;
  const { GEMINI_WIRE_EVENT, emitMappedGeminiWireEvent } = global.TasuVoiceCoreGeminiLiveEventMapper;

  const CONNECTION_STATE = Object.freeze({
    IDLE: "idle",
    MOCK_ACTIVE: "mock_active",
    DISCONNECTED: "disconnected",
  });

  const sessions = new Map();

  function setConnectionState(sessionId, state) {
    if (!sessionId) return;
    const prev = sessions.get(sessionId) || {};
    sessions.set(sessionId, { ...prev, state, updatedAt: Date.now() });
  }

  function getConnectionState(sessionId) {
    return sessions.get(sessionId)?.state || CONNECTION_STATE.IDLE;
  }

  function createSessionId() {
    return `gem-live-mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function ctxFor(sessionId, options) {
    return {
      sessionId,
      surface: options.surface,
      provider: "gemini_live",
      adapterId: geminiLiveAdapter.id,
      mockCompatible: options.mockCompatible !== false,
    };
  }

  const geminiLiveAdapter = {
    id: "gemini-live-skeleton",
    kind: ADAPTER_KIND.LIVE,

    /**
     * @param {object} options
     * @param {(event: object) => void} emit
     */
    startSession(options, emit) {
      const opts = normalizeGeminiLiveOptions({ ...options, provider: "gemini_live", kind: "live" });
      if (!opts.mockCompatible) {
        const err = {
          type: EVENT.ERROR_MOCK,
          code: "mock_compatible_required",
          message: "Phase 3 supports mock-compatible mode only",
        };
        emit(err);
        return { sessionId: null, error: err };
      }

      const sessionId = createSessionId();
      sessions.set(sessionId, {
        state: CONNECTION_STATE.MOCK_ACTIVE,
        surface: opts.surface,
        updatedAt: Date.now(),
      });

      emitMappedGeminiWireEvent(
        emit,
        { type: GEMINI_WIRE_EVENT.SESSION_OPENED, session: { id: sessionId } },
        ctxFor(sessionId, opts)
      );

      return { sessionId, connectionState: CONNECTION_STATE.MOCK_ACTIVE };
    },

    sendAudio(sessionId, chunk) {
      if (!sessionId || getConnectionState(sessionId) !== CONNECTION_STATE.MOCK_ACTIVE) {
        return {
          type: EVENT.ERROR_MOCK,
          code: "not_active",
          message: "session not active",
        };
      }

      const size = chunk?.byteLength ?? chunk?.length ?? 0;
      const meta = sessions.get(sessionId) || {};

      return {
        type: EVENT.AUDIO_DELTA_MOCK,
        sessionId,
        audio: {
          format: "mock_pcm16",
          sampleRate: 16000,
          bytes: Array.from(new TextEncoder().encode(`live-mock-audio-${size}`)),
          durationMs: 120,
        },
        transcriptHint: size > 0 ? "mock-compatible live audio input" : "empty audio chunk",
        wireType: GEMINI_WIRE_EVENT.MODEL_AUDIO,
        ts: Date.now(),
        _mappedFrom: GEMINI_WIRE_EVENT.MODEL_AUDIO,
        _ctx: {
          sessionId,
          provider: "gemini_live",
          adapterId: geminiLiveAdapter.id,
          mockCompatible: true,
          surface: meta.surface || "default",
        },
      };
    },

    sendText(sessionId, text) {
      if (!sessionId || getConnectionState(sessionId) !== CONNECTION_STATE.MOCK_ACTIVE) {
        return {
          type: EVENT.ERROR_MOCK,
          code: "not_active",
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
        text: `live-mock: ${payload}`,
        final: true,
        wireType: GEMINI_WIRE_EVENT.MODEL_TEXT,
        ts: Date.now(),
        _mappedFrom: GEMINI_WIRE_EVENT.MODEL_TEXT,
        _ctx: {
          sessionId,
          provider: "gemini_live",
          adapterId: geminiLiveAdapter.id,
          mockCompatible: true,
        },
      };
    },

    stopSession(sessionId) {
      if (!sessionId) {
        return {
          type: EVENT.ERROR_MOCK,
          code: "no_session",
          message: "session id missing",
        };
      }

      setConnectionState(sessionId, CONNECTION_STATE.DISCONNECTED);
      sessions.delete(sessionId);

      return {
        type: EVENT.SESSION_STOPPED,
        sessionId,
        reason: "user_stop",
        wireType: GEMINI_WIRE_EVENT.SESSION_CLOSED,
        ts: Date.now(),
        _mappedFrom: GEMINI_WIRE_EVENT.SESSION_CLOSED,
      };
    },

    getConnectionState,
    CONNECTION_STATE,
  };

  global.TasuVoiceCoreGeminiLiveAdapter = geminiLiveAdapter;
})(typeof window !== "undefined" ? window : globalThis);
