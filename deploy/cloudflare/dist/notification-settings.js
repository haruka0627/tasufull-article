/**
 * 通知設定（notification-settings.html）
 * localStorage デモ保存 — 将来 AI Agent から saveSettings() を呼び出し可能
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasful_notification_settings";

  const DEFAULTS = {
    email: true,
    site: true,
    line: false,
    sms: false,
    newMessage: true,
    estimateRequest: true,
    consultChat: true,
    dealStarted: true,
    dealCompleted: true,
    feePayment: true,
    favoriteAdded: false,
    listingStatus: true,
    frequency: "instant",
  };

  const TOGGLE_KEYS = [
    "email",
    "site",
    "line",
    "sms",
    "newMessage",
    "estimateRequest",
    "consultChat",
    "dealStarted",
    "dealCompleted",
    "feePayment",
    "favoriteAdded",
    "listingStatus",
  ];

  function getSettings() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULTS };
      const parsed = JSON.parse(raw);
      return { ...DEFAULTS, ...(parsed && typeof parsed === "object" ? parsed : {}) };
    } catch {
      return { ...DEFAULTS };
    }
  }

  function saveSettings(patch) {
    const next = {
      ...getSettings(),
      ...(patch && typeof patch === "object" ? patch : {}),
      updatedAt: new Date().toISOString(),
    };
    global.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  }

  function resetSettings() {
    global.localStorage.removeItem(STORAGE_KEY);
    return { ...DEFAULTS };
  }

  function collectFromForm(root) {
    const form = root || document;
    const out = { frequency: form.querySelector("[data-notify-frequency]")?.value || "instant" };
    TOGGLE_KEYS.forEach((key) => {
      const el = form.querySelector(`[data-notify-toggle="${key}"]`);
      out[key] = Boolean(el?.checked);
    });
    return out;
  }

  function applyToForm(settings, root) {
    const form = root || document;
    const s = { ...DEFAULTS, ...settings };

    TOGGLE_KEYS.forEach((key) => {
      const el = form.querySelector(`[data-notify-toggle="${key}"]`);
      if (el) el.checked = Boolean(s[key]);
    });

    const freq = form.querySelector("[data-notify-frequency]");
    if (freq) freq.value = s.frequency || "instant";
  }

  function showToast(message) {
    const toastEl = document.querySelector("[data-notify-toast]");
    if (!toastEl) return;
    toastEl.hidden = false;
    toastEl.textContent = message;
    global.clearTimeout(showToast._timer);
    showToast._timer = global.setTimeout(() => {
      toastEl.hidden = true;
    }, 4200);
  }

  function bindPage() {
    if (document.body?.dataset?.page !== "notification-settings") return;

    applyToForm(getSettings());

    document.querySelector("[data-notify-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const next = saveSettings(collectFromForm());
      applyToForm(next);
      showToast("通知設定を保存しました");
    });
  }

  global.TasuNotificationSettings = {
    STORAGE_KEY,
    DEFAULTS,
    getSettings,
    saveSettings,
    resetSettings,
    collectFromForm,
    applyToForm,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindPage);
  } else {
    bindPage();
  }
})(typeof window !== "undefined" ? window : globalThis);
