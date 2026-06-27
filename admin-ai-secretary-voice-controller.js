/**
 * AI 秘書 — Voice Controller（Voice Core ラッパー · Mock のみ · surface 差し替え可能）
 */
(function (global) {
  "use strict";

  const VOICE_STATE = Object.freeze({
    READY: "ready",
    LISTENING: "listening",
    THINKING: "thinking",
    SPEAKING: "speaking",
    ERROR: "error",
  });

  const DEFAULTS = Object.freeze({
    surface: "ops_secretary",
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
    timeoutTimer = setTimeout(handleSessionTimeout, ms);
  }

  function touchActivity() {
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
    return {
      surface: config.surface,
      provider: config.provider,
      kind: config.kind,
      mockCompatible: config.mockCompatible !== false,
      useWebSocketTransport: false,
      ...overrides,
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

  function startSession(overrides) {
    const Core = getVoiceCore();
    if (!Core?.createSession) {
      emitState(VOICE_STATE.ERROR, "Voice Core not loaded");
      return { ok: false, error: "voice_core_missing" };
    }
    if (voiceSession?.id) {
      return { ok: true, sessionId: voiceSession.id, reused: true };
    }

    pendingTranscript = "";
    voiceSession = Core.createSession(sessionStartOptions(overrides));
    bindSessionEvents(voiceSession);
    voiceSession.startSession(sessionStartOptions(overrides));

    touchActivity();
    reconnectAttempts = 0;
    emitState(VOICE_STATE.READY, "session_active");
    return { ok: true, sessionId: voiceSession.id, provider: config.provider };
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
    const started = startSession();
    if (!started.ok) {
      return { ok: false, error: started.error || "session_start_failed" };
    }

    emitState(VOICE_STATE.LISTENING, "capture");
    touchActivity();

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
      voiceSession.sendText("secretary voice mock");
      text = pendingTranscript || "secretary voice mock";
    } else if (voiceSession) {
      voiceSession.sendAudio(new Uint8Array([5, 6, 7]));
      voiceSession.sendText(text);
    }

    touchActivity();
    emitState(VOICE_STATE.THINKING, "captured");
    return { ok: true, text, sessionId: voiceSession?.id || null, mock: !Stt?.speechToText };
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

  global.TasuSecretaryVoiceController = {
    VOICE_STATE,
    DEFAULTS,
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
