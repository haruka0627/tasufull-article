/**
 * Builder B3 — bootstrap / builder.js bridge (P0-01)
 */
(function (global) {
  "use strict";

  const VERSION = "b3-init-p0-01";
  let bridge = null;

  global.TasuBuilderB3Init = {
    VERSION,
    registerBuilderBridge(hooks) {
      bridge = hooks && typeof hooks === "object" ? hooks : null;
    },
    finish() {
      const provider = global.TasuBuilderDataProvider;
      const projectRepo = provider?.getProjectRepository?.();
      const appRepo = provider?.getApplicationRepository?.();
      if (!projectRepo || !appRepo) return;
      global.__TASU_BUILDER_B3_READY__ = {
        version: VERSION,
        generalJobsSource: projectRepo.getActiveSource?.() || "mvp_local",
        supabaseEnabled: global.TasuBuilderConfig?.isSupabaseEnabled?.() === true,
        generalJobsRepoEnabled: global.TasuBuilderConfig?.isGeneralJobsRepositoryEnabled?.() === true,
      };
    },
    getBridge() {
      return bridge;
    },
    getStatus() {
      return global.__TASU_BUILDER_B3_READY__ || null;
    },
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => global.TasuBuilderB3Init.finish());
    } else {
      global.TasuBuilderB3Init.finish();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
