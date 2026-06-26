/**
 * TASFUL AI Voice Core — 共通 STT/TTS 基盤（ブラウザ API · 外部 TTS 未接続）
 * AI秘書 · TASFUL AI · 将来 TLV AI 向け
 */
(function (global) {
  "use strict";

  const PREFS_PREFIX = "tasu_ai_voice_prefs_v1_";
  const DEFAULT_LANG = "ja-JP";

  let voiceEnabled = false;
  let speakerEnabled = false;
  let activeSurface = "default";
  let lastError = null;
  let listening = false;
  let recognition = null;

  const browserTtsAdapter = {
    id: "browser-speech-synthesis",
    async synthesize(text, options = {}) {
      if (!global.speechSynthesis) {
        throw new Error("読み上げはこのブラウザでは利用できません");
      }
      const utter = new SpeechSynthesisUtterance(String(text || "").trim());
      utter.lang = options.lang || DEFAULT_LANG;
      utter.rate = Number(options.rate) || 1;
      return new Promise((resolve, reject) => {
        utter.onend = () => resolve({ ok: true, adapter: browserTtsAdapter.id });
        utter.onerror = (e) => reject(new Error(e.error || "tts_error"));
        global.speechSynthesis.speak(utter);
      });
    },
  };

  let ttsAdapter = browserTtsAdapter;

  function prefKey(surface, key) {
    return `${PREFS_PREFIX}${surface}_${key}`;
  }

  function loadBool(surface, key, fallback) {
    try {
      const raw = sessionStorage.getItem(prefKey(surface, key));
      if (raw === "1") return true;
      if (raw === "0") return false;
    } catch {
      /* ignore */
    }
    return fallback;
  }

  function saveBool(surface, key, value) {
    try {
      sessionStorage.setItem(prefKey(surface, key), value ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  function isSpeechRecognitionSupported() {
    return !!(global.SpeechRecognition || global.webkitSpeechRecognition);
  }

  function isSpeechSynthesisSupported() {
    return !!global.speechSynthesis;
  }

  function isVoiceSupported() {
    return {
      stt: isSpeechRecognitionSupported(),
      tts: isSpeechSynthesisSupported(),
      any: isSpeechRecognitionSupported() || isSpeechSynthesisSupported(),
    };
  }

  function setLastError(msg) {
    lastError = msg ? String(msg) : null;
    return lastError;
  }

  function initSurface(surface) {
    activeSurface = String(surface || "default");
    voiceEnabled = loadBool(activeSurface, "voice", false);
    speakerEnabled = loadBool(activeSurface, "speaker", false);
    return { voiceEnabled, speakerEnabled, surface: activeSurface };
  }

  function setVoiceEnabled(value, surface) {
    const s = surface || activeSurface;
    voiceEnabled = Boolean(value);
    saveBool(s, "voice", voiceEnabled);
    return voiceEnabled;
  }

  function setSpeakerEnabled(value, surface) {
    const s = surface || activeSurface;
    speakerEnabled = Boolean(value);
    saveBool(s, "speaker", speakerEnabled);
    if (!speakerEnabled) stopVoice();
    return speakerEnabled;
  }

  function getVoiceEnabled() {
    return voiceEnabled;
  }

  function getSpeakerEnabled() {
    return speakerEnabled;
  }

  function stopVoice() {
    if (global.speechSynthesis) {
      try {
        global.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
    }
    if (recognition && listening) {
      try {
        recognition.stop();
      } catch {
        /* ignore */
      }
    }
    listening = false;
  }

  async function textToSpeech(text, options = {}) {
    const payload = String(text || "").trim();
    if (!payload) return { ok: false, skipped: true, reason: "empty" };
    if (!isSpeechSynthesisSupported()) {
      const err = "読み上げはこのブラウザでは利用できません";
      setLastError(err);
      return { ok: false, error: err };
    }
    try {
      const out = await ttsAdapter.synthesize(payload, options);
      setLastError(null);
      return { ok: true, ...out };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLastError(msg);
      return { ok: false, error: msg };
    }
  }

  async function playVoice(text, options = {}) {
    if (!getSpeakerEnabled()) {
      return { ok: false, skipped: true, reason: "speaker_off" };
    }
    stopVoice();
    return textToSpeech(text, options);
  }

  function speechToText(options = {}) {
    return new Promise((resolve, reject) => {
      if (!isSpeechRecognitionSupported()) {
        const err = "音声入力はこのブラウザでは利用できません";
        setLastError(err);
        reject(new Error(err));
        return;
      }
      if (!getVoiceEnabled()) {
        const err = "音声入力がOFFです";
        setLastError(err);
        reject(new Error(err));
        return;
      }
      stopVoice();
      const SR = global.SpeechRecognition || global.webkitSpeechRecognition;
      recognition = new SR();
      recognition.lang = options.lang || DEFAULT_LANG;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.continuous = false;

      recognition.onresult = (event) => {
        listening = false;
        const transcript = event.results?.[0]?.[0]?.transcript || "";
        setLastError(null);
        resolve({ ok: true, text: String(transcript).trim() });
      };
      recognition.onerror = (event) => {
        listening = false;
        const msg = event.error === "not-allowed"
          ? "マイクの利用が拒否されました"
          : String(event.error || "recognition_error");
        setLastError(msg);
        reject(new Error(msg));
      };
      recognition.onend = () => {
        listening = false;
      };

      try {
        listening = true;
        recognition.start();
      } catch (err) {
        listening = false;
        const msg = err instanceof Error ? err.message : String(err);
        setLastError(msg);
        reject(new Error(msg));
      }
    });
  }

  function setTtsAdapter(adapter) {
    ttsAdapter = adapter && typeof adapter.synthesize === "function" ? adapter : browserTtsAdapter;
    return ttsAdapter.id;
  }

  function getTtsAdapter() {
    return ttsAdapter;
  }

  function mountToolbar(options = {}) {
    const formEl = options.formEl;
    const inputEl = options.inputEl;
    const surface = options.surface || activeSurface;
    if (!formEl || !inputEl || formEl.dataset.tasuVoiceToolbar === "1") {
      return null;
    }
    initSurface(surface);
    formEl.dataset.tasuVoiceToolbar = "1";

    const host = options.hostEl || formEl.parentElement;
    if (!host) return null;

    const wrap = document.createElement("div");
    wrap.className = "tasful-ai-voice";
    wrap.dataset.tasuVoiceSurface = surface;
    wrap.innerHTML =
      '<div class="tasful-ai-voice__toolbar" role="group" aria-label="音声補助">' +
      '<button type="button" class="tasful-ai-voice__btn" data-tasu-voice-mic-toggle aria-pressed="false" title="音声入力 ON/OFF">🎤 OFF</button>' +
      '<button type="button" class="tasful-ai-voice__btn" data-tasu-voice-mic aria-label="音声入力" title="話す">録音</button>' +
      '<button type="button" class="tasful-ai-voice__btn" data-tasu-voice-speaker-toggle aria-pressed="false" title="読み上げ ON/OFF">🔊 OFF</button>' +
      '<button type="button" class="tasful-ai-voice__btn" data-tasu-voice-stop aria-label="音声停止" title="停止">停止</button>' +
      "</div>" +
      '<p class="tasful-ai-voice__note" data-tasu-voice-note hidden></p>' +
      '<p class="tasful-ai-voice__error" data-tasu-voice-error hidden role="alert"></p>';

    if (options.insertBefore === "form") {
      host.insertBefore(wrap, formEl);
    } else {
      host.appendChild(wrap);
    }

    const micToggle = wrap.querySelector("[data-tasu-voice-mic-toggle]");
    const micBtn = wrap.querySelector("[data-tasu-voice-mic]");
    const speakerToggle = wrap.querySelector("[data-tasu-voice-speaker-toggle]");
    const stopBtn = wrap.querySelector("[data-tasu-voice-stop]");
    const noteEl = wrap.querySelector("[data-tasu-voice-note]");
    const errorEl = wrap.querySelector("[data-tasu-voice-error]");

    function showError(msg) {
      if (!errorEl) return;
      if (msg) {
        errorEl.textContent = msg;
        errorEl.hidden = false;
      } else {
        errorEl.textContent = "";
        errorEl.hidden = true;
      }
    }

    function refreshUi() {
      const sup = isVoiceSupported();
      if (micToggle) {
        micToggle.textContent = voiceEnabled ? "🎤 ON" : "🎤 OFF";
        micToggle.setAttribute("aria-pressed", voiceEnabled ? "true" : "false");
        micToggle.disabled = !sup.stt;
      }
      if (micBtn) {
        micBtn.disabled = !sup.stt || !voiceEnabled;
        micBtn.textContent = listening ? "聞取中…" : "録音";
      }
      if (speakerToggle) {
        speakerToggle.textContent = speakerEnabled ? "🔊 ON" : "🔊 OFF";
        speakerToggle.setAttribute("aria-pressed", speakerEnabled ? "true" : "false");
        speakerToggle.disabled = !sup.tts;
      }
      if (noteEl) {
        const notes = [];
        if (!sup.stt) notes.push("音声入力はこのブラウザでは利用できません");
        if (!sup.tts) notes.push("読み上げはこのブラウザでは利用できません");
        if (notes.length) {
          noteEl.textContent = notes.join(" · ");
          noteEl.hidden = false;
        } else {
          noteEl.hidden = true;
        }
      }
    }

    micToggle?.addEventListener("click", () => {
      setVoiceEnabled(!voiceEnabled, surface);
      showError(null);
      refreshUi();
    });

    speakerToggle?.addEventListener("click", () => {
      setSpeakerEnabled(!speakerEnabled, surface);
      showError(null);
      refreshUi();
    });

    stopBtn?.addEventListener("click", () => {
      stopVoice();
      showError(null);
      refreshUi();
    });

    micBtn?.addEventListener("click", () => {
      showError(null);
      speechToText({ lang: options.lang })
        .then((out) => {
          if (out.text) {
            if ("value" in inputEl) inputEl.value = out.text;
            else inputEl.textContent = out.text;
            inputEl.dispatchEvent(new Event("input", { bubbles: true }));
            inputEl.focus?.();
          }
          refreshUi();
        })
        .catch((err) => {
          showError(err instanceof Error ? err.message : String(err));
          refreshUi();
        });
    });

    formEl.addEventListener(
      "submit",
      () => {
        stopVoice();
      },
      true
    );

    refreshUi();
    return wrap;
  }

  global.TasuAiVoiceCore = {
    speechToText,
    textToSpeech,
    playVoice,
    stopVoice,
    isVoiceSupported,
    initSurface,
    setVoiceEnabled,
    setSpeakerEnabled,
    get voiceEnabled() {
      return voiceEnabled;
    },
    get speakerEnabled() {
      return speakerEnabled;
    },
    get lastError() {
      return lastError;
    },
    setTtsAdapter,
    getTtsAdapter,
    browserTtsAdapter,
    mountToolbar,
  };
})(typeof window !== "undefined" ? window : globalThis);
