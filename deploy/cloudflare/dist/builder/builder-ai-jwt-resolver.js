/**
 * Builder AI — JWT claim 正本化（本番）+ dev fallback
 *
 * 本番: Supabase session JWT app_metadata から actor を解決
 * dev : URL query / localStorage / MVP state（TasuBuilderAIContext と併用）
 */
(function (global) {
  "use strict";

  const VERSION = "1.0.0-p2b";

  /** @type {object|null} */
  let cachedClaims = null;
  let cacheAt = 0;
  const CACHE_MS = 30_000;

  /** JWT 正本 claim キー（custom_access_token_hook 拡張予定） */
  const CLAIM_KEYS = Object.freeze({
    actorType: ["builder_actor_type", "actor_type"],
    actorId: ["builder_actor_id", "actor_id", "sub"],
    ownerId: ["builder_owner_id", "owner_id"],
    partnerId: ["builder_partner_id", "partner_id"],
    isAdmin: ["builder_is_admin", "is_ops"],
    projectScope: ["builder_project_scope"],
    threadScope: ["builder_thread_scope"],
  });

  function pickClaim(meta, keys) {
    const m = meta && typeof meta === "object" ? meta : {};
    for (const k of keys) {
      const v = m[k];
      if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
    }
    return "";
  }

  function parseBool(raw) {
    const s = String(raw || "").trim().toLowerCase();
    return s === "true" || s === "1" || s === "t" || s === "yes";
  }

  function normalizeActorType(raw) {
    return global.TasuBuilderAIContext?.normalizeActorType?.(raw) || String(raw || "guest").toLowerCase();
  }

  /**
   * @param {object} meta
   * @returns {object|null}
   */
  function claimsFromAppMetadata(meta) {
    const actorTypeRaw = pickClaim(meta, CLAIM_KEYS.actorType);
    const actorId = pickClaim(meta, CLAIM_KEYS.actorId);
    if (!actorTypeRaw && !actorId) return null;

    const isAdmin = parseBool(pickClaim(meta, CLAIM_KEYS.isAdmin));
    let actorType = normalizeActorType(actorTypeRaw);
    if (isAdmin && actorType !== "admin") actorType = "admin";

    return {
      source: "jwt",
      actorType,
      actorId: actorId || (actorType === "guest" ? "guest" : ""),
      ownerId: pickClaim(meta, CLAIM_KEYS.ownerId),
      partnerId: pickClaim(meta, CLAIM_KEYS.partnerId),
      isAdmin: isAdmin || actorType === "admin",
      projectScope: pickClaim(meta, CLAIM_KEYS.projectScope),
      threadScope: pickClaim(meta, CLAIM_KEYS.threadScope),
    };
  }

  function getSupabaseClient() {
    return global.TasuSupabase?.getClient?.() || null;
  }

  function isSupabaseConfigured() {
    return Boolean(global.TasuSupabase?.isConfigured?.());
  }

  /**
   * @returns {Promise<object|null>}
   */
  async function readJwtClaims(options) {
    const force = options && options.force;
    const now = Date.now();
    if (!force && cachedClaims && now - cacheAt < CACHE_MS) return cachedClaims;

    const sb = getSupabaseClient();
    if (!sb || !isSupabaseConfigured()) {
      cachedClaims = null;
      cacheAt = now;
      return null;
    }

    try {
      const { data, error } = await sb.auth.getSession();
      if (error || !data?.session?.access_token) {
        cachedClaims = null;
        cacheAt = now;
        return null;
      }
      const meta = data.session.user?.app_metadata || data.session.user?.user_metadata || {};
      const parsed = claimsFromAppMetadata(meta);
      cachedClaims = parsed;
      cacheAt = now;
      return parsed;
    } catch {
      cachedClaims = null;
      cacheAt = now;
      return null;
    }
  }

  /**
   * Sync actor for UI/tests — JWT cache first, then Context fallback.
   * @param {object} [options]
   */
  function resolveActor(options) {
    const opts = options && typeof options === "object" ? options : {};
    if (cachedClaims && !opts.forceFallback) {
      const c = cachedClaims;
      return {
        actorType: c.actorType,
        actorId: c.actorId,
        ownerId: c.ownerId || "",
        partnerId: c.partnerId || "",
        label:
          c.actorType === "admin"
            ? "運営"
            : c.actorType === "partner"
              ? "協力会社"
              : c.actorType === "owner"
                ? "依頼元"
                : "ゲスト",
        source: "jwt",
        isAdmin: Boolean(c.isAdmin),
      };
    }
    const fallback = global.TasuBuilderAIContext?.resolveActor?.(opts) || {
      actorType: "guest",
      actorId: "guest",
      label: "ゲスト",
    };
    return { ...fallback, source: "dev_fallback", isAdmin: fallback.actorType === "admin" };
  }

  /**
   * @returns {Promise<object>}
   */
  async function resolveActorAsync(options) {
    await readJwtClaims(options);
    return resolveActor(options);
  }

  function clearCache() {
    cachedClaims = null;
    cacheAt = 0;
  }

  function canPersistDrafts(actor) {
    const a = actor && typeof actor === "object" ? actor : resolveActor();
    return a.actorType !== "guest";
  }

  global.TasuBuilderAIJwtResolver = {
    VERSION,
    CLAIM_KEYS,
    claimsFromAppMetadata,
    readJwtClaims,
    resolveActor,
    resolveActorAsync,
    clearCache,
    canPersistDrafts,
    isSupabaseConfigured,
    getSupabaseClient,
  };
})(typeof window !== "undefined" ? window : globalThis);
