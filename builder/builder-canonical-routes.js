/**
 * TASFUL Builder — Canonical Rich 4-page routes (LEGACY_COMPAT は削除しない)
 * 視覚 SSOT は Rich。MVP 暗色ページは互換ルートのまま残す。
 */
(function (global) {
  "use strict";

  const CANONICAL = Object.freeze({
    NEW_PROJECT: "new-project.html",
    PROVIDER_PROFILE: "provider-profile.html",
    PROVIDER_DETAIL: "provider-detail.html",
    PROJECT_DETAIL: "project-detail.html",
  });

  const LEGACY_COMPAT = Object.freeze({
    MVP_POST: "mvp-post.html",
    MVP_PROJECT_NEW: "mvp-project-new.html",
    MVP_PARTNER_REGISTER: "mvp-partner-register.html",
    MVP_PROJECT_DETAIL: "mvp-project-detail.html",
    BOARD_PROJECT_DETAIL: "board-project-detail.html",
    PARTNER_HTML: "partner.html",
    PARTNER_DETAIL: "partner-detail.html",
  });

  function withId(page, id, extra) {
    const q = new URLSearchParams(extra || {});
    if (id) q.set("id", String(id));
    const qs = q.toString();
    return qs ? `${page}?${qs}` : page;
  }

  function projectDetailHref(id, extra) {
    return withId(CANONICAL.PROJECT_DETAIL, id, extra);
  }

  function providerDetailHref(id, extra) {
    return withId(CANONICAL.PROVIDER_DETAIL, id, extra);
  }

  function providerProfileHref(id, extra) {
    return withId(CANONICAL.PROVIDER_PROFILE, id, extra);
  }

  function isIwashoPartnerRegister(href) {
    const s = String(href || "");
    return /partner-register\.html/i.test(s) && !/mvp-partner-register/i.test(s);
  }

  function isLegacyJobCreate(href) {
    const s = String(href || "");
    return /mvp-post\.html|mvp-project-new\.html/i.test(s);
  }

  function isLegacyProviderRegister(href) {
    const s = String(href || "");
    return /mvp-partner-register\.html/i.test(s);
  }

  function isLegacyJobDetail(href) {
    const s = String(href || "");
    return /mvp-project-detail\.html|board-project-detail\.html/i.test(s);
  }

  function isLegacyProviderDetail(href) {
    const s = String(href || "");
    return /(^|\/)partner\.html|(^|\/)partner-detail\.html/i.test(s);
  }

  global.TasuBuilderCanonicalRoutes = {
    CANONICAL,
    LEGACY_COMPAT,
    projectDetailHref,
    providerDetailHref,
    providerProfileHref,
    isIwashoPartnerRegister,
    isLegacyJobCreate,
    isLegacyProviderRegister,
    isLegacyJobDetail,
    isLegacyProviderDetail,
  };
})(typeof window !== "undefined" ? window : globalThis);
