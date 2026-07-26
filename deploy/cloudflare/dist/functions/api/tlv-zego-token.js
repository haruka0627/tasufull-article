/**
 * TLV Live — ZEGO Token 発行（Cloudflare Pages Function）
 * Secret: ZEGO_APP_ID · ZEGO_SERVER_SECRET · ZEGO_SERVER（任意上書き）
 * Auth: Bearer JWT 必須 · ZEGO userId は JWT subject のみ · room 権限 fail-closed
 * Payment/Wallet とは無関係 · token 全文はログしない
 */
import { buildRtcRoomPayload, generateToken04 } from "../_shared/zego-token04.mjs";
import {
  authCorsHeaders,
  pickSupabaseAuthEnv,
  requireSupabaseUser,
} from "../_shared/supabase-jwt-auth.mjs";

const MAX_BODY_BYTES = 8 * 1024;
const DEFAULT_TTL_SEC = 900;
const MAX_TTL_SEC = 3600;
const MIN_TTL_SEC = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;

/** @type {Map<string, { count: number, resetAt: number }>} */
const rateBuckets = new Map();

const FIXTURE_ROOM_RE = /^(tlv-e2e-|platform-poc-|live-fixture-)[a-zA-Z0-9._-]{1,100}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: authCorsHeaders("POST, OPTIONS"),
  });
}

function sanitizeZegoUserId(userId) {
  return String(userId || "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 64);
}

function clientIp(request) {
  return String(request.headers.get("CF-Connecting-IP") || "unknown").trim() || "unknown";
}

function enforceRateLimit(request) {
  const ip = clientIp(request);
  const now = Date.now();
  let bucket = rateBuckets.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateBuckets.set(ip, bucket);
  }
  bucket.count += 1;
  if (bucket.count > RATE_LIMIT_MAX) {
    return {
      ok: false,
      response: jsonResponse({ error: "rate_limited", code: "rate_limited" }, 429),
    };
  }
  return { ok: true };
}

function readContentLength(request) {
  const raw = request.headers.get("Content-Length");
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function isOwnedSyntheticRoom(roomId, authUserId, zegoUserId) {
  const room = String(roomId);
  if (room.includes(zegoUserId)) return true;
  if (room.includes(String(authUserId))) return true;
  const compact = String(authUserId).replace(/-/g, "");
  if (compact.length >= 8 && room.includes(compact.slice(0, 8))) return true;
  return false;
}

async function fetchLiveBroadcast(roomId, env) {
  const { url } = pickSupabaseAuthEnv(env);
  const serviceRoleKey = String(env?.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !serviceRoleKey || !UUID_RE.test(roomId)) return null;
  try {
    const res = await fetch(
      `${url}/rest/v1/live_broadcasts?id=eq.${encodeURIComponent(roomId)}` +
        `&select=id,creator_id,status&limit=1`,
      {
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
        },
      },
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  } catch {
    return null;
  }
}

/**
 * Room access: fixture · live_broadcasts UUID membership · owned synthetic room.
 * Arbitrary room IDs are rejected.
 */
async function assertRoomAccess({ authUserId, roomId, role, env }) {
  const room = String(roomId || "").trim();
  const zegoUserId = sanitizeZegoUserId(authUserId);
  if (!zegoUserId || zegoUserId.length < 3) {
    return { ok: false, error: "invalid_token", http: 401 };
  }
  if (!/^[a-zA-Z0-9._-]{3,128}$/.test(room)) {
    return { ok: false, error: "invalid_room", http: 400 };
  }

  const canPublish = role === "host" || role === "publisher";

  if (FIXTURE_ROOM_RE.test(room)) {
    return { ok: true, zegoUserId, access: "fixture" };
  }

  if (UUID_RE.test(room)) {
    const row = await fetchLiveBroadcast(room, env);
    if (!row) {
      return { ok: false, error: "room_not_found", http: 404 };
    }
    if (canPublish) {
      if (String(row.creator_id || "") !== authUserId) {
        return { ok: false, error: "room_forbidden", http: 403 };
      }
    } else {
      const status = String(row.status || "");
      if (!["live", "preparing", "scheduled"].includes(status)) {
        return { ok: false, error: "room_forbidden", http: 403 };
      }
    }
    return { ok: true, zegoUserId, access: "broadcast" };
  }

  if (isOwnedSyntheticRoom(room, authUserId, zegoUserId)) {
    return { ok: true, zegoUserId, access: "owned" };
  }

  return { ok: false, error: "room_forbidden", http: 403 };
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") return handleOptions();
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed", code: "method_not_allowed" }, 405);
  }

  const rate = enforceRateLimit(request);
  if (!rate.ok) return rate.response;

  const contentLength = readContentLength(request);
  if (contentLength != null && contentLength > MAX_BODY_BYTES) {
    return jsonResponse({ error: "payload_too_large", code: "payload_too_large" }, 413);
  }

  let body;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      return jsonResponse({ error: "payload_too_large", code: "payload_too_large" }, 413);
    }
    body = text ? JSON.parse(text) : {};
  } catch {
    return jsonResponse({ error: "Invalid JSON body", code: "invalid_json" }, 400);
  }

  const claimedUserId = String(body.userId || body.user_id || "").trim();
  const auth = await requireSupabaseUser(request, env, {
    claimedUserId: claimedUserId || undefined,
  });
  if (!auth.ok) {
    return jsonResponse({ error: auth.error, code: auth.error }, auth.http || 401);
  }

  const roomId = String(body.roomId || body.room_id || "").trim();
  const role = String(body.role || "audience").trim().toLowerCase();
  if (!roomId) {
    return jsonResponse({ error: "roomId is required", code: "invalid_room" }, 400);
  }

  const access = await assertRoomAccess({
    authUserId: auth.userId,
    roomId,
    role,
    env,
  });
  if (!access.ok) {
    return jsonResponse({ error: access.error, code: access.error }, access.http || 403);
  }

  // ZEGO credentials only after auth + room gate
  const appId = Number(env.ZEGO_APP_ID || 0);
  const serverSecret = String(env.ZEGO_SERVER_SECRET || "").trim();
  const server = String(env.ZEGO_SERVER || "").trim();

  if (!appId || !serverSecret) {
    return jsonResponse(
      {
        error: "ZEGO credentials not configured",
        hint:
          ".env に ZEGO_APP_ID と ZEGO_SERVER_SECRET（32 byte）を設定するか、PoC 画面の manual token（Console 24h）を使用してください",
        configured: false,
        code: "provider_not_configured",
      },
      503,
    );
  }

  if (serverSecret.length !== 32) {
    return jsonResponse(
      {
        error: "ZEGO_SERVER_SECRET must be 32 bytes",
        configured: false,
        code: "provider_misconfigured",
      },
      503,
    );
  }

  const canPublish = role === "host" || role === "publisher";
  const requestedTtl = Number(body.effectiveSeconds || DEFAULT_TTL_SEC);
  const effectiveSeconds = Math.min(
    Math.max(Number.isFinite(requestedTtl) ? requestedTtl : DEFAULT_TTL_SEC, MIN_TTL_SEC),
    MAX_TTL_SEC,
  );
  const payload = buildRtcRoomPayload({ roomId, canPublish });

  try {
    const token = await generateToken04(
      appId,
      access.zegoUserId,
      serverSecret,
      effectiveSeconds,
      payload,
    );
    return jsonResponse({
      token,
      appId,
      server: server || undefined,
      expiresIn: effectiveSeconds,
      role: canPublish ? "host" : "audience",
      userId: access.zegoUserId,
      configured: true,
    });
  } catch {
    return jsonResponse(
      {
        error: "token generation failed",
        configured: true,
        code: "token_generation_failed",
      },
      500,
    );
  }
}
