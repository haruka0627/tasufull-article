/**
 * Voice Core — provider router (adapter selection)
 */
(function (global) {
  "use strict";

  const { assertAdapter } = global.TasuVoiceCoreAdapterInterface;
  const mockAdapter = global.TasuVoiceCoreMockAdapter;

  const registry = new Map();

  function adapterKey(provider, kind) {
    return `${provider}:${kind}`;
  }

  function registerAdapter(adapter, options = {}) {
    const validated = assertAdapter(adapter);
    const provider = String(options.provider || validated.id.split("-")[0] || "mock");
    registry.set(adapterKey(provider, validated.kind), { provider, adapter: validated });
    return validated;
  }

  function listAdapters() {
    return Array.from(registry.values()).map(({ provider, adapter }) => ({
      provider,
      id: adapter.id,
      kind: adapter.kind,
    }));
  }

  /**
   * @param {{ provider?: string, kind?: string }} query
   */
  function resolveAdapter(query = {}) {
    const provider = String(query.provider || "mock");
    const kind = String(query.kind || "mock");
    const hit = registry.get(adapterKey(provider, kind));
    if (hit) return hit;

    if (provider === "mock") {
      return { provider: "mock", adapter: mockAdapter };
    }

    throw new Error(`voice_core_no_adapter:${provider}:${kind}`);
  }

  function initDefaults() {
    if (mockAdapter) registerAdapter(mockAdapter, { provider: "mock" });
    const openAiRealtime = global.TasuVoiceCoreOpenAiRealtimeAdapter;
    if (openAiRealtime) registerAdapter(openAiRealtime, { provider: "openai_realtime" });
    const geminiLive = global.TasuVoiceCoreGeminiLiveAdapter;
    if (geminiLive) registerAdapter(geminiLive, { provider: "gemini_live" });
  }

  initDefaults();

  global.TasuVoiceCoreProviderRouter = {
    registerAdapter,
    resolveAdapter,
    listAdapters,
  };
})(typeof window !== "undefined" ? window : globalThis);
