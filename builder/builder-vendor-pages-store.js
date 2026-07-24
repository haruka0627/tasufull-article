/**
 * Builder — 業者ページ localStorage ストア（demo · 本番DB/Stripe 未接続）
 * 将来 Business Directory 連携: listPublishedForBusinessDirectory()
 */
(function (global) {
  "use strict";

  const VENDOR_PAGES_KEY = "tasful:builder:vendor-pages:v1";
  const VENDOR_DRAFTS_KEY = "tasful:builder:vendor-page-drafts:v1";
  const VENDOR_SUBSCRIPTIONS_KEY = "tasful:builder:vendor-subscriptions:v1";

  const DEFAULT_SUBSCRIPTION = Object.freeze({
    plan: "pro_demo",
    planLabel: "Pro（デモ）",
    status: "active",
    renewAt: "",
  });

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function readJson(key, fallback) {
    try {
      const raw = global.localStorage?.getItem(key);
      const parsed = raw ? JSON.parse(raw) : fallback;
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      global.localStorage?.setItem(key, JSON.stringify(value));
      global.dispatchEvent?.(new CustomEvent("builder:vendor-pages-changed", { detail: { key } }));
    } catch {
      /* ignore */
    }
  }

  function splitCsv(text) {
    return String(text || "")
      .split(/[,、\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function emptyPage(overrides) {
    const now = new Date().toISOString();
    const pageId = pickStr(overrides?.pageId) || uid("vendor-page");
    return {
      pageId,
      partner_id: pageId,
      companyName: "",
      representativeName: "",
      areas: [],
      areasText: "",
      trades: [],
      tradesText: "",
      intro: "",
      strengths: "",
      achievements: "",
      priceGuide: "",
      businessHours: "",
      phone: "",
      email: "",
      address: "",
      website: "",
      seoTitle: "",
      seoDescription: "",
      publishStatus: "draft",
      subscriptionPlan: "pro_demo",
      businessDirectoryEnabled: false,
      customHtml: "",
      customCss: "",
      createdAt: now,
      updatedAt: now,
      publishedAt: "",
      ...overrides,
    };
  }

  function normalizePage(raw) {
    if (!raw || typeof raw !== "object") return null;
    const pageId = pickStr(raw.pageId, raw.partner_id) || uid("vendor-page");
    const areas = Array.isArray(raw.areas) ? raw.areas.map(String) : splitCsv(raw.areasText);
    const trades = Array.isArray(raw.trades) ? raw.trades.map(String) : splitCsv(raw.tradesText);
    return {
      ...emptyPage({ pageId }),
      ...raw,
      pageId,
      partner_id: pageId,
      areas,
      areasText: pickStr(raw.areasText, areas.join("、")),
      trades,
      tradesText: pickStr(raw.tradesText, trades.join("、")),
      publishStatus: pickStr(raw.publishStatus, "draft"),
      businessDirectoryEnabled: Boolean(raw.businessDirectoryEnabled),
      updatedAt: pickStr(raw.updatedAt) || new Date().toISOString(),
    };
  }

  function readPages() {
    const list = readJson(VENDOR_PAGES_KEY, []);
    return (Array.isArray(list) ? list : []).map(normalizePage).filter(Boolean);
  }

  function writePages(list) {
    writeJson(VENDOR_PAGES_KEY, list);
  }

  function getPage(pageId) {
    const id = pickStr(pageId);
    if (!id) return null;
    return readPages().find((p) => p.pageId === id) || null;
  }

  function upsertPage(page) {
    const row = normalizePage(page);
    if (!row) return null;
    const list = readPages();
    const idx = list.findIndex((p) => p.pageId === row.pageId);
    row.updatedAt = new Date().toISOString();
    if (idx >= 0) list[idx] = { ...list[idx], ...row };
    else list.unshift(row);
    writePages(list);
    return row;
  }

  function createPage(partial) {
    return upsertPage(emptyPage(partial || {}));
  }

  function deletePage(pageId) {
    const id = pickStr(pageId);
    const list = readPages().filter((p) => p.pageId !== id);
    writePages(list);
    const drafts = readJson(VENDOR_DRAFTS_KEY, {});
    if (drafts[id]) {
      delete drafts[id];
      writeJson(VENDOR_DRAFTS_KEY, drafts);
    }
    return { ok: true };
  }

  function saveDraft(pageId, patch) {
    const id = pickStr(pageId);
    if (!id) return null;
    const drafts = readJson(VENDOR_DRAFTS_KEY, {});
    drafts[id] = {
      ...(drafts[id] || {}),
      ...patch,
      pageId: id,
      savedAt: new Date().toISOString(),
    };
    writeJson(VENDOR_DRAFTS_KEY, drafts);
    return drafts[id];
  }

  function getDraft(pageId) {
    const id = pickStr(pageId);
    const drafts = readJson(VENDOR_DRAFTS_KEY, {});
    return id ? drafts[id] || null : null;
  }

  function clearDraft(pageId) {
    const id = pickStr(pageId);
    const drafts = readJson(VENDOR_DRAFTS_KEY, {});
    if (drafts[id]) {
      delete drafts[id];
      writeJson(VENDOR_DRAFTS_KEY, drafts);
    }
  }

  function publishPage(pageId) {
    const page = getPage(pageId);
    if (!page) return { ok: false, reason: "not_found" };
    if (!pickStr(page.companyName)) return { ok: false, reason: "company_required" };
    const now = new Date().toISOString();
    const row = upsertPage({
      ...page,
      publishStatus: "published",
      publishedAt: now,
    });
    return row ? { ok: true, ...row } : { ok: false, reason: "save_failed" };
  }

  function unpublishPage(pageId) {
    const page = getPage(pageId);
    if (!page) return { ok: false, reason: "not_found" };
    const row = upsertPage({ ...page, publishStatus: "unpublished" });
    return row ? { ok: true, ...row } : { ok: false, reason: "save_failed" };
  }

  function listPublished() {
    return readPages().filter((p) => p.publishStatus === "published");
  }

  /** 将来 BD 連携用 — 現状はフラグのみ */
  function listPublishedForBusinessDirectory() {
    return listPublished().filter((p) => p.businessDirectoryEnabled);
  }

  function getSubscription(ownerId) {
    const id = pickStr(ownerId, "demo-partner-owner");
    const map = readJson(VENDOR_SUBSCRIPTIONS_KEY, {});
    return { ...DEFAULT_SUBSCRIPTION, ...(map[id] || {}) };
  }

  function setSubscription(ownerId, patch) {
    const id = pickStr(ownerId, "demo-partner-owner");
    const map = readJson(VENDOR_SUBSCRIPTIONS_KEY, {});
    map[id] = {
      ...DEFAULT_SUBSCRIPTION,
      ...(map[id] || {}),
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    writeJson(VENDOR_SUBSCRIPTIONS_KEY, map);
    return map[id];
  }

  function toPartnerRecord(page) {
    const p = normalizePage(page);
    if (!p) return null;
    return {
      partner_id: p.pageId,
      display_name: p.companyName || "無題の業者",
      partner_type: "company",
      trades: p.trades,
      areas: p.areas,
      headline: pickStr(p.intro, p.seoTitle).slice(0, 120),
      profile: pickStr(p.intro, p.strengths),
      contact_policy: "tasful_talk_only",
      availability: "available",
      status: "active",
      rating: null,
      source: "vendor_page",
      vendorPage: true,
      businessDirectoryEnabled: p.businessDirectoryEnabled,
      representativeName: p.representativeName,
      vendorPageData: p,
    };
  }

  function listPublishedForSearch() {
    return listPublished().map(toPartnerRecord).filter(Boolean);
  }

  function getContactForPartner(partnerId) {
    const page = getPage(partnerId);
    if (!page) return null;
    return {
      name: pickStr(page.representativeName, page.companyName),
      phone: pickStr(page.phone),
      email: pickStr(page.email),
    };
  }

  function resolvePartnerById(partnerId) {
    const page = getPage(partnerId);
    if (page && page.publishStatus === "published") return toPartnerRecord(page);
    return null;
  }

  global.TasuBuilderVendorPagesStore = {
    VENDOR_PAGES_KEY,
    VENDOR_DRAFTS_KEY,
    VENDOR_SUBSCRIPTIONS_KEY,
    readPages,
    getPage,
    createPage,
    upsertPage,
    deletePage,
    saveDraft,
    getDraft,
    clearDraft,
    publishPage,
    unpublishPage,
    listPublished,
    listPublishedForSearch,
    listPublishedForBusinessDirectory,
    getSubscription,
    setSubscription,
    toPartnerRecord,
    getContactForPartner,
    resolvePartnerById,
    splitCsv,
    emptyPage,
  };
})(typeof window !== "undefined" ? window : globalThis);
