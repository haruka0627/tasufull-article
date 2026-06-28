/**
 * Live Platform Viewer — 入力検証（throw 禁止）
 * Phase C · surface 必須
 */
(function (global) {
  "use strict";

  const CODES = global.PLATFORM_LIVE_VIEWER_ERROR_CODES || global.TasuLivePlatformViewerErrorCodes;
  const BroadcastV = global.TasuLivePlatformBroadcastValidation;
  const SessionV = global.TasuLivePlatformSessionValidation;

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

  function validateSurface(value, opts = { required: true }) {
    if (BroadcastV?.validateSurface) return BroadcastV.validateSurface(value, opts);
    if (SessionV?.validateSurface) return SessionV.validateSurface(value, opts);
    const s = String(value ?? "").trim().toLowerCase();
    if (!s) return fail("surface", "surface が必要です", CODES?.SURFACE_ERROR || "SURFACE_ERROR");
    return ok(s);
  }

  function validateUserId(value, opts = { required: true }) {
    if (SessionV?.validateUserId) return SessionV.validateUserId(value, opts);
    const s = String(value ?? "").trim();
    if (!s) return opts.required ? fail("userId", "userId が必要です") : ok(null);
    return ok(s);
  }

  function validateBroadcastId(value) {
    if (BroadcastV?.validateBroadcastId) return BroadcastV.validateBroadcastId(value);
    const s = String(value ?? "").trim();
    if (!s) return fail("broadcastId", "broadcastId が必要です");
    return ok(s);
  }

  function validateEventName(name, eventsMap) {
    const n = String(name ?? "").trim();
    if (!n) return fail("eventName", "eventName が必要です");
    const events = eventsMap || global.PLATFORM_LIVE_VIEWER_EVENTS || global.TasuLivePlatformViewerEvents;
    if (!events || !Object.values(events).includes(n)) {
      return fail("eventName", `未知の eventName: ${n}`);
    }
    return ok(n);
  }

  global.TasuLivePlatformViewerValidation = Object.freeze({
    CODES,
    validateSurface,
    validateUserId,
    validateBroadcastId,
    validateEventName,
  });
})(typeof window !== "undefined" ? window : globalThis);
