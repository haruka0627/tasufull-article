/**
 * Voice Core — Realtime session options (provider-agnostic shape)
 */
(function (global) {
  "use strict";

  /**
   * @typedef {object} VoiceRealtimeSessionOptions
   * @property {string} [surface] — builder_ai | ops_secretary | tasful_ai | tlv | default
   * @property {string} [provider] — openai_realtime | mock
   * @property {string} [kind] — live | mock
   * @property {boolean} [mockCompatible] — Phase 2: local simulation only (no wire connect)
   * @property {string} [model] — future model id (ignored in mock-compatible mode)
   * @property {string} [voice] — future voice id (ignored in mock-compatible mode)
   * @property {string} [language] — e.g. ja-JP
   * @property {boolean} [inputAudioTranscription] — future STT toggle
   * @property {boolean} [turnDetection] — future VAD toggle
   */

  const DEFAULT_REALTIME_OPTIONS = Object.freeze({
    surface: "default",
    provider: "mock",
    kind: "mock",
    mockCompatible: true,
    model: "",
    voice: "",
    language: "ja-JP",
    inputAudioTranscription: false,
    turnDetection: false,
  });

  /** @param {Partial<VoiceRealtimeSessionOptions>} [input] */
  function normalizeRealtimeOptions(input) {
    const src = input && typeof input === "object" ? input : {};
    return {
      surface: String(src.surface || DEFAULT_REALTIME_OPTIONS.surface),
      provider: String(src.provider || DEFAULT_REALTIME_OPTIONS.provider),
      kind: String(src.kind || DEFAULT_REALTIME_OPTIONS.kind),
      mockCompatible: src.mockCompatible !== false,
      model: String(src.model || ""),
      voice: String(src.voice || ""),
      language: String(src.language || DEFAULT_REALTIME_OPTIONS.language),
      inputAudioTranscription: Boolean(src.inputAudioTranscription),
      turnDetection: Boolean(src.turnDetection),
    };
  }

  global.TasuVoiceCoreRealtimeOptions = {
    DEFAULT_REALTIME_OPTIONS,
    normalizeRealtimeOptions,
  };
})(typeof window !== "undefined" ? window : globalThis);
