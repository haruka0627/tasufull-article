/**
 * Supabase Phase 6 — 正データソース切替（デフォルト OFF・Staging PoC）
 */
(function (global) {
  "use strict";

  function getConfig() {
    return global.TASU_CHAT_SUPABASE_CONFIG || global.TASU_SUPABASE_CONFIG || {};
  }

  /** URL ?supabasePrimary=1 / config.supabaseOpsPrimarySource / __TASU_SUPABASE_PRIMARY__ */
  function isPrimarySource() {
    if (global.__TASU_SUPABASE_PRIMARY__ === true) return true;
    const cfg = getConfig();
    if (cfg.supabaseOpsPrimarySource === true) return true;
    try {
      const params = new URLSearchParams(global.location?.search || "");
      if (params.get("supabasePrimary") === "1") return true;
    } catch {
      /* ignore */
    }
    try {
      return global.sessionStorage?.getItem("tasu_supabase_ops_primary") === "1";
    } catch {
      return false;
    }
  }

  global.TasuSupabaseOpsPrimaryConfig = {
    isPrimarySource,
    getConfig,
  };
})(typeof window !== "undefined" ? window : globalThis);
