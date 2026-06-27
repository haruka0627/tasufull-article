/**
 * TASFUL AI Workspace — Voice Core 接続準備（composer への最小 UI 追加）
 */
(function (global) {
  "use strict";

  const SURFACE = "tasful_ai";
  let voiceIntegrationInitialized = false;

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

  function getChatRoot() {
    return document.querySelector("[data-ai-workspace-chat]");
  }

  function initVoiceIntegration(root) {
    if (voiceIntegrationInitialized) return;
    const Integration = global.TasuWorkspaceVoiceIntegration;
    const Chat = global.TasuAiChat;
    if (!Integration?.init || !Chat?.sendMessage) return;

    const chatRoot = root || getChatRoot();
    if (!chatRoot) return;

    Integration.init({
      surface: SURFACE,
      onSubmit: async (payload) => {
        const text = String(payload?.text || "").trim();
        if (!text) return;

        Integration.fillComposerInput?.(text);

        const searchTarget =
          payload?.options?.searchTarget ||
          global.TasuAiSearchTarget?.readTargetFromRoot?.(chatRoot) ||
          "tasful";

        await Chat.sendMessage(chatRoot, {
          userText: text,
          searchTarget,
          fromVoice: payload?.channel === "voice",
          ...(payload?.options || {}),
        });
      },
    });

    voiceIntegrationInitialized = true;
  }

  function isVoiceIntegrationReady() {
    return (
      voiceIntegrationInitialized &&
      typeof global.TasuWorkspaceVoiceIntegration?.submitVoiceCapture === "function"
    );
  }

  function bindLegacyMicCapture(wrap) {
    if (!wrap || wrap.dataset.tasuWorkspaceMicBound === "1") return;
    wrap.dataset.tasuWorkspaceMicBound = "1";

    const micBtn = wrap.querySelector("[data-tasu-voice-mic]");
    const errorEl = wrap.querySelector("[data-tasu-voice-error]");
    if (!micBtn) return;

    function showMicError(msg) {
      if (!errorEl) return;
      if (msg) {
        errorEl.textContent = msg;
        errorEl.hidden = false;
      } else {
        errorEl.textContent = "";
        errorEl.hidden = true;
      }
    }

    micBtn.addEventListener(
      "click",
      (event) => {
        if (!isVoiceIntegrationReady()) return;

        event.preventDefault();
        event.stopImmediatePropagation();
        showMicError(null);
        global.TasuWorkspaceVoiceIntegration.stopVoiceOutput?.();

        void global.TasuWorkspaceVoiceIntegration.submitVoiceCapture().then((out) => {
          if (!out?.ok && out?.error) {
            showMicError(String(out.error).slice(0, 120));
          }
        });
      },
      true
    );
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

    const wrap = Voice.mountToolbar({
      formEl: fakeForm,
      inputEl: input,
      surface: SURFACE,
      hostEl: toolbarHost.parentElement,
      insertBefore: "form",
    });

    bindLegacyMicCapture(wrap);

    sendBtn?.addEventListener("click", () => Voice.stopVoice?.(), true);
  }

  function bootstrap() {
    mountWorkspaceVoice();
    initVoiceIntegration(getChatRoot());
  }

  if (!global.__tasuWorkspaceVoiceIntegrationBound) {
    global.__tasuWorkspaceVoiceIntegrationBound = true;
    global.addEventListener("tasu:ai-chat-ready", (event) => {
      initVoiceIntegration(event.detail?.root || getChatRoot());
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }

  global.TasuAiWorkspaceVoice = {
    mountWorkspaceVoice,
    initVoiceIntegration,
    isVoiceIntegrationReady,
    SURFACE,
  };
})(typeof window !== "undefined" ? window : globalThis);
