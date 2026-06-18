/**

 * AIキャラクター表示・音声読み上げ（Web Speech API）土台

 * ai-workspace / gen-ai-workspace 共通

 * 将来: Live2D / 口パク / 画像アップロード

 */

(function (global) {

  "use strict";



  const VOICE_STORAGE_KEY = "tasu_ai_voice_enabled";

  const DEFAULT_CHARACTER_SRC = "images/ai-character.webp";

  const DEFAULT_CHARACTER_FALLBACK = "images/ai-character.png";



  function isSpeechSupported() {

    return typeof global.speechSynthesis !== "undefined" && typeof SpeechSynthesisUtterance !== "undefined";

  }



  function isVoiceEnabled() {

    try {

      const stored = global.localStorage?.getItem(VOICE_STORAGE_KEY);

      if (stored === "0") return false;

      if (stored === "1") return true;

    } catch {

      /* ignore */

    }

    return true;

  }



  function setVoiceEnabled(enabled) {

    try {

      global.localStorage?.setItem(VOICE_STORAGE_KEY, enabled ? "1" : "0");

    } catch {

      /* ignore */

    }

    syncVoiceToggleUi();

  }



  function stripForSpeech(text) {

    return String(text || "")

      .replace(/<br\s*\/?>/gi, "\n")

      .replace(/<[^>]+>/g, "")

      .replace(/https?:\/\/\S+/g, "")

      .replace(/【[^】]+】/g, "")

      .replace(/\s+/g, " ")

      .trim()

      .slice(0, 800);

  }



  let activeUtterance = null;



  function cancelSpeech() {

    if (!isSpeechSupported()) return;

    try {

      global.speechSynthesis.cancel();

    } catch {

      /* ignore */

    }

    activeUtterance = null;

    setStageSpeaking(false);

  }



  function getStage() {

    return document.getElementById("character-stage") || document.querySelector("[data-ai-character-stage]");

  }



  function getPanel() {

    return (

      document.querySelector("[data-gen-ai-character-panel]") ||

      document.querySelector("[data-ai-concierge-panel]")

    );

  }



  function setStageSpeaking(speaking) {

    const on = Boolean(speaking);

    const stage = getStage();

    if (stage) stage.classList.toggle("is-speaking", on);

    if (global.document?.body) {
      if (on) global.document.body.setAttribute("data-ai-speaking", "true");
      else global.document.body.removeAttribute("data-ai-speaking");
    }

    if (global.TasuGenAiWorkspace?.setMouthSpeaking) {
      global.TasuGenAiWorkspace.setMouthSpeaking(on);
      return;
    }

  }



  function speak(text, options) {

    if (!isSpeechSupported() || !isVoiceEnabled()) return false;

    const mode = options?.mode;

    if (mode && mode.speechEnabled === false) return false;

    const activeCharacter =
      options?.activeCharacter ??
      global.TasuGenAiWorkspace?.getDisplayCharacter?.() ??
      global.TasuGenAiWorkspace?.getActiveCharacter?.() ??
      null;

    let plain = "";
    if (global.TasuGenAiWorkspace?.buildSpeechText) {
      plain = global.TasuGenAiWorkspace.buildSpeechText(text, activeCharacter);
    } else {
      plain = stripForSpeech(text);
    }

    if (!plain) return false;

    cancelSpeech();



    const utterance = new SpeechSynthesisUtterance(plain);

    utterance.lang = "ja-JP";

    utterance.rate = 1;

    utterance.pitch = 1;



    const voices = global.speechSynthesis.getVoices?.() || [];

    const jaVoice = voices.find((v) => /ja/i.test(v.lang));

    if (jaVoice) utterance.voice = jaVoice;



    utterance.onend = () => {

      activeUtterance = null;

      setStageSpeaking(false);

    };

    utterance.onerror = () => {

      activeUtterance = null;

      setStageSpeaking(false);

    };



    activeUtterance = utterance;

    setStageSpeaking(true);

    global.speechSynthesis.speak(utterance);

    return true;

  }



  function syncVoiceToggleUi() {

    document.querySelectorAll("[data-ai-voice-toggle]").forEach((toggle) => {

      toggle.checked = isVoiceEnabled();

    });

    document.querySelectorAll("[data-ai-voice-control]").forEach((control) => {

      control.classList.toggle("is-disabled", !isSpeechSupported());

    });

  }



  function resolveModeMeta(modeId) {

    if (global.TasuGenAiWorkspace?.getModeMeta) {

      return global.TasuGenAiWorkspace.getModeMeta(modeId);

    }

    if (global.TasuAiModes?.getMode) {

      const m = global.TasuAiModes.getMode(modeId);

      return {

        id: m.id,

        label: m.label,

        description: m.description,

        conciergePlaceholder: m.conciergePlaceholder || m.description,

        characterImage: m.characterImage,

        characterImageFallback: m.characterImageFallback,

        speechEnabled: m.speechEnabled !== false,

      };

    }

    return { id: modeId, label: modeId, speechEnabled: false };

  }



  function shouldShowStage(modeId) {

    if (global.TasuGenAiWorkspace?.shouldShowCharacterStage) {

      return global.TasuGenAiWorkspace.shouldShowCharacterStage(modeId);

    }

    return global.TasuAiModes?.isConciergeMode?.(modeId);

  }



  function shouldSpeakForMode(modeId) {

    if (global.TasuGenAiWorkspace?.shouldSpeak) {

      return global.TasuGenAiWorkspace.shouldSpeak(modeId);

    }

    return global.TasuAiModes?.isConciergeMode?.(modeId);

  }



  function updateCharacterStageForMode(mode, options) {

    const modeId = typeof mode === "string" ? mode : mode?.id;

    const meta = typeof mode === "string" ? resolveModeMeta(mode) : mode || resolveModeMeta(modeId);

    const showStage = options?.showStage ?? shouldShowStage(modeId);



    const panel = getPanel();

    const stage = getStage();

    const img = document.querySelector("[data-ai-character-img]");

    const hint = document.querySelector("[data-ai-character-stage-hint]");

    const voiceWrap = document.querySelector("[data-ai-voice-control]");



    if (panel) {

      panel.hidden = !showStage;

      panel.classList.toggle("is-visible", Boolean(showStage));

    }



    if (!showStage) {

      cancelSpeech();

      return;

    }



    const src = meta.characterImage || DEFAULT_CHARACTER_SRC;

    const fallback = meta.characterImageFallback || DEFAULT_CHARACTER_FALLBACK;



    if (img) {

      img.src = src;

      img.onerror = function onCharacterImgError() {

        if (img.src.indexOf(fallback) === -1) img.src = fallback;

        else img.onerror = null;

      };

      img.alt = meta.label || "AIキャラクター";

    }



    if (hint) {

      hint.textContent = meta.conciergePlaceholder || meta.description || meta.label || "";

    }



    if (stage) {

      stage.setAttribute("data-concierge-mode", modeId || "");

    }



    if (voiceWrap) {

      const showVoice = meta.speechEnabled !== false && shouldSpeakForMode(modeId);

      voiceWrap.hidden = !showVoice;

    }



    syncVoiceToggleUi();

  }



  function onModeChange(modeId) {

    cancelSpeech();

    updateCharacterStageForMode(resolveModeMeta(modeId), {

      showStage: shouldShowStage(modeId),

    });



    const app = document.querySelector(".ai-workspace-app");

    if (app) {

      app.classList.toggle("ai-workspace-app--concierge", Boolean(shouldShowStage(modeId)));

    }

  }



  function onAssistantReply(modeId, text) {

    if (!shouldSpeakForMode(modeId)) return;

    speak(text, {
      mode: resolveModeMeta(modeId),
      activeCharacter:
        global.TasuGenAiWorkspace?.getDisplayCharacter?.() ??
        global.TasuGenAiWorkspace?.getActiveCharacter?.() ??
        null,
    });

  }



  function bindVoiceToggle() {

    document.querySelectorAll("[data-ai-voice-toggle]").forEach((toggle) => {

      if (toggle.dataset.aiVoiceBound) return;

      toggle.dataset.aiVoiceBound = "1";

      toggle.checked = isVoiceEnabled();

      toggle.addEventListener("change", () => {

        setVoiceEnabled(toggle.checked);

        if (!toggle.checked) cancelSpeech();

      });

    });

  }



  function bind() {

    bindVoiceToggle();

    syncVoiceToggleUi();



    if (isSpeechSupported() && global.speechSynthesis.onvoiceschanged !== undefined) {

      global.speechSynthesis.onvoiceschanged = () => syncVoiceToggleUi();

    }

  }



  function init() {

    bind();



    const workspaceChat = document.querySelector("[data-ai-workspace-chat]");

    if (workspaceChat) {

      const modeId = workspaceChat.getAttribute("data-mode");

      if (modeId) onModeChange(modeId);

    }

  }



  global.TasuAiConcierge = {

    VOICE_STORAGE_KEY,

    isSpeechSupported,

    isVoiceEnabled,

    setVoiceEnabled,

    speak,

    cancelSpeech,

    onModeChange,

    onAssistantReply,

    updateCharacterStageForMode,

    init,

  };



  if (document.readyState === "loading") {

    document.addEventListener("DOMContentLoaded", init);

  } else {

    init();

  }

})(typeof window !== "undefined" ? window : globalThis);


