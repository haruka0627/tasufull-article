/**
 * TASFUL AI Workspace — 音声設定（キャラクター · モデル · 読み上げ · ライブ会話）
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasu_ai_voice_settings";
  const EVENT_NAME = "tasu:ai-voice-settings-changed";

  const VOICES = Object.freeze([
    {
      id: "maple",
      name: "Maple",
      description: "快活で、率直",
      gradient: "linear-gradient(135deg, #60a5fa 0%, #2563eb 48%, #1d4ed8 100%)",
      previewText: "こんにちは。Mapleです。快活で、率直な声でお話しします。",
    },
    {
      id: "breeze",
      name: "Breeze",
      description: "落ち着いた、明瞭",
      gradient: "linear-gradient(135deg, #a7f3d0 0%, #34d399 50%, #059669 100%)",
      previewText: "こんにちは。Breezeです。落ち着いた明瞭な声です。",
    },
    {
      id: "cove",
      name: "Cove",
      description: "温かみのある、自然",
      gradient: "linear-gradient(135deg, #fde68a 0%, #f59e0b 55%, #d97706 100%)",
      previewText: "こんにちは。Coveです。温かみのある自然な声です。",
    },
    {
      id: "ember",
      name: "Ember",
      description: "力強い、はっきり",
      gradient: "linear-gradient(135deg, #fca5a5 0%, #ef4444 50%, #b91c1c 100%)",
      previewText: "こんにちは。Emberです。力強くはっきり話します。",
    },
    {
      id: "juniper",
      name: "Juniper",
      description: "柔らかい、丁寧",
      gradient: "linear-gradient(135deg, #ddd6fe 0%, #a78bfa 50%, #7c3aed 100%)",
      previewText: "こんにちは。Juniperです。柔らかく丁寧にお話しします。",
    },
  ]);

  const DEFAULT_STATE = Object.freeze({
    selectedVoice: "maple",
    voiceModel: "auto",
    language: "auto",
    quality: "standard",
    responseSpeed: "standard",
    conversationStyle: "natural",
    textToSpeech: true,
    autoListening: true,
    interruption: true,
    noiseReduction: true,
    responseSound: false,
    speakingSpeed: 50,
    pitch: 50,
    volume: 70,
    emotion: "neutral",
    updatedAt: "",
  });

  /** @type {typeof DEFAULT_STATE} */
  let cachedState = loadState();

  function cloneState(source) {
    return {
      selectedVoice: normalizeVoiceId(source.selectedVoice),
      voiceModel: normalizeVoiceModel(source.voiceModel),
      language: normalizeLanguage(source.language),
      quality: normalizeQuality(source.quality),
      responseSpeed: normalizeResponseSpeed(source.responseSpeed),
      conversationStyle: normalizeConversationStyle(source.conversationStyle),
      textToSpeech: Boolean(source.textToSpeech),
      autoListening: Boolean(source.autoListening),
      interruption: Boolean(source.interruption),
      noiseReduction: Boolean(source.noiseReduction),
      responseSound: Boolean(source.responseSound),
      speakingSpeed: clampPercent(source.speakingSpeed, 50),
      pitch: clampPercent(source.pitch, 50),
      volume: clampPercent(source.volume, 70),
      emotion: normalizeEmotion(source.emotion),
      updatedAt: source.updatedAt || "",
    };
  }

  function clampPercent(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  function normalizeVoiceId(value) {
    const id = String(value || "").trim();
    return VOICES.some((v) => v.id === id) ? id : "maple";
  }

  function normalizeVoiceModel(value) {
    const allowed = ["auto", "openai", "gemini-live", "elevenlabs", "future"];
    const id = String(value || "").trim();
    return allowed.includes(id) ? id : "auto";
  }

  function normalizeLanguage(value) {
    const allowed = ["auto", "ja", "en", "other"];
    const id = String(value || "").trim();
    return allowed.includes(id) ? id : "auto";
  }

  function normalizeQuality(value) {
    const allowed = ["standard", "high", "low-bandwidth"];
    const id = String(value || "").trim();
    return allowed.includes(id) ? id : "standard";
  }

  function normalizeResponseSpeed(value) {
    const allowed = ["fast", "standard", "natural"];
    const id = String(value || "").trim();
    return allowed.includes(id) ? id : "standard";
  }

  function normalizeConversationStyle(value) {
    const allowed = ["natural", "friendly", "formal", "concise"];
    const id = String(value || "").trim();
    return allowed.includes(id) ? id : "natural";
  }

  function normalizeEmotion(value) {
    const allowed = ["neutral", "expressive", "subtle"];
    const id = String(value || "").trim();
    return allowed.includes(id) ? id : "neutral";
  }

  function sanitizePartial(input, base) {
    const next = cloneState(base);
    if (!input || typeof input !== "object") return next;
    Object.keys(DEFAULT_STATE).forEach((key) => {
      if (key in input && key !== "updatedAt") {
        next[key] = cloneState({ ...next, [key]: input[key] })[key];
      }
    });
    next.updatedAt = new Date().toISOString();
    return next;
  }

  function loadState() {
    try {
      const raw = JSON.parse(global.localStorage.getItem(STORAGE_KEY) || "null");
      if (!raw || typeof raw !== "object") return cloneState(DEFAULT_STATE);
      return sanitizePartial(raw, DEFAULT_STATE);
    } catch {
      return cloneState(DEFAULT_STATE);
    }
  }

  function persistState(next, changedKey) {
    cachedState = cloneState(next);
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedState));
    } catch {
      /* ignore */
    }
    global.dispatchEvent(
      new CustomEvent(EVENT_NAME, {
        detail: { state: getSnapshot(), changedKey: changedKey || null },
      })
    );
    return cachedState;
  }

  function getState() {
    return cachedState;
  }

  function getSnapshot() {
    return Object.freeze(cloneState(cachedState));
  }

  function getVoice(voiceId) {
    const id = normalizeVoiceId(voiceId || cachedState.selectedVoice);
    return VOICES.find((v) => v.id === id) || VOICES[0];
  }

  function getVoiceIndex(voiceId) {
    const id = normalizeVoiceId(voiceId);
    const idx = VOICES.findIndex((v) => v.id === id);
    return idx >= 0 ? idx : 0;
  }

  function setState(partial, meta = {}) {
    const next = sanitizePartial(partial, cachedState);
    return persistState(next, meta.changedKey || null);
  }

  function setSetting(key, value) {
    if (!(key in DEFAULT_STATE) || key === "updatedAt") return cachedState;
    return setState({ [key]: value }, { changedKey: key });
  }

  function setSelectedVoice(voiceId) {
    return setSetting("selectedVoice", normalizeVoiceId(voiceId));
  }

  function selectAdjacentVoice(delta) {
    const idx = getVoiceIndex(cachedState.selectedVoice);
    const next = (idx + delta + VOICES.length) % VOICES.length;
    return setSelectedVoice(VOICES[next].id);
  }

  function getSliderLabel(key, value) {
    const n = clampPercent(value, 50);
    if (key === "speakingSpeed") {
      if (n <= 33) return "遅い";
      if (n >= 67) return "速い";
      return "標準";
    }
    if (key === "pitch") {
      if (n <= 33) return "低い";
      if (n >= 67) return "高い";
      return "標準";
    }
    if (key === "volume") {
      if (n <= 33) return "小";
      if (n >= 67) return "大";
      return "中";
    }
    return String(n);
  }

  function previewVoice(voiceId) {
    const voice = getVoice(voiceId);
    const state = getSnapshot();
    const text = voice.previewText || `こんにちは。${voice.name}です。`;

    if (global.speechSynthesis && global.SpeechSynthesisUtterance) {
      try {
        global.speechSynthesis.cancel();
        const utter = new global.SpeechSynthesisUtterance(text);
        utter.lang = state.language === "en" ? "en-US" : "ja-JP";
        utter.rate = 0.75 + (state.speakingSpeed / 100) * 0.75;
        utter.pitch = 0.75 + (state.pitch / 100) * 0.75;
        utter.volume = Math.max(0.1, state.volume / 100);
        global.speechSynthesis.speak(utter);
        return { ok: true, mode: "speechSynthesis", voiceId: voice.id };
      } catch (err) {
        console.warn("[TasuAiWorkspaceVoiceSettings] preview failed:", err);
      }
    }

    console.info("[TasuAiWorkspaceVoiceSettings] preview:", voice.name, text);
    return { ok: true, mode: "mock", voiceId: voice.id };
  }

  function formatForApiRequest() {
    const snapshot = getSnapshot();
    const voice = getVoice(snapshot.selectedVoice);
    return {
      selectedVoice: snapshot.selectedVoice,
      voiceName: voice.name,
      voiceDescription: voice.description,
      voiceModel: snapshot.voiceModel,
      language: snapshot.language,
      quality: snapshot.quality,
      responseSpeed: snapshot.responseSpeed,
      conversationStyle: snapshot.conversationStyle,
      features: {
        textToSpeech: snapshot.textToSpeech,
        autoListening: snapshot.autoListening,
        interruption: snapshot.interruption,
        noiseReduction: snapshot.noiseReduction,
        responseSound: snapshot.responseSound,
      },
      advanced: {
        speakingSpeed: snapshot.speakingSpeed,
        pitch: snapshot.pitch,
        volume: snapshot.volume,
        emotion: snapshot.emotion,
      },
      updatedAt: snapshot.updatedAt,
    };
  }

  init();

  function init() {
    cachedState = loadState();
  }

  global.TasuAiWorkspaceVoiceSettings = {
    STORAGE_KEY,
    EVENT_NAME,
    VOICES,
    DEFAULT_STATE,
    getState,
    getSnapshot,
    getVoice,
    getVoiceIndex,
    setState,
    setSetting,
    setSelectedVoice,
    selectAdjacentVoice,
    getSliderLabel,
    previewVoice,
    formatForApiRequest,
  };
})(typeof window !== "undefined" ? window : globalThis);
