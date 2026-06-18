/**
 * TASFUL — AI音声ユーザー設定（Phase1: localStorage）
 * 読み上げ ON/OFF は既存 tasu_ai_voice_enabled と同期
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasu_voice_preferences_v1";
  const LEGACY_VOICE_ENABLED_KEY = "tasu_ai_voice_enabled";

  const DEFAULTS = Object.freeze({
    selectedVoiceId: "",
    rate: 1,
    pitch: 1,
    volume: 1,
  });

  function catalog() {
    return global.TasuVoiceCatalog || null;
  }

  function clamp(n, min, max, fallback) {
    const v = Number(n);
    if (!Number.isFinite(v)) return fallback;
    return Math.min(max, Math.max(min, v));
  }

  function clampRate(v) {
    return clamp(v, 0.5, 2, DEFAULTS.rate);
  }

  function clampPitch(v) {
    return clamp(v, 0.5, 2, DEFAULTS.pitch);
  }

  function clampVolume(v) {
    return clamp(v, 0, 1, DEFAULTS.volume);
  }

  function readLegacyVoiceEnabled() {
    try {
      const stored = global.localStorage?.getItem(LEGACY_VOICE_ENABLED_KEY);
      if (stored === "0") return false;
      if (stored === "1") return true;
    } catch {
      /* ignore */
    }
    return true;
  }

  function writeLegacyVoiceEnabled(enabled) {
    try {
      global.localStorage?.setItem(LEGACY_VOICE_ENABLED_KEY, enabled ? "1" : "0");
    } catch {
      /* ignore */
    }
    global.TasuAiConcierge?.syncVoiceToggleUi?.();
  }

  function setVoiceEnabled(enabled) {
    const on = Boolean(enabled);
    writeLegacyVoiceEnabled(on);
    if (!on) global.TasuAiConcierge?.cancelSpeech?.();
    return on;
  }

  function normalize(raw) {
    const Cat = catalog();
    const defaultVoiceId = Cat?.getDefaultVoiceId?.() || "std_neutral";
    let selectedVoiceId = String(raw?.selectedVoiceId || "").trim() || defaultVoiceId;
    if (Cat && !Cat.isSelectable(selectedVoiceId)) {
      selectedVoiceId = defaultVoiceId;
    }
    return {
      selectedVoiceId,
      rate: clampRate(raw?.rate),
      pitch: clampPitch(raw?.pitch),
      volume: clampVolume(raw?.volume),
      updatedAt: raw?.updatedAt || new Date().toISOString(),
    };
  }

  function load() {
    try {
      const raw = global.localStorage?.getItem(STORAGE_KEY);
      if (raw) return normalize(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    return normalize({ selectedVoiceId: catalog()?.getDefaultVoiceId?.() });
  }

  function save(partial) {
    const next = normalize({ ...load(), ...(partial || {}), updatedAt: new Date().toISOString() });
    try {
      global.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (err) {
      console.warn("[TasuVoicePreferences] save failed:", err);
    }
    return next;
  }

  function getVoiceEnabled() {
    return readLegacyVoiceEnabled();
  }

  function setVoiceEnabledPref(enabled) {
    return setVoiceEnabled(enabled);
  }

  function getBrowserVoices() {
    if (typeof global.speechSynthesis === "undefined") return [];
    try {
      return global.speechSynthesis.getVoices?.() || [];
    } catch {
      return [];
    }
  }

  function matchBrowserVoice(entry) {
    if (!entry?.browserMatch) return null;
    const voices = getBrowserVoices();
    const lang = String(entry.browserMatch.lang || "ja").toLowerCase();
    const hints = (entry.browserMatch.nameHints || []).map((h) => String(h).toLowerCase());
    const jaVoices = voices.filter((v) => String(v.lang || "").toLowerCase().startsWith(lang));
    for (const hint of hints) {
      const hit = jaVoices.find((v) => String(v.name || "").toLowerCase().includes(hint));
      if (hit) return hit;
    }
    return jaVoices[0] || null;
  }

  function resolveBrowserVoice(voiceId) {
    const Cat = catalog();
    const id = String(voiceId || load().selectedVoiceId || "").trim();
    const entry = Cat?.getById?.(id);
    if (!entry || entry.isPremium) {
      const fallbackId = Cat?.getDefaultVoiceId?.() || "std_neutral";
      return matchBrowserVoice(Cat?.getById?.(fallbackId));
    }
    return matchBrowserVoice(entry);
  }

  function applyToUtterance(utterance, voiceId) {
    if (!utterance) return utterance;
    const prefs = load();
    utterance.lang = "ja-JP";
    utterance.rate = clampRate(prefs.rate);
    utterance.pitch = clampPitch(prefs.pitch);
    utterance.volume = clampVolume(prefs.volume);
    const resolved = resolveBrowserVoice(voiceId || prefs.selectedVoiceId);
    if (resolved) utterance.voice = resolved;
    return utterance;
  }

  global.TasuVoicePreferences = {
    STORAGE_KEY,
    LEGACY_VOICE_ENABLED_KEY,
    DEFAULTS,
    clampRate,
    clampPitch,
    clampVolume,
    load,
    save,
    getVoiceEnabled,
    setVoiceEnabled: setVoiceEnabledPref,
    getBrowserVoices,
    resolveBrowserVoice,
    applyToUtterance,
  };
})(typeof window !== "undefined" ? window : globalThis);
