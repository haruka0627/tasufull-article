/**
 * Voice Core — STT adapter contract helpers
 */
(function (global) {
  "use strict";

  const { ADAPTER_KIND } = global.TasuVoiceCoreEvents || { ADAPTER_KIND: {} };

  function assertSttAdapter(adapter) {
    if (!adapter || typeof adapter !== "object") {
      throw new Error("voice_core_invalid_stt_adapter");
    }
    if (!adapter.id || typeof adapter.id !== "string") {
      throw new Error("voice_core_stt_adapter_missing_id");
    }
    if (adapter.kind !== ADAPTER_KIND.STT) {
      throw new Error("voice_core_stt_adapter_invalid_kind");
    }
    for (const key of ["recognize", "cancel"]) {
      if (typeof adapter[key] !== "function") {
        throw new Error(`voice_core_stt_adapter_missing_${key}`);
      }
    }
    return adapter;
  }

  global.TasuVoiceCoreSttAdapterInterface = {
    assertSttAdapter,
  };
})(typeof window !== "undefined" ? window : globalThis);
