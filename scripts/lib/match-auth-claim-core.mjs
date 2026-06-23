/**
 * Node mirror of supabase/functions/_shared/match-auth.ts claim extraction (L8 prep).
 * Keep in sync with extractTalkUserIdFromClaims / extractAdminRoleFromClaims.
 */
/** @param {Record<string, unknown> | null} claims */
export function readAppMetadata(claims) {
  const nested = claims?.app_metadata;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return /** @type {Record<string, unknown>} */ (nested);
  }
  return {};
}

function pickString(...values) {
  for (const v of values) {
    const s = String(v ?? "").trim();
    if (s) return s;
  }
  return "";
}

/** @param {Record<string, unknown> | null} claims */
export function extractTalkUserIdFromClaims(claims) {
  if (!claims || typeof claims !== "object") return null;
  const appMeta = readAppMetadata(claims);
  const talkUserId = pickString(
    appMeta.talk_user_id,
    claims.talk_user_id,
    appMeta.member_id,
  );
  return talkUserId || null;
}

/** @param {Record<string, unknown> | null} claims */
export function extractMemberIdFromClaims(claims) {
  if (!claims || typeof claims !== "object") return null;
  const appMeta = readAppMetadata(claims);
  return pickString(appMeta.member_id, appMeta.talk_user_id) || null;
}

/** @param {Record<string, unknown> | null} claims */
export function extractAdminRoleFromClaims(claims) {
  if (!claims || typeof claims !== "object") {
    return { isAdmin: false, adminRole: null };
  }
  const appMeta = readAppMetadata(claims);
  const role = pickString(appMeta.role, claims.role).toLowerCase();
  const isOpsRaw = appMeta.is_ops ?? claims.is_ops;
  const isOps =
    isOpsRaw === true || String(isOpsRaw ?? "").trim().toLowerCase() === "true";
  if (role === "tasu_admin") return { isAdmin: true, adminRole: "tasu_admin" };
  if (role === "match_admin") return { isAdmin: true, adminRole: "match_admin" };
  if (isOps) return { isAdmin: true, adminRole: "is_ops" };
  return { isAdmin: false, adminRole: role || null };
}

/** @param {Record<string, unknown>} appMeta */
export function assertHookMergeClaims(appMeta) {
  if (appMeta.role !== "authenticated") {
    throw new Error(`hook role expected authenticated, got ${appMeta.role}`);
  }
  if (appMeta.platform_role !== "member") {
    throw new Error(`hook platform_role expected member, got ${appMeta.platform_role}`);
  }
  if (appMeta.is_ops !== false) {
    throw new Error(`hook is_ops expected false, got ${appMeta.is_ops}`);
  }
}

const DEMO_IDS = new Set(["u_me", "u_hiro"]);

/** @param {string | null} talkUserId @param {string} slotLabel */
export function assertNotDemoMisroute(talkUserId, slotLabel) {
  if (!talkUserId) throw new Error(`${slotLabel}: empty talkUserId`);
  if (DEMO_IDS.has(talkUserId)) {
    throw new Error(`${slotLabel}: misrouted to demo id ${talkUserId}`);
  }
}
