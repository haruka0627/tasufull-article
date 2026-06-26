/**
 * 安否 RLS — クライアント側アクセス判定・エラー処理（P9-4）
 * 本番: Supabase RLS + JWT member_id
 * 開発/E2E: mock ストアで同等ルールをシミュレート
 */
(function (global) {
  "use strict";

  const RLS_MOCK_ENFORCE_KEY = "tasu_anpi_rls_mock_enforce_v1";
  const PRODUCTION_RLS_KEY = "tasu_anpi_production_rls_v1";
  const CONTEXT_MOCK_KEY = "tasu_anpi_context_supabase_mock_v1";
  const LOGS_MOCK_KEY = "tasu_anpi_notification_logs_supabase_mock_v1";
  const MEMBER_ROLE_KEY = "tasu_member_role";
  const UNAUTHORIZED_EVENT = "tasu:anpi-rls-unauthorized";
  const CHECKLIST_PATH = "docs/anpi-supabase-production-checklist.md";

  /** @type {{ at: string, scope: string, detail?: object }|null} */
  let lastUnauthorizedEvent = null;

  /** @type {string|null} */
  let mockMemberId = null;
  /** @type {boolean|null} */
  let mockAdmin = null;

  function getRlsMemberId() {
    if (mockMemberId !== null) return String(mockMemberId || "").trim();
    return global.TasuAnpiIdentity?.resolveCurrentMemberId?.() || "";
  }

  function isAnpiLineAdminClient() {
    return global.TasuAnpiLineHealthcheck?.isAnpiLineAdmin?.() === true;
  }

  function readMemberRole() {
    try {
      return String(global.localStorage?.getItem(MEMBER_ROLE_KEY) || "").trim();
    } catch {
      return "";
    }
  }

  /**
   * JWT / Platform resolver 経由の運営判定（NB-1.5 · localStorage 権限昇格より優先）
   */
  function isAnpiAdminFromAuth() {
    if (global.TasuAuthCurrentUser?.isOpsUser?.()) return true;
    const resolver = global.TasuPlatformActorResolver;
    if (!resolver?.resolvePlatformActor) return false;
    const actor = resolver.resolvePlatformActor();
    if (actor.actor_type !== "admin") return false;
    if (actor.source === "admin_preview") {
      return global.TasuAuthCurrentUser?.canUseLocalStorageFallback?.() === true;
    }
    return actor.source === "jwt_ops" || actor.source === "jwt";
  }

  /**
   * デモのみ: legacy localStorage tasu_member_role（本番 host では無効）
   */
  function isAnpiAdminFromLegacyMemberRole() {
    if (global.TasuAuthCurrentUser?.canUseLocalStorageFallback?.() !== true) return false;
    const role = readMemberRole();
    return role === "tasu_admin" || role === "admin";
  }

  /**
   * 管理者: JWT is_ops / Platform resolver / LINE運用 / mock / demo LS role
   */
  function isAnpiAdmin() {
    if (mockAdmin === true) return true;
    if (mockAdmin === false) return false;
    if (isAnpiLineAdminClient()) return true;
    if (isAnpiAdminFromAuth()) return true;
    if (isAnpiAdminFromLegacyMemberRole()) return true;
    if (global.__ANPI_RLS_MOCK_ADMIN__ === true) return true;
    return false;
  }

  function isRlsMockEnforced() {
    if (global.__ANPI_RLS_MOCK_ENFORCE__ === true) return true;
    try {
      return global.localStorage?.getItem(RLS_MOCK_ENFORCE_KEY) === "1";
    } catch {
      return false;
    }
  }

  function rowIds(row) {
    if (!row || typeof row !== "object") {
      return { member_id: "", contract_holder_id: "", anpi_user_id: "", user_id: "" };
    }
    const anpiUserId = String(row.anpi_user_id || row.user_id || "").trim();
    return {
      member_id: String(row.member_id || "").trim(),
      contract_holder_id: String(row.contract_holder_id || "").trim(),
      anpi_user_id: anpiUserId,
      user_id: anpiUserId,
    };
  }

  function matchesMember(row, memberId) {
    const mid = String(memberId || "").trim();
    if (!mid) return false;
    const ids = rowIds(row);
    return (
      ids.member_id === mid ||
      ids.contract_holder_id === mid ||
      ids.anpi_user_id === mid ||
      ids.user_id === mid
    );
  }

  function canWriteMember(row, memberId) {
    const mid = String(memberId || "").trim();
    if (!mid) return false;
    const ids = rowIds(row);
    return ids.member_id === mid || ids.contract_holder_id === mid;
  }

  function canReadContextRow(row) {
    if (isAnpiAdmin()) return true;
    return matchesMember(row, getRlsMemberId());
  }

  function canWriteContextRow(row) {
    if (isAnpiAdmin()) return true;
    return canWriteMember(row, getRlsMemberId());
  }

  function canReadLogRow(row) {
    return canReadContextRow(row);
  }

  function canWriteLogRow(row) {
    return canWriteContextRow(row);
  }

  function isRlsError(err) {
    if (!err) return false;
    const code = String(err.code || err.status || "").trim();
    const msg = String(err.message || err.details || err || "").toLowerCase();
    return (
      code === "42501" ||
      code === "401" ||
      code === "403" ||
      code === "PGRST301" ||
      msg.includes("row-level security") ||
      msg.includes("permission denied") ||
      msg.includes("jwt") ||
      msg.includes("not authorized")
    );
  }

  function isSupabaseMockActive() {
    if (global.__ANPI_CONTEXT_SUPABASE_MOCK__ === true) return true;
    if (global.__ANPI_NOTIFICATION_LOGS_SUPABASE_MOCK__ === true) return true;
    try {
      return (
        global.localStorage?.getItem(CONTEXT_MOCK_KEY) === "1" ||
        global.localStorage?.getItem(LOGS_MOCK_KEY) === "1"
      );
    } catch {
      return false;
    }
  }

  function isProductionRlsMode() {
    if (isRlsMockEnforced() || isSupabaseMockActive()) return false;
    if (global.__ANPI_PRODUCTION_RLS__ === true) return true;
    try {
      if (global.localStorage?.getItem(PRODUCTION_RLS_KEY) === "1") return true;
    } catch {
      /* ignore */
    }
    return global.TasuSupabase?.isConfigured?.() === true;
  }

  function isAuthenticatedForSupabaseSync() {
    return global.TasuMemberAuth?.isAuthenticatedSync?.() === true;
  }

  /**
   * @returns {Promise<boolean>}
   */
  async function hasSupabaseAuthSession() {
    const client = global.TasuSupabase?.getClient?.();
    if (!client?.auth?.getSession) {
      return isAuthenticatedForSupabaseSync();
    }
    try {
      const { data } = await client.auth.getSession();
      return Boolean(data?.session?.access_token);
    } catch {
      return false;
    }
  }

  /**
   * 本番 RLS 時、未認証なら Supabase 書込を行わない
   * @param {string} scope
   */
  function shouldSkipSupabaseWrite(scope) {
    if (!isProductionRlsMode()) return false;
    if (isAuthenticatedForSupabaseSync()) return false;
    console.warn(
      "[AnpiRLS] skip Supabase write (unauthenticated, localStorage fallback)",
      scope
    );
    return true;
  }

  /**
   * @param {'context'|'logs'} kind
   */
  function getSaveMode(kind) {
    if (!global.TasuSupabase?.isConfigured?.()) {
      return "localStorage";
    }
    if (isSupabaseMockActive()) {
      return "supabase_mock";
    }
    if (shouldSkipSupabaseWrite(`${kind}.save`)) {
      return "localStorage";
    }
    if (isProductionRlsMode()) {
      return "supabase";
    }
    return "supabase";
  }

  function notifyUnauthorized(scope, detail) {
    const eventDetail = {
      scope: String(scope || "unknown"),
      member_id: getRlsMemberId(),
      admin: isAnpiAdmin(),
      at: new Date().toISOString(),
      ...(detail && typeof detail === "object" ? detail : {}),
    };
    lastUnauthorizedEvent = { at: eventDetail.at, scope: eventDetail.scope, detail: eventDetail };
    const payload = { detail: eventDetail, bubbles: true };
    console.warn("[AnpiRLS] unauthorized access", eventDetail);
    global.document?.dispatchEvent?.(new CustomEvent(UNAUTHORIZED_EVENT, payload));
    global.dispatchEvent?.(new CustomEvent(UNAUTHORIZED_EVENT, payload));
    global.document?.dispatchEvent?.(
      new CustomEvent("tasful:anpi-rls-unauthorized", payload)
    );
    global.dispatchEvent?.(new CustomEvent("tasful:anpi-rls-unauthorized", payload));
  }

  function getLastUnauthorizedEvent() {
    return lastUnauthorizedEvent ? { ...lastUnauthorizedEvent } : null;
  }

  /**
   * 管理画面 Production Readiness 用
   */
  function getProductionReadiness() {
    const authenticated = isAuthenticatedForSupabaseSync();
    const production = isProductionRlsMode();
    const mock = isSupabaseMockActive();
    return {
      rls_enabled: mock ? "mock" : production ? "production_assumed" : "dev_or_unknown",
      dev_policy_detected: "unknown_client",
      dev_policy_note:
        "dev ポリシー残存は DB 側確認が必要です（sql/anpi-rls-staging-verify.sql）",
      current_member_id: getRlsMemberId() || "—",
      authenticated,
      authenticated_label: authenticated ? "ログイン済み" : "未ログイン",
      admin_ui_flag: isAnpiLineAdminClient(),
      admin_db_role: "unknown_client",
      admin_db_role_note:
        "DB の tasu_admin は JWT app_metadata.role / is_ops です。tasu_member_role LS は demo のみ。",
      platform_actor: global.TasuPlatformActorResolver?.resolvePlatformActor?.() || null,
      context_save_mode: getSaveMode("context"),
      logs_save_mode: getSaveMode("logs"),
      supabase_sync_paused: shouldSkipSupabaseWrite("readiness"),
      supabase_sync_paused_message: shouldSkipSupabaseWrite("readiness")
        ? "未ログインのため DB 同期停止（localStorage のみ）"
        : "",
      last_unauthorized: getLastUnauthorizedEvent(),
      production_checklist_link: CHECKLIST_PATH,
      mock_enforced: isRlsMockEnforced(),
    };
  }

  /**
   * @param {Error|object} err
   * @param {string} scope
   * @param {object} [detail]
   * @returns {{ ok: false, error: string, unauthorized: true }|null}
   */
  function handleSupabaseError(err, scope, detail) {
    if (!isRlsError(err)) return null;
    notifyUnauthorized(scope, detail);
    return { ok: false, error: "unauthorized", unauthorized: true };
  }

  function filterContextRows(rows) {
    if (!Array.isArray(rows)) return [];
    if (!isRlsMockEnforced() || isAnpiAdmin()) return rows;
    return rows.filter((row) => canReadContextRow(row));
  }

  function filterLogRows(rows) {
    if (!Array.isArray(rows)) return [];
    if (!isRlsMockEnforced() || isAnpiAdmin()) return rows;
    return rows.filter((row) => canReadLogRow(row));
  }

  /**
   * E2E / テスト用
   * @param {{ memberId?: string, admin?: boolean }} ctx
   */
  function setMockRlsContext(ctx = {}) {
    if (Object.prototype.hasOwnProperty.call(ctx, "memberId")) {
      mockMemberId = ctx.memberId === null ? null : String(ctx.memberId || "");
    }
    if (Object.prototype.hasOwnProperty.call(ctx, "admin")) {
      mockAdmin = ctx.admin === true;
    }
  }

  function resetMockRlsContext() {
    mockMemberId = null;
    mockAdmin = null;
  }

  function getRlsState() {
    return {
      member_id: getRlsMemberId(),
      admin: isAnpiAdmin(),
      mock_enforced: isRlsMockEnforced(),
      line_admin: isAnpiLineAdminClient(),
      member_role: readMemberRole(),
    };
  }

  function bindUnauthorizedUi() {
    if (!global.document || global.document.documentElement?.dataset?.anpiRlsUiBound === "1") {
      return;
    }
    global.document.documentElement.dataset.anpiRlsUiBound = "1";
    global.document.addEventListener(UNAUTHORIZED_EVENT, () => {
      const host =
        global.document.querySelector("[data-anpi-dashboard-root]") ||
        global.document.querySelector("[data-anpi-line-admin-root]") ||
        global.document.body;
      if (!host) return;
      let el = global.document.querySelector("[data-anpi-rls-error]");
      if (!el) {
        el = global.document.createElement("p");
        el.setAttribute("data-anpi-rls-error", "");
        el.setAttribute("role", "alert");
        el.style.cssText =
          "margin:0.75rem 0;padding:0.65rem 0.85rem;background:#fef2f2;color:#991b1b;border:1px solid #fecaca;border-radius:6px;font-size:0.875rem;";
        host.prepend(el);
      }
      el.textContent =
        "安否データへのアクセス権限がありません。ログイン会員と契約者情報を確認してください。";
      el.hidden = false;
    });
  }

  if (global.document) {
    if (global.document.readyState === "loading") {
      global.document.addEventListener("DOMContentLoaded", bindUnauthorizedUi);
    } else {
      bindUnauthorizedUi();
    }
  }

  global.TasuAnpiRls = {
    RLS_MOCK_ENFORCE_KEY,
    PRODUCTION_RLS_KEY,
    UNAUTHORIZED_EVENT,
    CHECKLIST_PATH,
    getRlsMemberId,
    isAnpiAdmin,
    isAnpiAdminFromAuth,
    isAnpiAdminFromLegacyMemberRole,
    isRlsMockEnforced,
    isSupabaseMockActive,
    isProductionRlsMode,
    isAuthenticatedForSupabaseSync,
    hasSupabaseAuthSession,
    shouldSkipSupabaseWrite,
    getSaveMode,
    getLastUnauthorizedEvent,
    getProductionReadiness,
    canReadContextRow,
    canWriteContextRow,
    canReadLogRow,
    canWriteLogRow,
    isRlsError,
    handleSupabaseError,
    notifyUnauthorized,
    filterContextRows,
    filterLogRows,
    setMockRlsContext,
    resetMockRlsContext,
    getRlsState,
  };
})(typeof window !== "undefined" ? window : globalThis);
