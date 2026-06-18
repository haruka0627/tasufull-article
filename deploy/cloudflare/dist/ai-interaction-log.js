/**
 * AI 対話ログ（localStorage・検索メタ含む）
 */
(function (global) {
  "use strict";

  const LOG_KEY = "tasu_ai_interaction_logs_v1";
  const MAX_ENTRIES = 500;

  function readLogs() {
    try {
      const raw = localStorage.getItem(LOG_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  function writeLogs(list) {
    try {
      localStorage.setItem(LOG_KEY, JSON.stringify(list.slice(0, MAX_ENTRIES)));
    } catch {
      /* ignore */
    }
  }

  /**
   * @param {{
   *   modeId?: string,
   *   userText?: string,
   *   search_used?: boolean,
   *   search_query?: string,
   *   search_provider?: string,
   *   search_result_count?: number,
   *   provider?: string,
   *   selected_model?: string,
   *   selected_provider?: string,
   *   user_plan?: string,
   *   fallback_used?: boolean,
   *   surface?: string,
   * }} entry
   */
  function appendInteractionLog(entry) {
    const row = {
      id: `ailog_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      created_at: new Date().toISOString(),
      mode_id: entry?.modeId || entry?.mode_id || "",
      user_text_preview: String(entry?.userText || entry?.user_text || "").slice(0, 200),
      search_used: Boolean(entry?.search_used),
      search_query: String(entry?.search_query || "").slice(0, 400),
      search_provider: String(entry?.search_provider || "").slice(0, 40),
      search_result_count: Number(entry?.search_result_count) || 0,
      ai_provider: String(entry?.provider || entry?.ai_provider || "").slice(0, 40),
      selected_model: String(entry?.selected_model || "").slice(0, 40),
      selected_provider: String(entry?.selected_provider || "").slice(0, 40),
      user_plan: String(entry?.user_plan || "").slice(0, 24),
      fallback_used: Boolean(entry?.fallback_used),
      surface: String(entry?.surface || "").slice(0, 32),
    };
    const list = readLogs();
    list.unshift(row);
    writeLogs(list);
    try {
      global.dispatchEvent(new CustomEvent("tasu:ai-interaction-logged", { detail: row }));
    } catch {
      /* ignore */
    }
    return row;
  }

  function listLogs(filter) {
    let list = readLogs();
    if (filter?.modeId) list = list.filter((r) => r.mode_id === filter.modeId);
    return list;
  }

  global.TasuAiInteractionLog = {
    LOG_KEY,
    appendInteractionLog,
    listLogs,
    readLogs,
  };
})(typeof window !== "undefined" ? window : globalThis);
