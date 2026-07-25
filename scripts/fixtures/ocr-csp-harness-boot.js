/**
 * CSP harness bootstrap（test-ocr-csp-surfaces.mjs 用 · inline script 回避）
 */
(function () {
  "use strict";

  var state = { requests: [], violations: [], last: null };
  window.__csp = state;

  window.TASU_CHAT_OCR_CONFIG = { provider: "gemini" };
  window.TasuSupabase = {
    getClient: function () {
      return {
        auth: {
          getSession: async function () {
            return { data: { session: { access_token: "csp-token" } } };
          },
        },
      };
    },
  };

  window.fetch = async function (url, init) {
    state.requests.push({
      url: String(url),
      body: init && init.body ? String(init.body) : "",
    });
    return {
      ok: true,
      status: 200,
      json: async function () {
        return { ok: true, text: "csp-ok" };
      },
    };
  };

  document.addEventListener("securitypolicyviolation", function (ev) {
    state.violations.push({
      violatedDirective: String(ev.violatedDirective || ""),
      blockedURI: String(ev.blockedURI || ""),
      effectiveDirective: String(ev.effectiveDirective || ""),
    });
  });

  window.__run = function (dataUrl) {
    state.last = null;
    window.TasuChatOcr.extractTextFromImage(dataUrl, {
      surface: "chat",
      user_id: "u",
    }).then(function (r) {
      state.last = r;
      var out = document.getElementById("out");
      if (out) out.textContent = r.ok ? "ok" : String(r.error || "ng");
    });
  };
})();
