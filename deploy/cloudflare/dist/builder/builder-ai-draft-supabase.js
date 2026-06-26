/**
 * Builder AI — Supabase draft adapter（staging · optional）
 * 失敗時は呼び出し元が localStorage に fallback する
 */
(function (global) {
  "use strict";

  const TABLE = "builder_ai_drafts";
  const VERSION = "1.0.0-p2b";

  function getClient() {
    return global.TasuBuilderAIJwtResolver?.getSupabaseClient?.() || global.TasuSupabase?.getClient?.() || null;
  }

  function isConfigured() {
    return Boolean(global.TasuSupabase?.isConfigured?.());
  }

  async function hasSession() {
    const sb = getClient();
    if (!sb) return false;
    try {
      const { data, error } = await sb.auth.getSession();
      return !error && Boolean(data?.session?.access_token);
    } catch {
      return false;
    }
  }

  async function isReady() {
    if (!isConfigured()) return false;
    return hasSession();
  }

  function rowToLocal(record) {
    if (!record) return null;
    return {
      id: String(record.id || ""),
      content: String(record.content || ""),
      action: String(record.action || "faq_answer"),
      project_id: String(record.project_id || ""),
      thread_id: String(record.thread_id || ""),
      actor_type: String(record.actor_type || ""),
      actor_id: String(record.actor_id || ""),
      owner_id: String(record.owner_id || ""),
      partner_id: String(record.partner_id || ""),
      visibility: String(record.visibility || "scoped"),
      hidden: Boolean(record.hidden),
      archived: Boolean(record.archived),
      metadata: record.metadata && typeof record.metadata === "object" ? record.metadata : {},
      created_at: record.created_at || new Date().toISOString(),
      storage: "supabase",
    };
  }

  function buildInsertPayload(row, actor) {
    const a = actor || {};
    return {
      project_id: row.project_id || null,
      thread_id: row.thread_id || null,
      actor_type: row.actor_type || a.actorType,
      actor_id: row.actor_id || a.actorId,
      owner_id: row.owner_id || a.ownerId || null,
      partner_id: row.partner_id || a.partnerId || null,
      action: row.action,
      content: row.content,
      visibility: row.visibility || "scoped",
      hidden: false,
      archived: false,
      is_draft: true,
      metadata: row.metadata || { source: "builder_ai", local_id: row.id || null },
    };
  }

  /**
   * @param {object} row
   * @param {object} actor
   */
  async function insertDraft(row, actor) {
    const sb = getClient();
    if (!sb) return { ok: false, error: "no_client" };
    if (!(await hasSession())) return { ok: false, error: "no_session" };

    const payload = buildInsertPayload(row, actor);
    const { data, error } = await sb.from(TABLE).insert(payload).select("*").maybeSingle();
    if (error) return { ok: false, error: error.message || "insert_failed" };
    return { ok: true, draft: rowToLocal(data) };
  }

  /**
   * @param {object} actor
   * @param {{ projectId?: string, includeHidden?: boolean, includeArchived?: boolean }} [options]
   */
  async function fetchDrafts(actor, options) {
    const sb = getClient();
    if (!sb) return { ok: false, error: "no_client", drafts: [] };
    if (!(await hasSession())) return { ok: false, error: "no_session", drafts: [] };

    const opts = options && typeof options === "object" ? options : {};
    let q = sb.from(TABLE).select("*").order("created_at", { ascending: false }).limit(50);
    if (!opts.includeArchived) q = q.eq("archived", false);
    if (!opts.includeHidden) q = q.eq("hidden", false);
    if (opts.projectId) q = q.eq("project_id", opts.projectId);

    const { data, error } = await q;
    if (error) return { ok: false, error: error.message || "fetch_failed", drafts: [] };
    const list = (Array.isArray(data) ? data : []).map(rowToLocal).filter(Boolean);
    return { ok: true, drafts: list };
  }

  async function hideDraftRemote(id) {
    const sb = getClient();
    if (!sb) return { ok: false, error: "no_client" };
    if (!(await hasSession())) return { ok: false, error: "no_session" };
    const { data, error } = await sb.from(TABLE).update({ hidden: true }).eq("id", id).select("*").maybeSingle();
    if (error) return { ok: false, error: error.message || "update_failed" };
    return { ok: true, draft: rowToLocal(data) };
  }

  global.TasuBuilderAIDraftSupabase = {
    VERSION,
    TABLE,
    isConfigured,
    hasSession,
    isReady,
    insertDraft,
    fetchDrafts,
    hideDraftRemote,
    rowToLocal,
  };
})(typeof window !== "undefined" ? window : globalThis);
