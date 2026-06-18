/**
 * 安否未応答 Phase2 — チェックセッション / 状態機械（Supabase + LS フォールバック）
 */
(function (global) {
  "use strict";

  const SESSIONS_TABLE = "anpi_check_sessions";
  const AUDIT_TABLE = "anpi_no_response_audit_log";
  const LS_SESSIONS_KEY = "tasu_anpi_check_sessions_v1";
  const LS_AUDIT_KEY = "tasu_anpi_no_response_audit_v1";
  const MOCK_LS_KEY = "tasu_anpi_no_response_phase2_mock_v1";
  const DEFAULT_TIMEOUT_MS = 2 * 60 * 60 * 1000;

  /** @type {object[]} */
  let cachedActive = [];
  /** @type {Map<string, object>} */
  let cachedById = new Map();
  let pollTimer = null;

  function nowIso() {
    return new Date().toISOString();
  }

  function newUuid() {
    if (global.crypto?.randomUUID) return global.crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function isMockEnabled() {
    if (global.__ANPI_NO_RESPONSE_MOCK__ === true) return true;
    try {
      return global.localStorage?.getItem(MOCK_LS_KEY) === "1";
    } catch {
      return false;
    }
  }

  function getClient() {
    if (isMockEnabled()) return { mock: true };
    return global.TasuSupabase?.getClient?.() || null;
  }

  function isAvailable() {
    if (isMockEnabled()) return true;
    return global.TasuSupabase?.isConfigured?.() === true;
  }

  function getTimeoutMs() {
    const n = Number(global.__ANPI_NO_RESPONSE_TIMEOUT_MS__);
    if (Number.isFinite(n) && n > 0) return n;
    return DEFAULT_TIMEOUT_MS;
  }

  function readLsJson(key, fallback) {
    try {
      const raw = global.localStorage?.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function writeLsJson(key, value) {
    try {
      global.localStorage?.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }

  function readLocalSessions() {
    return readLsJson(LS_SESSIONS_KEY, []);
  }

  function writeLocalSessions(rows) {
    writeLsJson(LS_SESSIONS_KEY, rows);
  }

  function readLocalAudit() {
    return readLsJson(LS_AUDIT_KEY, []);
  }

  function writeLocalAudit(rows) {
    writeLsJson(LS_AUDIT_KEY, rows);
  }

  function rowToSession(row) {
    if (!row || typeof row !== "object") return null;
    return {
      id: String(row.id || ""),
      target_user_id: String(row.target_user_id || ""),
      contract_holder_id: String(row.contract_holder_id || ""),
      emergency_contact_user_id: row.emergency_contact_user_id || null,
      status: String(row.status || "pending"),
      target_user_name: String(row.target_user_name || row.metadata?.target_user_name || ""),
      relation: String(row.relation || row.metadata?.relation || ""),
      check_sent_at: row.check_sent_at || null,
      response_deadline_at: row.response_deadline_at || null,
      responded_at: row.responded_at || null,
      no_response_at: row.no_response_at || null,
      family_notified_at: row.family_notified_at || null,
      handled_at: row.handled_at || null,
      handled_by: row.handled_by || null,
      action_type: row.action_type || null,
      metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {},
      created_at: row.created_at || nowIso(),
      updated_at: row.updated_at || nowIso(),
    };
  }

  function sessionToRow(session) {
    return {
      id: session.id,
      target_user_id: session.target_user_id,
      contract_holder_id: session.contract_holder_id,
      emergency_contact_user_id: session.emergency_contact_user_id || null,
      status: session.status,
      target_user_name: session.target_user_name || "",
      relation: session.relation || "",
      check_sent_at: session.check_sent_at,
      response_deadline_at: session.response_deadline_at,
      responded_at: session.responded_at,
      no_response_at: session.no_response_at,
      family_notified_at: session.family_notified_at,
      handled_at: session.handled_at,
      handled_by: session.handled_by,
      action_type: session.action_type,
      metadata: session.metadata || {},
      created_at: session.created_at || nowIso(),
      updated_at: session.updated_at || nowIso(),
    };
  }

  function isActiveFamilyStatus(status) {
    return status === "family_notified";
  }

  function isOpenDispatchStatus(status) {
    return ["pending", "sent_to_user", "no_response", "family_notified"].includes(status);
  }

  function updateCache(rows) {
    cachedById = new Map();
    cachedActive = [];
    for (const raw of rows || []) {
      const s = rowToSession(raw);
      if (!s?.id) continue;
      cachedById.set(s.id, s);
      if (isActiveFamilyStatus(s.status)) cachedActive.push(s);
    }
  }

  function emitChanged() {
    try {
      global.dispatchEvent(new CustomEvent("tasu:anpi-no-response-changed"));
    } catch {
      /* ignore */
    }
  }

  function getViewerId() {
    const urlUid = String(new URLSearchParams(global.location?.search || "").get("userId") || "").trim();
    if (urlUid) return urlUid;
    return (
      String(global.TasuMemberAuth?.getCurrentUserId?.() || "").trim() ||
      String(global.TasuAnpiUserContext?.load?.()?.contract_holder_id || "").trim() ||
      "u_me"
    );
  }

  async function fetchSessionsFromSupabase(holderId) {
    const sb = getClient();
    if (!sb || sb.mock) {
      const all = readLocalSessions();
      return holderId ? all.filter((s) => s.contract_holder_id === holderId) : all;
    }
    let q = sb.from(SESSIONS_TABLE).select("*").order("created_at", { ascending: false });
    if (holderId) q = q.eq("contract_holder_id", holderId);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  async function upsertSessionSupabase(session) {
    const sb = getClient();
    const row = sessionToRow(session);
    if (!sb || sb.mock) {
      const list = readLocalSessions();
      const idx = list.findIndex((s) => s.id === session.id);
      if (idx >= 0) list[idx] = row;
      else list.unshift(row);
      writeLocalSessions(list);
      return row;
    }
    const { data, error } = await sb.from(SESSIONS_TABLE).upsert(row).select("*").single();
    if (error) throw error;
    return data;
  }

  async function insertAuditSupabase(entry) {
    const sb = getClient();
    const row = {
      id: entry.id || newUuid(),
      anpi_check_id: entry.anpi_check_id,
      actor_user_id: entry.actor_user_id || "",
      action_type: entry.action_type,
      payload: entry.payload || {},
      created_at: entry.created_at || nowIso(),
    };
    if (!sb || sb.mock) {
      const list = readLocalAudit();
      list.unshift(row);
      writeLocalAudit(list);
      return row;
    }
    const { data, error } = await sb.from(AUDIT_TABLE).insert(row).select("*").single();
    if (error) throw error;
    return data;
  }

  async function appendAudit(checkId, actorUserId, actionType, payload) {
    return insertAuditSupabase({
      anpi_check_id: checkId,
      actor_user_id: actorUserId,
      action_type: actionType,
      payload: payload || {},
    });
  }

  async function refreshCache() {
    try {
      const holderId = getViewerId();
      const rows = await fetchSessionsFromSupabase(holderId);
      updateCache(rows);
    } catch (err) {
      console.warn("[TasuAnpiNoResponseService] refreshCache:", err);
    }
    return cachedActive;
  }

  function getCachedActiveItems() {
    return [...cachedActive];
  }

  function getCachedSession(checkId) {
    return cachedById.get(String(checkId || "")) || null;
  }

  async function createAndDispatchCheck(input) {
    const targetUserId = String(input?.targetUserId || input?.target_user_id || "").trim();
    const contractHolderId = String(
      input?.contractHolderId || input?.contract_holder_id || getViewerId()
    ).trim();
    const targetUserName = String(input?.targetUserName || input?.target_user_name || "利用者").trim();
    const relation = String(input?.relation || "").trim();
    const timeoutMs = Number(input?.timeoutMs) > 0 ? Number(input.timeoutMs) : getTimeoutMs();

    if (!targetUserId || !contractHolderId) {
      throw new Error("targetUserId and contractHolderId are required");
    }

    const existing = (await fetchSessionsFromSupabase(contractHolderId)).find(
      (s) => s.target_user_id === targetUserId && isOpenDispatchStatus(s.status)
    );
    if (existing) {
      return { ok: false, reason: "duplicate", session: rowToSession(existing) };
    }

    const now = nowIso();
    const deadline = new Date(Date.now() + timeoutMs).toISOString();
    const session = rowToSession({
      id: newUuid(),
      target_user_id: targetUserId,
      contract_holder_id: contractHolderId,
      status: "sent_to_user",
      target_user_name: targetUserName,
      relation,
      check_sent_at: now,
      response_deadline_at: deadline,
      metadata: { target_user_name: targetUserName, relation, timeout_ms: timeoutMs },
      created_at: now,
      updated_at: now,
    });

    await upsertSessionSupabase(session);
    await appendAudit(session.id, contractHolderId, "status_change", {
      from: "pending",
      to: "sent_to_user",
    });
    await refreshCache();
    emitChanged();
    return { ok: true, session };
  }

  async function markAnswered(checkId, responseType) {
    const session = getCachedSession(checkId) || rowToSession(readLocalSessions().find((s) => s.id === checkId));
    if (!session) return { ok: false, reason: "not_found" };
    if (session.status !== "sent_to_user") return { ok: false, reason: "invalid_status", session };

    session.status = "answered";
    session.responded_at = nowIso();
    session.action_type = null;
    session.metadata = { ...session.metadata, response_type: responseType || "unknown" };
    session.updated_at = nowIso();

    await upsertSessionSupabase(session);
    await appendAudit(checkId, getViewerId(), "status_change", {
      from: "sent_to_user",
      to: "answered",
      response_type: responseType,
    });
    await refreshCache();
    emitChanged();
    return { ok: true, session };
  }

  async function notifyFamilyForSession(session) {
    if (session.family_notified_at) return { ok: true, skipped: true, session };
    const notify = global.TasuAnpiNoResponseNotify;
    if (notify?.notifyFamily) {
      await notify.notifyFamily(session);
    }
    session.status = "family_notified";
    session.family_notified_at = nowIso();
    session.updated_at = nowIso();
    await upsertSessionSupabase(session);
    await appendAudit(session.id, session.contract_holder_id, "family_notified", {
      channel: "talk",
    });
    return { ok: true, session };
  }

  async function processDueTimeouts() {
    let rows;
    try {
      rows = await fetchSessionsFromSupabase("");
    } catch {
      rows = readLocalSessions();
    }

    const now = Date.now();
    let changed = false;

    for (const raw of rows) {
      let session = rowToSession(raw);
      if (!session?.id) continue;

      if (session.status === "sent_to_user" && session.response_deadline_at) {
        const deadline = new Date(session.response_deadline_at).getTime();
        if (Number.isFinite(deadline) && now >= deadline) {
          session.status = "no_response";
          session.no_response_at = nowIso();
          session.updated_at = nowIso();
          await upsertSessionSupabase(session);
          await appendAudit(session.id, "system", "status_change", {
            from: "sent_to_user",
            to: "no_response",
          });
          changed = true;
        }
      }

      if (session.status === "no_response" && !session.family_notified_at) {
        await notifyFamilyForSession(session);
        changed = true;
      }
    }

    if (changed) {
      await refreshCache();
      emitChanged();
    }
    return { ok: true, changed };
  }

  async function confirmHandled(checkId, handledBy) {
    const session = getCachedSession(checkId) || rowToSession(readLocalSessions().find((s) => s.id === checkId));
    if (!session) return { ok: false, reason: "not_found" };
    if (session.status !== "family_notified") {
      return { ok: false, reason: "invalid_status", session };
    }

    session.status = "handled";
    session.handled_at = nowIso();
    session.handled_by = String(handledBy || getViewerId());
    session.action_type = "confirmed";
    session.updated_at = nowIso();

    await upsertSessionSupabase(session);
    await appendAudit(checkId, session.handled_by, "confirmed", {});
    await refreshCache();
    emitChanged();
    return { ok: true, session };
  }

  async function escalateOpsConsult(checkId, actorUserId) {
    const session = getCachedSession(checkId) || rowToSession(readLocalSessions().find((s) => s.id === checkId));
    if (!session) return { ok: false, reason: "not_found" };
    if (session.status !== "family_notified") {
      return { ok: false, reason: "invalid_status", session };
    }

    session.status = "escalated";
    session.handled_at = nowIso();
    session.handled_by = String(actorUserId || getViewerId());
    session.action_type = "ops_consult";
    session.updated_at = nowIso();

    await upsertSessionSupabase(session);
    await appendAudit(checkId, session.handled_by, "ops_consult", {
      target_user_name: session.target_user_name,
    });
    await refreshCache();
    emitChanged();
    return { ok: true, session };
  }

  async function auditTalkCallInitiated(checkId, actorUserId, payload) {
    return appendAudit(checkId, actorUserId || getViewerId(), "talk_call_initiated", payload || {});
  }

  function startPolling(options) {
    const intervalMs = Number(options?.intervalMs) > 0 ? Number(options.intervalMs) : 30000;
    if (pollTimer) clearInterval(pollTimer);
    refreshCache()
      .then(() => processDueTimeouts())
      .then(() => options?.onUpdate?.())
      .catch(() => {});
    pollTimer = setInterval(() => {
      processDueTimeouts()
        .then(() => refreshCache())
        .then(() => options?.onUpdate?.())
        .catch(() => {});
    }, intervalMs);
  }

  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  async function listActiveForViewer() {
    await refreshCache();
    return getCachedActiveItems();
  }

  global.TasuAnpiNoResponseService = {
    SESSIONS_TABLE,
    AUDIT_TABLE,
    isAvailable,
    getTimeoutMs,
    getViewerId,
    createAndDispatchCheck,
    markAnswered,
    processDueTimeouts,
    confirmHandled,
    escalateOpsConsult,
    auditTalkCallInitiated,
    refreshCache,
    getCachedActiveItems,
    getCachedSession,
    listActiveForViewer,
    startPolling,
    stopPolling,
    readLocalAudit,
    readLocalSessions,
  };
})(window);
