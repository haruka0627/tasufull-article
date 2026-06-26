/**
 * Builder B3 — bootstrap / builder.js bridge (stub).
 * Future: register repos/adapters and finish wiring after builder.js loads.
 */
(function (global) {
  "use strict";

  let bridge = null;

  global.TasuBuilderB3Init = global.TasuBuilderB3Init || {
    registerBuilderBridge(hooks) {
      bridge = hooks && typeof hooks === "object" ? hooks : null;
    },
    finish() {
      /* stub: MVP continues via builder.js localStorage; no side effects */
    },
    getBridge() {
      return bridge;
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
