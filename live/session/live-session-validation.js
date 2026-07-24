/**
 * TLV Live Session — 入力検証（Phase2-06 · throw 禁止 · 結果オブジェクトのみ）
 */
(function (global) {
  "use strict";

  const CODES = global.LIVE_SESSION_ERROR_CODES || global.TlvLiveSessionErrorCodes;
  const MAX_ID_LEN = 128;
  const MAX_MSG_LEN = 512;
  const ID_PATTERN = /^[a-zA-Z0-9._-]+$/;

  /** @param {string} field @param {string} message */
  function fail(field, message) {
    return {
      ok: false,
      code: CODES?.VALIDATION_ERROR || "VALIDATION_ERROR",
      message: String(message || "validation failed"),
      field: String(field || ""),
    };
  }

  /** @param {unknown} value */
  function ok(value) {
    return { ok: true, value };
  }

  /**
   * @param {unknown} value
   * @param {{ required?: boolean }} [opts]
   */
  function validateRoomId(value, opts = {}) {
    const s = String(value ?? "").trim();
    if (!s) {
      return opts.required ? fail("roomId", "roomId が必要です") : ok("");
    }
    if (s.length > MAX_ID_LEN) return fail("roomId", "roomId が長すぎます");
    if (!ID_PATTERN.test(s)) return fail("roomId", "roomId の形式が不正です");
    return ok(s);
  }

  /**
   * @param {unknown} value
   * @param {{ required?: boolean }} [opts]
   */
  function validateUserId(value, opts = {}) {
    const s = String(value ?? "").trim();
    if (!s) {
      return opts.required ? fail("userId", "userId が必要です") : ok(null);
    }
    if (s.length > MAX_ID_LEN) return fail("userId", "userId が長すぎます");
    if (!ID_PATTERN.test(s)) return fail("userId", "userId の形式が不正です");
    return ok(s);
  }

  /** @param {unknown} value */
  function validateRole(value) {
    if (value == null || value === "") return ok(null);
    const r = String(value).trim().toLowerCase();
    if (r === "host" || r === "viewer") return ok(r);
    return fail("role", "role は host または viewer です");
  }

  /** @param {unknown} value @param {string} fieldName */
  function validateSessionId(value, fieldName = "sessionId") {
    const s = String(value ?? "").trim();
    if (!s) return ok("");
    if (s.length > MAX_ID_LEN) return fail(fieldName, `${fieldName} が長すぎます`);
    if (!ID_PATTERN.test(s)) return fail(fieldName, `${fieldName} の形式が不正です`);
    return ok(s);
  }

  /**
   * @param {unknown} name
   * @param {Record<string, string>} [eventsMap]
   */
  function validateEventName(name, eventsMap) {
    const n = String(name ?? "").trim();
    if (!n) return fail("eventName", "eventName が必要です");
    const events = eventsMap || global.LIVE_SESSION_EVENTS || global.TlvLiveSessionEvents;
    if (!events || !Object.values(events).includes(n)) {
      return fail("eventName", `未知の eventName: ${n}`);
    }
    return ok(n);
  }

  /**
   * @param {unknown} signal
   * @param {Record<string, string>} [signalsMap]
   */
  function validateProviderSignal(signal, signalsMap) {
    const s = String(signal ?? "").trim();
    if (!s) return fail("providerSignal", "providerSignal が必要です");
    const signals = signalsMap || global.LIVE_PROVIDER_SIGNALS || global.TlvLiveProviderSignals;
    if (!signals || !Object.values(signals).includes(s)) {
      return fail("providerSignal", `未知の providerSignal: ${s}`);
    }
    return ok(s);
  }

  /**
   * @param {unknown} payload
   */
  function validateErrorPayload(payload) {
    const p = payload && typeof payload === "object" ? payload : {};
    const message = String(p.message ?? p.error ?? "").trim();
    if (!message) return fail("message", "error message が必要です");
    if (message.length > MAX_MSG_LEN) return fail("message", "error message が長すぎます");

    let code = String(p.code ?? "").trim();
    if (code && CODES && !Object.values(CODES).includes(code)) {
      code = CODES.UNKNOWN_ERROR;
    }

    return {
      ok: true,
      value: {
        message,
        code: code || CODES?.UNKNOWN_ERROR || "UNKNOWN_ERROR",
        recoverable: p.recoverable !== false,
      },
    };
  }

  /** @param {string} code */
  function normalizeErrorCode(code) {
    const c = String(code ?? "").trim();
    if (CODES && Object.values(CODES).includes(c)) return c;
    return CODES?.UNKNOWN_ERROR || "UNKNOWN_ERROR";
  }

  global.TlvLiveSessionValidation = Object.freeze({
    CODES,
    validateRoomId,
    validateUserId,
    validateRole,
    validateSessionId,
    validateEventName,
    validateProviderSignal,
    validateErrorPayload,
    normalizeErrorCode,
  });
})(typeof window !== "undefined" ? window : globalThis);
