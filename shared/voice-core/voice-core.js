/**
 * Voice Core — shared provider-agnostic voice session API
 * Builder AI · AI秘書 · TASFUL AI · TLV — 将来差し替え可能な土台（Phase 1: mock only）
 */
(function (global) {
  "use strict";

  const { createSession } = global.TasuVoiceCoreSession;
  const { resolveAdapter, registerAdapter, listAdapters } = global.TasuVoiceCoreProviderRouter;
  const { EVENT, ADAPTER_KIND } = global.TasuVoiceCoreEvents;

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

  global.TasuVoiceCore = {
    VERSION: "phase1-mock",
    EVENT,
    ADAPTER_KIND,
    startSession,
    createSession,
    resolveAdapter,
    registerAdapter,
    listAdapters,
  };
})(typeof window !== "undefined" ? window : globalThis);
