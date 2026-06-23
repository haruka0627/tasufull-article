/**
 * TASFUL MATCH — closed beta gate UI (403 match_beta_not_allowed)
 */
(function (global) {
  "use strict";

  var MESSAGE =
    "TASFUL MATCH は現在、招待制βです。\n参加を希望する場合は、運営からの案内をお待ちください。";

  function isBetaNotAllowed(result) {
    if (!result || result.ok) return false;
    var code = String(result.code || result.error || "");
    return code === "match_beta_not_allowed";
  }

  function findMainRoot() {
    return (
      document.querySelector(".match-main") ||
      document.querySelector("[data-match-page]") ||
      document.querySelector(".match-shell") ||
      document.body
    );
  }

  function show() {
    if (document.querySelector("[data-match-beta-gate]")) return;

    var root = findMainRoot();
    if (!root) return;

    var panel = document.createElement("section");
    panel.className = "match-beta-gate";
    panel.setAttribute("data-match-beta-gate", "");
    panel.setAttribute("role", "alert");
    panel.innerHTML =
      '<div class="match-beta-gate__card">' +
      '<p class="match-beta-gate__eyebrow">招待制β</p>' +
      '<h2 class="match-beta-gate__title">ご利用いただけません</h2>' +
      '<p class="match-beta-gate__message"></p>' +
      '<p class="match-beta-gate__hint"><a href="match-top.html">MATCHトップへ戻る</a></p>' +
      "</div>";

    panel.querySelector(".match-beta-gate__message").textContent = MESSAGE;

    if (root.classList && root.classList.contains("match-main")) {
      root.innerHTML = "";
      root.appendChild(panel);
    } else {
      root.prepend(panel);
    }

    document.dispatchEvent(new CustomEvent("match:beta-gate-shown"));
  }

  function handleApiResult(result) {
    if (!isBetaNotAllowed(result)) return false;
    show();
    return true;
  }

  global.MatchBetaGate = {
    MESSAGE: MESSAGE,
    isBetaNotAllowed: isBetaNotAllowed,
    show: show,
    handleApiResult: handleApiResult,
  };
})(typeof window !== "undefined" ? window : globalThis);
