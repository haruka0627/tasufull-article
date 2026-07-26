import {
  authCorsHeaders,
  pickSupabaseAuthEnv,
  requireSupabaseUser,
} from "../_shared/supabase-jwt-auth.mjs";
import {
  assertTurnSessionAccess,
  buildIceServers,
  createTurnRestCredential,
  getTurnConfig,
  validateTurnConfig,
} from "../_shared/talk-voice-turn.mjs";
import {
  extractClientIp,
  getRateLimitConfig,
  enforceCredentialRateLimits,
  precheckAuthFailureIp,
  publicRateLimitBody,
  rateLimitResponseHeaders,
  recordAuthFailure,
} from "../_shared/talk-voice-rate-limit.mjs";

const MAX_BODY_BYTES = 2048;
/** Local isolate pre-filter — must not be looser than DO session burst (6). */
const LOCAL_RATE_WINDOW_MS = 60_000;
const LOCAL_RATE_MAX = 6;
const rateBuckets = new Map();

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache",
      "Referrer-Policy": "no-referrer",
      ...extraHeaders,
    },
  });
}

function rateLimitResponse(result) {
  const body = publicRateLimitBody(result.error, result.retryAfterSec);
  return json(body, result.http, rateLimitResponseHeaders(result.retryAfterSec));
}

function localRateLimit(key, now = Date.now()) {
  let bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + LOCAL_RATE_WINDOW_MS };
    rateBuckets.set(key, bucket);
  }
  bucket.count += 1;
  return bucket.count <= LOCAL_RATE_MAX
    ? { ok: true }
    : {
        ok: false,
        error: "rate_limited",
        http: 429,
        retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000),
      };
}

async function parseBody(request) {
  const length = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
    return { ok: false, error: "payload_too_large", http: 413 };
  }
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return { ok: false, error: "payload_too_large", http: 413 };
    const body = text ? JSON.parse(text) : {};
    return { ok: true, body };
  } catch {
    return { ok: false, error: "invalid_json", http: 400 };
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: authCorsHeaders("POST, OPTIONS") });
  }
  if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const rlConfigResult = getRateLimitConfig(env);
  if (!rlConfigResult.ok) {
    return rateLimitResponse({
      error: "service_unavailable",
      http: 503,
      retryAfterSec: 5,
      reason: rlConfigResult.error,
    });
  }
  const rlConfig = rlConfigResult.config;
  const clientIp = extractClientIp(request, { environment: rlConfig.environment });

  // Auth-failure IP precheck (before expensive auth) when limiter enabled.
  if (rlConfig.enabled) {
    const pre = await precheckAuthFailureIp({ env, config: rlConfig, ip: clientIp });
    if (!pre.ok) return rateLimitResponse(pre);
  }

  const auth = await requireSupabaseUser(request, env);
  if (!auth.ok) {
    if (rlConfig.enabled) {
      const recorded = await recordAuthFailure({ env, config: rlConfig, ip: clientIp });
      // If auth-failure throttle trips, return uniform rate_limited (no enumeration).
      if (!recorded.ok && recorded.error === "rate_limited") {
        return rateLimitResponse(recorded);
      }
      if (!recorded.ok && recorded.error === "service_unavailable") {
        return rateLimitResponse(recorded);
      }
    }
    return json({ ok: false, error: auth.error }, auth.http);
  }

  const parsed = await parseBody(request);
  if (!parsed.ok) return json({ ok: false, error: parsed.error }, parsed.http);
  const sessionId = String(parsed.body?.sessionId || "").trim();

  // Local isolate pre-filter (defense in depth). Final authority is Durable Object.
  const local = localRateLimit(`${auth.userId}:${sessionId}`);
  if (!local.ok) return rateLimitResponse(local);

  if (rlConfig.enabled) {
    const distributed = await enforceCredentialRateLimits({
      env,
      config: rlConfig,
      userId: auth.userId,
      ip: clientIp,
      sessionId,
    });
    if (!distributed.ok) return rateLimitResponse(distributed);
  }

  const turnConfig = getTurnConfig(env);
  const configCheck = validateTurnConfig(turnConfig);
  if (!configCheck.ok) return json({ ok: false, error: configCheck.error }, configCheck.http);

  const { url } = pickSupabaseAuthEnv(env);
  const serviceRoleKey = String(env?.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const access = await assertTurnSessionAccess({
    supabaseUrl: url,
    serviceRoleKey,
    sessionId,
    talkUserId: auth.talkUserId,
  });
  if (!access.ok) return json({ ok: false, error: access.error }, access.http);

  const credential = await createTurnRestCredential({
    sharedSecret: turnConfig.sharedSecret,
    sessionId,
    talkUserId: auth.talkUserId,
    ttlSec: turnConfig.ttlSec,
  });
  return json({
    ok: true,
    sessionId,
    iceServers: buildIceServers(turnConfig, credential),
    expiresAt: credential.expiresAt,
  });
}

export const _test = {
  parseBody,
  rateLimit: localRateLimit,
  resetRateLimits() {
    rateBuckets.clear();
  },
};
