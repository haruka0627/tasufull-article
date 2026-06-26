/**
 * Supabase Phase 6 — 運営系 localStorage キャッシュ（Supabase 正データのミラー）
 */
(function (global) {
  "use strict";

  const META_KEY = "tasu_ops_primary_cache_meta_v1";
  const DEFAULT_TTL_MS = 5 * 60 * 1000;
  const SYNC_EVENT = "tasu:supabase-ops-primary-synced";

  const TABLE_LS = {
    support_tickets: "tasu_support_tickets_v1",
    support_events: "tasu_support_events_v1",
    connect_issues: "tasu_connect_issues_v1",
    support_admin_notifications: "tasu_support_admin_notifications_v1",
    ai_ops_cases: "tasu_ai_ops_cases_v1",
    ai_ops_events: "tasu_ai_ops_events_v1",
    ai_ops_admin_notifications: "tasu_ai_ops_admin_notifications_v1",
    builder_partner_evaluations: "tasful:builder:partner_evaluations:v1",
    builder_partner_status_events: "tasful:builder:partner_status_events:v1",
    builder_partner_visibility: "tasful:builder:partner_visibility:v1",
    talk_ops_messages: "tasu_talk_ops_messages_cache_v1",
  };

  let dataSource = "local";
  let lastFetchOk = false;

  function readMeta() {
    try {
      const raw = localStorage.getItem(META_KEY);
      const data = raw ? JSON.parse(raw) : {};
      return data && typeof data === "object" ? data : {};
    } catch {
      return {};
    }
  }

  function writeMeta(patch) {
    const next = { ...readMeta(), ...patch, updatedAt: new Date().toISOString() };
    try {
      localStorage.setItem(META_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    return next;
  }

  function getDataSource() {
    const Primary = global.TasuSupabaseOpsPrimaryConfig;
    if (!Primary?.isPrimarySource?.()) return "local";
    return dataSource;
  }

  function setDataSource(source) {
    dataSource = source === "supabase" ? "supabase" : source === "cache" ? "cache" : "local";
    writeMeta({ dataSource });
  }

  function setLastFetchOk(ok) {
    lastFetchOk = Boolean(ok);
    writeMeta({ lastFetchOk: lastFetchOk });
  }

  function getTableMeta(cacheKey) {
    const meta = readMeta();
    return meta.tables?.[cacheKey] || {};
  }

  function isFresh(cacheKey, ttlMs) {
    const t = getTableMeta(cacheKey).lastSyncedAt;
    if (!t) return false;
    const age = Date.now() - new Date(t).getTime();
    return age >= 0 && age < (ttlMs || DEFAULT_TTL_MS);
  }

  function readTableCache(cacheKey) {
    const lsKey = TABLE_LS[cacheKey];
    if (!lsKey) return cacheKey === "builder_partner_visibility" ? {} : [];
    try {
      const raw = localStorage.getItem(lsKey);
      if (cacheKey === "builder_partner_visibility") {
        const data = raw ? JSON.parse(raw) : {};
        return data && typeof data === "object" ? data : {};
      }
      const data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data : [];
    } catch {
      return cacheKey === "builder_partner_visibility" ? {} : [];
    }
  }

  function writeTableCache(cacheKey, rows) {
    const lsKey = TABLE_LS[cacheKey];
    if (!lsKey) return;
    try {
      if (cacheKey === "builder_partner_visibility") {
        const map = {};
        (rows || []).forEach((r) => {
          if (r?.partner_id) map[String(r.partner_id)] = r.partner_status || r.status || "hidden";
        });
        localStorage.setItem(lsKey, JSON.stringify(map));
      } else {
        localStorage.setItem(lsKey, JSON.stringify(Array.isArray(rows) ? rows : []));
      }
      const tables = { ...(readMeta().tables || {}) };
      tables[cacheKey] = {
        lastSyncedAt: new Date().toISOString(),
        count: Array.isArray(rows) ? rows.length : Object.keys(rows || {}).length,
      };
      writeMeta({ tables });
    } catch (e) {
      console.warn("[TasuSupabaseOpsPrimary] cache write failed:", cacheKey, e);
    }
  }

  function syncFromRemote(cacheKey, rows) {
    if (!Array.isArray(rows) && cacheKey !== "builder_partner_visibility") return;
    writeTableCache(cacheKey, rows);
  }

  function syncAll(remoteByKey) {
    if (!remoteByKey || typeof remoteByKey !== "object") return;
    Object.keys(remoteByKey).forEach((k) => {
      if (TABLE_LS[k]) syncFromRemote(k, remoteByKey[k]);
    });
    try {
      global.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: { keys: Object.keys(remoteByKey) } }));
    } catch {
      /* ignore */
    }
  }

  function warnFallback(cacheKey, reason) {
    console.warn(
      `[TasuSupabaseOpsPrimary] Supabase unavailable — localStorage cache fallback (${cacheKey}):`,
      reason || "unknown"
    );
    setDataSource("cache");
  }

  function getStatus() {
    return {
      primary: global.TasuSupabaseOpsPrimaryConfig?.isPrimarySource?.() === true,
      dataSource: getDataSource(),
      lastFetchOk,
      meta: readMeta(),
      tables: TABLE_LS,
    };
  }

  function clearForTests() {
    try {
      localStorage.removeItem(META_KEY);
      Object.values(TABLE_LS).forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
    dataSource = "local";
    lastFetchOk = false;
  }

  global.TasuSupabaseOpsPrimaryCache = {
    SYNC_EVENT,
    TABLE_LS,
    DEFAULT_TTL_MS,
    getDataSource,
    setDataSource,
    setLastFetchOk,
    isFresh,
    readTableCache,
    writeTableCache,
    syncFromRemote,
    syncAll,
    warnFallback,
    getStatus,
    clearForTests,
  };
})(typeof window !== "undefined" ? window : globalThis);
