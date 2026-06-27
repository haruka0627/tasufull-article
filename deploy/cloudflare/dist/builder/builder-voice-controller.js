/**
 * Builder — Voice Controller（Voice Core ラッパー · mock デフォルト · live opt-in · surface: builder_ai）
 */
(function (global) {
  "use strict";

  const LIVE_FLAG_CORE = "__TASU_VOICE_CORE_OPENAI_LIVE__";
  const LIVE_FLAG_SURFACE = "__TASU_VOICE_LIVE_BUILDER_AI__";

  const VOICE_STATE = Object.freeze({
    READY: "ready",
    LISTENING: "listening",
    THINKING: "thinking",
    SPEAKING: "speaking",
    ERROR: "error",
  });

  const DEFAULTS = Object.freeze({
    surface: "builder_ai",
    provider: "openai_realtime",
    kind: "live",
    mockCompatible: true,
    useWebSocketTransport: false,
    sessionTimeoutMs: 120000,
    reconnectDelayMs: 400,
    maxReconnectAttempts: 3,
  });

  let config = { ...DEFAULTS };
  let state = VOICE_STATE.READY;
  let stateDetail = "";
  let voiceSession = null;
  let sessionStartedAt = 0;
  let lastActivityAt = 0;
  let timeoutTimer = null;
  let reconnectAttempts = 0;
  let stateListeners = new Set();
  let pendingTranscript = "";

  function getVoiceCore() {
    return global.TasuVoiceCore || null;
  }

  function getBrowserStt() {
    return global.TasuAiVoiceCore || null;
  }

  function getSessionClient() {
    return global.TasuVoiceRealtimeSessionClient || null;
  }

  function isLiveOptInEnabled() {
    try {
      return global[LIVE_FLAG_CORE] === true && global[LIVE_FLAG_SURFACE] === true;
    } catch {
      return false;
    }
  }

  function applyMockFallbackConfig() {
    config = { ...config, mockCompatible: true, useWebSocketTransport: false };
    getSessionClient()?.clear?.();
  }

  async function ensureLiveInjectors() {
    if (!isLiveOptInEnabled()) {
      return { ok: true, mode: "mock", skipped: true };
    }
    const client = getSessionClient();
    if (!client?.refresh) {
      return { ok: false, error: "session_client_missing", mode: "mock" };
    }
    try {
      const result = await client.refresh({ surface: config.surface || DEFAULTS.surface });
      if (!result?.ok) {
        client.clear?.();
        return {
          ok: false,
          error: String(result?.error || "live_refresh_failed"),
          mode: "mock",
        };
      }
      return { ok: true, mode: "live" };
    } catch (err) {
      client.clear?.();
      return {
        ok: false,
        error: err instanceof Error ? err.message : "live_refresh_failed",
        mode: "mock",
      };
    }
  }

  async function resolveVoiceSessionMode() {
    if (!isLiveOptInEnabled()) {
      applyMockFallbackConfig();
      return {
        mode: "mock",
        mockCompatible: true,
        useWebSocketTransport: false,
      };
    }

    const liveResult = await ensureLiveInjectors();
    if (!liveResult.ok) {
      applyMockFallbackConfig();
      return {
        mode: "mock",
        mockCompatible: true,
        useWebSocketTransport: false,
        fallback: true,
        fallbackReason: liveResult.error,
      };
    }

    config = { ...config, mockCompatible: false, useWebSocketTransport: true };
    return {
      mode: "live",
      mockCompatible: false,
      useWebSocketTransport: true,
    };
  }

  function emitState(next, detail) {
    state = next;
    stateDetail = detail || "";
    const payload = { state, detail: stateDetail, at: Date.now() };
    stateListeners.forEach((fn) => {
      try {
        fn(payload);
      } catch {
        /* ignore */
      }
    });
    return payload;
  }

  function onStateChange(fn) {
    if (typeof fn !== "function") return () => {};
    stateListeners.add(fn);
    return () => stateListeners.delete(fn);
  }

  function getState() {
    return { state, detail: stateDetail, sessionId: voiceSession?.id || null, reconnectAttempts };
  }

  function clearSessionTimeout() {
    if (timeoutTimer) {
      clearTimeout(timeoutTimer);
      timeoutTimer = null;
    }
  }

  function armSessionTimeout() {
    clearSessionTimeout();
    const ms = Number(config.sessionTimeoutMs) || DEFAULTS.sessionTimeoutMs;
    timeoutTimer = setTimeout(() => {
      handleSessionTimeout();
    }, ms);
  }

  function touchActivity() {
    lastActivityAt = Date.now();
    armSessionTimeout();
  }

  function bindSessionEvents(session) {
    session.receiveEvent((ev) => {
      if (ev?.type === "text_delta" && ev.text) {
        pendingTranscript = String(ev.text).replace(/^rt-mock:\s*/i, "").trim();
      }
      if (ev?.type === "error" || ev?.type === "error_mock") {
        emitState(VOICE_STATE.ERROR, ev.message || ev.code || "voice_error");
      }
    });
  }

  function sessionStartOptions(overrides) {
    const extra = overrides && typeof overrides === "object" ? overrides : {};
    const { _liveFallbackRetry, ...rest } = extra;
    return {
      surface: config.surface,
      provider: config.provider,
      kind: config.kind,
      mockCompatible: config.mockCompatible !== false,
      useWebSocketTransport: config.useWebSocketTransport === true,
      ...rest,
    };
  }

  function init(options) {
    options = options || {};
    config = { ...DEFAULTS, ...options, useWebSocketTransport: false, mockCompatible: true };
    const Core = getVoiceCore();
    if (!Core?.createSession) {
      emitState(VOICE_STATE.ERROR, "Voice Core not loaded");
      return { ok: false, error: "voice_core_missing" };
    }
    emitState(VOICE_STATE.READY, "initialized");
    return { ok: true, version: Core.VERSION || "unknown" };
  }

  async function startSession(overrides) {
    overrides = overrides || {};
    const isRetry = overrides._liveFallbackRetry === true;
    if (!isRetry) {
      await resolveVoiceSessionMode();
    } else {
      applyMockFallbackConfig();
    }

    const Core = getVoiceCore();
    if (!Core?.createSession) {
      emitState(VOICE_STATE.ERROR, "Voice Core not loaded");
      return { ok: false, error: "voice_core_missing" };
    }

    if (voiceSession?.id) {
      return {
        ok: true,
        sessionId: voiceSession.id,
        reused: true,
        mode: config.mockCompatible === false ? "live" : "mock",
      };
    }

    pendingTranscript = "";
    const opts = sessionStartOptions(overrides);
    voiceSession = Core.createSession(opts);
    bindSessionEvents(voiceSession);
    const started = voiceSession.startSession(opts);
    if (!started?.ok && started?.error) {
      if (!isRetry && config.mockCompatible === false) {
        voiceSession.stopSession?.();
        voiceSession = null;
        return startSession({ ...overrides, _liveFallbackRetry: true });
      }
      emitState(VOICE_STATE.ERROR, started.error.message || "session_start_failed");
      voiceSession = null;
      return { ok: false, error: "session_start_failed" };
    }

    sessionStartedAt = Date.now();
    touchActivity();
    reconnectAttempts = 0;
    const modeLabel = config.mockCompatible === false ? "session_active_live" : "session_active";
    emitState(VOICE_STATE.READY, modeLabel);
    return {
      ok: true,
      sessionId: voiceSession.id,
      provider: config.provider,
      mode: config.mockCompatible === false ? "live" : "mock",
    };
  }

  function stopSession(reason) {
    clearSessionTimeout();
    pendingTranscript = "";
    if (!voiceSession) {
      emitState(VOICE_STATE.READY, reason || "idle");
      return { ok: true, reason: "no_session" };
    }
    voiceSession.stopSession();
    voiceSession = null;
    sessionStartedAt = 0;
    emitState(VOICE_STATE.READY, reason || "stopped");
    return { ok: true, reason: reason || "stopped" };
  }

  async function reconnectSession() {
    if (reconnectAttempts >= (config.maxReconnectAttempts || DEFAULTS.maxReconnectAttempts)) {
      emitState(VOICE_STATE.ERROR, "reconnect_limit");
      return { ok: false, error: "reconnect_limit" };
    }
    reconnectAttempts += 1;
    stopSession("reconnecting");
    await new Promise((r) => setTimeout(r, config.reconnectDelayMs || DEFAULTS.reconnectDelayMs));
    return startSession();
  }

  function handleSessionTimeout() {
    stopSession("timeout");
    emitState(VOICE_STATE.READY, "session_timeout");
    return { ok: true, reason: "timeout" };
  }

  async function captureVoiceInput() {
    const started = await startSession();
    if (!started.ok && started.error !== "session_start_failed") {
      return { ok: false, error: started.error || "session_unavailable" };
    }
    if (!started.ok) {
      return { ok: false, error: "session_start_failed" };
    }

    emitState(VOICE_STATE.LISTENING, "capture");
    touchActivity();

    const Gate = global.TasuBuilderAILiveGate;
    if (Gate && !Gate.canUse("voice_input")) {
      emitState(VOICE_STATE.ERROR, Gate.getUpgradeMessage("voice_input"));
      return { ok: false, error: Gate.getUpgradeMessage("voice_input") };
    }

    let text = "";
    const Stt = getBrowserStt();
    if (Stt?.speechToText) {
      try {
        Stt.setVoiceEnabled?.(true, config.surface);
        Stt.stopVoice?.();
        const out = await Stt.speechToText({ lang: "ja-JP" });
        text = String(out?.text || "").trim();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        emitState(VOICE_STATE.ERROR, msg);
        return { ok: false, error: msg };
      }
    }

    if (!text) {
      voiceSession.sendAudio(new Uint8Array([1, 2, 3, 4]));
      voiceSession.sendText("builder voice mock");
      text = pendingTranscript || "builder voice mock";
    } else if (voiceSession) {
      voiceSession.sendAudio(new Uint8Array([9, 9, 9]));
      voiceSession.sendText(text);
    }

    touchActivity();
    emitState(VOICE_STATE.THINKING, "captured");
    return {
      ok: true,
      text,
      sessionId: voiceSession?.id || null,
      mock: config.mockCompatible !== false,
      mode: config.mockCompatible === false ? "live" : "mock",
    };
  }

  function notifySpeaking(text) {
    emitState(VOICE_STATE.SPEAKING, "tts");
    touchActivity();
    const Stt = getBrowserStt();
    if (Stt?.playVoice) {
      return Stt.playVoice(String(text || ""), { surface: config.surface, lang: "ja-JP" }).finally(() => {
        emitState(VOICE_STATE.READY, "spoken");
      });
    }
    emitState(VOICE_STATE.READY, "spoken");
    return Promise.resolve({ ok: true, skipped: true });
  }

  function stopSpeaking() {
    getBrowserStt()?.stopVoice?.();
    if (state === VOICE_STATE.SPEAKING) emitState(VOICE_STATE.READY, "speaking_stopped");
  }

  global.TasuBuilderVoiceController = {
    VOICE_STATE,
    DEFAULTS,
    LIVE_FLAG_CORE,
    LIVE_FLAG_SURFACE,
    isLiveOptInEnabled,
    init,
    getState,
    onStateChange,
    startSession,
    stopSession,
    reconnectSession,
    handleSessionTimeout,
    captureVoiceInput,
    notifySpeaking,
    stopSpeaking,
  };
})(typeof window !== "undefined" ? window : globalThis);
