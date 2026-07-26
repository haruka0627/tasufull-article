/**
 * TalkVoiceTurnRateLimiter — Cloudflare Durable Object
 *
 * Deployable Worker entry (separate from Production gemini-live-proxy).
 * Does NOT store: JWT, TURN secrets, raw user ids, raw IPs, Authorization headers.
 * Storage values: opaque counters only ({ count, windowStart, burstCount, burstStart }).
 *
 * Pages Functions bind via:
 *   env.TALK_VOICE_RATE_LIMITER = DurableObjectNamespace
 * See: deploy/cloudflare/wrangler.pages.talk-voice-rate-limit.example.toml
 */

const STORAGE_KEY = "bucket";

/** Local copy of consumeBucket — keep Worker self-contained for wrangler bundling. */
function consumeBucket(prev, { max, burst, windowMs, burstWindowMs, now }) {
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
      state: { count, windowStart: start, burstCount, burstStart },
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

export class TalkVoiceTurnRateLimiter {
  /**
   * @param {DurableObjectState} state
   * @param {Record<string, string>} env
   */
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  /**
   * @param {Request} request
   */
  async fetch(request) {
    if (request.method !== "POST") {
      return Response.json({ ok: false, error: "method_not_allowed" }, { status: 405 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
    }

    const action = String(body?.action || "");
    const max = Number(body?.max);
    const burst = Number(body?.burst);
    const windowMs = Number(body?.windowMs);
    const burstWindowMs = Number(body?.burstWindowMs) || 10_000;
    const now = Number(body?.nowMs) || Date.now();

    if (![max, burst, windowMs].every((n) => Number.isFinite(n) && n > 0)) {
      return Response.json({ ok: false, error: "invalid_params" }, { status: 400 });
    }

    const prev = (await this.state.storage.get(STORAGE_KEY)) || null;

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
    await this.state.storage.put(STORAGE_KEY, result.state);
    try {
      const expireAt = result.state.windowStart + windowMs + 1_000;
      await this.state.storage.setAlarm(expireAt);
    } catch {
      // Alarm optional
    }

    return Response.json({
      ok: true,
      allowed: result.allowed,
      retryAfterSec: result.retryAfterSec,
    });
  }

  async alarm() {
    await this.state.storage.delete(STORAGE_KEY);
  }
}

/** Worker fetch stub — DO-only; HTTP entry is unused. */
export default {
  async fetch() {
    return new Response("TalkVoiceTurnRateLimiter worker — DO only", { status: 404 });
  },
};
