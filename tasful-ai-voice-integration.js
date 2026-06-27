/**
 * TASFUL AI Workspace — Voice Integration（Text / Voice 共通 submit · Controller 委譲）
 * Commit 2: onSubmit 未接続時は submit を no-op · submitVoiceCapture は composer へ fill のみ
 */
(function (global) {
  "use strict";

  const CHANNEL = Object.freeze({ TEXT: "text", VOICE: "voice" });
  const SURFACE = "tasful_ai";

  let submitHandler = null;
  let controllerInitialized = false;

  function getController() {
    return global.TasuWorkspaceVoiceController;
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

  function fillComposerInput(text) {
    const input = document.querySelector("[data-ai-chat-input]");
    const payload = String(text || "").trim();
    if (!input || !payload) return { ok: false, error: "composer_input_missing" };
    if ("value" in input) input.value = payload;
    else input.textContent = payload;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus?.();
    return { ok: true, filled: true, text: payload };
  }

  function ensureController(options) {
    const ctrl = getController();
    if (controllerInitialized) {
      return ctrl ? { ok: true } : { ok: false, error: "controller_missing" };
    }
    const initResult = ctrl?.init?.({
      surface: SURFACE,
      mockCompatible: true,
      useWebSocketTransport: false,
      ...(options?.controllerOptions || {}),
    });
    controllerInitialized = Boolean(initResult?.ok);
    return initResult || { ok: false, error: "controller_missing" };
  }

  /**
   * @param {{ onSubmit?: (payload: object) => void|Promise<void>, surface?: string, controllerOptions?: object }} [options]
   */
  function init(options) {
    options = options || {};
    if (typeof options.onSubmit === "function") {
      submitHandler = options.onSubmit;
    }
    return ensureController(options);
  }

  async function submit(payload) {
    const p = normalizePayload(payload);
    if (!p.text) {
      return { ok: false, error: "empty_text" };
    }

    const boot = ensureController();
    if (!boot.ok) return boot;

    const ctrl = getController();
    ctrl?.startSession?.();

    if (p.channel === CHANNEL.VOICE) {
      p.options.source = "voice";
      p.options.fromVoice = true;
    } else {
      p.options.source = p.options.source || "text";
    }

    if (!submitHandler) {
      return { ok: false, error: "onSubmit_not_connected", skipped: true, channel: p.channel };
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
    const boot = ensureController();
    if (!boot.ok) return boot;

    const ctrl = getController();
    if (!ctrl?.captureVoiceInput) {
      return { ok: false, error: "controller_missing" };
    }

    ctrl.stopSpeaking?.();
    const cap = await ctrl.captureVoiceInput();
    if (!cap.ok) return cap;

    if (!submitHandler) {
      const filled = fillComposerInput(cap.text);
      return {
        ok: filled.ok,
        filled: filled.ok,
        text: cap.text,
        skippedSubmit: true,
        sessionId: cap.sessionId,
        mock: cap.mock,
        error: filled.ok ? undefined : filled.error,
      };
    }

    return submit({
      channel: CHANNEL.VOICE,
      text: cap.text,
      meta: { sessionId: cap.sessionId, mock: cap.mock },
    });
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

  function bootstrap() {
    ensureController();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }

  global.TasuWorkspaceVoiceIntegration = {
    CHANNEL,
    SURFACE,
    init,
    submit,
    submitVoiceCapture,
    reconnectSession,
    stopSession,
    onVoiceStateChange,
    getVoiceState,
    notifyAssistantReply,
    stopVoiceOutput,
    fillComposerInput,
  };
})(typeof window !== "undefined" ? window : globalThis);
