import { buildSupabaseServerHeaders, tryResolveSupabaseServerSecret } from "./supabase-server-secret.mjs";

/**
 * TLV LiveKit token authorization — server-side grants (V1-P0-03).
 * Client `role` is a request hint only; never the authority for canPublish.
 *
 * SSOT:
 *   live_permission → public.live_creator_profiles
 *     (creator_status=active AND live_permission_status in identity_verified|ops_approved)
 *   ownership → public.live_broadcasts.creator_id vs talk_user_id / auth user id
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROOM_PREFIX = "tlv_";

/**
 * @param {unknown} roleRaw
 * @returns {"host"|"viewer"}
 */
export function parseClientRoleHint(roleRaw) {
  const role = String(roleRaw || "viewer").trim().toLowerCase();
  if (role === "broadcaster" || role === "host" || role === "publisher") {
    return "host";
  }
  return "viewer";
}

/**
 * Matches client `TasuLiveConfig.hasBroadcastPermission`.
 * @param {{ creator_status?: string, live_permission_status?: string } | null | undefined} profile
 */
export function hasServerLivePermission(profile) {
  if (!profile) return false;
  const perm = String(profile.live_permission_status || "").trim();
  const status = String(profile.creator_status || "").trim();
  return (
    status === "active" &&
    (perm === "identity_verified" || perm === "ops_approved")
  );
}

/**
 * Formal room = `tlv_<broadcastUuid>`.
 * @param {string} roomName
 * @returns {{ formal: boolean, broadcastId: string | null }}
 */
export function parseFormalBroadcastRoom(roomName) {
  const room = String(roomName || "").trim();
  if (!room.startsWith(ROOM_PREFIX)) {
    return { formal: false, broadcastId: null };
  }
  const broadcastId = room.slice(ROOM_PREFIX.length);
  if (!UUID_RE.test(broadcastId)) {
    return { formal: false, broadcastId: null };
  }
  return { formal: true, broadcastId };
}

/**
 * @param {string} creatorId
 * @param {{ authUserId: string, talkUserId: string }} ids
 */
export function isBroadcastOwner(creatorId, ids) {
  const owner = String(creatorId || "").trim();
  if (!owner) return false;
  const candidates = [ids.talkUserId, ids.authUserId]
    .map((v) => String(v || "").trim())
    .filter(Boolean);
  return candidates.includes(owner);
}

/**
 * @param {string} broadcastId
 * @param {Record<string, string>} env
 * @param {typeof fetch} [fetchImpl]
 */
export async function fetchLiveBroadcastById(broadcastId, env, fetchImpl) {
  const doFetch = typeof fetchImpl === "function" ? fetchImpl : fetch;
  const url = String(env?.TASFUL_SUPABASE_URL || env?.SUPABASE_URL || "")
    .trim()
    .replace(/\/$/, "");
  const resolved = tryResolveSupabaseServerSecret(env);
  const serverCredential = resolved.ok ? resolved.credential : null;
  const serviceRoleKey = serverCredential?.value || "";
  if (!url || !serviceRoleKey || !UUID_RE.test(broadcastId)) {
    return { ok: false, code: "authz_unavailable", http: 503 };
  }
  try {
    const res = await doFetch(
      `${url}/rest/v1/live_broadcasts?id=eq.${encodeURIComponent(broadcastId)}` +
        `&select=id,creator_id,status&limit=1`,
      {
        headers: buildSupabaseServerHeaders(serverCredential),
      },
    );
    if (!res.ok) {
      return {
        ok: false,
        code: res.status >= 500 ? "authz_unavailable" : "room_not_found",
        http: res.status >= 500 ? 503 : 404,
      };
    }
    const rows = await res.json();
    const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
    if (!row) return { ok: false, code: "room_not_found", http: 404 };
    return { ok: true, row };
  } catch {
    return { ok: false, code: "authz_unavailable", http: 503 };
  }
}

/**
 * @param {string} userId talk_user_id or auth uuid
 * @param {Record<string, string>} env
 * @param {typeof fetch} [fetchImpl]
 */
export async function fetchCreatorProfileByUserId(userId, env, fetchImpl) {
  const doFetch = typeof fetchImpl === "function" ? fetchImpl : fetch;
  const url = String(env?.TASFUL_SUPABASE_URL || env?.SUPABASE_URL || "")
    .trim()
    .replace(/\/$/, "");
  const resolved = tryResolveSupabaseServerSecret(env);
  const serverCredential = resolved.ok ? resolved.credential : null;
  const serviceRoleKey = serverCredential?.value || "";
  const id = String(userId || "").trim();
  if (!url || !serviceRoleKey || !id) {
    return { ok: false, code: "authz_unavailable", http: 503 };
  }
  try {
    const res = await doFetch(
      `${url}/rest/v1/live_creator_profiles?user_id=eq.${encodeURIComponent(id)}` +
        `&select=user_id,creator_status,live_permission_status&limit=1`,
      {
        headers: buildSupabaseServerHeaders(serverCredential),
      },
    );
    if (!res.ok) {
      return {
        ok: false,
        code: res.status >= 500 ? "authz_unavailable" : "live_permission_denied",
        http: res.status >= 500 ? 503 : 403,
      };
    }
    const rows = await res.json();
    const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
    return { ok: true, row };
  } catch {
    return { ok: false, code: "authz_unavailable", http: 503 };
  }
}

/**
 * Resolve effective LiveKit grants. Client host hint without server checks → deny.
 *
 * @param {{
 *   authUserId: string,
 *   talkUserId: string,
 *   roomName: string,
 *   roleHint: "host"|"viewer",
 *   env: Record<string, string>,
 *   fetchImpl?: typeof fetch,
 * }} opts
 * @returns {Promise<
 *   | { ok: true, effectiveRole: "host"|"viewer", canPublish: boolean, canSubscribe: true, broadcastId: string|null, access: string }
 *   | { ok: false, error: string, http: number }
 * >}
 */
export async function resolveLiveKitTokenGrants(opts) {
  const authUserId = String(opts.authUserId || "").trim();
  const talkUserId = String(opts.talkUserId || authUserId).trim();
  const roomName = String(opts.roomName || "").trim();
  const roleHint = opts.roleHint === "host" ? "host" : "viewer";
  const env = opts.env || {};
  const fetchImpl = opts.fetchImpl;

  if (!authUserId) {
    return { ok: false, error: "auth_required", http: 401 };
  }

  // Viewer path: subscribe-only regardless of client canPublish / role aliases.
  if (roleHint === "viewer") {
    return {
      ok: true,
      effectiveRole: "viewer",
      canPublish: false,
      canSubscribe: true,
      broadcastId: parseFormalBroadcastRoom(roomName).broadcastId,
      access: "viewer_subscribe",
    };
  }

  // Isolated Snap Camera Kit QA rooms (tlv-snap-ck-qa-*) — authenticated publish only.
  // Does not weaken formal tlv_<broadcastUuid> ownership / live_permission.
  if (/^tlv-snap-ck-qa-[a-zA-Z0-9_-]{8,48}$/.test(roomName)) {
    return {
      ok: true,
      effectiveRole: "host",
      canPublish: true,
      canSubscribe: true,
      broadcastId: null,
      access: "snap_ck_isolated_qa",
    };
  }

  // Host path: formal broadcast room required.
  const formal = parseFormalBroadcastRoom(roomName);
  if (!formal.formal || !formal.broadcastId) {
    return { ok: false, error: "host_requires_formal_broadcast", http: 403 };
  }

  const broadcast = await fetchLiveBroadcastById(formal.broadcastId, env, fetchImpl);
  if (!broadcast.ok) {
    return { ok: false, error: broadcast.code, http: broadcast.http };
  }

  if (!isBroadcastOwner(broadcast.row.creator_id, { authUserId, talkUserId })) {
    return { ok: false, error: "broadcast_ownership_denied", http: 403 };
  }

  // Prefer talk_user_id (SSOT for live_creator_profiles.user_id), then auth uuid.
  let profileRes = await fetchCreatorProfileByUserId(talkUserId, env, fetchImpl);
  if (profileRes.ok && !profileRes.row && talkUserId !== authUserId) {
    profileRes = await fetchCreatorProfileByUserId(authUserId, env, fetchImpl);
  }
  if (!profileRes.ok) {
    return { ok: false, error: profileRes.code, http: profileRes.http };
  }
  if (!hasServerLivePermission(profileRes.row)) {
    return { ok: false, error: "live_permission_denied", http: 403 };
  }

  return {
    ok: true,
    effectiveRole: "host",
    canPublish: true,
    canSubscribe: true,
    broadcastId: formal.broadcastId,
    access: "host_owner_permission",
  };
}
