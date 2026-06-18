/**
 * 安否 ID 解決・正規化（P9-3）
 * member_id / contract_holder_id / anpi_user_id / user_id（後方互換）
 */
(function (global) {
  "use strict";

  const IDENTITY_HINT_KEY = "tasu_anpi_identity_hint_v1";
  const USER_ID_HINT_KEY = "tasu_anpi_user_id_hint_v1";

  const RELATIONSHIP_VALUES = new Set([
    "self",
    "parent",
    "child",
    "spouse",
    "relative",
    "other",
  ]);

  const ACCOUNT_SCOPE_VALUES = new Set(["self", "family", "managed"]);

  function nowIso() {
    return new Date().toISOString();
  }

  function newId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function readJsonStorage(key) {
    try {
      return JSON.parse(global.localStorage.getItem(key) || "null");
    } catch {
      return null;
    }
  }

  function readIdentityHint() {
    const raw = readJsonStorage(IDENTITY_HINT_KEY);
    if (!raw || typeof raw !== "object") return null;
    return {
      member_id: String(raw.member_id || "").trim(),
      contract_holder_id: String(raw.contract_holder_id || "").trim(),
      anpi_user_id: String(raw.anpi_user_id || raw.user_id || "").trim(),
      user_id: String(raw.user_id || raw.anpi_user_id || "").trim(),
    };
  }

  function writeIdentityHint(identity) {
    if (!identity || typeof identity !== "object") return;
    const member_id = String(identity.member_id || "").trim();
    const contract_holder_id = String(identity.contract_holder_id || "").trim();
    const anpi_user_id = String(identity.anpi_user_id || identity.user_id || "").trim();
    if (!member_id && !contract_holder_id && !anpi_user_id) return;
    const payload = {
      member_id,
      contract_holder_id,
      anpi_user_id,
      user_id: anpi_user_id,
      updated_at: nowIso(),
    };
    try {
      global.localStorage.setItem(IDENTITY_HINT_KEY, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }

  function clearIdentityHint() {
    try {
      global.localStorage.removeItem(IDENTITY_HINT_KEY);
    } catch {
      /* ignore */
    }
  }

  function readUserIdHint() {
    try {
      return String(global.localStorage.getItem(USER_ID_HINT_KEY) || "").trim();
    } catch {
      return "";
    }
  }

  function getSupabaseCurrentUserId() {
    const cfg = global.TASU_CHAT_SUPABASE_CONFIG || global.TASU_SUPABASE_CONFIG || {};
    return String(cfg.currentUserId || cfg.current_user_id || "").trim();
  }

  function getMemberAuthUserId() {
    const auth = global.TasuMemberAuth;
    if (!auth) return "";
    const session = auth.readMemberSession?.();
    const sessionId = String(session?.id || session?.userId || session?.user_id || "").trim();
    if (sessionId) return sessionId;
    const profile = auth.readLastProfile?.();
    return String(profile?.id || profile?.userId || profile?.user_id || "").trim();
  }

  /**
   * TASFUL ログイン会員 ID
   * @param {object} [context]
   */
  function resolveCurrentMemberId(context) {
    const ctx = context && typeof context === "object" ? context : {};

    const fromConfig = getSupabaseCurrentUserId();
    if (fromConfig) return fromConfig;

    const fromAuth = getMemberAuthUserId();
    if (fromAuth) return fromAuth;

    const fromCtx = String(ctx.member_id || "").trim();
    if (fromCtx) return fromCtx;

    const fromHolder = String(ctx.contract_holder_id || "").trim();
    if (fromHolder) return fromHolder;

    const fromUser = String(ctx.anpi_user_id || ctx.user_id || "").trim();
    if (fromUser) return fromUser;

    const hint = readIdentityHint();
    if (hint?.member_id) return hint.member_id;
    if (hint?.contract_holder_id) return hint.contract_holder_id;
    if (hint?.anpi_user_id) return hint.anpi_user_id;

    return readUserIdHint();
  }

  /**
   * 安否契約者 ID（通知閲覧側）
   * @param {object} [context]
   * @param {string} [memberId]
   */
  function resolveContractHolderId(context, memberId) {
    const ctx = context && typeof context === "object" ? context : {};
    const holder = String(ctx.contract_holder_id || "").trim();
    if (holder) return holder;

    const mid = String(memberId || resolveCurrentMemberId(ctx) || "").trim();
    if (mid) return mid;

    return String(ctx.anpi_user_id || ctx.user_id || "").trim();
  }

  /**
   * 安否利用者 ID（見守られる側）
   * @param {object} [context]
   * @param {{ generate?: boolean }} [options]
   */
  function resolveAnpiUserId(context, options = {}) {
    const ctx = context && typeof context === "object" ? context : {};
    const explicit = String(ctx.anpi_user_id || "").trim();
    if (explicit) return explicit;

    const legacy = String(ctx.user_id || "").trim();
    if (legacy) return legacy;

    const hint = readIdentityHint();
    if (hint?.anpi_user_id) return hint.anpi_user_id;

    const userHint = readUserIdHint();
    if (userHint) return userHint;

    if (options.generate === true) {
      return newId("anpi_user");
    }
    return "";
  }

  function inferRelationshipFromNote(note) {
    const t = String(note || "").trim();
    if (!t) return "";
    if (/本人|自分|契約者本人/.test(t)) return "self";
    if (/父|母|親|義父|義母|岳父|岳母/.test(t)) return "parent";
    if (/子|娘|息子|孫|甥|姪/.test(t)) return "child";
    if (/配偶|夫|妻|旦那|奥さん|パートナー/.test(t)) return "spouse";
    if (/兄弟|姉妹|祖父|祖母|叔|伯|従兄弟|いとこ|親戚/.test(t)) return "relative";
    return "";
  }

  function inferRelationship(ctx) {
    const meta =
      ctx.metadata && typeof ctx.metadata === "object" ? ctx.metadata : {};
    const fromMeta = String(meta.relationship || ctx.relationship || "").trim();
    if (RELATIONSHIP_VALUES.has(fromMeta)) return fromMeta;

    const fromHolderNote = inferRelationshipFromNote(ctx.contract_holder_relation);
    if (fromHolderNote) return fromHolderNote;

    const fromUserNote = inferRelationshipFromNote(ctx.user_relation_note);
    if (fromUserNote) return fromUserNote;

    return "other";
  }

  function inferAccountScope(ctx, relationship) {
    const explicit = String(ctx.account_scope || "").trim();
    if (ACCOUNT_SCOPE_VALUES.has(explicit)) return explicit;

    if (isSelfAnpiContext(ctx)) return "self";
    if (relationship === "self") return "self";
    return "family";
  }

  /**
   * @param {object} [context]
   */
  function isSelfAnpiContext(context) {
    const ctx = context && typeof context === "object" ? context : {};
    const memberId = String(ctx.member_id || resolveCurrentMemberId(ctx) || "").trim();
    const holderId = String(ctx.contract_holder_id || memberId || "").trim();
    const anpiUserId = String(
      ctx.anpi_user_id || ctx.user_id || resolveAnpiUserId(ctx) || ""
    ).trim();

    if (!anpiUserId) return false;
    if (memberId && anpiUserId === memberId) return true;
    if (holderId && anpiUserId === holderId) return true;

    const rel = String(ctx.relationship || "").trim();
    return rel === "self";
  }

  /**
   * 保存・読込前の ID 正規化
   * @param {object|null} raw
   * @param {{ forSave?: boolean }} [options]
   */
  function normalizeAnpiIdentity(raw, options = {}) {
    if (!raw || typeof raw !== "object") return null;

    const member_id = resolveCurrentMemberId(raw);
    const anpi_user_id =
      resolveAnpiUserId(raw, { generate: options.forSave === true }) || "";
    const contract_holder_id = resolveContractHolderId(raw, member_id);

    let relationship = String(raw.relationship || "").trim();
    if (!RELATIONSHIP_VALUES.has(relationship)) {
      relationship = isSelfAnpiContext({
        ...raw,
        member_id,
        contract_holder_id,
        anpi_user_id,
      })
        ? "self"
        : inferRelationship(raw);
    }

    const account_scope = inferAccountScope(
      { ...raw, member_id, contract_holder_id, anpi_user_id, relationship },
      relationship
    );

    const user_id = anpi_user_id;

    const meta =
      raw.metadata && typeof raw.metadata === "object"
        ? { ...raw.metadata }
        : {};
    if (raw.primary === true || meta.primary === true) {
      meta.primary = true;
    }
    meta.relationship = meta.relationship || relationship;
    meta.account_scope = meta.account_scope || account_scope;

    return {
      ...raw,
      member_id,
      contract_holder_id,
      anpi_user_id,
      user_id,
      relationship,
      account_scope,
      metadata: meta,
    };
  }

  /**
   * @param {object} [context]
   */
  function getAnpiIdentityKey(context) {
    const id = normalizeAnpiIdentity(context) || {};
    const parts = [
      id.member_id || "",
      id.contract_holder_id || "",
      id.anpi_user_id || id.user_id || "",
    ].filter(Boolean);
    return parts.join(":") || "";
  }

  /**
   * Supabase 復元用 anpi_user_id（user_id UNIQUE キー）
   * @param {object|null} localCtx
   * @param {string} [explicitUserId]
   */
  function resolveLoadAnpiUserId(localCtx, explicitUserId) {
    const explicit = String(explicitUserId || "").trim();
    if (explicit) return explicit;

    if (localCtx) {
      const fromLocal = String(localCtx.anpi_user_id || localCtx.user_id || "").trim();
      if (fromLocal) return fromLocal;
    }

    const hint = readIdentityHint();
    if (hint?.anpi_user_id) return hint.anpi_user_id;

    const legacyHint = readUserIdHint();
    if (legacyHint) return legacyHint;

    return getSupabaseCurrentUserId();
  }

  /**
   * @param {object[]} contexts
   */
  function pickPrimaryAnpiUserContext(contexts) {
    if (!Array.isArray(contexts) || !contexts.length) return null;

    const parseTs = (iso) => {
      const t = new Date(String(iso || "")).getTime();
      return Number.isFinite(t) ? t : 0;
    };

    const score = (ctx) => {
      const meta = ctx?.metadata && typeof ctx.metadata === "object" ? ctx.metadata : {};
      if (meta.primary === true || ctx.primary === true) return 300;
      if (String(ctx.account_scope || "").trim() === "self") return 200;
      if (String(ctx.relationship || "").trim() === "self") return 150;
      return 0;
    };

    return [...contexts].sort((a, b) => {
      const scoreDiff = score(b) - score(a);
      if (scoreDiff !== 0) return scoreDiff;
      return parseTs(b.updated_at) - parseTs(a.updated_at);
    })[0];
  }

  global.TasuAnpiIdentity = {
    IDENTITY_HINT_KEY,
    USER_ID_HINT_KEY,
    RELATIONSHIP_VALUES,
    ACCOUNT_SCOPE_VALUES,
    readIdentityHint,
    writeIdentityHint,
    clearIdentityHint,
    resolveCurrentMemberId,
    resolveContractHolderId,
    resolveAnpiUserId,
    normalizeAnpiIdentity,
    getAnpiIdentityKey,
    isSelfAnpiContext,
    resolveLoadAnpiUserId,
    pickPrimaryAnpiUserContext,
  };
})(typeof window !== "undefined" ? window : globalThis);
