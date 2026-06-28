/**
 * Live Platform Session — 入力検証（throw 禁止 · 結果オブジェクトのみ）
 * Phase A · surface 必須
 */
(function (global) {
  "use strict";

  const CODES = global.PLATFORM_LIVE_SESSION_ERROR_CODES || global.TasuLivePlatformSessionErrorCodes;
  const SURFACES = global.LIVE_SURFACES || global.TasuLivePlatformSurfaces;
  const MAX_ID_LEN = 128;
  const MAX_MSG_LEN = 512;
  const ID_PATTERN = /^[a-zA-Z0-9._-]+$/;

  /** @param {string} field @param {string} message @param {string} [code] */
  function fail(field, message, code) {
    return {
      ok: false,
      code: code || CODES?.VALIDATION_ERROR || "VALIDATION_ERROR",
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
  function validateSurface(value, opts = { required: true }) {
    const s = String(value ?? "").trim().toLowerCase();
    if (!s) {
      return opts.required !== false
        ? fail("surface", "surface が必要です", CODES?.SURFACE_ERROR || "SURFACE_ERROR")
        : fail("surface", "surface が必要です", CODES?.SURFACE_ERROR || "SURFACE_ERROR");
    }
    const allowed = SURFACES ? Object.values(SURFACES) : ["platform", "tlv", "talk", "builder"];
    if (!allowed.includes(s)) {
      return fail(
        "surface",
        `surface は ${allowed.join("|")} のいずれかです`,
        CODES?.SURFACE_ERROR || "SURFACE_ERROR"
      );
    }
    return ok(s);
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

  /** @param {unknown} value */
  function validatePresenceStatus(value) {
    if (value == null || value === "") return ok("online");
    const s = String(value).trim().toLowerCase();
    if (s === "online" || s === "away" || s === "offline") return ok(s);
    return fail("presenceStatus", "presenceStatus は online|away|offline です");
  }

  /**
   * @param {unknown} name
   * @param {Record<string, string>} [eventsMap]
   */
  function validateEventName(name, eventsMap) {
    const n = String(name ?? "").trim();
    if (!n) return fail("eventName", "eventName が必要です");
    const events = eventsMap || global.PLATFORM_LIVE_SESSION_EVENTS || global.TasuLivePlatformSessionEvents;
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
    const signals = signalsMap || global.PLATFORM_LIVE_PROVIDER_SIGNALS || global.TasuLivePlatformProviderSignals;
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

  global.TasuLivePlatformSessionValidation = Object.freeze({
    CODES,
    validateSurface,
    validateRoomId,
    validateUserId,
    validateRole,
    validateSessionId,
    validatePresenceStatus,
    validateEventName,
    validateProviderSignal,
    validateErrorPayload,
    normalizeErrorCode,
  });
})(typeof window !== "undefined" ? window : globalThis);
