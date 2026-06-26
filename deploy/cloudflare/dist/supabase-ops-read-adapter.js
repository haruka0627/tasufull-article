/**
 * Supabase Phase 2/6 — 運営系 read（merge / primary source / localStorage キャッシュ）
 */
(function (global) {
  "use strict";

  const Config = () => global.TasuSupabaseOpsReadConfig;
  const PrimaryCfg = () => global.TasuSupabaseOpsPrimaryConfig;
  const PrimaryCache = () => global.TasuSupabaseOpsPrimaryCache;
  const WriteCfg = () => global.TasuSupabaseOpsWriteConfig;

  const CACHE = Object.create(null);
  const HYDRATE_EVENT = "tasu:supabase-ops-read-hydrated";

  const OPS_TABLE_KEYS = [
    "support_tickets",
    "support_events",
    "connect_issues",
    "support_admin_notifications",
    "ai_ops_cases",
    "ai_ops_events",
    "ai_ops_admin_notifications",
    "builder_partner_evaluations",
    "builder_partner_status_events",
    "builder_partner_visibility",
    "talk_ops_messages",
  ];

  const TABLE_MAP = {
    support_tickets: { table: "support_tickets", limit: 500 },
    support_events: { table: "support_events", limit: 2000 },
    connect_issues: { table: "connect_issues", limit: 200 },
    support_admin_notifications: { table: "support_admin_notifications", limit: 300 },
    ai_ops_cases: { table: "ai_ops_cases", limit: 500 },
    ai_ops_events: { table: "ai_ops_events", limit: 2000 },
    ai_ops_admin_notifications: { table: "ai_ops_admin_notifications", limit: 300 },
    builder_partner_evaluations: { table: "builder_partner_evaluations", limit: 500 },
    builder_partner_status_events: { table: "builder_partner_status_events", limit: 500 },
    builder_partner_visibility: { table: "builder_partner_visibility", limit: 500 },
    talk_ops_messages: { table: "talk_ops_messages", limit: 300 },
    talk_notifications: { table: "talk_notifications", limit: 200 },
    member_favorites: { table: "member_favorites", limit: 500 },
    listings: { table: "listings", limit: 500 },
  };

  let mockRemote = null;
  let queryClient = null;
  let queryClientToken = "";
  let lastFetchFailed = false;

  function isEnabled() {
    return Config()?.isEnabled?.() === true;
  }

  function isPrimarySource() {
    return PrimaryCfg()?.isPrimarySource?.() === true;
  }

  /** Phase 2 read-through または Phase 6 primary */
  function isRemoteReadActive() {
    return isEnabled() || isPrimarySource();
  }

  function canQuery() {
    if (!isRemoteReadActive()) return false;
    if (global.location?.protocol === "file:") return false;
    if (!global.TasuSupabase?.isConfigured?.()) return false;
    if (isPrimarySource()) {
      return Boolean(WriteCfg()?.getOpsAccessToken?.());
    }
    return true;
  }

  function getQueryClient() {
    if (mockRemote) return null;
    const token = WriteCfg()?.getOpsAccessToken?.() || "";
    if (isPrimarySource() && token) {
      if (queryClient && queryClientToken === token) return queryClient;
      const cfg = global.TasuSupabase?.getConfig?.();
      if (!cfg?.url || !cfg?.anonKey || !global.supabase?.createClient) {
        return global.TasuSupabase?.getClient?.();
      }
      queryClient = global.supabase.createClient(cfg.url, cfg.anonKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      queryClientToken = token;
      return queryClient;
    }
    return global.TasuSupabase?.getClient?.();
  }

  function rowTs(row) {
    return String(row?.updated_at || row?.updatedAt || row?.created_at || row?.createdAt || "");
  }

  function mergeByUpdatedAt(local, remote, idKey) {
    const key = idKey || "id";
    const map = new Map();
    (remote || []).forEach((r) => {
      if (r && r[key] != null) map.set(String(r[key]), r);
    });
    (local || []).forEach((r) => {
      if (!r || r[key] == null) return;
      const id = String(r[key]);
      const ex = map.get(id);
      if (!ex || rowTs(r) >= rowTs(ex)) map.set(id, r);
    });
    return Array.from(map.values()).sort((a, b) => rowTs(b).localeCompare(rowTs(a)));
  }

  /** Phase 6: Supabase 正データ — remote が同 id で上書き */
  function mergePrimaryFirst(local, remote, idKey) {
    const key = idKey || "id";
    const map = new Map();
    (local || []).forEach((r) => {
      if (r && r[key] != null) map.set(String(r[key]), r);
    });
    (remote || []).forEach((r) => {
      if (r && r[key] != null) map.set(String(r[key]), r);
    });
    return Array.from(map.values()).sort((a, b) => rowTs(b).localeCompare(rowTs(a)));
  }

  function snakeToLocalTicket(row) {
    return {
      id: row.id,
      user_id: row.user_id,
      related_project_id: row.related_project_id,
      related_order_id: row.related_order_id,
      related_stripe_account_id: row.related_stripe_account_id,
      source: row.source,
      title: row.title,
      body: row.body,
      category: row.category,
      severity: row.severity,
      status: row.status,
      ai_summary: row.ai_summary,
      ai_suggested_reply: row.ai_suggested_reply,
      ai_recommended_action: row.ai_recommended_action,
      admin_note: row.admin_note,
      created_at: row.created_at,
      updated_at: row.updated_at,
      resolved_at: row.resolved_at,
    };
  }

  function snakeToLocalCase(row) {
    return {
      id: row.id,
      support_ticket_id: row.support_ticket_id,
      source: row.source,
      title: row.title,
      body: row.body,
      support_category: row.support_category,
      severity: row.severity,
      status: row.status,
      ops_category: row.ops_category,
      ai_summary: row.ai_summary,
      ai_category: row.ai_category,
      ai_risk: row.ai_risk,
      ai_recommended_action: row.ai_recommended_action,
      ai_reply_draft: row.ai_reply_draft,
      ai_provider: row.ai_provider,
      related_project_id: row.related_project_id,
      related_order_id: row.related_order_id,
      user_id: row.user_id,
      admin_note: row.admin_note,
      created_at: row.created_at,
      updated_at: row.updated_at,
      resolved_at: row.resolved_at,
    };
  }

  function snakeToLocalEval(row) {
    return {
      id: row.id,
      partner_id: row.partner_id,
      partner_name: row.partner_name,
      project_id: row.project_id,
      project_title: row.project_title,
      deadline_delta: row.deadline_delta,
      complaint_delta: row.complaint_delta,
      note: row.note,
      created_by: row.created_by,
      created_at: row.created_at,
    };
  }

  function snakeToLocalNotify(row) {
    return {
      id: row.id,
      ticket_id: row.ticket_id,
      case_id: row.case_id,
      category: row.category,
      ops_category: row.ops_category,
      severity: row.severity,
      ai_risk: row.ai_risk,
      title: row.title,
      read: row.read,
      created_at: row.created_at,
    };
  }

  function snakeToLocalEvent(row) {
    return {
      id: row.id,
      ticket_id: row.ticket_id,
      case_id: row.case_id,
      event_type: row.event_type,
      payload_summary: row.payload_summary,
      payload: row.payload,
      created_at: row.created_at,
    };
  }

  function normalizeRows(cacheKey, rows) {
    if (!Array.isArray(rows)) return [];
    if (cacheKey === "support_tickets") return rows.map(snakeToLocalTicket);
    if (cacheKey === "ai_ops_cases") return rows.map(snakeToLocalCase);
    if (cacheKey === "builder_partner_evaluations") return rows.map(snakeToLocalEval);
    if (cacheKey === "support_admin_notifications" || cacheKey === "ai_ops_admin_notifications") {
      return rows.map(snakeToLocalNotify);
    }
    if (cacheKey === "support_events" || cacheKey === "ai_ops_events") {
      return rows.map(snakeToLocalEvent);
    }
    if (cacheKey === "builder_partner_status_events") return rows;
    if (cacheKey === "builder_partner_visibility") return rows;
    if (cacheKey === "talk_ops_messages") return rows;
    return rows;
  }

  function getCached(cacheKey) {
    if (mockRemote && cacheKey in mockRemote) {
      return normalizeRows(cacheKey, mockRemote[cacheKey]);
    }
    return CACHE[cacheKey] || [];
  }

  function mergeList(local, cacheKey) {
    if (!isRemoteReadActive()) return local;
    const remote = getCached(cacheKey);
    const PC = PrimaryCache();

    if (isPrimarySource()) {
      if (remote.length > 0) {
        PC?.syncFromRemote?.(cacheKey, remote);
        PC?.setDataSource?.("supabase");
        return mergePrimaryFirst(local, remote, "id");
      }
      PC?.warnFallback?.(cacheKey, lastFetchFailed ? "fetch_failed" : "empty_remote");
      const cached = PC?.readTableCache?.(cacheKey);
      const fallbackRows = Array.isArray(cached)
        ? cached
        : cacheKey === "builder_partner_visibility"
          ? []
          : local;
      const base = Array.isArray(cached) && cached.length ? cached : local;
      return Array.isArray(base) ? mergePrimaryFirst(base, [], "id") : local;
    }

    if (!remote.length) return local;
    return mergeByUpdatedAt(local, remote, "id");
  }

  async function fetchTable(cacheKey) {
    const meta = TABLE_MAP[cacheKey];
    if (!meta) return [];
    if (mockRemote && cacheKey in mockRemote) {
      return normalizeRows(cacheKey, mockRemote[cacheKey]);
    }
    if (!canQuery()) return [];

    const sb = getQueryClient();
    if (!sb) return [];

    let q = sb.from(meta.table).select("*").order("updated_at", { ascending: false }).limit(meta.limit);
    if (cacheKey === "talk_ops_messages") {
      q = sb.from(meta.table).select("*").order("created_at", { ascending: false }).limit(meta.limit);
      q = q.eq("room_id", "talk-ops-operations-room");
    }
    const { data, error } = await q;
    if (error) {
      console.warn(`[TasuSupabaseOpsRead] fetch ${meta.table}:`, error.message);
      lastFetchFailed = true;
      return [];
    }
    lastFetchFailed = false;
    return normalizeRows(cacheKey, data || []);
  }

  function prefetchKeys() {
    if (isPrimarySource()) return OPS_TABLE_KEYS;
    if (isEnabled()) {
      return [
        "support_tickets",
        "connect_issues",
        "ai_ops_cases",
        "builder_partner_evaluations",
        "builder_partner_visibility",
        "talk_ops_messages",
      ];
    }
    return [];
  }

  async function prefetch(keys) {
    if (!isRemoteReadActive()) {
      return { ok: false, reason: "disabled" };
    }
    const list = Array.isArray(keys) ? keys : prefetchKeys();
    const results = {};
    lastFetchFailed = false;

    if (mockRemote) {
      list.forEach((k) => {
        CACHE[k] = getCached(k);
        results[k] = CACHE[k].length;
      });
    } else if (!canQuery()) {
      const PC = PrimaryCache();
      if (isPrimarySource()) {
        PC?.warnFallback?.("all", "cannot_query");
        PC?.setLastFetchOk?.(false);
      }
      return { ok: false, reason: "cannot_query" };
    } else {
      await Promise.all(
        list.map(async (k) => {
          CACHE[k] = await fetchTable(k);
          results[k] = CACHE[k].length;
        })
      );
    }

    const PC = PrimaryCache();
    if (isPrimarySource() && PC) {
      const remoteByKey = {};
      list.forEach((k) => {
        remoteByKey[k] = CACHE[k] || [];
      });
      const anyRows = list.some((k) => (CACHE[k] || []).length > 0);
      if (anyRows && !lastFetchFailed) {
        PC.syncAll(remoteByKey);
        PC.setDataSource("supabase");
        PC.setLastFetchOk(true);
      } else if (lastFetchFailed || !anyRows) {
        PC.warnFallback("prefetch", lastFetchFailed ? "fetch_failed" : "no_rows");
        PC.setLastFetchOk(false);
      }
    }

    try {
      global.dispatchEvent(
        new CustomEvent(HYDRATE_EVENT, { detail: { results, primary: isPrimarySource() } })
      );
    } catch {
      /* ignore */
    }
    return { ok: true, results, primary: isPrimarySource() };
  }

  function getStatus() {
    const PC = PrimaryCache();
    return {
      enabled: isEnabled(),
      primarySource: isPrimarySource(),
      remoteReadActive: isRemoteReadActive(),
      canQuery: canQuery(),
      dataSource: PC?.getDataSource?.() || "local",
      lastFetchOk: PC?.getStatus?.()?.lastFetchOk,
      cached: Object.fromEntries(Object.keys(TABLE_MAP).map((k) => [k, (CACHE[k] || []).length])),
      mock: Boolean(mockRemote),
      lastFetchFailed,
    };
  }

  function clearCache() {
    Object.keys(CACHE).forEach((k) => delete CACHE[k]);
    mockRemote = null;
    queryClient = null;
    queryClientToken = "";
    lastFetchFailed = false;
  }

  function setMockRemoteForTests(data) {
    mockRemote = data && typeof data === "object" ? data : null;
    Object.keys(CACHE).forEach((k) => delete CACHE[k]);
    lastFetchFailed = false;
  }

  function simulateFetchFailureForTests(enabled) {
    lastFetchFailed = enabled === true;
  }

  global.TasuSupabaseOpsRead = {
    HYDRATE_EVENT,
    OPS_TABLE_KEYS,
    isEnabled,
    isPrimarySource,
    isRemoteReadActive,
    canQuery,
    mergeByUpdatedAt,
    mergePrimaryFirst,
    mergeList,
    getCached,
    prefetch,
    fetchTable,
    getStatus,
    clearCache,
    setMockRemoteForTests,
    simulateFetchFailureForTests,
    TABLE_KEYS: Object.keys(TABLE_MAP),
  };
})(typeof window !== "undefined" ? window : globalThis);
