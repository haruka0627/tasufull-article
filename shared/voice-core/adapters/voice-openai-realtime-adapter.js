/**
 * Voice Core — OpenAI Realtime adapter (mock-compatible default · live via injectable transport)
 * provider: openai_realtime · kind: live
 */
(function (global) {
  "use strict";

  const { EVENT, ADAPTER_KIND } = global.TasuVoiceCoreEvents;
  const { normalizeRealtimeOptions } = global.TasuVoiceCoreRealtimeOptions;
  const { WIRE_EVENT, emitMappedWireEvent } = global.TasuVoiceCoreRealtimeEventMapper;
  const { resolveConnectPolicy, getRuntimeInjectors } = global.TasuVoiceCoreRealtimeConnectPolicy;
  const { createRealtimeConfig } = global.TasuVoiceCoreRealtimeConfig;
  const { createWireClient } = global.TasuVoiceCoreOpenAiRealtimeWireClient;

  const CONNECTION_STATE = Object.freeze({
    IDLE: "idle",
    MOCK_ACTIVE: "mock_active",
    CONNECTING: "connecting",
    LIVE_ACTIVE: "live_active",
    DISCONNECTED: "disconnected",
  });

  const sessions = new Map();
  let sessionInjectors = null;
  let sessionTransport = null;

  function setSessionRuntime(injectors, transport) {
    sessionInjectors = injectors || null;
    sessionTransport = transport || null;
  }

  function getInjectors(options) {
    if (options?._voiceCoreInjectors) return options._voiceCoreInjectors;
    if (sessionInjectors) return sessionInjectors;
    return getRuntimeInjectors ? getRuntimeInjectors() : null;
  }

  function getTransport(options) {
    if (options?._voiceCoreTransport) return options._voiceCoreTransport;
    return sessionTransport || null;
  }

  function setConnectionState(sessionId, patch) {
    if (!sessionId) return;
    const prev = sessions.get(sessionId) || {};
    sessions.set(sessionId, { ...prev, ...patch, updatedAt: Date.now() });
  }

  function getConnectionState(sessionId) {
    return sessions.get(sessionId)?.state || CONNECTION_STATE.IDLE;
  }

  function createSessionId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function ctxFor(sessionId, options) {
    return {
      sessionId,
      surface: options.surface,
      provider: "openai_realtime",
      adapterId: openAiRealtimeAdapter.id,
      mockCompatible: options.mockCompatible !== false,
    };
  }

  function emitConnectError(emit, code, message) {
    const err = {
      type: EVENT.ERROR_MOCK,
      code,
      message,
    };
    emit(err);
    return err;
  }

  function startMockSession(opts, emit) {
    const sessionId = createSessionId("oai-rt-mock");
    setConnectionState(sessionId, {
      state: CONNECTION_STATE.MOCK_ACTIVE,
      surface: opts.surface,
      mode: "mock",
    });

    emitMappedWireEvent(
      emit,
      { type: WIRE_EVENT.SESSION_CREATED, session: { id: sessionId } },
      ctxFor(sessionId, opts)
    );

    return { sessionId, connectionState: CONNECTION_STATE.MOCK_ACTIVE, mode: "mock" };
  }

  function startLiveSession(opts, emit, policy) {
    const sessionId = createSessionId("oai-rt-live");
    const injectors = getInjectors(opts);
    const transport = getTransport(opts);
    const config = createRealtimeConfig(injectors);
    const ctx = ctxFor(sessionId, { ...opts, mockCompatible: false });

    const wireClient = createWireClient({
      policy,
      config,
      transport,
      emit,
      ctx,
    });

    setConnectionState(sessionId, {
      state: CONNECTION_STATE.CONNECTING,
      surface: opts.surface,
      mode: "live",
      wireClient,
    });

    wireClient
      .connect({ ...opts, sessionId })
      .then((result) => {
        const rec = sessions.get(sessionId);
        if (!rec) return;

        if (!result.ok) {
          emitConnectError(emit, result.code || "connect_failed", result.message || "live connect failed");
          setConnectionState(sessionId, { state: CONNECTION_STATE.DISCONNECTED, lastError: result.code });
          return;
        }

        setConnectionState(sessionId, {
          state: CONNECTION_STATE.LIVE_ACTIVE,
          wireClient,
          transportId: result.transportId,
        });
      })
      .catch((err) => {
        emitConnectError(emit, "connect_exception", String(err?.message || err));
        setConnectionState(sessionId, { state: CONNECTION_STATE.DISCONNECTED, lastError: "connect_exception" });
      });

    return { sessionId, connectionState: CONNECTION_STATE.CONNECTING, mode: "live", pendingLive: true };
  }

  const openAiRealtimeAdapter = {
    id: "openai-realtime-skeleton",
    kind: ADAPTER_KIND.LIVE,

    /**
     * @param {object} options
     * @param {(event: object) => void} emit
     */
    startSession(options, emit) {
      const opts = normalizeRealtimeOptions({ ...options, provider: "openai_realtime", kind: "live" });
      const injectors = getInjectors(options);
      const policy = resolveConnectPolicy(opts, injectors);

      if (policy.mode === "mock") {
        if (!policy.mockCompatible && !policy.liveFlag) {
          const err = emitConnectError(
            emit,
            "live_disabled",
            "OpenAI Realtime live connect disabled (feature flag off)"
          );
          return { sessionId: null, error: err, policy };
        }
        return startMockSession(opts, emit);
      }

      return startLiveSession(opts, emit, policy);
    },

    sendAudio(sessionId, chunk) {
      const rec = sessions.get(sessionId);
      const state = rec?.state || CONNECTION_STATE.IDLE;

      if (state === CONNECTION_STATE.LIVE_ACTIVE && rec?.wireClient) {
        const sent = rec.wireClient.sendAudio(chunk);
        if (!sent?.ok) {
          return {
            type: EVENT.ERROR_MOCK,
            code: sent?.code || "send_failed",
            message: "live audio send failed",
            sessionId,
          };
        }
        return { type: "audio_sent", sessionId, mode: "live", ts: Date.now() };
      }

      if (state !== CONNECTION_STATE.MOCK_ACTIVE) {
        return {
          type: EVENT.ERROR_MOCK,
          code: "not_active",
          message: "session not active",
        };
      }

      const size = chunk?.byteLength ?? chunk?.length ?? 0;
      const ctx = {
        sessionId,
        provider: "openai_realtime",
        adapterId: openAiRealtimeAdapter.id,
        mockCompatible: true,
        surface: rec?.surface || "default",
      };

      return {
        type: EVENT.AUDIO_DELTA_MOCK,
        sessionId,
        audio: {
          format: "mock_pcm16",
          sampleRate: 16000,
          bytes: Array.from(new TextEncoder().encode(`rt-mock-audio-${size}`)),
          durationMs: 120,
        },
        transcriptHint: size > 0 ? "mock-compatible audio input" : "empty audio chunk",
        wireType: WIRE_EVENT.RESPONSE_AUDIO_DELTA,
        ts: Date.now(),
        _mappedFrom: WIRE_EVENT.RESPONSE_AUDIO_DELTA,
        _ctx: ctx,
      };
    },

    sendText(sessionId, text) {
      const rec = sessions.get(sessionId);
      const state = rec?.state || CONNECTION_STATE.IDLE;

      if (state === CONNECTION_STATE.LIVE_ACTIVE && rec?.wireClient) {
        const sent = rec.wireClient.sendText(text);
        if (!sent?.ok) {
          return {
            type: EVENT.ERROR_MOCK,
            code: sent?.code || "send_failed",
            message: "live text send failed",
            sessionId,
          };
        }
        return { type: "text_sent", sessionId, mode: "live", ts: Date.now() };
      }

      if (state !== CONNECTION_STATE.MOCK_ACTIVE) {
        return {
          type: EVENT.ERROR_MOCK,
          code: "not_active",
          message: "session not active",
        };
      }

      const payload = String(text || "").trim();
      if (!payload) {
        return {
          type: EVENT.ERROR_MOCK,
          code: "empty_text",
          message: "text is empty",
        };
      }

      const ctx = {
        sessionId,
        provider: "openai_realtime",
        adapterId: openAiRealtimeAdapter.id,
        mockCompatible: true,
      };

      return {
        type: EVENT.TEXT_DELTA,
        sessionId,
        text: `rt-mock: ${payload}`,
        final: true,
        wireType: WIRE_EVENT.RESPONSE_TEXT_DELTA,
        ts: Date.now(),
        _mappedFrom: WIRE_EVENT.RESPONSE_TEXT_DELTA,
        _ctx: ctx,
      };
    },

    stopSession(sessionId) {
      if (!sessionId) {
        return {
          type: EVENT.ERROR_MOCK,
          code: "no_session",
          message: "session id missing",
        };
      }

      const rec = sessions.get(sessionId);
      if (rec?.wireClient) {
        rec.wireClient.close("user_stop");
      }

      setConnectionState(sessionId, { state: CONNECTION_STATE.DISCONNECTED });
      sessions.delete(sessionId);

      return {
        type: EVENT.SESSION_STOPPED,
        sessionId,
        reason: "user_stop",
        wireType: WIRE_EVENT.SESSION_CLOSED,
        ts: Date.now(),
        _mappedFrom: WIRE_EVENT.SESSION_CLOSED,
      };
    },

    getConnectionState,
    CONNECTION_STATE,
    setSessionRuntime,
  };

  global.TasuVoiceCoreOpenAiRealtimeAdapter = openAiRealtimeAdapter;
})(typeof window !== "undefined" ? window : globalThis);
