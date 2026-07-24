/**
 * Builder B3 — data provider facade (P0-01)
 */
(function (global) {
  "use strict";

  const VERSION = "b3-data-provider-p0-01";

  global.TasuBuilderDataProvider = {
    VERSION,
    getMvpStore() {
      return null;
    },
    getNotificationRepository() {
      return null;
    },
    getProjectRepository() {
      return global.TasuBuilderProjectRepository || null;
    },
    getApplicationRepository() {
      return global.TasuBuilderApplicationRepository || null;
    },
    getActiveGeneralJobsSource() {
      return global.TasuBuilderProjectRepository?.getActiveSource?.() || "mvp_local";
    },
    isGeneralJobsSupabaseActive() {
      return global.TasuBuilderProjectRepository?.isSupabaseActive?.() === true;
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
