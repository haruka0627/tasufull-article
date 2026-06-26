/**
 * Builder B3 — data provider facade (stub).
 * Future: wire local/Supabase repos. Returns null so builder.js keeps localStorage fallback.
 */
(function (global) {
  "use strict";

  global.TasuBuilderDataProvider = global.TasuBuilderDataProvider || {
    getMvpStore() {
      return null;
    },
    getNotificationRepository() {
      return null;
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
