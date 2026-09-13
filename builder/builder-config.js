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
    isGeneralJobsRepoEnabled() {
      try {
        const flag = "TASU_BUILDER_GENERAL_JOBS_REPO";
        const q = new URLSearchParams(global.location?.search || "").get(flag);
        if (q === "true" || q === "1") return true;
        if (global.localStorage?.getItem(flag) === "true") return true;
        return global[flag] === true;
      } catch {
        return false;
      }
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
