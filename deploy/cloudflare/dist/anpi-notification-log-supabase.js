/**
 * 安否通知ログ — Supabase 永続化（P9-2）
 */
(function (global) {
  "use strict";

  const TABLE = "anpi_notification_logs";
  const MOCK_STORAGE_KEY = "tasu_anpi_notification_logs_supabase_mock_v1";

  function isMockEnabled() {
    if (global.__ANPI_NOTIFICATION_LOGS_SUPABASE_MOCK__ === true) return true;
    try {
      return global.localStorage?.getItem(MOCK_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  }

  function getMockStore() {
    if (!global.__anpiNotificationLogsSupabaseStore) {
      global.__anpiNotificationLogsSupabaseStore = new Map();
    }
    return global.__anpiNotificationLogsSupabaseStore;
  }

  function getClient() {
    if (isMockEnabled()) return { mock: true };
    return global.TasuSupabase?.getClient?.() || null;
  }

  function isAvailable() {
    if (isMockEnabled()) return true;
    return global.TasuSupabase?.isConfigured?.() === true;
  }

  function parseTs(iso) {
    const t = new Date(String(iso || "")).getTime();
    return Number.isFinite(t) ? t : 0;
  }

  function emptyToNull(value) {
    const s = String(value ?? "").trim();
    return s ? s : null;
  }

  function severityFromPriority(priority) {
    const p = String(priority || "").trim();
    if (p === "urgent") return "urgent";
    if (p === "high") return "warning";
    if (p === "medium") return "info";
    return "info";
  }

  function priorityFromSeverity(severity) {
    const s = String(severity || "").trim();
    if (s === "urgent") return "urgent";
    if (s === "warning") return "high";
    return "normal";
  }

  /**
   * アプリログ → DB行
   * @param {object} log
   */
  function logToRow(log) {
    if (!log || typeof log !== "object") return null;
    const logId = String(log.log_id || log.id || "").trim();
    if (!logId) return null;

    const meta = {
      user_name: String(log.user_name || "").trim(),
      contract_holder_name: String(log.contract_holder_name || "").trim(),
      contract_holder_relation: String(log.contract_holder_relation || "").trim(),
      channel: String(log.channel || "").trim(),
      intent: String(log.intent || "").trim(),
      source_type: String(log.source_type || "").trim(),
      item_id: String(log.item_id || "").trim(),
      item_title: String(log.item_title || "").trim(),
      item_category: String(log.item_category || "").trim(),
      phone_masked: String(log.phone_masked || "").trim(),
      status: String(log.status || "").trim(),
      priority: String(log.priority || "normal").trim(),
    };

    const identity = global.TasuAnpiIdentity?.normalizeAnpiIdentity?.(log) || log;
    const anpiUserId = String(identity.anpi_user_id || identity.user_id || log.user_id || "").trim();

    return {
      log_id: logId,
      user_id: emptyToNull(anpiUserId),
      anpi_user_id: emptyToNull(anpiUserId),
      member_id: emptyToNull(identity.member_id),
      contract_holder_id: String(identity.contract_holder_id || log.contract_holder_id || "").trim(),
      event_type: String(log.event_type || "").trim(),
      title: String(log.title || "").trim(),
      message: String(log.message || "").trim(),
      severity: severityFromPriority(log.priority),
      is_read: log.is_read === true,
      created_at: log.created_at || new Date().toISOString(),
      updated_at: log.updated_at || log.created_at || new Date().toISOString(),
      read_at: emptyToNull(log.read_at),
      source: String(log.source || log.channel || "tasful").trim() || "tasful",
      metadata: meta,
      line_notification_enabled: log.line_notification_enabled === true,
      line_user_id: emptyToNull(log.line_user_id),
      line_status: String(log.line_status || "pending").trim() || "pending",
      line_sent_at: emptyToNull(log.line_sent_at),
      line_preview_sent_at: emptyToNull(log.line_preview_sent_at),
      line_error_message: emptyToNull(log.line_error_message),
      line_error_code: emptyToNull(log.line_error_code),
      line_send_in_progress: log.line_send_in_progress === true,
      notification_type: emptyToNull(log.notification_type || log.event_type),
      notify_channels: Array.isArray(log.notify_channels) ? log.notify_channels : [],
    };
  }

  /**
   * DB行 → アプリログ（normalize 前）
   * @param {object} row
   */
  function rowToLog(row) {
    if (!row || typeof row !== "object") return null;
    const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
    const logId = String(row.log_id || "").trim();
    if (!logId) return null;

    const anpiUserId = String(row.anpi_user_id || row.user_id || "").trim();

    return {
      id: logId,
      log_id: logId,
      user_id: anpiUserId,
      anpi_user_id: anpiUserId,
      member_id: String(row.member_id || "").trim(),
      contract_holder_id: String(row.contract_holder_id || "").trim(),
      event_type: String(row.event_type || "").trim(),
      title: String(row.title || "").trim(),
      message: String(row.message || "").trim(),
      is_read: row.is_read === true,
      created_at: row.created_at ? String(row.created_at) : "",
      updated_at: row.updated_at ? String(row.updated_at) : "",
      read_at: row.read_at ? String(row.read_at) : "",
      channel: String(meta.channel || row.source || "tasful_chat").trim(),
      source: String(row.source || "tasful").trim(),
      user_name: String(meta.user_name || "").trim(),
      contract_holder_name: String(meta.contract_holder_name || "").trim(),
      contract_holder_relation: String(meta.contract_holder_relation || "").trim(),
      intent: String(meta.intent || "").trim(),
      source_type: String(meta.source_type || "").trim(),
      item_id: String(meta.item_id || "").trim(),
      item_title: String(meta.item_title || "").trim(),
      item_category: String(meta.item_category || "").trim(),
      phone_masked: String(meta.phone_masked || "").trim(),
      status: String(meta.status || "").trim(),
      priority: String(meta.priority || priorityFromSeverity(row.severity)).trim(),
      line_notification_enabled: row.line_notification_enabled === true,
      line_user_id: String(row.line_user_id || "").trim(),
      line_status: String(row.line_status || "pending").trim(),
      line_sent_at: row.line_sent_at ? String(row.line_sent_at) : null,
      line_preview_sent_at: row.line_preview_sent_at ? String(row.line_preview_sent_at) : null,
      line_error_message: String(row.line_error_message || "").trim(),
      line_error_code: String(row.line_error_code || "").trim(),
      line_send_in_progress: row.line_send_in_progress === true,
      notification_type: String(row.notification_type || row.event_type || "").trim(),
      notify_channels: Array.isArray(row.notify_channels) ? row.notify_channels : [],
    };
  }

  function rls() {
    return global.TasuAnpiRls;
  }

  function mockSelect(filters) {
    const store = getMockStore();
    let rows = [...store.values()];
    const holderId = String(filters.contractHolderId || "").trim();
    const memberId = String(filters.memberId || "").trim();
    const anpiUserId = String(filters.anpiUserId || "").trim();
    const userId = String(filters.userId || anpiUserId || "").trim();
    if (holderId) {
      rows = rows.filter((r) => r.contract_holder_id === holderId);
    }
    if (memberId) {
      rows = rows.filter((r) => r.member_id === memberId);
    }
    if (userId) {
      rows = rows.filter(
        (r) => r.user_id === userId || r.anpi_user_id === userId
      );
    }
    rows = rls()?.filterLogRows?.(rows) || rows;
    rows.sort((a, b) => parseTs(b.created_at) - parseTs(a.created_at));
    const limit = Math.min(Number(filters.limit) || 200, 500);
    return rows.slice(0, limit);
  }

  async function mockUpsertRow(row) {
    const logId = String(row.log_id || "").trim();
    if (!logId) return { data: null, error: { message: "log_id required" } };
    const api = rls();
    const existing = getMockStore().get(logId);
    if (api?.isRlsMockEnforced?.()) {
      if (existing) {
        if (!api.canWriteLogRow(existing)) {
          api.notifyUnauthorized("logs.upsert", { log_id: logId, mode: "update_denied" });
          return { data: null, error: { message: "unauthorized", code: "42501" } };
        }
      } else if (!api.canWriteLogRow(row)) {
        api.notifyUnauthorized("logs.upsert", { log_id: logId, mode: "insert_denied" });
        return { data: null, error: { message: "unauthorized", code: "42501" } };
      }
    }
    const next = {
      id: existing?.id || `mock_${logId}`,
      ...row,
      updated_at: row.updated_at || new Date().toISOString(),
      created_at: existing?.created_at || row.created_at || new Date().toISOString(),
    };
    getMockStore().set(logId, next);
    return { data: [next], error: null };
  }

  /**
   * @param {{ contractHolderId?: string, memberId?: string, anpiUserId?: string, userId?: string, limit?: number }} [options]
   * @returns {Promise<object[]>}
   */
  async function loadAnpiNotificationLogs(options = {}) {
    if (!isAvailable()) return [];

    if (rls()?.shouldSkipSupabaseWrite?.("logs.load")) {
      return [];
    }

    const holderId = String(options.contractHolderId || "").trim();
    const memberId = String(options.memberId || "").trim();
    const anpiUserId = String(options.anpiUserId || "").trim();
    const userId = String(options.userId || anpiUserId || "").trim();
    const limit = Math.min(Number(options.limit) || 200, 500);

    try {
      if (isMockEnabled()) {
        return mockSelect({ contractHolderId: holderId, memberId, anpiUserId, userId, limit })
          .map(rowToLog)
          .filter(Boolean);
      }

      const sb = getClient();
      if (!sb || sb.mock) return [];

      let query = sb.from(TABLE).select("*").order("created_at", { ascending: false }).limit(limit);

      if (holderId) query = query.eq("contract_holder_id", holderId);
      if (memberId) query = query.eq("member_id", memberId);
      if (userId) query = query.eq("user_id", userId);

      const { data, error } = await query;
      if (error) throw error;
      const filtered = rls()?.filterLogRows?.(data || []) || data || [];
      return filtered.map(rowToLog).filter(Boolean);
    } catch (err) {
      const denied = rls()?.handleSupabaseError?.(err, "logs.load", options);
      if (denied) return [];
      console.warn(
        "[AnpiNotificationLogs] load failed",
        err instanceof Error ? err.message : err
      );
      return [];
    }
  }

  async function getAnpiNotificationLogsByContractHolder(contractHolderId, limit = 200) {
    return loadAnpiNotificationLogs({ contractHolderId, limit });
  }

  /**
   * @param {object} log
   * @returns {Promise<{ ok: boolean, row?: object, log?: object, error?: string }>}
   */
  async function saveAnpiNotificationLog(log) {
    return upsertAnpiNotificationLog(log);
  }

  /**
   * @param {object} log
   * @returns {Promise<{ ok: boolean, row?: object, log?: object, error?: string }>}
   */
  async function upsertAnpiNotificationLog(log) {
    const row = logToRow(log);
    if (!row?.log_id) {
      return { ok: false, error: "log_id is required" };
    }
    if (!isAvailable()) {
      return { ok: false, error: "supabase_not_configured" };
    }

    if (rls()?.shouldSkipSupabaseWrite?.("logs.upsert")) {
      return { ok: false, error: "supabase_skipped_unauthenticated", skipped: true };
    }

    try {
      if (isMockEnabled()) {
        const { data, error } = await mockUpsertRow(row);
        if (error) {
          const denied = rls()?.handleSupabaseError?.(error, "logs.upsert", { log_id: row.log_id });
          if (denied) return denied;
          return { ok: false, error: error.message, unauthorized: error.message === "unauthorized" };
        }
        const saved = data?.[0] || row;
        return { ok: true, row: saved, log: rowToLog(saved) };
      }

      const sb = getClient();
      if (!sb || sb.mock) return { ok: false, error: "supabase_not_configured" };

      const { data, error } = await sb
        .from(TABLE)
        .upsert(row, { onConflict: "log_id" })
        .select("*")
        .single();

      if (error) throw error;
      return { ok: true, row: data, log: rowToLog(data) };
    } catch (err) {
      const denied = rls()?.handleSupabaseError?.(err, "logs.upsert", { log_id: row.log_id });
      if (denied) return denied;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[AnpiNotificationLogs] upsert failed", msg);
      return { ok: false, error: msg };
    }
  }

  /**
   * @param {object[]} logs
   * @returns {Promise<{ ok: boolean, count?: number, error?: string }>}
   */
  async function upsertAnpiNotificationLogs(logs) {
    if (!Array.isArray(logs) || !logs.length) {
      return { ok: true, count: 0 };
    }
    if (!isAvailable()) {
      return { ok: false, error: "supabase_not_configured" };
    }

    if (rls()?.shouldSkipSupabaseWrite?.("logs.upsert_batch")) {
      return { ok: false, error: "supabase_skipped_unauthenticated", skipped: true };
    }

    const rows = logs.map(logToRow).filter(Boolean);
    if (!rows.length) return { ok: true, count: 0 };

    try {
      if (isMockEnabled()) {
        for (const row of rows) {
          await mockUpsertRow(row);
        }
        return { ok: true, count: rows.length };
      }

      const sb = getClient();
      if (!sb || sb.mock) return { ok: false, error: "supabase_not_configured" };

      const { error } = await sb.from(TABLE).upsert(rows, { onConflict: "log_id" });
      if (error) throw error;
      return { ok: true, count: rows.length };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[AnpiNotificationLogs] batch upsert failed", msg);
      return { ok: false, error: msg };
    }
  }

  /**
   * @param {string} logId
   * @returns {Promise<{ ok: boolean, log?: object, error?: string }>}
   */
  async function markAnpiNotificationLogRead(logId) {
    const id = String(logId || "").trim();
    if (!id || !isAvailable()) {
      return { ok: false, error: "not_available" };
    }

    const ts = new Date().toISOString();
    const patch = { is_read: true, read_at: ts, updated_at: ts };

    try {
      if (isMockEnabled()) {
        const row = getMockStore().get(id);
        if (!row) return { ok: false, error: "not_found" };
        const api = rls();
        if (api?.isRlsMockEnforced?.() && !api.canWriteLogRow(row)) {
          api.notifyUnauthorized("logs.mark_read", { log_id: id });
          return { ok: false, error: "unauthorized", unauthorized: true };
        }
        const next = { ...row, ...patch };
        getMockStore().set(id, next);
        return { ok: true, log: rowToLog(next) };
      }

      const sb = getClient();
      if (!sb || sb.mock) return { ok: false, error: "supabase_not_configured" };

      const { data, error } = await sb
        .from(TABLE)
        .update(patch)
        .eq("log_id", id)
        .select("*")
        .maybeSingle();

      if (error) throw error;
      return { ok: true, log: data ? rowToLog(data) : null };
    } catch (err) {
      const denied = rls()?.handleSupabaseError?.(err, "logs.mark_read", { log_id: id });
      if (denied) return denied;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[AnpiNotificationLogs] mark read failed", msg);
      return { ok: false, error: msg };
    }
  }

  /**
   * @param {string} contractHolderId
   * @returns {Promise<{ ok: boolean, count?: number, error?: string }>}
   */
  async function markAllAnpiNotificationsReadForContractHolder(contractHolderId) {
    const holderId = String(contractHolderId || "").trim();
    if (!holderId || !isAvailable()) {
      return { ok: false, error: "not_available" };
    }

    const ts = new Date().toISOString();
    const patch = { is_read: true, read_at: ts, updated_at: ts };

    try {
      if (isMockEnabled()) {
        let count = 0;
        getMockStore().forEach((row, key) => {
          if (row.contract_holder_id === holderId && !row.is_read) {
            getMockStore().set(key, { ...row, ...patch });
            count += 1;
          }
        });
        return { ok: true, count };
      }

      const sb = getClient();
      if (!sb || sb.mock) return { ok: false, error: "supabase_not_configured" };

      const { data, error } = await sb
        .from(TABLE)
        .update(patch)
        .eq("contract_holder_id", holderId)
        .eq("is_read", false)
        .select("log_id");

      if (error) throw error;
      return { ok: true, count: Array.isArray(data) ? data.length : 0 };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[AnpiNotificationLogs] bulk mark read failed", msg);
      return { ok: false, error: msg };
    }
  }

  /**
   * @param {string} logId
   * @returns {Promise<{ ok: boolean, error?: string }>}
   */
  async function deleteAnpiNotificationLog(logId) {
    const id = String(logId || "").trim();
    if (!id || !isAvailable()) return { ok: false, error: "not_available" };

    try {
      if (isMockEnabled()) {
        getMockStore().delete(id);
        return { ok: true };
      }

      const sb = getClient();
      if (!sb || sb.mock) return { ok: false, error: "supabase_not_configured" };

      const { error } = await sb.from(TABLE).delete().eq("log_id", id);
      if (error) throw error;
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[AnpiNotificationLogs] delete failed", msg);
      return { ok: false, error: msg };
    }
  }

  global.TasuAnpiNotificationLogsSupabase = {
    TABLE,
    MOCK_STORAGE_KEY,
    isAvailable,
    isMockEnabled,
    loadAnpiNotificationLogs,
    saveAnpiNotificationLog,
    upsertAnpiNotificationLog,
    upsertAnpiNotificationLogs,
    markAnpiNotificationLogRead,
    markAllAnpiNotificationsReadForContractHolder,
    deleteAnpiNotificationLog,
    getAnpiNotificationLogsByContractHolder,
    logToRow,
    rowToLog,
    parseTs,
  };
})(typeof window !== "undefined" ? window : globalThis);
