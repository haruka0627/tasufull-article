/**
 * Voice Core — Realtime wire-event → common event mapper
 * Maps future provider wire shapes to Voice Core EVENT types.
 */
(function (global) {
  "use strict";

  const { EVENT } = global.TasuVoiceCoreEvents;

  /** Internal wire event type strings (no network I/O). */
  const WIRE_EVENT = Object.freeze({
    SESSION_CREATED: "session.created",
    RESPONSE_TEXT_DELTA: "response.text.delta",
    RESPONSE_AUDIO_DELTA: "response.audio.delta",
    RESPONSE_DONE: "response.done",
    ERROR: "error",
    SESSION_CLOSED: "session.closed",
  });

  /** OpenAI Realtime server event types (Phase 5 mapping boundary). */
  const OPENAI_SERVER_EVENT = Object.freeze({
    SESSION_CREATED: "session.created",
    SESSION_UPDATED: "session.updated",
    RESPONSE_TEXT_DELTA: "response.text.delta",
    RESPONSE_AUDIO_DELTA: "response.audio.delta",
    RESPONSE_AUDIO_TRANSCRIPT_DELTA: "response.audio_transcript.delta",
    RESPONSE_DONE: "response.done",
    ERROR: "error",
  });

  /**
   * Normalize OpenAI Realtime server JSON → internal WIRE_EVENT shape.
   * @param {object} raw
   * @returns {object|null}
   */
  function normalizeOpenAiServerEvent(raw) {
    if (!raw || !raw.type) return null;
    const type = String(raw.type);

    switch (type) {
      case OPENAI_SERVER_EVENT.SESSION_CREATED:
      case OPENAI_SERVER_EVENT.SESSION_UPDATED:
        return {
          type: WIRE_EVENT.SESSION_CREATED,
          session: raw.session || { id: raw.session_id || raw.id },
        };

      case OPENAI_SERVER_EVENT.RESPONSE_TEXT_DELTA:
        return {
          type: WIRE_EVENT.RESPONSE_TEXT_DELTA,
          delta: raw.delta ?? raw.text ?? "",
          final: Boolean(raw.final),
        };

      case OPENAI_SERVER_EVENT.RESPONSE_AUDIO_TRANSCRIPT_DELTA:
        return {
          type: WIRE_EVENT.RESPONSE_TEXT_DELTA,
          delta: raw.delta ?? "",
          final: false,
          source: "audio_transcript",
        };

      case OPENAI_SERVER_EVENT.RESPONSE_AUDIO_DELTA:
        return {
          type: WIRE_EVENT.RESPONSE_AUDIO_DELTA,
          delta: raw.delta,
          audio: raw.audio || (raw.delta ? { format: "pcm16", payload: raw.delta } : null),
        };

      case OPENAI_SERVER_EVENT.RESPONSE_DONE:
        return { type: WIRE_EVENT.RESPONSE_DONE };

      case OPENAI_SERVER_EVENT.ERROR:
        return {
          type: WIRE_EVENT.ERROR,
          code: raw.error?.code || raw.code || "openai_error",
          message: raw.error?.message || raw.message || "openai realtime error",
        };

      default:
        return null;
    }
  }

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

  /**
   * @param {object} wireEvent
   * @param {object} [ctx]
   * @returns {object|null}
   */
  function mapWireEventToVoiceCore(wireEvent, ctx = {}) {
    if (!wireEvent || !wireEvent.type) return null;

    const sessionId = ctx.sessionId || wireEvent.session?.id || wireEvent.session_id || null;
    const mockCompatible = ctx.mockCompatible !== false;
    const ts = Date.now();

    switch (wireEvent.type) {
      case WIRE_EVENT.SESSION_CREATED:
        return {
          type: EVENT.SESSION_STARTED,
          sessionId,
          surface: ctx.surface || "default",
          provider: ctx.provider || "openai_realtime",
          adapterId: ctx.adapterId || "",
          mockCompatible,
          ts,
        };

      case WIRE_EVENT.RESPONSE_TEXT_DELTA:
        return {
          type: EVENT.TEXT_DELTA,
          sessionId,
          text: String(wireEvent.delta ?? wireEvent.text ?? ""),
          final: Boolean(wireEvent.final),
          ts,
        };

      case WIRE_EVENT.RESPONSE_AUDIO_DELTA:
        if (mockCompatible) {
          return {
            type: EVENT.AUDIO_DELTA_MOCK,
            sessionId,
            audio: wireEvent.audio || createMockAudioPayload(wireEvent.delta || "wire-audio"),
            transcriptHint: wireEvent.transcript_hint || "mock-compatible audio delta",
            ts,
          };
        }
        return {
          type: "audio_delta",
          sessionId,
          audio: wireEvent.audio || null,
          ts,
        };

      case WIRE_EVENT.RESPONSE_DONE:
        return {
          type: EVENT.TEXT_DELTA,
          sessionId,
          text: "",
          final: true,
          responseDone: true,
          ts,
        };

      case WIRE_EVENT.ERROR:
        return {
          type: mockCompatible ? EVENT.ERROR_MOCK : "error",
          sessionId,
          code: String(wireEvent.code || "wire_error"),
          message: String(wireEvent.message || wireEvent.error?.message || "wire error"),
          ts,
        };

      case WIRE_EVENT.SESSION_CLOSED:
        return {
          type: EVENT.SESSION_STOPPED,
          sessionId,
          reason: String(wireEvent.reason || "session_closed"),
          ts,
        };

      default:
        return null;
    }
  }

  /**
   * @param {(event: object) => void} emit
   * @param {object} wireEvent
   * @param {object} [ctx]
   */
  function emitMappedWireEvent(emit, wireEvent, ctx) {
    const mapped = mapWireEventToVoiceCore(wireEvent, ctx);
    if (mapped) emit(mapped);
    return mapped;
  }

  global.TasuVoiceCoreRealtimeEventMapper = {
    WIRE_EVENT,
    OPENAI_SERVER_EVENT,
    normalizeOpenAiServerEvent,
    mapWireEventToVoiceCore,
    emitMappedWireEvent,
  };
})(typeof window !== "undefined" ? window : globalThis);
