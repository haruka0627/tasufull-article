/**
 * Business Directory — client repository (Edge API wrapper)
 * No UI · calls supabase/functions/business-directory
 */
(function (global) {
  "use strict";

  function functionsBase() {
    const cfg = global.TASU_CHAT_SUPABASE_CONFIG || {};
    const url = String(cfg.url || global.__MATCH_FUNCTIONS_BASE__ || "").replace(/\/$/, "");
    if (!url) return "";
    if (url.includes("/functions/v1")) return url;
    return `${url}/functions/v1`;
  }

  function authHeaders() {
    const cfg = global.TASU_CHAT_SUPABASE_CONFIG || {};
    const headers = { "Content-Type": "application/json", Accept: "application/json" };
    const key = cfg.anonKey || cfg.anon_key;
    if (key) {
      headers.apikey = key;
      headers.Authorization = `Bearer ${key}`;
    }
    const session = cfg.accessToken || cfg.access_token;
    if (session) headers.Authorization = `Bearer ${session}`;
    return headers;
  }

  async function invoke(action, payload) {
    const base = functionsBase();
    if (!base) throw new Error("business_directory_no_functions_base");
    const res = await fetch(`${base}/business-directory`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ action, ...(payload || {}) }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      const err = new Error(data.message || data.error || `HTTP ${res.status}`);
      err.code = data.code || data.error || "business_directory_error";
      err.status = res.status;
      throw err;
    }
    return data;
  }

  const TasuBusinessDirectoryRepository = {
    createDraftListing: (body) => invoke("create_draft_listing", body),
    updateDraftListing: (listingId, body) => invoke("update_draft_listing", { listing_id: listingId, ...body }),
    getOwnerListings: () => invoke("get_owner_listings"),
    getOwnerListingDetail: (listingId) => invoke("get_owner_listing_detail", { listing_id: listingId }),
    submitListingForReview: (listingId, requestType) =>
      invoke("submit_listing_for_review", { listing_id: listingId, request_type: requestType }),
    getPublicListings: (filters) => invoke("get_public_listings", filters || {}),
    getPublicListingDetail: (slug, listingType) =>
      invoke("get_public_listing_detail", { slug, listing_type: listingType }),
    getReviewQueue: (limit) => invoke("get_review_queue", { limit }),
    approveListing: (listingId) => invoke("approve_listing", { listing_id: listingId }),
    rejectListing: (listingId, reason) =>
      invoke("reject_listing", {
        listing_id: listingId,
        reject_reason_code: reason?.code,
        reject_reason_note: reason?.note,
      }),
    suspendListing: (listingId, reason) =>
      invoke("suspend_listing", { listing_id: listingId, reason }),
    unpublishListing: (listingId) => invoke("unpublish_listing", { listing_id: listingId }),
    restoreListing: (listingId) => invoke("restore_listing", { listing_id: listingId }),
    health: () => invoke("health"),
  };

  global.TasuBusinessDirectoryRepository = TasuBusinessDirectoryRepository;
})(typeof window !== "undefined" ? window : globalThis);
