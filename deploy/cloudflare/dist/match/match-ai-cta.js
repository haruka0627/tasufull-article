/**
 * TASFUL MATCH — TASFUL AI CTA links only (no embedded AI UI)
 */
(function () {
  "use strict";

  function qs(sel, root) {
    return (root || document).querySelectorAll(sel);
  }

  function applyTemplate(template, vars) {
    var out = String(template || "");
    Object.keys(vars || {}).forEach(function (key) {
      out = out.split("{" + key + "}").join(String(vars[key] ?? ""));
    });
    return out;
  }

  function resolveCtaLinks(root) {
    var links = window.TasuAiWorkspaceLinks;
    if (!links || typeof links.buildMatchCtaUrl !== "function") return;

    qs("[data-match-ai-cta]", root).forEach(function (el) {
      if (el.tagName !== "A") return;
      var mode = el.getAttribute("data-ai-mode") || "match-profile-coach";
      var template = el.getAttribute("data-ai-q-template") || el.getAttribute("data-ai-q") || "";
      var percent = el.getAttribute("data-ai-percent") || document.querySelector("[data-match-completeness-text]")?.textContent?.match(/\d+/)?.[0] || "80";
      var nickname = el.getAttribute("data-ai-nickname") || "相手";
      var compatPercent = el.getAttribute("data-compat-percent") || el.closest("[data-match-profile-card]")?.querySelector("[data-match-compat-score]")?.getAttribute("data-compat-percent") || "78";
      var compatCount = el.getAttribute("data-compat-count") || "3";

      var q = applyTemplate(template, {
        percent: percent,
        nickname: nickname,
        count: compatCount,
      });

      if (!q && mode === "match-profile-coach") {
        q = "マッチング用プロフィールを改善したいです。現在の完成度は" + percent + "%です。";
      }

      el.href = links.buildMatchCtaUrl({
        mode: mode,
        q: q,
        returnTo: window.location.pathname + window.location.search,
      });
      el.setAttribute("rel", "noopener");
    });
  }

  window.MatchAiCta = {
    resolveCtaLinks: resolveCtaLinks,
    applyTemplate: applyTemplate,
  };

  document.addEventListener("DOMContentLoaded", function () {
    resolveCtaLinks(document);
  });
})();
