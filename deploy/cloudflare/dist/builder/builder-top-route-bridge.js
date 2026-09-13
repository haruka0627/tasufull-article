/**
 * TASFUL Builder TOP route bridge
 * post_job → new-project.html
 * register_worker / partner_register → provider-profile.html
 * find_jobs / find workers / IWASHO は既存のまま
 * MVP ルートは削除しない（href 書換のみ）
 */
(function (global) {
  "use strict";

  const R = () => global.TasuBuilderCanonicalRoutes;

  function actionOf(el) {
    return String(el.getAttribute("data-builder-top-action") || el.getAttribute("data-action") || "").trim();
  }

  function shouldRemapPostJob(el) {
    const action = actionOf(el);
    if (action === "post_job" || action === "create_job") return true;
    const href = el.getAttribute("href") || "";
    return R()?.isLegacyJobCreate(href);
  }

  function shouldRemapProviderRegister(el) {
    const action = actionOf(el);
    if (action === "register_worker" || action === "partner_register") return true;
    const href = el.getAttribute("href") || "";
    if (R()?.isIwashoPartnerRegister(href)) return false;
    return R()?.isLegacyProviderRegister(href);
  }

  function shouldRemapJobDetail(el) {
    const href = el.getAttribute("href") || "";
    return R()?.isLegacyJobDetail(href);
  }

  function rewrite(el, next) {
    if (!el || !next) return;
    const url = new URL(el.getAttribute("href") || next, window.location.href);
    const dest = new URL(next, window.location.href);
    url.searchParams.forEach((v, k) => {
      if (!dest.searchParams.has(k)) dest.searchParams.set(k, v);
    });
    el.setAttribute("href", dest.pathname.split("/").pop() + (dest.search || ""));
    el.dataset.routeBridge = "rewritten";
  }

  function dispatchTopAction(action, href) {
    const routes = R();
    const a = String(action || "");
    const h = String(href || "");
    if (a === "post_job" || /mvp-post\.html/i.test(h)) return routes?.CANONICAL.NEW_PROJECT || "new-project.html";
    if (a === "register_worker" || a === "partner_register" || /mvp-partner-register\.html/i.test(h)) {
      return routes?.CANONICAL.PROVIDER_PROFILE || "provider-profile.html";
    }
    return h;
  }

  function apply(root) {
    const routes = R();
    if (!routes) return;
    const scope = root || document;
    scope.querySelectorAll("a[href]").forEach((a) => {
      if (shouldRemapPostJob(a)) {
        rewrite(a, dispatchTopAction("post_job", a.getAttribute("href") || "mvp-post.html"));
        return;
      }
      if (shouldRemapProviderRegister(a)) {
        rewrite(a, dispatchTopAction("partner_register", a.getAttribute("href") || "mvp-partner-register.html"));
        return;
      }
      if (shouldRemapJobDetail(a) && a.closest("[data-builder-top-projects], [data-builder-top-project-card]")) {
        const href = a.getAttribute("href") || "";
        const id = new URL(href, window.location.href).searchParams.get("id") || "";
        rewrite(a, routes.projectDetailHref(id));
      }
    });
  }

  function init() {
    apply(document);
    const host = document.querySelector("[data-builder-top-projects]");
    if (host && typeof MutationObserver !== "undefined") {
      const obs = new MutationObserver(() => apply(host));
      obs.observe(host, { childList: true, subtree: true });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  global.TasuBuilderTopRouteBridge = { apply, dispatchTopAction };
})(typeof window !== "undefined" ? window : globalThis);
