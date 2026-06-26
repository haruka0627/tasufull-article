/**
 * Supabase Phase 3/5 — 運営系 dual-write（INSERT + UPDATE、localStorage 成功は常に維持）
 */
(function (global) {
  "use strict";

  const FAILURES_KEY = "tasu_ops_write_failures_v1";
  const Config = () => global.TasuSupabaseOpsWriteConfig;
  const OPS_ROOM_ID = "talk-ops-operations-room";

  let mockCapture = null;
  let opsWriteClient = null;
  let opsWriteClientToken = "";

  function isEnabled() {
    return Config()?.isEnabled?.() === true;
  }

  function canWrite() {
    return Config()?.canWriteSupabase?.() === true;
  }

  function readFailures() {
    try {
      const raw = localStorage.getItem(FAILURES_KEY);
      const data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function logFailure(table, id, error) {
    const msg = String(error?.message || error || "unknown");
    console.warn(`[TasuSupabaseOpsWrite] ${table} ${id}:`, msg);
    try {
      const list = readFailures();
      list.unshift({
        table,
        id: id != null ? String(id) : "",
        error: msg,
        at: new Date().toISOString(),
      });
      localStorage.setItem(FAILURES_KEY, JSON.stringify(list.slice(0, 200)));
    } catch {
      /* ignore */
    }
  }

  function warnRls(error) {
    const code = String(error?.code || "");
    const msg = String(error?.message || error);
    if (code === "42501" || /permission denied|row-level security/i.test(msg)) {
      console.warn(
        "[TasuSupabaseOpsWrite] RLS denied (admin JWT + ?supabaseDualWrite=1 required on staging):",
        msg
      );
    }
  }

  function pick(row, keys) {
    const out = {};
    keys.forEach((k) => {
      if (row[k] !== undefined) out[k] = row[k];
    });
    return out;
  }

  function getWriteClient() {
    if (mockCapture) return null;
    const token = Config()?.getOpsAccessToken?.() || "";
    const base = global.TasuSupabase?.getClient?.();
    if (!token) return base;
    const cfg = global.TasuSupabase?.getConfig?.();
    if (!cfg?.url || !cfg?.anonKey || !global.supabase?.createClient) return base;
    if (opsWriteClient && opsWriteClientToken === token) return opsWriteClient;
    opsWriteClient = global.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    opsWriteClientToken = token;
    return opsWriteClient;
  }

  function refreshReadCaches(keys) {
    const Read = global.TasuSupabaseOpsRead;
    if (Read?.isRemoteReadActive?.() && Read.prefetch) {
      void Read.prefetch(keys).catch(() => {});
    }
  }

  async function upsertRow(table, row, conflictKey) {
    if (!isEnabled()) return { ok: false, skipped: true, reason: "disabled" };
    const idCol = conflictKey || "id";
    const rowId = row?.[idCol];
    if (!rowId) return { ok: false, skipped: true, reason: "no_id" };

    if (mockCapture) {
      mockCapture.push({ op: "upsert", table, row: { ...row } });
      return { ok: true, mock: true };
    }

    if (!canWrite()) return { ok: false, skipped: true, reason: "cannot_write" };

    const sb = getWriteClient();
    if (!sb) {
      logFailure(table, rowId, "no supabase client");
      return { ok: false, error: "no_client" };
    }

    const { error } = await sb.from(table).upsert(row, { onConflict: idCol });
    if (error) {
      warnRls(error);
      logFailure(table, rowId, error);
      return { ok: false, error };
    }
    return { ok: true };
  }

  async function updateRow(table, id, patch, idColumn) {
    if (!isEnabled()) return { ok: false, skipped: true, reason: "disabled" };
    if (!id) return { ok: false, skipped: true, reason: "no_id" };
    const col = idColumn || "id";

    if (mockCapture) {
      mockCapture.push({ op: "update", table, id: String(id), patch: { ...patch } });
      return { ok: true, mock: true };
    }

    if (!canWrite()) return { ok: false, skipped: true, reason: "cannot_write" };

    const sb = getWriteClient();
    if (!sb) {
      logFailure(table, id, "no supabase client");
      return { ok: false, error: "no_client" };
    }

    const { error } = await sb.from(table).update(patch).eq(col, id);
    if (error) {
      warnRls(error);
      logFailure(table, id, error);
      return { ok: false, error };
    }
    return { ok: true };
  }

  function toSupportTicket(row) {
    return pick(row, [
      "id",
      "user_id",
      "related_project_id",
      "related_order_id",
      "related_stripe_account_id",
      "source",
      "title",
      "body",
      "category",
      "severity",
      "status",
      "ai_summary",
      "ai_suggested_reply",
      "ai_recommended_action",
      "admin_note",
      "created_at",
      "updated_at",
      "resolved_at",
    ]);
  }

  function toSupportEvent(row) {
    return pick(row, [
      "id",
      "ticket_id",
      "event_type",
      "payload_summary",
      "payload",
      "created_at",
    ]);
  }

  function toConnectIssue(row) {
    return pick(row, [
      "id",
      "user_id",
      "stripe_account_id",
      "stripe_event_type",
      "issue_type",
      "severity",
      "status",
      "detected_reason",
      "recommended_action",
      "admin_required",
      "raw_event_ref",
      "ticket_id",
      "created_at",
      "updated_at",
      "resolved_at",
    ]);
  }

  function toAiOpsCase(row) {
    const base = pick(row, [
      "id",
      "support_ticket_id",
      "source",
      "title",
      "body",
      "support_category",
      "severity",
      "status",
      "ops_category",
      "ai_summary",
      "ai_category",
      "ai_risk",
      "ai_recommended_action",
      "ai_reply_draft",
      "related_project_id",
      "related_order_id",
      "user_id",
      "admin_note",
      "created_at",
      "updated_at",
      "resolved_at",
    ]);
    base.ai_provider = row.ai_provider || row.provider || "template";
    return base;
  }

  function toAiOpsEvent(row) {
    return pick(row, [
      "id",
      "case_id",
      "event_type",
      "payload_summary",
      "payload",
      "created_at",
    ]);
  }

  function toBuilderEvaluation(row) {
    return pick(row, [
      "id",
      "partner_id",
      "partner_name",
      "project_id",
      "project_title",
      "deadline_delta",
      "complaint_delta",
      "note",
      "created_by",
      "created_at",
    ]);
  }

  function toBuilderStatusEvent(row) {
    return pick(row, [
      "id",
      "partner_id",
      "partner_name",
      "partner_status",
      "action",
      "reason",
      "created_by",
      "created_at",
    ]);
  }

  function toSupportNotification(row) {
    return pick(row, ["id", "ticket_id", "category", "severity", "title", "read", "created_at"]);
  }

  function toAiOpsNotification(row) {
    return pick(row, ["id", "case_id", "ops_category", "ai_risk", "title", "read", "created_at"]);
  }

  function toTalkOpsMessage(msg) {
    return {
      id: msg.id,
      room_id: msg.roomId || msg.chatId || OPS_ROOM_ID,
      sender_id: msg.senderId || "__ops_assistant__",
      sender_name: msg.senderName || "AI運営秘書",
      kind: msg.kind || "text",
      text: msg.text || "",
      ops_card: msg.opsCard || null,
      ops_summary: msg.opsSummary || msg.opsCommandText || null,
      created_at: msg.createdAt || new Date().toISOString(),
      read_at: msg.readAt || null,
      notification_synced: msg.notificationSynced !== false,
      summary_generated: msg.kind === "ops_summary" || Boolean(msg.summaryGenerated),
    };
  }

  async function insertSupportTicket(ticket) {
    const r = await upsertRow("support_tickets", toSupportTicket(ticket));
    if (r.ok) refreshReadCaches(["support_tickets"]);
    return r;
  }

  async function insertSupportEvent(event) {
    return upsertRow("support_events", toSupportEvent(event));
  }

  async function insertConnectIssue(issue) {
    const r = await upsertRow("connect_issues", toConnectIssue(issue));
    if (r.ok) refreshReadCaches(["connect_issues"]);
    return r;
  }

  async function insertSupportAdminNotification(entry) {
    const r = await upsertRow("support_admin_notifications", toSupportNotification(entry));
    if (r.ok) refreshReadCaches(["support_admin_notifications"]);
    return r;
  }

  async function insertAiOpsCase(caseRow) {
    const r = await upsertRow("ai_ops_cases", toAiOpsCase(caseRow));
    if (r.ok) refreshReadCaches(["ai_ops_cases"]);
    return r;
  }

  async function insertAiOpsEvent(event) {
    return upsertRow("ai_ops_events", toAiOpsEvent(event));
  }

  async function insertAiOpsAdminNotification(entry) {
    const r = await upsertRow("ai_ops_admin_notifications", toAiOpsNotification(entry));
    if (r.ok) refreshReadCaches(["ai_ops_admin_notifications"]);
    return r;
  }

  async function insertBuilderEvaluation(evaluation) {
    const r = await upsertRow("builder_partner_evaluations", toBuilderEvaluation(evaluation));
    if (r.ok) refreshReadCaches(["builder_partner_evaluations"]);
    return r;
  }

  async function insertBuilderStatusEvent(event) {
    return upsertRow("builder_partner_status_events", toBuilderStatusEvent(event));
  }

  async function updateSupportTicketStatus(ticketId, status) {
    const r = await updateRow("support_tickets", ticketId, {
      status,
      updated_at: new Date().toISOString(),
    });
    if (r.ok) refreshReadCaches(["support_tickets"]);
    return r;
  }

  async function updateSupportTicketAdminNote(ticketId, adminNote) {
    const r = await updateRow("support_tickets", ticketId, {
      admin_note: adminNote,
      updated_at: new Date().toISOString(),
    });
    if (r.ok) refreshReadCaches(["support_tickets"]);
    return r;
  }

  async function updateSupportTicketResolvedAt(ticketId, resolvedAt) {
    const r = await updateRow("support_tickets", ticketId, {
      resolved_at: resolvedAt,
      updated_at: new Date().toISOString(),
    });
    if (r.ok) refreshReadCaches(["support_tickets"]);
    return r;
  }

  async function markSupportNotificationRead(notificationId, read) {
    const r = await updateRow("support_admin_notifications", notificationId, {
      read: read !== false,
    });
    if (r.ok) refreshReadCaches(["support_admin_notifications"]);
    return r;
  }

  async function updateAiOpsCaseStatus(caseId, status) {
    const r = await updateRow("ai_ops_cases", caseId, {
      status,
      updated_at: new Date().toISOString(),
    });
    if (r.ok) refreshReadCaches(["ai_ops_cases"]);
    return r;
  }

  async function updateAiOpsCaseAdminNote(caseId, adminNote) {
    const r = await updateRow("ai_ops_cases", caseId, {
      admin_note: adminNote,
      updated_at: new Date().toISOString(),
    });
    if (r.ok) refreshReadCaches(["ai_ops_cases"]);
    return r;
  }

  async function updateAiOpsCaseResolvedAt(caseId, resolvedAt) {
    const r = await updateRow("ai_ops_cases", caseId, {
      resolved_at: resolvedAt,
      updated_at: new Date().toISOString(),
    });
    if (r.ok) refreshReadCaches(["ai_ops_cases"]);
    return r;
  }

  async function markAiOpsNotificationRead(notificationId, read) {
    const r = await updateRow("ai_ops_admin_notifications", notificationId, {
      read: read !== false,
    });
    if (r.ok) refreshReadCaches(["ai_ops_admin_notifications"]);
    return r;
  }

  async function updateBuilderPartnerVisibility(partnerId, partnerStatus) {
    const r = await upsertRow(
      "builder_partner_visibility",
      {
        partner_id: partnerId,
        partner_status: partnerStatus,
        updated_at: new Date().toISOString(),
      },
      "partner_id"
    );
    if (r.ok) refreshReadCaches(["builder_partner_visibility"]);
    return r;
  }

  async function insertTalkOpsMessage(msg) {
    const r = await upsertRow("talk_ops_messages", toTalkOpsMessage(msg));
    if (r.ok) refreshReadCaches(["talk_ops_messages"]);
    return r;
  }

  async function markTalkOpsMessageRead(messageId, readAt) {
    const r = await updateRow("talk_ops_messages", messageId, {
      read_at: readAt || new Date().toISOString(),
    });
    if (r.ok) refreshReadCaches(["talk_ops_messages"]);
    return r;
  }

  async function markTalkOpsMessageSynced(messageId, synced) {
    const r = await updateRow("talk_ops_messages", messageId, {
      notification_synced: synced !== false,
    });
    if (r.ok) refreshReadCaches(["talk_ops_messages"]);
    return r;
  }

  async function markTalkOpsSummaryGenerated(messageId, summaryText) {
    const patch = { summary_generated: true };
    if (summaryText != null) patch.ops_summary = summaryText;
    const r = await updateRow("talk_ops_messages", messageId, patch);
    if (r.ok) refreshReadCaches(["talk_ops_messages"]);
    return r;
  }

  function dualWriteTicketUpdate(ticket) {
    const W = global.TasuSupabaseOpsWrite;
    if (!W?.isEnabled?.()) return;
    if (ticket.status != null) void W.updateSupportTicketStatus(ticket.id, ticket.status);
    if (ticket.admin_note != null && ticket.admin_note !== "") {
      void W.updateSupportTicketAdminNote(ticket.id, ticket.admin_note);
    }
    if (ticket.resolved_at != null) {
      void W.updateSupportTicketResolvedAt(ticket.id, ticket.resolved_at);
    }
  }

  function dualWriteCaseUpdate(caseRow) {
    const W = global.TasuSupabaseOpsWrite;
    if (!W?.isEnabled?.()) return;
    if (caseRow.status != null) void W.updateAiOpsCaseStatus(caseRow.id, caseRow.status);
    if (caseRow.admin_note != null && caseRow.admin_note !== "") {
      void W.updateAiOpsCaseAdminNote(caseRow.id, caseRow.admin_note);
    }
    if (caseRow.resolved_at != null) {
      void W.updateAiOpsCaseResolvedAt(caseRow.id, caseRow.resolved_at);
    }
  }

  function clearFailuresForTests() {
    try {
      localStorage.removeItem(FAILURES_KEY);
    } catch {
      /* ignore */
    }
  }

  function setMockCaptureForTests(enabled) {
    mockCapture = enabled ? [] : null;
    opsWriteClient = null;
    opsWriteClientToken = "";
  }

  function getMockCaptureForTests() {
    return mockCapture ? [...mockCapture] : [];
  }

  function getStatus() {
    return {
      enabled: isEnabled(),
      canWrite: canWrite(),
      hasAdminToken: Boolean(Config()?.getOpsAccessToken?.()),
      failures: readFailures().length,
      mock: Boolean(mockCapture),
    };
  }

  global.TasuSupabaseOpsWrite = {
    FAILURES_KEY,
    isEnabled,
    canWrite,
    readFailures,
    logFailure,
    insertSupportTicket,
    insertSupportEvent,
    insertConnectIssue,
    insertSupportAdminNotification,
    insertAiOpsCase,
    insertAiOpsEvent,
    insertAiOpsAdminNotification,
    insertBuilderEvaluation,
    insertBuilderStatusEvent,
    updateSupportTicketStatus,
    updateSupportTicketAdminNote,
    updateSupportTicketResolvedAt,
    markSupportNotificationRead,
    updateAiOpsCaseStatus,
    updateAiOpsCaseAdminNote,
    updateAiOpsCaseResolvedAt,
    markAiOpsNotificationRead,
    updateBuilderPartnerVisibility,
    insertTalkOpsMessage,
    markTalkOpsMessageRead,
    markTalkOpsMessageSynced,
    markTalkOpsSummaryGenerated,
    dualWriteTicketUpdate,
    dualWriteCaseUpdate,
    clearFailuresForTests,
    setMockCaptureForTests,
    getMockCaptureForTests,
    getStatus,
  };
})(typeof window !== "undefined" ? window : globalThis);
