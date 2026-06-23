/**
 * TASFUL MATCH — unmatch live wiring (edge_stub only)
 */
(function () {
  "use strict";

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function qsa(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  function getApi() {
    return window.TasfulMatchAPI || null;
  }

  function isEdgeMode() {
    var api = getApi();
    return api && (typeof api.isLiveMode === "function" ? api.isLiveMode() : api.mode === "live" || api.mode === "edge_stub");
  }

  function showToast(message) {
    if (window.MatchWiring?.showToast) {
      window.MatchWiring.showToast(message);
      return;
    }
    var toast = qs("[data-match-toast]");
    if (!toast || !message) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(function () {
      toast.classList.remove("is-visible");
    }, 2400);
  }

  function apiErrorMessage(result, fallback) {
    if (window.MatchWiring?.apiErrorMessage) {
      return window.MatchWiring.apiErrorMessage(result, fallback);
    }
    if (!result || result.ok) return fallback || "処理に失敗しました";
    return result.message || fallback || "処理に失敗しました";
  }

  function callUnmatch(pairId) {
    var api = getApi();
    if (!api || typeof api.unmatchPair !== "function") {
      return Promise.resolve(null);
    }
    return api.unmatchPair({ pair_id: pairId });
  }

  function refreshList() {
    if (window.MatchCoreWiring?.refreshPairList) {
      window.MatchCoreWiring.refreshPairList();
    }
  }

  function handleUnmatchClick(btn) {
    if (!isEdgeMode()) {
      showToast("マッチ解除（スタブ）");
      return;
    }

    var pairId = btn.getAttribute("data-match-pair-id") || "";
    if (!pairId) {
      showToast("マッチ情報を取得できませんでした");
      return;
    }

    if (!window.confirm("このマッチを解除しますか？\n解除後はメッセージを開始できません。")) {
      return;
    }

    btn.disabled = true;
    callUnmatch(pairId)
      .then(function (result) {
        btn.disabled = false;
        if (!result || !result.ok) {
          showToast(apiErrorMessage(result, "マッチ解除に失敗しました"));
          return;
        }
        showToast(result.already_unmatched ? "既にマッチ解除済みです" : "マッチを解除しました");
        refreshList();
      })
      .catch(function () {
        btn.disabled = false;
        showToast("マッチ解除に失敗しました");
      });
  }

  function initListUnmatchWiring() {
    var page = qs('[data-page="match-list"]');
    if (!page) return;

    page.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-match-unmatch]");
      if (!btn || !page.contains(btn)) return;
      e.preventDefault();
      e.stopPropagation();
      handleUnmatchClick(btn);
    });
  }

  function showBridgeUnavailable(page, message) {
    var ctaStack = qs(".match-cta-stack", page);
    var error = qs("[data-match-bridge-error]", page);
    if (!error) {
      error = document.createElement("p");
      error.className = "match-bridge__error";
      error.setAttribute("data-match-bridge-error", "");
      var desc = qs(".match-bridge__desc", page);
      if (desc && desc.parentNode) {
        desc.parentNode.insertBefore(error, desc.nextSibling);
      } else if (ctaStack && ctaStack.parentNode) {
        ctaStack.parentNode.insertBefore(error, ctaStack);
      }
    }
    error.hidden = false;
    error.textContent = message;
    if (ctaStack) ctaStack.hidden = true;
  }

  function initTalkBridgeGuard() {
    var page = qs('[data-page="match-talk-bridge"]');
    if (!page || !isEdgeMode()) return;

    var params = new URLSearchParams(window.location.search);
    var pairId = params.get("pair_id") || page.getAttribute("data-match-pair-id") || "";
    if (!pairId) return;

    var api = getApi();
    if (!api || typeof api.listPairs !== "function") return;

    api.listPairs().then(function (result) {
      if (!result || !result.ok || !Array.isArray(result.pairs)) return;
      var found = result.pairs.some(function (pair) {
        return String(pair.pair_id) === String(pairId);
      });
      if (!found) {
        showBridgeUnavailable(
          page,
          "このマッチは解除済みか、表示できません。マッチ一覧に戻ってください。",
        );
      }
    });
  }

  window.MatchUnmatchWiring = {
    handleUnmatchClick: handleUnmatchClick,
    refreshList: refreshList,
    initTalkBridgeGuard: initTalkBridgeGuard,
  };

  document.addEventListener("DOMContentLoaded", function () {
    initListUnmatchWiring();
    initTalkBridgeGuard();
  });
})();
