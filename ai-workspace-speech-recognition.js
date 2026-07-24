/**
 * TASFUL AI Workspace — 音声入力（ブラウザ標準 SpeechRecognition）
 * Phase 1: ブラウザ標準 SpeechRecognition による音声入力のみ
 * API不使用 · Gemini TTS未接続 · Gemini Live API未接続 · quota/billing未接続
 *
 * VoiceController に capture provider として登録し、stopImmediatePropagation に依存しない。
 * 将来の Gemini Live API 実装時に voiceMode 切替で共存可能。
 */
(function (global) {
  "use strict";

  var SpeechRecognitionCtor = global.SpeechRecognition || global.webkitSpeechRecognition;
  var IS_SUPPORTED = !!SpeechRecognitionCtor;

  var recognition = null;
  var isActive = false;
  var micBtn = null;
  var micIcon = null;
  var micLabelEl = null;
  var textarea = null;
  var toastEl = null;
  var toastTimer = null;
  var styleEl = null;

  var LABEL_IDLE = "音声入力";
  var LABEL_LISTENING = "聞取中…";
  var MSG_UNSUPPORTED = "このブラウザでは音声入力に対応していません。";

  /* ---- DOM参照の取得 ---- */
  function resolveElements() {
    micBtn = document.querySelector("[data-tasu-workspace-voice-composer-btn]");
    if (!micBtn) return false;
    micIcon = micBtn.querySelector(".material-symbols-outlined");
    micLabelEl = micBtn.querySelector(".ai-ref-composer__icon-label");
    textarea = document.querySelector("[data-ai-chat-input]");
    return true;
  }

  /* ---- スタイル注入 ---- */
  function injectStyles() {
    if (styleEl) return;
    styleEl = document.createElement("style");
    styleEl.textContent =
      /* 聞取中マイクアイコン */
      ".ai-ref-composer__icon-btn.speech-active .material-symbols-outlined," +
      ".ai-ref-composer__mic-btn.speech-active .material-symbols-outlined {" +
      "  color: #ef4444;" +
      "  animation: tasu-speech-pulse 1.2s ease-in-out infinite;" +
      "}" +
      ".ai-ref-composer__icon-btn.speech-active," +
      ".ai-ref-composer__mic-btn.speech-active {" +
      "  color: #ef4444;" +
      "}" +
      "@keyframes tasu-speech-pulse {" +
      "  0%, 100% { opacity: 1; transform: scale(1); }" +
      "  50% { opacity: 0.5; transform: scale(1.15); }" +
      "}" +
      /* 非対応トースト */
      ".ai-speech-toast {" +
      "  position: absolute;" +
      "  bottom: calc(100% + 8px);" +
      "  left: 50%;" +
      "  transform: translateX(-50%);" +
      "  background: #1f2937;" +
      "  color: #f9fafb;" +
      "  font-size: 0.75rem;" +
      "  font-weight: 500;" +
      "  line-height: 1.4;" +
      "  padding: 0.45rem 0.75rem;" +
      "  border-radius: 8px;" +
      "  white-space: nowrap;" +
      "  box-shadow: 0 4px 12px rgba(0,0,0,0.15);" +
      "  z-index: 100;" +
      "  pointer-events: none;" +
      "}" +
      ".ai-speech-toast[hidden] {" +
      "  display: none;" +
      "}" +
      /* ライトテーマ対応 */
      ".ai-workspace-page--ref .ai-speech-toast {" +
      "  background: #374151;" +
      "}";
    document.head.appendChild(styleEl);
  }

  /* ---- UI更新 ---- */
  function updateMicUI(state) {
    if (!micBtn) return;
    if (state === "listening") {
      micBtn.classList.add("speech-active");
      if (micLabelEl) micLabelEl.textContent = LABEL_LISTENING;
      if (micIcon) {
        micIcon.style.fontVariationSettings = "'FILL' 1";
      }
    } else {
      micBtn.classList.remove("speech-active");
      if (micLabelEl) micLabelEl.textContent = LABEL_IDLE;
      if (micIcon) {
        micIcon.style.fontVariationSettings = "'FILL' 0";
      }
    }
  }

  /* ---- 非対応トースト ---- */
  function showToast(msg) {
    if (!msg) return;
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "ai-speech-toast";
      toastEl.setAttribute("role", "status");
      toastEl.setAttribute("aria-live", "polite");

      var parent =
        (micBtn && (micBtn.closest("[data-ai-composer-menu-wrap]") || micBtn.parentElement)) || null;
      if (parent) {
        if (getComputedStyle(parent).position === "static") {
          parent.style.position = "relative";
        }
        parent.appendChild(toastEl);
      }
    }
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      if (toastEl) toastEl.hidden = true;
    }, 3500);
  }

  /* ---- capture provider 実装 ---- */
  function startRecognition() {
    return new Promise(function (resolve) {
      if (!IS_SUPPORTED) {
        showToast(MSG_UNSUPPORTED);
        resolve({ ok: false, error: MSG_UNSUPPORTED });
        return;
      }

      if (!textarea) {
        resolve({ ok: false, error: "composer_input_missing" });
        return;
      }

      if (!recognition) {
        recognition = new SpeechRecognitionCtor();
        recognition.lang = "ja-JP";
        recognition.interimResults = true;
        recognition.continuous = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = function (event) {
          var transcript = "";
          for (var i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          if (textarea) {
            textarea.value = transcript;
            textarea.dispatchEvent(new Event("input", { bubbles: true }));
          }
        };

        recognition.onerror = function (event) {
          console.warn("[TasuSpeechRecognition] Error: " + event.error);
          if (event.error === "not-allowed" || event.error === "service-not-allowed") {
            showToast(MSG_UNSUPPORTED);
          }
          isActive = false;
          updateMicUI("idle");
        };

        recognition.onend = function () {
          isActive = false;
          updateMicUI("idle");
        };
      }

      try {
        recognition.start();
        isActive = true;
        updateMicUI("listening");

        // 認識完了時に resolve（onend を上書き）
        var origEnd = recognition.onend;
        recognition.onend = function () {
          if (origEnd) origEnd();
          var finalText = textarea ? textarea.value : "";
          resolve({ ok: true, text: finalText, fillOnly: true });
        };

        var origErr = recognition.onerror;
        recognition.onerror = function (event) {
          if (origErr) origErr(event);
          resolve({ ok: false, error: String(event.error || "recognition_error") });
        };
      } catch (e) {
        console.warn("[TasuSpeechRecognition] start failed:", e);
        showToast(MSG_UNSUPPORTED);
        isActive = false;
        updateMicUI("idle");
        resolve({ ok: false, error: MSG_UNSUPPORTED });
      }
    });
  }

  function stopRecognition() {
    if (recognition && isActive) {
      try { recognition.stop(); } catch (e) { /* ignore */ }
    }
    isActive = false;
    updateMicUI("idle");
  }

  /* ---- VoiceController に capture provider として登録 ---- */
  function registerProvider() {
    var Controller = global.TasuWorkspaceVoiceController;
    if (!Controller?.registerCaptureProvider) {
      // VoiceController 未ロード時はリトライ
      setTimeout(registerProvider, 100);
      return;
    }

    Controller.registerCaptureProvider("speech-recognition", {
      capture: startRecognition,
      stop: stopRecognition,
      isSupported: function () { return IS_SUPPORTED; },
    });

    Controller.setVoiceMode("speech-recognition");
  }

  /* ---- 初期化 ---- */
  function init() {
    resolveElements();
    injectStyles();
    registerProvider();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  /* ---- 公開API ---- */
  global.TasuSpeechRecognition = {
    isSupported: IS_SUPPORTED,
    start: startRecognition,
    stop: stopRecognition,
    isActive: function () { return isActive; },
  };
})(window);
