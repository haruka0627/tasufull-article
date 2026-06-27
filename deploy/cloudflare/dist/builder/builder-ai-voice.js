/**
 * Builder AI — Voice adapter（Integration Layer 委譲 · 後方互換）
 */
(function (global) {
  "use strict";

  const SURFACE = "builder_ai";

  function bindAssistantReply() {
    if (global.__tasuBuilderAiVoiceReplyBound) return;
    global.__tasuBuilderAiVoiceReplyBound = true;
    global.addEventListener("tasu:ai-voice-assistant-reply", (event) => {
      if (event.detail?.surface !== SURFACE) return;
      const text = String(event.detail?.text || "").trim();
      if (!text) return;
      void global.TasuBuilderVoiceIntegration?.notifyAssistantReply?.(text);
    });
  }

  function notifyAssistantReply(text) {
    const payload = String(text || "").trim();
    if (!payload) return;
    global.dispatchEvent(
      new CustomEvent("tasu:ai-voice-assistant-reply", {
        detail: { surface: SURFACE, text: payload },
      })
    );
  }

  function mountComposerVoice(options) {
    bindAssistantReply();
    const Voice = global.TasuAiVoiceCore;
    if (!Voice?.mountToolbar) return null;

    Voice.initSurface(SURFACE);
    const inputEl = options?.inputEl;
    const composer = inputEl?.closest(".builder-ai-ui-composer");
    const hostEl = options?.hostEl || composer;
    if (!inputEl || !hostEl) return null;

    const formEl = options?.formEl || document.createElement("form");
    if (!options?.formEl) {
      formEl.className = "builder-ai-voice__form";
      formEl.addEventListener("submit", (e) => e.preventDefault());
      hostEl.insertBefore(formEl, hostEl.firstChild);
    }

    const wrap = Voice.mountToolbar({
      formEl,
      inputEl,
      surface: SURFACE,
      hostEl,
      insertBefore: "form",
      lang: "ja-JP",
    });

    if (typeof options?.onTranscript === "function" && wrap) {
      const micBtn = wrap.querySelector("[data-tasu-voice-mic]");
      micBtn?.addEventListener(
        "click",
        () => {
          setTimeout(async () => {
            const text = String(inputEl.value || "").trim();
            if (text) await options.onTranscript(text);
          }, 300);
        },
        { capture: false }
      );
    }

    return wrap;
  }

  async function quickVoiceCapture(options) {
    return global.TasuBuilderVoiceIntegration?.submitVoiceCapture?.() || { ok: false, error: "integration_missing" };
  }

  function stopVoice() {
    global.TasuBuilderVoiceIntegration?.stopVoiceOutput?.();
  }

  global.TasuBuilderAIVoice = {
    SURFACE,
    mountComposerVoice,
    quickVoiceCapture,
    notifyAssistantReply,
    stopVoice,
    bindAssistantReply,
  };
})(typeof window !== "undefined" ? window : globalThis);
