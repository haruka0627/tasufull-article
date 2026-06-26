/**
 * AI運営秘書 — Voice Core 接続（テキストチャット非破壊）
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
      void global.TasuAiVoiceCore?.playVoice?.(text, { surface: SURFACE, lang: "ja-JP" });
    });
  }

  function mountSecretaryVoice() {
    const Voice = global.TasuAiVoiceCore;
    if (!Voice?.mountToolbar) return;
    bindAssistantReply();
    Voice.initSurface(SURFACE);
    document.querySelectorAll("[data-ops-phase2-chat-form]").forEach((form) => {
      const input =
        form.querySelector("[data-ops-secretary-input]") ||
        form.querySelector("[data-ops-phase2-chat-input]");
      if (!input) return;
      Voice.mountToolbar({
        formEl: form,
        inputEl: input,
        surface: SURFACE,
        insertBefore: "form",
      });
    });
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
