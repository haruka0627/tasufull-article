/**
 * Voice Core — OpenAI Realtime wire client boundary (injectable transport · no built-in socket)
 * Phase 5-A: policy + transport injection only. Native socket transport is Phase 5-B.
 */
(function (global) {
  "use strict";

  const { normalizeOpenAiServerEvent, emitMappedWireEvent } = global.TasuVoiceCoreRealtimeEventMapper;
  const { createRealtimeConfig } = global.TasuVoiceCoreRealtimeConfig;

  function createNoopTransport() {
    return {
      id: "noop",
      async connect() {
        return { ok: false, code: "transport_not_configured", message: "no wire transport injected" };
      },
      sendText() {
        return { ok: false, code: "transport_not_configured" };
      },
      sendAudio() {
        return { ok: false, code: "transport_not_configured" };
      },
      async close() {
        return { ok: true };
      },
    };
  }

  /**
   * @param {object} params
   * @param {object} params.policy
   * @param {object} [params.config]
   * @param {object} [params.transport]
   * @param {(event: object) => void} params.emit
   * @param {object} [params.ctx]
   */
  function createWireClient(params) {
    const policy = params.policy;
    const config = params.config || createRealtimeConfig();
    const emit = params.emit;
    const ctx = params.ctx || {};
    let transport = params.transport || null;
    let active = false;
    let sessionId = null;

    function handleRawServerEvent(raw) {
      const wireEvent = normalizeOpenAiServerEvent(raw);
      if (!wireEvent) return null;
      return emitMappedWireEvent(emit, wireEvent, ctx);
    }

    return {
      get sessionId() {
        return sessionId;
      },
      get active() {
        return active;
      },

      /**
       * @param {object} [connectCtx]
       */
      async connect(connectCtx = {}) {
        if (!policy?.allowLive) {
          return { ok: false, code: "live_disabled", reason: policy?.reason || "live_disabled" };
        }

        const endpoint = config.getEndpoint(connectCtx);
        const credential = await config.getSessionCredential(connectCtx);
        const model = config.getModel(connectCtx) || connectCtx.model || "";
        const sessionOptions = config.getSessionOptions(connectCtx);

        if (!endpoint || !credential?.value) {
          return { ok: false, code: "live_not_configured", message: "endpoint or session credential missing" };
        }

        const t = transport || createNoopTransport();
        const result = await t.connect({
          endpoint,
          credential,
          model,
          sessionOptions,
          surface: connectCtx.surface,
          onServerEvent: handleRawServerEvent,
        });

        if (!result?.ok) {
          return {
            ok: false,
            code: result?.code || "connect_failed",
            message: result?.message || "wire connect failed",
          };
        }

        transport = t;
        active = true;
        sessionId = result.sessionId || connectCtx.sessionId || null;
        return { ok: true, sessionId, transportId: t.id || "unknown" };
      },

      sendText(text) {
        if (!active || !transport?.sendText) {
          return { ok: false, code: "not_connected" };
        }
        return transport.sendText(text);
      },

      sendAudio(chunk) {
        if (!active || !transport?.sendAudio) {
          return { ok: false, code: "not_connected" };
        }
        return transport.sendAudio(chunk);
      },

      async close(reason) {
        if (!transport) return { ok: true };
        try {
          await transport.close(reason);
        } finally {
          active = false;
          sessionId = null;
          transport = null;
        }
        return { ok: true };
      },
    };
  }

  global.TasuVoiceCoreOpenAiRealtimeWireClient = {
    createNoopTransport,
    createWireClient,
  };
})(typeof window !== "undefined" ? window : globalThis);
