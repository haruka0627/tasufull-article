/**
 * TASFUL MATCH — login required UX (401 / no real JWT on protected pages)
 */
(function (global) {
  "use strict";

  var MESSAGE =
    "TASFUL MATCH を利用するにはログインが必要です。\nログイン後、招待制βの参加条件を確認できます。";

  var LOGIN_HREF = "../dashboard.html";
  var TOP_HREF = "match-top.html";

  function isProtectedPage() {
    return Boolean(
      document.querySelector("[data-match-requires-login]") ||
        document.body?.getAttribute("data-match-requires-login") === "1",
    );
  }

  function shouldBypass() {
    var params = new URLSearchParams(global.location?.search || "");
    if (params.get("client_stub") === "1") return true;

    var auth = global.TasfulMatchAuth;
    if (!auth) return false;

    if (auth.isDemoMode?.() && !auth.isProductionHost?.()) {
      var token = auth.getAccessToken?.() || "";
      if (!token || token.indexOf("stub-match-token") >= 0) return true;
    }

    return false;
  }

  function hasRealSession() {
    var auth = global.TasfulMatchAuth;
    if (!auth) return false;
    var token = auth.getAccessToken?.() || "";
    return auth.isRealJwt?.(token) || (token && token.indexOf("stub-match-token") < 0 && token.split(".").length === 3);
  }

  function isUnauthorized(result) {
    if (!result || result.ok) return false;
    var code = String(result.code || result.error || "");
    if (code === "unauthorized" || code === "auth_required" || code === "login_required") return true;
    return Number(result.status) === 401;
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
    if (document.querySelector("[data-match-login-gate]")) return;
    if (document.querySelector("[data-match-beta-gate]")) return;

    var root = findMainRoot();
    if (!root) return;

    var panel = document.createElement("section");
    panel.className = "match-login-gate";
    panel.setAttribute("data-match-login-gate", "");
    panel.setAttribute("role", "alert");
    panel.innerHTML =
      '<div class="match-login-gate__card">' +
      '<p class="match-login-gate__eyebrow">ログインが必要です</p>' +
      '<h2 class="match-login-gate__title">MATCHをはじめる</h2>' +
      '<p class="match-login-gate__message"></p>' +
      '<div class="match-login-gate__actions">' +
      '<a class="match-btn match-btn--primary" data-match-login-cta href="' + LOGIN_HREF + '">ログインする</a>' +
      '<a class="match-btn match-btn--secondary" data-match-top-cta href="' + TOP_HREF + '">TASFULトップへ戻る</a>' +
      "</div>" +
      "</div>";

    panel.querySelector(".match-login-gate__message").textContent = MESSAGE;

    if (root.classList && root.classList.contains("match-main")) {
      root.innerHTML = "";
      root.appendChild(panel);
    } else {
      root.prepend(panel);
    }

    document.dispatchEvent(new CustomEvent("match:login-gate-shown"));
  }

  function handleApiResult(result) {
    if (!isUnauthorized(result)) return false;
    show();
    return true;
  }

  function maybeShowForPage() {
    if (!isProtectedPage()) return false;
    if (shouldBypass()) return false;
    if (hasRealSession()) return false;
    show();
    return true;
  }

  global.MatchLoginGate = {
    MESSAGE: MESSAGE,
    LOGIN_HREF: LOGIN_HREF,
    isProtectedPage: isProtectedPage,
    shouldBypass: shouldBypass,
    hasRealSession: hasRealSession,
    isUnauthorized: isUnauthorized,
    show: show,
    handleApiResult: handleApiResult,
    maybeShowForPage: maybeShowForPage,
  };
})(typeof window !== "undefined" ? window : globalThis);
