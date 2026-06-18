/**
 * 安否（Anpi）ユーザーコンテキスト — localStorage + Supabase 同期
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasu_anpi_user_context_v1";
  /** コンテキスト本体削除後も Supabase 復元用に user_id のみ保持 */
  const USER_ID_HINT_KEY = "tasu_anpi_user_id_hint_v1";
  const LINE_LINK_PREVIEW_KEY = "tasu_anpi_line_link_preview_v1";
  const LINE_OAUTH_SESSION_KEYS = [
    "tasu_anpi_line_auth_code_v1",
    "tasu_anpi_line_login_nonce_v1",
    "tasu_anpi_line_login_state_v1",
  ];

  const DEFAULT_NOTIFY_CHANNELS = ["tasful_chat"];

  const NOTIFICATION_LEVELS = new Set(["call_only", "important_only", "all_ai_actions"]);

  const CONTACT_METHODS = new Set(["tasful_chat", "line", "email"]);

  const NOTIFY_CHANNEL_OPTIONS = ["tasful_chat", "line", "email"];

  /** @type {{ source: string, restored: boolean, supabase_configured: boolean, last_sync_at: string }} */
  let storageMeta = {
    source: "none",
    restored: false,
    supabase_configured: false,
    last_sync_at: "",
  };

  /** @type {Promise<object>|null} */
  let syncPromise = null;

  /** local 保存のたびに増加 — 進行中 sync の古い結果適用を防ぐ */
  let syncGeneration = 0;

  function nowIso() {
    return new Date().toISOString();
  }

  function newId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * @param {string} phone
   * @returns {string}
   */
  function maskPhone(phone) {
    const digits = String(phone || "").replace(/\D/g, "");
    if (digits.length < 8) return "";
    const last4 = digits.slice(-4);
    let head = digits.slice(0, 3);
    if (digits.startsWith("0") && digits.length >= 10) {
      head = digits.slice(0, 2);
    }
    return `${head}-***-${last4}`;
  }

  function normalizeConsent(raw) {
    const c = raw && typeof raw === "object" ? raw : {};
    return {
      no_auto_execution: c.no_auto_execution === true,
      self_confirm_required: c.self_confirm_required === true,
      tasful_no_guarantee: c.tasful_no_guarantee === true,
      emergency_contact_required: c.emergency_contact_required === true,
      agreed_at: String(c.agreed_at || ""),
    };
  }

  function normalizeChannels(channels) {
    if (!Array.isArray(channels)) return [...DEFAULT_NOTIFY_CHANNELS];
    const list = channels
      .map((c) => String(c).trim())
      .filter((c) => NOTIFY_CHANNEL_OPTIONS.includes(c));
    return list.length ? list : [...DEFAULT_NOTIFY_CHANNELS];
  }

  /**
   * @param {object|null} raw
   * @param {{ forSave?: boolean }} [options]
   */
  function normalizeContext(raw, options = {}) {
    if (!raw || typeof raw !== "object") return null;
    if (raw.is_anpi_user !== true) return null;

    const ts = nowIso();
    const level = String(raw.notification_level || "call_only").trim();
    const contactMethod = String(raw.contract_holder_contact_method || "tasful_chat").trim();

    const ctx = {
      user_id: String(raw.user_id || newId("anpi_user")).trim(),
      user_name: String(raw.user_name || "").trim(),
      user_phone_masked: String(raw.user_phone_masked || "").trim(),
      user_age_optional: String(raw.user_age_optional || "").trim(),
      user_relation_note: String(raw.user_relation_note || "").trim(),
      emergency_note: String(raw.emergency_note || "").trim(),
      is_anpi_user: true,
      contract_holder_id: String(raw.contract_holder_id || newId("holder")).trim(),
      contract_holder_name: String(raw.contract_holder_name || "").trim(),
      contract_holder_relation: String(raw.contract_holder_relation || "").trim(),
      contract_holder_phone_masked: String(raw.contract_holder_phone_masked || "").trim(),
      contract_holder_email: String(raw.contract_holder_email || "").trim(),
      contract_holder_contact_method: CONTACT_METHODS.has(contactMethod)
        ? contactMethod
        : "tasful_chat",
      notify_channels: normalizeChannels(raw.notify_channels),
      notification_level: NOTIFICATION_LEVELS.has(level) ? level : "call_only",
      consent: normalizeConsent(raw.consent),
      line_notification_enabled: raw.line_notification_enabled === true,
      line_user_id: String(raw.line_user_id || "").trim(),
      line_linked_at: String(raw.line_linked_at || "").trim(),
      line_user_id_enc: String(raw.line_user_id_enc || "").trim(),
      line_oauth_access_token_enc: String(raw.line_oauth_access_token_enc || "").trim(),
      line_oauth_token_expires_at: String(raw.line_oauth_token_expires_at || "").trim(),
      created_at: String(raw.created_at || ts),
      updated_at: String(raw.updated_at || ts),
    };

    if (options.forSave && !ctx.consent.agreed_at) {
      ctx.consent.agreed_at = ts;
    }

    const identity = global.TasuAnpiIdentity?.normalizeAnpiIdentity?.(ctx, options);
    if (!identity) return ctx;

    return {
      ...ctx,
      member_id: identity.member_id,
      contract_holder_id: identity.contract_holder_id,
      anpi_user_id: identity.anpi_user_id,
      user_id: identity.user_id,
      relationship: identity.relationship,
      account_scope: identity.account_scope,
      metadata: identity.metadata,
    };
  }

  function getRawStored() {
    try {
      return JSON.parse(global.localStorage.getItem(STORAGE_KEY) || "null");
    } catch {
      return null;
    }
  }

  function getStorageInfo() {
    return { ...storageMeta };
  }

  function dispatchContextRestored(context) {
    const detail = { context, storage: getStorageInfo() };
    const payload = { detail, bubbles: true };
    global.document?.dispatchEvent?.(new CustomEvent("tasu:anpi-context-restored", payload));
    global.dispatchEvent?.(new CustomEvent("tasful:anpi-context-restored", payload));
  }

  function readUserIdHint() {
    try {
      return String(global.localStorage.getItem(USER_ID_HINT_KEY) || "").trim();
    } catch {
      return "";
    }
  }

  function writeUserIdHint(userId) {
    const id = String(userId || "").trim();
    if (!id) return;
    try {
      global.localStorage.setItem(USER_ID_HINT_KEY, id);
    } catch {
      /* ignore */
    }
  }

  function clearUserIdHint() {
    try {
      global.localStorage.removeItem(USER_ID_HINT_KEY);
    } catch {
      /* ignore */
    }
  }

  /**
   * @param {object|null} localCtx
   * @param {string} [explicitUserId]
   */
  function resolveLoadUserId(localCtx, explicitUserId) {
    if (global.TasuAnpiIdentity?.resolveLoadAnpiUserId) {
      return global.TasuAnpiIdentity.resolveLoadAnpiUserId(localCtx, explicitUserId);
    }
    const explicit = String(explicitUserId || "").trim();
    if (explicit) return explicit;
    if (localCtx?.anpi_user_id) return String(localCtx.anpi_user_id).trim();
    if (localCtx?.user_id) return String(localCtx.user_id).trim();
    const hint = readUserIdHint();
    if (hint) return hint;
    const cfg = global.TASU_CHAT_SUPABASE_CONFIG || global.TASU_SUPABASE_CONFIG || {};
    return String(cfg.currentUserId || cfg.current_user_id || "").trim();
  }

  function writeIdentityHintFromContext(context) {
    global.TasuAnpiIdentity?.writeIdentityHint?.(context);
  }

  function clearIdentityHint() {
    global.TasuAnpiIdentity?.clearIdentityHint?.();
  }

  function persistContextLocalOnly(context) {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(context));
    } catch {
      /* ignore */
    }
    writeIdentityHintFromContext(context);
    return context;
  }

  function queueSupabaseSave(context) {
    const api = global.TasuAnpiUserContextSupabase;
    if (!api?.upsertAnpiUserContext || !context?.user_id) return;
    void api.upsertAnpiUserContext(context).catch(() => {
      /* UI に影響させない */
    });
  }

  function getAnpiUserContext() {
    const ctx = normalizeContext(getRawStored());
    if (ctx && storageMeta.source === "none") {
      storageMeta.source = "localStorage";
    }
    return ctx;
  }

  function persistContext(context) {
    syncGeneration += 1;
    const normalized = normalizeContext(context, { forSave: true }) || context;
    persistContextLocalOnly(normalized);
    writeUserIdHint(normalized?.anpi_user_id || normalized?.user_id);
    storageMeta.source = "localStorage";
    storageMeta.restored = false;
    queueSupabaseSave(normalized);
    return normalized;
  }

  /**
   * localStorage と Supabase を updated_at で同期
   * @param {{ userId?: string }} [options]
   * @returns {Promise<{ ok: boolean, source: string, context: object|null, restored?: boolean }>}
   */
  async function syncAnpiUserContextWithSupabase(options = {}) {
    const api = global.TasuAnpiUserContextSupabase;
    const generationAtStart = syncGeneration;
    storageMeta.supabase_configured = api?.isAvailable?.() === true;
    storageMeta.last_sync_at = nowIso();

    const localAtStart = normalizeContext(getRawStored());
    const userId = resolveLoadUserId(localAtStart, options.userId);

    if (!api?.isAvailable?.()) {
      const local = normalizeContext(getRawStored());
      if (local) storageMeta.source = "localStorage";
      return { ok: true, source: storageMeta.source, context: local };
    }

    if (!userId && !localAtStart) {
      storageMeta.source = "none";
      return { ok: true, source: "none", context: null };
    }

    let remote = null;
    if (userId) {
      const remoteShape = await api.loadAnpiUserContext(userId);
      remote = normalizeContext(remoteShape);
    }

    const parseTs = api.parseTs || ((iso) => new Date(String(iso || "")).getTime() || 0);

    if (syncGeneration !== generationAtStart) {
      const current = getAnpiUserContext();
      storageMeta.source = "localStorage";
      storageMeta.restored = false;
      return { ok: true, source: "localStorage", context: current };
    }

    const local = normalizeContext(getRawStored());
    const localChangedDuringFetch =
      Boolean(localAtStart?.updated_at) &&
      Boolean(local?.updated_at) &&
      local.updated_at !== localAtStart.updated_at;

    const abortIfLocalChanged = () => {
      if (syncGeneration === generationAtStart) return null;
      const current = getAnpiUserContext();
      storageMeta.source = "localStorage";
      storageMeta.restored = false;
      return { ok: true, source: "localStorage", context: current };
    };

    if (!local && remote) {
      const aborted = abortIfLocalChanged();
      if (aborted) return aborted;
      persistContextLocalOnly(remote);
      writeUserIdHint(remote.user_id);
      storageMeta.source = "restored";
      storageMeta.restored = true;
      dispatchContextRestored(remote);
      return { ok: true, source: "restored", context: remote, restored: true };
    }

    if (local && !remote) {
      const aborted = abortIfLocalChanged();
      if (aborted) return aborted;
      void api.upsertAnpiUserContext(local);
      storageMeta.source = "localStorage";
      storageMeta.restored = false;
      return { ok: true, source: "localStorage", context: local };
    }

    if (local && remote) {
      const aborted = abortIfLocalChanged();
      if (aborted) return aborted;
      const freshLocal = normalizeContext(getRawStored()) || local;
      const freshTs = parseTs(freshLocal.updated_at);
      const startTs = parseTs(localAtStart?.updated_at);
      const remoteTs = parseTs(remote.updated_at);
      const localEditedSinceSyncStart = freshTs > startTs || localChangedDuringFetch;

      if (localEditedSinceSyncStart || freshTs >= remoteTs) {
        if (freshTs > remoteTs) {
          void api.upsertAnpiUserContext(freshLocal);
        }
        storageMeta.source = "localStorage";
        storageMeta.restored = false;
        return { ok: true, source: "localStorage", context: freshLocal };
      }
      if (remoteTs > freshTs) {
        const abortedRemote = abortIfLocalChanged();
        if (abortedRemote) return abortedRemote;
        persistContextLocalOnly(remote);
        writeUserIdHint(remote.user_id);
        storageMeta.source = "restored";
        storageMeta.restored = true;
        dispatchContextRestored(remote);
        return { ok: true, source: "restored", context: remote, restored: true };
      }
      storageMeta.source = "localStorage";
      storageMeta.restored = false;
      return { ok: true, source: "localStorage", context: freshLocal };
    }

    storageMeta.source = "none";
    storageMeta.restored = false;
    return { ok: true, source: "none", context: null };
  }

  function initAnpiUserContext() {
    if (!syncPromise) {
      syncPromise = syncAnpiUserContextWithSupabase();
    }
    return syncPromise;
  }

  function setAnpiUserContext(context) {
    const prev = getAnpiUserContext();
    const merged = {
      ...(prev || {}),
      ...(context || {}),
      is_anpi_user: true,
      created_at: prev?.created_at || context?.created_at || nowIso(),
      updated_at: nowIso(),
    };
    const next = normalizeContext(merged, { forSave: true });
    if (!next) {
      clearAnpiUserContext();
      return null;
    }
    return persistContext(next);
  }

  function clearAnpiUserContext() {
    const ctx = getAnpiUserContext();
    const userId = ctx?.user_id || resolveLoadUserId(null);
    try {
      global.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    storageMeta.source = "none";
    storageMeta.restored = false;
    clearUserIdHint();
    clearIdentityHint();
    if (userId) {
      void global.TasuAnpiUserContextSupabase?.deleteAnpiUserContext?.(userId);
    }
  }

  /**
   * 会員に紐づく primary コンテキスト（表示用）
   * @param {string} [memberId]
   * @returns {Promise<object|null>}
   */
  async function getPrimaryAnpiUserContext(memberId) {
    const mid =
      String(memberId || "").trim() ||
      global.TasuAnpiIdentity?.resolveCurrentMemberId?.() ||
      "";
    const local = getAnpiUserContext();
    const api = global.TasuAnpiUserContextSupabase;
    if (!mid || !api?.getPrimaryAnpiUserContext) {
      return local;
    }
    const remote = await api.getPrimaryAnpiUserContext(mid);
    const normalized = normalizeContext(remote);
    if (!normalized) return local;
    if (!local) return normalized;
    const parseTs = api.parseTs || ((iso) => new Date(String(iso || "")).getTime() || 0);
    if (parseTs(normalized.updated_at) >= parseTs(local.updated_at)) {
      return normalized;
    }
    return local;
  }

  /**
   * @param {string} memberId
   * @returns {Promise<object[]>}
   */
  async function loadAnpiUserContextsByMemberId(memberId) {
    const api = global.TasuAnpiUserContextSupabase;
    if (!api?.loadAnpiUserContextsByMemberId) return [];
    const rows = await api.loadAnpiUserContextsByMemberId(memberId);
    return rows.map((row) => normalizeContext(row)).filter(Boolean);
  }

  /**
   * @param {string} contractHolderId
   * @returns {Promise<object[]>}
   */
  async function loadAnpiUserContextsByContractHolderId(contractHolderId) {
    const api = global.TasuAnpiUserContextSupabase;
    if (!api?.loadAnpiUserContextsByContractHolderId) return [];
    const rows = await api.loadAnpiUserContextsByContractHolderId(contractHolderId);
    return rows.map((row) => normalizeContext(row)).filter(Boolean);
  }

  function isAnpiUser() {
    return Boolean(getAnpiUserContext()?.is_anpi_user);
  }

  function getLineLinkPreview() {
    try {
      const raw = JSON.parse(global.localStorage.getItem(LINE_LINK_PREVIEW_KEY) || "null");
      if (!raw || typeof raw !== "object") return null;
      const line_user_id = String(raw.line_user_id || "").trim();
      if (!line_user_id) return null;
      return {
        line_user_id,
        line_linked_at: String(raw.line_linked_at || ""),
        line_user_id_enc: String(raw.line_user_id_enc || "").trim(),
        line_oauth_access_token_enc: String(raw.line_oauth_access_token_enc || "").trim(),
        line_oauth_token_expires_at: String(raw.line_oauth_token_expires_at || "").trim(),
      };
    } catch {
      return null;
    }
  }

  function clearLineLinkPreview() {
    try {
      global.localStorage.removeItem(LINE_LINK_PREVIEW_KEY);
    } catch {
      /* ignore */
    }
  }

  function resolveLineUserId(ctx) {
    const fromCtx = String(ctx?.line_user_id || "").trim();
    if (fromCtx) return fromCtx;
    return String(getLineLinkPreview()?.line_user_id || "").trim();
  }

  function isLineLinked(ctx) {
    return Boolean(resolveLineUserId(ctx || getAnpiUserContext()));
  }

  /**
   * @returns {{ linked: boolean, line_user_id: string, line_linked_at: string, line_notification_enabled: boolean }}
   */
  function getLineLinkState() {
    const ctx = getAnpiUserContext();
    const preview = getLineLinkPreview();
    const line_user_id = resolveLineUserId(ctx);
    const linked = Boolean(line_user_id);
    return {
      linked,
      line_user_id,
      line_linked_at: String(ctx?.line_linked_at || preview?.line_linked_at || ""),
      line_notification_enabled: ctx?.line_notification_enabled === true,
    };
  }

  /**
   * LINE連携デモ用（送信APIなし・UI確認用）
   * @param {string} [lineUserId]
   */
  /**
   * LINE Login トークン交換成功後の連携保存
   * @param {{ userId: string, access_token?: string, expires_at?: string }} payload
   * @returns {Promise<{ ok: boolean, errors?: string[], context?: object }>}
   */
  async function applyLineOAuthLink(payload) {
    const userId = String(payload?.userId || "").trim();
    if (!userId) {
      return { ok: false, errors: ["TASFUL TALK userId が取得できませんでした。"] };
    }

    const linkedAt = nowIso();
    const cryptoApi = global.TasuAnpiLineOAuthCrypto;
    let line_user_id_enc = "";
    let line_oauth_access_token_enc = "";

    try {
      if (cryptoApi?.encryptSecret) {
        line_user_id_enc = await cryptoApi.encryptSecret(userId);
        if (payload?.access_token) {
          line_oauth_access_token_enc = await cryptoApi.encryptSecret(
            String(payload.access_token)
          );
        }
      }
    } catch {
      return { ok: false, errors: ["トークンの暗号化に失敗しました。"] };
    }

    const patch = {
      line_user_id: userId,
      line_linked_at: linkedAt,
      line_user_id_enc,
      line_oauth_access_token_enc,
      line_oauth_token_expires_at: String(payload?.expires_at || "").trim(),
    };

    const prev = getAnpiUserContext();
    if (prev) {
      const saved = setAnpiUserContext({
        ...patch,
        line_notification_enabled: prev.line_notification_enabled,
      });
      clearLineLinkPreview();
      return saved ? { ok: true, context: saved } : { ok: false, errors: ["保存に失敗しました。"] };
    }

    try {
      global.localStorage.setItem(
        LINE_LINK_PREVIEW_KEY,
        JSON.stringify({
          line_user_id: userId,
          line_linked_at: linkedAt,
          line_user_id_enc,
          line_oauth_access_token_enc,
          line_oauth_token_expires_at: patch.line_oauth_token_expires_at,
        })
      );
    } catch {
      return { ok: false, errors: ["TASFUL TALK連携の一時保存に失敗しました。"] };
    }

    return { ok: true, context: patch };
  }

  function clearLineOAuthSession() {
    LINE_OAUTH_SESSION_KEYS.forEach((key) => {
      try {
        global.sessionStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    });
    try {
      global.TasuAnpiLineLoginConfig?.clearAuthCode?.();
      global.TasuAnpiLineLoginConfig?.clearNonce?.();
    } catch {
      /* ignore */
    }
  }

  /**
   * LINE OAuth 連携解除 — userId / token / 暗号化フィールド削除
   * @returns {{ success: boolean, unlinked_at: string }}
   */
  function unlinkLineOAuth() {
    const unlinkedAt = nowIso();
    clearLineLinkPreview();
    clearLineOAuthSession();

    const prev = getAnpiUserContext();
    if (prev) {
      const channels = (prev.notify_channels || []).filter((ch) => ch !== "line");
      setAnpiUserContext({
        line_user_id: "",
        line_linked_at: "",
        line_user_id_enc: "",
        line_oauth_access_token_enc: "",
        line_oauth_token_expires_at: "",
        line_notification_enabled: false,
        notify_channels: channels.length ? channels : [...DEFAULT_NOTIFY_CHANNELS],
      });
    }

    return { success: true, unlinked_at: unlinkedAt };
  }

  function setLineLinkDemo(lineUserId) {
    const id = String(lineUserId || "").trim() || `line_${newId("demo")}`;
    const linkedAt = nowIso();
    const prev = getAnpiUserContext();
    if (prev) {
      return setAnpiUserContext({
        line_user_id: id,
        line_linked_at: linkedAt,
      });
    }
    try {
      global.localStorage.setItem(
        LINE_LINK_PREVIEW_KEY,
        JSON.stringify({ line_user_id: id, line_linked_at: linkedAt })
      );
    } catch {
      /* ignore */
    }
    return { line_user_id: id, line_linked_at: linkedAt };
  }

  function getContractHolderInfo() {
    const ctx = getAnpiUserContext();
    if (!ctx) return null;
    return {
      contract_holder_id: ctx.contract_holder_id,
      contract_holder_name: ctx.contract_holder_name,
      contract_holder_relation: ctx.contract_holder_relation,
      contract_holder_contact_method: ctx.contract_holder_contact_method,
      notify_channels: ctx.notify_channels,
      notification_level: ctx.notification_level,
    };
  }

  /**
   * @param {object} context
   * @returns {{ ok: boolean, errors: string[] }}
   */
  function validateAnpiContext(context) {
    const errors = [];
    const ctx = normalizeContext(context);
    if (!ctx) {
      errors.push("安否ユーザーとして登録されていません。");
      return { ok: false, errors };
    }
    if (!ctx.user_name) errors.push("利用者名を入力してください。");
    if (!ctx.contract_holder_name) errors.push("契約者名を入力してください。");
    if (!ctx.contract_holder_relation) errors.push("契約者との続柄を入力してください。");
    if (!ctx.contract_holder_email) errors.push("契約者メールを入力してください。");
    if (!ctx.user_phone_masked) errors.push("利用者電話番号を入力してください。");
    if (!ctx.contract_holder_phone_masked) {
      errors.push("契約者電話番号を入力してください。");
    }
    if (!ctx.notify_channels.length) errors.push("通知チャネルを1つ以上選択してください。");
    if (!NOTIFICATION_LEVELS.has(ctx.notification_level)) {
      errors.push("通知レベルを選択してください。");
    }
    const c = ctx.consent;
    if (!c.no_auto_execution) errors.push("自動実行に関する同意が必要です。");
    if (!c.self_confirm_required) errors.push("本人・契約者確認に関する同意が必要です。");
    if (!c.tasful_no_guarantee) errors.push("保証範囲に関する同意が必要です。");
    if (!c.emergency_contact_required) errors.push("緊急時の連絡に関する同意が必要です。");
    if (ctx.line_notification_enabled && !resolveLineUserId(ctx)) {
      errors.push("TASFUL TALK通知を利用するには、TASFUL TALK連携を完了してください。");
    }
    return { ok: errors.length === 0, errors };
  }

  /**
   * @param {object} formData
   * @returns {{ ok: boolean, errors: string[], context?: object }}
   */
  function saveFromRegisterForm(formData) {
    const prev = getAnpiUserContext();
    const fd = formData && typeof formData === "object" ? formData : {};

    const userPhoneRaw = String(fd.user_phone || "").trim();
    const holderPhoneRaw = String(fd.contract_holder_phone || "").trim();

    const userPhoneMasked = userPhoneRaw
      ? maskPhone(userPhoneRaw)
      : String(prev?.user_phone_masked || "").trim();
    const holderPhoneMasked = holderPhoneRaw
      ? maskPhone(holderPhoneRaw)
      : String(prev?.contract_holder_phone_masked || "").trim();

    const channels = NOTIFY_CHANNEL_OPTIONS.filter((ch) => fd[`notify_${ch}`] === true);

    const consent = {
      no_auto_execution: fd.consent_no_auto_execution === true,
      self_confirm_required: fd.consent_self_confirm_required === true,
      tasful_no_guarantee: fd.consent_tasful_no_guarantee === true,
      emergency_contact_required: fd.consent_emergency_contact_required === true,
      agreed_at:
        fd.consent_no_auto_execution &&
        fd.consent_self_confirm_required &&
        fd.consent_tasful_no_guarantee &&
        fd.consent_emergency_contact_required
          ? nowIso()
          : prev?.consent?.agreed_at || "",
    };

    const lineEnabled =
      fd.line_notification_enabled === true ||
      fd.line_notification_enabled === "1" ||
      fd.line_notification_enabled === "true";

    const memberId = global.TasuAnpiIdentity?.resolveCurrentMemberId?.(prev) || "";
    const holderId =
      memberId || String(prev?.contract_holder_id || "").trim() || newId("holder");

    const draft = {
      user_id: prev?.anpi_user_id || prev?.user_id || newId("anpi_user"),
      member_id: memberId || prev?.member_id || "",
      contract_holder_id: holderId,
      user_name: String(fd.user_name || "").trim(),
      user_phone_masked: userPhoneMasked,
      user_age_optional: String(fd.user_age_optional || "").trim(),
      user_relation_note: String(fd.user_relation_note || "").trim(),
      emergency_note: String(fd.emergency_note || "").trim(),
      is_anpi_user: true,
      contract_holder_name: String(fd.contract_holder_name || "").trim(),
      contract_holder_relation: String(fd.contract_holder_relation || "").trim(),
      contract_holder_phone_masked: holderPhoneMasked,
      contract_holder_email: String(fd.contract_holder_email || "").trim(),
      contract_holder_contact_method: String(fd.contract_holder_contact_method || "tasful_chat").trim(),
      notify_channels: channels,
      notification_level: String(fd.notification_level || "call_only").trim(),
      consent,
      line_notification_enabled: lineEnabled,
      line_user_id: resolveLineUserId(prev) || String(prev?.line_user_id || "").trim(),
      line_linked_at:
        String(prev?.line_linked_at || "").trim() ||
        String(getLineLinkPreview()?.line_linked_at || "").trim() ||
        (resolveLineUserId(prev) ? nowIso() : ""),
      line_user_id_enc:
        String(prev?.line_user_id_enc || "").trim() ||
        String(getLineLinkPreview()?.line_user_id_enc || "").trim(),
      line_oauth_access_token_enc:
        String(prev?.line_oauth_access_token_enc || "").trim() ||
        String(getLineLinkPreview()?.line_oauth_access_token_enc || "").trim(),
      line_oauth_token_expires_at:
        String(prev?.line_oauth_token_expires_at || "").trim() ||
        String(getLineLinkPreview()?.line_oauth_token_expires_at || "").trim(),
      created_at: prev?.created_at || nowIso(),
      updated_at: nowIso(),
    };

    if (lineEnabled && !draft.notify_channels.includes("line")) {
      draft.notify_channels = [...draft.notify_channels, "line"];
    }

    const validation = validateAnpiContext(draft);
    if (!validation.ok) {
      return { ok: false, errors: validation.errors };
    }

    const saved = normalizeContext(draft, { forSave: true });
    if (!saved) {
      return { ok: false, errors: ["保存に失敗しました。"] };
    }

    persistContext(saved);
    clearLineLinkPreview();

    const storedJson = global.localStorage.getItem(STORAGE_KEY) || "";
    if (userPhoneRaw && storedJson.includes(userPhoneRaw.replace(/\D/g, ""))) {
      return { ok: false, errors: ["電話番号の保存形式が不正です。"] };
    }
    if (holderPhoneRaw && storedJson.includes(holderPhoneRaw.replace(/\D/g, ""))) {
      return { ok: false, errors: ["契約者電話番号の保存形式が不正です。"] };
    }

    return { ok: true, errors: [], context: saved };
  }

  /**
   * フォーム復元用（電話の生値は返さない）
   */
  function getRegisterFormDefaults() {
    const ctx = getAnpiUserContext();
    if (!ctx) return null;
    return {
      user_name: ctx.user_name,
      user_age_optional: ctx.user_age_optional,
      user_relation_note: ctx.user_relation_note,
      emergency_note: ctx.emergency_note,
      user_phone_masked_hint: ctx.user_phone_masked,
      contract_holder_name: ctx.contract_holder_name,
      contract_holder_relation: ctx.contract_holder_relation,
      contract_holder_email: ctx.contract_holder_email,
      contract_holder_phone_masked_hint: ctx.contract_holder_phone_masked,
      contract_holder_contact_method: ctx.contract_holder_contact_method,
      notification_level: ctx.notification_level,
      notify_tasful_chat: ctx.notify_channels.includes("tasful_chat"),
      notify_line: ctx.notify_channels.includes("line"),
      notify_email: ctx.notify_channels.includes("email"),
      consent_no_auto_execution: ctx.consent.no_auto_execution,
      consent_self_confirm_required: ctx.consent.self_confirm_required,
      consent_tasful_no_guarantee: ctx.consent.tasful_no_guarantee,
      consent_emergency_contact_required: ctx.consent.emergency_contact_required,
      line_notification_enabled: ctx.line_notification_enabled,
      line_linked: isLineLinked(ctx),
      line_user_id: resolveLineUserId(ctx),
      line_linked_at: ctx.line_linked_at,
      created_at: ctx.created_at,
      updated_at: ctx.updated_at,
    };
  }

  global.TasuAnpiUserContext = {
    STORAGE_KEY,
    NOTIFY_CHANNEL_OPTIONS,
    NOTIFICATION_LEVELS,
    maskPhone,
    normalizeContext,
    getStorageInfo,
    initAnpiUserContext,
    syncAnpiUserContextWithSupabase,
    getAnpiUserContext,
    getPrimaryAnpiUserContext,
    loadAnpiUserContextsByMemberId,
    loadAnpiUserContextsByContractHolderId,
    setAnpiUserContext,
    saveFromRegisterForm,
    validateAnpiContext,
    getRegisterFormDefaults,
    clearAnpiUserContext,
    isAnpiUser,
    isLineLinked,
    getLineLinkState,
    setLineLinkDemo,
    applyLineOAuthLink,
    unlinkLineOAuth,
    clearLineOAuthSession,
    getContractHolderInfo,
  };

  if (global.document) {
    const boot = () => {
      void initAnpiUserContext();
    };
    if (global.document.readyState === "loading") {
      global.document.addEventListener("DOMContentLoaded", boot);
    } else {
      boot();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
