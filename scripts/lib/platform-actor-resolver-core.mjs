/**
 * Platform actor resolver コア（Node テスト用 · platform-actor-resolver.js と同期）
 */

export const ADMIN_RAW_ROLES = new Set(["admin", "ops", "tasu_admin", "service_role", "supabase_admin"]);
export const CLIENT_RAW_ROLES = new Set([
  "member",
  "owner",
  "user",
  "buyer",
  "customer",
  "client",
  "authenticated",
  "builder",
]);
export const PARTNER_RAW_ROLES = new Set(["partner", "vendor", "worker", "provider"]);

/** @param {string} raw */
export function mapRawRoleToActorType(raw) {
  const r = String(raw || "").trim().toLowerCase();
  if (!r) return "";
  if (ADMIN_RAW_ROLES.has(r)) return "admin";
  if (CLIENT_RAW_ROLES.has(r)) return "client";
  if (PARTNER_RAW_ROLES.has(r)) return "partner";
  if (r === "guest") return "guest";
  return "";
}

/**
 * @param {{
 *   claims?: Record<string, unknown>,
 *   user?: { source?: string, talkUserId?: string, authenticated?: boolean, platformRole?: string, role?: string },
 *   isOpsUser?: boolean,
 *   adminPreviewAllowed?: boolean,
 *   context?: Record<string, unknown>,
 * }} input
 */
export function resolvePlatformActorCore(input) {
  const claims = input.claims || {};
  const user = input.user || {};
  const ctx = input.context || {};

  const pickStr = (...vals) => {
    for (const v of vals) {
      const s = String(v ?? "").trim();
      if (s) return s;
    }
    return "";
  };

  const talkUserId = pickStr(
    ctx.talk_user_id,
    claims.talk_user_id,
    claims.member_id,
    claims.sub,
    user.talkUserId
  );
  const isOps =
    input.isOpsUser === true ||
    claims.is_ops === true ||
    String(claims.role || "").toLowerCase() === "tasu_admin";
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

  if (input.adminPreviewAllowed) {
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
