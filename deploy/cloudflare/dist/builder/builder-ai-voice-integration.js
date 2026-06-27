/**
 * Builder AI — Voice Integration Layer（Text / Voice 共通 submit · Controller 委譲）
 * 将来: OpenAI Realtime · AI秘書 · TASFUL AI へ surface 差し替えで流用
 */
(function (global) {
  "use strict";

  const CHANNEL = Object.freeze({ TEXT: "text", VOICE: "voice" });

  let submitHandler = null;
  let initialized = false;

  function getController() {
    return global.TasuBuilderVoiceController;
  }

  function normalizePayload(payload) {
    const p = payload && typeof payload === "object" ? payload : {};
    const channel = p.channel === CHANNEL.VOICE ? CHANNEL.VOICE : CHANNEL.TEXT;
    const text = String(p.text ?? p.message ?? "").trim();
    return {
      channel,
      text,
      options: p.options && typeof p.options === "object" ? { ...p.options } : {},
      meta: p.meta && typeof p.meta === "object" ? { ...p.meta } : {},
    };
  }

  /**
   * @param {{ onSubmit: (payload: object) => void|Promise<void>, surface?: string, controllerOptions?: object }} options
   */
  function init(options) {
    options = options || {};
    if (typeof options.onSubmit !== "function") {
      return { ok: false, error: "onSubmit_required" };
    }
    submitHandler = options.onSubmit;
    const ctrl = getController();
    const initResult = ctrl?.init?.({
      surface: options.surface || "builder_ai",
      mockCompatible: true,
      useWebSocketTransport: false,
      ...(options.controllerOptions || {}),
    });
    initialized = Boolean(initResult?.ok);
    return initResult || { ok: false, error: "controller_missing" };
  }

  /**
   * Unified entry — text and voice must pass through here.
   * @param {{ channel?: 'text'|'voice', text?: string, options?: object }} payload
   */
  async function submit(payload) {
    const p = normalizePayload(payload);
    if (!submitHandler) {
      return { ok: false, error: "integration_not_initialized" };
    }
    if (!p.text) {
      return { ok: false, error: "empty_text" };
    }

    const ctrl = getController();
    await ctrl?.startSession?.();

    if (p.channel === CHANNEL.VOICE) {
      p.options.source = "voice";
      p.options.fromVoice = true;
    } else {
      p.options.source = p.options.source || "text";
    }

    await submitHandler({
      channel: p.channel,
      text: p.text,
      options: p.options,
      meta: p.meta,
    });

    return { ok: true, channel: p.channel };
  }

  async function submitVoiceCapture() {
    const ctrl = getController();
    if (!ctrl?.captureVoiceInput) {
      return { ok: false, error: "controller_missing" };
    }
    ctrl.stopSpeaking?.();
    const cap = await ctrl.captureVoiceInput();
    if (!cap.ok) {
      return cap;
    }
    return submit({ channel: CHANNEL.VOICE, text: cap.text, meta: { sessionId: cap.sessionId, mock: cap.mock } });
  }

  async function reconnectSession() {
    return getController()?.reconnectSession?.() || { ok: false, error: "controller_missing" };
  }

  function stopSession(reason) {
    return getController()?.stopSession?.(reason) || { ok: false };
  }

  function onVoiceStateChange(fn) {
    return getController()?.onStateChange?.(fn) || (() => {});
  }

  function getVoiceState() {
    return getController()?.getState?.() || { state: "ready", detail: "" };
  }

  function notifyAssistantReply(text) {
    return getController()?.notifySpeaking?.(text) || global.TasuBuilderAIVoice?.notifyAssistantReply?.(text);
  }

  function stopVoiceOutput() {
    getController()?.stopSpeaking?.();
    global.TasuBuilderAIVoice?.stopVoice?.();
  }

  global.TasuBuilderVoiceIntegration = {
    CHANNEL,
    init,
    submit,
    submitVoiceCapture,
    reconnectSession,
    stopSession,
    onVoiceStateChange,
    getVoiceState,
    notifyAssistantReply,
    stopVoiceOutput,
  };
})(typeof window !== "undefined" ? window : globalThis);
