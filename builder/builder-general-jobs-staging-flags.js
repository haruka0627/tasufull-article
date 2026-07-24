/**
 * Builder General Jobs — Staging dev flags (P0-03)
 *
 * Staging Supabase URL 検出時のみ Repository を有効化。
 * 明示的に false が設定されている場合は上書きしない。
 * Cloudflare ビルド注入（builder-general-jobs-deploy-flags.js）が先に評価される。
 */
(function (global) {
  "use strict";

  const STAGING_REF = "ahlxuyvhzqdqaojiywmu";
  const cfg = global.TASU_CHAT_SUPABASE_CONFIG || {};
  const baseUrl = String(cfg.url || cfg.supabaseUrl || "");

  if (!baseUrl.includes(STAGING_REF)) return;
  if (global.TASU_BUILDER_GENERAL_JOBS_REPO === false) return;

  if (typeof global.TASU_BUILDER_STORAGE_MODE === "undefined") {
    global.TASU_BUILDER_STORAGE_MODE = "supabase";
  }
  if (typeof global.TASU_BUILDER_GENERAL_JOBS_REPO === "undefined") {
    global.TASU_BUILDER_GENERAL_JOBS_REPO = true;
  }
})(typeof window !== "undefined" ? window : globalThis);
