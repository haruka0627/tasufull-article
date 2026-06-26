/**
 * TASFUL TALK — AI利用履歴（localStorage）
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasful_talk_ai_usage_history";
  const EVENT_NAME = "tasful-talk-ai-usage-history-changed";
  const MAX_ENTRIES = 30;

  function nowIso() {
    return new Date().toISOString();
  }

  function loadRaw() {
    try {
      const raw = global.localStorage?.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveRaw(rows) {
    try {
      global.localStorage?.setItem(STORAGE_KEY, JSON.stringify(rows.slice(0, MAX_ENTRIES)));
      global.dispatchEvent?.(new CustomEvent(EVENT_NAME, { detail: { rows } }));
    } catch (err) {
      console.warn("[TasuTalkAiHistory] save failed:", err);
    }
  }

  function formatRelative(iso) {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return "";
    const diff = Date.now() - d.getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return "たった今";
    if (min < 60) return `${min}分前`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}時間前`;
    const day = Math.floor(hr / 24);
    if (day === 1) return "昨日";
    if (day < 8) return `${day}日前`;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}/${m}/${dd}`;
  }

  /**
   * @param {{ mode?: string, label?: string, promptPreview?: string }} entry
   */
  function record(entry) {
    const mode = String(entry?.mode || "qa").trim() || "qa";
    const label = String(entry?.label || mode).trim() || "AI相談";
    const rows = loadRaw().filter((r) => !(r.mode === mode && r.label === label));
    rows.unshift({
      id: `aih_${Date.now()}`,
      mode,
      label,
      promptPreview: String(entry?.promptPreview || "").slice(0, 120),
      usedAt: nowIso(),
    });
    saveRaw(rows);
    return rows[0];
  }

  function listRecent(limit) {
    const n = Number(limit) > 0 ? Number(limit) : 5;
    return loadRaw().slice(0, n);
  }

  global.TasuTalkAiHistory = {
    STORAGE_KEY,
    EVENT_NAME,
    record,
    listRecent,
    formatRelative,
    loadRaw,
  };
})(typeof window !== "undefined" ? window : globalThis);
