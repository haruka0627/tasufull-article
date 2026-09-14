/**
 * TASFUL Materials — search demand recording (fail-soft)
 * Confirmed searches only (not per-keystroke).
 */
(function (global) {
  "use strict";

  var DEDUPE_MS = 8000;
  var lastKey = "";
  var lastAt = 0;

  function uuid() {
    if (global.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function normalizeClient(raw) {
    var s = String(raw || "");
    try {
      s = s.normalize("NFKC");
    } catch {
      /* ignore */
    }
    s = s.replace(/[\u0000-\u001F\u007F]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
    if (s.length < 2 || s.length > 64) return "";
    if (s.indexOf("@") >= 0) return "";
    var digits = s.replace(/[^0-9]/g, "");
    if (digits.length >= 8) return "";
    return s;
  }

  /**
   * Fire-and-forget confirmed search event.
   * @param {string} query
   * @param {{ category_id?: string, result_count?: number, asset_type?: string, subcategory?: string }} meta
   */
  async function recordSearchEvent(query, meta) {
    try {
      var term = normalizeClient(query);
      if (!term) return { ok: false, error: "skipped" };

      var now = Date.now();
      var dedupe = term + "|" + String((meta && meta.category_id) || "");
      if (dedupe === lastKey && now - lastAt < DEDUPE_MS) {
        return { ok: true, duplicate: true, skipped_short_window: true };
      }
      lastKey = dedupe;
      lastAt = now;

      var Metrics = global.TasuMaterialsMetrics;
      var sessionId = Metrics?.getAnonSessionId?.() || null;
      var headers = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      if (sessionId) headers["X-Materials-Session"] = sessionId;

      try {
        var client = global.TasuSupabase?.getClient?.();
        if (client?.auth?.getSession) {
          var sess = await client.auth.getSession();
          var token = sess?.data?.session?.access_token;
          if (token) headers.Authorization = "Bearer " + token;
        }
      } catch {
        /* optional */
      }

      var body = {
        event_id: uuid(),
        search_term: term,
        session_id: sessionId,
        category_id: (meta && meta.category_id) || null,
        subcategory: (meta && meta.subcategory) || null,
        asset_type: (meta && meta.asset_type) || null,
        result_count: meta && typeof meta.result_count === "number" ? meta.result_count : null,
      };

      var res = await fetch("/api/materials/search-event", {
        method: "POST",
        headers: headers,
        body: JSON.stringify(body),
        cache: "no-store",
      });
      var data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      if (!res.ok || !data?.ok) {
        if (typeof console !== "undefined" && console.info) {
          console.info("[TASFUL Materials] search-event not persisted", data?.error || res.status);
        }
      }
      return data || { ok: false, error: "bad_response" };
    } catch (err) {
      if (typeof console !== "undefined" && console.info) {
        console.info("[TASFUL Materials] search-event failed", err?.message || err);
      }
      return { ok: false, error: String(err?.message || err) };
    }
  }

  global.TasuMaterialsSearchMetrics = {
    recordSearchEvent: recordSearchEvent,
    normalizeClient: normalizeClient,
  };
})(typeof window !== "undefined" ? window : globalThis);
