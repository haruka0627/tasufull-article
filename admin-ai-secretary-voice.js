/**
 * AI運営秘書 — Voice Integration 補助（TTS 返答 · Phase2 UI 連携）
 */
(function (global) {
  "use strict";

  const SURFACE = "ops_secretary";

  function bindAssistantReply() {
    if (global.__tasuSecretaryVoiceReplyBound) return;
    global.__tasuSecretaryVoiceReplyBound = true;
    global.addEventListener("tasu:ai-voice-assistant-reply", (event) => {
      if (event.detail?.surface !== SURFACE) return;
      const text = String(event.detail?.text || "").trim();
      if (!text) return;
      const Integration = global.TasuSecretaryVoiceIntegration;
      if (Integration?.notifyAssistantReply) {
        void Integration.notifyAssistantReply(text);
        return;
      }
      void global.TasuAiVoiceCore?.playVoice?.(text, { surface: SURFACE, lang: "ja-JP" });
    });
  }

  function mountSecretaryVoice() {
    bindAssistantReply();
    global.TasuAiVoiceCore?.initSurface?.(SURFACE);
    global.TasuAdminAiSecretaryPhase2?.initVoiceIntegration?.();
    global.TasuAdminAiSecretaryPhase2?.bindVoiceButton?.();
  }

  function hookPhase2Render() {
    const phase2 = global.TasuAdminAiSecretaryPhase2;
    if (!phase2 || phase2.__voiceHooked) return;
    phase2.__voiceHooked = true;
    const orig = phase2.render;
    phase2.render = function renderWithVoice(ctx) {
      orig.call(this, ctx);
      mountSecretaryVoice();
    };
  }

  hookPhase2Render();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      mountSecretaryVoice();
    });
  } else {
    mountSecretaryVoice();
  }

  global.TasuAdminAiSecretaryVoice = {
    mountSecretaryVoice,
    SURFACE,
  };
})(typeof window !== "undefined" ? window : globalThis);
