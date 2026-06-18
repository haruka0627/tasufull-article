/**
 * Auth helper コア判定（Node テスト用 · ブラウザ auth-current-user.js と同期）
 */
export const PRODUCTION_HOSTS = Object.freeze(["tasful.jp", "www.tasful.jp"]);

/** @param {{ hostname?: string, protocol?: string, search?: string, config?: Record<string, unknown> }} env */
export function isProductionHost(env) {
  const cfg = env.config || {};
  if (cfg.talkProductionMode === true) return true;
  if (cfg.talkProductionMode === false) return false;
  const host = String(env.hostname || "").toLowerCase();
  return PRODUCTION_HOSTS.includes(host);
}

/** @param {{ hostname?: string, protocol?: string, search?: string, config?: Record<string, unknown>, sessionStorage?: Record<string, string> }} env */
export function isDemoMode(env) {
  const cfg = env.config || {};
  if (cfg.talkDevMode === true) return true;
  if (isProductionHost(env)) return false;

  const params = new URLSearchParams(String(env.search || ""));
  if (params.get("talkDev") === "1") return true;

  const host = String(env.hostname || "").toLowerCase();
  if (!host || host === "localhost" || host === "127.0.0.1") return true;
  if (String(env.protocol || "").toLowerCase() === "file:") return true;

  if (params.get("benchEmbed") === "1") return true;
  if (params.get("demo") === "1") return true;
  if (params.get("preview") === "1") return true;

  const ss = env.sessionStorage || {};
  if (ss.tasu_ops_bench_mode === "1") return true;

  return false;
}

/** @param {{ hostname?: string, protocol?: string, search?: string, config?: Record<string, unknown>, sessionStorage?: Record<string, string> }} env */
export function canUseLocalStorageFallback(env) {
  if (isProductionHost(env)) return false;
  return isDemoMode(env);
}

/** @param {{ is_ops?: boolean | string, role?: string }} claims */
export function isOpsFromClaims(claims) {
  const isOps =
    claims.is_ops === true ||
    claims.is_ops === "true" ||
    claims.is_ops === 1 ||
    claims.is_ops === "1";
  if (isOps) return true;
  return String(claims.role || "").toLowerCase() === "tasu_admin";
}

/** @param {string} token */
export function decodeJwtPayload(token) {
  try {
    const part = String(token || "").split(".")[1];
    if (!part) return {};
    const json = Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
      "utf8"
    );
    return json ? JSON.parse(json) : {};
  } catch {
    return {};
  }
}

/** @param {Record<string, unknown>} payload @param {{ app_metadata?: Record<string, unknown> } | null} user */
export function extractClaimsFromJwt(payload, user) {
  const appMeta = { ...(user?.app_metadata || {}), ...(payload.app_metadata || {}) };
  const pick = (...vals) => {
    for (const v of vals) {
      const s = String(v ?? "").trim();
      if (s) return s;
    }
    return "";
  };
  const role = pick(appMeta.role, payload.role, "authenticated");
  const talkUserId = pick(appMeta.talk_user_id, payload.talk_user_id, appMeta.member_id, payload.sub);
  return {
    sub: pick(user?.id, payload.sub),
    talk_user_id: talkUserId,
    member_id: pick(appMeta.member_id, payload.member_id, talkUserId),
    role,
    platform_role: pick(appMeta.platform_role, payload.platform_role, "member"),
    partner_id: pick(appMeta.partner_id, payload.partner_id) || null,
    owner_id: pick(appMeta.owner_id, payload.owner_id) || null,
    is_ops: isOpsFromClaims({ is_ops: appMeta.is_ops ?? payload.is_ops, role }),
  };
}
