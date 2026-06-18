/**
 * TASFUL AI ワークスペース — 共通入口URL
 * AI相談・検索・案内の導線は原則 ai-workspace.html へ統一
 */
(function (global) {
  "use strict";

  const DEFAULT_PAGE = "ai-workspace.html";
  const DEFAULT_MODE = "cross-matching";

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function resolveBasePath(opts) {
    if (pickStr(opts?.basePath)) return String(opts.basePath).replace(/\/?$/, "/");
    if (opts?.fromBuilder === true) return "../ai-workspace.html";
    return DEFAULT_PAGE;
  }

  /**
   * @param {{
   *   mode?: string,
   *   q?: string,
   *   listingId?: string,
   *   listingType?: string,
   *   send?: boolean,
   *   basePath?: string,
   *   fromBuilder?: boolean,
   * }} [opts]
   */
  function buildUrl(opts) {
    const o = opts || {};
    const base = resolveBasePath(o);
    const params = new URLSearchParams();
    const mode = pickStr(o.mode) || DEFAULT_MODE;
    params.set("mode", mode);
    const q = pickStr(o.q);
    if (q) params.set("q", q);
    const listingId = pickStr(o.listingId);
    if (listingId) params.set("listingId", listingId);
    const listingType = pickStr(o.listingType);
    if (listingType) params.set("listingType", listingType);
    if (o.send === true) params.set("send", "1");
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }

  /**
   * 掲載詳細からの AI 相談リンク
   * @param {{ id?: string, title?: string, listing_type?: string, business_type?: string }} listing
   */
  function buildListingConsultUrl(listing, opts) {
    const id = pickStr(listing?.id, listing?.listing_id);
    const title = pickStr(listing?.title, listing?.company_name, "この掲載");
    const listingType = pickStr(
      listing?.listing_type,
      listing?.business_type,
      listing?.type
    );
    const q = id
      ? `「${title}」について相談したいです。条件や進め方を教えてください。`
      : "掲載について相談したいです。";
    return buildUrl({
      ...(opts || {}),
      mode: pickStr(opts?.mode) || DEFAULT_MODE,
      listingId: id,
      listingType,
      q,
    });
  }

  global.TasuAiWorkspaceLinks = {
    DEFAULT_PAGE,
    DEFAULT_MODE,
    buildUrl,
    buildListingConsultUrl,
  };
})(typeof window !== "undefined" ? window : globalThis);
