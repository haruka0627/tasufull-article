/**
 * Builder AI — draft 永続化（localStorage + optional Supabase · P2-B）
 */
(function (global) {
  "use strict";

  const VERSION = "1.1.0-p2b";
  const STORAGE_KEY = "tasu_builder_ai_drafts_v1";
  const MAX_DRAFTS = 50;
  const EVENT_NAME = "tasu:builder-ai-drafts-changed";

  function uid() {
    return `draft_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function getJwtResolver() {
    return global.TasuBuilderAIJwtResolver;
  }

  function getSupabaseAdapter() {
    return global.TasuBuilderAIDraftSupabase;
  }

  function readAll() {
    try {
      const raw = global.localStorage?.getItem(STORAGE_KEY);
      const list = JSON.parse(raw || "[]");
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  function writeAll(list) {
    const trimmed = list.slice(0, MAX_DRAFTS);
    global.localStorage?.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    try {
      global.dispatchEvent(new CustomEvent(EVENT_NAME));
    } catch {
      /* ignore */
    }
    return trimmed;
  }

  function normalizeActor(actor) {
    const a = actor && typeof actor === "object" ? actor : {};
    return {
      actorType: String(a.actorType || "guest").trim().toLowerCase(),
      actorId: String(a.actorId || a.ownerId || a.partnerId || "guest").trim(),
      ownerId: String(a.ownerId || "").trim(),
      partnerId: String(a.partnerId || "").trim(),
      label: String(a.label || "").trim(),
    };
  }

  function canPersistDrafts(actor) {
    const Jwt = getJwtResolver();
    if (Jwt?.canPersistDrafts) return Jwt.canPersistDrafts(actor);
    return normalizeActor(actor).actorType !== "guest";
  }

  function canAccessDraft(row, actor) {
    if (!row) return false;
    const a = normalizeActor(actor);
    if (a.actorType === "admin") return true;
    return row.actor_type === a.actorType && row.actor_id === a.actorId;
  }

  function canViewDraft(row, actor) {
    if (!row || row.hidden || row.archived) return false;
    return canAccessDraft(row, actor);
  }

  function canMutateDraft(row, actor) {
    return canAccessDraft(row, actor);
  }

  function validateDraftContent(content) {
    const text = String(content || "").trim();
    if (!text) return { ok: false, error: "empty_content" };
    if (!text.includes("下書き") && !text.startsWith("【下書き")) {
      return { ok: false, error: "not_draft_content" };
    }
    return { ok: true, content: text };
  }

  function buildLocalRow(params, actor) {
    return {
      id: uid(),
      content: params.content,
      action: String(params.action || "faq_answer").trim(),
      project_id: String(params.projectId || "").trim(),
      thread_id: String(params.threadId || "").trim(),
      actor_type: actor.actorType,
      actor_id: actor.actorId,
      owner_id: actor.ownerId || "",
      partner_id: actor.partnerId || "",
      actor_label: actor.label || actor.actorType,
      visibility: "scoped",
      created_at: new Date().toISOString(),
      hidden: false,
      archived: false,
      storage: "local",
      metadata: params.metadata && typeof params.metadata === "object" ? params.metadata : {},
    };
  }

  function saveLocal(row) {
    const list = readAll();
    list.unshift(row);
    writeAll(list);
    return { ok: true, draft: row };
  }

  function mergeRemoteId(localId, remoteDraft) {
    if (!localId || !remoteDraft?.id) return;
    const list = readAll();
    const idx = list.findIndex((r) => r.id === localId);
    if (idx < 0) return;
    list[idx] = {
      ...list[idx],
      supabase_id: remoteDraft.id,
      storage: "supabase",
      synced_at: new Date().toISOString(),
    };
    writeAll(list);
  }

  /**
   * localStorage を正とし、Supabase は best-effort 同期。
   * AI 回答は常にローカル保存成功で返す。
   * @param {{ content: string, action?: string, projectId?: string, threadId?: string, actor?: object, metadata?: object }} params
   */
  function saveDraft(params) {
    const valid = validateDraftContent(params?.content);
    if (!valid.ok) return valid;

    const actor = normalizeActor(params?.actor);
    if (!canPersistDrafts(actor)) {
      return { ok: false, error: "guest_no_draft" };
    }

    const row = buildLocalRow({ ...params, content: valid.content }, actor);
    const localResult = saveLocal(row);
    if (!localResult.ok) return localResult;

    const Supa = getSupabaseAdapter();
    if (Supa?.isReady) {
      void Supa.isReady()
        .then((ready) => {
          if (!ready) return null;
          return Supa.insertDraft(row, actor);
        })
        .then((remote) => {
          if (remote?.ok && remote.draft) mergeRemoteId(row.id, remote.draft);
        })
        .catch(() => {
          /* local fallback already saved */
        });
    }

    return { ok: true, draft: row, storage: "local", supabase: "pending" };
  }

  /**
   * @param {object} actor
   * @param {{ projectId?: string, includeHidden?: boolean, includeArchived?: boolean }} [options]
   */
  function listDrafts(actor, options) {
    const opts = options && typeof options === "object" ? options : {};
    const projectId = String(opts.projectId || "").trim();
    const includeHidden = Boolean(opts.includeHidden);
    const includeArchived = Boolean(opts.includeArchived);

    if (!canPersistDrafts(actor)) return [];

    return readAll()
      .filter((row) => {
        if (!includeArchived && row.archived) return false;
        if (!includeHidden && row.hidden) return false;
        if (!canAccessDraft(row, actor)) return false;
        if (projectId && row.project_id !== projectId) return false;
        return true;
      })
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }

  /**
   * Supabase から取得してローカルにマージ（best-effort）
   * @param {object} actor
   */
  async function syncFromSupabase(actor) {
    const Supa = getSupabaseAdapter();
    if (!Supa?.isReady || !canPersistDrafts(actor)) return { ok: false, error: "not_ready" };
    const ready = await Supa.isReady();
    if (!ready) return { ok: false, error: "not_ready" };

    const remote = await Supa.fetchDrafts(actor);
    if (!remote.ok) return remote;

    const local = readAll();
    const bySupabaseId = new Map(local.filter((r) => r.supabase_id).map((r) => [r.supabase_id, r]));
    remote.drafts.forEach((rd) => {
      if (bySupabaseId.has(rd.id)) return;
      if (!canAccessDraft(rd, actor)) return;
      local.unshift({ ...rd, supabase_id: rd.id, storage: "supabase" });
    });
    writeAll(local);
    return { ok: true, merged: remote.drafts.length };
  }

  function getDraft(id, actor) {
    const row = readAll().find((r) => r.id === id || r.supabase_id === id);
    if (!row || !canViewDraft(row, actor)) return null;
    return row;
  }

  function hideDraft(id, actor) {
    const list = readAll();
    const idx = list.findIndex((r) => r.id === id || r.supabase_id === id);
    if (idx < 0) return { ok: false, error: "not_found" };
    if (!canMutateDraft(list[idx], actor)) return { ok: false, error: "forbidden" };

    list[idx] = { ...list[idx], hidden: true, hidden_at: new Date().toISOString() };
    writeAll(list);

    const Supa = getSupabaseAdapter();
    const remoteId = list[idx].supabase_id;
    if (Supa?.hideDraftRemote && remoteId) {
      void Supa.hideDraftRemote(remoteId).catch(() => {});
    }

    return { ok: true, draft: list[idx] };
  }

  function archiveDraft(id, actor) {
    const list = readAll();
    const idx = list.findIndex((r) => r.id === id || r.supabase_id === id);
    if (idx < 0) return { ok: false, error: "not_found" };
    if (!canMutateDraft(list[idx], actor)) return { ok: false, error: "forbidden" };
    list[idx] = { ...list[idx], archived: true, archived_at: new Date().toISOString() };
    writeAll(list);
    return { ok: true, draft: list[idx] };
  }

  function deleteDraft(id, actor) {
    const list = readAll();
    const row = list.find((r) => r.id === id || r.supabase_id === id);
    if (!row) return { ok: false, error: "not_found" };
    if (!canMutateDraft(row, actor)) return { ok: false, error: "forbidden" };
    writeAll(list.filter((r) => r.id !== row.id));
    return { ok: true };
  }

  global.TasuBuilderAIDraftStore = {
    VERSION,
    STORAGE_KEY,
    MAX_DRAFTS,
    EVENT_NAME,
    saveDraft,
    listDrafts,
    getDraft,
    hideDraft,
    archiveDraft,
    deleteDraft,
    syncFromSupabase,
    canViewDraft,
    canAccessDraft,
    canPersistDrafts,
    validateDraftContent,
    readAll,
  };
})(typeof window !== "undefined" ? window : globalThis);
