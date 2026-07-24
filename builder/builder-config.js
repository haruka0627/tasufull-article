/**
 * Builder B3 — runtime config (P0-01)
 * Storage mode · Supabase toggle · general jobs repository flags
 */
(function (global) {
  "use strict";

  const VERSION = "b3-config-p2-01";

  /**
   * CAL-MAIN-17: Hub assignment DB write 成功 + hydrate 確認時のみ
   * MVP assignment_status write を no-op にする。
   */
  if (typeof global.TASU_BUILDER_STOP_MVP_ASSIGNMENT_WRITE_WHEN_DB_OK === "undefined") {
    global.TASU_BUILDER_STOP_MVP_ASSIGNMENT_WRITE_WHEN_DB_OK = true;
  }

  function getStorageMode() {
    const forced = pickStr(global.TASU_BUILDER_STORAGE_MODE);
    if (forced === "supabase" || forced === "local") return forced;
    return "local";
  }

  function isSupabaseConfigured() {
    const cfg = global.TASU_CHAT_SUPABASE_CONFIG || {};
    return Boolean(pickStr(cfg.url, cfg.supabaseUrl) && pickStr(cfg.anonKey, cfg.anon_key));
  }

  function isSupabaseEnabled() {
    if (getStorageMode() !== "supabase") return false;
    return isSupabaseConfigured();
  }

  /**
   * 一般案件 Repository を Supabase 経由にする（P0-02 で UI 接続）
   * 明示フラグが true のときのみ有効。
   */
  function isGeneralJobsRepositoryEnabled() {
    if (!isSupabaseEnabled()) return false;
    if (global.TASU_BUILDER_GENERAL_JOBS_REPO === true) return true;
    if (global.TASU_BUILDER_GENERAL_JOBS_REPO === false) return false;
    return false;
  }

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  global.TasuBuilderConfig = {
    VERSION,
    getStorageMode,
    isSupabaseConfigured,
    isSupabaseEnabled,
    isGeneralJobsRepositoryEnabled,
  };
})(typeof window !== "undefined" ? window : globalThis);
