/**
 * Voice Core — TTS adapter contract helpers
 */
(function (global) {
  "use strict";

  const { ADAPTER_KIND } = global.TasuVoiceCoreEvents || { ADAPTER_KIND: {} };

  function assertTtsAdapter(adapter) {
    if (!adapter || typeof adapter !== "object") {
      throw new Error("voice_core_invalid_tts_adapter");
    }
    if (!adapter.id || typeof adapter.id !== "string") {
      throw new Error("voice_core_tts_adapter_missing_id");
    }
    if (adapter.kind !== ADAPTER_KIND.TTS) {
      throw new Error("voice_core_tts_adapter_invalid_kind");
    }
    for (const key of ["synthesize", "cancel"]) {
      if (typeof adapter[key] !== "function") {
        throw new Error(`voice_core_tts_adapter_missing_${key}`);
      }
    }
    return adapter;
  }

  global.TasuVoiceCoreTtsAdapterInterface = {
    assertTtsAdapter,
  };
})(typeof window !== "undefined" ? window : globalThis);
