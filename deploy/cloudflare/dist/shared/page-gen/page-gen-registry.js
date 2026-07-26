/**
 * TASFUL Page Gen — taxonomy registry (Phase 1 common engine)
 *
 * Holds vertical / service_type / category / page_kind / surface definitions.
 * Future verticals (EC · jobs · events · travel · used goods) are added by
 * registering packs here — the engine itself must not branch on kind ids.
 */
(function (global) {
  "use strict";

  const VERTICAL = Object.freeze({
    LOCAL_SERVICE: "local_service",
    RETAIL: "retail",
    CONSTRUCTION: "construction",
    MARKETPLACE: "marketplace",
    JOBS: "jobs",
    EVENTS: "events",
    TRAVEL: "travel",
    EC: "ec",
    USED_GOODS: "used_goods",
    REAL_ESTATE: "real_estate",
  });

  const SURFACE = Object.freeze({
    PLATFORM: "platform",
    BUILDER: "builder",
    BUSINESS_DIRECTORY: "business_directory",
  });

  /** AI execution routes stay separated per AD-002 / AD-003. */
  const AI_ROUTE = Object.freeze({
    GATEWAY: "gateway",
    BUILDER_AI: "builder_ai",
    BD_EDGE: "bd_edge",
  });

  const verticals = new Map();
  const pageKinds = new Map();
  const surfaces = new Map();

  function freezeDeep(value) {
    if (Array.isArray(value)) return Object.freeze(value.map(freezeDeep));
    if (value && typeof value === "object") {
      Object.keys(value).forEach((k) => {
        value[k] = freezeDeep(value[k]);
      });
      return Object.freeze(value);
    }
    return value;
  }

  function requireId(id, label) {
    const s = String(id || "").trim();
    if (!s) throw new Error(`${label} id required`);
    return s;
  }

  function registerVertical(def) {
    const id = requireId(def?.id, "vertical");
    const entry = freezeDeep({
      id,
      label: String(def.label || id),
      keywords: Array.isArray(def.keywords) ? def.keywords.slice() : [],
    });
    verticals.set(id, entry);
    return entry;
  }

  /**
   * @param {object} def
   *   id, label, vertical, jsonLdType, slots[], blocks[], actions{}, listingFieldMap{}
   *   serviceTypes[] — optional finer classification hints (extension point)
   */
  function registerPageKind(def) {
    const id = requireId(def?.id, "page_kind");
    const entry = freezeDeep({
      id,
      label: String(def.label || id),
      vertical: String(def.vertical || VERTICAL.LOCAL_SERVICE),
      jsonLdType: String(def.jsonLdType || "LocalBusiness"),
      slots: Array.isArray(def.slots) ? def.slots.slice() : [],
      blocks: Array.isArray(def.blocks) ? def.blocks.slice() : [],
      serviceTypes: Array.isArray(def.serviceTypes) ? def.serviceTypes.slice() : [],
      keywords: Array.isArray(def.keywords) ? def.keywords.slice() : [],
      outcome: String(def.outcome || ""),
      actions: def.actions ? { ...def.actions } : {},
      listingFieldMap: def.listingFieldMap ? { ...def.listingFieldMap } : {},
    });
    pageKinds.set(id, entry);
    return entry;
  }

  /**
   * @param {object} def
   *   id, label, aiRoute, allowedKinds[], allowedActions[], requiresReview, planGate
   */
  function registerSurface(def) {
    const id = requireId(def?.id, "surface");
    const entry = freezeDeep({
      id,
      label: String(def.label || id),
      aiRoute: String(def.aiRoute || AI_ROUTE.GATEWAY),
      allowedKinds: Array.isArray(def.allowedKinds) ? def.allowedKinds.slice() : [],
      allowedActions: Array.isArray(def.allowedActions) ? def.allowedActions.slice() : [],
      requiresReview: Boolean(def.requiresReview),
      planGate: String(def.planGate || "none"),
    });
    surfaces.set(id, entry);
    return entry;
  }

  function getVertical(id) {
    return verticals.get(String(id || "")) || null;
  }

  function getPageKind(id) {
    return pageKinds.get(String(id || "")) || null;
  }

  function getSurface(id) {
    return surfaces.get(String(id || "")) || null;
  }

  function listVerticals() {
    return Array.from(verticals.values());
  }

  function listPageKinds(verticalId) {
    const all = Array.from(pageKinds.values());
    if (!verticalId) return all;
    return all.filter((k) => k.vertical === String(verticalId));
  }

  function listSurfaces() {
    return Array.from(surfaces.values());
  }

  function isKindAllowedOnSurface(kindId, surfaceId) {
    const surface = getSurface(surfaceId);
    if (!surface) return false;
    if (!surface.allowedKinds.length) return true;
    return surface.allowedKinds.includes(String(kindId));
  }

  function isActionAllowedOnSurface(actionKind, surfaceId) {
    const surface = getSurface(surfaceId);
    if (!surface) return false;
    if (!surface.allowedActions.length) return true;
    return surface.allowedActions.includes(String(actionKind));
  }

  function resolveJsonLdType(kindId) {
    return getPageKind(kindId)?.jsonLdType || "LocalBusiness";
  }

  function resolveAiRoute(surfaceId) {
    return getSurface(surfaceId)?.aiRoute || null;
  }

  // --- built-in verticals -------------------------------------------------
  registerVertical({ id: VERTICAL.LOCAL_SERVICE, label: "地域サービス", keywords: ["サービス", "施工", "修理", "清掃"] });
  registerVertical({ id: VERTICAL.RETAIL, label: "店舗・販売", keywords: ["店舗", "ショップ", "販売", "お店"] });
  registerVertical({ id: VERTICAL.CONSTRUCTION, label: "建設・工事", keywords: ["工事", "塗装", "リフォーム", "建設", "外壁"] });
  registerVertical({ id: VERTICAL.REAL_ESTATE, label: "不動産", keywords: ["不動産", "物件", "賃貸", "売買"] });

  // --- built-in page kinds ------------------------------------------------
  registerPageKind({
    id: "service",
    label: "サービス紹介ページ",
    vertical: VERTICAL.LOCAL_SERVICE,
    jsonLdType: "Service",
    outcome: "booking",
    keywords: ["サービス", "代行", "清掃", "修理", "出張"],
    slots: ["business_name", "service_summary", "area", "price_text", "hours_text", "strengths"],
    blocks: ["hero", "about", "services", "pricing", "area", "faq", "related_links", "cta"],
    actions: { primary: "tasful_booking", secondary: "talk_start" },
    listingFieldMap: {
      title: "seo.title",
      description: "profile.summary",
      category: "category.name",
      area: "profile.areas",
    },
  });

  registerPageKind({
    id: "shop",
    label: "店舗ページ",
    vertical: VERTICAL.RETAIL,
    jsonLdType: "LocalBusiness",
    outcome: "purchase",
    keywords: ["店舗", "お店", "ショップ", "販売"],
    slots: ["business_name", "service_summary", "area", "hours_text", "price_text", "images"],
    blocks: ["hero", "about", "gallery", "hours", "area", "faq", "related_links", "contact", "cta"],
    actions: { primary: "tasful_purchase", secondary: "inquiry_form" },
    listingFieldMap: {
      title: "seo.title",
      description: "profile.summary",
      category: "category.name",
      area: "profile.areas",
    },
  });

  registerPageKind({
    id: "vendor",
    label: "業者紹介ページ",
    vertical: VERTICAL.CONSTRUCTION,
    jsonLdType: "LocalBusiness",
    outcome: "request",
    keywords: ["業者", "工務店", "職人", "塗装", "リフォーム", "外壁"],
    slots: ["business_name", "service_summary", "area", "price_text", "strengths", "certifications"],
    blocks: ["hero", "about", "services", "pricing", "area", "faq", "related_links", "notice", "cta"],
    actions: { primary: "tasful_request", secondary: "talk_start" },
    listingFieldMap: {
      title: "seo.title",
      description: "profile.summary",
      category: "category.name",
      area: "profile.areas",
    },
  });

  // --- built-in surfaces --------------------------------------------------
  registerSurface({
    id: SURFACE.PLATFORM,
    label: "Platform",
    aiRoute: AI_ROUTE.GATEWAY,
    allowedKinds: ["service", "shop"],
    allowedActions: ["tasful_purchase", "tasful_booking", "tasful_request", "talk_start", "inquiry_form"],
    requiresReview: false,
    planGate: "platform",
  });

  registerSurface({
    id: SURFACE.BUILDER,
    label: "Builder",
    aiRoute: AI_ROUTE.BUILDER_AI,
    allowedKinds: ["vendor", "service"],
    allowedActions: ["tasful_request", "tasful_booking", "talk_start", "contact_reveal", "inquiry_form"],
    requiresReview: false,
    planGate: "builder_subscription",
  });

  registerSurface({
    id: SURFACE.BUSINESS_DIRECTORY,
    label: "Business Directory",
    aiRoute: AI_ROUTE.BD_EDGE,
    allowedKinds: ["shop", "service"],
    allowedActions: ["tasful_purchase", "tasful_booking", "tasful_request", "talk_start", "inquiry_form"],
    requiresReview: true,
    planGate: "bd_plan",
  });

  global.TasuPageGenRegistry = {
    VERTICAL,
    SURFACE,
    AI_ROUTE,
    registerVertical,
    registerPageKind,
    registerSurface,
    getVertical,
    getPageKind,
    getSurface,
    listVerticals,
    listPageKinds,
    listSurfaces,
    isKindAllowedOnSurface,
    isActionAllowedOnSurface,
    resolveJsonLdType,
    resolveAiRoute,
  };
})(typeof window !== "undefined" ? window : globalThis);
