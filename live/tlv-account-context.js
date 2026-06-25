/**
 * TLV — アカウントメニュー文脈（動画視聴 / Studio）
 */
(function (global) {
  "use strict";

  const STUDIO_TLV_PAGES = Object.freeze([
    "channel-content",
    "creator",
    "studio-dashboard",
    "studio-analytics",
    "studio-community",
    "studio-subtitles",
    "studio-copyright",
    "studio-monetization",
    "studio-customization",
    "studio-audio",
  ]);

  function resolveContext(doc = global.document) {
    const body = doc?.body;
    if (!body) return "view";

    const explicit = String(body.dataset.tlvAccountContext || "").trim();
    if (explicit === "studio" || explicit === "view") return explicit;

    if (body.dataset.studioNav) return "studio";

    const tlvPage = String(body.dataset.tlvPage || "").trim();
    if (tlvPage && STUDIO_TLV_PAGES.includes(tlvPage)) return "studio";

    const page = String(body.dataset.page || "").trim();
    if (page === "live-channel-content" || page === "live-creator-dashboard") return "studio";
    if (page.startsWith("live-studio-")) return "studio";

    return "view";
  }

  function isStudio(doc) {
    return resolveContext(doc) === "studio";
  }

  function isView(doc) {
    return resolveContext(doc) === "view";
  }

  global.TasuTlvAccountContext = {
    STUDIO_TLV_PAGES,
    resolveContext,
    isStudio,
    isView,
  };
})(typeof window !== "undefined" ? window : globalThis);
