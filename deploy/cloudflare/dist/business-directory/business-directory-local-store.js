/**
 * Business Directory — local persistence for photos / hours (Phase 2 API gap · UI only)
 */
(function (global) {
  "use strict";

  const KEY_PREFIX = "bd_local_v1_";

  function read(listingId) {
    try {
      const raw = global.localStorage.getItem(KEY_PREFIX + listingId);
      return raw ? JSON.parse(raw) : { photos: [], hours: [], rejectMeta: null };
    } catch {
      return { photos: [], hours: [], rejectMeta: null };
    }
  }

  function write(listingId, data) {
    try {
      global.localStorage.setItem(KEY_PREFIX + listingId, JSON.stringify(data));
    } catch {
      /* ignore quota */
    }
  }

  function merge(listingId, patch) {
    const cur = read(listingId);
    const next = { ...cur, ...patch };
    write(listingId, next);
    return next;
  }

  global.TasuBusinessDirectoryLocalStore = { read, write, merge };
})(typeof window !== "undefined" ? window : globalThis);
