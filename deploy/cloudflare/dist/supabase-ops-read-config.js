/**
 * Supabase Phase 2 — read-through PoC 設定（デフォルト OFF）
 */
(function (global) {
  "use strict";

  function getConfig() {
    return global.TASU_CHAT_SUPABASE_CONFIG || global.TASU_SUPABASE_CONFIG || {};
  }

  /** URL ?supabaseRead=1 または config.supabaseOpsReadPoc */
  function isEnabled() {
    const cfg = getConfig();
    if (cfg.supabaseOpsReadPoc === true) return true;
    try {
      const params = new URLSearchParams(global.location?.search || "");
      if (params.get("supabaseRead") === "1") return true;
    } catch {
      /* ignore */
    }
    try {
      return global.sessionStorage?.getItem("tasu_supabase_ops_read_poc") === "1";
    } catch {
      return false;
    }
  }

  function canQuerySupabase() {
    if (!isEnabled()) return false;
    if (global.location?.protocol === "file:") return false;
    if (!global.TasuSupabase?.isConfigured?.()) return false;
    return true;
  }

  global.TasuSupabaseOpsReadConfig = {
    isEnabled,
    canQuerySupabase,
    getConfig,
  };
})(typeof window !== "undefined" ? window : globalThis);
