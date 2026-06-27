/**
 * AI 秘書 — Voice Integration（Text / Voice 共通 submit · Operations Engine 経由）
 */
(function (global) {
  "use strict";

  const CHANNEL = Object.freeze({ TEXT: "text", VOICE: "voice" });

  let submitHandler = null;

  function getController() {
    return global.TasuSecretaryVoiceController;
  }

  function getOperationsEngine() {
    return global.TasuSecretaryOperationsEngine;
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

  async function runOperationsIntelligence(text, channel) {
    const Engine = getOperationsEngine();
    if (!Engine?.runAnalysis) {
      return { ok: false, skipped: true, reason: "operations_engine_missing" };
    }
    return Engine.runAnalysis({
      ctx: { userText: text, channel, source: "secretary_voice_integration" },
    });
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
    return (
      ctrl?.init?.({
        surface: options.surface || "ops_secretary",
        mockCompatible: true,
        useWebSocketTransport: false,
        ...(options.controllerOptions || {}),
      }) || { ok: false, error: "controller_missing" }
    );
  }

  /**
   * Unified entry — always runs Operations Intelligence Engine first.
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
    ctrl?.startSession?.();

    if (p.channel === CHANNEL.VOICE) {
      p.options.source = "voice";
      p.options.fromVoice = true;
    } else {
      p.options.source = p.options.source || "text";
    }

    const opsAnalysis = await runOperationsIntelligence(p.text, p.channel);

    await submitHandler({
      channel: p.channel,
      text: p.text,
      options: p.options,
      meta: { ...p.meta, opsAnalysis },
    });

    return { ok: true, channel: p.channel, opsAnalysisOk: Boolean(opsAnalysis?.ok) };
  }

  async function submitVoiceCapture() {
    const ctrl = getController();
    if (!ctrl?.captureVoiceInput) {
      return { ok: false, error: "controller_missing" };
    }
    ctrl.stopSpeaking?.();
    const cap = await ctrl.captureVoiceInput();
    if (!cap.ok) return cap;
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
    return getController()?.notifySpeaking?.(text);
  }

  function stopVoiceOutput() {
    getController()?.stopSpeaking?.();
    global.TasuAiVoiceCore?.stopVoice?.();
  }

  global.TasuSecretaryVoiceIntegration = {
    CHANNEL,
    init,
    submit,
    submitVoiceCapture,
    runOperationsIntelligence,
    reconnectSession,
    stopSession,
    onVoiceStateChange,
    getVoiceState,
    notifyAssistantReply,
    stopVoiceOutput,
  };
})(typeof window !== "undefined" ? window : globalThis);
