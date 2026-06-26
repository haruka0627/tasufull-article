/**
 * Voice Core — Realtime wire-event → common event mapper
 * Maps future provider wire shapes to Voice Core EVENT types.
 */
(function (global) {
  "use strict";

  const { EVENT } = global.TasuVoiceCoreEvents;

  /** Future Realtime wire event type strings (no network I/O in Phase 2). */
  const WIRE_EVENT = Object.freeze({
    SESSION_CREATED: "session.created",
    RESPONSE_TEXT_DELTA: "response.text.delta",
    RESPONSE_AUDIO_DELTA: "response.audio.delta",
    RESPONSE_DONE: "response.done",
    ERROR: "error",
    SESSION_CLOSED: "session.closed",
  });

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
    mapWireEventToVoiceCore,
    emitMappedWireEvent,
  };
})(typeof window !== "undefined" ? window : globalThis);
