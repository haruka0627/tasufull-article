/**
 * TASFUL AI Workspace — 通知設定
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasu_ai_notification_settings";
  const EVENT_NAME = "tasu:ai-notification-settings-changed";

  const DEFAULT_STATE = Object.freeze({
    "ai-response": "push",
    "image-complete": "push",
    "analysis-complete": "push",
    "usage-reset": "both",
    billing: "email",
    system: "both",
    updatedAt: "",
  });

  const ALLOWED_VALUES = Object.freeze({
    "ai-response": new Set(["off", "push"]),
    "image-complete": new Set(["off", "push"]),
    "analysis-complete": new Set(["off", "push"]),
    "usage-reset": new Set(["off", "push", "email", "both"]),
    billing: new Set(["off", "email"]),
    system: new Set(["off", "push", "email", "both"]),
  });

  /** @type {typeof DEFAULT_STATE} */
  let cachedState = loadState();

  function normalizeItemValue(key, value) {
    const allowed = ALLOWED_VALUES[key];
    const id = String(value || "").trim();
    if (allowed && allowed.has(id)) return id;
    return DEFAULT_STATE[key] || "off";
  }

  function cloneState(source) {
    const next = { updatedAt: source.updatedAt || "" };
    for (const key of Object.keys(DEFAULT_STATE)) {
      if (key === "updatedAt") continue;
      next[key] = normalizeItemValue(key, source[key]);
    }
    return next;
  }

  function sanitizePartial(input, base) {
    const next = cloneState(base);
    if (!input || typeof input !== "object") return next;

    for (const key of Object.keys(DEFAULT_STATE)) {
      if (key === "updatedAt") continue;
      if (key in input) next[key] = normalizeItemValue(key, input[key]);
    }

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

  global.TasuAiWorkspaceNotificationSettings = {
    STORAGE_KEY,
    EVENT_NAME,
    DEFAULT_STATE,
    getState,
    getSnapshot,
    setState,
    setSetting,
  };
})(typeof window !== "undefined" ? window : globalThis);
