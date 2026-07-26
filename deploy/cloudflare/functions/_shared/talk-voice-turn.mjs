const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_TTL_SEC = 1200;
const MAX_TTL_SEC = 1800;
const MIN_TTL_SEC = 300;

export function enabled(value) {
  return value === true || value === 1 || /^(1|true|yes|on)$/i.test(String(value || ""));
}

export function getTurnConfig(env = {}) {
  const host = String(env.TALK_VOICE_TURN_HOST || "").trim().toLowerCase();
  const sharedSecret = String(env.TALK_VOICE_TURN_SHARED_SECRET || "").trim();
  const realm = String(env.TALK_VOICE_TURN_REALM || host).trim();
  const ttlRequested = Number(env.TALK_VOICE_TURN_CREDENTIAL_TTL_SEC || DEFAULT_TTL_SEC);
  const ttlSec = Math.min(
    MAX_TTL_SEC,
    Math.max(MIN_TTL_SEC, Number.isFinite(ttlRequested) ? Math.floor(ttlRequested) : DEFAULT_TTL_SEC),
  );
  const tlsPort = Math.min(65535, Math.max(1, Number(env.TALK_VOICE_TURN_TLS_PORT || 443)));
  const production =
    String(env.CF_PAGES_ENV || "").toLowerCase() === "production" ||
    String(env.CF_PAGES_BRANCH || "") === "cf-pages-deploy";
  return {
    featureEnabled: !production && enabled(env.TALK_VOICE_SELF_HOSTED_TURN_ENABLED),
    host,
    realm,
    sharedSecret,
    ttlSec,
    tlsPort,
  };
}

export function validateTurnConfig(config) {
  if (!config.featureEnabled) return { ok: false, error: "feature_disabled", http: 404 };
  if (
    !config.host ||
    !/^(?=.{1,253}$)(?!-)[a-z0-9.-]+(?<!-)$/.test(config.host) ||
    config.host === "localhost"
  ) {
    return { ok: false, error: "turn_unavailable", http: 503 };
  }
  if (!config.sharedSecret || config.sharedSecret.length < 32) {
    return { ok: false, error: "turn_unavailable", http: 503 };
  }
  return { ok: true };
}

function base64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function createTurnRestCredential({
  sharedSecret,
  sessionId,
  talkUserId,
  nowMs = Date.now(),
  ttlSec = DEFAULT_TTL_SEC,
}) {
  if (!UUID_RE.test(String(sessionId || ""))) throw new Error("invalid_session_id");
  const safeUser = String(talkUserId || "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 64);
  if (!safeUser) throw new Error("invalid_user_id");
  const boundedTtl = Math.min(MAX_TTL_SEC, Math.max(MIN_TTL_SEC, Math.floor(Number(ttlSec) || DEFAULT_TTL_SEC)));
  const expiresEpoch = Math.floor(nowMs / 1000) + boundedTtl;
  const username = `${expiresEpoch}:${String(sessionId).toLowerCase()}:${safeUser}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(sharedSecret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(username));
  return {
    username,
    credential: base64(new Uint8Array(signature)),
    expiresAt: new Date(expiresEpoch * 1000).toISOString(),
    ttlSec: boundedTtl,
  };
}

export function buildIceServers(config, credential) {
  const host = config.host;
  return [
    { urls: `stun:${host}:3478` },
    {
      urls: `turn:${host}:3478?transport=udp`,
      username: credential.username,
      credential: credential.credential,
    },
    {
      urls: `turn:${host}:3478?transport=tcp`,
      username: credential.username,
      credential: credential.credential,
    },
    {
      urls: `turns:${host}:${config.tlsPort}?transport=tcp`,
      username: credential.username,
      credential: credential.credential,
    },
  ];
}

async function restRows({ url, serviceRoleKey, table, query, fetchImpl = fetch }) {
  const response = await fetchImpl(`${url}/rest/v1/${table}?${query}`, {
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    const error = response.status >= 500 ? "database_unavailable" : "access_lookup_failed";
    return { ok: false, error, http: response.status >= 500 ? 503 : 500 };
  }
  const rows = await response.json();
  return { ok: true, rows: Array.isArray(rows) ? rows : [] };
}

export async function assertTurnSessionAccess({
  supabaseUrl,
  serviceRoleKey,
  sessionId,
  talkUserId,
  nowMs = Date.now(),
  fetchImpl = fetch,
}) {
  if (!UUID_RE.test(String(sessionId || ""))) return { ok: false, error: "invalid_session", http: 400 };
  if (!supabaseUrl || !serviceRoleKey) return { ok: false, error: "auth_unavailable", http: 503 };

  const sessionResult = await restRows({
    url: supabaseUrl,
    serviceRoleKey,
    table: "talk_call_sessions",
    query:
      `id=eq.${encodeURIComponent(sessionId)}` +
      "&select=id,room_id,caller_id,callee_id,status,expires_at,session_limit_seconds&limit=1",
    fetchImpl,
  });
  if (!sessionResult.ok) return sessionResult;
  const session = sessionResult.rows[0];
  if (!session) return { ok: false, error: "session_not_found", http: 404 };
  if (![session.caller_id, session.callee_id].map(String).includes(String(talkUserId))) {
    return { ok: false, error: "session_forbidden", http: 403 };
  }
  if (String(session.status) !== "active") {
    return { ok: false, error: "session_inactive", http: 409 };
  }

  const roomResult = await restRows({
    url: supabaseUrl,
    serviceRoleKey,
    table: "transaction_rooms",
    query:
      `id=eq.${encodeURIComponent(session.room_id)}` +
      "&select=id,buyer_id,seller_id,status,expires_at&limit=1",
    fetchImpl,
  });
  if (!roomResult.ok) return roomResult;
  const room = roomResult.rows[0];
  if (!room) return { ok: false, error: "thread_not_found", http: 404 };
  const roomParticipants = [room.buyer_id, room.seller_id].map(String);
  if (
    !roomParticipants.includes(String(talkUserId)) ||
    !roomParticipants.includes(String(session.caller_id)) ||
    !roomParticipants.includes(String(session.callee_id))
  ) {
    return { ok: false, error: "thread_forbidden", http: 403 };
  }
  if (["blocked", "closed", "cancelled"].includes(String(room.status))) {
    return { ok: false, error: "thread_inactive", http: 409 };
  }
  const peerId =
    String(talkUserId) === String(session.caller_id)
      ? String(session.callee_id)
      : String(session.caller_id);
  const user = encodeURIComponent(String(talkUserId));
  const peer = encodeURIComponent(peerId);
  const blockResult = await restRows({
    url: supabaseUrl,
    serviceRoleKey,
    table: "blocked_users",
    query:
      `or=(and(blocker_id.eq.${user},blocked_id.eq.${peer}),` +
      `and(blocker_id.eq.${peer},blocked_id.eq.${user}))&select=id&limit=1`,
    fetchImpl,
  });
  if (!blockResult.ok) return blockResult;
  if (blockResult.rows.length) return { ok: false, error: "participant_blocked", http: 403 };
  return { ok: true, session, room };
}

export const TURN_LIMITS = Object.freeze({
  DEFAULT_TTL_SEC,
  MAX_TTL_SEC,
  MIN_TTL_SEC,
});
