/**
 * Builder B3 — MVP localStorage store (stub).
 * Future: load/save delegating to tasful:builder:mvp:v1 keys.
 * Stub exposes global only; builder.js localStorage paths remain primary.
 */
(function (global) {
  "use strict";

  global.TasuBuilderMvpStoreLocal = global.TasuBuilderMvpStoreLocal || {};
})(typeof window !== "undefined" ? window : globalThis);
