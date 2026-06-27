/**
 * TASFUL AI Workspace — Voice Core 接続準備（composer への最小 UI 追加）
 */
(function (global) {
  "use strict";

  const SURFACE = "tasful_ai";
  let voiceIntegrationInitialized = false;
  let voiceStateBound = false;
  let composerVoiceBound = false;

  const VOICE_STATE_LABELS = Object.freeze({
    ready: "Ready",
    listening: "聞取中",
    thinking: "処理中",
    speaking: "読み上げ",
    error: "エラー",
  });

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

  function isVoiceIntegrationReady() {
    return (
      voiceIntegrationInitialized &&
      typeof global.TasuWorkspaceVoiceIntegration?.submitVoiceCapture === "function"
    );
  }

  function runVoiceCapture(showError) {
    if (!isVoiceIntegrationReady()) {
      return Promise.resolve({ ok: false, error: "integration_not_ready" });
    }
    global.TasuWorkspaceVoiceIntegration.stopVoiceOutput?.();
    return global.TasuWorkspaceVoiceIntegration.submitVoiceCapture().then((out) => {
      if (!out?.ok && out?.error && typeof showError === "function") {
        showError(String(out.error).slice(0, 120));
      }
      return out;
    });
  }

  function renderComposerVoiceState(payload) {
    const stateEl = document.querySelector("[data-tasu-workspace-voice-state]");
    const btn = document.querySelector("[data-tasu-workspace-voice-composer-btn]");
    const state = payload?.state || "ready";
    const label = VOICE_STATE_LABELS[state] || VOICE_STATE_LABELS.ready;
    const text = payload?.detail ? `${label} — ${payload.detail}` : label;

    if (stateEl) {
      stateEl.textContent = text;
      stateEl.className = "tasful-ai-voice-composer__state";
      stateEl.dataset.state = state;
      if (state !== "ready") stateEl.classList.add(`tasful-ai-voice-composer__state--${state}`);
    }

    if (btn) {
      btn.setAttribute("aria-pressed", state === "listening" ? "true" : "false");
      btn.classList.toggle("is-active", state === "listening");
      const sending = getChatRoot()?.dataset?.aiChatSending === "1";
      btn.disabled = Boolean(sending && state !== "listening");
    }
  }

  function bindComposerVoiceState() {
    if (voiceStateBound) return;
    const Integration = global.TasuWorkspaceVoiceIntegration;
    if (!Integration?.onVoiceStateChange) return;
    Integration.onVoiceStateChange(renderComposerVoiceState);
    renderComposerVoiceState(Integration.getVoiceState?.() || { state: "ready" });
    voiceStateBound = true;
  }

  function mountComposerVoiceControls() {
    if (composerVoiceBound) return;
    const actionsRight = document.querySelector("[data-ai-composer-frame] .input-actions-right");
    const sendBtn = document.querySelector("[data-ai-chat-send]");
    if (!actionsRight || !sendBtn) return;

    if (actionsRight.querySelector("[data-tasu-workspace-voice-composer]")) {
      composerVoiceBound = true;
      return;
    }

    const wrap = document.createElement("div");
    wrap.className = "tasful-ai-voice-composer";
    wrap.dataset.tasuWorkspaceVoiceComposer = "1";
    wrap.innerHTML =
      '<button type="button" class="tasful-ai-voice-composer__btn" data-tasu-workspace-voice-composer-btn aria-pressed="false" aria-label="音声入力">🎤 音声</button>' +
      '<span class="tasful-ai-voice-composer__state" data-tasu-workspace-voice-state aria-live="polite">Ready</span>';

    actionsRight.insertBefore(wrap, sendBtn);

    wrap.querySelector("[data-tasu-workspace-voice-composer-btn]")?.addEventListener("click", () => {
      void runVoiceCapture((msg) => {
        renderComposerVoiceState({ state: "error", detail: msg });
      });
    });

    composerVoiceBound = true;
    bindComposerVoiceState();
  }

  function initVoiceIntegration(root) {
    if (voiceIntegrationInitialized) {
      bindComposerVoiceState();
      return;
    }
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
    bindComposerVoiceState();
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
        void runVoiceCapture(showMicError);
      },
      true
    );
  }

  function hideLegacyToolbar(wrap) {
    if (!wrap) return;
    wrap.classList.add("tasful-ai-voice--legacy-hidden");
    wrap.setAttribute("aria-hidden", "true");
  }

  function mountWorkspaceVoice() {
    const Voice = global.TasuAiVoiceCore;
    if (!Voice?.mountToolbar) return;
    bindAssistantReply();
    Voice.initSurface(SURFACE);
    mountComposerVoiceControls();

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

    hideLegacyToolbar(wrap);
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
    mountComposerVoiceControls,
    initVoiceIntegration,
    isVoiceIntegrationReady,
    renderComposerVoiceState,
    SURFACE,
  };
})(typeof window !== "undefined" ? window : globalThis);
