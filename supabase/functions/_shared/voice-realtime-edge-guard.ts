/**
 * Voice Realtime Edge — kill switch + in-memory rate limit (per isolate)
 */

export const VOICE_REALTIME_KILL_SWITCH_ENV = "VOICE_REALTIME_EDGE_ENABLED";
export const VOICE_REALTIME_RATE_LIMIT_MAX = 10;
export const VOICE_REALTIME_RATE_LIMIT_WINDOW_MS = 60_000;

export type VoiceRealtimeGuardFailure = {
  status: 503 | 429;
  body: { ok: false; error: string };
};

type RateBucket = {
  count: number;
  resetAt: number;
};

const rateBuckets = new Map<string, RateBucket>();

/** Kill switch: only explicit "1" enables token issuance. */
export function isVoiceRealtimeEdgeEnabled(envValue: string | undefined | null): boolean {
  return String(envValue ?? "").trim() === "1";
}

export function voiceRealtimeDisabledFailure(): VoiceRealtimeGuardFailure {
  return {
    status: 503,
    body: { ok: false, error: "voice_realtime_disabled" },
  };
}

/**
 * Client IP for rate limiting.
 * Priority: cf-connecting-ip → first x-forwarded-for → unknown
 */
export function extractVoiceRealtimeClientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip")?.trim();
  if (cf) return sanitizeIpKey(cf);

  const xff = req.headers.get("x-forwarded-for")?.trim();
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return sanitizeIpKey(first);
  }

  return "unknown";
}

function sanitizeIpKey(value: string): string {
  return String(value).trim().slice(0, 128) || "unknown";
}

export function checkVoiceRealtimeRateLimit(
  ip: string,
  nowMs: number = Date.now(),
  maxRequests: number = VOICE_REALTIME_RATE_LIMIT_MAX,
  windowMs: number = VOICE_REALTIME_RATE_LIMIT_WINDOW_MS,
): { ok: true } | VoiceRealtimeGuardFailure {
  const key = sanitizeIpKey(ip || "unknown");
  const bucket = rateBuckets.get(key);

  if (!bucket || nowMs >= bucket.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: nowMs + windowMs });
    return { ok: true };
  }

  if (bucket.count >= maxRequests) {
    return {
      status: 429,
      body: { ok: false, error: "rate_limit_exceeded" },
    };
  }

  bucket.count += 1;
  rateBuckets.set(key, bucket);
  return { ok: true };
}

/** Test helper — reset in-memory buckets between smoke cases. */
export function resetVoiceRealtimeRateLimitBuckets(): void {
  rateBuckets.clear();
}
