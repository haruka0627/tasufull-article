/**
 * TASFUL Materials — runtime download metrics (merge into repository)
 * Failures never block browsing or download.
 */
(function (global) {
  "use strict";

  var SESSION_KEY = "tasful_materials_anon_session";
  var metricsCache = Object.create(null);
  var loaded = false;
  var loadPromise = null;

  function uuid() {
    if (global.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function getAnonSessionId() {
    try {
      var existing = global.sessionStorage.getItem(SESSION_KEY);
      if (existing) return existing;
      var id = uuid();
      global.sessionStorage.setItem(SESSION_KEY, id);
      return id;
    } catch {
      return null;
    }
  }

  function getUserId() {
    try {
      var s = global.TasuMemberAuth?.readMemberSession?.();
      return s?.id || s?.userId || s?.user_id || null;
    } catch {
      return null;
    }
  }

  async function getAccessToken() {
    try {
      var client = global.TasuSupabase?.getClient?.();
      if (!client?.auth?.getSession) return null;
      var res = await client.auth.getSession();
      return res?.data?.session?.access_token || null;
    } catch {
      return null;
    }
  }

  function applyPopularityRanks(items) {
    var sorted = items.slice().sort(function (a, b) {
      var dc = (Number(b.download_count) || 0) - (Number(a.download_count) || 0);
      if (dc !== 0) return dc;
      var ta = new Date(a.updated_at || 0).getTime();
      var tb = new Date(b.updated_at || 0).getTime();
      if (tb !== ta) return tb - ta;
      return String(a.id || "").localeCompare(String(b.id || ""));
    });
    for (var i = 0; i < sorted.length; i += 1) {
      sorted[i].popularity_rank = i + 1;
    }
  }

  function mergeIntoCatalog(metrics) {
    var Data = global.TasuMaterialsData;
    if (!Data?.mergeRuntimeMetrics) return;
    Data.mergeRuntimeMetrics(metrics || {});
  }

  async function refreshMetrics(assetIds) {
    try {
      var qs = "";
      if (Array.isArray(assetIds) && assetIds.length) {
        qs = "?ids=" + encodeURIComponent(assetIds.slice(0, 500).join(","));
      }
      var res = await fetch("/api/materials/metrics" + qs, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok) throw new Error("metrics_http_" + res.status);
      var data = await res.json();
      if (!data || data.ok !== true) throw new Error(data?.error || "metrics_failed");
      metricsCache = data.metrics || {};
      loaded = true;
      mergeIntoCatalog(metricsCache);
      return metricsCache;
    } catch (err) {
      if (typeof console !== "undefined" && console.info) {
        console.info("[TASFUL Materials] metrics fallback", err?.message || err);
      }
      loaded = true;
      mergeIntoCatalog(metricsCache);
      return metricsCache;
    }
  }

  function ensureLoaded(assetIds) {
    if (loadPromise) return loadPromise;
    loadPromise = refreshMetrics(assetIds).finally(function () {
      /* keep promise for coalescing first load */
    });
    return loadPromise;
  }

  /**
   * Fire-and-forget download event after resolver success.
   * Never throws to caller.
   */
  async function recordDownloadEvent(item, meta) {
    try {
      if (!item || !item.id) return { ok: false, error: "missing_item" };
      if (item.asset_type === "bgm" || item.category_id === "bgm") {
        return { ok: false, error: "bgm_blocked" };
      }
      if (item.publishable === false || item.downloadable === false) {
        return { ok: false, error: "not_downloadable" };
      }
      var eventId = (meta && meta.event_id) || uuid();
      var token = await getAccessToken();
      var headers = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      if (token) headers.Authorization = "Bearer " + token;
      var sessionId = getAnonSessionId();
      if (sessionId) headers["X-Materials-Session"] = sessionId;

      var res = await fetch("/api/materials/download-event", {
        method: "POST",
        headers: headers,
        body: JSON.stringify({
          event_id: eventId,
          asset_id: item.id,
          asset_type: item.asset_type || null,
          category_id: item.category_id || null,
          session_id: sessionId,
          user_id: getUserId(),
        }),
        cache: "no-store",
      });
      var data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      if (data && data.ok && typeof data.download_count === "number") {
        metricsCache[item.id] = data.download_count;
        mergeIntoCatalog(metricsCache);
      } else if (!res.ok) {
        if (typeof console !== "undefined" && console.info) {
          console.info("[TASFUL Materials] download-event not persisted", data?.error || res.status);
        }
      }
      return data || { ok: false, error: "bad_response" };
    } catch (err) {
      if (typeof console !== "undefined" && console.info) {
        console.info("[TASFUL Materials] download-event failed", err?.message || err);
      }
      return { ok: false, error: String(err?.message || err) };
    }
  }

  global.TasuMaterialsMetrics = {
    ensureLoaded: ensureLoaded,
    refreshMetrics: refreshMetrics,
    recordDownloadEvent: recordDownloadEvent,
    getCachedMetrics: function () {
      return metricsCache;
    },
    applyPopularityRanks: applyPopularityRanks,
    getAnonSessionId: getAnonSessionId,
  };
})(typeof window !== "undefined" ? window : globalThis);
