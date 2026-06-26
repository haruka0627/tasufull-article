/**
 * Voice Core — adapter contract helpers
 */
(function (global) {
  "use strict";

  const { ADAPTER_KIND } = global.TasuVoiceCoreEvents || { ADAPTER_KIND: {} };

  function assertAdapter(adapter) {
    if (!adapter || typeof adapter !== "object") {
      throw new Error("voice_core_invalid_adapter");
    }
    const required = ["id", "kind", "startSession", "sendAudio", "sendText", "stopSession"];
    for (const key of required) {
      if (typeof adapter[key] !== "function" && key !== "id" && key !== "kind") {
        throw new Error(`voice_core_adapter_missing_${key}`);
      }
    }
    if (!adapter.id || typeof adapter.id !== "string") {
      throw new Error("voice_core_adapter_missing_id");
    }
    const kinds = Object.values(ADAPTER_KIND);
    if (!kinds.includes(adapter.kind)) {
      throw new Error("voice_core_adapter_invalid_kind");
    }
    return adapter;
  }

  global.TasuVoiceCoreAdapterInterface = {
    assertAdapter,
  };
})(typeof window !== "undefined" ? window : globalThis);
