/**
 * TASFUL AI Workspace — Voice Core 接続準備（composer への最小 UI 追加）
 */
(function (global) {
  "use strict";

  const SURFACE = "tasful_ai";

  function bindAssistantReply() {
    if (global.__tasuWorkspaceVoiceReplyBound) return;
    global.__tasuWorkspaceVoiceReplyBound = true;
    global.addEventListener("tasu:ai-voice-assistant-reply", (event) => {
      if (event.detail?.surface !== SURFACE) return;
      const text = String(event.detail?.text || "").trim();
      if (!text) return;
      void global.TasuAiVoiceCore?.playVoice?.(text, { surface: SURFACE, lang: "ja-JP" });
    });
  }

  function mountWorkspaceVoice() {
    const Voice = global.TasuAiVoiceCore;
    if (!Voice?.mountToolbar) return;
    bindAssistantReply();
    Voice.initSurface(SURFACE);

    const frame = document.querySelector("[data-ai-composer-frame]");
    const input = document.querySelector("[data-ai-chat-input]");
    const sendBtn = document.querySelector("[data-ai-chat-send]");
    if (!frame || !input) return;

    const actionsRow = frame.querySelector(".input-actions-row");
    const toolbarHost = actionsRow || frame;
    const fakeForm = document.createElement("form");
    fakeForm.className = "tasful-ai-voice__workspace-form";
    if (fakeForm.dataset.tasuVoiceToolbar === "1") return;
    fakeForm.addEventListener("submit", (e) => e.preventDefault());
    toolbarHost.parentElement?.insertBefore(fakeForm, toolbarHost);

    Voice.mountToolbar({
      formEl: fakeForm,
      inputEl: input,
      surface: SURFACE,
      hostEl: toolbarHost.parentElement,
      insertBefore: "form",
    });

    sendBtn?.addEventListener("click", () => Voice.stopVoice?.(), true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountWorkspaceVoice);
  } else {
    mountWorkspaceVoice();
  }

  global.TasuAiWorkspaceVoice = {
    mountWorkspaceVoice,
    SURFACE,
  };
})(typeof window !== "undefined" ? window : globalThis);
