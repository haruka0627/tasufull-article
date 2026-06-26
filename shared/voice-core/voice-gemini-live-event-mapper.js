/**
 * Voice Core — Gemini Live wire-event → common event mapper
 * Maps future Live wire shapes to Voice Core EVENT types (no network I/O in Phase 3).
 */
(function (global) {
  "use strict";

  const { EVENT } = global.TasuVoiceCoreEvents;

  /** Future Gemini Live wire event type strings (skeleton only). */
  const GEMINI_WIRE_EVENT = Object.freeze({
    SESSION_OPENED: "live.session.opened",
    MODEL_TEXT: "server.content.text",
    MODEL_AUDIO: "server.content.audio",
    TURN_COMPLETE: "turn.complete",
    ERROR: "live.error",
    SESSION_CLOSED: "live.session.closed",
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
  function mapGeminiWireEventToVoiceCore(wireEvent, ctx = {}) {
    if (!wireEvent || !wireEvent.type) return null;

    const sessionId = ctx.sessionId || wireEvent.session?.id || wireEvent.session_id || null;
    const mockCompatible = ctx.mockCompatible !== false;
    const ts = Date.now();

    switch (wireEvent.type) {
      case GEMINI_WIRE_EVENT.SESSION_OPENED:
        return {
          type: EVENT.SESSION_STARTED,
          sessionId,
          surface: ctx.surface || "default",
          provider: ctx.provider || "gemini_live",
          adapterId: ctx.adapterId || "",
          mockCompatible,
          ts,
        };

      case GEMINI_WIRE_EVENT.MODEL_TEXT:
        return {
          type: EVENT.TEXT_DELTA,
          sessionId,
          text: String(wireEvent.text ?? wireEvent.delta ?? ""),
          final: Boolean(wireEvent.final),
          ts,
        };

      case GEMINI_WIRE_EVENT.MODEL_AUDIO:
        if (mockCompatible) {
          return {
            type: EVENT.AUDIO_DELTA_MOCK,
            sessionId,
            audio: wireEvent.audio || createMockAudioPayload(wireEvent.delta || "live-audio"),
            transcriptHint: wireEvent.transcript_hint || "mock-compatible live audio delta",
            ts,
          };
        }
        return {
          type: "audio_delta",
          sessionId,
          audio: wireEvent.audio || null,
          ts,
        };

      case GEMINI_WIRE_EVENT.TURN_COMPLETE:
        return {
          type: EVENT.TEXT_DELTA,
          sessionId,
          text: "",
          final: true,
          turnComplete: true,
          ts,
        };

      case GEMINI_WIRE_EVENT.ERROR:
        return {
          type: mockCompatible ? EVENT.ERROR_MOCK : "error",
          sessionId,
          code: String(wireEvent.code || "live_error"),
          message: String(wireEvent.message || wireEvent.error?.message || "live error"),
          ts,
        };

      case GEMINI_WIRE_EVENT.SESSION_CLOSED:
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
  function emitMappedGeminiWireEvent(emit, wireEvent, ctx) {
    const mapped = mapGeminiWireEventToVoiceCore(wireEvent, ctx);
    if (mapped) emit(mapped);
    return mapped;
  }

  global.TasuVoiceCoreGeminiLiveEventMapper = {
    GEMINI_WIRE_EVENT,
    mapGeminiWireEventToVoiceCore,
    emitMappedGeminiWireEvent,
  };
})(typeof window !== "undefined" ? window : globalThis);
