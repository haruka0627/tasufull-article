/**
 * Builder B3 — runtime config (stub).
 * Future: storage mode, feature flags, Supabase toggle.
 */
(function (global) {
  "use strict";

  global.TasuBuilderConfig = global.TasuBuilderConfig || {
    getStorageMode() {
      return "local";
    },
    isSupabaseEnabled() {
      return false;
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
