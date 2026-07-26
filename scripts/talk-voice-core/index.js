/**
 * TASFUL talk-voice-core — facade (permissions · entitlement · state · provider)
 */
(function (global) {
  "use strict";

  function getProvider() {
    return (
      global.TasuTalkVoiceActiveProvider ||
      global.TasuTalkVoiceWebRtcAdapter?.getDefault?.() ||
      null
    );
  }

  function setProvider(adapter) {
    const check = global.TasuTalkVoiceProviderInterface?.assertAdapter?.(adapter);
    if (check && !check.ok) {
      throw new Error(`invalid voice provider adapter: missing ${check.missing?.join(",")}`);
    }
    global.TasuTalkVoiceActiveProvider = adapter;
    return adapter;
  }

  global.TasuTalkVoiceCore = {
    errors: () => global.TasuTalkVoiceErrors,
    stateMachine: () => global.TasuTalkVoiceStateMachine,
    permissions: () => global.TasuTalkVoicePermissions,
    entitlement: () => global.TasuTalkVoiceEntitlement,
    usage: () => global.TasuTalkVoiceUsage,
    telemetry: () => global.TasuTalkVoiceTelemetry,
    providerInterface: () => global.TasuTalkVoiceProviderInterface,
    getProvider,
    setProvider,
  };
})(typeof window !== "undefined" ? window : globalThis);
