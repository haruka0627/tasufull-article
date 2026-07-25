/**
 * TASFUL AI Workspace — 一般設定（外観 · 言語 · 応答優先）
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasu_ai_general_settings";
  const EVENT_NAME = "tasu:ai-general-settings-changed";

  const DEFAULT_STATE = Object.freeze({
    appearance: "system",
    language: "ja",
    accentColor: "default",
    fastResponse: true,
    voiceInput: true,
    notificationsEnabled: false,
    updatedAt: "",
  });

  /** @type {typeof DEFAULT_STATE} */
  let cachedState = loadState();

  function normalizeAppearance(value) {
    const id = String(value || "").trim();
    return id === "light" || id === "dark" || id === "system" ? id : "system";
  }

  function normalizeLanguage(value) {
    const id = String(value || "").trim();
    return id === "ja" ? id : "ja";
  }

  function normalizeAccentColor(value) {
    const id = String(value || "").trim();
    return id === "default" ? id : "default";
  }

  function cloneState(source) {
    return {
      appearance: normalizeAppearance(source.appearance),
      language: normalizeLanguage(source.language),
      accentColor: normalizeAccentColor(source.accentColor),
      fastResponse: Boolean(source.fastResponse),
      voiceInput: Boolean(source.voiceInput),
      notificationsEnabled: Boolean(source.notificationsEnabled),
      updatedAt: source.updatedAt || "",
    };
  }

  function sanitizePartial(input, base) {
    const next = cloneState(base);
    if (!input || typeof input !== "object") return next;

    if ("appearance" in input) next.appearance = normalizeAppearance(input.appearance);
    if ("language" in input) next.language = normalizeLanguage(input.language);
    if ("accentColor" in input) next.accentColor = normalizeAccentColor(input.accentColor);
    if ("fastResponse" in input) next.fastResponse = Boolean(input.fastResponse);
    if ("voiceInput" in input) next.voiceInput = Boolean(input.voiceInput);
    if ("notificationsEnabled" in input) next.notificationsEnabled = Boolean(input.notificationsEnabled);

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

  function setState(partial, meta = {}) {
    const next = sanitizePartial(partial, cachedState);
    return persistState(next, meta.changedKey || null);
  }

  function setSetting(key, value) {
    if (!(key in DEFAULT_STATE) || key === "updatedAt") return cachedState;
    return setState({ [key]: value }, { changedKey: key });
  }

  function init() {
    cachedState = loadState();
  }

  init();

  global.TasuAiWorkspaceGeneralSettings = {
    STORAGE_KEY,
    EVENT_NAME,
    DEFAULT_STATE,
    getState,
    getSnapshot,
    setState,
    setSetting,
  };
})(typeof window !== "undefined" ? window : globalThis);
