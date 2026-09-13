/**
 * TASFUL Builder — search cards → canonical detail
 * provider → provider-detail.html?id=
 * jobs → project-detail.html?id=
 */
(function (global) {
  "use strict";

  function routes() {
    return global.TasuBuilderCanonicalRoutes;
  }

  function cardId(el) {
    return (
      el.getAttribute("data-builder-fw-card") ||
      el.getAttribute("data-partner-id") ||
      el.getAttribute("data-project-id") ||
      el.getAttribute("data-id") ||
      el.getAttribute("data-canonical-id") ||
      ""
    );
  }

  function rewriteProviderLinks(root) {
    const R = routes();
    if (!R) return;
    (root || document).querySelectorAll("[data-builder-fw-card], [data-builder-partner-row], [data-provider-card]").forEach((card) => {
      const id = cardId(card);
      if (!id) return;
      const href = R.providerDetailHref(id);
      card.querySelectorAll("a[href], [data-builder-fw-demo], [data-builder-partner-open]").forEach((el) => {
        const label = String(el.textContent || "");
        const isDetail = /詳細/.test(label) || el.hasAttribute("data-builder-partner-open") || el.matches("[data-builder-fw-demo]");
        const isFav = /お気に入り/.test(label) || el.hasAttribute("data-cta-favorite") || el.hasAttribute("data-builder-fav-btn");
        if (isFav) return;
        if (!isDetail && el.tagName !== "A") return;
        if (el.tagName === "A") {
          el.setAttribute("href", href);
        } else {
          el.addEventListener(
            "click",
            (ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              window.location.href = href;
            },
            { capture: true }
          );
        }
        el.dataset.detailBridge = "provider";
      });
      if (!card.querySelector("a[href]")) {
        card.style.cursor = "pointer";
        card.addEventListener("click", () => {
          window.location.href = href;
        });
      }
    });
  }

  function rewriteJobLinks(root) {
    const R = routes();
    if (!R) return;
    (root || document).querySelectorAll("[data-project-id], [data-job-card], a[href*='mvp-project-detail'], a[href*='board-project-detail']").forEach((el) => {
      const href = el.getAttribute("href") || "";
      const id =
        el.getAttribute("data-project-id") ||
        el.getAttribute("data-id") ||
        (href ? new URL(href, window.location.href).searchParams.get("id") : "") ||
        "";
      if (!id) return;
      if (el.tagName === "A") {
        el.setAttribute("href", R.projectDetailHref(id));
        el.dataset.detailBridge = "job";
      }
    });
  }

  function interceptFindWorkersDemo() {
    const page = document.body?.getAttribute("data-page");
    if (page !== "builder-find-workers") return;
    document.addEventListener(
      "click",
      (ev) => {
        const btn = ev.target?.closest?.("[data-builder-fw-demo]");
        if (!btn) return;
        if (/お気に入り/.test(btn.textContent || "")) return;
        const card = btn.closest("[data-builder-fw-card]");
        const id = card?.getAttribute("data-builder-fw-card") || "";
        if (!id) return;
        ev.preventDefault();
        ev.stopPropagation();
        const href = routes()?.providerDetailHref(id);
        if (href) window.location.href = href;
      },
      true
    );
  }

  function init() {
    rewriteProviderLinks(document);
    rewriteJobLinks(document);
    interceptFindWorkersDemo();
    const results = document.querySelector("[data-builder-fw-results], [data-builder-partner-results], [data-builder-top-projects]");
    if (results && typeof MutationObserver !== "undefined") {
      const obs = new MutationObserver(() => {
        rewriteProviderLinks(results);
        rewriteJobLinks(results);
      });
      obs.observe(results, { childList: true, subtree: true });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  global.TasuBuilderSearchDetailBridge = { rewriteProviderLinks, rewriteJobLinks };
})(typeof window !== "undefined" ? window : globalThis);
