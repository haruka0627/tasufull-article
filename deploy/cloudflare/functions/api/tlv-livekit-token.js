/**
 * TLV LiveKit Cloud — Access Token issuer (server-side only).
 * Formal Migration V1 + PoC share this endpoint.
 * Secrets: LIVEKIT_API_KEY · LIVEKIT_API_SECRET · LIVEKIT_URL (ws/wss)
 * Never returns apiSecret. Never logs full token.
 * Enable: LIVEKIT_FORMAL_ENABLED or LIVEKIT_POC_ENABLED, or local credentials present.
 * Auth: Supabase JWT required · anonymous / DEV_SKIP_AUTH forbidden.
 *
 * V1-P0-03: Client `role` is a hint only. Host grants require
 * authenticated user + broadcast ownership + server-side live_permission.
 */
import { createLiveKitAccessToken } from "../_shared/livekit-access-token.mjs";
import {
  authCorsHeaders,
  extractBearerToken,
  pickSupabaseAuthEnv,
  verifySupabaseAccessToken,
} from "../_shared/supabase-jwt-auth.mjs";
import {
  parseClientRoleHint,
  resolveLiveKitTokenGrants,
} from "../_shared/tlv-livekit-token-authz.mjs";
import { assertSecurityCircuitAllows } from "../_shared/security-circuit-breaker.mjs";

const MAX_BODY_BYTES = 8 * 1024;
const DEFAULT_TTL_SEC = 900;
const MAX_TTL_SEC = 3600;
const MIN_TTL_SEC = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const ROOM_RE = /^[a-zA-Z0-9._-]{1,96}$/;

/** @type {Map<string, { count: number, resetAt: number }>} */
const rateBuckets = new Map();

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

function sanitizeIdentity(userId) {
  return String(userId || "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 64);
}

function pocEnabled(env) {
  const formal = String(env.LIVEKIT_FORMAL_ENABLED || "").trim().toLowerCase();
  if (formal === "1" || formal === "true" || formal === "yes") return true;
  const flag = String(env.LIVEKIT_POC_ENABLED || "").trim().toLowerCase();
  if (flag === "1" || flag === "true" || flag === "yes") return true;
  // Local wrangler: credentials present implies token mint allowed (still fail-closed without secrets)
  return Boolean(String(env.LIVEKIT_API_KEY || "").trim() && String(env.LIVEKIT_API_SECRET || "").trim());
}

function readLiveKitEnv(env) {
  return {
    apiKey: String(env.LIVEKIT_API_KEY || "").trim(),
    apiSecret: String(env.LIVEKIT_API_SECRET || "").trim(),
    url: String(env.LIVEKIT_URL || env.LIVEKIT_WS_URL || "").trim(),
  };
}

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") return handleOptions();

  if (!pocEnabled(env)) {
    return jsonResponse(
      {
        error: "livekit_poc_disabled",
        code: "BLOCKED_LIVEKIT_CREDENTIALS",
        detail: "Set LIVEKIT_FORMAL_ENABLED or LIVEKIT_POC_ENABLED and LIVEKIT_* secrets in .dev.vars.",
      },
      503,
    );
  }

  const lk = readLiveKitEnv(env);
  if (!lk.apiKey || !lk.apiSecret || !lk.url) {
    return jsonResponse(
      {
        error: "livekit_credentials_missing",
        code: "BLOCKED_LIVEKIT_CREDENTIALS",
        detail: "Missing LIVEKIT_API_KEY / LIVEKIT_API_SECRET / LIVEKIT_URL",
      },
      503,
    );
  }

  const rate = enforceRateLimit(request);
  if (!rate.ok) return rate.response;

  const contentLength = readContentLength(request);
  if (contentLength != null && contentLength > MAX_BODY_BYTES) {
    return jsonResponse({ error: "body_too_large", code: "body_too_large" }, 413);
  }

  const authEnv = pickSupabaseAuthEnv(env);
  const parsedBearer = extractBearerToken(request);
  if (!parsedBearer.ok) {
    return jsonResponse(
      { error: parsedBearer.error || "auth_required", code: parsedBearer.error || "auth_required" },
      parsedBearer.http || 401,
    );
  }
  if (!authEnv.url || !authEnv.anonKey) {
    return jsonResponse({ error: "auth_unavailable", code: "auth_unavailable" }, 503);
  }

  /** Single /auth/v1/user probe (avoids double-fetch flake). */
  let authUserId = "";
  let talkUserId = "";
  let authProbe = null;
  try {
    const verified = await verifySupabaseAccessToken(
      parsedBearer.token,
      authEnv.url,
      authEnv.anonKey,
    );
    authProbe = {
      ok: verified.ok,
      error: verified.ok ? null : verified.error,
      http: verified.ok ? 200 : verified.http,
    };
    if (!verified.ok) {
      return jsonResponse(
        {
          error: verified.error,
          code: verified.error,
          pocDiag: { hasSupabaseUrl: true, hasAnonKey: true, authProbe },
        },
        verified.http || 401,
      );
    }
    authUserId = String(verified.userId || "").trim();
    talkUserId = String(verified.talkUserId || verified.userId || "").trim();
    if (!authUserId) {
      return jsonResponse(
        {
          error: "invalid_token",
          code: "invalid_token",
          pocDiag: { hasSupabaseUrl: true, hasAnonKey: true, authProbe, hasUserId: false },
        },
        401,
      );
    }
    const circuit = await assertSecurityCircuitAllows(env, {
      capability: "service",
      service: "tlv",
      userId: authUserId,
    });
    if (!circuit.allowed) {
      return jsonResponse(
        { error: circuit.code, code: circuit.code },
        circuit.http || 503,
      );
    }
  } catch (err) {
    return jsonResponse(
      {
        error: "auth_unavailable",
        code: "auth_unavailable",
        pocDiag: {
          hasSupabaseUrl: Boolean(authEnv.url),
          hasAnonKey: Boolean(authEnv.anonKey),
          authProbe: { status: null, ok: false, reason: "fetch_threw", name: String(err?.name || "Error") },
        },
      },
      503,
    );
  }

  let body;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      return jsonResponse({ error: "body_too_large", code: "body_too_large" }, 413);
    }
    body = text ? JSON.parse(text) : {};
  } catch {
    return jsonResponse({ error: "invalid_json", code: "invalid_json" }, 400);
  }

  const roleHint = parseClientRoleHint(body.role);
  const roomName = String(body.roomName || body.room || "").trim();
  if (!ROOM_RE.test(roomName)) {
    return jsonResponse({ error: "invalid_room", code: "invalid_room" }, 400);
  }

  const grants = await resolveLiveKitTokenGrants({
    authUserId,
    talkUserId,
    roomName,
    roleHint,
    env,
  });
  if (!grants.ok) {
    return jsonResponse(
      {
        error: grants.error,
        code: grants.error,
        roleHint,
        detail: "Server denied publish/host grant; client role is not authority.",
      },
      grants.http || 403,
    );
  }

  const isHost = grants.effectiveRole === "host";

  let ttlSec = Number(body.ttlSec);
  if (!Number.isFinite(ttlSec)) ttlSec = DEFAULT_TTL_SEC;
  ttlSec = Math.max(MIN_TTL_SEC, Math.min(MAX_TTL_SEC, Math.floor(ttlSec)));

  const identity = sanitizeIdentity(authUserId);
  if (!identity) {
    return jsonResponse({ error: "invalid_identity", code: "invalid_identity" }, 400);
  }

  try {
    const minted = await createLiveKitAccessToken({
      apiKey: lk.apiKey,
      apiSecret: lk.apiSecret,
      identity: isHost ? `host_${identity}` : `viewer_${identity}`,
      name: isHost ? "tlv-host" : "tlv-viewer",
      roomName,
      ttlSec,
      canPublish: grants.canPublish === true,
      canSubscribe: true,
      canPublishData: false,
    });

    return jsonResponse({
      ok: true,
      formal: true,
      poc: true,
      url: lk.url,
      token: minted.token,
      roomName: minted.roomName,
      identity: minted.identity,
      expiresAt: minted.expiresAt,
      ttlSec: minted.ttlSec,
      role: isHost ? "broadcaster" : "viewer",
      roleHint,
      access: grants.access,
      broadcastId: grants.broadcastId,
      grants: {
        roomJoin: true,
        canPublish: minted.canPublish,
        canSubscribe: minted.canSubscribe,
      },
    });
  } catch (err) {
    const msg = err && err.message ? String(err.message) : "token_mint_failed";
    return jsonResponse({ error: "token_mint_failed", code: msg }, 500);
  }
}
