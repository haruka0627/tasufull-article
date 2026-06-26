/**
 * Builder B3 — domain event hub (stub).
 * Future: cross-adapter events (board, partner, notification).
 */
(function (global) {
  "use strict";

  global.TasuBuilderEventHub = global.TasuBuilderEventHub || {
    emit() {},
    on() {
      return function unsubscribe() {};
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
