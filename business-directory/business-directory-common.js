/**
 * Business Directory Owner UI — shared helpers
 */
(function (global) {
  "use strict";

  const STATUS_LABELS = {
    draft: "下書き",
    review_requested: "審査中",
    published: "公開中",
    rejected: "差戻し",
    suspended: "停止",
    unpublished: "非公開",
    archived: "退会済",
  };

  const TYPE_LABELS = {
    shop_retail: "店舗・販売",
    business_service: "業務サービス",
  };

  const SUBMIT_STATUSES = new Set(["draft", "rejected", "unpublished", "suspended"]);
  const EDIT_LOCKED_STATUSES = new Set(["review_requested", "suspended", "archived"]);
  const REAPPLY_HINT_STATUSES = new Set(["published"]);

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function qsa(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function statusLabel(status) {
    return STATUS_LABELS[status] || status;
  }

  function typeLabel(t) {
    return TYPE_LABELS[t] || t;
  }

  function isEditLocked(status) {
    return EDIT_LOCKED_STATUSES.has(String(status));
  }

  function canSubmitForReview(status) {
    return SUBMIT_STATUSES.has(String(status));
  }

  function formatDate(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString("ja-JP");
    } catch {
      return "—";
    }
  }

  function toast(el, message, kind) {
    if (!el) return;
    el.hidden = false;
    el.textContent = message;
    el.dataset.kind = kind || "info";
    clearTimeout(el._bdToastTimer);
    el._bdToastTimer = setTimeout(() => {
      el.hidden = true;
    }, 4200);
  }

  function useMockMode() {
    try {
      return new URLSearchParams(global.location.search).get("bdMock") === "1";
    } catch {
      return false;
    }
  }

  function mockStorageKey() {
    return "bd_mock_listings_v1";
  }

  function readMockListings() {
    try {
      const raw = global.localStorage.getItem(mockStorageKey());
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function writeMockListings(list) {
    global.localStorage.setItem(mockStorageKey(), JSON.stringify(list));
  }

  function createMockRepository() {
    const uid = () => crypto.randomUUID?.() || String(Date.now());

    return {
      createDraftListing: async (body) => {
        const list = readMockListings();
        const listing = {
          id: uid(),
          owner_user_id: "mock-owner",
          listing_type: body.listing_type,
          status: "draft",
          plan_code: body.plan_code || "free",
          category_id: body.category_id,
          display_name: body.display_name,
          slug: (body.display_name || "listing").toLowerCase().replace(/\s+/g, "-"),
          service_areas: body.service_areas || [],
          hp_mode: body.hp_mode || "full_page",
          website_url: body.website_url || null,
          updated_at: new Date().toISOString(),
          published_at: null,
        };
        list.unshift(listing);
        writeMockListings(list);
        return { listing };
      },
      updateDraftListing: async (listingId, body) => {
        const list = readMockListings();
        const idx = list.findIndex((l) => l.id === listingId);
        if (idx < 0) throw Object.assign(new Error("not_found"), { code: "not_found" });
        let listing = list[idx];
        if (listing.status === "rejected") listing = { ...listing, status: "draft" };
        listing = { ...listing, ...body, updated_at: new Date().toISOString() };
        list[idx] = listing;
        writeMockListings(list);
        return { listing };
      },
      getOwnerListings: async () => ({ listings: readMockListings() }),
      getOwnerListingDetail: async (listingId) => {
        const listing = readMockListings().find((l) => l.id === listingId);
        if (!listing) throw Object.assign(new Error("not_found"), { code: "not_found" });
        const local = global.TasuBusinessDirectoryLocalStore?.read(listingId) || {};
        return {
          detail: {
            listing,
            profile: local.profile || null,
            photos: local.photos || [],
          },
        };
      },
      submitListingForReview: async (listingId) => {
        const list = readMockListings();
        const idx = list.findIndex((l) => l.id === listingId);
        if (idx < 0) throw Object.assign(new Error("not_found"), { code: "not_found" });
        list[idx] = { ...list[idx], status: "review_requested", updated_at: new Date().toISOString() };
        writeMockListings(list);
        return { listing: list[idx], review_request: { status: "open" } };
      },
      getPublicListingDetail: async (slug, listingType) => ({
        detail: {
          listing: readMockListings().find((l) => l.slug === slug && l.listing_type === listingType) || {},
          profile: null,
          photos: [],
        },
      }),
    };
  }

  function getRepository() {
    if (useMockMode()) return createMockRepository();
    return global.TasuBusinessDirectoryRepository || null;
  }

  global.TasuBusinessDirectoryCommon = {
    STATUS_LABELS,
    TYPE_LABELS,
    SUBMIT_STATUSES,
    EDIT_LOCKED_STATUSES,
    REAPPLY_HINT_STATUSES,
    qs,
    qsa,
    escapeHtml,
    statusLabel,
    typeLabel,
    isEditLocked,
    canSubmitForReview,
    formatDate,
    toast,
    useMockMode,
    getRepository,
  };
})(typeof window !== "undefined" ? window : globalThis);
