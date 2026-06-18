/**
 * Phase 2/6 — 運営画面で Supabase prefetch（read-through / primary source）
 */
(function (global) {
  "use strict";

  function runPrefetch() {
    const Read = global.TasuSupabaseOpsRead;
    if (!Read?.isRemoteReadActive?.() || !Read.prefetch) return;
    const keys = Read.prefetchKeys?.() || Read.OPS_TABLE_KEYS || Read.TABLE_KEYS;
    Read.prefetch(keys).catch((err) => {
      console.warn("[TasuSupabaseOpsRead] prefetch failed:", err);
    });
  }

  if (global.document) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", runPrefetch);
    } else {
      runPrefetch();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
