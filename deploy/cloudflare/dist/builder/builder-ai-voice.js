/**
 * Builder AI — Voice adapter（TasuAiVoiceCore · surface: builder_ai）
 */
(function (global) {
  "use strict";

  const SURFACE = "builder_ai";

  function getVoice() {
    return global.TasuAiVoiceCore;
  }

  function bindAssistantReply() {
    if (global.__tasuBuilderAiVoiceReplyBound) return;
    global.__tasuBuilderAiVoiceReplyBound = true;
    global.addEventListener("tasu:ai-voice-assistant-reply", (event) => {
      if (event.detail?.surface !== SURFACE) return;
      const text = String(event.detail?.text || "").trim();
      if (!text) return;
      void getVoice()?.playVoice?.(text, { surface: SURFACE, lang: "ja-JP" });
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

  /**
   * @param {{
   *   formEl?: HTMLFormElement,
   *   inputEl?: HTMLTextAreaElement,
   *   hostEl?: HTMLElement,
   *   onTranscript?: (text: string) => void|Promise<void>,
   * }} options
   */
  function mountComposerVoice(options) {
    const Voice = getVoice();
    if (!Voice?.mountToolbar) return null;
    bindAssistantReply();
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

  /**
   * @param {{ onTranscript?: (text: string) => void|Promise<void> }} [options]
   */
  async function quickVoiceCapture(options) {
    const Voice = getVoice();
    const Gate = global.TasuBuilderAILiveGate;
    if (Gate && !Gate.canUse("voice_input")) {
      return { ok: false, error: Gate.getUpgradeMessage("voice_input") };
    }
    if (!Voice?.speechToText) {
      return { ok: false, error: "音声入力モジュールが読み込まれていません。" };
    }
    const sup = Voice.isVoiceSupported?.() || {};
    if (!sup.stt) {
      return { ok: false, error: "音声入力はこのブラウザでは利用できません。" };
    }

    Voice.setVoiceEnabled(true, SURFACE);
    Voice.stopVoice();

    try {
      const out = await Voice.speechToText({ lang: "ja-JP" });
      const text = String(out?.text || "").trim();
      if (!text) return { ok: false, error: "音声を認識できませんでした。もう一度お試しください。" };
      if (typeof options?.onTranscript === "function") await options.onTranscript(text);
      return { ok: true, text };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg };
    }
  }

  function stopVoice() {
    getVoice()?.stopVoice?.();
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
