/**
 * Voice Core — shared provider-agnostic voice session API
 * Builder AI · AI秘書 · TASFUL AI · TLV — 将来差し替え可能な土台（Phase 4: STT/TTS/Fallback skeleton）
 */
(function (global) {
  "use strict";

  const { createSession } = global.TasuVoiceCoreSession;
  const { resolveAdapter, registerAdapter, listAdapters } = global.TasuVoiceCoreProviderRouter;
  const { EVENT, ADAPTER_KIND } = global.TasuVoiceCoreEvents;
  const { normalizeRealtimeOptions } = global.TasuVoiceCoreRealtimeOptions || {};
  const { mapWireEventToVoiceCore, WIRE_EVENT } = global.TasuVoiceCoreRealtimeEventMapper || {};
  const { normalizeGeminiLiveOptions } = global.TasuVoiceCoreGeminiLiveOptions || {};
  const { mapGeminiWireEventToVoiceCore, GEMINI_WIRE_EVENT } =
    global.TasuVoiceCoreGeminiLiveEventMapper || {};
  const { assertSttAdapter } = global.TasuVoiceCoreSttAdapterInterface || {};
  const { assertTtsAdapter } = global.TasuVoiceCoreTtsAdapterInterface || {};
  const sttMockAdapter = global.TasuVoiceCoreSttMockAdapter;
  const ttsMockAdapter = global.TasuVoiceCoreTtsMockAdapter;
  const { createFallbackRouter, DEFAULT_LIVE_CHAIN } = global.TasuVoiceCoreFallbackRouter || {};
  const { resolveConnectPolicy, isLiveConnectionEnabled, setRuntimeInjectors } =
    global.TasuVoiceCoreRealtimeConnectPolicy || {};
  const { createRealtimeConfig } = global.TasuVoiceCoreRealtimeConfig || {};
  const { normalizeOpenAiServerEvent, OPENAI_SERVER_EVENT } = global.TasuVoiceCoreRealtimeEventMapper || {};
  const { createWireClient } = global.TasuVoiceCoreOpenAiRealtimeWireClient || {};

  /**
   * @param {object} [options]
   * @param {(event: object) => void} [options.onEvent] — optional listener registered before session starts
   * @returns {ReturnType<typeof createSession>}
   */
  function startSession(options = {}) {
    const { onEvent, ...rest } = options;
    const session = createSession(rest);
    if (typeof onEvent === "function") session.receiveEvent(onEvent);
    session.startSession(rest);
    return session;
  }

  /**
   * @param {{ provider?: string }} [options]
   */
  function createSTTAdapter(options = {}) {
    const provider = String(options.provider || "mock");
    if (provider === "mock" && sttMockAdapter) {
      if (assertSttAdapter) assertSttAdapter(sttMockAdapter);
      return sttMockAdapter;
    }
    throw new Error(`voice_core_stt_not_implemented:${provider}`);
  }

  /**
   * @param {{ provider?: string }} [options]
   */
  function createTTSAdapter(options = {}) {
    const provider = String(options.provider || "mock");
    if (provider === "mock" && ttsMockAdapter) {
      if (assertTtsAdapter) assertTtsAdapter(ttsMockAdapter);
      return ttsMockAdapter;
    }
    throw new Error(`voice_core_tts_not_implemented:${provider}`);
  }

  global.TasuVoiceCore = {
    VERSION: "phase5a-openai-live-boundary",
    EVENT,
    ADAPTER_KIND,
    WIRE_EVENT: WIRE_EVENT || {},
    OPENAI_SERVER_EVENT: OPENAI_SERVER_EVENT || {},
    GEMINI_WIRE_EVENT: GEMINI_WIRE_EVENT || {},
    DEFAULT_LIVE_CHAIN: DEFAULT_LIVE_CHAIN || [],
    normalizeRealtimeOptions,
    mapWireEventToVoiceCore,
    normalizeOpenAiServerEvent,
    normalizeGeminiLiveOptions,
    mapGeminiWireEventToVoiceCore,
    resolveConnectPolicy,
    isLiveConnectionEnabled,
    setRuntimeInjectors,
    createRealtimeConfig,
    createWireClient,
    createSTTAdapter,
    createTTSAdapter,
    createFallbackRouter,
    VoiceFallbackRouter: global.TasuVoiceCoreFallbackRouter,
    VoiceRealtimeConnectPolicy: global.TasuVoiceCoreRealtimeConnectPolicy,
    VoiceRealtimeConfig: global.TasuVoiceCoreRealtimeConfig,
    OpenAiRealtimeWireClient: global.TasuVoiceCoreOpenAiRealtimeWireClient,
    startSession,
    createSession,
    resolveAdapter,
    registerAdapter,
    listAdapters,
  };
})(typeof window !== "undefined" ? window : globalThis);
