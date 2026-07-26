/**
 * TALK Voice TURN credential — distributed rate limit (Durable Object client + config).
 *
 * Privacy: never stores raw user id / IP / JWT / TURN secrets.
 * Authority: Durable Object (or explicit local mock for unit tests).
 * Fail-closed when enabled and DO/mock unavailable (Production always fail-closed).
 */
const ENDPOINT = "talk-voice-turn-credentials";
const DEFAULT_BURST_WINDOW_MS = 10_000;

export const RATE_LIMIT_DEFAULTS = Object.freeze({
  userMax: 10,
  userBurst: 6,
  ipMax: 30,
  ipBurst: 10,
  sessionMax: 12,
  sessionBurst: 6,
  globalMax: 300,
  globalBurst: 60,
  authFailureMax: 10,
  authFailureBurst: 5,
  windowSeconds: 60,
  authWindowSeconds: 300,
  burstWindowMs: DEFAULT_BURST_WINDOW_MS,
  failClosedDefaultRetrySec: 5,
});

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function pickStr(...vals) {
  for (const v of vals) {
    const s = String(v ?? "").trim();
    if (s) return s;
  }
  return "";
}

function parsePositiveInt(raw, fallback, { min = 1, max = 1_000_000 } = {}) {
  if (raw == null || String(raw).trim() === "") return { ok: true, value: fallback };
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max) {
    return { ok: false, error: "invalid_numeric_config" };
  }
  return { ok: true, value: n };
}

function enabledFlag(value) {
  return /^(1|true|yes|on)$/i.test(String(value ?? "").trim());
}

function disabledFlag(value) {
  return /^(0|false|no|off)$/i.test(String(value ?? "").trim());
}

/**
 * Detect runtime environment. Unknown → treated as production-like (safe side).
 *
 * Note: CF_PAGES_BRANCH alone is NOT used — local `wrangler pages dev` on
 * branch cf-pages-deploy would otherwise look like Production and fail-closed
 * without a DO binding. Production deploys set CF_PAGES_ENV=production.
 */
export function detectRateLimitEnvironment(env = {}) {
  const explicit = pickStr(env.TALK_VOICE_RATE_LIMIT_NAMESPACE).toLowerCase();
  if (explicit === "production" || explicit === "staging" || explicit === "development") {
    return explicit;
  }
  const pagesEnv = pickStr(env.CF_PAGES_ENV).toLowerCase();
  if (pagesEnv === "production") return "production";
  if (pagesEnv === "preview" || pagesEnv === "staging") return "staging";
  if (enabledFlag(env.TALK_VOICE_RATE_LIMIT_USE_MOCK) || pagesEnv === "local") {
    return "development";
  }
  if (!pagesEnv) return "development";
  return "unknown";
}

export function isProductionLike(environment) {
  return environment === "production" || environment === "unknown";
}

/**
 * @returns {{ ok: true, config: object } | { ok: false, error: string, http: number }}
 */
export function getRateLimitConfig(env = {}) {
  const environment = detectRateLimitEnvironment(env);
  const productionLike = isProductionLike(environment);

  const enabledRaw = env.TALK_VOICE_RATE_LIMIT_ENABLED;
  let enabled;
  if (enabledRaw == null || String(enabledRaw).trim() === "") {
    // Production-like defaults ON (fail-closed). Local/dev defaults OFF until explicitly enabled.
    enabled = productionLike;
  } else if (enabledFlag(enabledRaw)) {
    enabled = true;
  } else if (disabledFlag(enabledRaw)) {
    enabled = false;
  } else {
    return { ok: false, error: "config_invalid", http: 503 };
  }

  if (productionLike && !enabled) {
    return { ok: false, error: "config_invalid", http: 503 };
  }

  const failClosedRaw = env.TALK_VOICE_RATE_LIMIT_FAIL_CLOSED;
  let failClosed;
  if (failClosedRaw == null || String(failClosedRaw).trim() === "") {
    failClosed = true;
  } else if (enabledFlag(failClosedRaw)) {
    failClosed = true;
  } else if (disabledFlag(failClosedRaw)) {
    failClosed = false;
  } else {
    return { ok: false, error: "config_invalid", http: 503 };
  }

  if (productionLike && !failClosed) {
    return { ok: false, error: "config_invalid", http: 503 };
  }

  const useMock = enabledFlag(env.TALK_VOICE_RATE_LIMIT_USE_MOCK);
  if (productionLike && useMock) {
    return { ok: false, error: "config_invalid", http: 503 };
  }

  const namespace = pickStr(env.TALK_VOICE_RATE_LIMIT_NAMESPACE) || environment;
  if (!/^(staging|production|development)$/i.test(namespace)) {
    return { ok: false, error: "config_invalid", http: 503 };
  }
  if (productionLike && namespace.toLowerCase() !== "production") {
    // Production runtime must not share staging namespace (and vice versa).
    if (environment === "production" && namespace.toLowerCase() !== "production") {
      return { ok: false, error: "config_invalid", http: 503 };
    }
  }
  if (environment === "staging" && namespace.toLowerCase() === "production") {
    return { ok: false, error: "config_invalid", http: 503 };
  }

  const nums = {
    userMax: parsePositiveInt(env.TALK_VOICE_RATE_LIMIT_USER_MAX, RATE_LIMIT_DEFAULTS.userMax, {
      min: 1,
      max: 10_000,
    }),
    userBurst: parsePositiveInt(env.TALK_VOICE_RATE_LIMIT_USER_BURST, RATE_LIMIT_DEFAULTS.userBurst, {
      min: 1,
      max: 10_000,
    }),
    ipMax: parsePositiveInt(env.TALK_VOICE_RATE_LIMIT_IP_MAX, RATE_LIMIT_DEFAULTS.ipMax, {
      min: 1,
      max: 100_000,
    }),
    ipBurst: parsePositiveInt(env.TALK_VOICE_RATE_LIMIT_IP_BURST, RATE_LIMIT_DEFAULTS.ipBurst, {
      min: 1,
      max: 100_000,
    }),
    sessionMax: parsePositiveInt(
      env.TALK_VOICE_RATE_LIMIT_SESSION_MAX,
      RATE_LIMIT_DEFAULTS.sessionMax,
      { min: 1, max: 10_000 },
    ),
    sessionBurst: parsePositiveInt(
      env.TALK_VOICE_RATE_LIMIT_SESSION_BURST,
      RATE_LIMIT_DEFAULTS.sessionBurst,
      { min: 1, max: 10_000 },
    ),
    globalMax: parsePositiveInt(
      env.TALK_VOICE_RATE_LIMIT_GLOBAL_MAX,
      RATE_LIMIT_DEFAULTS.globalMax,
      { min: 1, max: 1_000_000 },
    ),
    globalBurst: parsePositiveInt(
      env.TALK_VOICE_RATE_LIMIT_GLOBAL_BURST,
      RATE_LIMIT_DEFAULTS.globalBurst,
      { min: 1, max: 1_000_000 },
    ),
    authFailureMax: parsePositiveInt(
      env.TALK_VOICE_RATE_LIMIT_AUTH_FAILURE_MAX,
      RATE_LIMIT_DEFAULTS.authFailureMax,
      { min: 1, max: 10_000 },
    ),
    authFailureBurst: parsePositiveInt(
      env.TALK_VOICE_RATE_LIMIT_AUTH_FAILURE_BURST,
      RATE_LIMIT_DEFAULTS.authFailureBurst,
      { min: 1, max: 10_000 },
    ),
    windowSeconds: parsePositiveInt(
      env.TALK_VOICE_RATE_LIMIT_WINDOW_SECONDS,
      RATE_LIMIT_DEFAULTS.windowSeconds,
      { min: 1, max: 86_400 },
    ),
    authWindowSeconds: parsePositiveInt(
      env.TALK_VOICE_RATE_LIMIT_AUTH_WINDOW_SECONDS,
      RATE_LIMIT_DEFAULTS.authWindowSeconds,
      { min: 1, max: 86_400 },
    ),
  };

  for (const parsed of Object.values(nums)) {
    if (!parsed.ok) return { ok: false, error: "config_invalid", http: 503 };
  }

  const hashKey = pickStr(env.TALK_VOICE_RATE_LIMIT_HASH_KEY);
  if (enabled && !useMock && hashKey.length < 32) {
    return { ok: false, error: "config_invalid", http: 503 };
  }
  if (enabled && useMock && hashKey.length < 16) {
    // Tests may supply a shorter dedicated mock key (≥16).
    return { ok: false, error: "config_invalid", http: 503 };
  }

  return {
    ok: true,
    config: {
      enabled,
      failClosed,
      useMock,
      environment,
      namespace: namespace.toLowerCase(),
      endpoint: ENDPOINT,
      hashKey,
      userMax: nums.userMax.value,
      userBurst: nums.userBurst.value,
      ipMax: nums.ipMax.value,
      ipBurst: nums.ipBurst.value,
      sessionMax: nums.sessionMax.value,
      sessionBurst: nums.sessionBurst.value,
      globalMax: nums.globalMax.value,
      globalBurst: nums.globalBurst.value,
      authFailureMax: nums.authFailureMax.value,
      authFailureBurst: nums.authFailureBurst.value,
      windowMs: nums.windowSeconds.value * 1000,
      authWindowMs: nums.authWindowSeconds.value * 1000,
      burstWindowMs: RATE_LIMIT_DEFAULTS.burstWindowMs,
      failClosedDefaultRetrySec: RATE_LIMIT_DEFAULTS.failClosedDefaultRetrySec,
    },
  };
}

export async function hashIdentifier(hashKey, ...parts) {
  if (!hashKey || hashKey.length < 16) throw new Error("hash_key_missing");
  const material = parts.map((p) => String(p ?? "").trim()).join("|");
  if (!material) throw new Error("hash_identifier_empty");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(hashKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(material));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Prefer CF-Connecting-IP. Do not trust X-Forwarded-For.
 * Local/dev fallback: 127.0.0.1 when CF header absent.
 */
export function extractClientIp(request, { environment } = {}) {
  const cf = String(request?.headers?.get?.("CF-Connecting-IP") || "").trim();
  if (cf && !/[\s,]/.test(cf) && cf.length <= 64) return cf.toLowerCase();
  if (environment === "development" || environment === "staging") {
    return "127.0.0.1";
  }
  // Production / unknown without CF IP → fail-closed at caller
  return "";
}

/**
 * Pure bucket consume used by DO and in-memory mock.
 * @param {{ count: number, windowStart: number, burstCount: number, burstStart: number }|null} prev
 */
export function consumeBucket(prev, { max, burst, windowMs, burstWindowMs, now }) {
  const start =
    !prev || !Number.isFinite(prev.windowStart) || now - prev.windowStart >= windowMs
      ? now
      : prev.windowStart;
  const burstStart =
    !prev ||
    start !== prev.windowStart ||
    !Number.isFinite(prev.burstStart) ||
    now - prev.burstStart >= burstWindowMs
      ? now
      : prev.burstStart;
  const count = start === prev?.windowStart ? Number(prev.count) || 0 : 0;
  const burstCount = burstStart === prev?.burstStart ? Number(prev.burstCount) || 0 : 0;

  const nextCount = count + 1;
  const nextBurst = burstCount + 1;
  const retryAfterSec = Math.max(1, Math.ceil((start + windowMs - now) / 1000));

  if (nextCount > max || nextBurst > burst) {
    return {
      allowed: false,
      retryAfterSec,
      state: {
        count,
        windowStart: start,
        burstCount,
        burstStart,
      },
    };
  }

  return {
    allowed: true,
    retryAfterSec: 0,
    state: {
      count: nextCount,
      windowStart: start,
      burstCount: nextBurst,
      burstStart,
    },
  };
}

export function createTelemetryEvent(partial = {}) {
  return {
    kind: "talk_voice_rate_limit",
    endpoint: ENDPOINT,
    ts: new Date().toISOString(),
    decision: partial.decision || "unknown",
    reason: partial.reason || "none",
    environment: partial.environment || "unknown",
    status: partial.status || 0,
    retryAfterBucket: bucketRetry(partial.retryAfterSec),
    // Never include user/ip/hash/token/secret
  };
}

function bucketRetry(sec) {
  const n = Number(sec) || 0;
  if (n <= 0) return "0";
  if (n <= 5) return "1-5";
  if (n <= 30) return "6-30";
  if (n <= 60) return "31-60";
  if (n <= 300) return "61-300";
  return "300+";
}

const _telemetrySink = [];

export function emitRateLimitTelemetry(event, sink) {
  const safe = createTelemetryEvent(event);
  if (typeof sink === "function") sink(safe);
  else _telemetrySink.push(safe);
  return safe;
}

export function _testDrainTelemetry() {
  const out = _telemetrySink.splice(0, _telemetrySink.length);
  return out;
}

/**
 * In-memory Durable Object namespace for unit tests / local mock mode.
 */
export function createMockRateLimiterBinding() {
  /** @type {Map<string, object>} */
  const stores = new Map();

  function idFromName(name) {
    return { name: String(name) };
  }

  function isAtLimit(prev, { max, burst, windowMs, burstWindowMs, now }) {
    if (!prev || !Number.isFinite(prev.windowStart)) return false;
    if (now - prev.windowStart >= windowMs) return false;
    if (Number(prev.count) >= max) return true;
    if (
      Number.isFinite(prev.burstStart) &&
      now - prev.burstStart < burstWindowMs &&
      Number(prev.burstCount) >= burst
    ) {
      return true;
    }
    return false;
  }

  function get(id) {
    const key = String(id?.name || id || "");
    return {
      async fetch(input, init) {
        const request = input instanceof Request ? input : new Request(input, init);
        let body;
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
        }
        const action = String(body?.action || "");
        const max = Number(body.max);
        const burst = Number(body.burst);
        const windowMs = Number(body.windowMs);
        const burstWindowMs = Number(body.burstWindowMs) || DEFAULT_BURST_WINDOW_MS;
        const now = Number(body.nowMs) || Date.now();
        if (![max, burst, windowMs].every((n) => Number.isFinite(n) && n > 0)) {
          return Response.json({ ok: false, error: "invalid_params" }, { status: 400 });
        }
        const prev = stores.get(key) || null;

        if (action === "peek") {
          const limited = isAtLimit(prev, { max, burst, windowMs, burstWindowMs, now });
          const retryAfterSec = limited
            ? Math.max(1, Math.ceil((prev.windowStart + windowMs - now) / 1000))
            : 0;
          return Response.json({ ok: true, limited, retryAfterSec });
        }

        if (action !== "consume") {
          return Response.json({ ok: false, error: "unsupported_action" }, { status: 400 });
        }
        const result = consumeBucket(prev, { max, burst, windowMs, burstWindowMs, now });
        stores.set(key, result.state);
        return Response.json({
          ok: true,
          allowed: result.allowed,
          retryAfterSec: result.retryAfterSec,
        });
      },
    };
  }

  return {
    idFromName,
    get,
    _testReset() {
      stores.clear();
    },
    _testDumpKeys() {
      // Keys are already hashed do-names; expose count only for tests.
      return { size: stores.size, keysAreOpaque: true };
    },
  };
}

async function callDoConsume(stub, params) {
  const res = await stub.fetch("https://talk-voice-rate-limit/consume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "consume", ...params }),
  });
  if (!res || typeof res.status !== "number") {
    return { ok: false, error: "do_invalid_response" };
  }
  if (res.status >= 500) return { ok: false, error: "do_fetch_failure" };
  let data;
  try {
    data = await res.json();
  } catch {
    return { ok: false, error: "do_malformed_json" };
  }
  if (!data || data.ok !== true || typeof data.allowed !== "boolean") {
    return { ok: false, error: "do_invalid_response" };
  }
  return {
    ok: true,
    allowed: data.allowed,
    retryAfterSec: Math.max(0, Number(data.retryAfterSec) || 0),
  };
}

function resolveNamespace(env, config) {
  if (config.useMock) {
    if (!env.__talkVoiceRateLimitMock) {
      env.__talkVoiceRateLimitMock = createMockRateLimiterBinding();
    }
    return env.__talkVoiceRateLimitMock;
  }
  return env?.TALK_VOICE_RATE_LIMITER || null;
}

async function consumeAxis({ env, config, axis, identifier, max, burst, windowMs }) {
  const ns = resolveNamespace(env, config);
  if (!ns || typeof ns.idFromName !== "function" || typeof ns.get !== "function") {
    return { ok: false, error: "do_binding_missing" };
  }
  let hash;
  try {
    hash = await hashIdentifier(
      config.hashKey,
      config.namespace,
      config.endpoint,
      axis,
      identifier,
    );
  } catch {
    return { ok: false, error: "hash_failed" };
  }
  // DO name includes axis + hash only (no raw identifier).
  const doName = `tvrl:${config.namespace}:${axis}:${hash}`;
  let stub;
  try {
    stub = ns.get(ns.idFromName(doName));
  } catch {
    return { ok: false, error: "do_binding_missing" };
  }
  try {
    return await callDoConsume(stub, {
      max,
      burst,
      windowMs,
      burstWindowMs: config.burstWindowMs,
    });
  } catch {
    return { ok: false, error: "do_fetch_failure" };
  }
}

function unavailableResult(config, reason) {
  emitRateLimitTelemetry({
    decision: "deny",
    reason,
    environment: config?.environment || "unknown",
    status: 503,
    retryAfterSec: config?.failClosedDefaultRetrySec || 5,
  });
  return {
    ok: false,
    error: "service_unavailable",
    http: 503,
    retryAfterSec: config?.failClosedDefaultRetrySec || 5,
    reason,
  };
}

function limitedResult(config, reason, retryAfterSec) {
  const retry = Math.max(1, Number(retryAfterSec) || config.failClosedDefaultRetrySec);
  emitRateLimitTelemetry({
    decision: "deny",
    reason,
    environment: config.environment,
    status: 429,
    retryAfterSec: retry,
  });
  return {
    ok: false,
    error: "rate_limited",
    http: 429,
    retryAfterSec: retry,
    // reason is internal only — callers must not put it in the HTTP body
    reason,
  };
}

/**
 * Auth-failure IP precheck (does not consume). Uses consume with peek via
 * a dedicated "auth-failure" axis that is only incremented on real failures.
 * Precheck peeks by attempting consume of 0... we instead track separately:
 * call with max and if current would exceed — implement as consume-only-on-failure.
 *
 * For precheck: consume with a "soft" approach — if already over, deny.
 * We store state only on failures, so precheck = try consume with max check
 * by reading... Mock/DO only supports consume. Precheck strategy:
 * use a separate peek action — add peek to protocol.
 */
export async function precheckAuthFailureIp({ env, config, ip }) {
  if (!config.enabled) return { ok: true };
  if (!ip) return unavailableResult(config, "ip_unavailable");

  // Soft consume of a "probe" is wrong. Use peek action.
  const ns = resolveNamespace(env, config);
  if (!ns) {
    return config.failClosed
      ? unavailableResult(config, "do_binding_missing")
      : { ok: true };
  }

  let hash;
  try {
    hash = await hashIdentifier(
      config.hashKey,
      config.namespace,
      config.endpoint,
      "auth-failure",
      ip,
    );
  } catch {
    return unavailableResult(config, "hash_failed");
  }
  const doName = `tvrl:${config.namespace}:auth-failure:${hash}`;
  try {
    const stub = ns.get(ns.idFromName(doName));
    const res = await stub.fetch("https://talk-voice-rate-limit/peek", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "peek",
        max: config.authFailureMax,
        burst: config.authFailureBurst,
        windowMs: config.authWindowMs,
        burstWindowMs: config.burstWindowMs,
      }),
    });
    const data = await res.json();
    if (!data?.ok) return unavailableResult(config, "do_invalid_response");
    if (data.limited) {
      return limitedResult(config, "auth_failure_throttled", data.retryAfterSec);
    }
    return { ok: true };
  } catch {
    return config.failClosed
      ? unavailableResult(config, "do_fetch_failure")
      : { ok: true };
  }
}

export async function recordAuthFailure({ env, config, ip }) {
  if (!config.enabled) return { ok: true };
  if (!ip) return unavailableResult(config, "ip_unavailable");
  const result = await consumeAxis({
    env,
    config,
    axis: "auth-failure",
    identifier: ip,
    max: config.authFailureMax,
    burst: config.authFailureBurst,
    windowMs: config.authWindowMs,
  });
  if (!result.ok) {
    return config.failClosed
      ? unavailableResult(config, result.error)
      : { ok: true };
  }
  if (!result.allowed) {
    return limitedResult(config, "auth_failure_throttled", result.retryAfterSec);
  }
  return { ok: true };
}

/**
 * Authoritative multi-axis limit after successful auth.
 */
export async function enforceCredentialRateLimits({
  env,
  config,
  userId,
  ip,
  sessionId,
}) {
  if (!config.enabled) {
    emitRateLimitTelemetry({
      decision: "allow",
      reason: "disabled",
      environment: config.environment,
      status: 0,
    });
    return { ok: true };
  }

  if (!userId) return unavailableResult(config, "user_missing");
  if (!ip) return unavailableResult(config, "ip_unavailable");

  const axes = [
    {
      axis: "user",
      identifier: userId,
      max: config.userMax,
      burst: config.userBurst,
      windowMs: config.windowMs,
      reason: "user_limited",
    },
    {
      axis: "ip",
      identifier: ip,
      max: config.ipMax,
      burst: config.ipBurst,
      windowMs: config.windowMs,
      reason: "ip_limited",
    },
    {
      axis: "global",
      identifier: `global:${config.namespace}`,
      max: config.globalMax,
      burst: config.globalBurst,
      windowMs: config.windowMs,
      reason: "global_limited",
    },
  ];

  if (sessionId && UUID_RE.test(sessionId)) {
    axes.splice(2, 0, {
      axis: "session",
      identifier: sessionId,
      max: config.sessionMax,
      burst: config.sessionBurst,
      windowMs: config.windowMs,
      reason: "session_limited",
    });
  }

  for (const axis of axes) {
    const result = await consumeAxis({ env, config, ...axis });
    if (!result.ok) {
      return config.failClosed
        ? unavailableResult(config, result.error)
        : { ok: true };
    }
    if (!result.allowed) {
      return limitedResult(config, axis.reason, result.retryAfterSec);
    }
  }

  emitRateLimitTelemetry({
    decision: "allow",
    reason: "within_limits",
    environment: config.environment,
    status: 200,
  });
  return { ok: true };
}

export function rateLimitResponseHeaders(retryAfterSec) {
  const sec = Math.max(1, Number(retryAfterSec) || 1);
  return {
    "Retry-After": String(sec),
    "Cache-Control": "no-store, max-age=0",
    Pragma: "no-cache",
    "Referrer-Policy": "no-referrer",
  };
}

export function publicRateLimitBody(error, retryAfterSec) {
  // Never include axis, hash, DO id, remaining counts.
  if (error === "rate_limited") {
    return {
      ok: false,
      error: "rate_limited",
      retry_after_seconds: Math.max(1, Number(retryAfterSec) || 1),
    };
  }
  return {
    ok: false,
    error: "service_unavailable",
    retry_after_seconds: Math.max(1, Number(retryAfterSec) || 5),
  };
}
