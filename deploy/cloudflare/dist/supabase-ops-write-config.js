/**
 * Supabase Phase 3 — dual-write PoC 設定（デフォルト OFF・Staging 限定）
 */
(function (global) {
  "use strict";

  function getConfig() {
    return global.TASU_CHAT_SUPABASE_CONFIG || global.TASU_SUPABASE_CONFIG || {};
  }

  /** URL ?supabaseDualWrite=1 / config.supabaseOpsDualWrite / __TASU_SUPABASE_DUAL_WRITE__ */
  function isEnabled() {
    if (global.__TASU_SUPABASE_DUAL_WRITE__ === true) return true;
    const cfg = getConfig();
    if (cfg.supabaseOpsDualWrite === true) return true;
    try {
      const params = new URLSearchParams(global.location?.search || "");
      if (params.get("supabaseDualWrite") === "1") return true;
    } catch {
      /* ignore */
    }
    try {
      return global.sessionStorage?.getItem("tasu_supabase_ops_dual_write") === "1";
    } catch {
      return false;
    }
  }

  /** Staging / 運営画面: admin JWT（Phase 4 RLS 下の write に必須） */
  function getOpsAccessToken() {
    if (global.__TASU_OPS_ADMIN_ACCESS_TOKEN__) {
      return String(global.__TASU_OPS_ADMIN_ACCESS_TOKEN__).trim();
    }
    const cfg = getConfig();
    if (cfg.opsAdminAccessToken) return String(cfg.opsAdminAccessToken).trim();
    try {
      return String(global.sessionStorage?.getItem("tasu_ops_admin_access_token") || "").trim();
    } catch {
      return "";
    }
  }

  function canWriteSupabase() {
    if (!isEnabled()) return false;
    if (global.location?.protocol === "file:") return false;
    if (!global.TasuSupabase?.isConfigured?.()) return false;
    if (!getOpsAccessToken()) return false;
    return true;
  }

  global.TasuSupabaseOpsWriteConfig = {
    isEnabled,
    canWriteSupabase,
    getOpsAccessToken,
    getConfig,
  };
})(typeof window !== "undefined" ? window : globalThis);
