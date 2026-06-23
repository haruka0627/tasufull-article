/**
 * TASFUL MATCH — core E2E wiring (edge/live only · list pairs)
 */
(function () {
  "use strict";

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function getApi() {
    return window.TasfulMatchAPI || null;
  }

  function isEdgeMode() {
    var api = getApi();
    return api && (typeof api.isLiveMode === "function" ? api.isLiveMode() : api.mode === "live" || api.mode === "edge_stub");
  }

  function initListPairsLive() {
    var page = qs('[data-page="match-list"]');
    if (!page || !isEdgeMode()) return;

    var api = getApi();
    if (!api || typeof api.listPairs !== "function") return;

    api.listPairs().then(function (result) {
      if (window.MatchLoginGate?.handleApiResult?.(result)) return;
      if (window.MatchBetaGate?.handleApiResult?.(result)) return;
      if (!result || !result.ok || !Array.isArray(result.pairs)) return;
      if (window.MatchDataRender?.renderPairListPage) {
        window.MatchDataRender.renderPairListPage(page, result.pairs);
      }
      if (window.MatchWiring?.initListWiring) {
        window.MatchWiring.initListWiring();
      }
    });
  }

  window.MatchCoreWiring = {
    refreshPairList: initListPairsLive,
  };

  document.addEventListener("DOMContentLoaded", function () {
    initListPairsLive();
  });
})();
