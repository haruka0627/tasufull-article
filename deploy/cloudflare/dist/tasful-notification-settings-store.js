/**
 * TASFUL — 通知設定（Push 連携準備）
 * localStorage キー: tasful_notification_settings
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasful_notification_settings";
  const EVENT_NAME = "tasful-notification-settings-changed";

  const SETTING_KEYS = Object.freeze([
    "chat",
    "project",
    "job",
    "business",
    "shop",
    "ai",
    "anpi",
    "email",
    "push",
  ]);

  const SETTING_LABELS = Object.freeze({
    chat: "チャット通知",
    project: "案件通知",
    job: "求人通知",
    business: "業務通知",
    shop: "店舗通知",
    ai: "AI通知",
    anpi: "安否通知",
    email: "メール通知",
    push: "プッシュ通知",
  });

  function defaultSettings() {
    const out = { updatedAt: new Date().toISOString() };
    SETTING_KEYS.forEach((k) => {
      out[k] = true;
    });
    return out;
  }

  function normalize(raw) {
    const base = defaultSettings();
    if (!raw || typeof raw !== "object") return base;
    SETTING_KEYS.forEach((k) => {
      if (typeof raw[k] === "boolean") base[k] = raw[k];
    });
    if (raw.updatedAt) base.updatedAt = String(raw.updatedAt);
    return base;
  }

  function load() {
    try {
      const raw = global.localStorage?.getItem(STORAGE_KEY);
      if (!raw) return defaultSettings();
      return normalize(JSON.parse(raw));
    } catch {
      return defaultSettings();
    }
  }

  function save(next) {
    const settings = normalize({ ...load(), ...next, updatedAt: new Date().toISOString() });
    try {
      global.localStorage?.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (err) {
      console.warn("[TasfulNotificationSettings] save failed:", err);
    }
    try {
      global.dispatchEvent?.(new CustomEvent(EVENT_NAME, { detail: { settings } }));
    } catch {
      /* ignore */
    }
    return settings;
  }

  function setEnabled(key, enabled) {
    if (!SETTING_KEYS.includes(key)) return load();
    return save({ [key]: Boolean(enabled) });
  }

  function isEnabled(key) {
    const s = load();
    return s[key] !== false;
  }

  function getAll() {
    return load();
  }

  global.TasfulNotificationSettings = {
    STORAGE_KEY,
    EVENT_NAME,
    SETTING_KEYS,
    SETTING_LABELS,
    defaultSettings,
    load,
    save,
    setEnabled,
    isEnabled,
    getAll,
  };
})(typeof window !== "undefined" ? window : globalThis);
