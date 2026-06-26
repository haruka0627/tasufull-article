/**
 * TASFUL Platform — NB-1.5 Actor resolver (admin | client | partner | guest)
 * Builder builder-actor-resolver.js と同思想。Platform 本体向け薄い正規化レイヤ。
 *
 * 依存: auth-current-user.js（先に読み込む）
 * Builder 共通化は NB-2 以降 — 本ファイルは Platform のみ。
 */
(function (global) {
  "use strict";

  const ACTOR_TYPES = Object.freeze(["admin", "client", "partner", "guest"]);

  const ADMIN_RAW_ROLES = Object.freeze(
    new Set(["admin", "ops", "tasu_admin", "service_role", "supabase_admin"])
  );

  const CLIENT_RAW_ROLES = Object.freeze(
    new Set(["member", "owner", "user", "buyer", "customer", "client", "authenticated", "builder"])
  );

  const PARTNER_RAW_ROLES = Object.freeze(
    new Set(["partner", "vendor", "worker", "provider"])
  );

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function auth() {
    return global.TasuAuthCurrentUser || {};
  }

  /**
   * @param {string} raw
   * @returns {"admin"|"client"|"partner"|"guest"|""}
   */
  function mapRawRoleToActorType(raw) {
    const r = String(raw || "").trim().toLowerCase();
    if (!r) return "";
    if (ADMIN_RAW_ROLES.has(r)) return "admin";
    if (CLIENT_RAW_ROLES.has(r)) return "client";
    if (PARTNER_RAW_ROLES.has(r)) return "partner";
    if (r === "guest") return "guest";
    return "";
  }

  /** @deprecated use mapRawRoleToActorType — Builder 互換別名 */
  function normalizeActorType(raw) {
    return mapRawRoleToActorType(raw);
  }

  function isAdminPreviewAllowed() {
    if (auth().isOpsUser?.()) return false;
    if (auth().canUseLocalStorageFallback?.() !== true) return false;
    return auth().isPreviewMode?.() === true;
  }

  /**
   * @param {object} [context] optional hints: { platform_role, raw_role, talk_user_id }
   * @returns {{
   *   actor_type: string,
   *   talk_user_id: string,
   *   is_ops: boolean,
   *   platform_role: string,
   *   raw_role: string,
   *   source: string
   * }}
   */
  function resolvePlatformActor(context) {
    const ctx = context && typeof context === "object" ? context : {};
    const claims = auth().getCurrentUserClaims?.() || {};
    const user = auth().getCurrentUser?.() || {};

    const talkUserId = pickStr(
      ctx.talk_user_id,
      claims.talk_user_id,
      claims.member_id,
      claims.sub,
      user.talkUserId
    );
    const isOps =
      auth().isOpsUser?.() === true ||
      Boolean(claims.is_ops) ||
      pickStr(claims.role).toLowerCase() === "tasu_admin";
    const platformRole = pickStr(ctx.platform_role, claims.platform_role, user.platformRole, "member");
    const rawRole = pickStr(ctx.raw_role, claims.role, platformRole, user.role);

    if (isOps) {
      return {
        actor_type: "admin",
        talk_user_id: talkUserId,
        is_ops: true,
        platform_role: platformRole,
        raw_role: pickStr(claims.role, "tasu_admin"),
        source: "jwt_ops",
      };
    }

    if (isAdminPreviewAllowed()) {
      return {
        actor_type: "admin",
        talk_user_id: pickStr(talkUserId, "admin-preview"),
        is_ops: false,
        platform_role: "admin",
        raw_role: "preview",
        source: "admin_preview",
      };
    }

    const hintActor = mapRawRoleToActorType(pickStr(ctx.platform_role, ctx.raw_role));
    const jwtActor =
      mapRawRoleToActorType(platformRole) || mapRawRoleToActorType(rawRole) || hintActor;

    if (talkUserId && (user.source === "jwt" || user.authenticated)) {
      return {
        actor_type: jwtActor || "client",
        talk_user_id: talkUserId,
        is_ops: false,
        platform_role: platformRole,
        raw_role: rawRole,
        source: "jwt",
      };
    }

    if (talkUserId && user.source === "demo_fallback") {
      const demoActor = hintActor || jwtActor || "client";
      return {
        actor_type: demoActor,
        talk_user_id: talkUserId,
        is_ops: false,
        platform_role: pickStr(ctx.platform_role, platformRole, "member"),
        raw_role: pickStr(ctx.raw_role, rawRole, "member"),
        source: "demo_fallback",
      };
    }

    if (hintActor && hintActor !== "guest" && talkUserId) {
      return {
        actor_type: hintActor,
        talk_user_id: talkUserId,
        is_ops: false,
        platform_role: platformRole,
        raw_role: rawRole,
        source: "context_hint",
      };
    }

    return {
      actor_type: "guest",
      talk_user_id: "",
      is_ops: false,
      platform_role: "",
      raw_role: "",
      source: "guest",
    };
  }

  function isPlatformAdmin(actor) {
    return String(actor?.actor_type || "").trim() === "admin";
  }

  global.TasuPlatformActorResolver = {
    ACTOR_TYPES,
    ADMIN_RAW_ROLES,
    CLIENT_RAW_ROLES,
    PARTNER_RAW_ROLES,
    mapRawRoleToActorType,
    normalizeActorType,
    resolvePlatformActor,
    isPlatformAdmin,
    isAdminPreviewAllowed,
  };
})(typeof window !== "undefined" ? window : globalThis);
