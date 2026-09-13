/**
 * TASFUL Builder — nav foundation
 * LEGACY_URLS.partnerRegister → /builder/provider-profile.html
 */
(function (global) {
  "use strict";

  const LEGACY_URLS = {
    postJob: "/builder/new-project.html",
    partnerRegister: "/builder/provider-profile.html",
    mvpPost: "/builder/mvp-post.html",
    mvpPartnerRegister: "/builder/mvp-partner-register.html",
    findJobs: "/public-board.html",
    findWorkers: "/builder/find-workers.html",
    iwasho: "/partner-register.html?source=builder",
  };

  function resolveNavHref(kind) {
    if (kind === "partner_register" || kind === "register_worker") return LEGACY_URLS.partnerRegister;
    if (kind === "post_job") return LEGACY_URLS.postJob;
    return LEGACY_URLS[kind] || "";
  }

  global.TasuBuilderNavFoundation = {
    LEGACY_URLS,
    resolveNavHref,
  };
})(typeof window !== "undefined" ? window : globalThis);
