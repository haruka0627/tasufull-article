/**
 * Live Platform — ZEGO / Provider エラー → Platform エラー · Retry Policy
 * Phase 3 · Adapter / Integration 用
 */
(function (global) {
  "use strict";

  const PLATFORM_CODES = Object.freeze({
    PROVIDER_ERROR: "PROVIDER_ERROR",
    TOKEN_ERROR: "TOKEN_ERROR",
    PERMISSION_DENIED: "PERMISSION_DENIED",
    NETWORK_ERROR: "NETWORK_ERROR",
    TIMEOUT: "TIMEOUT",
    CONFIG_ERROR: "CONFIG_ERROR",
    UNKNOWN: "UNKNOWN_ERROR",
  });

  /** @param {unknown} err */
  function normalizeErrorMessage(err) {
    if (!err) return "unknown error";
    if (typeof err === "string") return err;
    if (err instanceof Error) return err.message || err.name;
    if (typeof err === "object") {
      const o = /** @type {{ message?: string, errorCode?: number, code?: number }} */ (err);
      if (o.message && typeof o.message === "string") return o.message;
      if (o.errorCode != null) return `ZEGO errorCode=${o.errorCode}`;
      if (o.code != null) return `ZEGO code=${o.code}`;
      try {
        return JSON.stringify(err);
      } catch {
        return String(err);
      }
    }
    return String(err);
  }

  /**
   * @param {unknown} err
   * @param {{ blockedAt?: string, method?: string }} [ctx]
   */
  function mapZegoError(err, ctx = {}) {
    const message = normalizeErrorMessage(err);
    const lower = message.toLowerCase();
    let code = PLATFORM_CODES.PROVIDER_ERROR;
    let recoverable = false;
    let retryAfterMs = 0;

    if (/permissions policy|permission denied|not allowed.*camera|not allowed.*microphone/i.test(lower)) {
      code = PLATFORM_CODES.PERMISSION_DENIED;
      recoverable = false;
    } else if (/token|401|403|503|credentials not configured/i.test(lower)) {
      code = PLATFORM_CODES.TOKEN_ERROR;
      recoverable = true;
      retryAfterMs = 2000;
    } else if (/timeout|timed out/i.test(lower) || ctx.blockedAt?.includes("timeout")) {
      code = PLATFORM_CODES.TIMEOUT;
      recoverable = true;
      retryAfterMs = 3000;
    } else if (/network|websocket|connect|offline/i.test(lower)) {
      code = PLATFORM_CODES.NETWORK_ERROR;
      recoverable = true;
      retryAfterMs = 5000;
    } else if (/appid|server|config|initialize/i.test(lower)) {
      code = PLATFORM_CODES.CONFIG_ERROR;
      recoverable = false;
    }

    return {
      ok: false,
      code,
      message,
      recoverable,
      retryAfterMs,
      blockedAt: ctx.blockedAt || ctx.method || null,
      platformMapped: true,
    };
  }

  /**
   * @param {{ code?: string, recoverable?: boolean, retryAfterMs?: number }} mapped
   * @param {number} attempt
   */
  function shouldRetry(mapped, attempt, maxAttempts = 2) {
    if (!mapped?.recoverable) return false;
    if (attempt >= maxAttempts) return false;
    return mapped.retryAfterMs > 0;
  }

  global.TasuLivePlatformZegoErrorMap = {
    PLATFORM_CODES,
    normalizeErrorMessage,
    mapZegoError,
    shouldRetry,
  };
})(typeof window !== "undefined" ? window : globalThis);
