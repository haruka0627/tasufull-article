/**
 * Builder B3 — shared repository helpers (P0-01)
 */
(function (global) {
  "use strict";

  function ok(data, meta) {
    return { ok: true, data, meta: meta || null, source: meta?.source || "unknown" };
  }

  function fail(code, message, meta) {
    return { ok: false, code: code || "repository_error", message: message || code, meta: meta || null };
  }

  function pickBackend(supabaseRepo, localRepo, enabledFn) {
    const enabled = typeof enabledFn === "function" ? enabledFn() : false;
    if (enabled && supabaseRepo?.isEnabled?.()) return { repo: supabaseRepo, source: "supabase" };
    return { repo: localRepo, source: "mvp_local" };
  }

  global.TasuBuilderRepository = {
    ok,
    fail,
    pickBackend,
  };
})(typeof window !== "undefined" ? window : globalThis);
