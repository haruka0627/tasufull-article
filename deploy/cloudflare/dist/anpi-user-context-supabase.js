/**
 * 安否ユーザーコンテキスト — Supabase 永続化
 */
(function (global) {
  "use strict";

  const TABLE = "anpi_user_contexts";
  const MOCK_STORAGE_KEY = "tasu_anpi_context_supabase_mock_v1";

  function isMockEnabled() {
    if (global.__ANPI_CONTEXT_SUPABASE_MOCK__ === true) return true;
    try {
      return global.localStorage?.getItem(MOCK_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  }

  function getMockStore() {
    if (!global.__anpiContextSupabaseStore) {
      global.__anpiContextSupabaseStore = new Map();
    }
    return global.__anpiContextSupabaseStore;
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

  /**
   * DB行 → アプリコンテキスト（normalize 前の素形）
   * @param {object} row
   */
  function rowToContextShape(row) {
    if (!row || typeof row !== "object") return null;
    const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
    const anpiUserId = String(row.anpi_user_id || row.user_id || "").trim();
    return {
      user_id: anpiUserId,
      anpi_user_id: anpiUserId,
      member_id: String(row.member_id || "").trim(),
      relationship: String(row.relationship || meta.relationship || "").trim(),
      account_scope: String(row.account_scope || meta.account_scope || "").trim(),
      contract_holder_id: String(row.contract_holder_id || "").trim(),
      contract_holder_name: String(row.contract_holder_name || "").trim(),
      user_name: String(row.user_name || "").trim(),
      notification_level: String(row.notification_level || "call_only").trim(),
      contract_holder_contact_method: String(row.notification_method || "tasful_chat").trim(),
      notify_channels: Array.isArray(row.notify_channels) ? row.notify_channels : [],
      line_notification_enabled: row.line_notification_enabled === true,
      line_user_id: String(row.line_user_id || "").trim(),
      line_linked_at: row.line_linked_at ? String(row.line_linked_at) : "",
      line_user_id_enc: String(row.line_user_id_enc || "").trim(),
      line_oauth_access_token_enc: String(row.line_oauth_access_token_enc || "").trim(),
      line_oauth_token_expires_at: row.line_oauth_token_expires_at
        ? String(row.line_oauth_token_expires_at)
        : "",
      created_at: row.created_at ? String(row.created_at) : "",
      updated_at: row.updated_at ? String(row.updated_at) : "",
      is_anpi_user: meta.is_anpi_user !== false,
      user_phone_masked: String(meta.user_phone_masked || "").trim(),
      user_age_optional: String(meta.user_age_optional || "").trim(),
      user_relation_note: String(meta.user_relation_note || "").trim(),
      emergency_note: String(meta.emergency_note || "").trim(),
      contract_holder_relation: String(meta.contract_holder_relation || "").trim(),
      contract_holder_phone_masked: String(meta.contract_holder_phone_masked || "").trim(),
      contract_holder_email: String(meta.contract_holder_email || "").trim(),
      consent: meta.consent && typeof meta.consent === "object" ? meta.consent : {},
      metadata: meta,
      primary: meta.primary === true,
    };
  }

  /**
   * アプリコンテキスト → DB行
   * @param {object} ctx
   */
  function contextToRow(ctx) {
    if (!ctx || typeof ctx !== "object") return null;
    const identity = global.TasuAnpiIdentity?.normalizeAnpiIdentity?.(ctx, { forSave: true }) || ctx;
    const metaBase =
      identity.metadata && typeof identity.metadata === "object" ? { ...identity.metadata } : {};
    if (identity.primary === true) metaBase.primary = true;
    metaBase.relationship = identity.relationship || metaBase.relationship || "";
    metaBase.account_scope = identity.account_scope || metaBase.account_scope || "";

    return {
      user_id: String(identity.anpi_user_id || identity.user_id || "").trim(),
      anpi_user_id: String(identity.anpi_user_id || identity.user_id || "").trim(),
      member_id: String(identity.member_id || "").trim(),
      relationship: String(identity.relationship || "self").trim() || "self",
      account_scope: String(identity.account_scope || "self").trim() || "self",
      contract_holder_id: String(identity.contract_holder_id || "").trim(),
      contract_holder_name: String(ctx.contract_holder_name || "").trim(),
      user_name: String(ctx.user_name || "").trim(),
      notification_level: String(ctx.notification_level || "call_only").trim(),
      notification_method: String(ctx.contract_holder_contact_method || "tasful_chat").trim(),
      notify_channels: Array.isArray(ctx.notify_channels) ? ctx.notify_channels : ["tasful_chat"],
      line_notification_enabled: ctx.line_notification_enabled === true,
      line_user_id: emptyToNull(ctx.line_user_id),
      line_linked_at: emptyToNull(ctx.line_linked_at),
      line_user_id_enc: emptyToNull(ctx.line_user_id_enc),
      line_oauth_access_token_enc: emptyToNull(ctx.line_oauth_access_token_enc),
      line_oauth_token_expires_at: emptyToNull(ctx.line_oauth_token_expires_at),
      created_at: ctx.created_at || new Date().toISOString(),
      updated_at: ctx.updated_at || new Date().toISOString(),
      metadata: {
        is_anpi_user: true,
        user_phone_masked: identity.user_phone_masked || "",
        user_age_optional: identity.user_age_optional || "",
        user_relation_note: identity.user_relation_note || "",
        emergency_note: identity.emergency_note || "",
        contract_holder_relation: identity.contract_holder_relation || "",
        contract_holder_phone_masked: identity.contract_holder_phone_masked || "",
        contract_holder_email: identity.contract_holder_email || "",
        consent: identity.consent || {},
        relationship: identity.relationship || "",
        account_scope: identity.account_scope || "",
        primary: metaBase.primary === true,
      },
    };
  }

  function rls() {
    return global.TasuAnpiRls;
  }

  async function mockSelectByUserId(userId) {
    const row = getMockStore().get(String(userId || "").trim());
    if (!row) return null;
    const api = rls();
    if (api?.isRlsMockEnforced?.() && !api.canReadContextRow(row)) {
      api.notifyUnauthorized("context.read", { user_id: userId });
      return null;
    }
    return { ...row };
  }

  async function mockUpsert(row) {
    const uid = String(row.user_id || "").trim();
    if (!uid) return { data: null, error: { message: "user_id required" } };
    const api = rls();
    const existing = getMockStore().get(uid);
    if (api?.isRlsMockEnforced?.()) {
      if (existing) {
        if (!api.canWriteContextRow(existing)) {
          api.notifyUnauthorized("context.upsert", { user_id: uid, mode: "update_denied" });
          return { data: null, error: { message: "unauthorized", code: "42501" } };
        }
      } else if (!api.canWriteContextRow(row)) {
        api.notifyUnauthorized("context.upsert", { user_id: uid, mode: "insert_denied" });
        return { data: null, error: { message: "unauthorized", code: "42501" } };
      }
    }
    const next = {
      id: existing?.id || `mock_${uid}`,
      ...row,
      updated_at: row.updated_at || new Date().toISOString(),
      created_at: existing?.created_at || row.created_at || new Date().toISOString(),
    };
    getMockStore().set(uid, next);
    return { data: [next], error: null };
  }

  async function mockDelete(userId) {
    const uid = String(userId || "").trim();
    const api = rls();
    const existing = getMockStore().get(uid);
    if (api?.isRlsMockEnforced?.() && existing && !api.canWriteContextRow(existing)) {
      api.notifyUnauthorized("context.delete", { user_id: uid });
      return { error: { message: "unauthorized", code: "42501" } };
    }
    getMockStore().delete(uid);
    return { error: null };
  }

  /**
   * @param {string} userId
   * @returns {Promise<object|null>}
   */
  async function loadAnpiUserContext(userId) {
    const uid = String(userId || "").trim();
    if (!uid || !isAvailable()) return null;

    try {
      if (isMockEnabled()) {
        const row = await mockSelectByUserId(uid);
        return row ? rowToContextShape(row) : null;
      }

      if (rls()?.shouldSkipSupabaseWrite?.("context.load")) {
        return null;
      }

      const sb = getClient();
      if (!sb || sb.mock) return null;

      const { data, error } = await sb
        .from(TABLE)
        .select("*")
        .eq("user_id", uid)
        .maybeSingle();

      if (error) throw error;
      return data ? rowToContextShape(data) : null;
    } catch (err) {
      const denied = rls()?.handleSupabaseError?.(err, "context.read", { user_id: uid });
      if (denied) return null;
      console.warn("[AnpiContext] load failed", err instanceof Error ? err.message : err);
      return null;
    }
  }

  /**
   * @param {object} context
   * @returns {Promise<{ ok: boolean, row?: object, error?: string }>}
   */
  async function saveAnpiUserContext(context) {
    return upsertAnpiUserContext(context);
  }

  /**
   * @param {object} context
   * @returns {Promise<{ ok: boolean, row?: object, error?: string }>}
   */
  async function upsertAnpiUserContext(context) {
    const row = contextToRow(context);
    if (!row?.user_id) {
      return { ok: false, error: "user_id is required" };
    }
    if (!isAvailable()) {
      return { ok: false, error: "supabase_not_configured" };
    }

    if (rls()?.shouldSkipSupabaseWrite?.("context.upsert")) {
      return { ok: false, error: "supabase_skipped_unauthenticated", skipped: true };
    }

    try {
      if (isMockEnabled()) {
        const { data, error } = await mockUpsert(row);
        if (error) {
          const denied = rls()?.handleSupabaseError?.(error, "context.upsert", { user_id: row.user_id });
          if (denied) return denied;
          return { ok: false, error: error.message, unauthorized: error.message === "unauthorized" };
        }
        const saved = data?.[0] || row;
        return { ok: true, row: saved, context: rowToContextShape(saved) };
      }

      const sb = getClient();
      if (!sb || sb.mock) return { ok: false, error: "supabase_not_configured" };

      const { data, error } = await sb
        .from(TABLE)
        .upsert(row, { onConflict: "user_id" })
        .select("*")
        .single();

      if (error) throw error;
      return { ok: true, row: data, context: rowToContextShape(data) };
    } catch (err) {
      const denied = rls()?.handleSupabaseError?.(err, "context.upsert", { user_id: row.user_id });
      if (denied) return denied;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[AnpiContext] upsert failed", msg);
      return { ok: false, error: msg };
    }
  }

  /**
   * @param {string} userId
   * @returns {Promise<{ ok: boolean, error?: string }>}
   */
  async function deleteAnpiUserContext(userId) {
    const uid = String(userId || "").trim();
    if (!uid || !isAvailable()) return { ok: false, error: "not_available" };

    if (rls()?.shouldSkipSupabaseWrite?.("context.delete")) {
      return { ok: false, error: "supabase_skipped_unauthenticated", skipped: true };
    }

    try {
      if (isMockEnabled()) {
        const { error } = await mockDelete(uid);
        if (error) {
          const denied = rls()?.handleSupabaseError?.(error, "context.delete", { user_id: uid });
          if (denied) return denied;
          return { ok: false, error: error.message, unauthorized: true };
        }
        return { ok: true };
      }

      const sb = getClient();
      if (!sb || sb.mock) return { ok: false, error: "supabase_not_configured" };

      const { error } = await sb.from(TABLE).delete().eq("user_id", uid);
      if (error) throw error;
      return { ok: true };
    } catch (err) {
      const denied = rls()?.handleSupabaseError?.(err, "context.delete", { user_id: uid });
      if (denied) return denied;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[AnpiContext] delete failed", msg);
      return { ok: false, error: msg };
    }
  }

  /**
   * @param {string} userId
   * @returns {Promise<object|null>}
   */
  async function getAnpiUserContextByUserId(userId) {
    return loadAnpiUserContext(userId);
  }

  async function queryContextsByColumn(column, value) {
    const key = String(value || "").trim();
    if (!key || !isAvailable()) return [];

    try {
      if (isMockEnabled()) {
        const store = getMockStore();
        let rows = [...store.values()].filter((r) => String(r[column] || "").trim() === key);
        rows = rls()?.filterContextRows?.(rows) || rows;
        rows.sort((a, b) => parseTs(b.updated_at) - parseTs(a.updated_at));
        return rows.map(rowToContextShape).filter(Boolean);
      }

      const sb = getClient();
      if (!sb || sb.mock) return [];

      const { data, error } = await sb
        .from(TABLE)
        .select("*")
        .eq(column, key)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      const filtered = rls()?.filterContextRows?.(data || []) || data || [];
      return filtered.map(rowToContextShape).filter(Boolean);
    } catch (err) {
      const denied = rls()?.handleSupabaseError?.(err, "context.query", { column, value: key });
      if (denied) return [];
      console.warn(
        `[AnpiContext] query ${column} failed`,
        err instanceof Error ? err.message : err
      );
      return [];
    }
  }

  /**
   * @param {string} memberId
   * @returns {Promise<object[]>}
   */
  async function loadAnpiUserContextsByMemberId(memberId) {
    return queryContextsByColumn("member_id", memberId);
  }

  /**
   * @param {string} contractHolderId
   * @returns {Promise<object[]>}
   */
  async function loadAnpiUserContextsByContractHolderId(contractHolderId) {
    return queryContextsByColumn("contract_holder_id", contractHolderId);
  }

  /**
   * @param {string} memberId
   * @returns {Promise<object|null>}
   */
  async function getPrimaryAnpiUserContext(memberId) {
    const mid = String(memberId || "").trim();
    if (!mid) return null;
    const list = await loadAnpiUserContextsByMemberId(mid);
    if (!list.length) {
      const byHolder = await loadAnpiUserContextsByContractHolderId(mid);
      if (!byHolder.length) return null;
      return (
        global.TasuAnpiIdentity?.pickPrimaryAnpiUserContext?.(byHolder) || byHolder[0]
      );
    }
    return global.TasuAnpiIdentity?.pickPrimaryAnpiUserContext?.(list) || list[0];
  }

  global.TasuAnpiUserContextSupabase = {
    TABLE,
    MOCK_STORAGE_KEY,
    isAvailable,
    isMockEnabled,
    loadAnpiUserContext,
    saveAnpiUserContext,
    upsertAnpiUserContext,
    deleteAnpiUserContext,
    getAnpiUserContextByUserId,
    loadAnpiUserContextsByMemberId,
    loadAnpiUserContextsByContractHolderId,
    getPrimaryAnpiUserContext,
    rowToContextShape,
    contextToRow,
    parseTs,
  };
})(typeof window !== "undefined" ? window : globalThis);
