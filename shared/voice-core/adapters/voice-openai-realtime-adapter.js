/**
 * Voice Core — OpenAI Realtime adapter skeleton (mock-compatible · no wire connect)
 * provider: openai_realtime · kind: live
 */
(function (global) {
  "use strict";

  const { EVENT, ADAPTER_KIND } = global.TasuVoiceCoreEvents;
  const { normalizeRealtimeOptions } = global.TasuVoiceCoreRealtimeOptions;
  const { WIRE_EVENT, emitMappedWireEvent } = global.TasuVoiceCoreRealtimeEventMapper;

  const CONNECTION_STATE = Object.freeze({
    IDLE: "idle",
    MOCK_ACTIVE: "mock_active",
    DISCONNECTED: "disconnected",
  });

  const sessions = new Map();

  function setConnectionState(sessionId, state) {
    if (!sessionId) return;
    sessions.set(sessionId, { state, updatedAt: Date.now() });
  }

  function getConnectionState(sessionId) {
    return sessions.get(sessionId)?.state || CONNECTION_STATE.IDLE;
  }

  function createSessionId() {
    return `oai-rt-mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function ctxFor(sessionId, options) {
    return {
      sessionId,
      surface: options.surface,
      provider: "openai_realtime",
      adapterId: openAiRealtimeAdapter.id,
      mockCompatible: options.mockCompatible !== false,
    };
  }

  const openAiRealtimeAdapter = {
    id: "openai-realtime-skeleton",
    kind: ADAPTER_KIND.LIVE,

    /**
     * @param {object} options
     * @param {(event: object) => void} emit
     */
    startSession(options, emit) {
      const opts = normalizeRealtimeOptions({ ...options, provider: "openai_realtime", kind: "live" });
      if (!opts.mockCompatible) {
        const err = {
          type: EVENT.ERROR_MOCK,
          code: "mock_compatible_required",
          message: "Phase 2 supports mock-compatible mode only",
        };
        emit(err);
        return { sessionId: null, error: err };
      }

      const sessionId = createSessionId();
      setConnectionState(sessionId, CONNECTION_STATE.MOCK_ACTIVE);
      sessions.set(sessionId, {
        state: CONNECTION_STATE.MOCK_ACTIVE,
        surface: opts.surface,
        updatedAt: Date.now(),
      });

      emitMappedWireEvent(
        emit,
        { type: WIRE_EVENT.SESSION_CREATED, session: { id: sessionId } },
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
      const opts = sessions.get(sessionId) || {};
      const ctx = {
        sessionId,
        provider: "openai_realtime",
        adapterId: openAiRealtimeAdapter.id,
        mockCompatible: true,
        surface: opts.surface || "default",
      };

      return {
        type: EVENT.AUDIO_DELTA_MOCK,
        sessionId,
        audio: {
          format: "mock_pcm16",
          sampleRate: 16000,
          bytes: Array.from(new TextEncoder().encode(`rt-mock-audio-${size}`)),
          durationMs: 120,
        },
        transcriptHint: size > 0 ? "mock-compatible audio input" : "empty audio chunk",
        wireType: WIRE_EVENT.RESPONSE_AUDIO_DELTA,
        ts: Date.now(),
        _mappedFrom: WIRE_EVENT.RESPONSE_AUDIO_DELTA,
        _ctx: ctx,
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

      const ctx = {
        sessionId,
        provider: "openai_realtime",
        adapterId: openAiRealtimeAdapter.id,
        mockCompatible: true,
      };

      const mapped = {
        type: EVENT.TEXT_DELTA,
        sessionId,
        text: `rt-mock: ${payload}`,
        final: true,
        wireType: WIRE_EVENT.RESPONSE_TEXT_DELTA,
        ts: Date.now(),
        _mappedFrom: WIRE_EVENT.RESPONSE_TEXT_DELTA,
        _ctx: ctx,
      };
      return mapped;
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
        wireType: WIRE_EVENT.SESSION_CLOSED,
        ts: Date.now(),
        _mappedFrom: WIRE_EVENT.SESSION_CLOSED,
      };
    },

    getConnectionState,
    CONNECTION_STATE,
  };

  global.TasuVoiceCoreOpenAiRealtimeAdapter = openAiRealtimeAdapter;
})(typeof window !== "undefined" ? window : globalThis);
