/**
 * Voice Core — Gemini Live session options (provider-specific shape)
 */
(function (global) {
  "use strict";

  /**
   * @typedef {object} VoiceGeminiLiveSessionOptions
   * @property {string} [surface] — builder_ai | ops_secretary | tasful_ai | tlv | default
   * @property {string} [provider] — gemini_live
   * @property {string} [kind] — live
   * @property {boolean} [mockCompatible] — Phase 3: local simulation only (no wire connect)
   * @property {string} [model] — future model id (ignored in mock-compatible mode)
   * @property {string} [voice] — future voice preset (ignored in mock-compatible mode)
   * @property {string} [language] — e.g. ja-JP
   * @property {boolean} [inputAudioTranscription] — future input transcript toggle
   * @property {boolean} [outputAudioTranscription] — future output transcript toggle
   */

  const DEFAULT_GEMINI_LIVE_OPTIONS = Object.freeze({
    surface: "default",
    provider: "gemini_live",
    kind: "live",
    mockCompatible: true,
    model: "",
    voice: "",
    language: "ja-JP",
    inputAudioTranscription: false,
    outputAudioTranscription: false,
  });

  /** @param {Partial<VoiceGeminiLiveSessionOptions>} [input] */
  function normalizeGeminiLiveOptions(input) {
    const src = input && typeof input === "object" ? input : {};
    return {
      surface: String(src.surface || DEFAULT_GEMINI_LIVE_OPTIONS.surface),
      provider: String(src.provider || DEFAULT_GEMINI_LIVE_OPTIONS.provider),
      kind: String(src.kind || DEFAULT_GEMINI_LIVE_OPTIONS.kind),
      mockCompatible: src.mockCompatible !== false,
      model: String(src.model || ""),
      voice: String(src.voice || ""),
      language: String(src.language || DEFAULT_GEMINI_LIVE_OPTIONS.language),
      inputAudioTranscription: Boolean(src.inputAudioTranscription),
      outputAudioTranscription: Boolean(src.outputAudioTranscription),
    };
  }

  global.TasuVoiceCoreGeminiLiveOptions = {
    DEFAULT_GEMINI_LIVE_OPTIONS,
    normalizeGeminiLiveOptions,
  };
})(typeof window !== "undefined" ? window : globalThis);
