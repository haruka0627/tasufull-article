/**
 * Live Platform Integration — executeWithRetry (P4-6)
 * publish / join / joinAsViewer · transient only · permission/config never retried
 */
(function (global) {
  "use strict";

  const ErrorMap = () => global.TasuLivePlatformZegoErrorMap;
  const CODES = () => ErrorMap()?.PLATFORM_CODES || {};

  /** @param {unknown} errOrResult */
  function classifyIntegrationRetry(errOrResult) {
    const codes = CODES();
    const isResult = errOrResult && typeof errOrResult === "object" && errOrResult.ok === false;
    const rawError = isResult
      ? errOrResult.error || errOrResult.message || errOrResult.code
      : errOrResult;
    const mapped = ErrorMap()?.mapZegoError?.(rawError, {
      blockedAt: isResult ? errOrResult.code : null,
    }) || {
      code: codes.UNKNOWN || "UNKNOWN_ERROR",
      message: String(rawError || "unknown error"),
      recoverable: false,
      retryAfterMs: 0,
    };

    const message = String(mapped.message || rawError || "unknown error");
    const lower = message.toLowerCase();
    const code = String(isResult && errOrResult.code ? errOrResult.code : mapped.code || codes.UNKNOWN);

    const fatalPermission =
      code === codes.PERMISSION_DENIED ||
      /permission denied|permissions policy|not allowed.*camera|not allowed.*microphone|getusermedia|camera denied|microphone denied/i.test(
        lower,
      );

    const fatalConfig =
      code === codes.CONFIG_ERROR ||
      /token missing|credentials not configured|appid.*missing|server.*missing|misconfigured|config missing|provider misconfigured|not configured/i.test(
        lower,
      );

    if (fatalPermission) {
      return { retryable: false, code: codes.PERMISSION_DENIED || code, message, retryAfterMs: 0 };
    }
    if (fatalConfig) {
      return { retryable: false, code: codes.CONFIG_ERROR || code, message, retryAfterMs: 0 };
    }

    if (code === codes.NETWORK_ERROR || code === codes.TIMEOUT) {
      return {
        retryable: true,
        code,
        message,
        retryAfterMs: Math.min(Math.max(mapped.retryAfterMs || 500, 500), 5000),
      };
    }

    if (code === codes.TOKEN_ERROR && !/missing|not configured|empty token/i.test(lower)) {
      return {
        retryable: true,
        code,
        message,
        retryAfterMs: Math.min(Math.max(mapped.retryAfterMs || 1000, 500), 5000),
      };
    }

    if (/transient|websocket|offline|503|502|504|network|timeout|timed out/i.test(lower)) {
      return {
        retryable: true,
        code: code || codes.NETWORK_ERROR || "NETWORK_ERROR",
        message,
        retryAfterMs: 1000,
      };
    }

    return { retryable: false, code, message, retryAfterMs: 0 };
  }

  /** @param {number} ms */
  function sleep(ms) {
    return new Promise((resolve) => {
      global.setTimeout(resolve, Math.max(0, ms));
    });
  }

  /**
   * @template T
   * @param {() => Promise<T>} fn
   * @param {{
   *   operation?: string,
   *   maxAttempts?: number,
   *   diagnostics?: { recordRetry?: Function, recordLifecycle?: Function },
   *   classify?: typeof classifyIntegrationRetry,
   *   onComplete?: (summary: object) => void,
   * }} [options]
   * @returns {Promise<T>}
   */
  async function executeWithRetry(fn, options = {}) {
    const operation = String(options.operation || "unknown").trim();
    const maxAttempts = Math.max(1, Math.min(3, Math.floor(Number(options.maxAttempts) || 2)));
    const classify = options.classify || classifyIntegrationRetry;
    const diagnostics = options.diagnostics || null;

    /** @type {object} */
    const summary = {
      operation,
      maxAttempts,
      attempts: 0,
      recovered: false,
      exhausted: false,
      lastCode: null,
      lastMessage: null,
    };

    /** @type {unknown} */
    let lastResult = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      summary.attempts = attempt;
      diagnostics?.recordRetry?.("attempt", { operation, attempt, maxAttempts });

      try {
        lastResult = await fn(attempt);
      } catch (err) {
        const decision = classify(err);
        summary.lastCode = decision.code;
        summary.lastMessage = decision.message;
        lastResult = {
          ok: false,
          error: decision.message,
          code: decision.code,
          thrown: true,
        };

        if (!decision.retryable || attempt >= maxAttempts) {
          summary.exhausted = decision.retryable && attempt >= maxAttempts;
          diagnostics?.recordRetry?.(summary.exhausted ? "exhausted" : "failed", {
            operation,
            attempt,
            code: decision.code,
            retryable: decision.retryable,
          });
          options.onComplete?.({ ...summary });
          return /** @type {T} */ (lastResult);
        }

        diagnostics?.recordRetry?.("retrying", {
          operation,
          attempt,
          code: decision.code,
          retryAfterMs: decision.retryAfterMs,
        });
        await sleep(decision.retryAfterMs);
        continue;
      }

      if (!lastResult || typeof lastResult !== "object" || lastResult.ok !== false) {
        if (attempt > 1) {
          summary.recovered = true;
          diagnostics?.recordRetry?.("succeeded", { operation, attempt, recovered: true });
        }
        options.onComplete?.({ ...summary });
        return /** @type {T} */ (lastResult);
      }

      const decision = classify(lastResult);
      summary.lastCode = decision.code;
      summary.lastMessage = decision.message;

      if (!decision.retryable || attempt >= maxAttempts) {
        summary.exhausted = decision.retryable && attempt >= maxAttempts;
        diagnostics?.recordRetry?.(summary.exhausted ? "exhausted" : "failed", {
          operation,
          attempt,
          code: decision.code,
          retryable: decision.retryable,
        });
        options.onComplete?.({ ...summary });
        return /** @type {T} */ (lastResult);
      }

      diagnostics?.recordRetry?.("retrying", {
        operation,
        attempt,
        code: decision.code,
        retryAfterMs: decision.retryAfterMs,
      });
      await sleep(decision.retryAfterMs);
    }

    options.onComplete?.({ ...summary });
    return /** @type {T} */ (lastResult);
  }

  global.TasuLivePlatformRetry = {
    classifyIntegrationRetry,
    executeWithRetry,
    sleep,
  };
})(typeof window !== "undefined" ? window : globalThis);
