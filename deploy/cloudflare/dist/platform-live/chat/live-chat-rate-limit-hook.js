/**
 * Live Platform Chat — Rate Limit Hook（MVP · interface のみ）
 * Phase D · allow | throttle | deny · Redis/DO = Future
 */
(function (global) {
  "use strict";

  /** @readonly */
  const RATE_LIMIT_ACTIONS = Object.freeze({
    ALLOW: "allow",
    THROTTLE: "throttle",
    DENY: "deny",
  });

  /**
   * デフォルト rate limit hook — 常に allow
   * @param {{ surface: string, broadcastId: string, userId: string, action: string }} _ctx
   * @returns {{ action: 'allow'|'throttle'|'deny', retryAfterMs?: number, reason?: string }}
   */
  function defaultRateLimitHook(_ctx) {
    return { action: RATE_LIMIT_ACTIONS.ALLOW };
  }

  /**
   * @param {Function} hook
   * @returns {Function}
   */
  function createRateLimitHook(hook) {
    if (typeof hook !== "function") return defaultRateLimitHook;
    return (ctx) => {
      try {
        const result = hook(ctx);
        const action = String(result?.action || RATE_LIMIT_ACTIONS.ALLOW).trim().toLowerCase();
        if (
          action === RATE_LIMIT_ACTIONS.DENY ||
          action === RATE_LIMIT_ACTIONS.THROTTLE ||
          action === RATE_LIMIT_ACTIONS.ALLOW
        ) {
          return {
            action,
            retryAfterMs: Number(result?.retryAfterMs) > 0 ? Number(result.retryAfterMs) : undefined,
            reason: result?.reason ? String(result.reason) : undefined,
          };
        }
        return { action: RATE_LIMIT_ACTIONS.ALLOW };
      } catch {
        return { action: RATE_LIMIT_ACTIONS.ALLOW };
      }
    };
  }

  global.TasuLivePlatformChatRateLimitHook = Object.freeze({
    ACTIONS: RATE_LIMIT_ACTIONS,
    defaultRateLimitHook,
    createRateLimitHook,
  });
})(typeof window !== "undefined" ? window : globalThis);
