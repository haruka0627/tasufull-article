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

const MAX_BODY_BYTES = 2048;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 6;
const rateBuckets = new Map();

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function rateLimit(key, now = Date.now()) {
  let bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + RATE_WINDOW_MS };
    rateBuckets.set(key, bucket);
  }
  bucket.count += 1;
  return bucket.count <= RATE_MAX
    ? { ok: true }
    : { ok: false, error: "rate_limited", http: 429, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
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

  const auth = await requireSupabaseUser(request, env);
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.http);

  const parsed = await parseBody(request);
  if (!parsed.ok) return json({ ok: false, error: parsed.error }, parsed.http);
  const sessionId = String(parsed.body?.sessionId || "").trim();

  const rate = rateLimit(`${auth.userId}:${sessionId}`);
  if (!rate.ok) {
    return json(
      { ok: false, error: rate.error, retryAfterSec: rate.retryAfterSec },
      rate.http,
    );
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
  rateLimit,
  resetRateLimits() {
    rateBuckets.clear();
  },
};
